# MoMo Sentry

Mobile money fraud in Zambia follows a pattern. Someone convinces a telecom agent to replace a customer's SIM card. They wait a few days. Then they walk to a mobile money booth, give the agent a number, and ask to withdraw. The booth agent has no way to know the SIM was just swapped. They hand over the cash. By the time the real customer notices, it's gone.

---

## What it does

A booth agent opens the check screen, types in a customer's number, and hits check. MoMo Sentry calls Nokia's 
Network as Code CAMARA APIs in parallel:

- **SIM Swap API** — was this SIM swapped in the last 72 hours?
- **Device Swap API** — did the SIM move to a new handset?
- **Device Status API** — is the device actually connected right now?

The AI narrates a verdict that `risk.py` already decided from Nokia. DeepSeek does not pick tools or set the badge.

🟢 **SAFE** — No SIM swap in the last 72 hours on this number. Not proof the person is legitimate.  
🟡 **CAUTION** — Something is off. Ask a question before releasing.  
🔴 **STOP** — SIM or device was swapped recently. Do not release cash.  
⚫ **CHECK FAILED** — Nokia did not answer, or this environment cannot query that number. Do not treat as safe.

Every check is logged. The booth owner sees all flags plotted on a Lusaka satellite map — one dot per agent, coloured by their most recent check verdict. Click an agent's dot to see their full check history. Click View Logs for the full table. That log is designed for booth owners, telcos, ZICTA, and law enforcement to identify repeat fraud numbers and act.

---

## Two screens, two users

**`par-map.vercel.app/agent`** — the agent screen  
The booth agent uses this before releasing cash. Sign in once, your location is pre-set. Type a number, get a verdict in under 3 seconds.

**`par-map.vercel.app/sentry`** — the owner and analyst screen  
The booth owner, telco analyst, or investigator uses this. Every registered agent appears as a dot at their permanent booth location. Click to see their check history. The pattern of who is getting hit, when, and with which numbers is visible at a glance.

---

## The moment it clicked

I ran the first live check against a Nokia simulator number. The API came back — `swapped: true`. The agent narrated it in one sentence:

*"The SIM card for this number was swapped recently and the device has also changed, which is a strong indicator that someone is trying to commit fraud — do not release cash."*

That's when this stopped feeling like a demo.

---

## How the agentic AI works

The AI agent doesn't just receive pre-computed results and narrate them. It decides which Nokia NaC tools to call, calls them, reasons over what comes back, and decides if it needs more information before giving a verdict.

That's the difference between a lookup tool and an agent.

The verdict itself is driven entirely by what Nokia's APIs returned — SIM swapped means STOP, no exceptions. DeepSeek explains the decision in plain English. It does not make the safety call. The Nokia APIs do.

The agent also holds session memory. If you check three numbers in a row and two come back flagged, it notices. It will say "this is the second suspicious number checked here today." That context is what a single API call can't give you.

---

## Tech stack

| Layer | Technology |
|---|---|
| CAMARA APIs | Nokia Network as Code — SIM Swap, Device Swap, Device Status |
| Backend | Python FastAPI |
| AI Agent | DeepSeek (`deepseek-chat`) with persistent session memory |
| Database | Supabase (PostgreSQL) — shared with PAR-Map |
| Map | Mapbox + Leaflet via PAR-Map |
| Deployment | Render (backend) + Vercel (frontend via PAR-Map) |

---

## Architecture

```
Agent types a number
       ↓
POST /check  {phone_number, agent_location, agent_id}
       ↓
DeepSeek agent decides which Nokia NaC tools to call
       ↓
Calls SIM Swap + Device Swap + Device Status in parallel
       ↓
Reasons over all three results
       ↓
Returns: STOP/CAUTION/SAFE + plain English narration
       ↓
Logged to Supabase fraud_checks
       ↓
Map updates — agent's dot reflects latest verdict
```

---

## Running locally

```bash
cd backend
python -m venv env
source env/bin/activate       # Windows: env\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# Fill in Nokia NaC API key, DeepSeek key, Supabase credentials
# Also set NAC_MODE=sandbox, REQUIRE_AUTH=true, FRONTEND_ORIGIN=http://localhost:3000
# NAC_MODE=sandbox  REQUIRE_AUTH=true

uvicorn main:app --reload
```

Backend runs on `http://localhost:8000`. The frontend lives in the PAR-Map repo at `par-map.vercel.app/agent` and `par-map.vercel.app/sentry`.

---

## Deploy the backend on Render

The FastAPI API is a Render Web Service. The repo already includes a Blueprint at `render.yaml`.

1. Open [Render Blueprints](https://dashboard.render.com/blueprints) and connect `rkchellah/MoMo-Sentry`.
2. When prompted, paste the same keys from `backend/.env.example`:
   - `NAC_API_KEY`
   - `DEEPSEEK_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `FRONTEND_ORIGIN` (your Vercel origin, comma-separated if you also use localhost)
3. Set `NAC_MODE=sandbox` and `REQUIRE_AUTH=true`.
4. Deploy. The API URL will look like `https://momo-sentry.onrender.com`.
5. Point the frontend at it:

```
NEXT_PUBLIC_MOMO_SENTRY_API=https://momo-sentry.onrender.com
```

Run `supabase/migrations/002_production_auth.sql` in the Supabase SQL editor, then seed an owner:

```
insert into momo_profiles (user_id, role)
values ('<auth user uuid>', 'owner');
```

Confirm it is up with `GET /health`.

A paid Render instance stays awake. Free web services sleep after 15 minutes idle.

---

## Nokia NaC simulator numbers

Nokia provides simulator numbers that return predictable responses. No real Zambian SIM needed to test this project.

| Number | Expected result |
|---|---|
| +99999991000 | SAFE — no swap detected, device connected |
| +99999991001 | SAFE — clean |
| +99999990400 | STOP — SIM swap detected |
| +99999990404 | STOP — SIM swap detected |
| +99999990422 | CAUTION — device status anomaly |

> Note: The Nokia NaC sandbox returns swapped: true for all valid numbers in the current simulator version. In production, real network data would return false for legitimate SIMs.

---

## Database

This project shares the same Supabase project as PAR-Map. Isolation is by table and auth cookie, not a second database — see `ARCHITECTURE.md`.

Run the migrations in order:

```bash
supabase/migrations/001_fraud_checks.sql    # fraud_checks
supabase/migrations/002_production_auth.sql # roles, sessions, CHECK_FAILED
supabase/migrations/003_rls_lockdown.sql    # RLS on booth tables, drop broad read
```

Seed an owner in `momo_profiles` and confirm the owner queue loads **before** running `003` — it drops the policy that currently lets any authenticated session read `fraud_checks`. Rollback is at the bottom of that file.

Never alter PAR-Map tables (`customers`, `profiles`, `teams`, `kmz_layers`, `buffer_layers`, Storage `kmz-files`). Before pasting any SQL into the Supabase editor:

```bash
python scripts/check_migrations.py
```

It fails the build if a migration names a PAR-Map table or mutates a Supabase-managed one, and runs in CI on every change under `supabase/`. It guards the repo, not the SQL editor — run it yourself before pasting.

---

## What isn't in the prototype

**Number Verification** is documented in `camara.py`. It requires the customer to click an OAuth link on their own phone — a real flow for high-value transactions, but friction that doesn't belong in a prototype demo.

**SMS alerts** were dropped. The DeepSeek narration in the UI is the alert. Africa's Talking integration is one function call in production.

**USSD interface** is the right long-term tool for booth agents who don't have smartphones. It requires MNO partnership — MTN Zambia or Airtel Zambia would need to be onboarded to the Nokia NaC platform. That's a business conversation, not a technical one.

---

## Known constraints

False positives are real. A legitimate SIM replacement looks identical to a fraudulent one at the API level. The tool flags and warns. The agent always makes the final call. That's by design.