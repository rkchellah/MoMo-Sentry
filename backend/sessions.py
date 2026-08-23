"""
sessions.py — persist DeepSeek session memory per authenticated user.
Falls back to process memory if Supabase is unavailable.
"""

from __future__ import annotations

from typing import Any, Optional

from db import supabase_client

_memory: dict[str, list[dict[str, str]]] = {}


def load_history(user_id: Optional[str]) -> list[dict[str, Any]]:
    if not user_id:
        return []
    client = supabase_client()
    if client is None:
        return list(_memory.get(user_id, []))
    try:
        row = (
            client.table("agent_sessions")
            .select("messages")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if row.data:
            messages = row.data[0].get("messages") or []
            return list(messages) if isinstance(messages, list) else []
    except Exception as e:
        print(f"Session load failed: {e}")
    return list(_memory.get(user_id, []))


def save_history(user_id: Optional[str], history: list[dict[str, Any]]) -> None:
    if not user_id:
        return
    trimmed = history[-40:]
    _memory[user_id] = trimmed
    client = supabase_client()
    if client is None:
        return
    try:
        client.table("agent_sessions").upsert(
            {
                "user_id": user_id,
                "messages": trimmed,
            },
            on_conflict="user_id",
        ).execute()
    except Exception as e:
        print(f"Session save failed: {e}")
