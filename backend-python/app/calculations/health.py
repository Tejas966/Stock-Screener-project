"""Financial-health (solvency & liquidity) and cash-flow metrics."""
from __future__ import annotations

from typing import Optional

from app.calculations.base import EPSILON, calculated, not_meaningful, ratio, unavailable
from app.schemas import Metric, Period

BANK_NOTE = "For banks, deposits and borrowings are the raw material of the business; industrial leverage thresholds do not apply"


def debt_to_equity(period: Period, is_financial: bool) -> Metric:
    key, label, formula = "debt_to_equity", "Debt-to-equity", "Total debt / Shareholders' equity"
    bal = period.balance
    m = ratio(key, label, "ratio", formula, bal.total_debt if bal else None, bal.total_equity if bal else None,
              num_name="total_debt", den_name="total_equity", period_end=period.period_end,
              non_positive_reason="Shareholders' equity is negative (liabilities exceed assets)")
    if is_financial and m.status == "calculated":
        m.flags.append("financial_sector_interpret_with_care")
    return m


def current_ratio(period: Period, is_financial: bool) -> Metric:
    key, label, formula = "current_ratio", "Current ratio", "Current assets / Current liabilities"
    if is_financial:
        return not_meaningful(key, label, "ratio", "Banks do not present a current/non-current split", formula, period.period_end)
    bal = period.balance
    return ratio(key, label, "ratio", formula, bal.current_assets if bal else None,
                 bal.current_liabilities if bal else None, num_name="current_assets",
                 den_name="current_liabilities", period_end=period.period_end)


def interest_coverage(period: Period, is_financial: bool) -> Metric:
    key, label, formula = "interest_coverage", "Interest coverage", "EBIT / Interest expense"
    if is_financial:
        return not_meaningful(key, label, "multiple", "Interest paid on deposits is a bank's main cost; coverage is not used for banks",
                              formula, period.period_end)
    inc = period.income
    ebit = inc.operating_income if inc else None
    interest = inc.interest_expense if inc else None
    if ebit is None or interest is None:
        return unavailable(key, label, "multiple", "Missing EBIT or interest expense", formula, period.period_end)
    interest = abs(interest)  # providers differ on sign; coverage uses the magnitude
    if interest < EPSILON:
        return not_meaningful(key, label, "multiple", "No interest expense reported (effectively debt-free)", formula, period.period_end)
    m = calculated(key, label, "multiple", ebit / interest, formula, period.period_end)
    if ebit < 0:
        m.flags.append("negative_ebit")
    return m


def net_debt(period: Period) -> Metric:
    key, label, formula = "net_debt", "Net debt", "Total debt − Cash & equivalents"
    bal = period.balance
    debt = bal.total_debt if bal else None
    cash = bal.cash_and_equivalents if bal else None
    if debt is None or cash is None:
        return unavailable(key, label, "currency", "Missing total debt or cash", formula, period.period_end)
    m = calculated(key, label, "currency", debt - cash, formula, period.period_end)
    if debt - cash < 0:
        m.flags.append("net_cash_position")
    return m


def health_for_period(period: Period, is_financial: bool) -> dict[str, Metric]:
    return {
        "debt_to_equity": debt_to_equity(period, is_financial),
        "current_ratio": current_ratio(period, is_financial),
        "interest_coverage": interest_coverage(period, is_financial),
        "net_debt": net_debt(period),
    }


# --- cash flow ---------------------------------------------------------------

def capex_magnitude(period: Period) -> tuple[Optional[float], bool]:
    """Return (positive capex magnitude, sign_was_normalized)."""
    cf = period.cashflow
    if not cf or cf.capital_expenditure is None:
        return None, False
    capex = cf.capital_expenditure
    return (abs(capex), capex < 0)


def free_cash_flow(period: Period) -> Metric:
    key, label, formula = "free_cash_flow", "Free cash flow", "Operating cash flow − Capital expenditure"
    ocf = period.cashflow.operating_cash_flow if period.cashflow else None
    capex, normalized = capex_magnitude(period)
    if ocf is None or capex is None:
        return unavailable(key, label, "currency", "Missing operating cash flow or capital expenditure", formula, period.period_end)
    flags = ["capex_sign_normalized"] if normalized else []
    return calculated(key, label, "currency", ocf - capex, formula, period.period_end, flags)


def cashflow_for_period(period: Period) -> dict[str, Metric]:
    fcf = free_cash_flow(period)
    revenue = period.income.revenue if period.income else None
    ni = period.income.net_income if period.income else None
    ocf = period.cashflow.operating_cash_flow if period.cashflow else None
    return {
        "free_cash_flow": fcf,
        "fcf_margin": ratio("fcf_margin", "FCF margin", "percent", "Free cash flow / Revenue × 100",
                            fcf.value, revenue, num_name="free_cash_flow", den_name="revenue", scale=100,
                            period_end=period.period_end),
        "cash_conversion": ratio("cash_conversion", "Cash conversion", "ratio", "Operating cash flow / Net income",
                                 ocf, ni, num_name="operating_cash_flow", den_name="net_income",
                                 period_end=period.period_end,
                                 non_positive_reason="Net income is negative, so the ratio cannot be interpreted"),
    }
