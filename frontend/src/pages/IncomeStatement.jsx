import StatementView from '../components/StatementView.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';

const ROWS = [
  { key: 'revenue', label: 'Revenue', statement: 'income', kind: 'total' },
  { key: 'cost_of_revenue', label: 'Cost of revenue', statement: 'income', kind: 'sub' },
  { key: 'gross_profit', label: 'Gross profit', statement: 'income' },
  { key: 'operating_expenses', label: 'Operating expenses', statement: 'income', kind: 'sub' },
  { key: 'ebitda', label: 'EBITDA', statement: 'income' },
  { key: 'depreciation', label: 'Depreciation & amortisation', statement: 'income', kind: 'sub' },
  { key: 'operating_income', label: 'Operating profit (EBIT)', statement: 'income', kind: 'total' },
  { key: 'interest_expense', label: 'Interest expense', statement: 'income', kind: 'sub' },
  { key: 'profit_before_tax', label: 'Profit before tax', statement: 'income' },
  { key: 'income_tax', label: 'Income tax', statement: 'income', kind: 'sub' },
  { key: 'net_income', label: 'Net profit', statement: 'income', kind: 'total' },
  { key: 'eps', label: 'Earnings per share (₹)', statement: 'income', perShare: true },
];

export default function IncomeStatement() {
  const { bundle, unit, preferredPeriod } = useStock();
  useDocumentTitle(`${bundle.company.ticker} income statement`);
  const hasQuarterly = bundle.statements?.periods.some((p) => p.period_type === 'quarterly' && p.income);
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <header>
        <h2 className="mb-0">Income statement</h2>
        <p className="muted">Revenue, costs and profit as reported by the data source. Interest expense and costs are shown as positive amounts that reduce profit.</p>
      </header>
      <StatementView periods={bundle.statements?.periods} statement="income" rows={ROWS} caption="Income statement" defaultUnit={unit} defaultPeriod={preferredPeriod} allowQuarterly={hasQuarterly}
        note={bundle.company.sector?.slug === 'banking' ? 'Banks: revenue = total income; no cost of revenue or EBITDA' : undefined} />
    </div>
  );
}
