"""Valuation metrics: market cap, P/E, P/B, EV, EV/EBITDA, dividend yield, P/S.

Valuation combines a MARKET price with a REPORTING-PERIOD statement, so the
price currency must match the statement currency.
"""
from __future__ import annotations

from typing import Optional

from app.calculations.base import EPSILON, calculated, not_meaningful, ratio, unavailable
from app.schemas import MarketSnapshot, Metric, Period


def market_cap(market: MarketSnapshot) -> Metric:
    key, label, formula = "market_cap", "Market capitalisation", "Price per share × Shares outstanding"
    if market.price is not None and market.shares_outstanding is not None:
        return calculated(key, label, "currency", market.price * market.shares_outstanding, formula)
    if market.market_cap is not None:
        m = Metric(key=key, label=label, unit="currency", status="reported", value=round(market.market_cap, 2),
                   formula="Reported by data provider")
        return m
    return unavailable(key, label, "currency", "Price or shares outstanding not available", formula)


def pe_ratio(price: Optional[float], period: Optional[Period]) -> Metric:
    key, label, formula = "pe_ratio", "P/E ratio", "Price per share / Earnings per share"
    eps = period.income.eps if period and period.income else None
    end = period.period_end if period else None
    if price is None or eps is None:
        return unavailable(key, label, "multiple", "Price or EPS not available", formula, end)
    if eps <= 0:
        # A negative P/E has no useful interpretation; report it as not meaningful.
        return not_meaningful(key, label, "multiple", "EPS is zero or negative (loss-making period)", formula, end)
    return calculated(key, label, "multiple", price / eps, formula, end)


def pb_ratio(price: Optional[float], shares: Optional[float], period: Optional[Period]) -> Metric:
    key, label, formula = "pb_ratio", "Price-to-book ratio", "Price per share / (Shareholders' equity / Shares outstanding)"
    equity = period.balance.total_equity if period and period.balance else None
    end = period.period_end if period else None
    if price is None or shares is None or equity is None:
        return unavailable(key, label, "multiple", "Price, shares or equity not available", formula, end)
    if equity <= 0:
        return not_meaningful(key, label, "multiple", "Shareholders' equity is zero or negative", formula, end)
    return calculated(key, label, "multiple", price / (equity / shares), formula, end)


def book_value_per_share(shares: Optional[float], period: Optional[Period]) -> Metric:
    equity = period.balance.total_equity if period and period.balance else None
    return ratio("book_value_per_share", "Book value per share", "per_share",
                 "Shareholders' equity / Shares outstanding", equity, shares,
                 num_name="total_equity", den_name="shares_outstanding",
                 period_end=period.period_end if period else None)


def enterprise_value(mcap: Metric, period: Optional[Period], is_financial: bool) -> Metric:
    key, label, formula = "enterprise_value", "Enterprise value", "Market cap + Total debt − Cash & equivalents"
    end = period.period_end if period else None
    if is_financial:
        return not_meaningful(key, label, "currency",
                              "For banks, debt is operating funding, so EV is not a meaningful measure", formula, end)
    bal = period.balance if period else None
    debt = bal.total_debt if bal else None
    cash = bal.cash_and_equivalents if bal else None
    if mcap.value is None or debt is None or cash is None:
        return unavailable(key, label, "currency", "Market cap, total debt or cash not available", formula, end)
    return calculated(key, label, "currency", mcap.value + debt - cash, formula, end)


def resolve_ebitda(period: Optional[Period]) -> tuple[Optional[float], bool]:
    """Return (EBITDA, derived?) - falls back to EBIT + D&A when not reported."""
    if not period or not period.income:
        return None, False
    inc = period.income
    if inc.ebitda is not None:
        return inc.ebitda, False
    if inc.operating_income is not None and inc.depreciation is not None:
        return inc.operating_income + inc.depreciation, True
    return None, False


def ev_ebitda(ev: Metric, period: Optional[Period]) -> Metric:
    key, label, formula = "ev_ebitda", "EV/EBITDA", "Enterprise value / EBITDA"
    end = period.period_end if period else None
    if ev.status == "not_meaningful":
        return not_meaningful(key, label, "multiple", ev.reason or "EV not meaningful", formula, end)
    ebitda, derived = resolve_ebitda(period)
    if ev.value is None or ebitda is None:
        return unavailable(key, label, "multiple", "Enterprise value or EBITDA not available", formula, end)
    if ebitda <= EPSILON:
        return not_meaningful(key, label, "multiple", "EBITDA is zero or negative", formula, end)
    flags = ["ebitda_derived_from_ebit_plus_da"] if derived else []
    return calculated(key, label, "multiple", ev.value / ebitda, formula, end, flags)


def dividend_yield(market: MarketSnapshot) -> Metric:
    return ratio("dividend_yield", "Dividend yield", "percent",
                 "Annual dividend per share / Price per share × 100",
                 market.dividend_per_share, market.price,
                 num_name="dividend_per_share", den_name="price", scale=100)


def price_to_sales(mcap: Metric, period: Optional[Period]) -> Metric:
    revenue = period.income.revenue if period and period.income else None
    return ratio("price_to_sales", "Price-to-sales", "multiple", "Market cap / Revenue",
                 mcap.value, revenue, num_name="market_cap", den_name="revenue",
                 period_end=period.period_end if period else None,
                 non_positive_reason="Revenue is negative")


def valuation_metrics(market: MarketSnapshot, latest_annual: Optional[Period], is_financial: bool) -> dict[str, Metric]:
    """All valuation metrics, using the latest annual period as the fundamental base."""
    if latest_annual and latest_annual.currency.upper() != market.currency.upper():
        reason = (f"Currency mismatch: price in {market.currency}, statements in "
                  f"{latest_annual.currency}. Conversion is not performed.")
        keys = [("market_cap", "Market capitalisation", "currency"), ("pe_ratio", "P/E ratio", "multiple"),
                ("pb_ratio", "Price-to-book ratio", "multiple"), ("book_value_per_share", "Book value per share", "per_share"),
                ("enterprise_value", "Enterprise value", "currency"), ("ev_ebitda", "EV/EBITDA", "multiple"),
                ("dividend_yield", "Dividend yield", "percent"), ("price_to_sales", "Price-to-sales", "multiple")]
        return {k: unavailable(k, label, unit, reason) for k, label, unit in keys}

    mcap = market_cap(market)
    ev = enterprise_value(mcap, latest_annual, is_financial)
    return {
        "market_cap": mcap,
        "pe_ratio": pe_ratio(market.price, latest_annual),
        "pb_ratio": pb_ratio(market.price, market.shares_outstanding, latest_annual),
        "book_value_per_share": book_value_per_share(market.shares_outstanding, latest_annual),
        "enterprise_value": ev,
        "ev_ebitda": ev_ebitda(ev, latest_annual),
        "dividend_yield": dividend_yield(market),
        "price_to_sales": price_to_sales(mcap, latest_annual),
    }
