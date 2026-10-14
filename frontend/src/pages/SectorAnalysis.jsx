import { useParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { ErrorState, LoadingState, Notice } from '../components/States.jsx';
import StockTable, { COLUMN_FORMAT } from '../components/StockTable.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import NotFound from './NotFound.jsx';

const COLS = [
  ['market_cap_cr', 'Market cap'], ['pe_ratio', 'P/E'], ['pb_ratio', 'P/B'], ['roe', 'ROE'], ['roce', 'ROCE'],
  ['operating_margin', 'Op. margin'], ['revenue_growth', 'Revenue growth'], ['debt_to_equity', 'D/E'], ['dividend_yield', 'Div. yield'],
];

export default function SectorAnalysis() {
  const { sectorSlug } = useParams();
  const { data, error, loading, reload } = useApi((signal) => api.sector(sectorSlug, { signal }), [sectorSlug]);
  useDocumentTitle(data ? `${data.sector.name} sector` : 'Sector');
  if (error?.status === 404 || error?.status === 400) return <NotFound message="That sector is not in the supported dataset." />;

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Sectors', to: '/sectors' }, { label: data?.sector.name ?? sectorSlug }]} />
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (
        <div className="stack" style={{ gap: 'var(--space-5)' }}>
          <header>
            <h1>{data.sector.name}</h1>
            <p className="lead">{data.sector.description}</p>
            <p className="small"><strong>Peer group:</strong> {data.peer_count} {data.peer_count === 1 ? 'company' : 'companies'} from the FundamentalX universe ({data.peer_group.join(', ') || 'none'}).</p>
          </header>
          {data.provider?.is_demo && <Notice tone="demo">Sector figures are computed from illustrative demo data.</Notice>}
          {data.sector.slug === 'banking' && <Notice tone="warning">For banks, ROCE, current ratio and EV-based multiples are not meaningful and appear as “n.m.”.</Notice>}
          {data.peer_count === 0 ? <p className="muted">No companies with data in this sector.</p> : (
            <StockTable rows={data.rows} columns={COLS.map(([key, label]) => ({ key, label }))} caption={`${data.sector.name} companies`} />
          )}
          {data.statistics_error && <ErrorState title="Statistics unavailable" error={data.statistics_error} />}
          {data.statistics && (
            <section aria-labelledby="stats-title">
              <h2 id="stats-title" style={{ fontSize: 'var(--text-xl)' }}>Descriptive statistics</h2>
              <p className="small muted">Calculated by the Python engine over companies that report each metric (n). Missing values are excluded, not counted as zero. With fewer than three companies the statistics are not representative.</p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Sector statistics">
                <table className="table">
                  <caption className="visually-hidden">Sector statistics</caption>
                  <thead><tr><th scope="col">Metric</th><th scope="col" className="num">n</th><th scope="col" className="num">Median</th><th scope="col" className="num">25th pct.</th><th scope="col" className="num">75th pct.</th><th scope="col" className="num">Min</th><th scope="col" className="num">Max</th></tr></thead>
                  <tbody>
                    {COLS.map(([key, label]) => {
                      const s = data.statistics[key];
                      const f = COLUMN_FORMAT[key];
                      return (
                        <tr key={key}>
                          <th scope="row">{label}{s?.warnings?.length ? <span className="badge badge--warning" style={{ marginLeft: 6 }} title={s.warnings.join('; ')}>small sample</span> : null}</th>
                          <td className="num">{s?.count ?? 0}</td>
                          {['median', 'p25', 'p75', 'min', 'max'].map((k) => <td key={k} className="num">{s?.[k] == null ? '—' : f(s[k])}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
