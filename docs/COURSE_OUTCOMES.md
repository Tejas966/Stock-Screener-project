# Course-outcome mapping

Where each course outcome is demonstrated in FundamentalX. Paths are relative to the repository root.

## CO1: HTML fundamentals, CSS, responsive design, accessibility

| Requirement | Where |
|---|---|
| Semantic HTML5 landmarks | `header`, `nav`, `main#main`, `footer`, `aside` and skip link in `layouts/MainLayout.jsx`, `components/Navbar.jsx`, `components/Footer.jsx`; `section` / `article` / `aside` used throughout `pages/*.jsx` |
| Heading hierarchy | One `h1` per page (the company name on stock pages); `h2`/`h3` for sections |
| Tables for tabular data | `components/FinancialTable.jsx` (captions, `scope`, sticky first column), `StockTable.jsx` (`aria-sort`), `SeriesTable.jsx`, comparison and statistics tables |
| Forms with labels | `components/FormField.jsx` (label ↔ `id`, `aria-describedby`, `aria-invalid`, `role="alert"` errors); `ScreenerFilterPanel.jsx` (`fieldset`/`legend`) |
| CSS design system | `frontend/src/styles/tokens.css`: colour, type, spacing, radius and shadow variables |
| Flexbox | Navbar (`.navbar__inner`), button rows, stock header, notices (`layout.css`, `components.css`) |
| CSS Grid | `.grid--auto`, `.metric-grid`, `.split`, `.stock-workspace` (sidebar + content), `.screener-layout`, footer grid |
| Responsive breakpoints | `@media` at 1024 / 860 / 560 px in `layout.css`, `components.css`, `pages.css`: collapsible nav, horizontal stock sub-nav, single-column layouts, scrollable tables. Verified with no horizontal overflow at 375 px. |
| Accessibility | Visible `:focus-visible` ring; skip link; `aria-live` status messages; ARIA combobox search (`SearchBar.jsx`); native `<dialog>` confirmation (`ConfirmationDialog.jsx`); chart text summaries plus data tables (`Charts.jsx`); contrast-checked tokens; `prefers-reduced-motion` |

## CO2: JavaScript, DOM, events, validation, API integration

| Requirement | Where |
|---|---|
| **Isolated vanilla-JS DOM demo** | `frontend/src/labs/domDemo.js` mounted by `pages/JsDomLab.jsx` at `/lab/javascript-dom`. It covers `createElement`, `querySelector`, `closest`, `addEventListener` (click, input, submit, keydown), event delegation, `classList`, `textContent`, `dataset`, `hidden`, `aria-expanded`, roving `tabindex` keyboard navigation (arrows, Home/End, Space/Enter, Escape), validation messages, reset, and listener clean-up in `destroy()`. |
| Array map / filter / sort / reduce | `services/screenerService.js` (`runScreen`); `pages/Glossary.jsx` (filter + sort); `pages/SearchHistory.jsx` (reduce into day groups); `pages/Compare.jsx` |
| Form validation | `utils/validation.js`, `pages/Register.jsx`, `Login.jsx`, `Profile.jsx`, `ResearchNotes.jsx`, `Screener.jsx` (`buildCriteria`) |
| Data formatting | `utils/format.js`: `Intl.NumberFormat('en-IN')`, crore/lakh, percentages, IST dates |
| Fetch, JSON, async/await, errors | `services/api.js` (`ApiError`, network errors, 204 handling); `hooks/useApi.js` (AbortController, loading/error state) |
| Debounced input events | `hooks/useDebounce.js` + `components/SearchBar.jsx` |
| Tests | `frontend/src/__tests__/components.test.jsx` (DOM lab test); `format.test.js` |

## CO3: React SPA, components, props, state, hooks, conditional rendering, routing

| Requirement | Where |
|---|---|
| Client-side routing | `App.jsx`: 28 route components, nested `stocks/:symbol/*` routes with `<Outlet>`, a catch-all 404, `lazy()` + `Suspense` code splitting |
| Components and props | 21 reusable component files in `components/`, for example `MetricCard` (`metric`, `unit`, `signed`), `StockTable` (`columns`, `sort`, `onSort`, `actions` render prop) |
| `useState` | All forms; `Screener.jsx` filter state; `StatementView.jsx` toggles |
| `useEffect` | Data loading in `useApi`; listeners in `Navbar.jsx`; mounting the DOM lab in `JsDomLab.jsx` |
| `useMemo` / `useCallback` | `Compare.jsx`, `Glossary.jsx`, `Sectors.jsx`, `Charts.jsx`; `useCallback` in `AuthContext.jsx` and `Screener.jsx` |
| `useRef` / `useId` | `SearchBar.jsx`, `FormField.jsx`, `ConfirmationDialog.jsx`, `JsDomLab.jsx` |
| Context | `context/AuthContext.jsx` (session), `context/MetaContext.jsx` (demo flag); `Outlet` context in `layouts/StockLayout.jsx` |
| Custom hooks | `useApi`, `useDebounce`, `useStock`, `useDocumentTitle` |
| Conditional rendering | Loading, empty and error states everywhere; metric `unavailable` / `not_meaningful` states; auth-dependent navbar; `RequireAuth` route guard |
| Tests | Vitest + Testing Library: `src/__tests__/components.test.jsx` covers MetricCard states, StockTable sorting, SearchBar keyboard selection, the protected-route redirect and login errors |

## CO4: PHP, MySQL, server-side development, CRUD

| Requirement | Where |
|---|---|
| PHP 8 service | `backend-php/`: front controller `public/index.php`, `src/App.php` (routing), `src/Http/*` (Request, JsonResponse, Router, HttpException) |
| PDO and prepared statements | `src/Database.php` (`ERRMODE_EXCEPTION`, `EMULATE_PREPARES=false`); every query in `src/Repositories/*.php` uses `prepare` + `execute` or `bindValue` |
| Full CRUD | `SavedScreenRepository` / `SavedScreenController`, `ResearchNoteRepository` / `ResearchNoteController` (create, list, read, update, delete) |
| Validation | `src/Validation/Validator.php` (lengths, types, control characters, unknown fields); `ScreenCriteria.php` (whitelist from `shared/screener-fields.json`) |
| HTTP status codes and JSON | 200/201/204/400/401/404/405/409/413/415/422/503 in `JsonResponse::error` |
| Ownership and security | `src/Security/InternalAuth.php` (`hash_equals` secret, existing user id); all queries filter `WHERE id = ? AND user_id = ?` |
| MySQL schema | `database/migrations/001_initial_schema.sql`: 13 tables with primary keys, foreign keys, unique constraints and indexes; seeds in `database/seeds/` |
| Tests | `backend-php/tests/*.php` (PHPUnit 11): CRUD lifecycle, ownership, malformed input, SQL-injection text, pagination, security |

## CO5: Full stack with Node.js, Express, databases, REST, external APIs

| Requirement | Where |
|---|---|
| Express REST gateway | `backend-node/src/app.js` and `src/routes/*.js` (13 route modules) |
| Middleware | `helmet`, `cors`, JSON body limit, `cookie-parser`, rate limiting, origin check (`middleware/security.js`), zod validation (`middleware/validate.js`), auth (`middleware/auth.js`), central error handler |
| Database integration | `src/db/pool.js` (mysql2 pool, UTC); repositories in `src/repositories/`; migration and seed scripts in `scripts/` |
| Authentication and authorization | `routes/auth.js` (bcrypt, server-side sessions), `routes/users.js`; ownership-scoped watchlist and history |
| External financial API | Provider abstraction in `services/providers/` (`demoProvider.js`, `fmpProvider.js`, `normalize.js`); layered cache in `services/marketDataService.js` |
| Python service orchestration | `services/pythonClient.js` calling FastAPI `backend-python/app/main.py` (pandas/NumPy calculations, Pydantic schemas, 66 pytest tests) |
| PHP service orchestration | `services/phpClient.js` plus `routes/savedScreens.js` and `routes/researchNotes.js` |
| Gemini API | `services/geminiService.js` (`@google/genai`, JSON schema output, zod validation, grounding check, caching, error mapping) |
| Tests | `backend-node/tests/*.test.js` (54 tests: auth, validation, normalisation, screener, Gemini, PHP/Python communication and outages) |
