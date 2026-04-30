"""
risk.py — Risk scoring logic

Takes SIM Swap and Device Status signals and returns a verdict.

Verdict levels:
  SAFE    — no suspicious signals, proceed with transaction
  CAUTION — something is off, agent should ask questions
  STOP    — high fraud risk, do not release cash

The logic is intentionally transparent so the agent understands why.
"""

from dataclasses import dataclass
from camara import SimSwapResult, DeviceStatusResult


@dataclass
class RiskVerdict:
    verdict: str        # SAFE | CAUTION | STOP
    score: float        # 0.0 to 1.0, higher = more risky
    signals: list[str]  # what triggered this verdict
    reason: str         # one plain sentence for the agent


def score(sim: SimSwapResult, device: DeviceStatusResult) -> RiskVerdict:
    """
    Score the risk based on CAMARA API signals.

    Scoring logic:
      - SIM swapped within 72h:     +0.6 (major red flag)
      - Device not connected:       +0.25
      - Device roaming unexpectedly:+0.15
      - API errors on either check: +0.1 per error (uncertainty)
    """
    risk_score = 0.0
    signals = []

    # --- SIM Swap signal (most important) ---
    if sim.error:
        risk_score += 0.1
        signals.append(f"SIM check failed: {sim.error}")
    elif sim.swapped:
        risk_score += 0.6
        timestamp = sim.latest_sim_change or "unknown time"
        signals.append(f"SIM was swapped recently (last change: {timestamp})")

    # --- Device Status signal ---
    if device.error:
        risk_score += 0.1
        signals.append(f"Device status check failed: {device.error}")
    else:
        if device.connectivity == "NOT_CONNECTED":
            risk_score += 0.25
            signals.append("Device is not connected to the network")
        elif device.connectivity == "CONNECTED_SMS":
            risk_score += 0.1
            signals.append("Device is on SMS only, not data — unusual for active MoMo use")

        if device.roaming:
            risk_score += 0.15
            signals.append("Device is currently roaming")

    # Cap at 1.0
    risk_score = min(risk_score, 1.0)

    # --- Determine verdict ---
    if risk_score >= 0.6:
        verdict = "STOP"
        reason = _build_reason("STOP", signals, sim, device)
    elif risk_score >= 0.25:
        verdict = "CAUTION"
        reason = _build_reason("CAUTION", signals, sim, device)
    else:
        verdict = "SAFE"
        reason = _build_reason("SAFE", signals, sim, device)

    return RiskVerdict(
        verdict=verdict,
        score=round(risk_score, 2),
        signals=signals,
        reason=reason,
    )


def _build_reason(verdict: str, signals: list[str], sim: SimSwapResult, device: DeviceStatusResult) -> str:
    """
    Build a plain one-sentence reason for the agent.
    This gets passed to Groq for natural language narration.
    """
    if verdict == "STOP":
        if sim.swapped:
            return f"SIM was recently swapped — do not release cash until you confirm this person's identity by another means."
        return f"Multiple risk signals detected: {'; '.join(signals)}."

    if verdict == "CAUTION":
        return f"Something is slightly off — {signals[0].lower()} — ask the customer a verification question before proceeding."

    return "No suspicious signals detected. SIM is stable and device is connected."
