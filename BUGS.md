# Bug Log

A running record of every bug hit during development and exactly how it was fixed.
This exists so anyone setting up the project doesn't waste time on the same problems.

---

## BUG-001 — pydantic-core build failure on Python 3.14

**Date:** 2026-04-30  
**File:** `backend/requirements.txt`  
**Symptom:**
```
error: linker `link.exe` not found
Failed building wheel for pydantic-core
```
**Cause:**  
`pydantic==2.9.2` has no pre-built wheel for Python 3.14. pip fell back to compiling from source using Rust/maturin, which requires Visual C++ build tools (`link.exe`) — not installed on this machine.

**Fix:**  
Changed `pydantic==2.9.2` to `pydantic>=2.10.0`. Newer versions ship pre-built wheels for Python 3.14 so no Rust compilation is needed.

**Lesson:**  
Pinning exact versions is good for production stability but breaks on newer Python versions that don't have matching wheels yet. For a hackathon project running on Python 3.14, use `>=` with a floor version.

---

## BUG-002 — pyiceberg build failure on Python 3.14

**Date:** 2026-04-30  
**File:** `backend/requirements.txt`  
**Symptom:**
```
error: Microsoft Visual C++ 14.0 or greater is required
Failed building wheel for pyiceberg
```
**Cause:**  
`supabase>=2.7.4` resolved to `2.29.0` which introduced `pyiceberg` as a new dependency of `storage3`. pyiceberg requires C++ compilation on Python 3.14 — Visual C++ 14.0 not installed.

**Fix:**  
Pinned `supabase==2.7.4` — the version tested and confirmed to not pull in pyiceberg. Kept `pydantic>=2.10.0` flexible to avoid BUG-001 recurring.

**Final requirements.txt that works on Python 3.14:**
```
fastapi>=0.115.0
uvicorn>=0.30.6
httpx>=0.27.2
python-dotenv>=1.0.1
groq>=0.11.0
supabase==2.7.4
pydantic>=2.10.0
```

**Lesson:**  
Using `>=` on a fast-moving library like supabase lets pip resolve to a version with a completely different dependency tree. For libraries that release frequently, pin the exact version you've tested.

---

## BUG-003 — NameError: test_connectivity not defined

**Date:** 2026-04-30  
**File:** `backend/test_api.py`  
**Symptom:**
```
NameError: name 'test_connectivity' is not defined
```
**Cause:**  
Used a shell append command to add `test_connectivity` to the file. It landed after the `main()` function. Python reads top to bottom — `main()` referenced the function before Python had seen its definition.

**Fix:**  
Rewrote the entire file cleanly with all test functions defined before `main()`.

**Lesson:**  
Never append functions to a file that already has a `main()` at the bottom. Always rewrite the full file when structure changes.

---

## BUG-004 — Nokia NaC simulator returns 404/422 for some phone numbers on SIM Swap

**Date:** 2026-04-30  
**File:** `backend/test_api.py`  
**Symptom:**  
Numbers `+99999990400`, `+99999990404`, `+99999990422` all return 404 or 422 on the SIM Swap check endpoint. Only `+99999991000` and `+99999991001` return 200.

**Cause:**  
Nokia NaC simulator does not support all documented numbers for all APIs. The numbers listed as "device status" numbers in the portal don't work for SIM Swap specifically. No documentation explains which numbers work for which APIs.

**Fix:**  
Dropped the separate "flagged number" test entirely. The simulator returns `swapped: True` for all working numbers regardless — it confirms the endpoint is reachable and the response is correctly shaped. That is sufficient for prototype validation. In production with real network data, legitimate numbers would return `swapped: false`.

**Lesson:**  
Simulator behaviour does not always match documentation. Test against what actually responds, not what the docs imply should work. Don't waste time trying to find a number that returns a specific simulated value — the simulator is for endpoint validation, not scenario testing.

---

## BUG-005 — Groq model decommissioned: llama3-groq-70b-8192-tool-use-preview

**Date:** 2026-05-02  
**File:** `backend/agent.py`  
**Symptom:**
```
Error code: 400 - model_decommissioned
The model llama3-groq-70b-8192-tool-use-preview has been decommissioned
```
**Cause:**  
Groq deprecated the preview tool-use models on January 6, 2025. The `llama3-groq-70b-8192-tool-use-preview` model no longer exists.

**Fix:**  
Changed model to `llama-3.3-70b-versatile` which is the recommended replacement and supports tool calling natively.

**Lesson:**  
Preview models get deprecated fast. Always use production model IDs, not preview ones.

---

## Open — not fixed yet

These were confirmed in August 2026. Do not “fix” them by lying about Nokia’s response. Show CHECK FAILED or STOP as `risk.py` already does.

### BUG-006 — STOP sandbox number returns 400 (open)

**Date:** 2026-08-26  
**Files:** `backend/camara.py`, till chips in `frontend/src/lib/sentryApi.ts`  
**Symptom:** Chip **Stop** (`+99999990400`) shows **FAILED** / CHECK FAILED. Narration says the checks did not complete. `POST /check` is HTTP 200.  
**Cause:** Nokia NaC SIM Swap for `+99999990400` returns `400 {"detail":"Bad Request"}`. `risk.py` treats a SIM-swap error as CHECK FAILED so the booth never treats it as SAFE. Same class as BUG-004 (`+99999990404`, `+99999990422` often fail the same way).  
**Not done:** No workaround that invents a STOP. No remap to another number. Wait for Nokia sandbox, or pick a number that actually 200s.  
**Check:** From `backend/`, POST SIM Swap for `+99999991000` (200) vs `+99999990400` (400).

### BUG-007 — SAFE sandbox number comes back swapped (open)

**Date:** 2026-08-26  
**Files:** `backend/risk.py`, `backend/test_api.py`  
**Symptom:** Chip **Safe** (`+99999991000`) can show **STOP** (“SIM and device were swapped”).  
**Cause:** Current Nokia sandbox returns `{"swapped": true}` for valid numbers, including the “SAFE” ones. `risk.py` is correct: swapped → STOP.  
**Not done:** Do not special-case `+99999991000` as SAFE. The chip is the intended story; the badge is the network.

### BUG-008 — Live API health is degraded (open)

**Date:** 2026-08-26  
**Host:** https://momo-sentry.onrender.com/health  
**Symptom:** `"status": "degraded"`, `"supabase": false`, `missing_env`: `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_KEY`. HTTP 200.  
**Cause:** Those keys are not set on the Render API service (or still placeholders). Local `http://localhost:8000/health` was `"ok"` with `"supabase": true`.  
**Not done:** Add the keys in Render → momo-sentry → Environment, then redeploy. Frontend live URL is https://momo-sentry-1.onrender.com and must keep `NEXT_PUBLIC_MOMO_SENTRY_API=https://momo-sentry.onrender.com`. Local `.env.local` points at `http://localhost:8000`, so this does not break `npm run dev`.

### BUG-009 — “Opening the till…” can hang (open)

**Date:** 2026-08-26  
**File:** `frontend/src/pages/agent.tsx`  
**Symptom:** `/agent` stays on the loader past 3 seconds. Register (`/agent-register`) loads because it does not wait on session.  
**Cause:** `setTimeout(..., 3000)` is cleared when `getSession()` resolves with a session, then `loadAgent()` (Supabase `booth_agents` query) never returns. No timeout around `loadAgent`.  
**Not done:** Race `loadAgent` with a timeout; still show login if the row is missing. Do not remove the loader without that.

### BUG-010 — Viewport meta warning (open)

**Date:** 2026-08-26  
**File:** `frontend/src/pages/_document.tsx`  
**Symptom:** Next.js: viewport meta tags should not be used in `_document.js`'s `<Head>`.  
**Cause:** `viewport` and apple-mobile-web-app tags live in `_document.tsx`. Next 15 wants viewport in `next/head` metadata on pages or `app`.  
**Not done:** Move viewport to the Next 15 metadata API. PWA tags can stay; they are not the warning.

### BUG-011 — Password reset needs Redirect URLs (ops, open)

**Date:** 2026-08-26  
**Files:** `frontend/src/pages/reset.tsx`, login “Forgot password?”  
**Symptom:** Reset email link 404s or returns to the wrong app if Supabase Auth Redirect URLs omit `/reset`.  
**Not done in code.** In Supabase → Authentication → URL Configuration add:

- `http://localhost:3000/reset`
- `https://momo-sentry-1.onrender.com/reset`

Site URL should be the live web origin.

---

## Fixed this round (2026-08-26)

Logged so they are not re-opened as “the till is broken.”

| ID | What | Fix |
|---|---|---|
| BUG-012 | `/` sent everyone to `/agent` | Removed the Next redirect. Chooser is `frontend/src/pages/index.tsx`. |
| BUG-013 | Login was email then a second Continue for password | One form: email + password, **Log in**. |
| BUG-014 | Agent login restyled as a light blue kit, then asked to revert | AuthShell again. Till after login uses `globals.css` tokens only. |
| BUG-015 | Result and KPI cards had a thick black left edge | Removed `border-left` / `border-left-width` on `.result.is-*` and `.metric.is-*`. |
| BUG-016 | Soft, blurry type and custom SVGs | IBM Plex, real font weights, no bar `backdrop-filter`. Lucide via `lucide-react`. |
| BUG-017 | `Failed to fetch` on owner create when API was down | Local uvicorn on `:8000`. `sentryApi.ts` names the API URL in the error. CORS localhost regex in `backend/main.py`. |
| BUG-018 | Render probe 404 on `GET /` | API root returns a small JSON index (`backend/main.py`). Health stays `/health`. |

---