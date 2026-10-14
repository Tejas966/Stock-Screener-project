"""FundamentalX financial-processing service (FastAPI).

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8001
Docs: http://127.0.0.1:8001/docs  (OpenAPI generated from the Pydantic schemas)

This service is internal: only the Node.js gateway calls it. It performs
deterministic arithmetic - it never calls an LLM or an external API.
"""
from __future__ import annotations

import hmac
import os

from fastapi import FastAPI, Header, HTTPException

from app.calculations.growth import growth_table, series_cagr
from app.calculations.returns import price_returns
from app.calculations.statistics import peer_statistics
from app.calculations.valuation import valuation_metrics
from app.processing import ENGINE_VERSION, analyze, split_periods
from app.schemas import (AnalysisRequest, BatchAnalysisRequest, GrowthRequest, ReturnsRequest,
                         StatisticsRequest)
from app.validation import validate_periods

app = FastAPI(title="FundamentalX Financial Processing", version=ENGINE_VERSION,
              description="Ratio, growth, validation and statistics engine for FundamentalX.")

# Optional shared secret. When PYTHON_SERVICE_SECRET is set, Node must send it.
SERVICE_SECRET = os.environ.get("PYTHON_SERVICE_SECRET", "")


def _authorize(x_internal_secret: str | None) -> None:
    if SERVICE_SECRET and not hmac.compare_digest(x_internal_secret or "", SERVICE_SECRET):
        raise HTTPException(status_code=401, detail="Invalid internal service credentials")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "fundamentalx-python", "engine_version": ENGINE_VERSION}


@app.post("/v1/analyze")
def analyze_one(req: AnalysisRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Combined analysis: valuation, profitability, growth, health, cash flow, quality."""
    _authorize(x_internal_secret)
    return analyze(req)


@app.post("/v1/analyze/batch")
def analyze_batch(req: BatchAnalysisRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Analysis for many companies (screener / comparison / sector pages)."""
    _authorize(x_internal_secret)
    return {"results": [analyze(item) for item in req.items]}


@app.post("/v1/ratios")
def ratios(req: AnalysisRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Valuation ratios only, based on the latest annual period."""
    _authorize(x_internal_secret)
    annual, _, warnings = split_periods(req.periods)
    metrics = valuation_metrics(req.market, annual[-1] if annual else None, req.is_financial_sector)
    return {"symbol": req.symbol, "valuation": {k: m.model_dump(mode="json") for k, m in metrics.items()},
            "warnings": warnings}


@app.post("/v1/growth")
def growth(req: GrowthRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Year-on-year growth and CAGR for arbitrary named series."""
    _authorize(x_internal_secret)
    out = {}
    for key, points in req.series.items():
        pts = [(p.fiscal_year, p.period_end, p.value) for p in points]
        out[key] = {
            "yoy": [m.model_dump(mode="json") for m in growth_table(pts, key)],
            "cagr_3y": series_cagr(pts, key, 3).model_dump(mode="json"),
        }
    return {"series": out}


@app.post("/v1/validate")
def validate(req: AnalysisRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Data-quality checks only."""
    _authorize(x_internal_secret)
    return validate_periods(req.periods, req.as_of)


@app.post("/v1/returns")
def returns(req: ReturnsRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Period price returns, volatility and drawdown from a close-price series."""
    _authorize(x_internal_secret)
    return price_returns(req.prices)


@app.post("/v1/statistics")
def statistics(req: StatisticsRequest, x_internal_secret: str | None = Header(default=None)) -> dict:
    """Peer-group descriptive statistics (median, quartiles, ...)."""
    _authorize(x_internal_secret)
    return {"statistics": peer_statistics(req.metrics)}
