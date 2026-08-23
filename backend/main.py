"""
main.py — MoMo Sentry FastAPI backend

POST /check  — Nokia sandbox check + DeepSeek narration
GET  /health — liveness
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

load_dotenv()

import agent
from authz import AuthedUser, authenticated_user_id, resolve_user
from db import supabase_client, supabase_enabled
from owners import claim_first_owner, owner_needed
from phones import nac_mode, resolve_phone
from rate_limit import check_rate


def _cors_origins() -> list[str]:
    raw = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3000")
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    return origins or ["http://localhost:3000"]


def _auth_required() -> bool:
    return os.environ.get("REQUIRE_AUTH", "true").lower() in ("1", "true", "yes")


def _env_present(key: str) -> bool:
    value = (os.environ.get(key) or "").strip()
    if not value:
        return False
    return not value.startswith("your_")


def _missing_env() -> list[str]:
    required = [
        "NAC_API_KEY",
        "DEEPSEEK_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_KEY",
    ]
    return [key for key in required if not _env_present(key)]


app = FastAPI(
    title="MoMo Sentry",
    description="SIM swap fraud checks for mobile money booth agents",
    version="3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


class CheckRequest(BaseModel):
    phone_number: str
    agent_location: str = "Unknown"
    location: Optional[str] = None

    @model_validator(mode="after")
    def use_location_fallback(self):
        if self.agent_location == "Unknown" and self.location:
            self.agent_location = self.location
        return self


class CheckResponse(BaseModel):
    check_id: str
    phone_number: str
    verdict: str
    narration: str
    signals: list[str]
    tool_calls_made: list[str]
    checked_at: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    score: float = 0.0
    nac_mode: str = "sandbox"


def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> Optional[AuthedUser]:
    return resolve_user(authorization, required=_auth_required())


@app.get("/")
async def root():
    return {
        "service": "MoMo Sentry API",
        "health": "/health",
        "docs": "/docs",
        "check": "POST /check",
    }


@app.get("/health")
async def health():
    missing = _missing_env()
    return {
        "status": "ok" if not missing else "degraded",
        "supabase": supabase_enabled(),
        "version": "3.0.0",
        "mode": nac_mode(),
        "auth_required": _auth_required(),
        "missing_env": missing,
    }


@app.get("/setup/owner-needed")
async def setup_owner_needed():
    return {"owner_needed": owner_needed()}


@app.post("/setup/claim-owner")
async def setup_claim_owner(
    authorization: Optional[str] = Header(default=None),
):
    user_id = authenticated_user_id(authorization)
    claim_first_owner(user_id)
    return {"ok": True, "role": "owner"}


@app.post("/check", response_model=CheckResponse)
async def check_number(
    body: CheckRequest,
    user: Optional[AuthedUser] = Depends(get_current_user),
):
    if _auth_required() and user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user_key = user.user_id if user else "anonymous"
    check_rate(user_key)

    normalized, reject = resolve_phone(body.phone_number)
    check_id = str(uuid.uuid4())
    checked_at = datetime.now(timezone.utc).isoformat()
    location = body.agent_location
    if user and user.role == "agent" and user.primary_location and location == "Unknown":
        location = user.primary_location

    agent_id = user.agent_id if user and user.role == "agent" else None
    agent_name = user.agent_name if user else None
    if user and user.role == "owner":
        agent_name = agent_name or "Lintel Zambia owner"

    if reject or not normalized:
        result = {
            "verdict": "CHECK_FAILED",
            "narration": reject or "This number cannot be checked in sandbox.",
            "signals": [reject or "Rejected number"],
            "score": 0.0,
            "sim_swapped": False,
            "last_sim_change": None,
            "device_swapped": False,
            "last_device_change": None,
            "device_connectivity": "UNKNOWN",
            "device_roaming": False,
            "tool_calls_made": [],
        }
        phone_out = body.phone_number
    else:
        result = await agent.run_check(
            phone_number=normalized,
            agent_location=location,
            user_id=user.user_id if user else None,
        )
        phone_out = normalized

    _log_check(
        check_id=check_id,
        phone_number=phone_out,
        location=location,
        agent_id=agent_id,
        agent_name=agent_name,
        checked_at=checked_at,
        result=result,
    )

    return CheckResponse(
        check_id=check_id,
        phone_number=phone_out,
        verdict=result["verdict"],
        narration=result["narration"],
        signals=result["signals"],
        tool_calls_made=result["tool_calls_made"],
        checked_at=checked_at,
        agent_id=agent_id,
        agent_name=agent_name,
        score=float(result.get("score") or 0.0),
        nac_mode=nac_mode(),
    )


def _log_check(
    check_id: str,
    phone_number: str,
    location: str,
    agent_id: Optional[str],
    agent_name: Optional[str],
    checked_at: str,
    result: dict,
) -> None:
    client = supabase_client()
    if not client:
        return
    verdict = result["verdict"]
    score = result.get("score")
    if score is None:
        score = 1.0 if verdict == "STOP" else 0.5 if verdict == "CAUTION" else 0.0
    try:
        client.table("fraud_checks").insert({
            "id": check_id,
            "phone_number": phone_number,
            "verdict": verdict,
            "score": score,
            "signals": result.get("signals") or [],
            "narration": result.get("narration"),
            "sim_swapped": result.get("sim_swapped", False),
            "last_sim_change": None,
            "device_swapped": result.get("device_swapped", False),
            "last_device_change": None,
            "device_connectivity": result.get("device_connectivity", "UNKNOWN"),
            "device_roaming": result.get("device_roaming", False),
            "agent_location": location,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "checked_at": checked_at,
        }).execute()
    except Exception as e:
        print(f"Supabase log failed: {e}")
