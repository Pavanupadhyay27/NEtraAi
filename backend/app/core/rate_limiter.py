import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Request, HTTPException, status
from app.core.config import settings


def _get_client_ip(request: Request) -> str:
    """
    Safely resolve client IP.
    Only trust X-Forwarded-For if TRUST_PROXY is explicitly enabled in config.
    Without this, any attacker can spoof the header to bypass rate limiting.
    """
    if getattr(settings, "TRUST_PROXY", False):
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first (leftmost) IP — the original client
            candidate = forwarded_for.split(",")[0].strip()
            # Basic sanity check — must look like an IP
            if candidate and len(candidate) < 50:
                return candidate
    return request.client.host if request.client else "127.0.0.1"


class SlidingWindowRateLimiter:
    """
    Sliding window rate limiter.
    Thread-safe for single-process deployments (uvicorn single worker).
    For multi-worker deployments, swap _history for a Redis backend.
    """

    def __init__(self, requests_per_window: int, window_seconds: int):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_rate_limited(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        history = self._history[key]

        # Prune old timestamps
        self._history[key] = [t for t in history if t > cutoff]

        if len(self._history[key]) >= self.requests_per_window:
            return True

        self._history[key].append(now)
        return False

    def remaining(self, key: str) -> int:
        now = time.time()
        cutoff = now - self.window_seconds
        active = [t for t in self._history.get(key, []) if t > cutoff]
        return max(0, self.requests_per_window - len(active))


# ── Login / Auth endpoints: 5 attempts per 5 minutes per IP ──────────────────
# (was 15/60s which is too permissive for brute-force protection)
login_rate_limiter = SlidingWindowRateLimiter(
    requests_per_window=5,
    window_seconds=300   # 5 minutes
)

# ── General API: 200 requests per minute per IP ───────────────────────────────
api_rate_limiter = SlidingWindowRateLimiter(
    requests_per_window=200,
    window_seconds=60
)


def check_login_rate_limit(request: Request) -> None:
    """
    Dependency for auth endpoints.
    Blocks after 5 failed/total login attempts in 5 minutes.
    """
    client_ip = _get_client_ip(request)
    if login_rate_limiter.is_rate_limited(client_ip):
        remaining_seconds = login_rate_limiter.window_seconds
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Too many authentication attempts. "
                f"Please wait {remaining_seconds // 60} minutes before trying again."
            ),
            headers={"Retry-After": str(remaining_seconds)},
        )


def check_api_rate_limit(request: Request) -> None:
    """
    Global API rate limiter dependency.
    Applied as a router-level dependency in main.py.
    """
    client_ip = _get_client_ip(request)
    if api_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="API rate limit exceeded. Max 200 requests per minute.",
            headers={"Retry-After": "60"},
        )
