import { NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import DataFreshness from '../components/DataFreshness.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import WatchlistButton from '../components/WatchlistButton.jsx';
import { useApi } from '../hooks/useApi.js';
import { api } from '../services/api.js';
import { changeClass, formatPercent, formatPrice } from '../utils/format.js';
import NotFound from '../pages/NotFound.jsx';

export const STOCK_SECTIONS = [
  { group: 'Analysis', items: [
    { path: '', label: 'Overview', end: true },
    { path: 'fundamentals', label: 'Fundamental summary' },
    { path: 'valuation', label: 'Valuation' },
    { path: 'profitability', label: 'Profitability' },
    { path: 'growth', label: 'Growth' },
    { path: 'financial-health', label: 'Financial health' },
  ] },
  { group: 'Statements', items: [
    { path: 'income-statement', label: 'Income statement' },
    { path: 'balance-sheet', label: 'Balance sheet' },
    { path: 'cash-flow', label: 'Cash flow' },
  ] },
  { group: 'Market', items: [{ path: 'performance', label: 'Historical performance' }] },
];
const ALL = STOCK_SECTIONS.flatMap((g) => g.items);

/**
 * Shared shell for every /stocks/:symbol/* page. The data bundle (company,
 * quote, statements, Python analysis) is fetched ONCE here and passed to the
 * child pages through the router's Outlet context.
 */
export default function StockLayout() {
  const { symbol } = useParams();
  const { pathname } = useLocation();
  const { data, error, loading, reload } = useApi((signal) => api.fundamentals(symbol, { signal }), [symbol]);
  const sub = pathname.split('/')[3] ?? '';
  const section = ALL.find((s) => s.path === sub);

  if (loading && !data) return <div className="container page"><LoadingState label={`Loading ${symbol}…`} /></div>;
  if (error?.status === 404 || error?.code === 'INVALID_SYMBOL') return <NotFound message={`We could not find a supported company with the symbol “${symbol}”.`} />;
  if (error) return <div className="container page"><ErrorState title="Could not load this company" error={error} onRetry={reload} /></div>;

  const { company, quote } = data;
  const base = `/stocks/${encodeURIComponent(company.symbol)}`;
  return (
    <>
      <section className="stock-header" aria-labelledby="stock-title">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search', to: '/search' }, { label: company.ticker, to: base }, ...(section && section.path ? [{ label: section.label }] : [])]} />
          <div className="stock-header__row">
            <div>
              <h1 id="stock-title">{company.name}</h1>
              <div className="stock-header__ids">
                <span className="badge badge--neutral">{company.exchange}: {company.ticker}</span>
                {company.sector && <NavLink to={`/sectors/${company.sector.slug}`}>{company.sector.name}</NavLink>}
                {company.industry && <span>· {company.industry}</span>}
                {company.isin && <span>· ISIN {company.isin}</span>}
              </div>
            </div>
            <div className="stock-header__price">
              {quote ? (
                <>
                  <div className="price">{formatPrice(quote.price, quote.currency)}</div>
                  <div className={changeClass(quote.change_pct)}>{formatPercent(quote.change_pct, 2, { sign: true })} <span className="muted small">last session</span></div>
                </>
              ) : <div className="muted">Price unavailable{data.quote_error ? `: ${data.quote_error.message}` : ''}</div>}
              <div style={{ marginTop: 8 }}><WatchlistButton symbol={company.symbol} /></div>
            </div>
          </div>
          <DataFreshness meta={quote?.meta ?? data.statements?.meta} observedAt={quote?.observed_at} periodEnd={data.analysis?.latest_annual_period?.period_end} />
        </div>
      </section>
      <div className="container page">
        <div className="stock-workspace">
          <aside className="stock-sidebar">
            <nav aria-label={`${company.ticker} analysis sections`}>
              {STOCK_SECTIONS.map((g) => (
                <div key={g.group}>
                  <p className="stock-sidebar__group" aria-hidden="true">{g.group}</p>
                  <ul>{g.items.map((s) => <li key={s.path}><NavLink to={s.path ? `${base}/${s.path}` : base} end={s.end}>{s.label}</NavLink></li>)}</ul>
                </div>
              ))}
            </nav>
          </aside>
          <div className="stock-content">
            <Outlet context={{ bundle: data, reload }} />
          </div>
        </div>
      </div>
    </>
  );
}
