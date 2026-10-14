import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PriceChart } from '../components/Charts.jsx';
import MetricCard from '../components/MetricCard.jsx';
import { ErrorState, LoadingState, Notice } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';
import { api } from '../services/api.js';
import { formatAmount } from '../utils/format.js';

const SECTIONS = [
  { to: 'fundamentals', title: 'Fundamental summary', text: 'All key metrics in one place, data quality and an optional AI explanation.' },
  { to: 'valuation', title: 'Valuation', text: 'P/E, P/B, EV/EBITDA and dividend yield against sector peers.' },
  { to: 'profitability', title: 'Profitability', text: 'ROE, ROCE and margins across fiscal years.' },
  { to: 'growth', title: 'Growth', text: 'Revenue, profit and EPS growth with CAGR.' },
  { to: 'financial-health', title: 'Financial health', text: 'Leverage, liquidity and interest coverage.' },
  { to: 'income-statement', title: 'Income statement', text: 'Revenue to net profit, annual and quarterly.' },
  { to: 'balance-sheet', title: 'Balance sheet', text: 'Assets, liabilities, debt and equity.' },
  { to: 'cash-flow', title: 'Cash flow', text: 'Operating, investing and financing cash flows; free cash flow.' },
  { to: 'performance', title: 'Historical performance', text: 'Price chart and period returns.' },
];

export default function StockOverview() {
  const { bundle, unit } = useStock();
  const { company, analysis, statements } = bundle;
  useDocumentTitle(`${company.name} (${company.ticker})`);
  const history = useApi((signal) => api.history(company.symbol, '1Y', { signal }), [company.symbol]);
  const v = analysis?.valuation ?? {};
  const l = analysis?.latest ?? {};
  const latestIncome = statements?.periods.filter((p) => p.period_type === 'annual').at(-1)?.income;

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      {bundle.analysis_error && <ErrorState title="Calculated metrics unavailable" error={bundle.analysis_error} />}
      {analysis?.warnings?.map((w) => <Notice key={w} tone="warning">{w}</Notice>)}

      <section aria-labelledby="key-title">
        <div className="section__head"><h2 id="key-title">Key figures</h2><span className="small muted">Latest fiscal year: FY{analysis?.latest_annual_period?.fiscal_year ?? '—'}</span></div>
        <div className="metric-grid">
          <MetricCard metric={v.market_cap} unit={unit} />
          <MetricCard metric={v.pe_ratio} />
          <MetricCard metric={v.pb_ratio} />
          <MetricCard metric={v.dividend_yield} />
          <MetricCard metric={l.profitability?.roe} />
          <MetricCard metric={l.profitability?.net_margin} />
          <MetricCard metric={l.growth?.revenue_growth} signed />
          <MetricCard metric={l.health?.debt_to_equity} />
        </div>
        <p className="xsmall muted" style={{ marginTop: 8 }}>
          Revenue FY{analysis?.latest_annual_period?.fiscal_year}: {formatAmount(latestIncome?.revenue, unit)} · Net profit: {formatAmount(latestIncome?.net_income, unit)} (reported by the data source). Ratios are calculated by the FundamentalX Python engine.
        </p>
      </section>

      <section className="card" aria-labelledby="chart-title">
        <div className="section__head"><h2 id="chart-title">Price, last 12 months</h2><Link to="performance">More periods <ArrowRight size={14} aria-hidden="true" /></Link></div>
        {history.loading && <LoadingState label="Loading price history…" />}
        {history.error && <ErrorState error={history.error} onRetry={history.reload} />}
        {history.data && <PriceChart prices={history.data.prices} height={220} isDemo={history.data.meta?.is_demo} />}
      </section>

      <section aria-labelledby="sections-title">
        <h2 id="sections-title" style={{ fontSize: 'var(--text-xl)' }}>Explore the analysis</h2>
        <div className="grid grid--3">
          {SECTIONS.map((s) => (
            <Link key={s.to} to={s.to} className="card__link">
              <article className="card card--tight"><h3>{s.title}</h3><p className="small muted mb-0">{s.text}</p></article>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
