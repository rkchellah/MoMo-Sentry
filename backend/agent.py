"""
agent.py — Deterministic fraud check + DeepSeek narration.

Nokia APIs run in parallel. risk.py sets the verdict.
DeepSeek only explains it. It does not call tools or set the badge.
"""

from __future__ import annotations

import os
import re
from typing import Optional

from openai import OpenAI

import camara
import risk
from sessions import load_history, save_history

_client: Optional[OpenAI] = None
_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

SYSTEM_PROMPT = """You are MoMo Sentry, speaking to a mobile money booth agent.

The verdict is already decided from Nokia network checks. You do not change it.
Explain in 1-2 plain sentences what the agent should do.

Rules:
- Never use jargon: no API, connectivity status, latestSimChange, sandbox internals
- Do not start with SAFE:, CAUTION:, STOP:, or CHECK_FAILED:
- If the verdict is SAFE, say there was no SIM swap in the last 72 hours — not that the person is legitimate
- If CHECK_FAILED, tell them not to treat the number as safe
- If earlier checks in this session were also flagged, mention that pattern
- Use the phone number exactly as given. Do not invent a Zambian number
"""


def _client_or_none() -> Optional[OpenAI]:
    global _client
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        return None
    if _client is None:
        _client = OpenAI(api_key=key, base_url="https://api.deepseek.com")
    return _client


def _strip_prefix(narration: str) -> str:
    return re.sub(
        r"^(STOP|CAUTION|SAFE|CHECK_FAILED):\s*",
        "",
        narration.strip(),
        flags=re.IGNORECASE,
    ).strip()


async def _narrate(
    phone_number: str,
    agent_location: str,
    scored: risk.RiskVerdict,
    history: list[dict],
) -> str:
    client = _client_or_none()
    if client is None:
        return scored.reason

    signal_text = "; ".join(scored.signals) if scored.signals else "none"
    user_message = (
        f"Phone {phone_number} at {agent_location}. "
        f"Verdict: {scored.verdict}. Score: {scored.score}. "
        f"Signals: {signal_text}. "
        f"Draft reason: {scored.reason}"
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[-12:])
    messages.append({"role": "user", "content": user_message})

    try:
        response = client.chat.completions.create(
            model=_MODEL,
            messages=messages,
            max_tokens=220,
            temperature=0.2,
        )
        content = response.choices[0].message.content or scored.reason
        return _strip_prefix(content) or scored.reason
    except Exception as e:
        print(f"DeepSeek narration failed: {e}")
        return scored.reason


async def run_check(
    phone_number: str,
    agent_location: str = "Unknown",
    user_id: Optional[str] = None,
) -> dict:
    """
    Parallel Nokia checks, risk.py verdict, one narration call.
    """
    history = load_history(user_id)

    sim, device_swap, device = await camara.run_checks(phone_number)
    scored = risk.score(sim, device_swap, device)
    narration = await _narrate(phone_number, agent_location, scored, history)

    history.append({
        "role": "user",
        "content": f"Checked {phone_number} at {agent_location}",
    })
    history.append({
        "role": "assistant",
        "content": f"{scored.verdict}: {narration}",
    })
    save_history(user_id, history)

    return {
        "verdict": scored.verdict,
        "narration": narration,
        "signals": scored.signals,
        "score": scored.score,
        "sim_swapped": bool(sim.swapped) and not sim.error,
        "last_sim_change": sim.latest_sim_change,
        "device_swapped": bool(device_swap.swapped) and not device_swap.error,
        "last_device_change": device_swap.latest_device_change,
        "device_connectivity": device.connectivity,
        "device_roaming": bool(device.roaming) and not device.error,
        "tool_calls_made": [
            "check_sim_swap",
            "check_device_swap",
            "check_device_status",
        ],
    }
