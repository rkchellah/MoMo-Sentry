"""
agent.py — MoMo Sentry Agentic AI

This is the agentic version. Instead of receiving pre-computed results
and narrating them, the agent:

  1. Receives a phone number to check
  2. Decides which Nokia NaC tools to call
  3. Calls them, reasons over the results
  4. Decides if it needs more information
  5. Returns a verdict in plain English

The agent orchestrates the Nokia NaC APIs itself.
That's the difference between tool use and agentic AI.

Model: llama3-groq-70b-8192-tool-use-preview
This model is specifically optimised for function/tool calling.
"""

import os
import re
import json
import asyncio
from typing import Optional
from groq import Groq
import camara

_client = Groq(api_key=os.environ["GROQ_API_KEY"])

# In-memory session store: session_id → message history
_sessions: dict[str, list[dict]] = {}

SYSTEM_PROMPT = """You are MoMo Sentry, a fraud detection AI agent for mobile money booth agents in Zambia.

Your job is to check whether a mobile money transaction is safe by querying Nokia's network intelligence APIs.

When given a phone number to check:
1. Always check for SIM swap first — it is the strongest fraud signal
2. Always check device swap — if both SIM and device changed, that is very suspicious
3. Always check device connectivity and roaming status
4. Reason over all the results together before giving a verdict

Your final response must:
- State the verdict clearly: SAFE, CAUTION, or STOP
- Give a 1-2 sentence plain English explanation the agent can act on immediately
- Never use technical jargon — no "API", "connectivity status", "latestSimChange"
- Sound like a trusted colleague warning the agent, not a software system
- If you see a pattern across multiple checks in this session, mention it

Verdict rules:
- STOP: SIM was swapped in last 72 hours (strong signal — always STOP)
- STOP: Both SIM and device swapped recently
- CAUTION: Device is roaming or on SMS only without a SIM swap
- SAFE: No suspicious signals detected
"""

# Nokia NaC tools the agent can call
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "check_sim_swap",
            "description": "Check if the SIM card associated with a phone number was recently swapped. A recent SIM swap is the strongest indicator of mobile money fraud.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_number": {
                        "type": "string",
                        "description": "The mobile phone number to check, e.g. +99999991000"
                    },
                    "max_age_hours": {
                        "type": "integer",
                        "description": "How many hours back to check for a SIM swap. Default is 72 hours.",
                        "default": 72
                    }
                },
                "required": ["phone_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_device_swap",
            "description": "Check if the SIM card moved to a new physical handset recently. Combined with a SIM swap, this is a very strong fraud signal.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_number": {
                        "type": "string",
                        "description": "The mobile phone number to check"
                    },
                    "max_age_hours": {
                        "type": "integer",
                        "description": "How many hours back to check for a device swap. Default is 72 hours.",
                        "default": 72
                    }
                },
                "required": ["phone_number"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "check_device_status",
            "description": "Check the current connectivity and roaming status of a mobile device. An offline device or one that is roaming can indicate suspicious activity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone_number": {
                        "type": "string",
                        "description": "The mobile phone number to check"
                    }
                },
                "required": ["phone_number"]
            }
        }
    }
]


async def _execute_tool(tool_name: str, tool_args: dict) -> str:
    """
    Execute a Nokia NaC tool call and return the result as a string.
    The agent receives this result and reasons over it.
    """
    try:
        if tool_name == "check_sim_swap":
            result = await camara.check_sim_swap(
                phone_number=tool_args["phone_number"],
                max_age_hours=tool_args.get("max_age_hours", 72)
            )
            return json.dumps({
                "swapped": result.swapped,
                "last_sim_change": result.latest_sim_change,
                "error": result.error
            })

        elif tool_name == "check_device_swap":
            result = await camara.check_device_swap(
                phone_number=tool_args["phone_number"],
                max_age_hours=tool_args.get("max_age_hours", 72)
            )
            return json.dumps({
                "swapped": result.swapped,
                "last_device_change": result.latest_device_change,
                "error": result.error
            })

        elif tool_name == "check_device_status":
            result = await camara.check_device_status(
                phone_number=tool_args["phone_number"]
            )
            return json.dumps({
                "connectivity": result.connectivity,
                "roaming": result.roaming,
                "error": result.error
            })

        else:
            return json.dumps({"error": f"Unknown tool: {tool_name}"})

    except Exception as e:
        return json.dumps({"error": str(e)})


def _get_session(session_id: str) -> list[dict]:
    if session_id not in _sessions:
        _sessions[session_id] = []
    return _sessions[session_id]


async def run_agent(
    session_id: str,
    phone_number: str,
    agent_location: str = "Unknown",
) -> dict:
    """
    Run the agentic fraud check.

    The agent decides which Nokia NaC tools to call, calls them,
    reasons over the results, and returns a verdict.

    Returns a dict with:
      - verdict: SAFE | CAUTION | STOP
      - narration: plain English explanation
      - signals: list of what was detected
      - tool_calls_made: which Nokia APIs the agent called
    """
    history = _get_session(session_id)

    # Initial user message to the agent
    user_message = f"""Check phone number {phone_number} for mobile money fraud risk.
The transaction is happening in {agent_location}, Lusaka, Zambia.
Use the available tools to check this number and give me a verdict."""

    messages = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + history
        + [{"role": "user", "content": user_message}]
    )

    tool_calls_made = []
    signals = []
    max_iterations = 5  # Safety cap — agent shouldn't loop more than 5 times

    # Agentic loop — agent keeps calling tools until it has enough to decide
    for iteration in range(max_iterations):
        response = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            max_tokens=1000,
            temperature=0.2,
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        # Add the assistant's response to the conversation
        messages.append({
            "role": "assistant",
            "content": message.content or "",
            "tool_calls": [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments
                    }
                }
                for tc in (message.tool_calls or [])
            ] if message.tool_calls else []
        })

        # If no tool calls — agent has made its decision
        if not message.tool_calls or finish_reason == "stop":
            narration = message.content or "Check complete."
            if narration:
                narration = re.sub(r'^(STOP|CAUTION|SAFE):\s*', '', narration).strip()

            # Extract verdict from narration
            verdict = "CAUTION"  # default
            narration_upper = narration.upper()
            if "STOP" in narration_upper or "DO NOT RELEASE" in narration_upper:
                verdict = "STOP"
            elif "SAFE" in narration_upper or "PROCEED" in narration_upper:
                verdict = "SAFE"

            # Save to session history
            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": narration})
            if len(history) > 40:
                _sessions[session_id] = history[-40:]

            return {
                "verdict": verdict,
                "narration": narration,
                "signals": signals,
                "tool_calls_made": tool_calls_made,
            }

        # Execute each tool the agent requested
        for tool_call in message.tool_calls:
            tool_name = tool_call.function.name
            tool_args = json.loads(tool_call.function.arguments)

            tool_calls_made.append(tool_name)
            print(f"Agent calling tool: {tool_name} with {tool_args}")

            # Run the actual Nokia NaC API call
            tool_result = await _execute_tool(tool_name, tool_args)
            result_data = json.loads(tool_result)

            # Track signals for the response
            if tool_name == "check_sim_swap" and result_data.get("swapped"):
                signals.append(f"SIM was swapped recently (last change: {result_data.get('last_sim_change', 'unknown')})")
            elif tool_name == "check_device_swap" and result_data.get("swapped"):
                signals.append(f"Device was also swapped recently (last change: {result_data.get('last_device_change', 'unknown')})")
            elif tool_name == "check_device_status":
                if result_data.get("connectivity") == "NOT_CONNECTED":
                    signals.append("Device is not connected to the network")
                elif result_data.get("connectivity") == "CONNECTED_SMS":
                    signals.append("Device is on SMS only — not on data")
                if result_data.get("roaming"):
                    signals.append("Device is currently roaming")

            # Return tool result to agent
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": tool_result,
            })

    # Safety fallback if agent loops too many times
    return {
        "verdict": "CAUTION",
        "narration": "Check completed with partial results. Proceed with caution.",
        "signals": signals,
        "tool_calls_made": tool_calls_made,
    }


def clear_session(session_id: str) -> None:
    _sessions.pop(session_id, None)