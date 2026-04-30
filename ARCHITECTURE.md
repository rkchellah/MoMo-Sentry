# Architecture

This document explains how MoMo Sentry is built, why each part exists, and how everything connects.

---

## The problem in one paragraph

A mobile money booth agent in Lusaka handles dozens of cash transactions a day. They know their regular customers by face and number. A fraudster does their homework — they identify a regular customer, swap the SIM on that number, then walk to the booth and request a withdrawal. The agent has no way to know the SIM changed three days ago. They hand over the cash. The real customer finds out later. This happens constantly and the agent is often held responsible.

MoMo Sentry gives the agent a 3-second check before releasing cash. Type the number. Get a verdict. Done.

---

## Two users, two screens

**The agent** uses `index.html` on their phone or laptop at the booth. One input, one result. Fast.

**The booth owner** uses `map.html` to see patterns across all their booths. Which areas are seeing repeated flags. Which times of day. What the Groq agent said about each check.

---

## System overview

```
┌─────────────────────────────────────────────────────┐
│                    AGENT SCREEN                      │
│              frontend/index.html                     │
│   Types number → POST /check → shows verdict        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────┐
│                  FASTAPI BACKEND                     │
│                   backend/main.py                    │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  camara.py  │  │   risk.py    │  │  agent.py  │  │
│  │             │  │              │  │            │  │
│  │ Nokia NaC   │  │ Scores the   │  │ Groq LLM   │  │
│  │ API calls   │─▶│ signals into │─▶│ narrates   │  │
│  │ (parallel)  │  │ Safe/Caution │  │ in plain   │  │
│  │             │  │ /Stop        │  │ English    │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│         │                                  │         │
└─────────┼──────────────────────────────────┼─────────┘
          │                                  │
          ▼                                  ▼
┌──────────────────┐               ┌─────────────────┐
│  Nokia Network   │               │    Supabase     │
│  as Code APIs    │               │  fraud_checks   │
│                  │               │     table       │
│  - SIM Swap      │               │                 │
│  - Device Swap   │               │  Logs every     │
│  - Connectivity  │               │  check with     │
│  - Roaming       │               │  verdict +      │
└──────────────────┘               │  location       │
                                   └────────┬────────┘
                                            │
                              ┌─────────────▼────────────┐
                              │      OWNER SCREEN        │
                              │   frontend/map.html      │
                              │                          │
                              │  Mapbox map of Lusaka    │
                              │  Red dot = STOP          │
                              │  Yellow dot = CAUTION    │
                              │  Click dot = narration   │
                              └──────────────────────────┘
```

---

## Backend files

### `main.py`
The FastAPI app. Three endpoints:

| Endpoint | Method | What it does |
|---|---|---|
| `/check` | POST | Runs the full fraud check pipeline |
| `/flags` | GET | Returns recent CAUTION + STOP checks for the map |
| `/health` | GET | Confirms the API is alive |

The `/check` endpoint accepts `phone_number` and `agent_location`, runs the pipeline, and returns the verdict. The `x-session-id` header keeps the Groq agent's memory alive across multiple checks by the same agent in the same session.

### `camara.py`
All Nokia NaC API calls live here. Nothing else touches the Nokia API.

Four confirmed endpoints used:

| API | Endpoint | What it returns |
|---|---|---|
| SIM Swap check | `/passthrough/camara/v1/sim-swap/sim-swap/v0/check` | `swapped: true/false` |
| SIM Swap timestamp | `/passthrough/camara/v1/sim-swap/sim-swap/v0/retrieve-date` | `latestSimChange` ISO timestamp |
| Device Swap check | `/passthrough/camara/v1/device-swap/device-swap/v1/check` | `swapped: true/false` |
| Device Swap timestamp | `/passthrough/camara/v1/device-swap/device-swap/v1/retrieve-date` | `latestDeviceChange` ISO timestamp |
| Device connectivity | `/device-status/v0/connectivity` | `CONNECTED_DATA / CONNECTED_SMS / NOT_CONNECTED` |
| Device roaming | `/device-status/v0/roaming` | `roaming: true/false` |

All four checks run in parallel via `asyncio.gather()`. Total latency target: under 3 seconds.

### `risk.py`
Pure scoring logic. Takes the CAMARA results, applies weights, returns a verdict.

| Signal | Weight | Reasoning |
|---|---|---|
| SIM swapped in 72h | +0.60 | Strongest fraud indicator |
| Device swapped in 72h | +0.25 | Reinforces SIM swap signal |
| Device not connected | +0.25 | Unusual for someone actively transacting |
| Device on SMS only | +0.10 | Degraded connectivity — minor flag |
| Device roaming | +0.15 | Unexpected for a local Lusaka transaction |
| API error on any check | +0.10 | Uncertainty is itself a signal |

Verdict thresholds:
- `0.60+` → **STOP**
- `0.25–0.59` → **CAUTION**
- `< 0.25` → **SAFE**

No ML model. The weights are transparent and explainable — a judge, a regulator, or an agent can understand why a number was flagged.

### `agent.py`
Groq LLM session with persistent memory per agent login.

The agent holds conversation history — up to 20 exchanges. This means when an agent checks their third number in a session, the Groq model knows what the first two checks found. It can say "this is the second suspicious number from this area today" because it actually remembers.

This is the difference between a lookup tool and something that thinks.

Model: `llama-3.3-70b-versatile` at temperature 0.3. Low temperature keeps the narration consistent and reliable — not creative, just clear.

---

## Database

One table in Supabase: `fraud_checks`.

```sql
id                  uuid primary key
phone_number        text
verdict             text  -- SAFE | CAUTION | STOP
score               float
signals             text[]
narration           text
sim_swapped         boolean
last_sim_change     timestamptz
device_connectivity text
device_roaming      boolean
agent_location      text  -- neighbourhood name
checked_at          timestamptz
```

RLS enabled. Authenticated users can read. Only the service role (backend) can write.

This is the same Supabase project as PAR-Map (SupaMoto Zambia loan portfolio tool). The `fraud_checks` table is new — it doesn't touch any existing PAR-Map tables.

---

## The map

The map reads from `fraud_checks` via the `/flags` endpoint, which returns only CAUTION and STOP verdicts.

Each check has an `agent_location` field — a Lusaka neighbourhood name selected from a dropdown. The map converts that name to coordinates using a hardcoded lookup table of Lusaka neighbourhoods. No GPS required.

Over time, the map shows:
- Where flagged checks are happening
- What time of day they cluster
- What the AI said about each one

That's the pattern detection layer. A single API call can't tell you "Kanyama is seeing unusual activity this afternoon." A map of accumulated checks can.

---

## What's not in this build

**Number Verification** — requires the customer to click an OAuth link on their own phone over mobile data. Valid production flow for high-value transactions. Documented in `camara.py` as the production extension path.

**SMS alerts** — the Groq narration in the UI is the alert. Africa's Talking integration is one function call in production.

**Authentication** — the demo runs without login. Production would gate the agent UI behind Supabase auth with role-based access (agent vs owner).

---

## Deployment

| Layer | Platform | Notes |
|---|---|---|
| Frontend | Vercel | Static files, free tier |
| Backend | Railway | FastAPI, free tier for prototype |
| Database | Supabase | Shared with PAR-Map project |

The backend needs four environment variables: `NAC_API_KEY`, `GROQ_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. See `.env.example`.