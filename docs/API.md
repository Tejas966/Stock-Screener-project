# FundamentalX REST API

The browser talks **only** to the Node.js gateway. In development it is proxied at `http://localhost:5173/api`; the gateway itself runs on `http://127.0.0.1:4000/api`. The PHP and Python services are internal; they are listed at the end for completeness.

## Conventions

- **JSON in, JSON out.** Request bodies require `Content-Type: application/json` and are limited to 32 KB.
- **Success:** `{ "data": ... }`. `204 No Content` for deletions.
- **Error:** `{ "error": { "code": "MACHINE_CODE", "message": "Human readable", "details": { "field": "message" } } }`. `details` appears only on validation errors.
- **Authentication:** an httpOnly cookie `fx_session` set by `/api/auth/login` or `/api/auth/register`. 🔒 marks routes that require it; without it they return `401 UNAUTHENTICATED`.
- **Symbols:** provider format `TICKER.NS` (NSE) or `CODE.BO` (BSE), for example `TCS.NS`, `532540.BO`, `M%26M.NS`.
- **Amounts:** absolute currency units (rupees). The UI converts them to crore or lakh.
- **Metric object** (from the Python engine):

  ```json
  { "key": "pe_ratio", "label": "P/E ratio", "value": 26.1245, "unit": "multiple",
    "status": "calculated", "reason": null, "formula": "Price per share / Earnings per share",
    "period_end": "2025-03-31", "flags": [] }
  ```

  `status` is one of `calculated`, `reported`, `unavailable` or `not_meaningful`. `unit` is one of `ratio`, `percent`, `currency`, `multiple` or `per_share`.
- **Data metadata (`meta`):**

  ```json
  { "source": "demo", "source_label": "...", "is_demo": true,
    "cache_status": "fresh|cached|stale", "retrieved_at": "ISO", "delayed": true }
  ```

### Common status codes

| Code | Meaning |
|---|---|
| 400 | Invalid id, symbol or JSON |
| 401 | Not logged in |
| 403 | Origin not allowed |
| 404 | Resource not found, or not yours |
| 409 | Conflict (duplicate, limit) |
| 413 | Body too large |
| 415 | Body is not JSON |
| 422 | Validation failed |
| 429 | Rate limited |
| 502 | Upstream returned an invalid response |
| 503 | Dependent service unavailable or not configured |
| 504 | Upstream timeout |

---

## Meta

| Method | Path | Description |
|---|---|---|
| GET | `/api/meta` | `{ app, provider: { name, label, is_demo, demo_as_of }, ai: { configured, model }, supported_exchanges }` |
| GET | `/api/health` | `{ status: "ok" \| "degraded", services: { node, mysql, python, php } }`. Returns 503 when degraded. |

## Authentication and profile

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/api/auth/register` | `{ name (2–100), email, password (8–128, letter + digit), password_confirmation }` | `201 { data: user }` and sets the cookie. `409 EMAIL_TAKEN`; `422` with details. |
| POST | `/api/auth/login` | `{ email, password }` | `200 { data: user }` and sets the cookie. `401 INVALID_CREDENTIALS`; `429 TOO_MANY_ATTEMPTS`. |
| POST | `/api/auth/logout` | – | `204`. Deletes the server-side session. |
| GET | `/api/auth/me` | – | `{ data: user }` or `{ data: null }` when anonymous. |
| PUT 🔒 | `/api/users/me` | `{ name?, preferred_period?: annual\|quarterly, preferred_unit?: crore\|lakh }` | `{ data: user }` |
| PUT 🔒 | `/api/users/me/password` | `{ current_password, new_password }` | `204`. Other sessions are revoked. |

`user` is `{ id, name, email, preferred_period, preferred_unit, created_at }`.

## Companies

| Method | Path | Description |
|---|---|---|
| GET | `/api/companies/search?q=<1–60 chars>&record=0\|1` | Searches the supported universe. Returns `{ query, results: [company], groups: [{ name, isin, sector, industry, listings: [{ symbol, ticker, exchange }] }], exact_match, ambiguous }`. For logged-in users, `record=1` (the default) saves the search in history. Allowed characters: letters, digits, space, `. & ' ( ) -`. |
| GET | `/api/companies` | One primary listing per company. |
| GET | `/api/companies/featured` | Featured companies for the home page. |
| GET | `/api/companies/:symbol` | `{ company, listings, quote, quote_error }` |
| GET | `/api/companies/:symbol/fundamentals` | The full bundle (see below). |
| GET | `/api/companies/:symbol/statements?type=income\|balance\|cashflow&period=annual\|quarterly` | `{ company, period, type, unit: "absolute", periods: [...], meta }` |
| GET | `/api/companies/:symbol/history?range=1M\|6M\|1Y\|3Y\|5Y` | `{ prices: [{ date, close, volume }], available: { from, to }, returns, returns_error, meta }`. `returns` comes from Python `/v1/returns` and is a price return excluding dividends. |

`company` is `{ id, name, symbol, ticker, exchange, isin, industry, currency, featured, sector: { name, slug } }`.

**Fundamentals bundle**

```json
{
  "company": { ... },
  "provider": { "name": "demo", "is_demo": true, "label": "..." },
  "quote": { "price": 3450, "currency": "INR", "change_pct": 0.75, "shares_outstanding": 3620000000,
             "market_cap": null, "dividend_per_share": 120, "observed_at": "2025-06-30T10:00:00.000Z", "meta": { ... } },
  "quote_error": null,
  "statements": { "periods": [ { "fiscal_year": 2025, "fiscal_period": "FY", "period_type": "annual",
                   "period_end": "2025-03-31", "currency": "INR",
                   "income": { "revenue": ..., "eps": ... }, "balance": { ... }, "cashflow": { "capital_expenditure": 1.2e11, ... } } ],
                  "unit": "absolute", "currency": "INR", "meta": { ... } },
  "statements_error": null,
  "analysis": {
    "valuation": { "pe_ratio": Metric, ... },
    "latest": { "profitability": {...}, "health": {...}, "cashflow": {...}, "growth": {...} },
    "series": [ ...per fiscal year... ],
    "quarterly": [ ... ],
    "cagr": { ... },
    "key_metrics": { "pe_ratio": 26.12, ... },
    "quality": { "checks": [...], "completeness": {...} },
    "warnings": [...]
  },
  "analysis_error": null
}
```

The bundle tolerates partial failure. If the quote fails, `quote` is `null` and `quote_error` is set. If Python is down, `analysis` is `null` and `analysis_error` is `{ code: "ANALYSIS_SERVICE_UNAVAILABLE", ... }`. The response is an error only when **both** the quote and the statements fail.

## Analysis and AI

| Method | Path | Description |
|---|---|---|
| POST | `/api/analysis/:symbol` | Re-runs the deterministic analysis: `{ company, analysis, provider }`. |
| POST 🔒 | `/api/analysis/:symbol/explanation` | Gemini explanation. Rate limited per user (`AI_RATE_LIMIT_PER_HOUR`). |

**Explanation response**

```json
{ "explanation": { "executive_summary": "...", "positive_observations": [...], "risk_factors": [...],
    "metric_explanations": [{ "metric": "...", "explanation": "..." }], "data_limitations": [...], "overall_caveat": "..." },
  "model": "gemini-2.5-flash", "cached": false, "generated_at": "ISO", "ungrounded_numbers": [],
  "fact_sheet_hash": "sha256", "symbol": "TCS.NS", "is_demo_data": true, "disclaimer": "..." }
```

**Explanation errors**

| Status | Codes |
|---|---|
| 503 | `AI_NOT_CONFIGURED`, `AI_QUOTA_EXCEEDED`, `AI_NOT_AUTHORIZED` |
| 504 | `AI_TIMEOUT` |
| 502 | `AI_INVALID_RESPONSE`, `AI_NO_RESPONSE`, `AI_REQUEST_REJECTED` |
| 409 | `ANALYSIS_REQUIRED` |
| 429 | `AI_RATE_LIMITED` |

## Screener, comparison, sectors, market

| Method | Path | Description |
|---|---|---|
| GET | `/api/screener/filters` | `{ fields: [{ key, label, unit, group }], sectors, sortable_extra }`. The field list comes from `shared/screener-fields.json`. |
| POST | `/api/screener/run` | Runs the screen; see below. |
| POST | `/api/compare` | `{ symbols: [2–5 unique symbols] }` → `{ companies: [row + trend + meta], failed, warnings, provider }` |
| GET | `/api/sectors` | `[{ id, name, slug, description, company_count, companies: [{ name, symbol }] }]` |
| GET | `/api/sectors/:slug` | `{ sector, peer_group, peer_count, rows, statistics: { metric: { count, excluded_missing, median, mean, min, max, p25, p75, warnings } }, statistics_error, unavailable, provider }` |
| GET | `/api/market/overview` | `{ indices: [{ symbol, name, last, as_of, change_pct, change_1y_pct, history }], universe: { company_count, advancers, decliners, top_gainers, top_losers, largest, sector_counts, statistics }, data_meta, provider, generated_at }` |

**Screener request**

```json
{ "criteria": { "filters": { "roe": { "min": 15, "max": null }, "debt_to_equity": { "max": 0.5 } },
                "sector": "information-technology", "sort": { "field": "roe", "direction": "desc" } },
  "page": 1, "page_size": 20 }
```

Filter keys:

- **Size and valuation:** `market_cap_cr` (in crore), `pe_ratio`, `pb_ratio`, `ev_ebitda`, `dividend_yield`
- **Profitability:** `roe`, `roce`, `operating_margin`, `net_margin`
- **Growth:** `revenue_growth`, `net_income_growth`, `eps_growth`
- **Health:** `debt_to_equity`, `current_ratio`, `interest_coverage`

The sort field is any filter key or `company_name`.

**Screener response**

`{ results: [row], total, page, pages, page_size, universe_size, considered, excluded_missing_data, criteria, unavailable, provider, generated_at }`

A `row` is `{ company, price, change_pct, quote_observed_at, latest_period, metrics: { key: value|null }, statuses: { key: { status, reason, flags } }, data_meta }`.

A company that lacks a filtered metric is **excluded** and counted in `excluded_missing_data`. Missing values always sort last.

## User data owned by Node 🔒

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/watchlist` | – | `{ items: [{ id, added_at, company, row, error }], max_items: 50 }` |
| POST | `/api/watchlist` | `{ symbol }` | `201 { id, company }`. `409 ALREADY_IN_WATCHLIST` or `WATCHLIST_FULL`; `404` for an unknown symbol. |
| DELETE | `/api/watchlist/:itemId` | – | `204`, or `404` if the item isn't yours. |
| GET | `/api/history` | – | `{ items: [{ id, query, searched_at, symbol, company_name, exchange }] }` (latest 100) |
| POST | `/api/history` | `{ query, symbol? }` | `201`. Records the listing chosen for a query. |
| DELETE | `/api/history` | – | `{ deleted: n }` |
| DELETE | `/api/history/:id` | – | `204` |

## User data owned by PHP (via the gateway) 🔒

Node validates the body with zod, then forwards it with `X-Internal-Secret` and `X-User-Id` (taken from the session). PHP validates again.

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/api/saved-screens` | – | `{ items: [screen] }` |
| POST | `/api/saved-screens` | `{ name (1–80), description? (≤ 300), criteria }` | `201 screen`. `409 DUPLICATE_NAME` or `LIMIT_REACHED` (50). |
| GET | `/api/saved-screens/:id` | – | `screen`, or `404` |
| PUT | `/api/saved-screens/:id` | any of `{ name, description, criteria }` | `screen` |
| DELETE | `/api/saved-screens/:id` | – | `204` |
| GET | `/api/research-notes?company=SYM&limit=1–100&offset=` | – | `{ items: [note], total, limit, offset }` |
| POST | `/api/research-notes` | `{ title (1–150), content (1–10 000), company_symbol? }` | `201 note`. `422` for an unknown company. |
| GET | `/api/research-notes/:id` | – | `note` |
| PUT | `/api/research-notes/:id` | any of `{ title, content, company_symbol }`; `null` unlinks the company | `note` |
| DELETE | `/api/research-notes/:id` | – | `204` |

- `screen` is `{ id, name, description, criteria, created_at, updated_at }`.
- `note` is `{ id, title, content, company_id, company_symbol, company_name, created_at, updated_at }`.
- All timestamps are ISO-8601 in UTC.
- If PHP is unreachable, the gateway returns `503 PERSISTENCE_SERVICE_UNAVAILABLE`.

---

## Internal: PHP persistence service (`127.0.0.1:8002`)

Every `/internal/*` request needs the `X-Internal-Secret` header (equal to `PHP_SERVICE_SECRET`) and an `X-User-Id` header containing the id of an existing user. Without them the service answers `401`.

| Method | Path |
|---|---|
| GET | `/health` |
| GET, POST | `/internal/saved-screens` |
| GET, PUT, DELETE | `/internal/saved-screens/{id}` |
| GET, POST | `/internal/research-notes` |
| GET, PUT, DELETE | `/internal/research-notes/{id}` |

The bodies and responses match the gateway routes above, wrapped in `{ data }`.

## Internal: Python engine (`127.0.0.1:8001`)

`X-Internal-Secret` is required when `PYTHON_SERVICE_SECRET` is set. OpenAPI documentation is at `/docs`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | – | status |
| POST | `/v1/analyze` | `AnalysisRequest { symbol, sector?, is_financial_sector, market { price, currency, shares_outstanding, market_cap, dividend_per_share }, periods: [Period], as_of? }` | combined analysis |
| POST | `/v1/analyze/batch` | `{ items: [AnalysisRequest] }` (≤ 200) | `{ results: [...] }` |
| POST | `/v1/ratios` | `AnalysisRequest` | valuation metrics only |
| POST | `/v1/growth` | `{ series: { name: [{ fiscal_year, period_end, value }] } }` | YoY growth and 3-year CAGR |
| POST | `/v1/validate` | `AnalysisRequest` | quality checks and completeness |
| POST | `/v1/returns` | `{ prices: [{ date, close }] }` | window returns, volatility, drawdown |
| POST | `/v1/statistics` | `{ metrics: { key: [{ symbol, value }] } }` | descriptive statistics per metric |

Unknown fields, NaN or Infinity values, and a non-positive price are rejected with `422`.
