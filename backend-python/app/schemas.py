"""Pydantic models for the financial-processing API.

All monetary amounts are ABSOLUTE values in the stated currency (Node.js
normalizes provider units such as "crore" before calling this service).
`None` always means "not reported" - it is never treated as zero.
"""
from __future__ import annotations

from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, FiniteFloat

Num = Optional[FiniteFloat]  # rejects NaN / +-Infinity at the API boundary


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class IncomeStatement(_Strict):
    revenue: Num = None
    cost_of_revenue: Num = None
    gross_profit: Num = None
    operating_expenses: Num = None
    ebitda: Num = None
    depreciation: Num = None
    operating_income: Num = None  # treated as EBIT
    interest_expense: Num = None  # positive magnitude
    profit_before_tax: Num = None
    income_tax: Num = None
    net_income: Num = None
    eps: Num = None  # per share, same currency


class BalanceSheet(_Strict):
    cash_and_equivalents: Num = None
    current_assets: Num = None
    non_current_assets: Num = None
    total_assets: Num = None
    current_liabilities: Num = None
    non_current_liabilities: Num = None
    total_liabilities: Num = None
    total_debt: Num = None
    total_equity: Num = None


class CashFlowStatement(_Strict):
    operating_cash_flow: Num = None
    investing_cash_flow: Num = None
    financing_cash_flow: Num = None
    # Convention: capital_expenditure is a POSITIVE magnitude of cash spent.
    # A negative number (the usual cash-flow-statement sign) is accepted and
    # converted with a warning so FCF is never computed with the wrong sign.
    capital_expenditure: Num = None
    dividends_paid: Num = None


class Period(_Strict):
    fiscal_year: int = Field(ge=1900, le=2200)
    fiscal_period: str = Field(default="FY", max_length=4)
    period_type: Literal["annual", "quarterly"]
    period_end: date
    currency: str = Field(min_length=3, max_length=3)
    income: Optional[IncomeStatement] = None
    balance: Optional[BalanceSheet] = None
    cashflow: Optional[CashFlowStatement] = None


class MarketSnapshot(_Strict):
    price: Optional[FiniteFloat] = Field(default=None, gt=0)
    currency: str = Field(default="INR", min_length=3, max_length=3)
    shares_outstanding: Optional[FiniteFloat] = Field(default=None, gt=0)
    market_cap: Optional[FiniteFloat] = Field(default=None, gt=0)  # provider-reported, optional
    dividend_per_share: Optional[FiniteFloat] = Field(default=None, ge=0)


class AnalysisRequest(_Strict):
    symbol: str = Field(min_length=1, max_length=32)
    sector: Optional[str] = Field(default=None, max_length=80)
    is_financial_sector: bool = False
    market: MarketSnapshot = MarketSnapshot()
    periods: list[Period] = Field(default_factory=list, max_length=60)
    as_of: Optional[date] = None  # reference date for staleness checks (defaults to today)


class BatchAnalysisRequest(_Strict):
    items: list[AnalysisRequest] = Field(min_length=1, max_length=200)


class GrowthPoint(_Strict):
    fiscal_year: int
    period_end: date
    value: Num = None


class GrowthRequest(_Strict):
    series: dict[str, list[GrowthPoint]] = Field(max_length=20)


class PricePoint(_Strict):
    date: date
    close: FiniteFloat = Field(gt=0)


class ReturnsRequest(_Strict):
    prices: list[PricePoint] = Field(max_length=10000)


class PeerValue(_Strict):
    symbol: str = Field(max_length=32)
    value: Num = None


class StatisticsRequest(_Strict):
    metrics: dict[str, list[PeerValue]] = Field(max_length=40)


# --- response building block ------------------------------------------------

MetricStatus = Literal["calculated", "reported", "unavailable", "not_meaningful"]


class Metric(BaseModel):
    key: str
    label: str
    value: Optional[float] = None
    unit: Literal["ratio", "percent", "currency", "multiple", "per_share"]
    status: MetricStatus
    reason: Optional[str] = None
    formula: Optional[str] = None
    period_end: Optional[date] = None
    flags: list[str] = Field(default_factory=list)
