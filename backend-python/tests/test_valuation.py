import pytest

from app.calculations.valuation import (dividend_yield, enterprise_value, ev_ebitda, market_cap, pb_ratio,
                                        pe_ratio, valuation_metrics)
from app.schemas import MarketSnapshot
from tests.conftest import make_period


def test_pe_ratio_basic(healthy_periods):
    m = pe_ratio(240.0, healthy_periods[-1])
    assert m.status == "calculated"
    assert m.value == pytest.approx(20.0)  # 240 / 12


def test_pe_ratio_negative_earnings_is_not_meaningful():
    p = make_period(2025, income={"eps": -3.0})
    m = pe_ratio(100.0, p)
    assert m.status == "not_meaningful"
    assert m.value is None
    assert "negative" in m.reason


def test_pe_ratio_zero_eps_is_not_meaningful():
    assert pe_ratio(100.0, make_period(2025, income={"eps": 0.0})).status == "not_meaningful"


def test_pe_ratio_missing_inputs_unavailable():
    assert pe_ratio(None, make_period(2025, income={"eps": 5.0})).status == "unavailable"
    assert pe_ratio(100.0, make_period(2025, income={})).status == "unavailable"
    assert pe_ratio(100.0, None).status == "unavailable"


def test_pb_ratio(healthy_periods):
    # BVPS = 600 / 10 = 60 ; P/B = 240 / 60 = 4
    assert pb_ratio(240.0, 10.0, healthy_periods[-1]).value == pytest.approx(4.0)


def test_pb_ratio_negative_equity():
    p = make_period(2025, balance={"total_equity": -50.0})
    m = pb_ratio(100.0, 10.0, p)
    assert m.status == "not_meaningful" and m.value is None


def test_market_cap_calculated_and_reported_fallback():
    assert market_cap(MarketSnapshot(price=10, shares_outstanding=5)).value == 50
    m = market_cap(MarketSnapshot(price=None, market_cap=999.0))
    assert m.status == "reported" and m.value == 999.0
    assert market_cap(MarketSnapshot()).status == "unavailable"


def test_enterprise_value_and_ev_ebitda(healthy_periods, market):
    mcap = market_cap(market)
    ev = enterprise_value(mcap, healthy_periods[-1], is_financial=False)
    assert ev.value == pytest.approx(2400 + 300 - 100)
    assert ev_ebitda(ev, healthy_periods[-1]).value == pytest.approx(2600 / 300, abs=1e-4)


def test_ev_ebitda_derived_from_ebit_plus_da(market):
    p = make_period(2025, income={"operating_income": 80.0, "depreciation": 20.0},
                    balance={"total_debt": 0.0, "cash_and_equivalents": 0.0})
    ev = enterprise_value(market_cap(market), p, is_financial=False)
    m = ev_ebitda(ev, p)
    assert m.value == pytest.approx(2400 / 100)
    assert "ebitda_derived_from_ebit_plus_da" in m.flags


def test_ev_ebitda_negative_ebitda(market):
    p = make_period(2025, income={"ebitda": -5.0}, balance={"total_debt": 0.0, "cash_and_equivalents": 0.0})
    ev = enterprise_value(market_cap(market), p, is_financial=False)
    assert ev_ebitda(ev, p).status == "not_meaningful"


def test_ev_not_meaningful_for_banks(healthy_periods, market):
    ev = enterprise_value(market_cap(market), healthy_periods[-1], is_financial=True)
    assert ev.status == "not_meaningful"
    assert ev_ebitda(ev, healthy_periods[-1]).status == "not_meaningful"


def test_dividend_yield(market):
    assert dividend_yield(market).value == pytest.approx(2.5)  # 6 / 240 * 100
    assert dividend_yield(MarketSnapshot(price=100)).status == "unavailable"


def test_currency_mismatch_blocks_valuation(healthy_periods):
    usd_market = MarketSnapshot(price=10.0, currency="USD", shares_outstanding=10.0)
    metrics = valuation_metrics(usd_market, healthy_periods[-1], False)
    assert all(m.status == "unavailable" for m in metrics.values())
    assert "Currency mismatch" in metrics["pe_ratio"].reason
