from datetime import date

from fastapi.testclient import TestClient

from app.main import app
from app.validation import validate_periods
from tests.conftest import make_period

client = TestClient(app)


def _payload(periods, **extra):
    return {
        "symbol": "TEST.NS",
        "market": {"price": 240.0, "currency": "INR", "shares_outstanding": 10.0, "dividend_per_share": 6.0},
        "periods": [p.model_dump(mode="json") for p in periods],
        **extra,
    }


def test_health():
    assert client.get("/health").json()["status"] == "ok"


def test_analyze_end_to_end(healthy_periods):
    res = client.post("/v1/analyze", json=_payload(healthy_periods, as_of="2025-06-30"))
    assert res.status_code == 200
    body = res.json()
    assert body["key_metrics"]["pe_ratio"] == 20.0
    assert body["key_metrics"]["roe"] == 24.0
    assert body["key_metrics"]["revenue_growth"] == 20.0
    assert body["key_metrics"]["debt_to_equity"] == 0.5
    assert body["latest_annual_period"]["fiscal_year"] == 2025
    assert len(body["series"]) == 2
    assert body["quality"]["error_count"] == 0


def test_analyze_rejects_nan_and_extra_fields(healthy_periods):
    payload = _payload(healthy_periods)
    payload["market"]["price"] = "NaN"
    assert client.post("/v1/analyze", json=payload).status_code == 422
    payload = _payload(healthy_periods)
    payload["unexpected"] = 1
    assert client.post("/v1/analyze", json=payload).status_code == 422


def test_analyze_rejects_non_positive_price(healthy_periods):
    payload = _payload(healthy_periods)
    payload["market"]["price"] = 0
    assert client.post("/v1/analyze", json=payload).status_code == 422


def test_analyze_with_no_periods_returns_warnings():
    body = client.post("/v1/analyze", json=_payload([])).json()
    assert body["latest"] is None
    assert body["key_metrics"]["pe_ratio"] is None
    assert any("No annual statements" in w for w in body["warnings"])


def test_financial_sector_marks_industrial_ratios_not_meaningful(healthy_periods):
    body = client.post("/v1/analyze", json=_payload(healthy_periods, is_financial_sector=True)).json()
    assert body["latest"]["health"]["current_ratio"]["status"] == "not_meaningful"
    assert body["valuation"]["ev_ebitda"]["status"] == "not_meaningful"


def test_mixed_currency_periods_excluded(healthy_periods):
    usd = make_period(2023, income={"revenue": 5.0}, currency="USD")
    body = client.post("/v1/analyze", json=_payload([usd] + healthy_periods)).json()
    assert len(body["series"]) == 2
    assert any("currency" in w for w in body["warnings"])
    assert any(c["code"] == "mixed_currency" for c in body["quality"]["checks"])


def test_quarterly_not_mixed_into_annual_growth(healthy_periods):
    q = make_period(2025, period_type="quarterly", fiscal_period="Q4", income={"revenue": 300.0})
    body = client.post("/v1/analyze", json=_payload(healthy_periods + [q])).json()
    assert body["key_metrics"]["revenue_growth"] == 20.0
    assert len(body["quarterly"]) == 1


def test_batch_endpoint(healthy_periods):
    res = client.post("/v1/analyze/batch", json={"items": [_payload(healthy_periods), _payload([])]})
    assert res.status_code == 200 and len(res.json()["results"]) == 2


def test_statistics_endpoint():
    res = client.post("/v1/statistics", json={"metrics": {"pe": [{"symbol": "A", "value": 10}, {"symbol": "B", "value": 20},
                                                                  {"symbol": "C", "value": 30}]}})
    assert res.json()["statistics"]["pe"]["median"] == 20.0


def test_validation_balance_identity_and_duplicates():
    bad = make_period(2025, balance={"total_assets": 100.0, "total_liabilities": 50.0, "total_equity": 10.0})
    dup = make_period(2025, balance={"total_assets": 100.0, "total_liabilities": 60.0, "total_equity": 40.0})
    res = validate_periods([bad, dup], today=date(2025, 6, 1))
    codes = [c["code"] for c in res["checks"]]
    assert "balance_identity" in codes and "duplicate_period" in codes and "balance_identity_ok" in codes
    assert res["error_count"] == 1


def test_validation_gaps_future_and_stale():
    a = make_period(2020, income={"revenue": 1.0})
    b = make_period(2023, income={"revenue": 1.0})
    res = validate_periods([a, b], today=date(2025, 12, 1))
    msgs = {c["code"]: c for c in res["checks"]}
    assert "2021, 2022" in msgs["missing_annual_periods"]["message"]
    assert "stale_statements" in msgs
    future = validate_periods([make_period(2030)], today=date(2025, 1, 1))
    assert any(c["code"] == "future_period" for c in future["checks"])


def test_completeness_percentage(healthy_periods):
    res = validate_periods(healthy_periods, today=date(2025, 6, 1))
    assert 0 < res["completeness"]["overall_pct"] < 100
    assert res["completeness"]["by_statement"]["income"] is not None


def test_internal_secret_enforced(monkeypatch, healthy_periods):
    import app.main as main
    monkeypatch.setattr(main, "SERVICE_SECRET", "s3cret")
    assert client.post("/v1/analyze", json=_payload(healthy_periods)).status_code == 401
    ok = client.post("/v1/analyze", json=_payload(healthy_periods), headers={"X-Internal-Secret": "s3cret"})
    assert ok.status_code == 200
