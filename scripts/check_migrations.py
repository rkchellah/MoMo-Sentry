#!/usr/bin/env python3
"""
check_migrations.py - refuse SQL that touches PAR-Map's tables.

MoMo Sentry and PAR-Map share one Supabase project. ARCHITECTURE.md says
"never migrate PAR-Map tables". A markdown rule holds for exactly as long as
everyone remembers to read the markdown. This is the tripwire.

Scope, honestly: this guards the REPO. It cannot see SQL pasted straight into
the Supabase SQL editor, and anyone can dodge it with dynamic SQL. The real
lock is a restricted database role. This catches the accident, not the attack.

Run:  python scripts/check_migrations.py
Exit: 0 clean, 1 violation, 2 nothing scanned (wrong directory?)
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent

# Files that end up in the Supabase SQL editor.
SCAN_GLOBS = ("supabase/migrations/*.sql",)

# PAR-Map owns these. The loan map reads them; MoMo Sentry has no business
# naming them at all. `profiles` is matched bare - `momo_profiles` is ours and
# must not trip the check.
PAR_MAP_TABLES = (
    "customers",
    "profiles",
    "teams",
    "kmz_layers",
    "buffer_layers",
)

# Supabase-managed schemas. A foreign key *referencing* auth.users is correct
# and expected - momo_profiles does it. What is never ours is MUTATING those
# tables, so these rules are verb-based and matched per statement, not per line.
MUTATING_VERB = r"(?i)\b(alter\s+table|drop\s+table|truncate|insert\s+into|update|delete\s+from|grant|revoke|create\s+policy)\b"

STATEMENT_RULES = (
    (rf"{MUTATING_VERB}[^;]*?(?<!\w)auth\.(users|sessions|identities|refresh_tokens)(?!\w)",
     "mutating a Supabase-managed auth table"),
    (rf"{MUTATING_VERB}[^;]*?(?<!\w)storage\.(objects|buckets)(?!\w)",
     "mutating Supabase Storage internals"),
    (r"(?i)\bdrop\s+schema\b",
     "dropping a schema"),
)

# `(?<!\w)` blocks momo_profiles (underscore is a word char) while still
# catching public.profiles, since `.` is not a word char.
LINE_RULES = tuple(
    (rf"(?<!\w){t}(?!\w)", f"PAR-Map table `{t}`") for t in PAR_MAP_TABLES
) + (
    (r"kmz-files", "PAR-Map Storage bucket"),
)

BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
LINE_COMMENT = re.compile(r"--[^\n]*")


def strip_comments(sql: str) -> str:
    """Blank out comments, preserving line numbers and offsets.

    Explaining the rule requires naming the tables the rule forbids, so
    003_rls_lockdown.sql legitimately says "customers" in prose. Dollar-quoted
    bodies ($$ ... $$) are NOT stripped - that text executes.
    """
    sql = BLOCK_COMMENT.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), sql)
    sql = LINE_COMMENT.sub(lambda m: " " * len(m.group(0)), sql)
    return sql


def scan(path: Path) -> list[tuple[int, str, str]]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    code = strip_comments(raw)
    lines = code.splitlines()
    raw_lines = raw.splitlines()
    hits: list[tuple[int, str, str]] = []

    def source(n: int) -> str:
        return raw_lines[n - 1].strip() if 0 < n <= len(raw_lines) else ""

    for pattern, label in LINE_RULES:
        rx = re.compile(pattern)
        for n, line in enumerate(lines, 1):
            if rx.search(line):
                hits.append((n, label, source(n)))

    # Statement rules span newlines, so match against the whole file and map
    # the offset back to a line number.
    for pattern, label in STATEMENT_RULES:
        for m in re.finditer(pattern, code, re.DOTALL):
            n = code.count(chr(10), 0, m.start()) + 1
            hits.append((n, label, source(n)))

    return sorted(set(hits))


def main() -> int:
    files: list[Path] = []
    for glob in SCAN_GLOBS:
        files.extend(sorted(REPO.glob(glob)))
    files = sorted(set(files))

    if not files:
        print(f"check-migrations: no SQL found under {REPO}", file=sys.stderr)
        return 2

    violations = 0
    for path in files:
        rel = path.relative_to(REPO).as_posix()
        hits = scan(path)
        if not hits:
            print(f"  ok    {rel}")
            continue
        for line_no, label, text in hits:
            violations += 1
            print(f"  FAIL  {rel}:{line_no}  {label}")
            print(f"          {text}")

    print()
    if violations:
        print(f"check-migrations: {violations} violation(s).")
        print("MoMo Sentry SQL must be additive. It may create and alter its own")
        print("tables (fraud_checks, booth_agents, booth_locations, momo_profiles,")
        print("agent_sessions) and nothing else. Retiring a PAR-Map table is a")
        print("PAR-Map change, in the PAR-Map repo.")
        return 1

    print(f"check-migrations: {len(files)} file(s) clean.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
