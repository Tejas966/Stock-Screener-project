"""Historical price-return statistics.

These are PRICE returns only - dividends are not reinvested, so they
understate total shareholder return for dividend-paying companies.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.schemas import PricePoint

WINDOWS = {"1M": 1, "6M": 6, "1Y": 12, "3Y": 36, "5Y": 60}
TRADING_DAYS = 252


def price_returns(prices: list[PricePoint]) -> dict:
    if len(prices) < 2:
        return {"windows": {k: {"value": None, "status": "unavailable", "reason": "Fewer than two price observations"}
                            for k in WINDOWS},
                "annualized_volatility_pct": None, "max_drawdown_pct": None, "observations": len(prices),
                "return_type": "price_return_excluding_dividends"}

    s = pd.Series([p.close for p in prices], index=pd.to_datetime([p.date for p in prices])).sort_index()
    s = s[~s.index.duplicated(keep="last")]
    last_date, last_close = s.index[-1], float(s.iloc[-1])

    windows: dict[str, dict] = {}
    for label, months in WINDOWS.items():
        target = last_date - pd.DateOffset(months=months)
        if target < s.index[0]:
            windows[label] = {"value": None, "status": "unavailable", "reason": "Not enough price history for this window"}
            continue
        # Last close ON OR BEFORE the target date (no look-ahead, no interpolation).
        start_close = float(s.asof(target))
        value = (last_close / start_close - 1) * 100
        entry = {"value": round(value, 4), "status": "calculated", "start_date": str(s.index[s.index <= target][-1].date())}
        if months >= 12:
            years = months / 12
            entry["annualized_pct"] = round(((last_close / start_close) ** (1 / years) - 1) * 100, 4)
        windows[label] = entry

    log_returns = np.diff(np.log(s.to_numpy()))
    vol = float(np.std(log_returns, ddof=1) * np.sqrt(TRADING_DAYS) * 100) if len(log_returns) > 1 else None
    running_max = s.cummax()
    max_dd = float(((s / running_max) - 1).min() * 100)

    return {
        "windows": windows,
        "annualized_volatility_pct": None if vol is None else round(vol, 4),
        "max_drawdown_pct": round(max_dd, 4),
        "observations": int(len(s)),
        "first_date": str(s.index[0].date()),
        "last_date": str(last_date.date()),
        "return_type": "price_return_excluding_dividends",
    }
