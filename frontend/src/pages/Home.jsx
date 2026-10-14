import { ArrowRight, BarChart3, Filter, GitCompareArrows, Scale } from 'lucide-react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';

const METRIC_GROUPS = [
  { title: 'Valuation', items: 'P/E · P/B · EV/EBITDA · Dividend yield', text: 'What you pay for each rupee of earnings, assets or cash profit.' },
  { title: 'Profitability', items: 'ROE · ROCE · Margins', text: 'How well the business turns revenue and capital into profit.' },
  { title: 'Growth', items: 'Revenue · Profit · EPS · CAGR', text: 'How fast the business has been expanding, year by year.' },
  { title: 'Financial health', items: 'Debt-to-equity · Current ratio · Interest coverage', text: 'Whether the balance sheet can absorb a bad year.' },
  { title: 'Cash flow', items: 'Operating cash · Capex · Free cash flow', text: 'Whether profits actually arrive as cash.' },
];

export default function Home() {
  useDocumentTitle('Fundamental analysis for Indian equities');
  const featured = useApi((signal) => api.featured({ signal }), []);

  return (
    <>
      <section className="home-hero" aria-labelledby="hero-title">
        <div className="container home-hero__inner">
          <p className="eyebrow">Fundamental research · NSE &amp; BSE</p>
          <h1 id="hero-title">Read a company's numbers before you form an opinion.</h1>
          <p className="lead">Search a listed Indian company to see its valuation, profitability, growth, balance sheet and cash flow - calculated transparently, with every missing figure marked honestly.</p>
          <SearchBar variant="lg" autoFocus={false} placeholder="Try Reliance Industries, TCS, INFY or HDFCBANK" />
          <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
            Popular: {['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS'].map((s, i) => <span key={s}>{i > 0 && ' · '}<Link to={`/stocks/${s}`}>{s.replace('.NS', '')}</Link></span>)}
          </p>
        </div>
      </section>

      <div className="container page">
        <section aria-labelledby="featured-title">
          <div className="section__head"><h2 id="featured-title">Featured companies</h2><Link to="/market">Market overview <ArrowRight size={14} aria-hidden="true" /></Link></div>
          {featured.loading && <div className="grid grid--auto">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}</div>}
          {featured.error && <p className="form-error">{featured.error.message}</p>}
          {featured.data && (
            <ul className="grid grid--auto list-plain">
              {featured.data.map((c) => (
                <li key={c.symbol}>
                  <Link to={`/stocks/${c.symbol}`} className="card__link">
                    <article className="card card--tight">
                      <h3 className="mb-0">{c.name}</h3>
                      <p className="small muted mb-0">{c.exchange}: {c.ticker} · {c.sector?.name}</p>
                    </article>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section split" aria-labelledby="what-title">
          <article>
            <h2 id="what-title">What is fundamental analysis?</h2>
            <p>Fundamental analysis studies a business through its financial statements - the income statement, balance sheet and cash-flow statement - to understand how profitable, fast-growing and financially resilient it is, and what the market price implies about it.</p>
            <p>FundamentalX does the arithmetic for you and shows how each ratio was calculated. It does not tell you what to buy: it helps you ask better questions.</p>
            <p><Link to="/methodology">Read the methodology</Link> · <Link to="/glossary">Browse the glossary</Link></p>
          </article>
          <aside className="card" aria-labelledby="tools-title">
            <h3 id="tools-title">Research tools</h3>
            <ul className="list-plain stack">
              <li><Link to="/screener" className="tool-link"><Filter size={18} aria-hidden="true" /> <span><strong>Stock screener</strong><br /><span className="small muted">Filter companies by P/E, ROE, debt and growth.</span></span></Link></li>
              <li><Link to="/compare" className="tool-link"><GitCompareArrows size={18} aria-hidden="true" /> <span><strong>Compare companies</strong><br /><span className="small muted">Put 2-5 companies side by side.</span></span></Link></li>
              <li><Link to="/sectors" className="tool-link"><BarChart3 size={18} aria-hidden="true" /> <span><strong>Sector analysis</strong><br /><span className="small muted">Peer medians and quartiles by sector.</span></span></Link></li>
            </ul>
          </aside>
        </section>

        <section className="section" aria-labelledby="metrics-title">
          <h2 id="metrics-title">What we measure</h2>
          <div className="grid grid--auto">
            {METRIC_GROUPS.map((g) => (
              <article key={g.title} className="card card--tight">
                <h3><Scale size={16} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> {g.title}</h3>
                <p className="small" style={{ color: 'var(--ink)' }}><strong>{g.items}</strong></p>
                <p className="small muted mb-0">{g.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section notice notice--warning" aria-label="Educational disclaimer">
          <p><strong>Educational use only.</strong> FundamentalX is not a brokerage and does not execute trades or give investment advice. Data can be delayed, incomplete or (in demo mode) illustrative, and AI explanations can be wrong.</p>
        </section>
      </div>
    </>
  );
}
