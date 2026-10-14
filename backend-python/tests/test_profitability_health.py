import pytest

from app.calculations.health import (current_ratio, debt_to_equity, free_cash_flow, interest_coverage, net_debt)
from app.calculations.profitability import gross_margin, net_margin, operating_margin, roce, roe
from tests.conftest import make_period


def test_roe_uses_average_equity(healthy_periods):
    prev, cur = healthy_periods
    m = roe(cur, prev)
    assert m.value == pytest.approx(120 / ((400 + 600) / 2) * 100)  # 24%


def test_roe_without_previous_period_is_unavailable(healthy_periods):
    assert roe(healthy_periods[0], None).status == "unavailable"


def test_roe_non_consecutive_previous_is_unavailable(healthy_periods):
    prev = make_period(2022, balance={"total_equity": 400.0})
    assert roe(healthy_periods[1], prev).status == "unavailable"


def test_roe_negative_equity_not_meaningful():
    prev = make_period(2024, balance={"total_equity": -100.0})
    cur = make_period(2025, income={"net_income": 50.0}, balance={"total_equity": 20.0})
    m = roe(cur, prev)
    assert m.status == "not_meaningful" and m.value is None


def test_roce(healthy_periods):
    # EBIT 240 / (1200 - 200) = 24%
    assert roce(healthy_periods[1]).value == pytest.approx(24.0)


def test_roce_not_meaningful_for_banks(healthy_periods):
    assert roce(healthy_periods[1], is_financial=True).status == "not_meaningful"


def test_margins(healthy_periods):
    p = healthy_periods[1]
    assert gross_margin(p).value == pytest.approx(500 / 1200 * 100)
    assert operating_margin(p).value == pytest.approx(20.0)
    assert net_margin(p).value == pytest.approx(10.0)


def test_gross_margin_derived_when_gross_profit_missing():
    p = make_period(2025, income={"revenue": 200.0, "cost_of_revenue": 150.0})
    m = gross_margin(p)
    assert m.value == pytest.approx(25.0)
    assert "gross_profit_derived_from_revenue_minus_cost" in m.flags


def test_margin_zero_revenue_not_meaningful():
    p = make_period(2025, income={"revenue": 0.0, "net_income": 10.0})
    assert net_margin(p).status == "not_meaningful"


def test_margin_null_revenue_is_unavailable_not_zero():
    p = make_period(2025, income={"revenue": None, "net_income": 10.0})
    m = net_margin(p)
    assert m.status == "unavailable" and m.value is None


def test_debt_to_equity(healthy_periods):
    assert debt_to_equity(healthy_periods[1], False).value == pytest.approx(0.5)


def test_debt_to_equity_negative_equity():
    p = make_period(2025, balance={"total_debt": 100.0, "total_equity": -10.0})
    assert debt_to_equity(p, False).status == "not_meaningful"


def test_debt_to_equity_zero_equity():
    p = make_period(2025, balance={"total_debt": 100.0, "total_equity": 0.0})
    m = debt_to_equity(p, False)
    assert m.status == "not_meaningful" and "zero" in m.reason


def test_current_ratio(healthy_periods):
    assert current_ratio(healthy_periods[1], False).value == pytest.approx(2.0)
    assert current_ratio(healthy_periods[1], True).status == "not_meaningful"


def test_current_ratio_zero_liabilities():
    p = make_period(2025, balance={"current_assets": 10.0, "current_liabilities": 0.0})
    assert current_ratio(p, False).status == "not_meaningful"


def test_interest_coverage(healthy_periods):
    assert interest_coverage(healthy_periods[1], False).value == pytest.approx(8.0)


def test_interest_coverage_handles_negative_sign_and_zero():
    p = make_period(2025, income={"operating_income": 100.0, "interest_expense": -25.0})
    assert interest_coverage(p, False).value == pytest.approx(4.0)
    p0 = make_period(2025, income={"operating_income": 100.0, "interest_expense": 0.0})
    assert interest_coverage(p0, False).status == "not_meaningful"


def test_interest_coverage_negative_ebit_flagged():
    p = make_period(2025, income={"operating_income": -50.0, "interest_expense": 25.0})
    m = interest_coverage(p, False)
    assert m.value == pytest.approx(-2.0)
    assert "negative_ebit" in m.flags


def test_net_debt_net_cash_flag():
    p = make_period(2025, balance={"total_debt": 10.0, "cash_and_equivalents": 50.0})
    m = net_debt(p)
    assert m.value == -40.0 and "net_cash_position" in m.flags


def test_free_cash_flow_normalizes_negative_capex(healthy_periods):
    m = free_cash_flow(healthy_periods[0])  # capex given as -60
    assert m.value == pytest.approx(150 - 60)
    assert "capex_sign_normalized" in m.flags


def test_free_cash_flow_positive_capex(healthy_periods):
    m = free_cash_flow(healthy_periods[1])  # capex given as +80
    assert m.value == pytest.approx(100.0)
    assert m.flags == []


def test_free_cash_flow_missing_capex_not_zero():
    p = make_period(2025, cashflow={"operating_cash_flow": 100.0, "capital_expenditure": None})
    m = free_cash_flow(p)
    assert m.status == "unavailable" and m.value is None
