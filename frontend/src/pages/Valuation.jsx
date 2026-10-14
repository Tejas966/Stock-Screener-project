import { Link } from 'react-router-dom';
import { MetricGrid } from '../components/MetricCard.jsx';
import { ErrorState, LoadingState, Notice } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';
import { api } from '../services/api.js';
import { formatCrore, formatMultiple, formatPercent } from '../utils/format.js';

const PEER_COLS = [
  { key: 'pe_ratio', label: 'P/E', fmt: formatMultiple },
  { key: 'pb_ratio', label: 'P/B', fmt: formatMultiple },
  { key: 'ev_ebitda', label: 'EV/EBITDA', fmt: formatMultiple },
  { key: 'dividend_yield', label: 'Div. yield', fmt: (v) => formatPercent(v, 2) },
  { key: 'market_cap_cr', label: 'Market cap', fmt: formatCrore },
];

export default function Valuation() {
  const { bundle, unit } = useStock();
  const { company, analysis } = bundle;
  useDocumentTitle(`${company.ticker} valuation`);
  const peers = useApi((signal) => api.sector(company.sector.slug, { signal }), [company.sector?.slug], { enabled: Boolean(company.sector) });
  if (!analysis) return <ErrorState title="Valuation unavailable" error={bundle.analysis_error} />;

  const stats = peers.data?.statistics;
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <header>
        <h2 className="mb-0">Valuation analysis</h2>
        <p className="muted">Market price compared with fundamentals from FY{analysis.latest_annual_period?.fiscal_year}.</p>
      </header>
      <MetricGrid metrics={analysis.valuation} keys={['market_cap', 'enterprise_value', 'pe_ratio', 'pb_ratio', 'ev_ebitda', 'price_to_sales', 'dividend_yield', 'book_value_per_share']} unit={unit} />
      <Notice tone="info" title="Reading valuation multiples:">
        A low multiple does not by itself mean a company is undervalued - it may reflect weaker growth, higher risk or temporarily inflated earnings.
        Compare multiples with peers in the same sector and with the company's own history, and read them together with profitability and growth.
      </Notice>

      <section className="card" aria-labelledby="peer-title">
        <h3 id="peer-title">Sector peers{company.sector ? `: ${company.sector.name}` : ''}</h3>
        {peers.loading && <LoadingState label="Loading peers…" />}
        {peers.error && <ErrorState error={peers.error} onRetry={peers.reload} />}
        {peers.data && (
          <>
            <p className="small muted">Peer group: {peers.data.peer_count} companies in the supported universe. Medians are calculated by the Python engine from companies with available data (n shown per column).</p>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Peer valuation table">
              <table className="table">
                <caption className="visually-hidden">Valuation multiples of sector peers</caption>
                <thead><tr><th scope="col">Company</th>{PEER_COLS.map((c) => <th key={c.key} scope="col" className="num">{c.label}</th>)}</tr></thead>
                <tbody>
                  {peers.data.rows.map((r) => (
                    <tr key={r.company.symbol} style={r.company.symbol === company.symbol ? { background: 'var(--primary-soft)' } : undefined}>
                      <th scope="row">{r.company.symbol === company.symbol ? <strong>{r.company.name} (this company)</strong> : <Link to={`/stocks/${r.company.symbol}/valuation`}>{r.company.name}</Link>}</th>
                      {PEER_COLS.map((c) => <td key={c.key} className="num">{r.metrics[c.key] == null ? <span className="na">{r.statuses?.[c.key]?.status === 'not_meaningful' ? 'n.m.' : '—'}</span> : c.fmt(r.metrics[c.key])}</td>)}
                    </tr>
                  ))}
                  {stats && (
                    <tr className="row--total">
                      <th scope="row">Sector median</th>
                      {PEER_COLS.map((c) => <td key={c.key} className="num">{stats[c.key]?.median == null ? '—' : c.fmt(stats[c.key].median)}<div className="xsmall muted">n={stats[c.key]?.count ?? 0}</div></td>)}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {peers.data.peer_count < 3 && <p className="small muted">Fewer than three peers: the median is not representative.</p>}
          </>
        )}
      </section>
    </div>
  );
}
