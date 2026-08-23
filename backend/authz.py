"""
authz.py — verify Supabase JWTs and load MoMo roles.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from db import supabase_client


@dataclass
class AuthedUser:
    user_id: str
    role: str  # agent | owner
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    primary_location: Optional[str] = None


def _bearer(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1]
    return None


def authenticated_user_id(authorization: Optional[str]) -> str:
    """Verify the JWT and return the Auth user id. Does not require a MoMo profile."""
    token = _bearer(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    client = supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Auth service unavailable")

    try:
        result = client.auth.get_user(token)
        user = result.user
    except Exception:
        user = None
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user.id


def resolve_user(authorization: Optional[str], required: bool) -> Optional[AuthedUser]:
    token = _bearer(authorization)
    if not token:
        if required:
            raise HTTPException(status_code=401, detail="Not authenticated")
        return None

    try:
        user_id = authenticated_user_id(authorization)
    except HTTPException:
        if required:
            raise
        return None

    client = supabase_client()
    if client is None:
        if required:
            raise HTTPException(status_code=503, detail="Auth service unavailable")
        return None

    role = None
    try:
        profile = (
            client.table("momo_profiles")
            .select("role")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if profile.data:
            role = profile.data[0]["role"]
    except Exception as e:
        print(f"Profile lookup failed: {e}")

    agent_id = None
    agent_name = None
    primary_location = None
    try:
        agent = (
            client.table("booth_agents")
            .select("id, name, primary_location")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if agent.data:
            row = agent.data[0]
            agent_id = str(row["id"])
            agent_name = row.get("name")
            primary_location = row.get("primary_location")
            if not role:
                role = "agent"
    except Exception as e:
        print(f"Agent lookup failed: {e}")

    if not role:
        if required:
            raise HTTPException(status_code=403, detail="No MoMo Sentry profile for this account")
        return None

    return AuthedUser(
        user_id=user_id,
        role=role,
        agent_id=agent_id,
        agent_name=agent_name,
        primary_location=primary_location,
    )
