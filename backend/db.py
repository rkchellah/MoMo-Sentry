"""
db.py — single Supabase service-role client.
"""

from __future__ import annotations

import os
from typing import Any

_supabase: Any = None
_init_attempted = False


def supabase_client():
    global _supabase, _init_attempted
    if _init_attempted:
        return _supabase
    _init_attempted = True
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        print("Supabase env missing")
        return None
    try:
        from supabase import create_client
        _supabase = create_client(url, key)
    except Exception as e:
        print(f"Supabase init failed: {e}")
        _supabase = None
    return _supabase


def supabase_enabled() -> bool:
    return supabase_client() is not None
