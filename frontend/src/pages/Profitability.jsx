import { TrendChart } from '../components/Charts.jsx';
import { MetricGrid } from '../components/MetricCard.jsx';
import SeriesTable from '../components/SeriesTable.jsx';
import { ErrorState } from '../components/States.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { seriesRows, useStock } from '../hooks/useStock.js';
import { formatPercent } from '../utils/format.js';

const KEYS = ['roe', 'roce', 'gross_margin', 'operating_margin', 'net_margin'];
const LABELS = { roe: 'ROE', roce: 'ROCE', gross_margin: 'Gross margin', operating_margin: 'Operating margin', net_margin: 'Net margin' };

export default function Profitability() {
  const { bundle } = useStock();
  const { company, analysis } = bundle;
  useDocumentTitle(`${company.ticker} profitability`);
  if (!analysis) return <ErrorState title="Profitability unavailable" error={bundle.analysis_error} />;

  const quarterly = analysis.quarterly ?? [];
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <header>
        <h2 className="mb-0">Profitability analysis</h2>
        <p className="muted">ROE uses average shareholders' equity (opening + closing ÷ 2), so the earliest year has no ROE. ROCE uses capital employed = total assets − current liabilities.</p>
      </header>
      <MetricGrid metrics={analysis.latest?.profitability} keys={KEYS} descriptions={{
        roe: 'Profit earned on shareholders\' money.', roce: 'Operating profit on all long-term capital.',
        gross_margin: 'Revenue left after direct costs.', operating_margin: 'Core operating profit per ₹100 of revenue.', net_margin: 'Profit for shareholders per ₹100 of revenue.',
      }} />
      <section className="card" aria-labelledby="trend-title">
        <h3 id="trend-title">Trend across fiscal years</h3>
        <TrendChart kind="line" data={seriesRows(analysis, 'profitability', KEYS)} series={KEYS.map((k) => ({ key: k, label: LABELS[k] }))} unitLabel="%" valueFormatter={(v) => formatPercent(v)} caption="Profitability ratios by fiscal year" />
      </section>
      <SeriesTable series={analysis.series} caption="Profitability by fiscal year" rows={KEYS.map((k) => ({ group: 'profitability', key: k, label: LABELS[k] }))} />
      {quarterly.length > 0 && (
        <SeriesTable series={quarterly} caption="Quarterly margins (latest reported quarters)" rows={['gross_margin', 'operating_margin', 'net_margin'].map((k) => ({ group: 'margins', key: k, label: LABELS[k] }))} />
      )}
    </div>
  );
}
