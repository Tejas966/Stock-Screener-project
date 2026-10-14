# FundamentalX

**Stock fundamental analysis and financial research platform for NSE/BSE-listed companies.**
A full-stack Web Technology course project (Third-Year B.Tech Computer Engineering) using React, Node.js/Express, PHP, MySQL, Python/FastAPI and the Google Gemini API.

> **Educational use only.** FundamentalX is not a brokerage, does not execute trades and does not give investment advice. In demo mode every price and financial figure is **illustrative** (generated), not real company data.

---

## Contents

1. [Abstract](#1-abstract)
2. [Problem statement, objectives and scope](#2-problem-statement-objectives-and-scope)
3. [Technology stack (actual versions)](#3-technology-stack-actual-versions)
4. [System architecture and data flow](#4-system-architecture-and-data-flow)
5. [Frontend page directory](#5-frontend-page-directory)
6. [Backend route directory](#6-backend-route-directory)
7. [Database schema and ownership](#7-database-schema-and-ownership)
8. [Python processing and financial formulas](#8-python-processing-and-financial-formulas)
9. [Financial-data provider](#9-financial-data-provider)
10. [Gemini integration](#10-gemini-integration)
11. [Security](#11-security)
12. [Installation and running on Windows](#12-installation-and-running-on-windows)
13. [Tests](#13-tests)
14. [Troubleshooting](#14-troubleshooting)
15. [Limitations and future improvements](#15-limitations-and-future-improvements)

**Running it on another computer (e.g. a friend's)?** Follow [Quick start on a new computer](#quick-start-on-a-new-computer) below. **No internet?** See [Offline use](#offline-use-saved-analysis).

Further documents:

- [`docs/API.md`](docs/API.md): the full REST API reference.
- [`docs/COURSE_OUTCOMES.md`](docs/COURSE_OUTCOMES.md): CO1–CO5 mapping with file references.
- [`docs/ARCHITECTURE_VIVA.md`](docs/ARCHITECTURE_VIVA.md): technical explanation and likely viva questions.

---

## Quick start on a new computer

Anyone with access to the repository can run FundamentalX on their own machine.

**Internet is needed only once, to install.** The setup downloads npm, pip and Composer packages, plus MySQL itself if it isn't installed. After that, the app runs fully offline in demo mode; only AI explanations (Gemini) need internet. See [Offline use](#offline-use-saved-analysis).

1. **Install the prerequisites:**
   - Node.js 20+
   - Python 3.10+
   - PHP 8.1+ with `pdo_mysql`
   - Composer
   - MySQL 8, or Docker with `docker compose up -d`

   The [prerequisites table](#prerequisites) shows how to check each one.
2. **Clone the repository.** The default branch contains the whole project:
   ```powershell
   git clone https://github.com/Tejas966/Stock-Screener-project.git
   cd Stock-Screener-project
   ```
3. **Do the [one-time setup](#one-time-setup-powershell-from-the-project-folder).** Your friend needs their **own** `.env`, because `.env` is git-ignored and never shared:
   - copy `.env.example`;
   - choose a database password;
   - generate two random secrets.
4. **Run `scripts\start-all.ps1`** and open <http://localhost:5173>.
5. **Log in** with the development demo account `demo@fundamentalx.local` / `DemoPass123!` (created by `npm run db:seed`), or register a new account.

**What each service is needed for**

| Not running | Effect |
|---|---|
| MySQL | Nothing works. It holds the company list, accounts and caches. |
| Python | Stock pages, screener and market still work, using the **saved analysis snapshot**. Sector statistics are unavailable. |
| PHP | Saved screens and research notes show "temporarily unavailable"; everything else works. |
| Internet | AI explanations fall back to the **built-in summary**; everything else works. |

---

## Offline use (saved analysis)

FundamentalX includes predefined analyses so it stays demonstrable without internet, and even without the Python service:

1. **Saved analysis snapshot** - `backend-node/data/offline-analysis.json`, committed to the repository. For all 25 listings it contains:
   - the full Python analysis (every metric, series, CAGR and data-quality check);
   - the sector peer statistics;
   - a written summary.

   When the Python service is not reachable, the gateway serves this snapshot instead of an error, and the pages show a **"Saved analysis"** notice with the date it was generated. The snapshot is used **only if a SHA-256 hash of the current input data matches the hash it was computed from**, so it can never show figures that disagree with the statements on screen.
2. **Built-in written summary** - when Gemini is not configured or not reachable, **Explain these fundamentals** returns a rule-based summary in the same format as the AI explanation:
   - executive summary;
   - relative strengths;
   - risk factors;
   - metric explanations;
   - data limitations.

   It is generated from fixed templates in `backend-node/src/services/offlineSummary.js`. It:
   - compares a company with its own history and with sector peers (only when at least 3 peers report the metric, and only for material gaps);
   - handles banks and loss-making years;
   - never recommends buying or selling.

   It is always labelled **"Built-in summary · rule-based, not AI"**. When Gemini *is* configured, the **Built-in summary** button still shows it, which is handy for comparing the two.

**Regenerate the snapshot** (needs MySQL and the Python service running, in demo mode) after changing the demo dataset or the Python formulas:

```powershell
cd backend-node
npm run build:offline-analysis
```

The Node test suite fails with "snapshot is stale" if the committed snapshot no longer matches the demo data.

---

## 1. Abstract

FundamentalX lets a user type a company name or ticker (for example *Reliance Industries*, *TCS*, *INFY* or *HDFCBANK*). It then:

1. resolves the correct exchange listing;
2. retrieves market data and financial statements through a provider abstraction;
3. normalises units and sign conventions;
4. sends the numbers to a Python engine that calculates valuation, profitability, growth, solvency and cash-flow metrics and checks data quality;
5. presents everything across dedicated, accessible analysis pages.

Users can also:

- compare companies;
- screen the universe;
- browse sectors with peer medians;
- keep a watchlist, saved screens and research notes, all persisted in MySQL;
- ask Gemini for a plain-language explanation that is constrained to the calculated facts.

## 2. Problem statement, objectives and scope

**Problem.** Beginner investors and students find annual reports and ratio jargon hard to read. Free finance portals often show ratios without saying how they were calculated or flagging data that is missing or misleading, such as a P/E on a loss or growth from a negative base.

**Objectives**

- Turn raw statements into transparent, correctly calculated metrics. Each metric is marked as *calculated*, *reported*, *unavailable* or *not meaningful*, with a reason.
- Never invent or zero-fill missing data, and label demo data everywhere.
- Explain metrics in simple language: a glossary, a methodology page and an optional AI summary.
- Demonstrate CO1–CO5 in one coherent full-stack application.

**Scope**

- **In scope:**
  - a supported universe of 23 large NSE companies (25 listings, including BSE listings of RELIANCE and TCS);
  - annual statements (5 fiscal years) and quarterly income statements;
  - end-of-day prices;
  - screener, comparison, sectors and user research tools.
- **Out of scope:** trading, portfolio P&L, real-time quotes, news and predictions.

## 3. Technology stack (actual versions)

| Layer | Technology | Version used / tested |
|---|---|---|
| Frontend | React, React DOM | 19.3.0 |
| | React Router (`react-router-dom`) | 7.18.4 |
| | Vite, `@vitejs/plugin-react` | 8.3.1, 6.1.1 |
| | Recharts (charts), lucide-react (icons) | 3.10.1, 1.48.0 |
| | Vitest, Testing Library, jsdom | 5.0.2, 16.3.3, 30.1.1 |
| API gateway | Node.js | 22.x (≥ 20 required) |
| | Express | 5.2.1 |
| | helmet, cors, cookie-parser, express-rate-limit | 8.3.0, 2.8.6, 1.4.7, 8.7.0 |
| | mysql2, bcryptjs, zod, dotenv | 3.24.4, 3.0.3, 4.6.5, 18.0.4 |
| | `@google/genai` (official Google GenAI SDK) | 2.25.0 |
| | supertest (tests) | 7.3.0 |
| Persistence service | PHP + PDO (pdo_mysql) | 8.3 (≥ 8.1 required) |
| | PHPUnit (via Composer) | 11.5 |
| Database | MySQL | 8.0.46 |
| Processing service | Python | 3.13 (≥ 3.10 recommended) |
| | FastAPI, Uvicorn, Pydantic | 0.140.13, 0.52.4, 2.13.5 |
| | pandas, NumPy, pytest, httpx2 | 3.0.5, 2.5.3, 9.1.1, 2.12.0 |

All npm versions are pinned exactly. `frontend/.npmrc` sets `legacy-peer-deps=true` to work around an npm resolver crash ("Cannot read properties of null (reading 'edgesOut')") caused by optional peer dependencies of jsdom and Vitest.

## 4. System architecture and data flow

```
 Browser (React SPA, :5173)
     │  fetch('/api/...')  JSON + httpOnly session cookie   (Vite dev proxy → :4000)
     ▼
 Node.js + Express API gateway (:4000)  ── the ONLY public backend
     ├── MySQL (users, sessions, companies, caches, watchlist, history, AI cache)
     ├── Financial-data provider adapter ── demo dataset (file) | FMP REST API
     ├── Python FastAPI engine (:8001, internal) ── ratios, growth, validation, stats
     ├── PHP persistence service (:8002, internal) ── saved screens, research notes ── MySQL
     └── Google Gemini API ── explanation of the calculated facts
```

**Request flow for a stock page** (`GET /api/companies/TCS.NS/fundamentals`):

1. React's `StockLayout` calls the gateway once; all stock sub-pages reuse the result.
2. Node validates the symbol and loads the company identity from MySQL (`companies`).
3. `marketDataService` gets the quote and statements: memory cache → MySQL cache tables → provider. Each step has its own TTL. If the provider fails and only an expired copy exists, that copy is returned labelled `stale`.
4. The provider adapter **normalises** the data: crore → rupees, capex → positive magnitude, missing → `null`.
5. Node posts the normalised payload to Python `/v1/analyze`. Pydantic validates it (no NaN, no unknown fields), and pandas/NumPy compute the metrics and quality checks.
6. Node returns company + quote + statements + analysis, each with source/freshness metadata. If one part fails (for example Python is down), the error is reported for that part only and the raw statements are still shown.
7. Optionally, `POST /api/analysis/TCS.NS/explanation` builds a fact sheet from step 6, calls Gemini with a JSON schema, validates the reply with zod and caches it in `ai_explanations`.

**Saved screens and notes**: `React → Node` (session check plus zod validation) → `PHP` (secret header plus a user id taken from the session) → `MySQL`.

## 5. Frontend page directory

There are **28 route-level page components**: the 27 required pages plus a not-found page. Every one has real content and behaviour.

| # | Route | Component | What it does |
|---|---|---|---|
| 1 | `/` | `Home.jsx` | Intro, large search, featured companies, what is fundamental analysis, metric groups, tool shortcuts, disclaimer |
| 2 | `/market` | `MarketOverview.jsx` | Index levels with charts (demo-labelled), universe medians, advancers/decliners, top movers, largest companies, sector counts |
| 3 | `/search` | `CompanySearch.jsx` | Validated search, grouped NSE/BSE listings to disambiguate, recent searches when logged in |
| 4 | `/stocks/:symbol` | `StockOverview.jsx` | Key figures, 1-year chart, links to all analysis sections |
| 5 | `/stocks/:symbol/fundamentals` | `FundamentalSummary.jsx` | All metric groups, completeness meter, quality checks, AI explanation panel |
| 6 | `/stocks/:symbol/valuation` | `Valuation.jsx` | P/E, P/B, EV, EV/EBITDA, P/S, yield; peer table with Python-computed sector medians |
| 7 | `/stocks/:symbol/profitability` | `Profitability.jsx` | ROE, ROCE and margins; multi-year trend chart and table; quarterly margins |
| 8 | `/stocks/:symbol/growth` | `Growth.jsx` | YoY and CAGR; flags for negative-base or extreme growth; revenue/profit chart |
| 9 | `/stocks/:symbol/financial-health` | `FinancialHealth.jsx` | D/E, current ratio, coverage, net debt; bank caveat; debt/cash trend |
| 10 | `/stocks/:symbol/income-statement` | `IncomeStatement.jsx` | Annual or quarterly table, crore or lakh toggle |
| 11 | `/stocks/:symbol/balance-sheet` | `BalanceSheet.jsx` | Balance sheet with an L+E check row and consistency checks |
| 12 | `/stocks/:symbol/cash-flow` | `CashFlow.jsx` | CFO/CFI/CFF, capex, dividends, calculated FCF; sign-convention note |
| 13 | `/stocks/:symbol/performance` | `Performance.jsx` | 1M/6M/1Y/3Y/5Y chart, period returns (price-only notice), volatility, drawdown |
| 14 | `/compare` | `Compare.jsx` | Pick 2–5 companies (stored in the URL); grouped comparison table; revenue trend; sector, period and currency warnings |
| 15 | `/screener` | `Screener.jsx` | 15 range filters plus sector, sorting, pagination, counts, reset, save / update screen |
| 16 | `/sectors` | `Sectors.jsx` | Sector directory with a search filter |
| 17 | `/sectors/:sectorSlug` | `SectorAnalysis.jsx` | Peer table plus median, quartiles and n from Python |
| 18 | `/watchlist` 🔒 | `Watchlist.jsx` | Add (search), remove (confirm dialog), prices and ratios |
| 19 | `/saved-screens` 🔒 | `SavedScreens.jsx` | List, inspect criteria in words, rename/describe, run, delete (PHP CRUD) |
| 20 | `/history` 🔒 | `SearchHistory.jsx` | Searches grouped by day; revisit; delete one; clear all |
| 21 | `/research-notes` 🔒 | `ResearchNotes.jsx` | Create, edit, list, filter by company and delete notes (PHP CRUD); character counter |
| 22 | `/login` | `Login.jsx` | Validated login; redirects back to the page you came from |
| 23 | `/register` | `Register.jsx` | Name, email, password and confirmation; client and server validation |
| 24 | `/profile` 🔒 | `Profile.jsx` | Edit name and unit/period preferences; change password (signs out other sessions) |
| 25 | `/methodology` | `Methodology.jsx` | Data sources, pipeline, formulas, missing-data rules, AI limits, limitations, analysis vs. advice |
| 26 | `/glossary` | `Glossary.jsx` | 25 searchable definitions with formulas, examples and caveats; category filter; `#anchor` links from metric cards |
| 27 | `/lab/javascript-dom` | `JsDomLab.jsx` + `labs/domDemo.js` | Isolated vanilla-JS widget: validation, events, show/hide, keyboard listbox, reset, event log |
| 28 | `*` | `NotFound.jsx` | 404 page with search (also used for unknown symbols and sectors) |

🔒 = requires login (`RequireAuth` guard).

**Structure**

```
frontend/src/
  components/  Navbar, Footer, Breadcrumbs, SearchBar, MetricCard/MetricGrid, FinancialTable,
               Charts (PriceChart, TrendChart), StockTable, SeriesTable, ScreenerFilterPanel,
               WatchlistButton, States (Loading/Empty/Error/Notice), DataFreshness,
               AIExplanationPanel, QualityPanel, FormField, ConfirmationDialog, Pagination, RequireAuth
  layouts/     MainLayout, StockLayout (fetches the bundle once, Outlet context)
  pages/       28 route components
  context/     AuthContext (session), MetaContext (provider / demo flag)
  hooks/       useApi (fetch + abort + loading/error), useDebounce, useStock, useDocumentTitle
  services/    api.js (Fetch wrapper + endpoint catalogue)
  utils/       format.js (en-IN, crore/lakh), validation.js
  data/        glossary.js
  labs/        domDemo.js (vanilla JS)
  styles/      tokens.css, base.css, layout.css, components.css, pages.css
```

## 6. Backend route directory

The full request and response details are in [`docs/API.md`](docs/API.md).

| Service | Method & path | Auth |
|---|---|---|
| Node | `GET /api/meta`, `GET /api/health` | – |
| Node | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` | – |
| Node | `PUT /api/users/me`, `PUT /api/users/me/password` | 🔒 |
| Node | `GET /api/companies/search?q=`, `GET /api/companies`, `GET /api/companies/featured` | – |
| Node | `GET /api/companies/:symbol`, `/fundamentals`, `/statements?type=&period=`, `/history?range=` | – |
| Node | `POST /api/analysis/:symbol` | – |
| Node | `POST /api/analysis/:symbol/explanation` (Gemini) | 🔒 + rate limit |
| Node | `GET /api/screener/filters`, `POST /api/screener/run` | – |
| Node | `POST /api/compare` | – |
| Node | `GET /api/sectors`, `GET /api/sectors/:slug` | – |
| Node | `GET /api/market/overview` | – |
| Node | `GET/POST /api/watchlist`, `DELETE /api/watchlist/:itemId` | 🔒 |
| Node | `GET/POST/DELETE /api/history`, `DELETE /api/history/:id` | 🔒 |
| Node → PHP | `GET/POST /api/saved-screens`, `GET/PUT/DELETE /api/saved-screens/:id` | 🔒 |
| Node → PHP | `GET/POST /api/research-notes`, `GET/PUT/DELETE /api/research-notes/:id` | 🔒 |
| PHP (internal) | `/health`, `/internal/saved-screens[/{id}]`, `/internal/research-notes[/{id}]` | service secret |
| Python (internal) | `GET /health`, `POST /v1/analyze`, `/v1/analyze/batch`, `/v1/ratios`, `/v1/growth`, `/v1/validate`, `/v1/returns`, `/v1/statistics` | optional service secret |

FastAPI also generates interactive docs at `http://127.0.0.1:8001/docs`.

## 7. Database schema and ownership

The schema is in `database/migrations/001_initial_schema.sql`, applied by `npm run db:migrate` (tracked in `schema_migrations`). Seeds are in `database/seeds/` (company universe only; no financial figures). `npm run db:seed` also creates a **development-only** demo account.

| Table | Purpose | Owner (writes) |
|---|---|---|
| `users` | name, unique email, bcrypt hash, preferences | Node |
| `user_sessions` | SHA-256 hash of session token, expiry | Node |
| `sectors` | name, unique slug, description | Node (seed) |
| `companies` | one row per listing; unique `symbol` and `(exchange, ticker)`; ISIN groups NSE/BSE listings | Node (seed) |
| `quote_cache` | latest price per company and source, observed vs. retrieved time | Node |
| `price_history_cache` | daily closes per company and source | Node |
| `financial_periods` | one row per company, source, period type and period end; currency, fiscal year | Node |
| `financial_line_items` | `(period_id, statement ∈ {income, balance, cashflow}, item_key) → value` (NULL = not reported) | Node |
| `ai_explanations` | validated Gemini JSON keyed by SHA-256 of model + prompt + facts | Node |
| `watchlist_items` | user ↔ company, unique per user | Node |
| `search_history` | user, query, resolved company, time (capped at 200 per user) | Node |
| `saved_screens` | user, name (unique per user), description, criteria JSON | **PHP** |
| `research_notes` | user, optional company, title, content, timestamps | **PHP** |

All child tables use foreign keys: `ON DELETE CASCADE` for user-owned rows, `SET NULL` for optional company links. PHP may only *read* `users` and `companies` (existence checks). The screener field whitelist is shared by both services in `shared/screener-fields.json`, so Node and PHP validate saved criteria against the same rules.

## 8. Python processing and financial formulas

`backend-python/app/` is organised as:

- `schemas.py`: Pydantic models; `extra="forbid"`; `FiniteFloat` rejects NaN and Infinity.
- `calculations/`: `valuation.py`, `profitability.py`, `growth.py` (pandas), `health.py` (solvency and cash flow), `returns.py` (pandas/NumPy), `statistics.py` (NumPy percentiles), `base.py` (shared ratio helper).
- `validation.py`: data-quality checks and completeness.
- `processing.py`: the combined analysis.
- `main.py`: FastAPI endpoints.

Each metric is returned as `{key, label, value, unit, status, reason, formula, period_end, flags}`. `status` is one of `calculated`, `reported`, `unavailable` or `not_meaningful`.

| Metric | Formula | Rule when inputs are bad |
|---|---|---|
| P/E | Price ÷ EPS (latest FY) | EPS ≤ 0 → not meaningful |
| P/B | Price ÷ (Equity ÷ Shares) | Equity ≤ 0 → not meaningful |
| Enterprise value | Market cap + Total debt − Cash | Banks → not meaningful |
| EV/EBITDA | EV ÷ EBITDA (EBIT + D&A if EBITDA is missing, flagged) | EBITDA ≤ 0 → not meaningful |
| Dividend yield | DPS ÷ Price × 100 | Missing DPS → unavailable |
| ROE | Net income ÷ average(opening, closing equity) × 100 | Needs previous consecutive FY; equity ≤ 0 → not meaningful |
| ROCE | EBIT ÷ (Total assets − Current liabilities) × 100 | Banks → not meaningful |
| Gross / operating / net margin | Gross profit / EBIT / Net income ÷ Revenue × 100 | Revenue ≤ 0 → not meaningful |
| Revenue / profit / EPS growth | (Current − Previous) ÷ Previous × 100 | Gap year → unavailable; previous ≤ 0 → not meaningful (turnaround flag); \|g\| > 100% → `extreme` flag |
| CAGR (3y, 4y) | (End ÷ Start)^(1/n) − 1 | Start or end ≤ 0 → not meaningful |
| Debt-to-equity | Total debt ÷ Equity | Equity ≤ 0 → not meaningful |
| Current ratio | Current assets ÷ Current liabilities | Banks → not meaningful |
| Interest coverage | EBIT ÷ \|Interest\| | Interest = 0 → not meaningful |
| Free cash flow | OCF − \|Capex\| | Missing capex → unavailable (never 0) |
| Price returns | End ÷ Start − 1 (last close on or before the window start) | Insufficient history → unavailable |

**Capex sign convention.** Providers report capital expenditure as a negative cash-flow number. The Node normaliser converts it to a positive magnitude, and Python accepts either sign: it takes the absolute value and flags `capex_sign_normalized`. FCF is therefore never computed with a double negative.

**Quality checks:**

- assets = liabilities + equity (±1%);
- current + non-current assets = total assets;
- gross-profit consistency;
- negative revenue or assets;
- duplicate periods and future-dated periods;
- mixed currencies (those periods are excluded);
- missing fiscal years;
- stale statements (older than 550 days);
- completeness percentage per statement.

## 9. Financial-data provider

The application uses a **provider abstraction** (`backend-node/src/services/providers/`). Every adapter returns the normalised model documented in `normalize.js`.

| Adapter | Status | Notes |
|---|---|---|
| `demo` (default) | ✅ working, tested | `backend-node/data/demo-dataset.json`, generated by `npm run build:demo-data` from a seeded random process. Company names, tickers and sectors are real; **all numbers are illustrative**. Prices are labelled as of 30 Jun 2025. A site-wide banner, badges and the AI fact sheet all mark it as demo data. |
| `fmp` (Financial Modeling Prep, `/stable` API) | ⚠️ implemented but **not verified live** | Uses `/quote`, `/profile`, `/income-statement`, `/balance-sheet-statement`, `/cash-flow-statement` and `/historical-price-eod/light`, with `.NS` / `.BO` symbols. Responses are shape-checked with zod. HTTP 429 and plan errors map to friendly messages, and there are no automatic retries. |

**Why FMP, and what to check before relying on it.** FMP documents Indian symbols with `.NS`/`.BO` suffixes and offers income, balance-sheet and cash-flow statements plus EOD history through a single REST API key, which suits the normalised model. However:

- free and low tiers limit daily calls (roughly 250/day on entry plans);
- free tiers may restrict non-US symbols, quarterly statements and history length;
- index symbols (`^NSEI`, `^BSESN`) may require a higher plan.

The screener and sector pages analyse the whole universe, which costs about 25 × 5 requests on a cold cache. The MySQL cache (24-hour statements, 15-minute quotes) keeps this to once a day. Check FMP's current pricing page and terms (including display/redistribution rights) before using it. **The development environment for this project could not reach FMP (outbound access was blocked), so the FMP adapter has not been exercised against the real API.**

To switch providers, set `FINANCIAL_PROVIDER=fmp` and `FINANCIAL_PROVIDER_API_KEY=...` in `.env`, then restart Node. In live mode, provider failures show an error or a `stale`-labelled cached copy; the demo data is never substituted.

## 10. Gemini integration

- **SDK:** the official `@google/genai` (`GoogleGenAI` → `ai.models.generateContent`), server-side only in `backend-node/src/services/geminiService.js`.
- **Model:** `GEMINI_MODEL` (default `gemini-2.5-flash`). Confirm the current model id at <https://ai.google.dev/gemini-api/docs/models>. Model names change, and the default may be retired.
- **Structured output:** `responseMimeType: 'application/json'` plus `responseJsonSchema` with the fields `executive_summary`, `positive_observations`, `risk_factors`, `metric_explanations`, `data_limitations` and `overall_caveat`.
- **Input:** a deterministic fact sheet containing only company identity, data source, demo flag, calculated metrics (with status and reason), five years of revenue/profit/EPS/OCF, and data-quality warnings. It contains no email, name or user text.
- **Constraints (system instruction):**
  - use only the facts;
  - never invent numbers;
  - no predictions and no buy/sell/hold advice;
  - no single-metric verdicts;
  - mention sector differences;
  - state when the data is demo data;
  - plain text only.
- **Validation:**
  - JSON parse, then a strict zod schema (unknown fields, wrong types and over-long text are rejected);
  - the reply is rendered as plain React text, never as HTML;
  - a **grounding check** lists any number in the AI text that does not appear in the fact sheet.
- **Reliability:**
  - 20-second timeout via `abortSignal`;
  - error mapping for quota (429), timeouts, invalid key, bad model and blocked responses;
  - login required and rate-limited per user (`AI_RATE_LIMIT_PER_HOUR`);
  - cached in `ai_explanations` by a hash of model + instruction + fact sheet, so a material data change produces a new explanation.
- **Graceful degradation:** without `GEMINI_API_KEY`, or when Gemini is unreachable (offline, quota, timeout, invalid reply), the gateway returns the [built-in rule-based summary](#offline-use-saved-analysis), labelled as not AI, with the reason Gemini was skipped. Every number still works.
- **Verification status:** request construction, validation and error mapping are covered by unit tests with a mocked client. A request with an invalid key reached Google and was correctly reported as `AI_NOT_AUTHORIZED`. **A successful live explanation could not be generated in the development environment because no API key was available.**

## 11. Security

- **Passwords:** bcrypt (cost 12), never stored or logged in plaintext. Login timing is equalised for unknown emails, and error messages don't reveal whether an account exists.
- **Sessions:**
  - 256-bit random token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` when `COOKIE_SECURE=true`);
  - only the SHA-256 hash is stored in MySQL;
  - 72-hour expiry; logout deletes the row; a password change signs out other sessions.
  - *Trade-off:* server-side sessions need a DB lookup per request, but they can be revoked instantly and nothing sensitive sits in browser storage (unlike a JWT in `localStorage`).
- **CSRF:**
  - `SameSite=Lax` cookies;
  - state-changing requests must be JSON;
  - an `Origin` header, when present, must be in `CORS_ORIGINS`.
- **Authorization:** the user id always comes from the session. Every user-data query is scoped by `user_id`, and another user's resource returns 404. A `user_id` in a request body is rejected.
- **Validation:** zod on every Node route (body and query), Pydantic in Python, and a PHP `Validator` with whitelisted fields, length limits and control-character rejection.
- **SQL:** placeholders everywhere in Node (`mysql2` `execute`) and PDO prepared statements with emulation disabled in PHP. Dynamic column lists use fixed whitelists only.
- **Internal services:**
  - PHP requires `X-Internal-Secret` (constant-time `hash_equals`; at least 16 characters) and a valid existing `X-User-Id`;
  - Python optionally requires `PYTHON_SERVICE_SECRET`;
  - both bind to `127.0.0.1`.
- **Gateway hardening:**
  - `helmet` security headers, a strict CORS allow-list and `x-powered-by` disabled;
  - 32 KB JSON limit (64 KB in PHP);
  - rate limits: login/register 20 per 15 minutes, AI per user per hour, and 300 requests/minute overall;
  - errors return `{error:{code,message}}` with no stack traces.
- **Secrets:** only in `.env` (git-ignored); `.env.example` holds placeholders. The frontend has no secrets: `VITE_API_BASE_URL` is the only Vite variable.

## 12. Installation and running on Windows

### Prerequisites

| Tool | Version | Check with |
|---|---|---|
| Node.js | 20 or newer | `node -v` |
| Python | 3.10 or newer | `py --version` |
| PHP | 8.1 or newer, with `pdo_mysql` enabled in `php.ini` | `php -m` should list `pdo_mysql` |
| Composer | any recent version | `composer --version` |
| MySQL | 8.x Community Server | `mysql --version` |

MySQL can alternatively run in Docker with `docker compose up -d` using the included `docker-compose.yml`.

### One-time setup (PowerShell, from the project folder)

```powershell
# 1. Configuration
copy .env.example .env
#    Edit .env: set DB_PASSWORD, and replace PHP_SERVICE_SECRET / PYTHON_SERVICE_SECRET with random strings:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
#    (optional) FINANCIAL_PROVIDER=fmp + FINANCIAL_PROVIDER_API_KEY, GEMINI_API_KEY
copy frontend\.env.example frontend\.env

# 2. Database (edit the password inside database\setup.sql to match DB_PASSWORD first)
mysql -u root -p < database\setup.sql

# 3. Node gateway + schema + seed
cd backend-node
npm install
npm run db:migrate
npm run db:seed          # company universe + demo login demo@fundamentalx.local / DemoPass123!
cd ..

# 4. Python engine
cd backend-python
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
deactivate
cd ..

# 5. PHP service
cd backend-php
composer install
cd ..

# 6. Frontend
cd frontend
npm install
cd ..
```

### Start everything

Either run `powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1`, which opens four windows, or start each service in its own terminal:

```powershell
# Terminal 1 - Python (port 8001)
cd backend-python; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --host 127.0.0.1 --port 8001
# Terminal 2 - PHP (port 8002)
cd backend-php; php -S 127.0.0.1:8002 -t public public/index.php
# Terminal 3 - Node gateway (port 4000)
cd backend-node; npm start
# Terminal 4 - React (port 5173)
cd frontend; npm run dev
```

Open <http://localhost:5173>. Check <http://localhost:4000/api/health>; it should report `mysql`, `python` and `php` all `true`.

To reset the development database: `cd backend-node; npm run db:reset`.
To regenerate the demo dataset: `npm run build:demo-data`. This rewrites `data/` and `database/seeds/001_sectors_companies.sql`.

## 13. Tests

| Suite | Command | Count | Needs |
|---|---|---|---|
| Python formulas, edge cases, API | `cd backend-python; .\.venv\Scripts\python -m pytest` | 66 | – |
| PHP CRUD, ownership, validation | `cd backend-php; vendor\bin\phpunit` | 16 (70 assertions) | MySQL (uses `DB_TEST_NAME`, wiped) |
| Node gateway (auth, validation, normalisation, Gemini, offline snapshot/summary, PHP/Python clients) | `cd backend-node; npm test` | 62 | MySQL test DB (Python/PHP are stubbed) |
| Frontend (components, validation, guard, DOM lab, explanation panel) | `cd frontend; npm test` | 18 | – |
| All of the above | `scripts\run-tests.ps1` or `./scripts/run-tests.sh` | 162 | |

All 162 passed in the development environment (Linux, MySQL 8.0.46, Node 22, PHP 8.3, Python 3.13).

The end-to-end workflow below was also exercised in Chromium with Playwright against all four running services:

> search → overview → fundamentals → statements → NSE/BSE disambiguation → register → watchlist → screener filter + save → rename and run a saved screen → create/edit/delete a note → compare → DOM lab → logout guard

That run produced no console errors and no horizontal overflow at 375 px width. The Playwright script is not part of the repository's test suites.

## 14. Troubleshooting

| Symptom | Fix |
|---|---|
| `/api/health` shows `mysql: false` | MySQL isn't running, or `DB_*` in `.env` is wrong. Try `mysql -u fundamentalx -p fundamentalx`. |
| `php: false` or saved screens give “temporarily unavailable” | Start the PHP server. `PHP_SERVICE_SECRET` must be identical for both services (both read the root `.env`) and at least 16 characters. |
| `could not find driver` from PHP | Enable `extension=pdo_mysql` in `php.ini` (run `php --ini` to find the file). |
| Calculated metrics are “unavailable” and statements still show | The Python service is down. Start Uvicorn on port 8001. |
| `Activate.ps1 cannot be loaded` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| `npm install` fails with “reading 'edgesOut'” | Use the provided `frontend/.npmrc` (legacy-peer-deps), or run `npm install --legacy-peer-deps`. |
| 403 `FORBIDDEN_ORIGIN` | Open the app at an origin listed in `CORS_ORIGINS` (`http://localhost:5173` by default). |
| Explanation says “Built-in summary · rule-based, not AI” | Gemini isn't configured or reachable; the message shows why. For AI text, set `GEMINI_API_KEY` in `.env`, restart Node and be online. If you see “check GEMINI_MODEL”, update the model id. |
| “Saved analysis” notice on stock pages | The Python service isn't running; start Uvicorn for live calculations. |
| Test fails with “snapshot is stale” | Run `npm run build:offline-analysis` (with Python running) and commit `backend-node/data/offline-analysis.json`. |
| Times look 5½ hours off | Both services force UTC sessions in MySQL. Make sure you're using the provided code and not an old DB dump. |

## 15. Limitations and future improvements

**Limitations**

- Demo data is illustrative; the live adapter (FMP) is unverified and its Indian coverage depends on the plan.
- P/E uses the latest fiscal-year EPS (not TTM). Returns exclude dividends. No corporate-action handling beyond the provider's.
- The universe is small (23 companies), so sector statistics are often based on few peers.
- Bank-specific metrics (NIM, CASA, GNPA, CAR) are not modelled; industrial ratios are marked not meaningful instead.
- The Gemini grounding check is heuristic (number matching) and can't catch wrong qualitative statements.
- In-memory caches and rate limits are per process; a multi-instance deployment would need Redis.
- Accessibility follows WCAG 2.2 AA as a target. It was checked by keyboard walkthroughs, ARIA review, contrast-checked tokens and visible focus, but not with a full screen-reader audit. Recharts SVGs are hidden from assistive tech in favour of text summaries and data tables.

**Future improvements**

- A verified second provider adapter and TTM metrics.
- A larger universe, imported from exchange listing files.
- Bank and NBFC metric set.
- Total-return series with dividends.
- Background cache warm-up jobs.
- Export to CSV/PDF.
- E2E tests in CI.
- Docker images for all services.
