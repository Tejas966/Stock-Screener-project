import { formatDate, formatNumber, fyLabel, LAKH, CRORE } from '../utils/format.js';

/**
 * Statement table: rows are line items, columns are periods (oldest → newest).
 * rows: [{ key, label, statement, kind?: 'total'|'sub'|'calc', perShare?, get?(period) }]
 * Missing values render as "—" (not reported), never as 0.
 */
export default function FinancialTable({ periods, rows, unit = 'crore', caption, currency = 'INR', note }) {
  if (!periods?.length) return <p className="muted">No statements are available for this selection.</p>;
  const divisor = unit === 'lakh' ? LAKH : CRORE;
  const fmt = (v, perShare) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return <span className="na" title="Not reported">—</span>;
    if (perShare) return formatNumber(v, { min: 2, max: 2 });
    const scaled = v / divisor;
    const s = formatNumber(Math.abs(scaled), { min: Math.abs(scaled) >= 100 ? 0 : 1, max: Math.abs(scaled) >= 100 ? 0 : 1 });
    return scaled < 0 ? `(${s})` : s;
  };
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table table--sticky-first">
        <caption>
          {caption}
          <span className="caption-meta">
            {currency} in {unit === 'lakh' ? 'lakh' : 'crore'} except per-share figures · negative values in (brackets) · {periods[0].period_type === 'annual' ? 'Annual (fiscal years ending March)' : 'Quarterly'}
            {note ? ` · ${note}` : ''}
          </span>
        </caption>
        <thead>
          <tr>
            <th scope="col">Line item</th>
            {periods.map((p) => <th key={p.period_end} scope="col" className="num"><abbr title={`Period ending ${formatDate(p.period_end)}`} style={{ textDecoration: 'none' }}>{fyLabel(p.fiscal_year, p.fiscal_period)}</abbr></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={r.kind ? `row--${r.kind}` : undefined}>
              <th scope="row">{r.label}{r.kind === 'calc' && <span className="badge badge--info" style={{ marginLeft: 6 }}>calculated</span>}</th>
              {periods.map((p) => <td key={p.period_end} className="num">{fmt(r.get ? r.get(p) : p[r.statement]?.[r.key], r.perShare)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
