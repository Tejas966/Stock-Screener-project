"""Combines all calculations into one deterministic analysis response."""
from __future__ import annotations

from typing import Optional

from app.calculations.growth import growth_table, series_cagr
from app.calculations.health import cashflow_for_period, health_for_period
from app.calculations.profitability import gross_margin, net_margin, operating_margin, profitability_for_period
from app.calculations.valuation import valuation_metrics
from app.schemas import AnalysisRequest, Metric, Period
from app.validation import validate_periods

ENGINE_VERSION = "1.0.0"

# Flat list used by the screener / comparison / sector statistics.
KEY_METRICS = [
    "market_cap", "pe_ratio", "pb_ratio", "ev_ebitda", "dividend_yield", "price_to_sales",
    "roe", "roce", "gross_margin", "operating_margin", "net_margin",
    "revenue_growth", "net_income_growth", "eps_growth",
    "debt_to_equity", "current_ratio", "interest_coverage", "free_cash_flow",
]


def _dump(metrics: dict[str, Metric]) -> dict[str, dict]:
    return {k: m.model_dump(mode="json") for k, m in metrics.items()}


def split_periods(periods: list[Period]) -> tuple[list[Period], list[Period], list[str]]:
    """Separate annual/quarterly periods and drop ones in a different currency."""
    warnings: list[str] = []
    annual = sorted([p for p in periods if p.period_type == "annual"], key=lambda p: p.period_end)
    quarterly = sorted([p for p in periods if p.period_type == "quarterly"], key=lambda p: p.period_end)
    base = annual[-1].currency.upper() if annual else (quarterly[-1].currency.upper() if quarterly else None)
    if base:
        dropped = [p for p in annual + quarterly if p.currency.upper() != base]
        if dropped:
            warnings.append(f"{len(dropped)} period(s) reported in a currency other than {base} were excluded")
        annual = [p for p in annual if p.currency.upper() == base]
        quarterly = [p for p in quarterly if p.currency.upper() == base]
    return annual, quarterly, warnings


def analyze(req: AnalysisRequest) -> dict:
    annual, quarterly, warnings = split_periods(req.periods)
    fin = req.is_financial_sector
    latest: Optional[Period] = annual[-1] if annual else None

    # Growth series (annual only - never mix quarterly into YoY growth).
    growth_inputs = {
        "revenue": [(p.fiscal_year, p.period_end, p.income.revenue if p.income else None) for p in annual],
        "net_income": [(p.fiscal_year, p.period_end, p.income.net_income if p.income else None) for p in annual],
        "eps": [(p.fiscal_year, p.period_end, p.income.eps if p.income else None) for p in annual],
    }
    growth_by_key = {k: growth_table(v, k) for k, v in growth_inputs.items()}

    series = []
    for i, p in enumerate(annual):
        prev = annual[i - 1] if i > 0 else None
        series.append({
            "fiscal_year": p.fiscal_year,
            "fiscal_period": p.fiscal_period,
            "period_end": str(p.period_end),
            "profitability": _dump(profitability_for_period(p, prev, fin)),
            "health": _dump(health_for_period(p, fin)),
            "cashflow": _dump(cashflow_for_period(p)),
            "growth": {f"{k}_growth": growth_by_key[k][i].model_dump(mode="json") for k in growth_by_key},
        })

    quarterly_series = [{
        "fiscal_year": q.fiscal_year, "fiscal_period": q.fiscal_period, "period_end": str(q.period_end),
        "margins": _dump({"gross_margin": gross_margin(q, fin), "operating_margin": operating_margin(q),
                          "net_margin": net_margin(q)}),
    } for q in quarterly]

    valuation = _dump(valuation_metrics(req.market, latest, fin))
    latest_block = series[-1] if series else None

    cagr = {}
    for key, pts in growth_inputs.items():
        for years in (3, 4):
            m = series_cagr(pts, key, years)
            cagr[m.key] = m.model_dump(mode="json")

    key_metrics: dict[str, Optional[float]] = {}
    for k in KEY_METRICS:
        m = valuation.get(k)
        if m is None and latest_block:
            for group in ("profitability", "health", "cashflow", "growth"):
                if k in latest_block[group]:
                    m = latest_block[group][k]
                    break
        key_metrics[k] = m["value"] if m else None

    if fin:
        warnings.append("Financial-sector company: several industrial ratios (current ratio, ROCE, EV/EBITDA, "
                        "gross margin, interest coverage) are marked not meaningful")
    if latest is None:
        warnings.append("No annual statements available; fundamental ratios cannot be calculated")
    if req.market.price is None:
        warnings.append("No price available; valuation multiples cannot be calculated")

    return {
        "symbol": req.symbol,
        "engine_version": ENGINE_VERSION,
        "currency": latest.currency if latest else req.market.currency,
        "latest_annual_period": ({"fiscal_year": latest.fiscal_year, "period_end": str(latest.period_end)}
                                 if latest else None),
        "valuation": valuation,
        "latest": latest_block,
        "series": series,
        "quarterly": quarterly_series,
        "cagr": cagr,
        "key_metrics": key_metrics,
        "quality": validate_periods(req.periods, req.as_of),
        "warnings": warnings,
    }
