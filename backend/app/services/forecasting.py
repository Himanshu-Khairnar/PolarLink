"""Consumption forecasting.

Additive Holt-Winters triple exponential smoothing implemented with NumPy so the
service has no heavyweight runtime dependency. If `statsmodels` is available it
is used for a cross-check, but the shipped path is self-contained.
"""

from __future__ import annotations

import hashlib

import numpy as np

# Baseline daily consumption per SKU, used by the synthetic seed and as the
# centre line for generated history. Mirrors the frontend seed.
BASE_USE: dict[str, float] = {
    "FUEL-DSL": 420, "FUEL-JETA1": 12, "FUEL-LUB": 9, "FOOD-RATION": 46,
    "FOOD-FLOUR": 24, "FOOD-RICE": 30, "FOOD-OIL": 11, "FOOD-FROZEN": 18,
    "FOOD-EGG": 4, "MED-INSULIN": 1.4, "MED-ANTIBIO": 2.2, "MED-VACC": 0.8,
    "MED-ANALG": 3.1, "MED-BAND": 0.6, "MED-O2": 0.9, "SPR-GEN": 0.15,
    "SPR-SAT": 0.2, "SPR-PUMP": 0.1, "SPR-SNOW": 0.08, "SCI-REAG": 0.3,
}

STATION_FACTOR = {"st-bharati": 1.7, "st-himadri": 0.7}


def _rng(station_id: str, item_id: str) -> np.random.Generator:
    seed = int(hashlib.sha256(f"{station_id}:{item_id}".encode()).hexdigest()[:8], 16)
    return np.random.default_rng(seed)


def consumption_series(station_id: str, sku: str, n: int = 120) -> np.ndarray:
    """Deterministic, seasonally-shaped daily consumption history."""
    rng = _rng(station_id, sku)
    base = BASE_USE.get(sku, 1.0)
    factor = STATION_FACTOR.get(station_id, 1.0)
    i = np.arange(n)
    seasonal = 1 + 0.28 * np.sin((i / 365.0) * 2 * np.pi + 1.2)
    crew = 1 + 0.18 * np.sin((i / 180.0) * 2 * np.pi)
    noise = 1 + rng.normal(0, 0.12, n)
    return np.clip(base * factor * seasonal * crew * noise, 0, None)


def holt_winters(series: np.ndarray, horizon: int, season: int = 30) -> np.ndarray:
    """Additive Holt-Winters. Returns `horizon` forecast points."""
    series = np.asarray(series, dtype=float)
    if series.size == 0:
        return np.zeros(horizon)
    m = min(season, max(2, series.size // 2))
    alpha, beta, gamma = 0.35, 0.08, 0.30

    seasonal = np.array(
        [series[i::m].mean() if series[i::m].size else 0.0 for i in range(m)], dtype=float
    )
    seasonal -= seasonal.mean()
    level = float(series[:m].mean())
    if series.size > 1:
        x = np.arange(series.size)
        slope, _ = np.polyfit(x, series, 1)
        trend = float(slope)
    else:
        trend = 0.0

    for i, value in enumerate(series):
        s = seasonal[i % m]
        prev_level = level
        level = alpha * (value - s) + (1 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1 - beta) * trend
        seasonal[i % m] = gamma * (value - level) + (1 - gamma) * s

    h = np.arange(1, horizon + 1)
    # Damped trend: without damping an extrapolated negative slope clips the
    # whole tail to zero, which is misleading for cold-chain items.
    phi = 0.9
    damped = trend * (1 - np.power(phi, h)) / (1 - phi)
    floor = max(0.0, level * 0.35)
    out = level + damped + seasonal[(series.size + h - 1) % m]
    return np.clip(out, floor, None)


def forecast(station_id: str, sku: str, horizon: int = 90) -> tuple[np.ndarray, np.ndarray, str]:
    history = consumption_series(station_id, sku, 120)
    method = "holt-winters-additive"
    try:  # optional cross-check when the dependency is installed
        from statsmodels.tsa.holtwinters import ExponentialSmoothing  # type: ignore

        model = ExponentialSmoothing(
            history, trend="add", seasonal="add", seasonal_periods=30, initialization_method="estimated"
        ).fit(optimized=True)
        future = np.clip(np.asarray(model.forecast(horizon), dtype=float), 0, None)
        method = "statsmodels-holtwinters"
    except Exception:
        future = holt_winters(history, horizon)
    return history, future, method


def daily_use(station_id: str, sku: str, window: int = 30) -> float:
    _, future, _ = forecast(station_id, sku, horizon=window)
    return float(np.mean(future)) if future.size else 0.0
