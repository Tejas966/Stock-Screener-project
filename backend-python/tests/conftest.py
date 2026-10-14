from datetime import date

import pytest

from app.schemas import BalanceSheet, CashFlowStatement, IncomeStatement, MarketSnapshot, Period


def make_period(fy: int, *, income: dict | None = None, balance: dict | None = None,
                cashflow: dict | None = None, period_type: str = "annual", currency: str = "INR",
                fiscal_period: str = "FY", end: date | None = None) -> Period:
    return Period(
        fiscal_year=fy, fiscal_period=fiscal_period, period_type=period_type,
        period_end=end or date(fy, 3, 31), currency=currency,
        income=IncomeStatement(**income) if income is not None else None,
        balance=BalanceSheet(**balance) if balance is not None else None,
        cashflow=CashFlowStatement(**cashflow) if cashflow is not None else None,
    )


@pytest.fixture
def healthy_periods() -> list[Period]:
    """Two clean consecutive years with round numbers that are easy to verify by hand."""
    p2024 = make_period(2024,
                        income={"revenue": 1000.0, "cost_of_revenue": 600.0, "gross_profit": 400.0,
                                "operating_income": 200.0, "ebitda": 250.0, "depreciation": 50.0,
                                "interest_expense": 20.0, "net_income": 100.0, "eps": 10.0},
                        balance={"cash_and_equivalents": 50.0, "current_assets": 300.0, "non_current_assets": 700.0,
                                 "total_assets": 1000.0, "current_liabilities": 200.0, "total_liabilities": 600.0,
                                 "total_debt": 200.0, "total_equity": 400.0},
                        cashflow={"operating_cash_flow": 150.0, "capital_expenditure": -60.0})
    p2025 = make_period(2025,
                        income={"revenue": 1200.0, "cost_of_revenue": 700.0, "gross_profit": 500.0,
                                "operating_income": 240.0, "ebitda": 300.0, "depreciation": 60.0,
                                "interest_expense": 30.0, "net_income": 120.0, "eps": 12.0},
                        balance={"cash_and_equivalents": 100.0, "current_assets": 400.0, "non_current_assets": 800.0,
                                 "total_assets": 1200.0, "current_liabilities": 200.0, "total_liabilities": 600.0,
                                 "total_debt": 300.0, "total_equity": 600.0},
                        cashflow={"operating_cash_flow": 180.0, "capital_expenditure": 80.0})
    return [p2024, p2025]


@pytest.fixture
def market() -> MarketSnapshot:
    # 10 shares at 240 -> market cap 2400
    return MarketSnapshot(price=240.0, currency="INR", shares_outstanding=10.0, dividend_per_share=6.0)
