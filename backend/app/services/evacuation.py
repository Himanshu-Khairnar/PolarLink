"""International-aware evacuation routing.

The transport network is a directed graph: every station, gateway hub, port and
partner station is a node; legs and cross-station transfer options are edges
carrying duration, weather gate probability and medical capability.
"""

from __future__ import annotations

import itertools
import math

import networkx as nx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.schemas import EvacRouteOut, WeatherGate

# Partner-station transfer options (COMNAP-style cooperation).
PARTNER_TRANSFERS = [
    ("st-maitri", "st-novo", "Snow traverse (Novo runway)", 4.0, 0.55, 4),
    ("st-novo", "st-maitri", "Snow traverse (Novo runway)", 4.0, 0.55, 3),
    ("st-bharati", "st-progress", "Helicopter", 1.2, 0.55, 4),
    ("st-bharati", "st-zhongshan", "Helicopter", 0.8, 0.55, 5),
    ("st-progress", "st-zhongshan", "Helicopter", 0.6, 0.6, 5),
    ("st-zhongshan", "st-progress", "Helicopter", 0.6, 0.6, 4),
    ("st-progress", "st-bharati", "Helicopter", 1.2, 0.55, 3),
    ("st-zhongshan", "st-bharati", "Helicopter", 0.8, 0.55, 3),
]


def _medical_capability(station: models.Station) -> int:
    score = 1
    if "Medical bay" in (station.facilities or []):
        score = 3
    elif "Medical room" in (station.facilities or []):
        score = 2
    if station.type in {"hub", "hq"}:
        score = max(score, 3)
    return score


def build_graph(db: Session) -> nx.DiGraph:
    g = nx.DiGraph()
    stations = {s.id: s for s in db.scalars(select(models.Station))}
    for s in stations.values():
        g.add_node(s.id, medical=_medical_capability(s), name=s.short_name)

    for leg in db.scalars(select(models.Leg)):
        if leg.from_station_id not in stations or leg.to_station_id not in stations:
            continue
        hours = max(1.0, (leg.planned_arrive - leg.planned_depart).total_seconds() / 3600)
        weather = 0.62 if "station" in (stations[leg.to_station_id].type,) else 0.9
        g.add_edge(
            leg.from_station_id,
            leg.to_station_id,
            mode=leg.mode,
            hours=hours,
            weather=weather,
            season=leg.season_only,
        )
        # The air/sea network is traversable both ways for an evacuation.
        g.add_edge(
            leg.to_station_id,
            leg.from_station_id,
            mode=f"{leg.mode} (return)",
            hours=hours,
            weather=weather,
            season=leg.season_only,
        )

    for frm, to, mode, hours, weather, cap in PARTNER_TRANSFERS:
        if frm in stations and to in stations:
            g.add_edge(frm, to, mode=mode, hours=hours, weather=weather, season=True, partner=True)
    return g


def _weather_ok(edges: list[dict]) -> float:
    """Probability that at least one gate on the route is open (OR-combined)."""
    blocked = 1.0
    for e in edges:
        blocked *= 1 - e["weather"]
    return 1 - blocked


def rank_evac_routes(db: Session, from_station: str, max_hops: int = 4) -> list[EvacRouteOut]:
    g = build_graph(db)
    if from_station not in g:
        return []

    station_objs = {s.id: s for s in db.scalars(select(models.Station))}
    weights = {"time": 1.0, "weather": 40.0, "transfers": 6.0, "medical": 8.0}
    routes: list[EvacRouteOut] = []

    nodes = list(g.nodes)
    for length in range(2, max_hops + 1):
        for dest in nodes:
            if dest == from_station:
                continue
            dest_station = station_objs.get(dest)
            if dest_station is None:
                continue
            capable = (
                "Medical bay" in (dest_station.facilities or [])
                or "Medical room" in (dest_station.facilities or [])
                or dest_station.type in {"hub", "hq", "foreign_station"}
            )
            if not capable:
                continue
            try:
                paths = nx.all_simple_paths(g, from_station, dest, cutoff=length)
            except nx.NodeNotFound:
                continue
            for path in itertools.islice(paths, 500):
                if len(path) < 2:
                    continue
                edge_data = [g[u][v] for u, v in zip(path, path[1:])]
                total_hours = sum(e["hours"] for e in edge_data)
                weather = _weather_ok(edge_data)
                transfers = len(path) - 2
                gap = 0 if dest_station.type == "hq" else 1 if dest_station.type == "hub" else 2
                score = (
                    weights["time"] * total_hours
                    + weights["weather"] * (1 - weather)
                    + weights["transfers"] * transfers
                    + weights["medical"] * gap
                )
                routes.append(
                    EvacRouteOut(
                        id=">".join(path),
                        label="  \u2192  ".join(g.nodes[n]["name"] for n in path),
                        hops=path,
                        total_hours=round(total_hours, 1),
                        weather_ok_prob=round(weather, 2),
                        transfers=transfers,
                        medical_gap=gap,
                        feasible=weather > 0.35,
                        score=round(score, 1),
                    )
                )

    # de-duplicate by hop tuple, keep best score
    best: dict[tuple, EvacRouteOut] = {}
    for r in routes:
        key = tuple(r.hops)
        if key not in best or r.score < best[key].score:
            best[key] = r
    return sorted(best.values(), key=lambda r: r.score)[:6]


def weather_gates(db: Session) -> list[WeatherGate]:
    g = build_graph(db)
    stations = {s.id: s for s in db.scalars(select(models.Station))}
    out: list[WeatherGate] = []
    for u, v, data in g.edges(data=True):
        out.append(
            WeatherGate(
                from_station=stations[u].short_name if u in stations else u,
                to_station=stations[v].short_name if v in stations else v,
                mode=str(data.get("mode", "")),
                weather_ok_prob=float(data.get("weather", 0.5)),
                season_ok=bool(data.get("season", True)),
            )
        )
    return out


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
