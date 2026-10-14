"""Descriptive statistics for a peer group (sector analysis).

Missing values are EXCLUDED (and counted) rather than treated as zero.
With fewer than 3 observations the result carries a small-sample warning.
"""
from __future__ import annotations

import numpy as np

from app.schemas import PeerValue

MIN_PEERS_FOR_RELIABLE_STATS = 3


def describe(values: list[PeerValue]) -> dict:
    present = [v for v in values if v.value is not None]
    arr = np.array([v.value for v in present], dtype=float)
    result: dict = {
        "count": int(arr.size),
        "excluded_missing": len(values) - len(present),
        "included_symbols": [v.symbol for v in present],
        "median": None, "mean": None, "min": None, "max": None, "p25": None, "p75": None,
        "warnings": [],
    }
    if arr.size == 0:
        result["warnings"].append("No peers have this metric available")
        return result
    q25, med, q75 = np.percentile(arr, [25, 50, 75])
    result.update({
        "median": round(float(med), 4), "mean": round(float(arr.mean()), 4),
        "min": round(float(arr.min()), 4), "max": round(float(arr.max()), 4),
        "p25": round(float(q25), 4), "p75": round(float(q75), 4),
    })
    if arr.size < MIN_PEERS_FOR_RELIABLE_STATS:
        result["warnings"].append(f"Only {arr.size} peer(s) have data; statistics are not representative")
    return result


def peer_statistics(metrics: dict[str, list[PeerValue]]) -> dict[str, dict]:
    return {key: describe(vals) for key, vals in metrics.items()}
