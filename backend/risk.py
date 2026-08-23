"""
risk.py — Risk scoring logic

Takes SIM Swap, Device Swap, and Device Status signals
and returns a verdict.

Verdict levels:
  SAFE         — no suspicious signals in the lookback window
  CAUTION      — something is off, agent should ask questions
  STOP         — high fraud risk, do not release cash
  CHECK_FAILED — Nokia call failed; must not be treated as SAFE

Weights are transparent and explainable. No black box.
"""

from dataclasses import dataclass
from camara import SimSwapResult, DeviceSwapResult, DeviceStatusResult


@dataclass
class RiskVerdict:
    verdict: str        # SAFE | CAUTION | STOP | CHECK_FAILED
    score: float        # 0.0 to 1.0, higher = more risky
    signals: list[str]  # what triggered this verdict
    reason: str         # one plain sentence for the agent to build on


def score(
    sim: SimSwapResult,
    device_swap: DeviceSwapResult,
    device: DeviceStatusResult,
) -> RiskVerdict:
    """
    Score the risk based on all CAMARA signals.

    Weights:
      SIM swapped in 72h:      +0.60  strongest fraud indicator
      Device swapped in 72h:   +0.25  reinforces SIM swap signal
      Device not connected:    +0.25  unusual for active MoMo user
      Device on SMS only:      +0.10  degraded connectivity
      Device roaming:          +0.15  unexpected for local transaction
      API error on any check:  +0.10  uncertainty is itself a signal
    """
    risk_score = 0.0
    signals = []

    # --- SIM Swap (most important signal) ---
    if sim.error:
        risk_score += 0.10
        signals.append(f"SIM check failed: {sim.error}")
    elif sim.swapped:
        risk_score += 0.60
        timestamp = sim.latest_sim_change or "unknown time"
        signals.append(f"SIM was swapped recently (last change: {timestamp})")

    # --- Device Swap (reinforces SIM swap) ---
    if device_swap.error:
        risk_score += 0.10
        signals.append(f"Device swap check failed: {device_swap.error}")
    elif device_swap.swapped:
        risk_score += 0.25
        timestamp = device_swap.latest_device_change or "unknown time"
        signals.append(f"Device was also swapped recently (last change: {timestamp})")

    # --- Device Status ---
    if device.error:
        risk_score += 0.10
        signals.append(f"Device status check failed: {device.error}")
    else:
        if device.connectivity == "NOT_CONNECTED":
            risk_score += 0.25
            signals.append("Device is not connected to the network")
        elif device.connectivity == "CONNECTED_SMS":
            risk_score += 0.10
            signals.append("Device is on SMS only — not on data")

        if device.roaming:
            risk_score += 0.15
            signals.append("Device is currently roaming")

    risk_score = min(risk_score, 1.0)

    # --- Verdict ---
    # SIM swap is the control. If that API failed, we do not know enough to pay out.
    if sim.error:
        verdict = "CHECK_FAILED"
    elif sim.swapped or device_swap.swapped:
        verdict = "STOP"
    elif device_swap.error or device.error:
        verdict = "CAUTION"
    elif risk_score >= 0.60:
        verdict = "STOP"
    elif risk_score >= 0.25:
        verdict = "CAUTION"
    else:
        verdict = "SAFE"

    reason = _build_reason(verdict, signals, sim, device_swap)

    return RiskVerdict(
        verdict=verdict,
        score=round(risk_score, 2),
        signals=signals,
        reason=reason,
    )


def _build_reason(
    verdict: str,
    signals: list[str],
    sim: SimSwapResult,
    device_swap: DeviceSwapResult,
) -> str:
    """
    Build a plain sentence summary for the agent to narrate from.
    """
    if verdict == "CHECK_FAILED":
        return (
            "The SIM swap check did not complete. Do not treat this as safe. "
            "Try again, or refuse the payout if the customer cannot wait."
        )

    if verdict == "STOP":
        if sim.swapped and device_swap.swapped:
            return (
                "Both the SIM and the device were recently swapped — "
                "this is a strong fraud signal. Do not release cash."
            )
        if sim.swapped:
            return "SIM was recently swapped. Do not release cash until identity is confirmed."
        return f"Multiple risk signals detected: {'; '.join(signals)}."

    if verdict == "CAUTION":
        first = signals[0].lower() if signals else "a network signal could not be confirmed"
        return (
            f"One risk signal detected — {first} — "
            "ask the customer a verification question before proceeding."
        )

    return "No swap in the last 72 hours on this simulator number. That is not proof the customer is legitimate."