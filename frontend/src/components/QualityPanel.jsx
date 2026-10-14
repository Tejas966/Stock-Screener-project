import { CheckCircle2, TriangleAlert, XCircle } from 'lucide-react';

/** Python data-quality checks and completeness, shown as plain facts. */
export default function QualityPanel({ quality, warnings = [] }) {
  if (!quality) return null;
  const pct = quality.completeness?.overall_pct;
  const issues = quality.checks.filter((c) => c.severity !== 'info');
  const passed = quality.checks.filter((c) => c.severity === 'info');
  return (
    <section className="card" aria-labelledby="quality-title">
      <h2 id="quality-title" style={{ fontSize: 'var(--text-xl)' }}>Data completeness &amp; checks</h2>
      <p className="small mb-0">Annual line items reported: <strong>{pct == null ? 'n/a' : `${pct}%`}</strong></p>
      {pct != null && <div className="meter" role="img" aria-label={`${pct}% of expected line items are present`} style={{ margin: '6px 0 12px' }}><div className="meter__fill" style={{ width: `${pct}%` }} /></div>}
      <dl className="kv" style={{ marginBottom: 12 }}>
        {Object.entries(quality.completeness?.by_statement ?? {}).map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{{ income: 'Income statement', balance: 'Balance sheet', cashflow: 'Cash flow' }[k]}</dt><dd>{v == null ? 'n/a' : `${v}%`}</dd></div>)}
      </dl>
      <ul className="list-plain stack small">
        {[...warnings.map((w) => ({ severity: 'warning', message: w })), ...issues].map((c, i) => (
          <li key={`${c.message}-${i}`} style={{ display: 'flex', gap: 8 }}>
            {c.severity === 'error' ? <XCircle size={16} className="change--neg" aria-hidden="true" /> : <TriangleAlert size={16} style={{ color: 'var(--warning)' }} aria-hidden="true" />}
            <span><span className="visually-hidden">{c.severity}: </span>{c.message}{c.period_end ? ` (period ending ${c.period_end})` : ''}</span>
          </li>
        ))}
        {passed.length > 0 && <li style={{ display: 'flex', gap: 8 }}><CheckCircle2 size={16} className="change--pos" aria-hidden="true" /><span>{passed.length} accounting consistency check(s) passed (assets = liabilities + equity within 1%).</span></li>}
        {issues.length === 0 && warnings.length === 0 && <li className="muted">No data-quality warnings.</li>}
      </ul>
    </section>
  );
}
