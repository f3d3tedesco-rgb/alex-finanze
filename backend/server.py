from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import re
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

app = FastAPI(title="A.L.E.X. Financial Cockpit")
api_router = APIRouter(prefix="/api")


# ---------- Models ----------
class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: "singleton")
    entrate_nette_mensili: float = 0.0
    spese_mensili_essenziali: float = 0.0
    mesi_target_fondo_emergenza: int = 6
    paracadute_genitori: float = 0.0
    saldo_iniziale_etf: float = 0.0
    saldo_iniziale_satellite: float = 0.0
    saldo_iniziale_priamo: float = 0.0
    saldo_iniziale_fondo_figlia: float = 0.0
    saldo_iniziale_fondo_famiglia: float = 0.0
    saldo_iniziale_liquidita: float = 0.0
    saldo_iniziale_fondo_emergenza: float = 0.0
    debito_zio_iniziale: float = 0.0
    debito_zio_rata_mensile: float = 0.0
    data_primo_mese: str = ""  # ISO YYYY-MM
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MonthlyEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mese: str  # YYYY-MM
    # Contributi mensili (investimenti)
    contributo_etf: float = 0.0
    contributo_satellite: float = 0.0
    contributo_priamo_personale: float = 0.0
    contributo_priamo_azienda: float = 0.0
    contributo_fondo_figlia: float = 0.0
    contributo_fondo_famiglia: float = 0.0
    # Debito
    pagamento_debito_zio: float = 0.0
    # Liquidità
    saldo_liquidita_revolut: float = 0.0
    saldo_conto_deposito: float = 0.0
    # Fondo emergenza contributo del mese
    contributo_fondo_emergenza: float = 0.0
    # Entrate/uscite reali del mese (per FSI)
    entrate_mese: float = 0.0
    spese_mese: float = 0.0
    note: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MonthlyEntryCreate(BaseModel):
    mese: str
    contributo_etf: float = 0.0
    contributo_satellite: float = 0.0
    contributo_priamo_personale: float = 0.0
    contributo_priamo_azienda: float = 0.0
    contributo_fondo_figlia: float = 0.0
    contributo_fondo_famiglia: float = 0.0
    pagamento_debito_zio: float = 0.0
    saldo_liquidita_revolut: float = 0.0
    saldo_conto_deposito: float = 0.0
    contributo_fondo_emergenza: float = 0.0
    entrate_mese: float = 0.0
    spese_mese: float = 0.0
    note: str = ""


class Goal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    categoria: str = "generico"  # casa, vacanza, auto, pensione, figlia, ...
    target: float = 0.0
    attuale: float = 0.0
    scadenza: str = ""  # YYYY-MM
    priorita: int = 3  # 1=alta, 5=bassa
    note: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class WatchlistItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ticker: str
    azienda: str
    settore: str = ""
    business_moat: str = ""
    management: str = ""
    bilanci: str = ""
    crescita: str = ""
    valutazione: str = ""
    trend: str = ""
    rischi: str = ""
    prezzo_obiettivo: str = ""
    prezzo_attuale: str = ""
    decisione_finale: str = ""
    motivazione: str = ""
    score: int = 0
    data_analisi: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AnalyzeRequest(BaseModel):
    ticker: str
    azienda: str
    contesto: str = ""


# ---------- Helpers ----------
async def get_settings_doc() -> Settings:
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    if not doc:
        s = Settings()
        await db.settings.insert_one(s.model_dump())
        return s
    return Settings(**doc)


def compute_debt_plan(residuo: float, rata: float, start_month: str, max_months: int = 240) -> List[Dict[str, Any]]:
    plan = []
    if residuo <= 0 or rata <= 0 or not start_month:
        return plan
    try:
        y, m = map(int, start_month.split("-"))
    except Exception:
        return plan
    balance = residuo
    i = 0
    while balance > 0 and i < max_months:
        pay = min(rata, balance)
        row = {
            "n_mese": i + 1,
            "mese": f"{y:04d}-{m:02d}",
            "residuo_inizio": round(balance, 2),
            "pagamento": round(pay, 2),
            "residuo_fine": round(balance - pay, 2),
        }
        plan.append(row)
        balance -= pay
        i += 1
        m += 1
        if m > 12:
            m = 1
            y += 1
    return plan


def calc_fsi(entrate: float, spese: float, liquidita_op: float, fondo_em: float,
             rata_debito: float, risparmio: float, paracadute: float) -> Dict[str, Any]:
    # Sub-indici 0-100
    if spese > 0:
        coverage_months = (liquidita_op + fondo_em) / spese
        i_liq = min(100, (coverage_months / 6.0) * 100)
    else:
        i_liq = 100.0

    if entrate > 0:
        debt_ratio = rata_debito / entrate
        i_debt = max(0, 100 - (debt_ratio / 0.35) * 100)
    else:
        i_debt = 50.0

    if entrate > 0:
        save_ratio = risparmio / entrate
        i_save = min(100, (save_ratio / 0.30) * 100)
    else:
        i_save = 0.0

    if spese > 0:
        i_buffer = min(100, (paracadute / (spese * 3)) * 100)
    else:
        i_buffer = 0.0

    fsi = round(0.35 * i_liq + 0.30 * i_debt + 0.25 * i_save + 0.10 * i_buffer, 1)
    if fsi >= 75:
        giudizio = "Solido"
    elif fsi >= 55:
        giudizio = "Buono"
    elif fsi >= 35:
        giudizio = "Attenzione"
    else:
        giudizio = "Critico"

    return {
        "fsi": fsi,
        "giudizio": giudizio,
        "sub": {
            "liquidita": round(i_liq, 1),
            "debito": round(i_debt, 1),
            "risparmio": round(i_save, 1),
            "buffer": round(i_buffer, 1),
        }
    }


def calc_pac_sustainability(pac_totale: float, entrate: float, spese: float) -> Dict[str, Any]:
    if entrate <= 0:
        return {"pac_totale": pac_totale, "pct_pac_su_entrate": 0, "liquidita_residua": 0, "giudizio": "N/D"}
    pct = (pac_totale / entrate) * 100
    residua = entrate - spese - pac_totale
    if pct >= 30 and residua > 0:
        giudizio = "Ottimo"
    elif pct >= 15 and residua > 0:
        giudizio = "Sostenibile"
    elif residua > 0:
        giudizio = "Basso"
    else:
        giudizio = "Insostenibile"
    return {
        "pac_totale": round(pac_totale, 2),
        "pct_pac_su_entrate": round(pct, 1),
        "liquidita_residua": round(residua, 2),
        "giudizio": giudizio,
    }


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"app": "A.L.E.X.", "version": "1.0", "status": "ready"}


@api_router.get("/settings", response_model=Settings)
async def get_settings():
    return await get_settings_doc()


@api_router.put("/settings", response_model=Settings)
async def update_settings(payload: Settings):
    payload.id = "singleton"
    payload.updated_at = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "singleton"}, {"$set": payload.model_dump()}, upsert=True)
    return payload


@api_router.get("/monthly-entries", response_model=List[MonthlyEntry])
async def list_entries():
    docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(1000)
    return [MonthlyEntry(**d) for d in docs]


@api_router.post("/monthly-entries", response_model=MonthlyEntry)
async def create_entry(payload: MonthlyEntryCreate):
    existing = await db.monthly_entries.find_one({"mese": payload.mese}, {"_id": 0})
    if existing:
        entry = MonthlyEntry(**{**existing, **payload.model_dump()})
        await db.monthly_entries.update_one({"mese": payload.mese}, {"$set": entry.model_dump()})
        return entry
    entry = MonthlyEntry(**payload.model_dump())
    await db.monthly_entries.insert_one(entry.model_dump())
    return entry


@api_router.delete("/monthly-entries/{mese}")
async def delete_entry(mese: str):
    res = await db.monthly_entries.delete_one({"mese": mese})
    return {"deleted": res.deleted_count}


@api_router.get("/dashboard")
async def dashboard():
    settings = await get_settings_doc()
    entries_docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(1000)
    entries = [MonthlyEntry(**d) for d in entries_docs]

    # Cumulative computation
    etf = settings.saldo_iniziale_etf
    sat = settings.saldo_iniziale_satellite
    priamo = settings.saldo_iniziale_priamo
    figlia = settings.saldo_iniziale_fondo_figlia
    famiglia = settings.saldo_iniziale_fondo_famiglia
    fondo_em = settings.saldo_iniziale_fondo_emergenza
    debito = settings.debito_zio_iniziale
    liquidita = settings.saldo_iniziale_liquidita

    history = []
    for e in entries:
        etf += e.contributo_etf
        sat += e.contributo_satellite
        priamo += e.contributo_priamo_personale + e.contributo_priamo_azienda
        figlia += e.contributo_fondo_figlia
        famiglia += e.contributo_fondo_famiglia
        fondo_em += e.contributo_fondo_emergenza
        debito = max(0.0, debito - e.pagamento_debito_zio)
        liquidita = e.saldo_liquidita_revolut + e.saldo_conto_deposito
        pn = etf + sat + priamo + figlia + famiglia + fondo_em + liquidita - debito
        history.append({
            "mese": e.mese,
            "etf": round(etf, 2),
            "satellite": round(sat, 2),
            "priamo": round(priamo, 2),
            "fondo_figlia": round(figlia, 2),
            "fondo_famiglia": round(famiglia, 2),
            "fondo_emergenza": round(fondo_em, 2),
            "liquidita": round(liquidita, 2),
            "debito_residuo": round(debito, 2),
            "patrimonio_netto": round(pn, 2),
            "pac_totale": round(
                e.contributo_etf + e.contributo_satellite + e.contributo_priamo_personale +
                e.contributo_fondo_figlia + e.contributo_fondo_famiglia + e.contributo_fondo_emergenza, 2
            ),
            "entrate": e.entrate_mese,
            "spese": e.spese_mese,
        })

    last = history[-1] if history else {
        "mese": "-",
        "etf": settings.saldo_iniziale_etf,
        "satellite": settings.saldo_iniziale_satellite,
        "priamo": settings.saldo_iniziale_priamo,
        "fondo_figlia": settings.saldo_iniziale_fondo_figlia,
        "fondo_famiglia": settings.saldo_iniziale_fondo_famiglia,
        "fondo_emergenza": settings.saldo_iniziale_fondo_emergenza,
        "liquidita": settings.saldo_iniziale_liquidita,
        "debito_residuo": settings.debito_zio_iniziale,
        "patrimonio_netto": (
            settings.saldo_iniziale_etf + settings.saldo_iniziale_satellite + settings.saldo_iniziale_priamo +
            settings.saldo_iniziale_fondo_figlia + settings.saldo_iniziale_fondo_famiglia +
            settings.saldo_iniziale_fondo_emergenza + settings.saldo_iniziale_liquidita -
            settings.debito_zio_iniziale
        ),
        "pac_totale": 0,
        "entrate": 0,
        "spese": 0,
    }

    # Financial Stress Index (basato su ultimo mese)
    entrate_ref = last.get("entrate") or settings.entrate_nette_mensili
    spese_ref = last.get("spese") or settings.spese_mensili_essenziali
    risparmio = last.get("pac_totale", 0)
    fsi = calc_fsi(
        entrate=entrate_ref,
        spese=spese_ref,
        liquidita_op=last.get("liquidita", 0),
        fondo_em=last.get("fondo_emergenza", 0),
        rata_debito=settings.debito_zio_rata_mensile,
        risparmio=risparmio,
        paracadute=settings.paracadute_genitori,
    )
    pac_sust = calc_pac_sustainability(risparmio, entrate_ref, spese_ref)

    # Fondo emergenza target
    target_fondo_em = settings.spese_mensili_essenziali * settings.mesi_target_fondo_emergenza
    copertura_mesi = (last.get("fondo_emergenza", 0) / settings.spese_mensili_essenziali) if settings.spese_mensili_essenziali > 0 else 0

    # Allocation snapshot (asset totals)
    allocation = [
        {"name": "ETF", "value": last["etf"]},
        {"name": "Satellite", "value": last["satellite"]},
        {"name": "Priamo", "value": last["priamo"]},
        {"name": "Fondo Figlia", "value": last["fondo_figlia"]},
        {"name": "Fondo Famiglia", "value": last["fondo_famiglia"]},
        {"name": "Fondo Emergenza", "value": last["fondo_emergenza"]},
        {"name": "Liquidità", "value": last["liquidita"]},
    ]

    return {
        "last": last,
        "history": history,
        "fsi": fsi,
        "pac_sustainability": pac_sust,
        "fondo_emergenza": {
            "attuale": last.get("fondo_emergenza", 0),
            "target": round(target_fondo_em, 2),
            "copertura_mesi": round(copertura_mesi, 2),
            "mesi_target": settings.mesi_target_fondo_emergenza,
            "gap": round(max(0, target_fondo_em - last.get("fondo_emergenza", 0)), 2),
        },
        "debito": {
            "residuo_attuale": last.get("debito_residuo", 0),
            "residuo_iniziale": settings.debito_zio_iniziale,
            "rata_mensile": settings.debito_zio_rata_mensile,
        },
        "allocation": allocation,
    }


@api_router.get("/debt-plan")
async def debt_plan():
    settings = await get_settings_doc()
    entries_docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(1000)
    total_pagato = sum(d.get("pagamento_debito_zio", 0) for d in entries_docs)
    residuo = max(0.0, settings.debito_zio_iniziale - total_pagato)
    # Trova primo mese non ancora coperto
    if entries_docs:
        last_mese = entries_docs[-1]["mese"]
        y, m = map(int, last_mese.split("-"))
        m += 1
        if m > 12:
            m = 1
            y += 1
        start = f"{y:04d}-{m:02d}"
    else:
        start = settings.data_primo_mese or datetime.now().strftime("%Y-%m")
    plan = compute_debt_plan(residuo, settings.debito_zio_rata_mensile, start)
    return {
        "residuo_attuale": round(residuo, 2),
        "rata_mensile": settings.debito_zio_rata_mensile,
        "mesi_rimanenti": len(plan),
        "data_estinzione": plan[-1]["mese"] if plan else "-",
        "piano": plan,
    }


@api_router.get("/watchlist", response_model=List[WatchlistItem])
async def get_watchlist():
    docs = await db.watchlist.find({}, {"_id": 0}).sort("data_analisi", -1).to_list(500)
    return [WatchlistItem(**d) for d in docs]


@api_router.post("/watchlist", response_model=WatchlistItem)
async def add_watchlist(item: WatchlistItem):
    await db.watchlist.insert_one(item.model_dump())
    return item


@api_router.delete("/watchlist/{item_id}")
async def delete_watchlist(item_id: str):
    res = await db.watchlist.delete_one({"id": item_id})
    return {"deleted": res.deleted_count}


@api_router.get("/goals", response_model=List[Goal])
async def list_goals():
    docs = await db.goals.find({}, {"_id": 0}).sort("priorita", 1).to_list(500)
    return [Goal(**d) for d in docs]


@api_router.post("/goals", response_model=Goal)
async def create_goal(payload: Goal):
    if not payload.id:
        payload.id = str(uuid.uuid4())
    await db.goals.update_one({"id": payload.id}, {"$set": payload.model_dump()}, upsert=True)
    return payload


@api_router.delete("/goals/{goal_id}")
async def delete_goal(goal_id: str):
    res = await db.goals.delete_one({"id": goal_id})
    return {"deleted": res.deleted_count}


@api_router.get("/backup/export")
async def backup_export():
    settings = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    entries = await db.monthly_entries.find({}, {"_id": 0}).to_list(10000)
    watchlist = await db.watchlist.find({}, {"_id": 0}).to_list(10000)
    goals = await db.goals.find({}, {"_id": 0}).to_list(10000)
    return {
        "version": "1.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": settings,
        "monthly_entries": entries,
        "watchlist": watchlist,
        "goals": goals,
    }


class RestorePayload(BaseModel):
    settings: Optional[Dict[str, Any]] = None
    monthly_entries: Optional[List[Dict[str, Any]]] = None
    watchlist: Optional[List[Dict[str, Any]]] = None
    goals: Optional[List[Dict[str, Any]]] = None
    replace: bool = True


@api_router.post("/backup/import")
async def backup_import(payload: RestorePayload):
    if payload.replace:
        await db.monthly_entries.delete_many({})
        await db.watchlist.delete_many({})
        await db.goals.delete_many({})
    if payload.settings:
        s = payload.settings
        s["id"] = "singleton"
        s["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"id": "singleton"}, {"$set": s}, upsert=True)
    if payload.monthly_entries:
        for e in payload.monthly_entries:
            await db.monthly_entries.update_one({"mese": e.get("mese")}, {"$set": e}, upsert=True)
    if payload.watchlist:
        for w in payload.watchlist:
            await db.watchlist.update_one({"id": w.get("id")}, {"$set": w}, upsert=True)
    if payload.goals:
        for g in payload.goals:
            await db.goals.update_one({"id": g.get("id")}, {"$set": g}, upsert=True)
    return {
        "settings": bool(payload.settings),
        "entries": len(payload.monthly_entries or []),
        "watchlist": len(payload.watchlist or []),
        "goals": len(payload.goals or []),
    }


@api_router.post("/ai/analyze")
async def ai_analyze(req: AnalyzeRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY non configurata")

    system = (
        "Sei un analista finanziario senior specializzato in equity research. "
        "Analizza l'azienda richiesta in italiano e restituisci ESCLUSIVAMENTE un oggetto JSON valido "
        "senza testo aggiuntivo, senza markdown, senza backtick. "
        "Schema JSON richiesto:\n"
        "{\n"
        '  "azienda": string,\n'
        '  "ticker": string,\n'
        '  "settore": string,\n'
        '  "business_moat": string (2-3 frasi),\n'
        '  "management": string (2-3 frasi),\n'
        '  "bilanci": string (2-3 frasi con metriche chiave: ricavi, margini, debito),\n'
        '  "crescita": string (2-3 frasi con CAGR e prospettive),\n'
        '  "valutazione": string (2-3 frasi con P/E, P/S, DCF qualitativo),\n'
        '  "trend": string (breve),\n'
        '  "rischi": string (2-3 rischi principali),\n'
        '  "prezzo_obiettivo": string (range es. "180-210 USD"),\n'
        '  "prezzo_attuale": string (stima approssimativa se nota, altrimenti "N/D"),\n'
        '  "decisione_finale": string ("BUY"|"HOLD"|"SELL"|"WATCH"),\n'
        '  "motivazione": string (3-4 frasi),\n'
        '  "score": integer 0-100\n'
        "}"
    )

    prompt = f"Azienda: {req.azienda}\nTicker: {req.ticker}\nContesto extra: {req.contesto or 'nessuno'}\n\nEsegui l'analisi completa."

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"alex-analysis-{uuid.uuid4()}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    try:
        response = await chat.send_message(UserMessage(text=prompt))
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(status_code=502, detail=f"Errore AI: {str(e)}")

    text = response if isinstance(response, str) else str(response)
    # Estrai JSON
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        raise HTTPException(status_code=502, detail="Risposta AI non in formato JSON")
    try:
        data = json.loads(match.group(0))
    except Exception:
        raise HTTPException(status_code=502, detail="JSON AI non valido")

    return data


# Mount router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
