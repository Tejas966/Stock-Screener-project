from datetime import date, timedelta

import pytest

from app.calculations.growth import cagr, growth_table, series_cagr, yoy_growth
from app.calculations.returns import price_returns
from app.calculations.statistics import describe
from app.schemas import PeerValue, PricePoint


def test_yoy_growth_basic():
    m = yoy_growth("revenue_growth", "Revenue growth", 1200.0, 1000.0, True)
    assert m.value == pytest.approx(20.0) and m.flags == []


def test_yoy_growth_negative_base_not_meaningful_with_turnaround_flag():
    m = yoy_growth("x", "x", 50.0, -20.0, True)
    assert m.status == "not_meaningful" and m.value is None
    assert "turnaround_loss_to_profit" in m.flags


def test_yoy_growth_zero_base():
    assert yoy_growth("x", "x", 50.0, 0.0, True).status == "not_meaningful"


def test_yoy_growth_extreme_flag():
    m = yoy_growth("x", "x", 350.0, 100.0, True)
    assert m.value == pytest.approx(250.0) and "extreme" in m.flags


def test_yoy_growth_turned_negative():
    m = yoy_growth("x", "x", -10.0, 100.0, True)
    assert m.value == pytest.approx(-110.0)
    assert "turned_negative" in m.flags and "extreme" in m.flags


def test_yoy_growth_gap_year_unavailable():
    assert yoy_growth("x", "x", 120.0, 100.0, False).status == "unavailable"


def test_growth_table_detects_gap_and_nulls():
    pts = [(2021, date(2021, 3, 31), 100.0), (2022, date(2022, 3, 31), 110.0),
           (2024, date(2024, 3, 31), 150.0), (2025, date(2025, 3, 31), None)]
    rows = growth_table(pts, "revenue")
    assert [r.status for r in rows] == ["unavailable", "calculated", "unavailable", "unavailable"]
    assert rows[1].value == pytest.approx(10.0)
    assert "missing" in rows[2].reason.lower()


def test_growth_table_unsorted_input():
    pts = [(2025, date(2025, 3, 31), 121.0), (2024, date(2024, 3, 31), 110.0)]
    rows = growth_table(pts, "revenue")
    assert rows[1].value == pytest.approx(10.0)


def test_cagr():
    assert cagr("k", "l", 100.0, 133.1, 3).value == pytest.approx(10.0, abs=1e-6)
    assert cagr("k", "l", -100.0, 133.1, 3).status == "not_meaningful"
    assert cagr("k", "l", None, 133.1, 3).status == "unavailable"


def test_series_cagr_requires_start_year():
    pts = [(2024, date(2024, 3, 31), 100.0), (2025, date(2025, 3, 31), 110.0)]
    assert series_cagr(pts, "revenue", 3).status == "unavailable"


def _prices(n_days: int, start_price: float = 100.0, daily: float = 0.001) -> list[PricePoint]:
    start = date(2020, 1, 1)
    return [PricePoint(date=start + timedelta(days=i), close=start_price * (1 + daily) ** i) for i in range(n_days)]


def test_price_returns_windows_and_unavailable_long_window():
    res = price_returns(_prices(400))
    assert res["windows"]["1M"]["status"] == "calculated"
    assert res["windows"]["1Y"]["status"] == "calculated"
    assert res["windows"]["5Y"]["status"] == "unavailable"
    assert res["return_type"] == "price_return_excluding_dividends"


def test_price_returns_exact_value():
    prices = [PricePoint(date=date(2024, 1, 1), close=100.0), PricePoint(date=date(2025, 1, 1), close=150.0)]
    res = price_returns(prices)
    assert res["windows"]["1Y"]["value"] == pytest.approx(50.0)
    assert res["max_drawdown_pct"] == pytest.approx(0.0)


def test_price_returns_drawdown():
    prices = [PricePoint(date=date(2024, 1, d), close=c) for d, c in [(1, 100.0), (2, 120.0), (3, 60.0), (4, 90.0)]]
    assert price_returns(prices)["max_drawdown_pct"] == pytest.approx(-50.0)


def test_price_returns_insufficient():
    res = price_returns([PricePoint(date=date(2024, 1, 1), close=100.0)])
    assert all(w["status"] == "unavailable" for w in res["windows"].values())


def test_describe_excludes_missing_and_warns_small_sample():
    res = describe([PeerValue(symbol="A", value=10.0), PeerValue(symbol="B", value=None),
                    PeerValue(symbol="C", value=30.0)])
    assert res["count"] == 2 and res["excluded_missing"] == 1
    assert res["median"] == pytest.approx(20.0)
    assert res["warnings"]


def test_describe_all_missing():
    res = describe([PeerValue(symbol="A", value=None)])
    assert res["median"] is None and res["count"] == 0


def test_describe_quartiles():
    res = describe([PeerValue(symbol=str(i), value=float(i)) for i in range(1, 6)])
    assert res["median"] == 3.0 and res["p25"] == 2.0 and res["p75"] == 4.0
    assert res["warnings"] == []
