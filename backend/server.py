from fastapi import FastAPI, APIRouter, HTTPException
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

# from emergentintegrations.llm.chat import LlmChat, UserMessage  # module unavailable on PyPI; disabled to prevent startup crash

# Lazy-loaded MongoDB connection
_db = None

def get_db():
    """Get MongoDB connection with lazy initialization."""
    global _db
    if _db is None:
        mongo_url = os.environ.get('MONGO_URL')
        if not mongo_url:
            raise ValueError("MONGO_URL environment variable is not set. Please configure it in Railway.")
        db_name = os.environ.get('DB_NAME')
        if not db_name:
            raise ValueError("DB_NAME environment variable is not set. Please configure it in Railway.")
        client = AsyncIOMotorClient(mongo_url)
        _db = client[db_name]
    return _db

# Create initial placeholder for compatibility
db = None

EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY') or os.environ.get('ANTHROPIC_API_KEY')

# Add FastAPI startup event to initialize connection
app = FastAPI(title="A.L.E.X. Financial Cockpit")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Category(BaseModel):
    """Categoria di investimento o conto (accumulation=PAC che cresce, balance=saldo snapshot mensile)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str = "#10B981"
    kind: str = "accumulation"  # "accumulation" | "balance"
    initial_balance: float = 0.0
    target_allocation: float = 0.0  # % target di allocazione (0-100)
    order: int = 0
    archived: bool = False
    note: str = ""


class Debt(BaseModel):
    """Singolo debito con piano di rientro."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    initial_amount: float = 0.0
    monthly_installment: float = 0.0
    start_month: str = ""  # YYYY-MM
    color: str = "#FF3B30"
    order: int = 0
    archived: bool = False
    note: str = ""


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: "singleton")
    entrate_nette_mensili: float = 0.0
    spese_mensili_essenziali: float = 0.0
    mesi_target_fondo_emergenza: int = 6
    paracadute_genitori: float = 0.0
    saldo_iniziale_fondo_emergenza: float = 0.0
    data_primo_mese: str = ""
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class MonthlyEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mese: str  # YYYY-MM
    contributions: Dict[str, float] = Field(default_factory=dict)  # cat_id -> contributo
    balances: Dict[str, float] = Field(default_factory=dict)       # cat_id -> saldo snapshot
    debt_payments: Dict[str, float] = Field(default_factory=dict)  # debt_id -> pagamento
    contributo_fondo_emergenza: float = 0.0
    entrate_mese: float = 0.0
    spese_mese: float = 0.0
    note: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class Goal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    nome: str
    categoria: str = "generico"
    target: float = 0.0
    attuale: float = 0.0
    scadenza: str = ""
    priorita: int = 3
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


# ---------- Bootstrap / Migration ----------
DEFAULT_CATEGORIES = [
    {"id": "etf", "name": "ETF Core", "color": "#10B981", "kind": "accumulation", "order": 1},
    {"id": "satellite", "name": "Satellite", "color": "#F59E0B", "kind": "accumulation", "order": 2},
    {"id": "priamo", "name": "Priamo (Pensione)", "color": "#6366F1", "kind": "accumulation", "order": 3},
    {"id": "fondo_figlia", "name": "Fondo Figlia", "color": "#EC4899", "kind": "accumulation", "order": 4},
    {"id": "fondo_famiglia", "name": "Fondo Famiglia", "color": "#22D3EE", "kind": "accumulation", "order": 5},
    {"id": "revolut", "name": "Revolut", "color": "#84CC16", "kind": "balance", "order": 6},
    {"id": "conto_deposito", "name": "Conto Deposito", "color": "#A78BFA", "kind": "balance", "order": 7},
]

async def bootstrap_defaults():
    # Categories
    if await db.categories.count_documents({}) == 0:
        old_settings = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
        for c in DEFAULT_CATEGORIES:
            cat = Category(**c)
            if old_settings:
                key = f"saldo_iniziale_{c['id'].replace('etf', 'etf').replace('satellite', 'satellite').replace('priamo', 'priamo').replace('fondo_figlia', 'fondo_figlia').replace('fondo_famiglia', 'fondo_famiglia')}"

async def bootstrap_defaults():
    global db
    if db is None:
        db = get_db()
    # Categories
    if await db.categories.count_documents({}) == 0:
                elif c["id"] in ("revolut", "conto_deposito"):
                    cat.initial_balance = 0.0
            await db.categories.insert_one(cat.model_dump())
        logger.info("Seeded default categories")

    # Debts (migrate old debito_zio if exists)
    if await db.debts.count_documents({}) == 0:
        old_settings = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
        if old_settings and float(old_settings.get("debito_zio_iniziale", 0) or 0) > 0:
            d = Debt(
                id="debito_zio",
                name="Debito Zio",
                initial_amount=float(old_settings.get("debito_zio_iniziale", 0)),
                monthly_installment=float(old_settings.get("debito_zio_rata_mensile", 0)),
                start_month=old_settings.get("data_primo_mese", ""),
                color="#FF3B30",
                order=1,
            )
            await db.debts.insert_one(d.model_dump())
            logger.info("Migrated debito_zio")

    # Migrate old monthly_entries with flat fields to new dict-based
    old_field_map_accum = {
        "contributo_etf": "etf",
        "contributo_satellite": "satellite",
        "contributo_priamo_personale": "priamo",  # merge personale
        "contributo_fondo_figlia": "fondo_figlia",
        "contributo_fondo_famiglia": "fondo_famiglia",
    }
    old_field_map_balance = {
        "saldo_liquidita_revolut": "revolut",
        "saldo_conto_deposito": "conto_deposito",
    }
    async for doc in db.monthly_entries.find({}):
        if "contributions" in doc and isinstance(doc.get("contributions"), dict) and doc.get("contributions"):
            continue  # already new schema
        contributions = {}
        balances = {}
        debt_payments = {}
        for k, cat_id in old_field_map_accum.items():
            v = doc.get(k, 0)
            if v:
                contributions[cat_id] = contributions.get(cat_id, 0) + float(v)
        # Sum priamo personale + azienda into priamo
        if doc.get("contributo_priamo_azienda"):
            contributions["priamo"] = contributions.get("priamo", 0) + float(doc["contributo_priamo_azienda"])
        for k, cat_id in old_field_map_balance.items():
            v = doc.get(k, 0)
            if v:
                balances[cat_id] = float(v)
        if doc.get("pagamento_debito_zio"):
            debt_payments["debito_zio"] = float(doc["pagamento_debito_zio"])
        await db.monthly_entries.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "contributions": contributions,
                    "balances": balances,
                    "debt_payments": debt_payments,
                },
                "$unset": {
                    "contributo_etf": "", "contributo_satellite": "",
                    "contributo_priamo_personale": "", "contributo_priamo_azienda": "",
                    "contributo_fondo_figlia": "", "contributo_fondo_famiglia": "",
                    "pagamento_debito_zio": "",
                    "saldo_liquidita_revolut": "", "saldo_conto_deposito": "",
                }
            }
        )
    logger.info("Bootstrap complete")


# ---------- Helpers ----------
async def get_settings_doc() -> Settings:
    doc = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    if not doc:
        s = Settings()
        await db.settings.insert_one(s.model_dump())
        return s
    # Strip old fields that were removed from schema
    clean = {k: v for k, v in doc.items() if k in Settings.model_fields}
    return Settings(**clean)


async def get_categories(include_archived: bool = False) -> List[Category]:
    q = {} if include_archived else {"archived": {"$ne": True}}
    docs = await db.categories.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return [Category(**d) for d in docs]


async def get_debts(include_archived: bool = False) -> List[Debt]:
    q = {} if include_archived else {"archived": {"$ne": True}}
    docs = await db.debts.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return [Debt(**d) for d in docs]


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
        plan.append({
            "n_mese": i + 1,
            "mese": f"{y:04d}-{m:02d}",
            "residuo_inizio": round(balance, 2),
            "pagamento": round(pay, 2),
            "residuo_fine": round(balance - pay, 2),
        })
        balance -= pay
        i += 1
        m += 1
        if m > 12:
            m = 1
            y += 1
    return plan


def calc_fsi(entrate, spese, liquidita_op, fondo_em, rata_debito, risparmio, paracadute):
    if spese > 0:
        i_liq = min(100, ((liquidita_op + fondo_em) / spese / 6.0) * 100)
    else:
        i_liq = 100.0
    if entrate > 0:
        i_debt = max(0, 100 - ((rata_debito / entrate) / 0.35) * 100)
    else:
        i_debt = 50.0
    if entrate > 0:
        i_save = min(100, ((risparmio / entrate) / 0.30) * 100)
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
    return {"fsi": fsi, "giudizio": giudizio,
            "sub": {"liquidita": round(i_liq, 1), "debito": round(i_debt, 1),
                    "risparmio": round(i_save, 1), "buffer": round(i_buffer, 1)}}


def calc_pac_sustainability(pac_totale, entrate, spese):
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
    return {"pac_totale": round(pac_totale, 2), "pct_pac_su_entrate": round(pct, 1),
            "liquidita_residua": round(residua, 2), "giudizio": giudizio}


# ---------- Routes: Categories ----------
@api_router.get("/categories", response_model=List[Category])
async def list_categories(include_archived: bool = False):
    return await get_categories(include_archived)


@api_router.post("/categories", response_model=Category)
async def upsert_category(payload: Category):
    if not payload.id:
        payload.id = str(uuid.uuid4())
    await db.categories.update_one({"id": payload.id}, {"$set": payload.model_dump()}, upsert=True)
    return payload


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, hard: bool = False):
    # Check if used
    used = await db.monthly_entries.count_documents({
        "$or": [{f"contributions.{cat_id}": {"$exists": True}}, {f"balances.{cat_id}": {"$exists": True}}]
    })
    if hard:
        res = await db.categories.delete_one({"id": cat_id})
        return {"deleted": res.deleted_count, "was_used_in_entries": used}
    # Soft delete via archive
    await db.categories.update_one({"id": cat_id}, {"$set": {"archived": True}})
    return {"archived": 1, "was_used_in_entries": used}


# ---------- Routes: Debts ----------
@api_router.get("/debts", response_model=List[Debt])
async def list_debts(include_archived: bool = False):
    return await get_debts(include_archived)


@api_router.post("/debts", response_model=Debt)
async def upsert_debt(payload: Debt):
    if not payload.id:
        payload.id = str(uuid.uuid4())
    await db.debts.update_one({"id": payload.id}, {"$set": payload.model_dump()}, upsert=True)
    return payload


@api_router.delete("/debts/{debt_id}")
async def delete_debt(debt_id: str, hard: bool = False):
    if hard:
        res = await db.debts.delete_one({"id": debt_id})
        return {"deleted": res.deleted_count}
    await db.debts.update_one({"id": debt_id}, {"$set": {"archived": True}})
    return {"archived": 1}


# ---------- Routes: Settings ----------
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    return await get_settings_doc()


@api_router.put("/settings", response_model=Settings)
async def update_settings(payload: Settings):
    payload.id = "singleton"
    payload.updated_at = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one({"id": "singleton"}, {"$set": payload.model_dump()}, upsert=True)
    return payload


# ---------- Routes: Monthly Entries ----------
@api_router.get("/monthly-entries", response_model=List[MonthlyEntry])
async def list_entries():
    docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(2000)
    return [MonthlyEntry(**d) for d in docs]


class MonthlyEntryCreate(BaseModel):
    mese: str
    contributions: Dict[str, float] = Field(default_factory=dict)
    balances: Dict[str, float] = Field(default_factory=dict)
    debt_payments: Dict[str, float] = Field(default_factory=dict)
    contributo_fondo_emergenza: float = 0.0
    entrate_mese: float = 0.0
    spese_mese: float = 0.0
    note: str = ""


@api_router.post("/monthly-entries", response_model=MonthlyEntry)
async def upsert_entry(payload: MonthlyEntryCreate):
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


# ---------- Dashboard ----------
@api_router.get("/dashboard")
async def dashboard():
    settings = await get_settings_doc()
    categories = await get_categories()
    debts = await get_debts()
    entries_docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(2000)
    entries = [MonthlyEntry(**d) for d in entries_docs]

    # Track running values
    accum_values = {c.id: c.initial_balance for c in categories if c.kind == "accumulation"}
    balance_values = {c.id: c.initial_balance for c in categories if c.kind == "balance"}
    debt_paid = {d.id: 0.0 for d in debts}
    fondo_em = settings.saldo_iniziale_fondo_emergenza

    history = []
    for e in entries:
        for cid, amt in (e.contributions or {}).items():
            if cid in accum_values:
                accum_values[cid] += float(amt or 0)
        for cid, amt in (e.balances or {}).items():
            if cid in balance_values:
                balance_values[cid] = float(amt or 0)
        for did, amt in (e.debt_payments or {}).items():
            if did in debt_paid:
                debt_paid[did] += float(amt or 0)
        fondo_em += float(e.contributo_fondo_emergenza or 0)

        total_accum = sum(accum_values.values())
        total_balance = sum(balance_values.values())
        total_debt = 0.0
        for d in debts:
            residual = max(0.0, d.initial_amount - debt_paid.get(d.id, 0))
            total_debt += residual
        pn = total_accum + total_balance + fondo_em - total_debt
        pac_mese = sum((e.contributions or {}).values()) + float(e.contributo_fondo_emergenza or 0)
        row = {
            "mese": e.mese,
            "accum": dict(accum_values),
            "balance": dict(balance_values),
            "fondo_emergenza": round(fondo_em, 2),
            "liquidita": round(total_balance, 2),
            "debito_residuo": round(total_debt, 2),
            "patrimonio_netto": round(pn, 2),
            "pac_totale": round(pac_mese, 2),
            "entrate": float(e.entrate_mese or 0),
            "spese": float(e.spese_mese or 0),
        }
        history.append(row)

    if history:
        last = history[-1]
    else:
        total_debt0 = sum(d.initial_amount for d in debts)
        last = {
            "mese": "-",
            "accum": {c.id: c.initial_balance for c in categories if c.kind == "accumulation"},
            "balance": {c.id: c.initial_balance for c in categories if c.kind == "balance"},
            "fondo_emergenza": settings.saldo_iniziale_fondo_emergenza,
            "liquidita": sum(c.initial_balance for c in categories if c.kind == "balance"),
            "debito_residuo": total_debt0,
            "patrimonio_netto": (
                sum(c.initial_balance for c in categories)
                + settings.saldo_iniziale_fondo_emergenza
                - total_debt0
            ),
            "pac_totale": 0,
            "entrate": 0,
            "spese": 0,
        }

    entrate_ref = last.get("entrate") or settings.entrate_nette_mensili
    spese_ref = last.get("spese") or settings.spese_mensili_essenziali
    risparmio = last.get("pac_totale", 0)
    total_rata_debito = sum(d.monthly_installment for d in debts if d.initial_amount > 0)
    fsi = calc_fsi(entrate_ref, spese_ref, last.get("liquidita", 0), last.get("fondo_emergenza", 0),
                   total_rata_debito, risparmio, settings.paracadute_genitori)
    pac_sust = calc_pac_sustainability(risparmio, entrate_ref, spese_ref)

    target_fondo_em = settings.spese_mensili_essenziali * settings.mesi_target_fondo_emergenza
    copertura_mesi = (last.get("fondo_emergenza", 0) / settings.spese_mensili_essenziali) if settings.spese_mensili_essenziali > 0 else 0

    allocation = []
    for c in categories:
        v = last["accum"].get(c.id) if c.kind == "accumulation" else last["balance"].get(c.id)
        allocation.append({"id": c.id, "name": c.name, "value": round(float(v or 0), 2), "color": c.color, "kind": c.kind})
    allocation.append({"id": "fondo_emergenza", "name": "Fondo Emergenza",
                       "value": round(last.get("fondo_emergenza", 0), 2), "color": "#10B981", "kind": "special"})

    # Allocation targets analysis (only categories with target_allocation > 0)
    targeted = [c for c in categories if c.target_allocation > 0]
    total_targeted_value = 0.0
    for c in targeted:
        v = last["accum"].get(c.id) if c.kind == "accumulation" else last["balance"].get(c.id)
        total_targeted_value += float(v or 0)
    allocation_targets = []
    for c in targeted:
        v = last["accum"].get(c.id) if c.kind == "accumulation" else last["balance"].get(c.id)
        v = float(v or 0)
        current_pct = (v / total_targeted_value * 100) if total_targeted_value > 0 else 0
        drift = current_pct - c.target_allocation
        allocation_targets.append({
            "id": c.id, "name": c.name, "color": c.color,
            "value": round(v, 2),
            "current_pct": round(current_pct, 2),
            "target_pct": round(c.target_allocation, 2),
            "drift_pct": round(drift, 2),
            "status": "aligned" if abs(drift) <= 3 else ("overweight" if drift > 0 else "underweight"),
        })
    target_sum = round(sum(c.target_allocation for c in targeted), 2)

    # Per-debt residuals
    debts_out = []
    for d in debts:
        paid = debt_paid.get(d.id, 0) if history else 0
        residual = max(0.0, d.initial_amount - paid)
        debts_out.append({
            "id": d.id, "name": d.name, "color": d.color,
            "residuo_iniziale": d.initial_amount, "residuo_attuale": round(residual, 2),
            "pagato": round(paid, 2), "rata_mensile": d.monthly_installment,
            "start_month": d.start_month, "note": d.note,
        })

    return {
        "categories": [c.model_dump() for c in categories],
        "debts": debts_out,
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
        "allocation": allocation,
        "allocation_targets": allocation_targets,
        "allocation_target_sum": target_sum,
    }


@api_router.get("/debt-plan/{debt_id}")
async def debt_plan(debt_id: str):
    debts = await get_debts()
    debt = next((d for d in debts if d.id == debt_id), None)
    if not debt:
        raise HTTPException(status_code=404, detail="Debito non trovato")
    entries_docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(2000)
    paid = sum(float((d.get("debt_payments") or {}).get(debt_id, 0)) for d in entries_docs)
    residuo = max(0.0, debt.initial_amount - paid)
    if entries_docs:
        last_mese = entries_docs[-1]["mese"]
        y, m = map(int, last_mese.split("-"))
        m += 1
        if m > 12:
            m = 1
            y += 1
        start = f"{y:04d}-{m:02d}"
    else:
        start = debt.start_month or datetime.now().strftime("%Y-%m")
    plan = compute_debt_plan(residuo, debt.monthly_installment, start)
    return {
        "debt": debt.model_dump(),
        "residuo_attuale": round(residuo, 2),
        "pagato": round(paid, 2),
        "rata_mensile": debt.monthly_installment,
        "mesi_rimanenti": len(plan),
        "data_estinzione": plan[-1]["mese"] if plan else "-",
        "piano": plan,
    }


@api_router.get("/rebalance")
async def rebalance(monthly_budget: float = 0.0, months: int = 12):
    """Suggerisce quanto versare in ogni categoria targettizzata per convergere al target in N mesi."""
    categories = await get_categories()
    targeted = [c for c in categories if c.target_allocation > 0]
    if not targeted:
        return {"suggestions": [], "note": "Nessuna categoria con target impostato"}

    entries_docs = await db.monthly_entries.find({}, {"_id": 0}).sort("mese", 1).to_list(2000)
    entries = [MonthlyEntry(**d) for d in entries_docs]

    # Compute current values per targeted category
    accum = {c.id: c.initial_balance for c in targeted if c.kind == "accumulation"}
    balance = {c.id: c.initial_balance for c in targeted if c.kind == "balance"}
    for e in entries:
        for cid, amt in (e.contributions or {}).items():
            if cid in accum:
                accum[cid] += float(amt or 0)
        for cid, amt in (e.balances or {}).items():
            if cid in balance:
                balance[cid] = float(amt or 0)

    def val(c):
        return accum.get(c.id, 0) if c.kind == "accumulation" else balance.get(c.id, 0)

    total_current = sum(val(c) for c in targeted)

    # Auto-detect monthly_budget from last entry if not provided
    if monthly_budget <= 0 and entries:
        last = entries[-1]
        monthly_budget = sum((last.contributions or {}).get(c.id, 0) for c in targeted)

    months = max(1, months)
    total_final = total_current + monthly_budget * months

    # Target values and gaps (contribuire solo a chi è sotto-esposto)
    gaps = {}
    for c in targeted:
        current_pct = (val(c) / total_current * 100) if total_current > 0 else 0
        if current_pct < c.target_allocation:
            target_value = c.target_allocation * total_final / 100
            gaps[c.id] = max(0, target_value - val(c))
        else:
            gaps[c.id] = 0.0  # già allineato o sovra-esposto: skip
    total_gap = sum(gaps.values())

    suggestions = []
    for c in targeted:
        gap = gaps[c.id]
        # Suggested contribution: share of budget proportional to gap
        if total_gap > 0 and monthly_budget > 0:
            share = gap / total_gap
            suggested_monthly = share * monthly_budget
        else:
            suggested_monthly = 0.0
        current_pct = (val(c) / total_current * 100) if total_current > 0 else 0
        suggestions.append({
            "id": c.id,
            "name": c.name,
            "color": c.color,
            "current_value": round(val(c), 2),
            "current_pct": round(current_pct, 2),
            "target_pct": c.target_allocation,
            "gap_euro": round(gap, 2),
            "suggested_monthly": round(suggested_monthly, 2),
            "months": months,
        })

    return {
        "monthly_budget": round(monthly_budget, 2),
        "months": months,
        "total_current": round(total_current, 2),
        "total_final_projected": round(total_final, 2),
        "total_gap": round(total_gap, 2),
        "suggestions": suggestions,
    }


# ---------- Goals ----------
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


# ---------- Watchlist ----------
@api_router.get("/watchlist", response_model=List[WatchlistItem])
async def get_watchlist():
    docs = await db.watchlist.find({}, {"_id": 0}).sort("data_analisi", -1).to_list(500)
    return [WatchlistItem(**d) for d in docs]


@api_router.post("/watchlist", response_model=WatchlistItem)
async def add_watchlist(item: WatchlistItem):
    await db.watchlist.update_one({"id": item.id}, {"$set": item.model_dump()}, upsert=True)
    return item


@api_router.delete("/watchlist/{item_id}")
async def delete_watchlist(item_id: str):
    res = await db.watchlist.delete_one({"id": item_id})
    return {"deleted": res.deleted_count}


# ---------- Backup ----------
@api_router.get("/backup/export")
async def backup_export():
    return {
        "version": "2.0",
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": await db.settings.find_one({"id": "singleton"}, {"_id": 0}),
        "categories": await db.categories.find({}, {"_id": 0}).to_list(10000),
        "debts": await db.debts.find({}, {"_id": 0}).to_list(10000),
        "monthly_entries": await db.monthly_entries.find({}, {"_id": 0}).to_list(10000),
        "watchlist": await db.watchlist.find({}, {"_id": 0}).to_list(10000),
        "goals": await db.goals.find({}, {"_id": 0}).to_list(10000),
    }


class RestorePayload(BaseModel):
    settings: Optional[Dict[str, Any]] = None
    categories: Optional[List[Dict[str, Any]]] = None
    debts: Optional[List[Dict[str, Any]]] = None
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
        await db.categories.delete_many({})
        await db.debts.delete_many({})
    if payload.settings:
        s = payload.settings
        s["id"] = "singleton"
        s["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.settings.update_one({"id": "singleton"}, {"$set": s}, upsert=True)
    for coll_name, items in [
        ("categories", payload.categories),
        ("debts", payload.debts),
        ("monthly_entries", payload.monthly_entries),
        ("watchlist", payload.watchlist),
        ("goals", payload.goals),
    ]:
        if items:
            for it in items:
                key = "mese" if coll_name == "monthly_entries" else "id"
                await db[coll_name].update_one({key: it.get(key)}, {"$set": it}, upsert=True)
    return {"ok": True}


# ---------- AI ----------
@api_router.post("/ai/analyze")
async def ai_analyze(req: AnalyzeRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key non configurata")
    system = (
        "Sei un analista finanziario senior specializzato in equity research. "
        "Analizza l'azienda in italiano e restituisci ESCLUSIVAMENTE un oggetto JSON valido "
        "senza testo aggiuntivo, senza markdown, senza backtick.\n"
        "Schema JSON:\n"
        "{\n"
        '  "azienda": string, "ticker": string, "settore": string,\n'
        '  "business_moat": string (2-3 frasi),\n'
        '  "management": string (2-3 frasi),\n'
        '  "bilanci": string (2-3 frasi con ricavi, margini, debito),\n'
        '  "crescita": string (2-3 frasi con CAGR),\n'
        '  "valutazione": string (P/E, P/S, DCF qualitativo),\n'
        '  "trend": string, "rischi": string,\n'
        '  "prezzo_obiettivo": string, "prezzo_attuale": string,\n'
        '  "decisione_finale": "BUY"|"HOLD"|"SELL"|"WATCH",\n'
        '  "motivazione": string (3-4 frasi), "score": integer 0-100\n'
        "}"
    )
    prompt = f"Azienda: {req.azienda}\nTicker: {req.ticker}\nContesto: {req.contesto or 'nessuno'}\n\nEsegui l'analisi."
    # chat = LlmChat(
    #     api_key=EMERGENT_LLM_KEY,
    #     session_id=f"alex-{uuid.uuid4()}",
    #     system_message=system,
    # ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    # try:
    #     response = await chat.send_message(UserMessage(text=prompt))
    # except Exception as e:
    #     logger.exception("LLM error")
    #     raise HTTPException(status_code=502, detail=f"Errore AI: {str(e)}")
    raise HTTPException(status_code=503, detail="Funzione AI non disponibile: modulo emergentintegrations non installato")
    # text = response if isinstance(response, str) else str(response)
    # match = re.search(r"\{.*\}", text, re.DOTALL)
    # if not match:
    #     raise HTTPException(status_code=502, detail="Risposta AI non in formato JSON")
    # try:
    #     return json.loads(match.group(0))
    # except Exception:
    #     raise HTTPException(status_code=502, detail="JSON AI non valido")


@api_router.get("/")
async def root():
    return {"app": "A.L.E.X.", "version": "2.0", "status": "ready"}


# Mount
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    global db, _db
    mongo_url = os.environ.get('MONGO_URL')
    if not mongo_url:
        raise ValueError("MONGO_URL environment variable is not set. Please configure it in Railway.")
    db_name = os.environ.get('DB_NAME')
    if not db_name:
        raise ValueError("DB_NAME environment variable is not set. Please configure it in Railway.")
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    _db = db
    print("MongoDB connection initialized")
    await bootstrap_defaults()



@app.on_event("shutdown")
async def shutdown_event():
    global db
    if db is not None:
        # Close MongoDB connection
        pass
