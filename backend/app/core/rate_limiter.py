import time
from typing import Dict, Tuple
from fastapi import Request, HTTPException, status

class SimpleRateLimiter:
    """
    Sliding window rate limiter to protect authentication, biometric, and sensitive API routes
    against brute-force and credential stuffing attacks.
    """
    def __init__(self, requests_per_window: int = 10, window_seconds: int = 60):
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
        # Mapping: IP address -> List of timestamps
        self._history: Dict[str, list] = {}

    def is_rate_limited(self, ip: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Filter out timestamps outside current window
        timestamps = [t for t in self._history.get(ip, []) if t > cutoff]
        
        if len(timestamps) >= self.requests_per_window:
            self._history[ip] = timestamps
            return True
            
        timestamps.append(now)
        self._history[ip] = timestamps
        return False

# Global instance for Auth / Biometric Endpoints: Max 15 requests per 60 seconds per IP
login_rate_limiter = SimpleRateLimiter(requests_per_window=15, window_seconds=60)

def check_login_rate_limit(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    # Support proxy headers if behind nginx/cloudflare
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()

    if login_rate_limiter.is_rate_limited(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many authentication attempts. Please wait 60 seconds before trying again."
        )
