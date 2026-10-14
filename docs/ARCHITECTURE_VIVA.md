# FundamentalX: architecture explained (viva / practical-exam notes)

## 1. The big picture in one paragraph

FundamentalX is a **four-service** web application.

- The **React** single-page app runs in the browser and only ever calls the **Node.js/Express** gateway.
- The gateway is the "traffic controller":
  - it checks who you are (session cookie);
  - it validates every request;
  - it fetches financial data from a **provider adapter** (a demo file or the FMP API);
  - it caches that data in **MySQL**;
  - it asks a **Python/FastAPI** service to do all the financial arithmetic;
  - it asks a **PHP** service to save and load your screens and notes;
  - optionally, it asks **Google Gemini** to explain the calculated numbers in plain English.
- Each service has one clear job, and each owns specific database tables.

## 2. Why split it into services?

| Service | Why this technology | What it must never do |
|---|---|---|
| React | Component-based UI, client-side routing, state management | Hold secrets; call PHP, Python or Gemini directly |
| Node/Express | Single public entry point, async I/O for many outbound calls, a large ecosystem (helmet, zod) | Do financial maths itself (that is Python's job) |
| Python/FastAPI | pandas/NumPy for series maths, Pydantic validation, easy unit testing of formulas | Call Gemini, or render pages |
| PHP + PDO | Classic server-side CRUD with prepared statements (course requirement CO4) | Accept requests from browsers, or trust a user id without the secret |
| MySQL | Relational integrity: foreign keys, unique constraints, transactions | – |

## 3. Walk-through: what happens when I search "Infosys"?

1. `SearchBar.jsx` debounces typing (200 ms) and calls `GET /api/companies/search?q=Infosys&record=0`.
2. `routes/companies.js` validates the query with zod: 1–60 characters, safe characters only.
3. `companyRepo.search()` runs a parameterised `LIKE` query that ranks exact ticker matches first. Results are grouped by ISIN so the NSE and BSE listings of one company appear together.
4. Selecting a result navigates to `/stocks/INFY.NS`. If you are logged in, the choice is saved with `POST /api/history`.
5. `StockLayout.jsx` calls `GET /api/companies/INFY.NS/fundamentals` **once** and passes the result to every sub-page through `<Outlet context>`.
6. `analysisService.getCompanyBundle()`:
   - `marketDataService.getQuote()` / `getStatements()` check the memory cache, then MySQL (`quote_cache`, `financial_periods` + `financial_line_items`), then the provider;
   - the provider adapter normalises units and signs;
   - `buildAnalysisPayload()` shapes the data to match the Python schema exactly, and `pythonClient.analyze()` posts it to `/v1/analyze`;
   - Python validates the payload, computes every metric with an explicit status, runs quality checks, and returns JSON.
7. The React pages render metric cards, tables and charts. Each card shows "Calculated", "Reported", "Unavailable" or "Not meaningful", with a reason.

## 4. Key design decisions (be ready to justify them)

- **Missing ≠ zero.** `null` flows end to end. A ratio whose input is missing is *unavailable*, never computed with 0. Example: Nestlé's FY2023 capex is deliberately missing in the demo data, so free cash flow for that year is unavailable.
- **"Not meaningful" is different from "unavailable".** A P/E on negative EPS, or growth from a loss, can be computed but would mislead, so the value is withheld and a reason is given. Example: M&M's FY2022 profit growth carries a `turnaround_loss_to_profit` flag.
- **Sector awareness.** Banks get `is_financial_sector=true`, and Python marks current ratio, ROCE, EV/EBITDA, gross margin and interest coverage as not meaningful for them.
- **Normalisation at the edge.** Every provider-specific quirk is fixed in the adapter: crore → rupees, negative capex → magnitude, FMP's field names. Python and React only ever see one model.
- **Layered cache with per-type TTLs.** Quotes last 15 minutes, history 12 hours and statements 24 hours. If the provider fails, the last cached copy is served labelled **stale**. Demo data is never substituted for live data.
- **Ownership split for the database.** Node writes users, sessions, companies, caches, watchlist and history. PHP writes `saved_screens` and `research_notes`. The validation whitelist for screen criteria lives in one JSON file that both services read.
- **AI is an explainer, not a source.** Gemini sees only a fact sheet built from the numbers, must answer in a JSON schema, is validated with zod, rendered as plain text, and any number it adds is flagged.
- **Sessions instead of JWT in localStorage.** An httpOnly cookie can't be read by injected scripts, and a server-side session can be revoked instantly at logout or on a password change. The trade-off is one DB lookup per request.

## 5. Security checklist

- **bcrypt** (cost 12) for passwords; equal timing for unknown emails.
- **SHA-256-hashed session tokens** in the DB; `HttpOnly`, `SameSite=Lax` cookie.
- **zod / Pydantic / PHP Validator** on every input; unknown fields are rejected.
- **Prepared statements** everywhere: mysql2 `execute`, and PDO with emulation off.
- **Ownership:** `WHERE id = ? AND user_id = ?`; another user's row returns 404, not 403, so ids can't be probed.
- **Internal secret** for PHP (`hash_equals`), plus binding to 127.0.0.1.
- **helmet** headers, a strict CORS list, an origin check on writes, JSON-only writes, body size limits.
- **Rate limits** on login/register, AI and the overall API.
- **No secrets in the frontend:** Gemini and provider keys live only in the server `.env`.

## 6. Likely examiner questions, with short answers

**HTML/CSS (CO1)**

1. *Why use `<table>` for statements instead of divs?* The data is genuinely tabular. Tables give screen readers row and column headers (`scope`, `caption`), which a div grid cannot.
2. *Where do you use Grid vs Flexbox?* Grid for two-dimensional layouts (metric grid, sidebar + content, footer). Flexbox for one-dimensional rows (navbar, button rows).
3. *How is the app responsive?* Fluid grids (`repeat(auto-fill, minmax())`), breakpoints at 1024/860/560 px, a collapsible navbar, a horizontal stock sub-nav on mobile, and tables that scroll inside their own container.
4. *How do you make charts accessible?* Each chart has a text summary in `<figcaption>` and a "show data table" `<details>`. The SVG is `aria-hidden`.
5. *What does `aria-live` do on your forms?* It makes screen readers announce status and error messages when they change, without moving focus.

**JavaScript/DOM (CO2)**

6. *Why is the DOM lab isolated from React?* React owns its DOM through the virtual DOM. Mutating React-managed nodes by hand would be overwritten or cause inconsistencies. So React renders an empty container, and vanilla JS manages only that container, removing its listeners in `destroy()`.
7. *What is event delegation?* One listener on the parent `<ul>` handles clicks for all options, using `e.target.closest('[role="option"]')`.
8. *Why `textContent` and not `innerHTML`?* User input must never be parsed as HTML (XSS).
9. *How does `useApi` avoid race conditions?* Each effect run creates an `AbortController` and aborts the previous request, so a slow old response can't overwrite a newer one.
10. *What is debouncing?* Waiting until typing pauses (200 ms) before calling the search API, which cuts down requests.

**React (CO3)**

11. *How is data shared between the stock sub-pages?* `StockLayout` fetches once and provides `{ bundle }` through `<Outlet context>`; children read it with `useOutletContext()` (wrapped in `useStock()`).
12. *Why `useMemo` in Compare and Glossary?* To recompute derived lists only when their inputs change, not on every render.
13. *How are protected routes implemented?* `RequireAuth` reads `AuthContext`. While the session is being checked it shows a loader; with no user it redirects to `/login` with `state.from`, so login can send you back.
14. *What is code splitting here?* Pages are loaded with `React.lazy(() => import(...))` inside `Suspense`, so the charting library is only downloaded on pages that use it.
15. *Controlled vs uncontrolled inputs?* All React form inputs are controlled (`value` + `onChange`). The DOM-lab inputs are uncontrolled and read directly from the DOM.

**PHP/MySQL (CO4)**

16. *Why PDO with `EMULATE_PREPARES=false`?* Real server-side prepared statements send the SQL and the data separately, so input can't change the query structure. The PHPUnit test stores `'); DROP TABLE ...` as plain text.
17. *How does PHP know which user is calling?* It doesn't trust the browser. Node authenticates the session and sends `X-User-Id` together with `X-Internal-Secret`. PHP verifies the secret with `hash_equals` and checks that the user exists.
18. *Why 404 rather than 403 for another user's note?* So attackers can't discover which ids exist.
19. *Explain your foreign keys.* User-owned rows `ON DELETE CASCADE` (deleting a user removes their data). Optional company links on notes and history `ON DELETE SET NULL`.
20. *Why is `financial_line_items` a separate table?* It normalises statements. Each value has a period, a statement type and an item key, instead of one wide, unstructured table.

**Node/Express & integration (CO5)**

21. *What does helmet do?* It sets security headers such as `X-Content-Type-Options`, a CSP for the API, and HSTS.
22. *What happens if the Python service is down?* The bundle still returns the company, quote and raw statements, with `analysis_error: ANALYSIS_SERVICE_UNAVAILABLE`. The UI shows the statements and an error card in place of the metrics.
23. *If PHP is down?* Saved screens and notes return `503 PERSISTENCE_SERVICE_UNAVAILABLE`. Everything else keeps working.
24. *How do you stop Gemini inventing numbers?* Strict system instructions, a fact sheet as the only input, JSON-schema output, zod validation, plain-text rendering, and a grounding check that flags numbers not present in the facts.
25. *How do you avoid wasting provider quota?* Per-type caches in memory and MySQL, no automatic retries, timeouts on every outbound call, and one batched Python call for the whole universe.
26. *How is CSRF prevented?* SameSite=Lax cookies; state-changing requests must be `application/json` (which a plain HTML form cannot send cross-site without CORS); and an Origin allow-list check.

**Finance**

27. *Why average equity for ROE?* Profit is earned over the whole year, while equity changes during it. Averaging opening and closing equity matches the time base.
28. *Why is a low P/E not automatically "cheap"?* Earnings may be cyclically high or expected to fall, risk may be higher, or growth lower. Valuation must be read alongside quality and growth.
29. *Why is percentage growth from a loss misleading?* Going from −10 to +5 computes as "+150%", and from −10 to −5 as "+50%" even though the company still lost money. Hence "not meaningful" plus a turnaround flag.
30. *How is free cash flow computed, and what about signs?* OCF − capex. Providers report capex as a negative outflow, so it is converted to a positive magnitude first; otherwise the sign would be applied twice.

## 7. Demo script for the practical exam (about 5 minutes)

1. `GET /api/health` shows mysql, python and php all `true`.
2. Home → search "tata" → show TCS and Tata Steel as separate results. Search "Reliance" → pick the BSE listing (disambiguation).
3. TCS → Fundamental summary (point out the demo badge, the quality checks and "AI not configured").
4. HDFC Bank → Financial health (bank caveat, "not meaningful" ratios). M&M → Growth (turnaround flag). Nestlé → Cash flow (missing capex → FCF unavailable).
5. Screener: ROE ≥ 20 and D/E ≤ 0.5 → sort → save. Saved screens → rename → run.
6. Register or log in → add to watchlist → research note create / edit / delete. Then show the rows in MySQL:
   ```sql
   SELECT * FROM research_notes;
   SELECT * FROM saved_screens;
   ```
7. `/lab/javascript-dom`: validation, Enter/Escape, arrow-key listbox.
8. Run `scripts/run-tests.ps1`: 153 tests pass.
