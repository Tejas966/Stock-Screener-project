"""Deterministic data-quality checks on normalized financial periods."""
from __future__ import annotations

from datetime import date
from typing import Optional

from app.schemas import BalanceSheet, CashFlowStatement, IncomeStatement, Period

TOLERANCE = 0.01  # 1% relative tolerance for accounting identities


def _check(code: str, severity: str, message: str, period: Optional[Period] = None) -> dict:
    return {"code": code, "severity": severity, "message": message,
            "period_end": str(period.period_end) if period else None}


def _close(a: float, b: float) -> bool:
    scale = max(abs(a), abs(b), 1.0)
    return abs(a - b) / scale <= TOLERANCE


def check_period(p: Period, today: date) -> list[dict]:
    out: list[dict] = []
    if p.period_end > today:
        out.append(_check("future_period", "warning", "Period end date is in the future", p))
    if p.period_type == "annual" and p.fiscal_period != "FY":
        out.append(_check("period_label_mismatch", "warning", "Annual period not labelled FY", p))

    inc, bal = p.income, p.balance
    if inc:
        if inc.revenue is not None and inc.revenue < 0:
            out.append(_check("negative_revenue", "error", "Revenue is negative", p))
        if inc.gross_profit is not None and inc.revenue is not None and inc.cost_of_revenue is not None:
            if not _close(inc.gross_profit, inc.revenue - inc.cost_of_revenue):
                out.append(_check("gross_profit_mismatch", "warning",
                                  "Gross profit does not equal revenue minus cost of revenue", p))
        if inc.net_income is not None and inc.revenue is not None and inc.revenue > 0 \
                and abs(inc.net_income) > 3 * inc.revenue:
            out.append(_check("implausible_net_income", "warning",
                              "Net income magnitude exceeds 3× revenue; check units or one-off items", p))
    if bal:
        if bal.total_assets is not None and bal.total_assets < 0:
            out.append(_check("negative_assets", "error", "Total assets are negative", p))
        if None not in (bal.total_assets, bal.total_liabilities, bal.total_equity):
            if not _close(bal.total_assets, bal.total_liabilities + bal.total_equity):  # type: ignore[operator]
                out.append(_check("balance_identity", "warning",
                                  "Total assets ≠ total liabilities + equity (beyond 1% tolerance)", p))
            else:
                out.append(_check("balance_identity_ok", "info", "Assets = Liabilities + Equity (within 1%)", p))
        if None not in (bal.total_assets, bal.current_assets, bal.non_current_assets):
            if not _close(bal.total_assets, bal.current_assets + bal.non_current_assets):  # type: ignore[operator]
                out.append(_check("asset_split_mismatch", "warning",
                                  "Current + non-current assets do not add up to total assets", p))
        if bal.total_equity is not None and bal.total_equity <= 0:
            out.append(_check("non_positive_equity", "warning",
                              "Shareholders' equity is zero or negative; equity-based ratios are not meaningful", p))
    return out


def completeness(periods: list[Period]) -> dict:
    """Share of expected line items that are present (non-null)."""
    expected = {
        "income": list(IncomeStatement.model_fields),
        "balance": list(BalanceSheet.model_fields),
        "cashflow": list(CashFlowStatement.model_fields),
    }
    totals = {k: [0, 0] for k in expected}  # present, expected
    for p in periods:
        if p.period_type != "annual":
            continue
        for stmt, fields in expected.items():
            obj = getattr(p, stmt)
            totals[stmt][1] += len(fields)
            if obj is not None:
                totals[stmt][0] += sum(1 for f in fields if getattr(obj, f) is not None)
    by_stmt = {k: (round(v[0] / v[1] * 100, 1) if v[1] else None) for k, v in totals.items()}
    present = sum(v[0] for v in totals.values())
    exp = sum(v[1] for v in totals.values())
    return {"overall_pct": round(present / exp * 100, 1) if exp else None, "by_statement": by_stmt}


def validate_periods(periods: list[Period], today: Optional[date] = None) -> dict:
    today = today or date.today()
    checks: list[dict] = []

    seen: set[tuple[str, date]] = set()
    for p in periods:
        if (p.period_type, p.period_end) in seen:
            checks.append(_check("duplicate_period", "error", f"Duplicate {p.period_type} period", p))
        seen.add((p.period_type, p.period_end))
        checks.extend(check_period(p, today))

    currencies = {p.currency.upper() for p in periods}
    if len(currencies) > 1:
        checks.append(_check("mixed_currency", "error",
                             f"Periods use different currencies ({', '.join(sorted(currencies))}); they are not combined"))

    annual_years = sorted({p.fiscal_year for p in periods if p.period_type == "annual"})
    gaps = [y for y in range(annual_years[0], annual_years[-1] + 1) if y not in annual_years] if annual_years else []
    if gaps:
        checks.append(_check("missing_annual_periods", "warning",
                             f"Missing fiscal year(s): {', '.join(map(str, gaps))}. Growth across gaps is not computed"))
    if not annual_years:
        checks.append(_check("no_annual_periods", "warning", "No annual statements available"))

    latest = max((p.period_end for p in periods), default=None)
    if latest is not None and (today - latest).days > 550:
        checks.append(_check("stale_statements", "warning",
                             f"Latest statement ends {latest}; data may be stale"))

    return {
        "checks": checks,
        "completeness": completeness(periods),
        "error_count": sum(1 for c in checks if c["severity"] == "error"),
        "warning_count": sum(1 for c in checks if c["severity"] == "warning"),
        "annual_fiscal_years": annual_years,
    }
