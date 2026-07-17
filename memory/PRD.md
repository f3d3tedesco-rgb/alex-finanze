# A.L.E.X. — Artificial Life & Economic Executive

## Problem Statement (original)
Sto creando questo software che raggruppa i miei investimenti, tenendo traccia di tutte le operazioni che compio durante il mese. I miei debiti ecc. Tramite l'ai vorrei anche analizzare varie aziende per poi trovare quelle giuste per appunto investirci. Una di questi fogli è il mio recap mensile dove in 5 min, io inserisco i dati e questi vengono smistati nella varie pagine. Abbelliscilo con grafici e barre di avanzamento. Ogni mese deve mostrarmi l'andamento dei miei investimenti.

## User Choices
- LLM: default (Claude Sonnet 4.5 via Emergent LLM Key)
- Auth: none (single-user personal app)
- Live prices: Alpha Vantage (deferred — key not provided)
- Modules: all
- Data import: user inserts manually

## Architecture
- **Backend**: FastAPI + MongoDB (motor), emergentintegrations for Claude Sonnet 4.5
- **Frontend**: React 19 + Recharts + Shadcn UI + Phosphor Icons + Sonner
- **Theme**: Dark Financial Cockpit "Performance Pro" (Chivo + IBM Plex + JetBrains Mono)

## Implemented (Feb 2026)
- Dashboard KPI (Patrimonio Netto, Debito, Fondo Emergenza, FSI) with delta vs previous month
- Charts: Area PN nel tempo, Donut allocazione, Bar PAC, Line Debito
- Progress bars: Fondo Emergenza, Estinzione Debito, Sostenibilità PAC
- Recap Mensile: single-form input, saves and dispatches to all pages
- Investimenti: 5 asset cards + cumulative line chart + storico table
- Debiti: piano rientro previsionale + progress + curva residuo
- Fondo Emergenza: progress vs target + andamento
- AI Analisi Aziende: Claude Sonnet 4.5, JSON-structured report + watchlist
- Impostazioni: reddito, spese, saldi iniziali, piano debito
- Financial Stress Index + PAC Sustainability index calculators

## Backlog (P1)
- Live stock prices (Alpha Vantage) — awaiting API key
- Export CSV/PDF report mensile
- Import da Excel (upload file esistente)
- Multi-user auth (se necessario)
- Goals custom (Fondo Casa, Vacanze, ecc.)

## Backlog (P2)
- Financial Copilot chat sui propri dati
- Alerts (target raggiunto, spesa fuori norma)
- Confronto scenari (rata debito accelerata vs standard)
