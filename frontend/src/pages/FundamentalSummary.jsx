import AIExplanationPanel from '../components/AIExplanationPanel.jsx';
import { MetricGrid } from '../components/MetricCard.jsx';
import QualityPanel from '../components/QualityPanel.jsx';
import { ErrorState } from '../components/States.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';

const GROUPS = [
  { id: 'valuation', title: 'Valuation', source: 'valuation', keys: ['pe_ratio', 'pb_ratio', 'ev_ebitda', 'dividend_yield'], text: 'What the market price implies relative to earnings, book value and operating profit.' },
  { id: 'profitability', title: 'Profitability', source: 'profitability', keys: ['roe', 'roce', 'operating_margin', 'net_margin'], text: 'How efficiently the business turns revenue and capital into profit.' },
  { id: 'growth', title: 'Growth (year on year)', source: 'growth', keys: ['revenue_growth', 'net_income_growth', 'eps_growth'], text: 'Change compared with the previous fiscal year.', signed: true },
  { id: 'health', title: 'Financial health', source: 'health', keys: ['debt_to_equity', 'current_ratio', 'interest_coverage', 'net_debt'], text: 'Leverage and the ability to meet obligations.' },
  { id: 'cash', title: 'Cash generation', source: 'cashflow', keys: ['free_cash_flow', 'fcf_margin', 'cash_conversion'], text: 'Whether reported profits are backed by cash.' },
];

export default function FundamentalSummary() {
  const { bundle, unit } = useStock();
  const { company, analysis } = bundle;
  useDocumentTitle(`${company.ticker} fundamentals`);
  if (!analysis) return <ErrorState title="Calculated metrics unavailable" error={bundle.analysis_error} />;

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <header>
        <h2 className="mb-0">Fundamental summary</h2>
        <p className="muted">Latest annual period: FY{analysis.latest_annual_period?.fiscal_year} (ending {analysis.latest_annual_period?.period_end}). Each figure is calculated from the reported statements; missing inputs are shown as unavailable rather than estimated.</p>
      </header>
      {GROUPS.map((g) => (
        <section key={g.id} aria-labelledby={`g-${g.id}`}>
          <div className="section__head"><h3 id={`g-${g.id}`} style={{ fontSize: 'var(--text-lg)', margin: 0 }}>{g.title}</h3><span className="small muted">{g.text}</span></div>
          <MetricGrid metrics={g.source === 'valuation' ? analysis.valuation : analysis.latest?.[g.source]} keys={g.keys} unit={unit} signedKeys={g.signed ? g.keys : []} />
        </section>
      ))}
      <QualityPanel quality={analysis.quality} warnings={analysis.warnings} />
      <AIExplanationPanel symbol={company.symbol} analysisAvailable={Boolean(analysis)} />
    </div>
  );
}
