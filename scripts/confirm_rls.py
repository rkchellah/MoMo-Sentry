#!/usr/bin/env python3
"""
confirm_rls.py - prove the shared-database leak is open or closed.

Run it BEFORE 003_rls_lockdown.sql and AFTER. The numbers must change.

WHY THIS AND NOT THE SQL EDITOR
  The SQL editor runs as service_role, which BYPASSES RLS. Every query
  succeeds there whether the policies are right or wrong, so it can confirm
  that a policy EXISTS but never that it WORKS. This script uses the public
  anon key - the one that ships in the frontend bundle and that any visitor
  can read - so it measures what an outsider actually sees.

  Structure -> preflight_003.sql in the SQL editor.
  Behaviour -> this script.

READ ONLY. GET requests only, no writes. It asks PostgREST for row COUNTS and
never fetches the rows, so no phone numbers or agent details are printed.

Usage:  python scripts/confirm_rls.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

TABLES = (
    ("fraud_checks", "phone numbers, verdicts, booth locations"),
    ("booth_agents", "agent names, phone numbers, coordinates"),
    ("booth_locations", "booth sites"),
    ("momo_profiles", "who is an owner"),
    ("agent_sessions", "DeepSeek conversation memory"),
)


def read_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def count_rows(base_url: str, key: str, table: str) -> tuple[str, str]:
    """Return (result, detail). Counts only - never fetches row contents."""
    url = f"{base_url.rstrip('/')}/rest/v1/{table}?select=*&limit=0"
    req = urllib.request.Request(url, method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Prefer", "count=exact")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            rng = resp.headers.get("Content-Range", "")
            total = rng.split("/")[-1] if "/" in rng else "?"
            return ("VISIBLE" if total not in ("0", "?") else "blocked"), f"{total} rows"
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")[:200]
        try:
            msg = json.loads(body).get("message", body)
        except Exception:
            msg = body
        if e.code in (401, 403):
            return "blocked", f"HTTP {e.code} {msg}"
        if e.code == 404:
            return "absent", "table does not exist"
        return "error", f"HTTP {e.code} {msg}"
    except Exception as e:
        return "error", str(e)


def main() -> int:
    fe = read_env(REPO / "frontend" / ".env.local")
    url = fe.get("NEXT_PUBLIC_SUPABASE_URL")
    anon = fe.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")

    if not url or not anon:
        print("Need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
              "in frontend/.env.local", file=sys.stderr)
        return 2

    print("Probing as an ANONYMOUS holder of the public anon key.")
    print("This is what any visitor to the deployed frontend can do.\n")

    leaks = []
    for table, what in TABLES:
        result, detail = count_rows(url, anon, table)
        flag = "LEAK  " if result == "VISIBLE" else "  ok  "
        if result == "VISIBLE":
            leaks.append((table, what, detail))
        print(f"  {flag}{table:<18} {result:<8} {detail}")

    print()
    if leaks:
        print(f"{len(leaks)} table(s) readable by an anonymous anon-key holder:")
        for table, what, detail in leaks:
            print(f"  - {table}: {what} ({detail})")
        print()
        print("Before 003 this is expected for booth_agents / booth_locations:")
        print("RLS is off, and RLS off means Supabase's default grants apply.")
        print("After 003 this list must be empty.")
        return 1

    print("No table is readable anonymously.")
    print()
    print("This does NOT yet prove the owner/agent split works. Still to test")
    print("with a real login: a signed-in agent must see only their own rows,")
    print("and a signed-in non-owner must see zero fraud_checks.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
