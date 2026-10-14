"""Profitability metrics: ROE, ROCE, gross / operating / net margin.

Definitions used (documented on the Methodology page):
  ROE  = Net income / Average shareholders' equity × 100
         (average of opening and closing equity; requires the previous
         consecutive fiscal year - otherwise "unavailable", never guessed)
  ROCE = EBIT / Capital employed × 100
         Capital employed = Total assets − Current liabilities (period end)
"""
from __future__ import annotations

from typing import Optional

from app.calculations.base import calculated, not_meaningful, ratio, unavailable
from app.schemas import Metric, Period


def gross_profit_of(period: Period) -> tuple[Optional[float], bool]:
    inc = period.income
    if not inc:
        return None, False
    if inc.gross_profit is not None:
        return inc.gross_profit, False
    if inc.revenue is not None and inc.cost_of_revenue is not None:
        return inc.revenue - inc.cost_of_revenue, True
    return None, False


def _margin(key: str, label: str, formula: str, numerator: Optional[float], period: Period, num_name: str) -> Metric:
    revenue = period.income.revenue if period.income else None
    return ratio(key, label, "percent", formula, numerator, revenue, num_name=num_name, den_name="revenue",
                 scale=100, period_end=period.period_end, non_positive_reason="Revenue is negative")


def gross_margin(period: Period, is_financial: bool = False) -> Metric:
    formula = "Gross profit / Revenue × 100"
    if is_financial:
        return not_meaningful("gross_margin", "Gross margin", "percent",
                              "Banks do not report cost of goods sold, so gross margin does not apply",
                              formula, period.period_end)
    gp, derived = gross_profit_of(period)
    m = _margin("gross_margin", "Gross margin", formula, gp, period, "gross_profit")
    if derived and m.status == "calculated":
        m.flags.append("gross_profit_derived_from_revenue_minus_cost")
    return m


def operating_margin(period: Period) -> Metric:
    op = period.income.operating_income if period.income else None
    return _margin("operating_margin", "Operating margin", "Operating profit / Revenue × 100", op, period, "operating_income")


def net_margin(period: Period) -> Metric:
    ni = period.income.net_income if period.income else None
    return _margin("net_margin", "Net profit margin", "Net income / Revenue × 100", ni, period, "net_income")


def roe(period: Period, previous: Optional[Period]) -> Metric:
    key, label, formula = "roe", "Return on equity", "Net income / Average shareholders' equity × 100"
    ni = period.income.net_income if period.income else None
    eq_close = period.balance.total_equity if period.balance else None
    if previous is None or previous.fiscal_year != period.fiscal_year - 1:
        return unavailable(key, label, "percent",
                           "Needs the previous consecutive fiscal year's equity to compute average equity",
                           formula, period.period_end)
    eq_open = previous.balance.total_equity if previous.balance else None
    if ni is None or eq_close is None or eq_open is None:
        return unavailable(key, label, "percent", "Missing net income or opening/closing equity", formula, period.period_end)
    if eq_open <= 0 or eq_close <= 0:
        # Averaging a negative and positive equity produces a misleading number.
        return not_meaningful(key, label, "percent", "Shareholders' equity is zero or negative", formula, period.period_end)
    return calculated(key, label, "percent", ni / ((eq_open + eq_close) / 2) * 100, formula, period.period_end)


def roce(period: Period, is_financial: bool = False) -> Metric:
    key, label = "roce", "Return on capital employed"
    formula = "EBIT / (Total assets − Current liabilities) × 100"
    if is_financial:
        return not_meaningful(key, label, "percent",
                              "Banks do not split current liabilities; ROCE is not used for banks", formula, period.period_end)
    ebit = period.income.operating_income if period.income else None
    bal = period.balance
    ta = bal.total_assets if bal else None
    cl = bal.current_liabilities if bal else None
    if ebit is None or ta is None or cl is None:
        return unavailable(key, label, "percent", "Missing EBIT, total assets or current liabilities", formula, period.period_end)
    return ratio(key, label, "percent", formula, ebit, ta - cl, num_name="ebit", den_name="capital_employed",
                 scale=100, period_end=period.period_end, non_positive_reason="Capital employed is negative")


def profitability_for_period(period: Period, previous: Optional[Period], is_financial: bool) -> dict[str, Metric]:
    return {
        "roe": roe(period, previous),
        "roce": roce(period, is_financial),
        "gross_margin": gross_margin(period, is_financial),
        "operating_margin": operating_margin(period),
        "net_margin": net_margin(period),
    }
