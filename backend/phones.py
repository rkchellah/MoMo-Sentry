"""
phones.py — sandbox vs production number rules.

Sandbox (NAC_MODE=sandbox): only Nokia simulator MSISDNs (+999…).
Real Zambian numbers are rejected, never remapped to a simulator.
"""

from __future__ import annotations

import os
import re

ZAMBIAN_MSISDN = re.compile(
    r"^(?:\+?260|0)?(9[567]\d{7}|7[67]\d{7})$"
)


def nac_mode() -> str:
    return os.environ.get("NAC_MODE", "sandbox").strip().lower()


def _digits_plus(raw: str) -> str:
    stripped = re.sub(r"[\s\-()]", "", raw.strip())
    if stripped.startswith("00"):
        stripped = "+" + stripped[2:]
    return stripped


def looks_zambian(normalized: str) -> bool:
    compact = normalized.replace("+", "")
    if normalized.startswith("+260") or compact.startswith("260"):
        return True
    if ZAMBIAN_MSISDN.match(normalized) or ZAMBIAN_MSISDN.match(compact):
        return True
    if normalized.startswith("09") or normalized.startswith("07"):
        return True
    return False


def resolve_phone(raw: str) -> tuple[str | None, str | None]:
    """
    Return (normalized_e164, reject_message).
    If reject_message is set, the check must be CHECK_FAILED — do not call Nokia.
    """
    if not raw or not raw.strip():
        return None, "Enter a phone number."

    normalized = _digits_plus(raw)
    mode = nac_mode()

    if mode != "production":
        if looks_zambian(normalized):
            return None, (
                "This environment cannot query Zambian SIMs. "
                "Nokia sandbox only accepts simulator numbers such as +99999991000."
            )
        if not normalized.startswith("+"):
            normalized = "+" + normalized.lstrip("+")
        if not normalized.startswith("+999"):
            return None, (
                "Sandbox checks only accept Nokia simulator numbers starting with +999. "
                "Use a test customer below, or type +99999991000."
            )
        return normalized, None

    # Production: E.164 +260…
    if normalized.startswith("0") and len(normalized) == 10:
        normalized = "+260" + normalized[1:]
    elif normalized.startswith("260") and not normalized.startswith("+"):
        normalized = "+" + normalized
    elif not normalized.startswith("+"):
        normalized = "+" + normalized
    return normalized, None
