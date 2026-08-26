# MoMo Sentry

Mobile money fraud in Zambia follows a pattern. Someone convinces a telecom agent to replace a customer's SIM card. They wait a few days. Then they walk to a mobile money booth, give the agent a number, and ask to withdraw. The booth agent has no way to know the SIM was just swapped. They hand over the cash. By the time the real customer notices, it's gone.

---

## Live

The app is two Render services. Free instances sleep after ~15 minutes idle — the first request can take a minute.

| What | URL |
|---|---|
| App (chooser) | https://momo-sentry-1.onrender.com |
| Booth till | https://momo-sentry-1.onrender.com/agent |
| Booth register | https://momo-sentry-1.onrender.com/agent-register |
| Operations | https://momo-sentry-1.onrender.com/sentry |
| Password reset | https://momo-sentry-1.onrender.com/reset |
| API | https://momo-sentry.onrender.com |
| API health | https://momo-sentry.onrender.com/health |

Local: frontend `http://localhost:3000`, API `http://localhost:8000`.

Confirm the API with `GET /health`. `"status": "ok"` and `"supabase": true` means it can log checks and create the first owner. `"degraded"` with `missing_env` means keys are not set on that host — see `BUGS.md` BUG-008 for the live API.

---

## What it does

A booth agent opens the till, types a customer's number, and hits check. The FastAPI backend calls Nokia Network as Code CAMARA APIs in parallel:

- **SIM Swap** — was this SIM swapped in the last 72 hours?
- **Device Swap** — did the SIM move to a new handset?
- **Device Status** — is the device connected right now?

`risk.py` sets the badge from those results. DeepSeek only explains it in one or two sentences. It does not pick tools or change the verdict.

- **SAFE** — No SIM swap in the last 72 hours on this number. Not proof the person is legitimate.
- **CAUTION** — Something is off. Ask a question before releasing.
- **STOP** — SIM or device was swapped recently. Do not release cash.
- **CHECK FAILED** — Nokia did not answer, or this environment cannot query that number. Do not treat as safe.

Every check is logged. Operations (`/sentry`) shows the queue and a Lusaka map — one pin per booth, coloured by the latest verdict.

---

## Two screens, two users

**`/agent` — booth till**  
Phone-width webapp for agents on a smartphone. Same dark AuthShell login as operations. After sign-in: number field, sandbox chips, booth picker, floating Check bar.

**`/sentry` — operations**  
Booth owner or analyst. Queue of every check, KPIs, repeat numbers, agents who never checked, Where map.

**`/` — chooser**  
Pick booth check or operations. The app does not auto-redirect to `/agent`.

Roles live in `momo_profiles`. Agents cannot open operations. Owners cannot open the till. The first owner is claimed with `POST /setup/claim-owner` when `GET /setup/owner-needed` is true.

---

## How a check is decided

Nokia is called in parallel. `risk.py` scores. DeepSeek narrates the already-decided badge. Session memory in `agent_sessions` can mention earlier flagged checks in this sitting.

SIM swap HTTP failure is always **CHECK FAILED**, never SAFE. The Nokia sandbox is not a clean scenario table — STOP chips can 400, and SAFE chips can come back `swapped: true`. That is Nokia, not a down API. Logged in `BUGS.md`.

---

## Tech stack

| Layer | Technology |
|---|---|
| CAMARA APIs | Nokia Network as Code — SIM Swap, Device Swap, Device Status |
| Backend | Python FastAPI (`backend/`) |
| Narration | DeepSeek (`deepseek-chat`) |
| Database | Supabase (PostgreSQL) — shared with PAR-Map; do not touch PAR-Map tables |
| Frontend | Next.js in this repo (`frontend/`) |
| Icons | Lucide |
| Map | Mapbox + Leaflet |
| Auth | Supabase Auth, cookie `sb-momo-auth-token` |
| Deploy | Render — API `momo-sentry.onrender.com`, web `momo-sentry-1.onrender.com` |

---

## Architecture

```
Agent types a number
       ↓
POST /check  {phone_number, agent_location} + Bearer JWT
       ↓
camara.run_checks — SIM Swap + Device Swap + Device Status in parallel
       ↓
risk.py sets SAFE / CAUTION / STOP / CHECK_FAILED
       ↓
DeepSeek narrates (does not change the badge)
       ↓
Logged to Supabase fraud_checks
       ↓
Till shows Last check; operations queue and map update
```

Full plan: `ARCHITECTURE.md`. Open issues: `BUGS.md`.

---

## Running locally

Two terminals. Nokia key is `NAC_API_KEY` in `backend/.env` — never `NEXT_PUBLIC_*`.

```bash
# API
cd backend
python -m venv env
env\Scripts\activate          # macOS/Linux: source env/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill NAC_API_KEY, DEEPSEEK_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
# NAC_MODE=sandbox  REQUIRE_AUTH=true  FRONTEND_ORIGIN=http://localhost:3000
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

```bash
# Web
cd frontend
npm install
# .env.local: NEXT_PUBLIC_MOMO_SENTRY_API=http://localhost:8000
# plus NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_MAPBOX_TOKEN
npm run dev
```

Open `http://localhost:3000`. CORS allows localhost via regex even if `FRONTEND_ORIGIN` is only the production origin.

Password reset: add `http://localhost:3000/reset` and `https://momo-sentry-1.onrender.com/reset` under Supabase Auth → Redirect URLs.

---

## Deploy on Render

Two Web Services (`render.yaml`).

### API — https://momo-sentry.onrender.com

Root `backend/`. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`. Health: `/health`.

```
NAC_API_KEY
NAC_MODE=sandbox
DEEPSEEK_API_KEY
DEEPSEEK_MODEL=deepseek-chat
SUPABASE_URL
SUPABASE_SERVICE_KEY
FRONTEND_ORIGIN=https://momo-sentry-1.onrender.com,http://localhost:3000
REQUIRE_AUTH=true
PYTHON_VERSION=3.12.8
```

### Frontend — https://momo-sentry-1.onrender.com

Root `frontend/`. Build `npm install && npm run build`. Start `npm start`.

```
NODE_VERSION=20
NEXT_PUBLIC_MOMO_SENTRY_API=https://momo-sentry.onrender.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
```

`NEXT_PUBLIC_*` is baked in at build time. After changing them, rebuild the frontend.

---

## Nokia NaC simulator numbers

No real Zambian SIM. Only `+999…`. A `+260` / `097…` number returns CHECK FAILED.

| Number | Intended result | What Nokia often does now |
|---|---|---|
| +99999991000 | SAFE | 200, but `swapped: true` → STOP |
| +99999991001 | SAFE | same class as above |
| +99999990400 | STOP | 400 Bad Request → CHECK FAILED |
| +99999990404 | STOP | often 400 / unsupported |
| +99999990422 | CAUTION | often 400 / unsupported |

The chips on the till are the intended story. Trust the badge on screen, not the chip label, until Nokia's sandbox matches the table. Details: `BUGS.md` BUG-006 and BUG-007.

---

## Database

Same Supabase project as PAR-Map. Isolation is by table and auth cookie, not a second database — see `ARCHITECTURE.md`.

```bash
supabase/migrations/001_fraud_checks.sql
supabase/migrations/002_production_auth.sql
supabase/migrations/003_rls_lockdown.sql
```

Never alter PAR-Map tables (`customers`, `profiles`, `teams`, `kmz_layers`, `buffer_layers`, Storage `kmz-files`). Before pasting SQL:

```bash
python scripts/check_migrations.py
```

---

## What isn't in the prototype

**Number Verification** is documented in `camara.py`. It needs the customer to tap an OAuth link on their phone.

**SMS alerts** were dropped. The narration in the UI is the alert.

**USSD** is the long-term till for agents without smartphones. That needs an MNO on Nokia NaC.

---

## Known constraints

A legitimate SIM replacement looks identical to a fraudulent one at the API level. The tool flags. The agent always makes the final call.
