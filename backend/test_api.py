"""
test_api.py — Verify Nokia NaC API calls before running the full app

Run this first:
  cd backend
  python test_api.py

Note on simulator: All working numbers return swapped: True for both
SIM Swap and Device Swap. The simulator does not distinguish between
safe and flagged numbers — it just confirms the API is reachable and
returning valid responses. Real network data would return false for
legitimate numbers.
"""

import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

import httpx

NAC_BASE = "https://network-as-code.p-eu.rapidapi.com"
NAC_HOST = "network-as-code.nokia.rapidapi.com"

TEST_NUMBER = "+99999991000"


def headers():
    key = os.environ.get("NAC_API_KEY")
    if not key:
        raise ValueError("NAC_API_KEY not set in .env")
    return {
        "Content-Type": "application/json",
        "x-rapidapi-host": NAC_HOST,
        "x-rapidapi-key": key,
    }


async def test_sim_swap_check():
    print("\n1. SIM Swap check")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{NAC_BASE}/passthrough/camara/v1/sim-swap/sim-swap/v0/check",
            headers=headers(),
            json={"phoneNumber": TEST_NUMBER, "maxAge": 240},
        )
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        assert r.status_code == 200
        print("   ✓ PASSED")


async def test_sim_swap_timestamp():
    print("\n2. SIM Swap retrieve-date")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{NAC_BASE}/passthrough/camara/v1/sim-swap/sim-swap/v0/retrieve-date",
            headers=headers(),
            json={"phoneNumber": TEST_NUMBER},
        )
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        assert r.status_code == 200
        print("   ✓ PASSED")


async def test_device_swap_check():
    print("\n3. Device Swap check")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{NAC_BASE}/passthrough/camara/v1/device-swap/device-swap/v1/check",
            headers=headers(),
            json={"phoneNumber": TEST_NUMBER, "maxAge": 120},
        )
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        assert r.status_code == 200
        print("   ✓ PASSED")


async def test_device_swap_timestamp():
    print("\n4. Device Swap retrieve-date")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{NAC_BASE}/passthrough/camara/v1/device-swap/device-swap/v1/retrieve-date",
            headers=headers(),
            json={"phoneNumber": TEST_NUMBER},
        )
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        assert r.status_code == 200
        print("   ✓ PASSED")


async def test_roaming():
    print("\n5. Roaming status")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{NAC_BASE}/device-status/v0/roaming",
            headers=headers(),
            json={"device": {"phoneNumber": TEST_NUMBER}},
        )
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        assert r.status_code == 200
        print("   ✓ PASSED")


async def test_connectivity():
    print("\n6. Device connectivity")
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(
            f"{NAC_BASE}/device-status/v0/connectivity",
            headers=headers(),
            json={"device": {"phoneNumber": TEST_NUMBER}},
        )
        print(f"   Status: {r.status_code}")
        print(f"   Response: {r.json()}")
        assert r.status_code == 200
        print("   ✓ PASSED")


async def main():
    print("=" * 55)
    print("MoMo Sentry — Nokia NaC API Test")
    print("=" * 55)

    passed = 0
    failed = 0

    for test in [
        test_sim_swap_check,
        test_sim_swap_timestamp,
        test_device_swap_check,
        test_device_swap_timestamp,
        test_roaming,
        test_connectivity,
    ]:
        try:
            await test()
            passed += 1
        except Exception as e:
            print(f"   ✗ FAILED: {e}")
            failed += 1

    print(f"\n{'=' * 55}")
    print(f"Results: {passed} passed, {failed} failed")

    if failed == 0:
        print("All good. Run: uvicorn main:app --reload")
    else:
        print("Check the portal playground for correct endpoint paths.")
    print("=" * 55)


if __name__ == "__main__":
    asyncio.run(main())