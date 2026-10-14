"""Shared helpers for building Metric results.

Every calculation goes through `ratio()` so the rules for missing inputs and
zero denominators are applied identically everywhere.
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from app.schemas import Metric

# Denominators smaller than this (in absolute terms) are treated as zero.
# Financial figures are absolute currency amounts, so 1e-9 is effectively 0.
EPSILON = 1e-9


def unavailable(key: str, label: str, unit: str, reason: str, formula: str | None = None,
                period_end: Optional[date] = None) -> Metric:
    return Metric(key=key, label=label, unit=unit, status="unavailable", reason=reason,
                  formula=formula, period_end=period_end)


def not_meaningful(key: str, label: str, unit: str, reason: str, formula: str | None = None,
                   period_end: Optional[date] = None) -> Metric:
    return Metric(key=key, label=label, unit=unit, status="not_meaningful", reason=reason,
                  formula=formula, period_end=period_end)


def calculated(key: str, label: str, unit: str, value: float, formula: str,
               period_end: Optional[date] = None, flags: list[str] | None = None) -> Metric:
    return Metric(key=key, label=label, unit=unit, status="calculated", value=round_metric(value, unit),
                  formula=formula, period_end=period_end, flags=flags or [])


def round_metric(value: float, unit: str) -> float:
    """Sensible precision: money to 2 dp, ratios/percentages to 4 dp (UI rounds further)."""
    return round(value, 2) if unit == "currency" else round(value, 4)


def missing_names(**inputs: Optional[float]) -> list[str]:
    return [name for name, v in inputs.items() if v is None]


def ratio(key: str, label: str, unit: str, formula: str, numerator: Optional[float],
          denominator: Optional[float], *, num_name: str, den_name: str,
          scale: float = 1.0, period_end: Optional[date] = None,
          require_positive_denominator: bool = True,
          non_positive_reason: str | None = None) -> Metric:
    """numerator / denominator * scale with explicit handling of bad inputs.

    - Any missing input  -> "unavailable" (we never substitute 0)
    - |denominator| ~ 0  -> "not_meaningful" (division by zero)
    - denominator < 0 when a positive base is required -> "not_meaningful"
    """
    missing = missing_names(**{num_name: numerator, den_name: denominator})
    if missing:
        return unavailable(key, label, unit, f"Missing input: {', '.join(missing)}", formula, period_end)
    if abs(denominator) < EPSILON:  # type: ignore[arg-type]
        return not_meaningful(key, label, unit, f"{den_name} is zero, so the ratio is undefined", formula, period_end)
    if require_positive_denominator and denominator < 0:  # type: ignore[operator]
        return not_meaningful(key, label, unit, non_positive_reason or f"{den_name} is negative", formula, period_end)
    return calculated(key, label, unit, numerator / denominator * scale, formula, period_end)  # type: ignore[operator]
