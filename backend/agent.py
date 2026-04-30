"""
agent.py — Groq AI agent with persistent session memory

Holds conversation history per session so the agent remembers
what it saw earlier in the same shift. If the second number checked
is also flagged from the same area, the agent notices.

That's the difference between a lookup tool and something that thinks.
"""

import os
from groq import Groq
from risk import RiskVerdict
from camara import SimSwapResult, DeviceSwapResult, DeviceStatusResult


_client = Groq(api_key=os.environ["GROQ_API_KEY"])

# In-memory session store: session_id → message history
_sessions: dict[str, list[dict]] = {}

SYSTEM_PROMPT = """You are MoMo Sentry, a fraud detection assistant for mobile money booth agents in Zambia.

Your job is to explain fraud risk checks in plain, direct language that a booth agent can act on immediately.

Rules:
- Keep responses to 1-2 sentences maximum
- Be direct. Agents are busy. No pleasantries.
- Use clear action words: "Do not release cash", "Proceed carefully", "Safe to proceed"
- When a SIM swap is detected, always mention it clearly
- When both SIM and device were swapped, say both — that is a strong signal
- Remember previous checks in this session — if you see a pattern, mention it
- Write like a trusted colleague warning you, not like a software system
- Never use technical jargon like "API", "connectivity status", "risk score"
"""


def _get_session(session_id: str) -> list[dict]:
    if session_id not in _sessions:
        _sessions[session_id] = []
    return _sessions[session_id]


def narrate(
    session_id: str,
    phone_number: str,
    verdict: RiskVerdict,
    sim: SimSwapResult,
    device_swap: DeviceSwapResult,
    device: DeviceStatusResult,
) -> str:
    """
    Ask Groq to narrate the risk verdict in plain language.
    Session history gives context across multiple checks.
    """
    history = _get_session(session_id)

    context = f"""
Phone number checked: {phone_number}
Verdict: {verdict.verdict}
Risk score: {verdict.score}
Signals: {'; '.join(verdict.signals) if verdict.signals else 'None'}
SIM swapped recently: {sim.swapped}
Last SIM change: {sim.latest_sim_change or 'Unknown'}
Device swapped recently: {device_swap.swapped}
Last device change: {device_swap.latest_device_change or 'Unknown'}
Device connectivity: {device.connectivity}
Device roaming: {device.roaming}

Give the agent a 1-2 sentence verdict they can act on immediately.
"""

    history.append({"role": "user", "content": context})

    response = _client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}] + history,
        max_tokens=150,
        temperature=0.3,
    )

    narration = response.choices[0].message.content.strip()
    history.append({"role": "assistant", "content": narration})

    # Keep history bounded — last 20 exchanges per session
    if len(history) > 40:
        _sessions[session_id] = history[-40:]

    return narration


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)