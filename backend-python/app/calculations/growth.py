"""Growth calculations (year-on-year and CAGR) using pandas.

Rules that prevent misleading percentages:
  * A growth rate needs BOTH values and the two periods must be consecutive
    fiscal years - a gap year is reported as "missing period".
  * If the base (previous) value is zero or negative, percentage growth is
    mathematically defined but meaningless (e.g. -10 -> +5 = "+150%"), so the
    result is "not_meaningful" and a turnaround flag is attached instead.
  * Growth above +/-100% is flagged `extreme` so the UI can warn the reader.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

import pandas as pd

from app.calculations.base import calculated, not_meaningful, unavailable
from app.schemas import Metric

EXTREME_GROWTH_PCT = 100.0

LABELS = {
    "revenue": "Revenue growth",
    "net_income": "Net profit growth",
    "eps": "EPS growth",
}


def yoy_growth(key: str, label: str, current: Optional[float], previous: Optional[float],
               consecutive: bool, period_end: Optional[date] = None) -> Metric:
    formula = "(Current − Previous) / Previous × 100"
    if not consecutive:
        return unavailable(key, label, "percent", "Previous fiscal year is missing (gap in reporting periods)",
                           formula, period_end)
    if current is None or previous is None:
        return unavailable(key, label, "percent", "Current or previous value not reported", formula, period_end)
    if previous <= 0:
        m = not_meaningful(key, label, "percent",
                           "Previous value is zero or negative, so a percentage change would be misleading",
                           formula, period_end)
        if previous < 0 < current:
            m.flags.append("turnaround_loss_to_profit")
        elif previous < 0 and current < 0:
            m.flags.append("loss_in_both_periods")
        return m
    value = (current - previous) / previous * 100
    flags = ["extreme"] if abs(value) > EXTREME_GROWTH_PCT else []
    if current < 0:
        flags.append("turned_negative")
    return calculated(key, label, "percent", value, formula, period_end, flags)


def cagr(key: str, label: str, start: Optional[float], end: Optional[float], years: int,
         period_end: Optional[date] = None) -> Metric:
    formula = f"(End / Start)^(1/{years}) − 1, × 100"
    if start is None or end is None:
        return unavailable(key, label, "percent", "Start or end value not reported", formula, period_end)
    if start <= 0 or end <= 0:
        return not_meaningful(key, label, "percent", "CAGR requires positive start and end values", formula, period_end)
    return calculated(key, label, "percent", ((end / start) ** (1 / years) - 1) * 100, formula, period_end)


def growth_table(points: list[tuple[int, date, Optional[float]]], key: str) -> list[Metric]:
    """Year-on-year growth for each period of one series.

    `points` = [(fiscal_year, period_end, value)], any order. The first period
    always reports "unavailable" since it has no predecessor.
    """
    label = LABELS.get(key, f"{key} growth")
    if not points:
        return []
    df = pd.DataFrame(points, columns=["fy", "end", "value"]).sort_values("fy").reset_index(drop=True)
    df["prev_value"] = df["value"].shift(1)
    df["prev_fy"] = df["fy"].shift(1)
    out: list[Metric] = []
    for row in df.itertuples(index=False):
        consecutive = not pd.isna(row.prev_fy) and int(row.prev_fy) == row.fy - 1
        cur = None if pd.isna(row.value) else float(row.value)
        prev = None if pd.isna(row.prev_value) else float(row.prev_value)
        out.append(yoy_growth(f"{key}_growth", label, cur, prev, consecutive, row.end))
    return out


def series_cagr(points: list[tuple[int, date, Optional[float]]], key: str, years: int) -> Metric:
    """CAGR over exactly `years` fiscal years ending at the latest period."""
    label = f"{LABELS.get(key, key).replace(' growth', '')} CAGR ({years}y)"
    mkey = f"{key}_cagr_{years}y"
    if not points:
        return unavailable(mkey, label, "percent", "No periods available")
    by_year = {fy: (end, v) for fy, end, v in points}
    last_fy = max(by_year)
    first_fy = last_fy - years
    if first_fy not in by_year:
        return unavailable(mkey, label, "percent", f"Needs fiscal year {first_fy}, which is not available",
                           period_end=by_year[last_fy][0])
    return cagr(mkey, label, by_year[first_fy][1], by_year[last_fy][1], years, by_year[last_fy][0])
