import { TrendChart } from '../components/Charts.jsx';
import MetricCard from '../components/MetricCard.jsx';
import SeriesTable from '../components/SeriesTable.jsx';
import { ErrorState, Notice } from '../components/States.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';
import { CRORE, formatNumber } from '../utils/format.js';

export default function Growth() {
  const { bundle } = useStock();
  const { company, analysis, statements } = bundle;
  useDocumentTitle(`${company.ticker} growth`);
  if (!analysis) return <ErrorState title="Growth analysis unavailable" error={bundle.analysis_error} />;

  const g = analysis.latest?.growth ?? {};
  const annual = (statements?.periods ?? []).filter((p) => p.period_type === 'annual');
  const chartRows = annual.map((p) => ({
    label: `FY${String(p.fiscal_year).slice(-2)}`,
    revenue: p.income?.revenue == null ? null : p.income.revenue / CRORE,
    net_income: p.income?.net_income == null ? null : p.income.net_income / CRORE,
  }));
  const flagged = analysis.series.flatMap((s) => Object.values(s.growth).filter((m) => m.status === 'not_meaningful' || m.flags?.includes('extreme')).map((m) => ({ ...m, fy: s.fiscal_year })));

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <header>
        <h2 className="mb-0">Growth analysis</h2>
        <p className="muted">Year-on-year changes between consecutive fiscal years, plus compound annual growth (CAGR). Quarterly figures are never mixed into annual growth.</p>
      </header>
      <section aria-labelledby="yoy-title">
        <h3 id="yoy-title">Latest year-on-year growth (FY{analysis.latest_annual_period?.fiscal_year})</h3>
        <div className="metric-grid">
          <MetricCard metric={g.revenue_growth} signed />
          <MetricCard metric={g.net_income_growth} signed />
          <MetricCard metric={g.eps_growth} signed />
        </div>
      </section>
      <section aria-labelledby="cagr-title">
        <h3 id="cagr-title">Compound annual growth</h3>
        <div className="metric-grid">
          {Object.values(analysis.cagr ?? {}).map((m) => <MetricCard key={m.key} metric={m} signed />)}
        </div>
      </section>
      {flagged.length > 0 && (
        <Notice tone="warning" title="Growth figures needing care:">
          <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
            {flagged.map((m) => <li key={`${m.key}-${m.fy}`}>FY{m.fy} {m.label}: {m.reason ?? 'unusually large change - check for one-off items or a small base.'}</li>)}
          </ul>
        </Notice>
      )}
      <section className="card" aria-labelledby="hist-title">
        <h3 id="hist-title">Revenue and net profit by fiscal year</h3>
        <TrendChart data={chartRows} series={[{ key: 'revenue', label: 'Revenue' }, { key: 'net_income', label: 'Net profit' }]} unitLabel="₹ crore" valueFormatter={(v) => formatNumber(v, { max: 0 })} caption="Revenue and net profit" />
      </section>
      <SeriesTable series={analysis.series} caption="Year-on-year growth by fiscal year" rows={[
        { group: 'growth', key: 'revenue_growth', label: 'Revenue growth' },
        { group: 'growth', key: 'net_income_growth', label: 'Net profit growth' },
        { group: 'growth', key: 'eps_growth', label: 'EPS growth' },
      ]} />
    </div>
  );
}
