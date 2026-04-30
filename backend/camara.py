"""
camara.py — Nokia Network as Code API calls

Handles SIM Swap and Device Status checks using the NaC REST API.
Both calls run in parallel to keep the check under 3 seconds.

Simulator numbers for testing:
  Safe:    +99999991000, +99999991001
  Flagged: +99999990400, +99999990404, +99999990422
"""

import asyncio
import httpx
import os
from dataclasses import dataclass
from typing import Optional


NAC_BASE = "https://network-as-code.p-eu.rapidapi.com"
NAC_HOST = "network-as-code.nokia.rapidapi.com"


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "X-RapidAPI-Host": NAC_HOST,
        "X-RapidAPI-Key": os.environ["NAC_API_KEY"],
    }


@dataclass
class SimSwapResult:
    swapped: bool
    latest_sim_change: Optional[str]  # ISO timestamp or None
    error: Optional[str] = None


@dataclass
class DeviceStatusResult:
    connectivity: str  # CONNECTED_DATA | CONNECTED_SMS | NOT_CONNECTED
    roaming: bool
    error: Optional[str] = None


async def check_sim_swap(phone_number: str, max_age_hours: int = 72) -> SimSwapResult:
    """
    Check if SIM was swapped within the last max_age_hours.
    Returns swapped=True if a swap was detected in that window.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Check if swapped within window
            swap_response = await client.post(
                f"{NAC_BASE}/passthrough/camara/sim-swap/v0/check",
                headers=_headers(),
                json={"phoneNumber": phone_number, "maxAge": max_age_hours},
            )
            swap_response.raise_for_status()
            swapped = swap_response.json().get("swapped", False)

            # Get the actual timestamp of last swap
            timestamp_response = await client.post(
                f"{NAC_BASE}/passthrough/camara/sim-swap/v0/retrieve-date",
                headers=_headers(),
                json={"phoneNumber": phone_number},
            )
            timestamp_response.raise_for_status()
            latest_sim_change = timestamp_response.json().get("latestSimChange")

            return SimSwapResult(swapped=swapped, latest_sim_change=latest_sim_change)

        except httpx.HTTPStatusError as e:
            return SimSwapResult(
                swapped=False,
                latest_sim_change=None,
                error=f"API error {e.response.status_code}: {e.response.text}",
            )
        except Exception as e:
            return SimSwapResult(
                swapped=False,
                latest_sim_change=None,
                error=str(e),
            )


async def check_device_status(phone_number: str) -> DeviceStatusResult:
    """
    Get current connectivity and roaming status of the device.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            # Connectivity status
            # Endpoint: /device-status/v0/reachability
            # Returns: { "connectivityStatus": "CONNECTED_DATA" | "CONNECTED_SMS" | "NOT_CONNECTED" }
            conn_response = await client.post(
                f"{NAC_BASE}/device-status/v0/reachability",
                headers=_headers(),
                json={"device": {"phoneNumber": phone_number}},
            )
            conn_response.raise_for_status()
            connectivity = conn_response.json().get("connectivityStatus", "UNKNOWN")

            # Roaming status
            # Endpoint: /device-status/v0/roaming
            # Returns: { "roaming": true/false, "countryCode": 159 }
            roam_response = await client.post(
                f"{NAC_BASE}/device-status/v0/roaming",
                headers=_headers(),
                json={"device": {"phoneNumber": phone_number}},
            )
            roam_response.raise_for_status()
            roaming = roam_response.json().get("roaming", False)

            return DeviceStatusResult(connectivity=connectivity, roaming=roaming)

        except httpx.HTTPStatusError as e:
            return DeviceStatusResult(
                connectivity="UNKNOWN",
                roaming=False,
                error=f"API error {e.response.status_code}: {e.response.text}",
            )
        except Exception as e:
            return DeviceStatusResult(
                connectivity="UNKNOWN",
                roaming=False,
                error=str(e),
            )


async def run_checks(phone_number: str) -> tuple[SimSwapResult, DeviceStatusResult]:
    """
    Run SIM Swap and Device Status checks in parallel.
    This keeps total latency under 3 seconds.
    """
    sim_result, device_result = await asyncio.gather(
        check_sim_swap(phone_number),
        check_device_status(phone_number),
    )
    return sim_result, device_result
