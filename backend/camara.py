"""
camara.py — Nokia Network as Code API calls

Three CAMARA APIs, all confirmed from Nokia NaC portal playground:

  SIM Swap:     /passthrough/camara/v1/sim-swap/sim-swap/v0/check
  Device Swap:  /passthrough/camara/v1/device-swap/device-swap/v1/check
  Device Status:/device-status/v0/connectivity
                /device-status/v0/roaming

All three run in parallel via run_checks().

Simulator numbers:
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
        "x-rapidapi-host": NAC_HOST,
        "x-rapidapi-key": os.environ["NAC_API_KEY"],
    }


@dataclass
class SimSwapResult:
    swapped: bool
    latest_sim_change: Optional[str]
    error: Optional[str] = None


@dataclass
class DeviceSwapResult:
    swapped: bool
    latest_device_change: Optional[str]
    error: Optional[str] = None


@dataclass
class DeviceStatusResult:
    connectivity: str  # CONNECTED_DATA | CONNECTED_SMS | NOT_CONNECTED | UNKNOWN
    roaming: bool
    error: Optional[str] = None


async def check_sim_swap(phone_number: str, max_age_hours: int = 72) -> SimSwapResult:
    """
    Check if SIM was swapped within the last max_age_hours.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            swap_response = await client.post(
                f"{NAC_BASE}/passthrough/camara/v1/sim-swap/sim-swap/v0/check",
                headers=_headers(),
                json={"phoneNumber": phone_number, "maxAge": max_age_hours},
            )
            swap_response.raise_for_status()
            swapped = swap_response.json().get("swapped", False)

            timestamp_response = await client.post(
                f"{NAC_BASE}/passthrough/camara/v1/sim-swap/sim-swap/v0/retrieve-date",
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
            return SimSwapResult(swapped=False, latest_sim_change=None, error=str(e))


async def check_device_swap(phone_number: str, max_age_hours: int = 72) -> DeviceSwapResult:
    """
    Check if the SIM moved to a new physical handset.
    SIM swap + device swap together = stronger fraud signal.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            swap_response = await client.post(
                f"{NAC_BASE}/passthrough/camara/v1/device-swap/device-swap/v1/check",
                headers=_headers(),
                json={"phoneNumber": phone_number, "maxAge": max_age_hours},
            )
            swap_response.raise_for_status()
            swapped = swap_response.json().get("swapped", False)

            timestamp_response = await client.post(
                f"{NAC_BASE}/passthrough/camara/v1/device-swap/device-swap/v1/retrieve-date",
                headers=_headers(),
                json={"phoneNumber": phone_number},
            )
            timestamp_response.raise_for_status()
            latest_device_change = timestamp_response.json().get("latestDeviceChange")

            return DeviceSwapResult(swapped=swapped, latest_device_change=latest_device_change)

        except httpx.HTTPStatusError as e:
            return DeviceSwapResult(
                swapped=False,
                latest_device_change=None,
                error=f"API error {e.response.status_code}: {e.response.text}",
            )
        except Exception as e:
            return DeviceSwapResult(swapped=False, latest_device_change=None, error=str(e))


async def check_device_status(phone_number: str) -> DeviceStatusResult:
    """
    Get current connectivity and roaming status.
    Both endpoints confirmed from Nokia NaC portal.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            conn_response = await client.post(
                f"{NAC_BASE}/device-status/v0/connectivity",
                headers=_headers(),
                json={"device": {"phoneNumber": phone_number}},
            )
            conn_response.raise_for_status()
            connectivity = conn_response.json().get("connectivityStatus", "UNKNOWN")

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
            return DeviceStatusResult(connectivity="UNKNOWN", roaming=False, error=str(e))


async def run_checks(phone_number: str) -> tuple[SimSwapResult, DeviceSwapResult, DeviceStatusResult]:
    """
    Run all three checks in parallel.
    SIM Swap + Device Swap + Device Status = three CAMARA APIs in one request.
    """
    sim_result, device_swap_result, device_status_result = await asyncio.gather(
        check_sim_swap(phone_number),
        check_device_swap(phone_number),
        check_device_status(phone_number),
    )
    return sim_result, device_swap_result, device_status_result