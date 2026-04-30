"""
main.py — MoMo Sentry FastAPI backend

Three endpoints:
  POST /check   — run a fraud check on a phone number
  GET  /flags   — get recent flagged checks (feeds the map)
  GET  /health  — confirm the API is alive

The check endpoint calls Nokia NaC APIs in parallel,
scores the result, then asks Groq to narrate the verdict.
"""

import os
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import camara
import risk
import agent

# Supabase is optional — if not configured, checks still work,
# they just won't appear on the map
try:
    from supabase import create_client
    _supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )
    SUPABASE_ENABLED = True
except Exception:
    _supabase = None
    SUPABASE_ENABLED = False


app = FastAPI(
    title="MoMo Sentry",
    description="Real-time SIM swap fraud detection for mobile money booth agents",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / Response models ---

class CheckRequest(BaseModel):
    phone_number: str
    agent_location: str = "Unknown"  # neighbourhood, e.g. "Kanyama"


class CheckResponse(BaseModel):
    check_id: str
    phone_number: str
    verdict: str          # SAFE | CAUTION | STOP
    score: float          # 0.0 to 1.0
    narration: str        # plain English from Groq
    signals: list[str]    # what triggered this verdict
    sim_swapped: bool
    last_sim_change: str | None
    device_connectivity: str
    device_roaming: bool
    checked_at: str       # ISO timestamp


class FlagEntry(BaseModel):
    check_id: str
    phone_number: str
    verdict: str
    narration: str
    agent_location: str
    checked_at: str


# --- Endpoints ---

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "supabase": SUPABASE_ENABLED,
        "version": "1.0.0",
    }


@app.post("/check", response_model=CheckResponse)
async def check_number(
    body: CheckRequest,
    x_session_id: str = Header(default=None),
):
    """
    Run a fraud check on a mobile number.

    Calls Nokia NaC SIM Swap + Device Status in parallel,
    scores the signals, then asks Groq to narrate the verdict.

    Session ID header keeps the Groq agent's memory alive
    across multiple checks by the same booth agent.
    """
    # Use provided session or create a new one
    session_id = x_session_id or str(uuid.uuid4())
    check_id = str(uuid.uuid4())
    checked_at = datetime.now(timezone.utc).isoformat()

    # Run Nokia NaC checks in parallel
    sim_result, device_result = await camara.run_checks(body.phone_number)

    # Score the risk
    verdict = risk.score(sim_result, device_result)

    # Ask Groq to narrate
    narration = agent.narrate(
        session_id=session_id,
        phone_number=body.phone_number,
        verdict=verdict,
        sim=sim_result,
        device=device_result,
    )

    # Log to Supabase if available
    if SUPABASE_ENABLED and _supabase:
        try:
            _supabase.table("fraud_checks").insert({
                "id": check_id,
                "phone_number": body.phone_number,
                "verdict": verdict.verdict,
                "score": verdict.score,
                "signals": verdict.signals,
                "narration": narration,
                "sim_swapped": sim_result.swapped,
                "last_sim_change": sim_result.latest_sim_change,
                "device_connectivity": device_result.connectivity,
                "device_roaming": device_result.roaming,
                "agent_location": body.agent_location,
                "checked_at": checked_at,
            }).execute()
        except Exception as e:
            # Don't fail the check if logging fails
            print(f"Supabase log failed: {e}")

    return CheckResponse(
        check_id=check_id,
        phone_number=body.phone_number,
        verdict=verdict.verdict,
        score=verdict.score,
        narration=narration,
        signals=verdict.signals,
        sim_swapped=sim_result.swapped,
        last_sim_change=sim_result.latest_sim_change,
        device_connectivity=device_result.connectivity,
        device_roaming=device_result.roaming,
        checked_at=checked_at,
    )


@app.get("/flags", response_model=list[FlagEntry])
async def get_flags(limit: int = 50):
    """
    Return recent flagged checks for the map.
    Only returns CAUTION and STOP verdicts.
    """
    if not SUPABASE_ENABLED or not _supabase:
        return []

    try:
        result = (
            _supabase.table("fraud_checks")
            .select("id, phone_number, verdict, narration, agent_location, checked_at")
            .in_("verdict", ["CAUTION", "STOP"])
            .order("checked_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [
            FlagEntry(
                check_id=row["id"],
                phone_number=row["phone_number"],
                verdict=row["verdict"],
                narration=row["narration"],
                agent_location=row["agent_location"],
                checked_at=row["checked_at"],
            )
            for row in result.data
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
