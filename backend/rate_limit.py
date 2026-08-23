"""
rate_limit.py — per-user sliding window for /check.
"""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException

_hits: dict[str, deque[float]] = defaultdict(deque)
WINDOW_SEC = 60.0
MAX_HITS = 30


def check_rate(user_key: str) -> None:
    now = time.time()
    bucket = _hits[user_key]
    while bucket and now - bucket[0] > WINDOW_SEC:
        bucket.popleft()
    if len(bucket) >= MAX_HITS:
        raise HTTPException(status_code=429, detail="Too many checks. Wait a minute and try again.")
    bucket.append(now)
