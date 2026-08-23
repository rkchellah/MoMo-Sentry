"""First-owner bootstrap. After one owner exists, this path is closed."""

from __future__ import annotations

from fastapi import HTTPException

from db import supabase_client


def owner_needed() -> bool:
    client = supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    try:
        result = (
            client.table("momo_profiles")
            .select("user_id")
            .eq("role", "owner")
            .limit(1)
            .execute()
        )
    except Exception as exc:
        print(f"Owner count failed: {exc}")
        raise HTTPException(status_code=503, detail="Could not read owner profiles") from exc
    return not result.data


def claim_first_owner(user_id: str) -> None:
    client = supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Auth service unavailable")
    if not owner_needed():
        raise HTTPException(status_code=409, detail="An owner already exists")
    try:
        client.table("momo_profiles").upsert(
            {"user_id": user_id, "role": "owner"}
        ).execute()
    except Exception as exc:
        print(f"Owner claim failed: {exc}")
        raise HTTPException(status_code=503, detail="Could not create owner profile") from exc
