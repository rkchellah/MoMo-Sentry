"""
main.py — MoMo Sentry FastAPI backend

Three endpoints:
  POST /check   — run an agentic fraud check on a phone number
  GET  /flags   — get recent flagged checks for the map
  GET  /health  — confirm the API is alive

The /check endpoint now uses an agentic AI loop.
The agent decides which Nokia NaC tools to call,
calls them, reasons over the results, and returns a verdict.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

import agent

# Supabase is optional — checks still work without it
try:
    from supabase import create_client
    _supabase = create_client(
        os.environ["SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_KEY"],
    )
    SUPABASE_ENABLED = True
except Exception as e:
    print(f"Supabase init failed: {e}")
    _supabase = None
    SUPABASE_ENABLED = False


app = FastAPI(
    title="MoMo Sentry",
    description="Agentic SIM swap fraud detection for mobile money booth agents",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Request / Response models ---

class CheckRequest(BaseModel):
    phone_number: str
    agent_location: str = "Unknown"
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None


class CheckResponse(BaseModel):
    check_id: str
    phone_number: str
    verdict: str
    narration: str
    signals: List[str]
    tool_calls_made: List[str]
    checked_at: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None


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
        "version": "2.0.0",
        "mode": "agentic",
    }


@app.post("/check", response_model=CheckResponse)
async def check_number(
    body: CheckRequest,
    x_session_id: str = Header(default=None),
):
    """
    Run an agentic fraud check on a mobile number.

    The AI agent decides which Nokia NaC tools to call,
    calls them in sequence, reasons over the results,
    and returns a verdict in plain English.

    The x-session-id header keeps the agent's memory alive
    across multiple checks in the same booth agent session.
    """
    try:
        session_id = x_session_id or str(uuid.uuid4())
        check_id = str(uuid.uuid4())
        checked_at = datetime.now(timezone.utc).isoformat()

        # Run the agentic check
        result = await agent.run_agent(
            session_id=session_id,
            phone_number=body.phone_number,
            agent_location=body.agent_location,
        )

        # Log to Supabase if available
        if SUPABASE_ENABLED and _supabase:
            try:
                _supabase.table("fraud_checks").insert({
                    "id": check_id,
                    "phone_number": body.phone_number,
                    "verdict": result["verdict"],
                    "score": 1.0 if result["verdict"] == "STOP" else 0.5 if result["verdict"] == "CAUTION" else 0.0,
                    "signals": result["signals"],
                    "narration": result["narration"],
                    "sim_swapped": any("SIM was swapped" in s for s in result["signals"]),
                    "last_sim_change": None,
                    "device_swapped": any("Device was also swapped" in s for s in result["signals"]),
                    "last_device_change": None,
                    "device_connectivity": "UNKNOWN",
                    "device_roaming": any("roaming" in s for s in result["signals"]),
                    "agent_location": body.agent_location,
                    "agent_id": body.agent_id,
                    "agent_name": body.agent_name,
                    "checked_at": checked_at,
                }).execute()
            except Exception as e:
                print(f"Supabase log failed: {e}")

        return CheckResponse(
            check_id=check_id,
            phone_number=body.phone_number,
            verdict=result["verdict"],
            narration=result["narration"],
            signals=result["signals"],
            tool_calls_made=result["tool_calls_made"],
            checked_at=checked_at,
            agent_id=body.agent_id,
            agent_name=body.agent_name,
        )

    except Exception as e:
        print(f"CHECK ENDPOINT ERROR: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/flags", response_model=List[FlagEntry])
async def get_flags(limit: int = 50):
    """
    Return recent CAUTION and STOP checks for the fraud map.
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