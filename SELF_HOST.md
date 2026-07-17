# A.L.E.X. — Guida Self-Host (Indipendenza Totale)

**Obiettivo:** far girare la tua app A.L.E.X. senza dipendere da Emergent, con costo mensile praticamente **zero** (solo l'AI, e solo se la vuoi usare).

---

## 🎯 Panoramica architettura

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Frontend React │────▶│  Backend FastAPI │────▶│  MongoDB Atlas   │
│  (Vercel free)  │     │  (Railway free)  │     │  (free tier)     │
└─────────────────┘     └──────────────────┘     └──────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  Claude API      │
                        │  (Anthropic key) │
                        │  ~5€/mese (opz.) │
                        └──────────────────┘
```

**Costo mensile totale:** 0€ (senza AI) — **5-10€** (con AI usata regolarmente).

---

## 📋 Step 1 — Salva il codice su GitHub

Dal menu Emergent (in alto a destra):
1. Click **Save to GitHub**
2. Autorizza GitHub
3. Nome repo: `alex-finance` (o quello che preferisci)
4. Privacy: **Private** (contiene i tuoi dati finanziari!)

Alla fine avrai `https://github.com/tuo-username/alex-finance`.

---

## 📋 Step 2 — Prepara MongoDB Atlas (database gratis)

1. Vai su https://www.mongodb.com/cloud/atlas/register
2. Crea account (gratis, senza carta)
3. **Build a Database** → **M0 Free** (512MB, sempre gratis)
4. Regione: Europa (es. Frankfurt)
5. Crea utente DB: username + password (**salvali!**)
6. **Network Access** → **Allow access from anywhere** (0.0.0.0/0)
7. **Connect** → **Drivers** → copia la **connection string**:
   ```
   mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/
   ```

---

## 📋 Step 3 — Deploy backend su Railway (gratis)

1. Vai su https://railway.app → login con GitHub
2. **New Project** → **Deploy from GitHub repo** → seleziona `alex-finance`
3. Railway rileva automaticamente Python. Nelle **Settings**:
   - **Root directory:** `backend`
   - **Start command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
4. **Variables** (Environment):
   - `MONGO_URL` = la connection string di Atlas
   - `DB_NAME` = `alex_finance`
   - `CORS_ORIGINS` = `*` (per ora, poi metti l'URL del frontend)
   - `ANTHROPIC_API_KEY` = (opzionale, solo se vuoi l'AI — vedi Step 5)
5. Deploy → ottieni un URL tipo `https://alex-finance-production.up.railway.app`
6. Testa: `https://xxx.up.railway.app/api/` deve rispondere `{"app":"A.L.E.X."...}`

**Alternative gratuite al posto di Railway:** Render.com, Fly.io.

---

## 📋 Step 4 — Deploy frontend su Vercel (gratis)

1. Vai su https://vercel.com → login con GitHub
2. **Import Project** → seleziona `alex-finance`
3. **Root Directory:** `frontend`
4. **Framework preset:** Create React App
5. **Environment Variables:**
   - `REACT_APP_BACKEND_URL` = l'URL Railway del backend (senza `/api` finale)
6. Deploy → ottieni `https://alex-finance.vercel.app`

Ora torna in Railway e aggiorna `CORS_ORIGINS` con l'URL Vercel:
```
CORS_ORIGINS=https://alex-finance.vercel.app
```

---

## 📋 Step 5 — (Opzionale) Chiave AI personale per l'analisi aziende

Se vuoi usare la funzione AI Analisi Aziende senza Emergent:

1. Vai su https://console.anthropic.com
2. Crea account, aggiungi credito iniziale (5-10 USD)
3. **API Keys** → **Create Key** → copia la chiave `sk-ant-...`
4. In Railway: aggiungi variabile `ANTHROPIC_API_KEY` con la chiave
5. Modifica `/backend/server.py`:
   ```python
   # Al posto di EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
   ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
   
   # E nel chat:
   chat = LlmChat(
       api_key=ANTHROPIC_API_KEY,
       ...
   )
   ```
   E installa la libreria Anthropic ufficiale se non usi più `emergentintegrations`:
   ```bash
   pip install anthropic
   ```

**Costo tipico:** 0.01-0.05€ per analisi. 100 analisi/mese ≈ 2-5€.

**In alternativa (100% gratis):** usa la funzione **"Aggiungi manualmente"** nella pagina AI Analisi. Fai l'analisi con ChatGPT/Gemini/Claude gratuiti nella loro chat e incolla i risultati nel form manuale. Zero costi AI.

---

## 📋 Step 6 — Backup dei tuoi dati

L'app include due funzioni fondamentali per la tua **sovranità sui dati**:

- **Impostazioni → "Scarica Backup"** → salva un file `.json` con TUTTO (impostazioni, mesi, goals, watchlist)
- **Impostazioni → "Ripristina da Backup"** → carica un file `.json` per ripopolare tutto

Fai un backup ogni fine mese. Se un giorno cambi hosting, importi il JSON e ritrovi tutto.

---

## 🔒 Sicurezza

- Il repo GitHub deve essere **PRIVATE**
- Non committare mai file `.env` con chiavi vere
- MongoDB Atlas: usa una password forte per l'utente DB
- Se in futuro vuoi accesso solo tuo, aggiungi un semplice HTTP Basic Auth sul backend (una manciata di righe)

---

## 🛠 Problemi comuni

**Frontend non vede il backend** → controlla che `REACT_APP_BACKEND_URL` in Vercel sia l'URL Railway senza slash finale e senza `/api`.

**Errore CORS** → aggiungi l'URL Vercel esatto a `CORS_ORIGINS` in Railway.

**"MongoDB connection failed"** → in Atlas verifica che Network Access includa `0.0.0.0/0`.

**AI non funziona** → dopo aver messo la chiave in Railway, riavvia il servizio (Railway → Deployments → Redeploy).

---

## 💰 Riepilogo costi mensili

| Servizio | Piano | Costo |
|----------|-------|-------|
| GitHub (repo private) | Free | 0€ |
| MongoDB Atlas M0 | Free | 0€ |
| Railway backend | Free tier ($5 credit/mese) | 0€ |
| Vercel frontend | Hobby (free) | 0€ |
| Anthropic API (opz.) | Pay-as-you-go | ~5€ |
| **TOTALE** | | **0-5€/mese** |

Sei libero. L'app è tua, i dati sono tuoi, il codice è tuo. 🎉
