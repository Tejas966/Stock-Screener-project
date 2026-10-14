import { flagText } from './MetricCard.jsx';
import { formatMetric, fyLabel } from '../utils/format.js';

/**
 * Metric-by-period table from the Python series.
 * rows: [{ group, key, label }]; each cell shows the value or the reason it is missing.
 */
export default function SeriesTable({ series, rows, caption, unit, periodKey = 'fiscal_year' }) {
  if (!series?.length) return <p className="muted">No periods available.</p>;
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table table--sticky-first">
        <caption>{caption}</caption>
        <thead><tr><th scope="col">Metric</th>{series.map((s) => <th key={s.period_end} scope="col" className="num">{fyLabel(s[periodKey], s.fiscal_period)}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row">{r.label}</th>
              {series.map((s) => {
                const m = s[r.group]?.[r.key];
                if (!m || m.value == null) {
                  return <td key={s.period_end} className="num"><span className="na" title={m?.reason ?? 'Not available'}>{m?.status === 'not_meaningful' ? 'n.m.' : '—'}</span></td>;
                }
                return <td key={s.period_end} className="num" title={m.flags?.map(flagText).join('; ') || undefined}>{formatMetric(m, { unit })}{m.flags?.includes('extreme') ? ' ⚠' : ''}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="xsmall muted" style={{ padding: '8px 12px', margin: 0 }}>— = input not reported · n.m. = not meaningful (e.g. negative base, zero denominator) · ⚠ = unusually large change. Hover a cell for the reason.</p>
    </div>
  );
}
