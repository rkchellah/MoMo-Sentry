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