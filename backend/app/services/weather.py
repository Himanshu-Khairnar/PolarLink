"""Weather gate probabilities at station coordinates.

Tries Open-Meteo (no API key required) and degrades gracefully to a
deterministic band when the link is unavailable at a station.
"""

from __future__ import annotations

import hashlib

import httpx

OPEN_METEO = "https://api.open-meteo.com/v1/forecast"


def _deterministic_gate(station_id: str, day: int) -> float:
    seed = int(hashlib.sha256(f"{station_id}:{day}".encode()).hexdigest()[:8], 16)
    # 0.35 (gated) .. 0.95 (open)
    return 0.35 + (seed % 1000) / 1000 * 0.6


def weather_at(lat: float, lon: float, station_id: str, timeout: float = 3.0) -> dict:
    try:
        resp = httpx.get(
            OPEN_METEO,
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "wind_speed_10m,temperature_2m,precipitation",
                "hourly": "wind_speed_10m,visibility",
                "forecast_days": 3,
                "timezone": "UTC",
            },
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        current = data.get("current", {})
        wind = float(current.get("wind_speed_10m", 0) or 0)
        temp = float(current.get("temperature_2m", 0) or 0)
        # Flight/movement gate: high wind closes the route.
        gate = max(0.05, min(0.98, 1 - max(0.0, (wind - 15) / 35)))
        return {"source": "open-meteo", "wind_kts": wind, "temp_c": temp, "gate_prob": round(gate, 2)}
    except Exception:
        return {"source": "fallback", "gate_prob": round(_deterministic_gate(station_id, 0), 2)}
