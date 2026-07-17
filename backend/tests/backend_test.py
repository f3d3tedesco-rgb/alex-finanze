"""
A.L.E.X. Financial Cockpit v2.0 - Backend Tests
Tests dynamic schema: Categories, Debts, MonthlyEntry (dict-based), Dashboard, Backup, AI.
"""
import os
import pytest
import requests
import uuid

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------- Root / Health ----------
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    d = r.json()
    assert d.get("version") == "2.0"
    assert d.get("status") == "ready"


# ---------- Categories ----------
DEFAULT_IDS = {"etf", "satellite", "priamo", "fondo_figlia", "fondo_famiglia", "revolut", "conto_deposito"}


def test_categories_defaults_seeded(s):
    r = s.get(f"{API}/categories")
    assert r.status_code == 200
    cats = r.json()
    ids = {c["id"] for c in cats}
    assert DEFAULT_IDS.issubset(ids), f"Missing defaults, got {ids}"
    kinds = {c["id"]: c["kind"] for c in cats if c["id"] in DEFAULT_IDS}
    for cid in ("etf", "satellite", "priamo", "fondo_figlia", "fondo_famiglia"):
        assert kinds[cid] == "accumulation"
    for cid in ("revolut", "conto_deposito"):
        assert kinds[cid] == "balance"


def test_categories_include_archived_flag(s):
    # create one, archive it, verify default list omits, include_archived shows
    cid = f"TEST_arch_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/categories", json={"id": cid, "name": "TEST Archive", "kind": "accumulation"})
    assert r.status_code == 200
    r = s.delete(f"{API}/categories/{cid}")  # soft
    assert r.status_code == 200
    assert r.json().get("archived") == 1

    r = s.get(f"{API}/categories")
    assert cid not in {c["id"] for c in r.json()}
    r = s.get(f"{API}/categories?include_archived=true")
    assert cid in {c["id"] for c in r.json()}
    # cleanup
    s.delete(f"{API}/categories/{cid}?hard=true")


def test_categories_create_auto_id(s):
    r = s.post(f"{API}/categories", json={"id": "", "name": "Crypto", "kind": "accumulation"})
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Crypto"
    assert body["kind"] == "accumulation"
    assert body["id"] and body["id"] != ""
    # cleanup
    s.delete(f"{API}/categories/{body['id']}?hard=true")


def test_categories_upsert_existing(s):
    cid = f"TEST_up_{uuid.uuid4().hex[:6]}"
    s.post(f"{API}/categories", json={"id": cid, "name": "V1", "kind": "accumulation"})
    r = s.post(f"{API}/categories", json={"id": cid, "name": "V2", "kind": "balance", "initial_balance": 500})
    assert r.status_code == 200
    r2 = s.get(f"{API}/categories?include_archived=true")
    found = next(c for c in r2.json() if c["id"] == cid)
    assert found["name"] == "V2"
    assert found["kind"] == "balance"
    assert found["initial_balance"] == 500
    s.delete(f"{API}/categories/{cid}?hard=true")


def test_categories_hard_delete(s):
    cid = f"TEST_hd_{uuid.uuid4().hex[:6]}"
    s.post(f"{API}/categories", json={"id": cid, "name": "ToKill", "kind": "accumulation"})
    r = s.delete(f"{API}/categories/{cid}?hard=true")
    assert r.status_code == 200
    assert r.json().get("deleted") == 1
    r = s.get(f"{API}/categories?include_archived=true")
    assert cid not in {c["id"] for c in r.json()}


# ---------- Debts ----------
def test_debts_crud(s):
    did = f"TEST_debt_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/debts", json={
        "id": did, "name": "TEST Prestito", "initial_amount": 5000,
        "monthly_installment": 250, "start_month": "2026-02",
    })
    assert r.status_code == 200
    assert r.json()["initial_amount"] == 5000

    r = s.get(f"{API}/debts")
    assert did in {d["id"] for d in r.json()}

    # soft delete
    r = s.delete(f"{API}/debts/{did}")
    assert r.status_code == 200 and r.json().get("archived") == 1
    assert did not in {d["id"] for d in s.get(f"{API}/debts").json()}
    assert did in {d["id"] for d in s.get(f"{API}/debts?include_archived=true").json()}

    # hard delete
    r = s.delete(f"{API}/debts/{did}?hard=true")
    assert r.json().get("deleted") == 1


def test_debts_auto_id(s):
    r = s.post(f"{API}/debts", json={"id": "", "name": "TEST Auto", "initial_amount": 100, "monthly_installment": 10})
    assert r.status_code == 200
    body = r.json()
    assert body["id"]
    s.delete(f"{API}/debts/{body['id']}?hard=true")


# ---------- Settings ----------
def test_settings_get_new_schema(s):
    r = s.get(f"{API}/settings")
    assert r.status_code == 200
    d = r.json()
    for k in ("entrate_nette_mensili", "spese_mensili_essenziali", "mesi_target_fondo_emergenza",
              "paracadute_genitori", "saldo_iniziale_fondo_emergenza", "data_primo_mese"):
        assert k in d, f"missing key {k}"
    # old removed keys must NOT be in schema (they get stripped on GET)
    assert "saldo_iniziale_etf" not in d
    assert "debito_zio_iniziale" not in d


def test_settings_put_persists(s):
    original = s.get(f"{API}/settings").json()
    payload = {
        "entrate_nette_mensili": 3500,
        "spese_mensili_essenziali": 1800,
        "mesi_target_fondo_emergenza": 6,
        "paracadute_genitori": 2000,
        "saldo_iniziale_fondo_emergenza": 500,
        "data_primo_mese": "2026-01",
    }
    r = s.put(f"{API}/settings", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["entrate_nette_mensili"] == 3500
    assert body["paracadute_genitori"] == 2000
    # verify persist
    r2 = s.get(f"{API}/settings").json()
    assert r2["entrate_nette_mensili"] == 3500
    assert r2["saldo_iniziale_fondo_emergenza"] == 500


# ---------- Monthly Entries (new dict schema) ----------
def test_monthly_entry_create_and_upsert(s):
    mese = "2099-01"  # far future to avoid collisions
    s.delete(f"{API}/monthly-entries/{mese}")
    payload = {
        "mese": mese,
        "contributions": {"etf": 500, "satellite": 100},
        "balances": {"revolut": 1200},
        "debt_payments": {},
        "contributo_fondo_emergenza": 100,
        "entrate_mese": 3500,
        "spese_mese": 1800,
        "note": "TEST",
    }
    r = s.post(f"{API}/monthly-entries", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["mese"] == mese
    assert body["contributions"]["etf"] == 500
    assert body["balances"]["revolut"] == 1200
    first_id = body["id"]

    # upsert: same mese, new values
    payload["contributions"] = {"etf": 700}
    payload["note"] = "TEST2"
    r = s.post(f"{API}/monthly-entries", json=payload)
    assert r.status_code == 200
    body2 = r.json()
    assert body2["id"] == first_id  # id preserved
    assert body2["contributions"]["etf"] == 700
    assert body2["note"] == "TEST2"

    # cleanup
    r = s.delete(f"{API}/monthly-entries/{mese}")
    assert r.json().get("deleted") == 1


# ---------- Dashboard ----------
def test_dashboard_structure_and_math(s):
    # Setup deterministic scenario
    # 1) reset settings
    s.put(f"{API}/settings", json={
        "entrate_nette_mensili": 3500, "spese_mensili_essenziali": 1800,
        "mesi_target_fondo_emergenza": 6, "paracadute_genitori": 2000,
        "saldo_iniziale_fondo_emergenza": 500, "data_primo_mese": "2099-01",
    })
    # 2) create test category (accumulation with initial_balance)
    cid = f"TEST_dash_{uuid.uuid4().hex[:6]}"
    s.post(f"{API}/categories", json={"id": cid, "name": "TEST Dash", "kind": "accumulation", "initial_balance": 1000})
    # 3) create test debt
    did = f"TEST_dashdebt_{uuid.uuid4().hex[:6]}"
    s.post(f"{API}/debts", json={"id": did, "name": "TEST Debt", "initial_amount": 2000,
                                  "monthly_installment": 100, "start_month": "2099-01"})
    # 4) two monthly entries
    m1 = "2099-06"
    m2 = "2099-07"
    for m in (m1, m2):
        s.delete(f"{API}/monthly-entries/{m}")
    s.post(f"{API}/monthly-entries", json={
        "mese": m1, "contributions": {cid: 200},
        "balances": {}, "debt_payments": {did: 100},
        "contributo_fondo_emergenza": 50, "entrate_mese": 3500, "spese_mese": 1800,
    })
    s.post(f"{API}/monthly-entries", json={
        "mese": m2, "contributions": {cid: 300},
        "balances": {}, "debt_payments": {did: 100},
        "contributo_fondo_emergenza": 50, "entrate_mese": 3500, "spese_mese": 1800,
    })

    r = s.get(f"{API}/dashboard")
    assert r.status_code == 200
    d = r.json()
    for k in ("categories", "debts", "last", "history", "fsi", "pac_sustainability",
             "fondo_emergenza", "allocation"):
        assert k in d, f"dashboard missing {k}"

    # find our history rows
    hist_by_mese = {row["mese"]: row for row in d["history"]}
    # cumulative for our cat: 1000 (initial) + 200 + 300 = 1500 at m2
    assert hist_by_mese[m2]["accum"][cid] == 1500, hist_by_mese[m2]["accum"]
    # after m1 should be 1200
    assert hist_by_mese[m1]["accum"][cid] == 1200

    # debt: our test debt residuo at m2 = 2000-200 = 1800
    test_debt = next(x for x in d["debts"] if x["id"] == did)
    assert test_debt["residuo_iniziale"] == 2000
    assert test_debt["pagato"] == 200
    assert test_debt["residuo_attuale"] == 1800
    assert test_debt["rata_mensile"] == 100

    # allocation includes fondo_emergenza and our cat with color
    alloc_ids = {a["id"] for a in d["allocation"]}
    assert cid in alloc_ids
    assert "fondo_emergenza" in alloc_ids
    our_alloc = next(a for a in d["allocation"] if a["id"] == cid)
    assert "color" in our_alloc

    # fsi has required sub-scores
    assert "fsi" in d["fsi"] and "sub" in d["fsi"]
    for sk in ("liquidita", "debito", "risparmio", "buffer"):
        assert sk in d["fsi"]["sub"]

    # fondo_emergenza
    fe = d["fondo_emergenza"]
    for k in ("attuale", "target", "copertura_mesi", "gap", "mesi_target"):
        assert k in fe

    # cleanup
    s.delete(f"{API}/monthly-entries/{m1}")
    s.delete(f"{API}/monthly-entries/{m2}")
    s.delete(f"{API}/categories/{cid}?hard=true")
    s.delete(f"{API}/debts/{did}?hard=true")


# ---------- Debt Plan ----------
def test_debt_plan(s):
    did = f"TEST_plan_{uuid.uuid4().hex[:6]}"
    s.post(f"{API}/debts", json={"id": did, "name": "TEST Plan", "initial_amount": 300,
                                  "monthly_installment": 100, "start_month": "2099-01"})
    r = s.get(f"{API}/debt-plan/{did}")
    assert r.status_code == 200
    d = r.json()
    for k in ("debt", "residuo_attuale", "pagato", "rata_mensile", "mesi_rimanenti", "data_estinzione", "piano"):
        assert k in d
    assert isinstance(d["piano"], list)
    # 300 / 100 = 3 mesi if no entries
    assert d["mesi_rimanenti"] >= 1
    s.delete(f"{API}/debts/{did}?hard=true")


def test_debt_plan_404(s):
    r = s.get(f"{API}/debt-plan/nonexistent_xyz")
    assert r.status_code == 404


# ---------- Goals ----------
def test_goals_crud(s):
    r = s.post(f"{API}/goals", json={"id": "", "nome": "TEST Obiettivo", "target": 5000, "attuale": 100})
    assert r.status_code == 200
    gid = r.json()["id"]
    assert gid
    r = s.get(f"{API}/goals")
    assert gid in {g["id"] for g in r.json()}
    r = s.delete(f"{API}/goals/{gid}")
    assert r.json().get("deleted") == 1


# ---------- Backup ----------
def test_backup_export_has_all_collections(s):
    r = s.get(f"{API}/backup/export")
    assert r.status_code == 200
    d = r.json()
    assert d.get("version") == "2.0"
    for k in ("settings", "categories", "debts", "monthly_entries", "watchlist", "goals"):
        assert k in d, f"backup missing {k}"
    assert isinstance(d["categories"], list) and len(d["categories"]) >= 7


def test_backup_import_replace_roundtrip(s):
    # export first
    exp = s.get(f"{API}/backup/export").json()
    # remove _id if any
    for k in ("categories", "debts", "monthly_entries", "watchlist", "goals"):
        for it in exp.get(k) or []:
            it.pop("_id", None)
    payload = {
        "settings": exp["settings"],
        "categories": exp["categories"],
        "debts": exp["debts"],
        "monthly_entries": exp["monthly_entries"],
        "watchlist": exp["watchlist"],
        "goals": exp["goals"],
        "replace": True,
    }
    r = s.post(f"{API}/backup/import", json=payload)
    assert r.status_code == 200
    assert r.json().get("ok") is True
    # verify categories still there
    cats = s.get(f"{API}/categories").json()
    assert DEFAULT_IDS.issubset({c["id"] for c in cats})


# ---------- Migration verification ----------
def test_no_legacy_flat_fields_in_entries(s):
    """After migration, entries must have contributions/balances dicts and no old flat fields."""
    r = s.get(f"{API}/monthly-entries")
    assert r.status_code == 200
    entries = r.json()
    for e in entries:
        assert isinstance(e.get("contributions"), dict)
        assert isinstance(e.get("balances"), dict)
        assert isinstance(e.get("debt_payments"), dict)
        for legacy in ("contributo_etf", "contributo_satellite", "saldo_liquidita_revolut", "pagamento_debito_zio"):
            assert legacy not in e, f"legacy field {legacy} still present in {e.get('mese')}"


# ---------- AI smoke test ----------
def test_ai_analyze_smoke(s):
    r = s.post(f"{API}/ai/analyze", json={"ticker": "AAPL", "azienda": "Apple Inc.", "contesto": ""}, timeout=90)
    assert r.status_code == 200, f"AI failed: {r.status_code} {r.text[:300]}"
    d = r.json()
    required = {"azienda", "ticker", "decisione_finale", "score", "motivazione"}
    assert required.issubset(d.keys()), f"missing keys, got {list(d.keys())}"
    assert d["decisione_finale"] in ("BUY", "HOLD", "SELL", "WATCH")


# ---------- v2.1: Target Allocation + Rebalance ----------
def _setup_rebalance_scenario(s):
    """Create 3 test categories with target_allocation and 1 monthly entry."""
    ids = {
        "under1": f"TEST_reb_u1_{uuid.uuid4().hex[:6]}",
        "under2": f"TEST_reb_u2_{uuid.uuid4().hex[:6]}",
        "over": f"TEST_reb_ov_{uuid.uuid4().hex[:6]}",
        "notarg": f"TEST_reb_nt_{uuid.uuid4().hex[:6]}",
    }
    # under1: current 0, target 50%  -> underweight
    s.post(f"{API}/categories", json={"id": ids["under1"], "name": "TEST U1",
                                       "kind": "accumulation", "initial_balance": 0,
                                       "target_allocation": 50})
    # under2: current 100, target 30% -> underweight (current pct depends on total)
    s.post(f"{API}/categories", json={"id": ids["under2"], "name": "TEST U2",
                                       "kind": "accumulation", "initial_balance": 100,
                                       "target_allocation": 30})
    # over: current 900, target 20% -> overweight
    s.post(f"{API}/categories", json={"id": ids["over"], "name": "TEST OV",
                                       "kind": "accumulation", "initial_balance": 900,
                                       "target_allocation": 20})
    # notarg: target_allocation=0 -> must be excluded
    s.post(f"{API}/categories", json={"id": ids["notarg"], "name": "TEST NT",
                                       "kind": "accumulation", "initial_balance": 500,
                                       "target_allocation": 0})
    return ids


def _cleanup_rebalance_scenario(s, ids):
    for cid in ids.values():
        s.delete(f"{API}/categories/{cid}?hard=true")


def test_category_target_allocation_persists(s):
    cid = f"TEST_ta_{uuid.uuid4().hex[:6]}"
    r = s.post(f"{API}/categories", json={"id": cid, "name": "TEST TA",
                                           "kind": "accumulation", "target_allocation": 42.5})
    assert r.status_code == 200
    assert r.json()["target_allocation"] == 42.5
    # verify persist
    cats = s.get(f"{API}/categories").json()
    found = next(c for c in cats if c["id"] == cid)
    assert found["target_allocation"] == 42.5
    s.delete(f"{API}/categories/{cid}?hard=true")


def test_rebalance_endpoint_structure(s):
    ids = _setup_rebalance_scenario(s)
    try:
        r = s.get(f"{API}/rebalance", params={"monthly_budget": 500, "months": 12})
        assert r.status_code == 200
        d = r.json()
        for k in ("monthly_budget", "months", "total_current", "total_final_projected",
                  "total_gap", "suggestions"):
            assert k in d, f"missing {k}"
        assert d["monthly_budget"] == 500
        assert d["months"] == 12
        assert isinstance(d["suggestions"], list)

        # Only 3 targeted (notarg excluded)
        sug_ids = {sug["id"] for sug in d["suggestions"]}
        assert ids["notarg"] not in sug_ids, "target_allocation=0 must be excluded"
        assert ids["under1"] in sug_ids
        assert ids["under2"] in sug_ids
        assert ids["over"] in sug_ids

        # Each suggestion has required fields
        for sug in d["suggestions"]:
            for k in ("id", "name", "current_value", "current_pct", "target_pct",
                      "gap_euro", "suggested_monthly", "months"):
                assert k in sug, f"suggestion missing {k}"
    finally:
        _cleanup_rebalance_scenario(s, ids)


def test_rebalance_skips_overweight_and_sums_to_budget(s):
    ids = _setup_rebalance_scenario(s)
    try:
        budget = 500.0
        r = s.get(f"{API}/rebalance", params={"monthly_budget": budget, "months": 12})
        d = r.json()
        by_id = {sug["id"]: sug for sug in d["suggestions"]}

        # Overweight: current 900/1000 = 90% vs target 20% -> suggested_monthly = 0
        assert by_id[ids["over"]]["suggested_monthly"] == 0, \
            f"overweight should be 0, got {by_id[ids['over']]['suggested_monthly']}"

        # Underweight cats should get > 0
        assert by_id[ids["under1"]]["suggested_monthly"] > 0
        # under2: current 100/1000=10% vs target 30% -> underweight -> > 0
        assert by_id[ids["under2"]]["suggested_monthly"] > 0

        # Sum of suggested_monthly across all suggestions == budget (approx)
        total_suggested = sum(sug["suggested_monthly"] for sug in d["suggestions"])
        assert abs(total_suggested - budget) < 0.5, \
            f"sum {total_suggested} != budget {budget}"
    finally:
        _cleanup_rebalance_scenario(s, ids)


def test_rebalance_auto_detect_budget_from_last_entry(s):
    ids = _setup_rebalance_scenario(s)
    mese = "2099-11"
    try:
        s.delete(f"{API}/monthly-entries/{mese}")
        # last entry contributes 200 to under1 and 100 to under2 (total 300 to targeted cats)
        s.post(f"{API}/monthly-entries", json={
            "mese": mese,
            "contributions": {ids["under1"]: 200, ids["under2"]: 100, ids["notarg"]: 999},
            "balances": {}, "debt_payments": {},
            "entrate_mese": 3500, "spese_mese": 1800,
        })
        r = s.get(f"{API}/rebalance", params={"monthly_budget": 0, "months": 12})
        assert r.status_code == 200
        d = r.json()
        # notarg contribution excluded because it's not a targeted category
        assert d["monthly_budget"] == 300, f"expected auto-detect 300, got {d['monthly_budget']}"
    finally:
        s.delete(f"{API}/monthly-entries/{mese}")
        _cleanup_rebalance_scenario(s, ids)


def test_rebalance_no_targets(s):
    """When no categories have target_allocation>0, returns empty suggestions with note."""
    # Just call: default seeded categories have target_allocation=0
    r = s.get(f"{API}/rebalance", params={"monthly_budget": 500, "months": 12})
    assert r.status_code == 200
    d = r.json()
    # If no test cats exist, defaults have target_allocation=0
    if not d["suggestions"]:
        assert "note" in d


def test_dashboard_allocation_targets(s):
    ids = _setup_rebalance_scenario(s)
    try:
        r = s.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        assert "allocation_targets" in d
        assert "allocation_target_sum" in d
        at = d["allocation_targets"]
        at_ids = {a["id"] for a in at}
        # target=0 must be excluded
        assert ids["notarg"] not in at_ids
        # 3 targeted must be present
        assert ids["under1"] in at_ids
        assert ids["under2"] in at_ids
        assert ids["over"] in at_ids

        # Each entry has required fields including status
        for a in at:
            for k in ("current_pct", "target_pct", "drift_pct", "status"):
                assert k in a
            assert a["status"] in ("aligned", "overweight", "underweight")

        # over category: current_value=900 with target 20% -> overweight (high value, low target)
        over_entry = next(a for a in at if a["id"] == ids["over"])
        assert over_entry["status"] == "overweight"
        assert over_entry["target_pct"] == 20.0
        assert over_entry["value"] == 900.0

        # under1: value 0, 50% target -> underweight
        u1 = next(a for a in at if a["id"] == ids["under1"])
        assert u1["status"] == "underweight"
        assert u1["target_pct"] == 50.0

        # allocation_target_sum includes our 3 (50+30+20=100) plus any pre-existing targeted defaults
        assert d["allocation_target_sum"] >= 100.0
    finally:
        _cleanup_rebalance_scenario(s, ids)

