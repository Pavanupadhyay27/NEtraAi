"""
event_bus.py — In-process broadcast bus for real-time scan events.

Any code path that creates an AttendanceLog (kiosk scan) calls
`publish_scan_event(payload_dict)`. The SSE endpoint in analytics.py
subscribes a new asyncio.Queue per connected client and streams the events.
"""
import asyncio
from typing import List

_subscribers: List[asyncio.Queue] = []
_loop: asyncio.AbstractEventLoop = None


def subscribe() -> asyncio.Queue:
    """Register a new SSE client and return its dedicated queue."""
    global _loop
    try:
        _loop = asyncio.get_running_loop()
    except RuntimeError:
        pass
    q: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    """Remove a client queue when the SSE connection closes."""
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


def publish_scan_event(payload: dict) -> None:
    """
    Broadcast a scan-event dict to all connected SSE clients.
    Thread-safe implementation that dispatches to the main event loop.
    """
    global _loop
    if _loop is not None:
        _loop.call_soon_threadsafe(_publish_to_all, payload)
    else:
        _publish_to_all(payload)


def _publish_to_all(payload: dict) -> None:
    dead: List[asyncio.Queue] = []
    for q in _subscribers:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        unsubscribe(q)
