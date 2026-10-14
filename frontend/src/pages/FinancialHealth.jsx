import { TrendChart } from '../components/Charts.jsx';
import { MetricGrid } from '../components/MetricCard.jsx';
import SeriesTable from '../components/SeriesTable.jsx';
import { ErrorState, Notice } from '../components/States.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';
import { CRORE, formatAmount, formatNumber } from '../utils/format.js';

export default function FinancialHealth() {
  const { bundle, unit } = useStock();
  const { company, analysis, statements } = bundle;
  useDocumentTitle(`${company.ticker} financial health`);
  if (!analysis) return <ErrorState title="Financial health unavailable" error={bundle.analysis_error} />;

  const annual = (statements?.periods ?? []).filter((p) => p.period_type === 'annual');
  const latestBal = annual.at(-1)?.balance;
  const isBank = company.sector?.slug === 'banking';
  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <header>
        <h2 className="mb-0">Financial health</h2>
        <p className="muted">Solvency and liquidity indicators for FY{analysis.latest_annual_period?.fiscal_year}.</p>
      </header>
      {isBank && (
        <Notice tone="warning" title="Bank balance sheets are different:">
          deposits and borrowings fund a bank's lending, so industrial measures such as current ratio and interest coverage do not apply and
          debt-to-equity cannot be judged on the same scale. Regulators instead use capital adequacy and asset-quality ratios, which this dataset does not include.
        </Notice>
      )}
      <MetricGrid metrics={analysis.latest?.health} keys={['debt_to_equity', 'current_ratio', 'interest_coverage', 'net_debt']} unit={unit} />
      <dl className="kv card card--tight">
        <dt>Total debt</dt><dd>{formatAmount(latestBal?.total_debt, unit)}</dd>
        <dt>Cash &amp; equivalents</dt><dd>{formatAmount(latestBal?.cash_and_equivalents, unit)}</dd>
        <dt>Shareholders' equity</dt><dd>{formatAmount(latestBal?.total_equity, unit)}</dd>
        <dt>Current assets / liabilities</dt><dd>{formatAmount(latestBal?.current_assets, unit)} / {formatAmount(latestBal?.current_liabilities, unit)}</dd>
      </dl>
      <Notice tone="info">There is no universal "safe" level for these ratios. A debt-to-equity of 1 may be normal for a utility or telecom operator and high for a software company - compare within the sector.</Notice>
      <section className="card" aria-labelledby="debt-title">
        <h3 id="debt-title">Debt and cash over time</h3>
        <TrendChart data={annual.map((p) => ({ label: `FY${String(p.fiscal_year).slice(-2)}`, debt: p.balance?.total_debt == null ? null : p.balance.total_debt / CRORE, cash: p.balance?.cash_and_equivalents == null ? null : p.balance.cash_and_equivalents / CRORE }))}
          series={[{ key: 'debt', label: 'Total debt' }, { key: 'cash', label: 'Cash & equivalents' }]} unitLabel="₹ crore" valueFormatter={(v) => formatNumber(v, { max: 0 })} caption="Debt and cash" />
      </section>
      <SeriesTable series={analysis.series} unit={unit} caption="Financial health by fiscal year" rows={[
        { group: 'health', key: 'debt_to_equity', label: 'Debt-to-equity' },
        { group: 'health', key: 'current_ratio', label: 'Current ratio' },
        { group: 'health', key: 'interest_coverage', label: 'Interest coverage' },
        { group: 'health', key: 'net_debt', label: 'Net debt' },
      ]} />
    </div>
  );
}
