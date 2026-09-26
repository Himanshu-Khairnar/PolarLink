from __future__ import annotations

import asyncio
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    """WebSocket fan-out for live SOS, roll-call and custody updates."""

    def __init__(self) -> None:
        self._rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, room: str, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._rooms[room].add(ws)

    async def disconnect(self, room: str, ws: WebSocket) -> None:
        async with self._lock:
            self._rooms[room].discard(ws)

    async def broadcast(self, room: str, message: dict) -> None:
        async with self._lock:
            targets = list(self._rooms[room])
        for ws in targets:
            try:
                await ws.send_json(message)
            except Exception:
                await self.disconnect(room, ws)


manager = ConnectionManager()
