# MoMo Sentry

Mobile money fraud in Zambia follows a pattern. Someone convinces a telecom agent to replace a customer's SIM card. They wait a few days. Then they walk to a mobile money booth, give the agent a number, and ask to withdraw. The booth agent has no way to know the SIM was just swapped. They hand over the cash. By the time the real customer notices, it's gone.

---

## What it does

A booth agent opens the check screen, types in a customer's number, and hits check. MoMo Sentry calls Nokia's 
Network as Code CAMARA APIs in parallel:

- **SIM Swap API** — was this SIM swapped in the last 72 hours?
- **Device Swap API** — did the SIM move to a new handset?
- **Device Status API** — is the device actually connected right now?

The AI agent reasons over the results and responds in one or two plain sentences — not a score, not a badge alone, but something the agent can read and act on immediately.

🟢 **SAFE** — No signals. Proceed normally.  
🟡 **CAUTION** — Something is off. Ask a question before releasing.  
🔴 **STOP** — SIM was swapped recently. Do not release cash.

Every check is logged. The booth owner sees all flags plotted on a Lusaka satellite map — one dot per agent, coloured by their most recent check verdict. Click an agent's dot to see their full check history. Click View Logs for the full table. That log is designed for booth owners, telcos, ZICTA, and law enforcement to identify repeat fraud numbers and act.

---

## Two screens, two users

**`par-map.vercel.app/agent`** — the agent screen  
The booth agent uses this before releasing cash. Sign in once, your location is pre-set. Type a number, get a verdict in under 3 seconds.

**`par-map.vercel.app/sentry`** — the owner and analyst screen  
The booth owner, telco analyst, or investigator uses this. Every registered agent appears as a dot at their permanent booth location. Click to see their check history. The pattern of who is getting hit, when, and with which numbers is visible at a glance.

---

## The moment it clicked

I ran the first live check against a Nokia simulator number. The API came back — `swapped: true`. Groq narrated it in one sentence:

*"The SIM card for this number was swapped recently and the device has also changed, which is a strong indicator that someone is trying to commit fraud — do not release cash."*

That's when this stopped feeling like a demo.

---

## How the agentic AI works

The Groq agent doesn't just receive pre-computed results and narrate them. It decides which Nokia NaC tools to call, calls them, reasons over what comes back, and decides if it needs more information before giving a verdict.

That's the difference between a lookup tool and an agent.

The verdict itself is driven entirely by what Nokia's APIs returned — SIM swapped means STOP, no exceptions. Groq explains the decision in plain English. It does not make the safety call. The Nokia APIs do.

The agent also holds session memory. If you check three numbers in a row and two come back flagged, it notices. It will say "this is the second suspicious number checked here today." That context is what a single API call can't give you.

---

## Tech stack

| Layer | Technology |
|---|---|
| CAMARA APIs | Nokia Network as Code — SIM Swap, Device Swap, Device Status |
| Backend | Python FastAPI |
| AI Agent | Groq (llama-3.3-70b) with persistent session memory |
| Database | Supabase (PostgreSQL) — shared with PAR-Map |
| Map | Mapbox + Leaflet via PAR-Map |
| Deployment | Railway (backend) + Vercel (frontend via PAR-Map) |

---

## Architecture

```
Agent types a number
       ↓
POST /check  {phone_number, agent_location, agent_id}
       ↓
Groq agent decides which Nokia NaC tools to call
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
# Fill in Nokia NaC API key, Groq key, Supabase credentials

uvicorn main:app --reload
```

Backend runs on `http://localhost:8000`. The frontend lives in the PAR-Map repo at `par-map.vercel.app/agent` and `par-map.vercel.app/sentry`.

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

This project shares the same Supabase project as PAR-Map. Run `supabase_migration.sql` in your SQL editor to create the `fraud_checks` and `booth_agents` tables. Existing PAR-Map tables are not touched.

---

## What isn't in the prototype

**Number Verification** is documented in `camara.py`. It requires the customer to click an OAuth link on their own phone — a real flow for high-value transactions, but friction that doesn't belong in a prototype demo.

**SMS alerts** were dropped. The Groq narration in the UI is the alert. Africa's Talking integration is one function call in production.

**USSD interface** is the right long-term tool for booth agents who don't have smartphones. It requires MNO partnership — MTN Zambia or Airtel Zambia would need to be onboarded to the Nokia NaC platform. That's a business conversation, not a technical one.

---

## Known constraints

The simulator works for the prototype. Production deployment in Zambia requires MNO partnership. That's the real next step — not more features.

False positives are real. A legitimate SIM replacement looks identical to a fraudulent one at the API level. The tool flags and warns. The agent always makes the final call. That's by design.