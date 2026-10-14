import { X } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { TrendChart } from '../components/Charts.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { EmptyState, ErrorState, LoadingState, Notice } from '../components/States.jsx';
import { COLUMN_FORMAT } from '../components/StockTable.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { formatNumber, formatPrice } from '../utils/format.js';

const MAX = 5;
const GROUPS = [
  { title: 'Size & valuation', rows: [['market_cap_cr', 'Market cap'], ['pe_ratio', 'P/E'], ['pb_ratio', 'P/B'], ['ev_ebitda', 'EV/EBITDA'], ['dividend_yield', 'Dividend yield']] },
  { title: 'Profitability', rows: [['roe', 'ROE'], ['roce', 'ROCE'], ['operating_margin', 'Operating margin'], ['net_margin', 'Net margin']] },
  { title: 'Growth (latest year)', rows: [['revenue_growth', 'Revenue growth'], ['net_income_growth', 'Profit growth'], ['eps_growth', 'EPS growth']] },
  { title: 'Debt & liquidity', rows: [['debt_to_equity', 'Debt-to-equity'], ['current_ratio', 'Current ratio'], ['interest_coverage', 'Interest coverage']] },
];

export default function Compare() {
  useDocumentTitle('Compare companies');
  const [params, setParams] = useSearchParams();
  // The selection lives in the URL (?symbols=TCS.NS,INFY.NS) so comparisons can be shared and bookmarked.
  const symbols = useMemo(() => (params.get('symbols') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, MAX), [params]);
  const setSymbols = (list) => setParams(list.length ? { symbols: list.join(',') } : {});
  const enabled = symbols.length >= 2;
  const { data, error, loading } = useApi((signal) => api.compare(symbols, { signal }), [symbols.join(',')], { enabled });

  const add = (c) => {
    if (symbols.includes(c.symbol) || symbols.length >= MAX) return;
    setSymbols([...symbols, c.symbol]);
  };

  const companies = data?.companies ?? [];
  const years = [...new Set(companies.flatMap((c) => c.trend.map((t) => t.fiscal_year)))].sort();
  const trendRows = years.map((fy) => Object.fromEntries([['label', `FY${String(fy).slice(-2)}`], ...companies.map((c) => [c.company.ticker, c.trend.find((t) => t.fiscal_year === fy)?.revenue_cr ?? null])]));

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Compare' }]} />
      <header className="page-header">
        <h1>Compare companies</h1>
        <p className="lead">Select two to five companies to compare their fundamentals side by side. Every metric is calculated with the same method for each company.</p>
      </header>
      <section className="card card--tight" aria-labelledby="pick-title">
        <h2 id="pick-title" style={{ fontSize: 'var(--text-lg)' }}>Selected companies ({symbols.length}/{MAX})</h2>
        <ul className="list-plain btn-row" aria-live="polite" style={{ marginBottom: 12 }}>
          {symbols.map((s) => (
            <li key={s} className="chip">{s}<button type="button" onClick={() => setSymbols(symbols.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X size={14} aria-hidden="true" /></button></li>
          ))}
          {symbols.length === 0 && <li className="small muted">None yet.</li>}
        </ul>
        {symbols.length < MAX
          ? <SearchBar onSelect={add} clearOnSelect placeholder="Add a company…" label="Add a company to compare" />
          : <p className="small muted mb-0">Maximum of {MAX} companies reached. Remove one to add another.</p>}
        {symbols.length === 0 && <p className="small" style={{ marginTop: 8 }}>Example: <Link to="/compare?symbols=TCS.NS,INFY.NS,WIPRO.NS">TCS vs Infosys vs Wipro</Link></p>}
      </section>

      <section className="section" aria-live="polite">
        {!enabled && <EmptyState title="Add at least two companies">The comparison appears once two or more companies are selected.</EmptyState>}
        {enabled && loading && <LoadingState label="Comparing…" />}
        {enabled && error && <ErrorState error={error} />}
        {enabled && data && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            {data.provider?.is_demo && <Notice tone="demo">Comparison uses illustrative demo figures.</Notice>}
            {data.warnings.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}
            {data.failed.map((f) => <Notice key={f.symbol} tone="warning">{f.symbol}: {f.error.message}</Notice>)}
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Comparison table">
              <table className="table table--sticky-first">
                <caption>Fundamental comparison<span className="caption-meta">Latest fiscal year per company shown under each name. n.m. = not meaningful for this company; — = not available.</span></caption>
                <thead>
                  <tr>
                    <th scope="col">Metric</th>
                    {companies.map((c) => (
                      <th key={c.company.symbol} scope="col" className="num">
                        <Link to={`/stocks/${c.company.symbol}`}>{c.company.ticker}</Link>
                        <div className="xsmall muted" style={{ fontWeight: 400 }}>{c.company.sector?.name} · FY{c.latest_period?.fiscal_year ?? '—'}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr><th scope="row">Price</th>{companies.map((c) => <td key={c.company.symbol} className="num">{formatPrice(c.price)}</td>)}</tr>
                  {GROUPS.map((g) => [
                    <tr key={g.title}><th scope="rowgroup" colSpan={companies.length + 1} style={{ background: 'var(--surface-3)' }}>{g.title}</th></tr>,
                    ...g.rows.map(([key, label]) => (
                      <tr key={key}>
                        <th scope="row">{label}</th>
                        {companies.map((c) => {
                          const v = c.metrics[key];
                          const st = c.statuses?.[key];
                          return <td key={c.company.symbol} className="num">{v == null ? <span className="na" title={st?.reason ?? 'Not available'}>{st?.status === 'not_meaningful' ? 'n.m.' : '—'}</span> : COLUMN_FORMAT[key](v)}</td>;
                        })}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
            <section className="card" aria-labelledby="rev-trend">
              <h2 id="rev-trend" style={{ fontSize: 'var(--text-lg)' }}>Revenue by fiscal year</h2>
              <TrendChart kind="line" data={trendRows} series={companies.map((c) => ({ key: c.company.ticker, label: c.company.ticker }))} unitLabel="₹ crore" valueFormatter={(v) => formatNumber(v, { max: 0 })} caption="Revenue by fiscal year" />
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
