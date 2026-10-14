import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { PriceChart } from '../components/Charts.jsx';
import DataFreshness from '../components/DataFreshness.jsx';
import { ErrorState, LoadingState, Notice, SnapshotNotice } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { changeClass, formatCrore, formatDate, formatMultiple, formatNumber, formatPercent, formatPrice } from '../utils/format.js';

function MoversTable({ title, rows }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={title}>
      <table className="table">
        <caption>{title}</caption>
        <thead><tr><th scope="col">Company</th><th scope="col" className="num">Price</th><th scope="col" className="num">Change</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.symbol}><th scope="row"><Link to={`/stocks/${r.symbol}`}>{r.name}</Link></th><td className="num">{formatPrice(r.price)}</td><td className={`num ${changeClass(r.change_pct)}`}>{formatPercent(r.change_pct, 2, { sign: true })}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

export default function MarketOverview() {
  useDocumentTitle('Market overview');
  const { data, error, loading, reload } = useApi((signal) => api.market({ signal }), []);
  const isDemo = data?.provider?.is_demo;
  const stats = data?.universe?.statistics;

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Market overview' }]} />
      <header className="page-header">
        <h1>Market overview</h1>
        <p className="lead">Indices and a snapshot of the companies covered by FundamentalX.</p>
      </header>
      {loading && <LoadingState label="Loading market data…" />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          {isDemo && <Notice tone="demo" title="Illustrative data:">index levels and prices below are generated for demonstration and are not real market values.</Notice>}
          <DataFreshness meta={data.data_meta} />
          {data.analysis_source === 'offline_snapshot' && <SnapshotNotice snapshot={data.snapshot} />}
          <section aria-labelledby="idx-title">
            <h2 id="idx-title" style={{ fontSize: 'var(--text-xl)' }}>Indices</h2>
            {data.indices.length === 0 && <p className="muted">Index data is not available from the current provider{data.indices_error ? `: ${data.indices_error.message}` : '.'}</p>}
            <div className="grid grid--2">
              {data.indices.map((i) => (
                <article key={i.symbol} className="card">
                  <h3 className="mb-0">{i.name}</h3>
                  <p style={{ margin: '4px 0' }}><span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--ink)' }}>{formatNumber(i.last, { min: 2, max: 2 })}</span>{' '}
                    <span className={changeClass(i.change_pct)}>{formatPercent(i.change_pct, 2, { sign: true })}</span> <span className="small muted">· 1-year {formatPercent(i.change_1y_pct, 1, { sign: true })} · as of {formatDate(i.as_of)}</span></p>
                  <PriceChart prices={i.history} height={160} isDemo={isDemo} title={`${i.name} level`} />
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="uni-title">
            <h2 id="uni-title" style={{ fontSize: 'var(--text-xl)' }}>Coverage universe statistics</h2>
            <p className="small muted">Calculated over the {data.universe.company_count} companies FundamentalX supports{data.universe.unavailable_count ? ` (${data.universe.unavailable_count} without data)` : ''} - not the whole market.</p>
            <div className="metric-grid">
              <article className="metric-card"><h3 className="metric-card__name mb-0">Companies covered</h3><p className="metric-card__value mb-0">{data.universe.company_count}</p></article>
              <article className="metric-card"><h3 className="metric-card__name mb-0">Advancers / decliners</h3><p className="metric-card__value mb-0">{data.universe.advancers} / {data.universe.decliners}</p><p className="metric-card__meta mb-0">Last session</p></article>
              <article className="metric-card"><h3 className="metric-card__name mb-0">Median P/E</h3><p className="metric-card__value mb-0">{formatMultiple(stats?.pe_ratio?.median)}</p><p className="metric-card__meta mb-0">n = {stats?.pe_ratio?.count ?? 0}</p></article>
              <article className="metric-card"><h3 className="metric-card__name mb-0">Median ROE</h3><p className="metric-card__value mb-0">{formatPercent(stats?.roe?.median)}</p><p className="metric-card__meta mb-0">n = {stats?.roe?.count ?? 0}</p></article>
              <article className="metric-card"><h3 className="metric-card__name mb-0">Median dividend yield</h3><p className="metric-card__value mb-0">{formatPercent(stats?.dividend_yield?.median, 2)}</p><p className="metric-card__meta mb-0">n = {stats?.dividend_yield?.count ?? 0}</p></article>
            </div>
          </section>

          <div className="grid grid--2">
            <MoversTable title="Top gainers (last session)" rows={data.universe.top_gainers} />
            <MoversTable title="Top decliners (last session)" rows={data.universe.top_losers} />
          </div>

          <section aria-labelledby="large-title">
            <h2 id="large-title" style={{ fontSize: 'var(--text-xl)' }}>Largest companies by market capitalisation</h2>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Largest companies">
              <table className="table">
                <caption className="visually-hidden">Largest companies in the universe</caption>
                <thead><tr><th scope="col">Company</th><th scope="col">Sector</th><th scope="col" className="num">Market cap</th><th scope="col" className="num">P/E</th></tr></thead>
                <tbody>{data.universe.largest.map((r) => <tr key={r.symbol}><th scope="row"><Link to={`/stocks/${r.symbol}`}>{r.name}</Link></th><td>{r.sector}</td><td className="num">{formatCrore(r.market_cap_cr)}</td><td className="num">{formatMultiple(r.pe_ratio)}</td></tr>)}</tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="sector-title">
            <h2 id="sector-title" style={{ fontSize: 'var(--text-xl)' }}>Companies by sector</h2>
            <ul className="list-plain btn-row">{Object.entries(data.universe.sector_counts).map(([name, n]) => <li key={name} className="badge badge--neutral">{name}: {n}</li>)}</ul>
            <p className="small" style={{ marginTop: 8 }}><Link to="/sectors">Open the sector directory</Link></p>
          </section>
        </div>
      )}
    </div>
  );
}
