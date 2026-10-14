import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const FORMULAS = [
  ['P/E ratio', 'Price ÷ EPS (latest fiscal year)', 'Not meaningful when EPS ≤ 0'],
  ['P/B ratio', 'Price ÷ (Equity ÷ Shares outstanding)', 'Not meaningful when equity ≤ 0'],
  ['Enterprise value', 'Market cap + Total debt − Cash', 'Not used for banks'],
  ['EV/EBITDA', 'EV ÷ EBITDA (or EBIT + D&A when EBITDA is not reported - flagged)', 'Not meaningful when EBITDA ≤ 0'],
  ['Dividend yield', 'Annual dividend per share ÷ Price × 100', ''],
  ['ROE', 'Net income ÷ Average(opening, closing equity) × 100', 'Needs the previous consecutive year'],
  ['ROCE', 'EBIT ÷ (Total assets − Current liabilities) × 100', 'Not used for banks'],
  ['Gross / operating / net margin', 'Gross profit / EBIT / Net income ÷ Revenue × 100', 'Gross margin not used for banks'],
  ['YoY growth', '(Current − Previous) ÷ Previous × 100', 'Not meaningful if previous ≤ 0; flagged if |growth| > 100%'],
  ['CAGR', '(End ÷ Start)^(1/years) − 1', 'Needs positive start and end'],
  ['Debt-to-equity', 'Total debt ÷ Equity', 'Not meaningful when equity ≤ 0'],
  ['Current ratio', 'Current assets ÷ Current liabilities', 'Not used for banks'],
  ['Interest coverage', 'EBIT ÷ |Interest expense|', 'Not meaningful with zero interest'],
  ['Free cash flow', 'Operating cash flow − |Capital expenditure|', 'Unavailable if either input is missing'],
];

export default function Methodology() {
  useDocumentTitle('Methodology');
  const { meta } = useMeta();
  return (
    <div className="container page prose-page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Methodology' }]} />
      <header className="page-header">
        <h1>Methodology</h1>
        <p className="lead">How FundamentalX gets its numbers, how it calculates ratios, and what it cannot tell you.</p>
      </header>
      <nav aria-label="On this page" className="card card--tight toc">
        <h2 style={{ fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)' }}>On this page</h2>
        <ol>
          <li><a href="#data-sources">Data sources and freshness</a></li>
          <li><a href="#pipeline">From search to dashboard</a></li>
          <li><a href="#formulas">How ratios are calculated</a></li>
          <li><a href="#missing">How missing data is handled</a></li>
          <li><a href="#ai">What the AI summary does and does not do</a></li>
          <li><a href="#limitations">Known limitations</a></li>
          <li><a href="#advice">Analysis is not advice</a></li>
        </ol>
      </nav>

      <section id="data-sources" className="section">
        <h2>1. Data sources and freshness</h2>
        <p>Current source: <strong>{meta?.provider?.label ?? '…'}</strong>{meta?.provider?.is_demo ? ' - demo mode is active.' : '.'}</p>
        <p>FundamentalX talks to financial-data providers through a provider adapter in the Node.js server, so the rest of the application never depends on one vendor's field names, units or sign conventions. Two adapters exist:</p>
        <ul>
          <li><strong>Demo dataset</strong> - a version-controlled file of <em>illustrative</em> figures for real NSE/BSE company names. The numbers are generated, not taken from annual reports, and every page shows a demo label. Use it for learning the tool, never for decisions.</li>
          <li><strong>Financial Modeling Prep</strong> - an external API (requires an API key). Coverage of Indian listings and statement depth depends on the subscription plan.</li>
        </ul>
        <p>Prices are <strong>delayed or end-of-day</strong>, never real-time. Different data are cached for different periods: quotes for 15 minutes, price history for 12 hours and financial statements for 24 hours. Each page shows the source, the time the price refers to and when it was retrieved. If the provider fails and only an expired cached copy exists, it is shown with a “stale” label; FundamentalX never substitutes made-up numbers.</p>
      </section>

      <section id="pipeline" className="section">
        <h2>2. From search to dashboard</h2>
        <ol>
          <li>Your search is matched against the supported company universe (names, NSE tickers, BSE codes, ISINs). If several companies or listings match, you choose.</li>
          <li>The Node.js gateway fetches the quote, statements and price history from the provider (or cache) and <strong>normalises</strong> them: crore → rupees, capital expenditure → positive amount, missing → null.</li>
          <li>The normalised data are sent to the Python financial engine (FastAPI + pandas), which validates every input and calculates the ratios deterministically.</li>
          <li>The results, with their status and the reason for any gap, are displayed. Optionally, Gemini writes a plain-language explanation of those results.</li>
        </ol>
      </section>

      <section id="formulas" className="section">
        <h2>3. How ratios are calculated</h2>
        <p>Every figure labelled “Calculated” comes from these formulas, using the latest <strong>annual</strong> statements (fiscal years ending 31 March). Quarterly figures are only used for quarterly margins and are never mixed into annual growth. See the <Link to="/glossary">glossary</Link> for worked examples.</p>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Formula table">
          <table className="table">
            <caption className="visually-hidden">Formulas used</caption>
            <thead><tr><th scope="col">Metric</th><th scope="col">Formula</th><th scope="col">Rule</th></tr></thead>
            <tbody>{FORMULAS.map(([m, f, r]) => <tr key={m}><th scope="row">{m}</th><td><code>{f}</code></td><td>{r || '—'}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="small" style={{ marginTop: 8 }}>Capital employed is defined as total assets minus current liabilities at period end. Values reported by the provider (such as revenue or market cap when no share count is available) are labelled “Reported by provider”.</p>
      </section>

      <section id="missing" className="section">
        <h2>4. How missing data is handled</h2>
        <ul>
          <li>A missing input is <strong>never treated as zero</strong>. A ratio that needs it is marked <em>Unavailable</em>, with the missing field named.</li>
          <li>When a calculation is mathematically possible but misleading - dividing by zero, a negative P/E, growth from a loss, ratios on negative equity - it is marked <em>Not meaningful</em> with the reason.</li>
          <li>Growth needs two consecutive fiscal years; a gap year makes it unavailable rather than silently comparing non-adjacent years.</li>
          <li>Statements in a different currency are excluded from calculations rather than mixed.</li>
          <li>The engine also checks that assets equal liabilities plus equity (within 1%), detects duplicate or future-dated periods, and reports how complete each statement is.</li>
          <li>For banks, industrial ratios (current ratio, ROCE, EV/EBITDA, gross margin, interest coverage) are not meaningful and are shown as such.</li>
        </ul>
      </section>

      <section id="ai" className="section">
        <h2>5. What the AI summary does and does not do</h2>
        <p>The optional explanation is produced by Google Gemini on the server. Gemini receives only a compact fact sheet of the calculated metrics, their status and the data-quality warnings - no personal information. It is instructed to use only those facts, to say when evidence is insufficient, and not to predict prices or give buy/sell/hold advice.</p>
        <p>The response must match a fixed structure and is validated before display; it is shown as plain text. Numbers in the AI text that cannot be matched to the supplied data are flagged. The AI <strong>does not</strong> fetch data, verify filings or know anything beyond the fact sheet, and it can still be wrong.</p>
      </section>

      <section id="limitations" className="section">
        <h2>6. Known limitations</h2>
        <ul>
          <li>The universe is a small set of large NSE/BSE companies; screener and sector results only describe that set.</li>
          <li>P/E uses the latest fiscal-year EPS, not trailing-twelve-month EPS, so it can lag recent quarters.</li>
          <li>Price returns exclude dividends. Corporate actions (splits, bonuses) depend on the provider's adjustments.</li>
          <li>Consolidated vs standalone statements depend on the provider; one-off items are not adjusted.</li>
          <li>Sector statistics are descriptive only and unreliable for small peer groups (fewer than three companies).</li>
        </ul>
      </section>

      <section id="advice" className="section notice notice--warning">
        <div>
          <h2 style={{ fontSize: 'var(--text-xl)' }}>7. Analysis is not advice</h2>
          <p>Financial analysis describes what a company's reported numbers show. Investment advice considers your goals, risk tolerance and the full context of a company, and in India may only be given by SEBI-registered advisers. FundamentalX does the former only.</p>
        </div>
      </section>
    </div>
  );
}
