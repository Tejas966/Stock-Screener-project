import StatementView from '../components/StatementView.jsx';
import { Notice } from '../components/States.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';

const ROWS = [
  { key: 'operating_cash_flow', label: 'Cash from operating activities', statement: 'cashflow', kind: 'total' },
  { key: 'investing_cash_flow', label: 'Cash from investing activities', statement: 'cashflow', kind: 'total' },
  { key: 'financing_cash_flow', label: 'Cash from financing activities', statement: 'cashflow', kind: 'total' },
  { key: 'capex', label: 'Capital expenditure (cash spent)', statement: 'cashflow', kind: 'sub', get: (p) => (p.cashflow?.capital_expenditure == null ? null : -p.cashflow.capital_expenditure) },
  { key: 'dividends_paid', label: 'Dividends paid', statement: 'cashflow', kind: 'sub' },
  { key: 'fcf', label: 'Free cash flow', statement: 'cashflow', kind: 'calc',
    get: (p) => (p.cashflow?.operating_cash_flow == null || p.cashflow?.capital_expenditure == null ? null : p.cashflow.operating_cash_flow - p.cashflow.capital_expenditure) },
];

export default function CashFlow() {
  const { bundle, unit } = useStock();
  useDocumentTitle(`${bundle.company.ticker} cash flow`);
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <header>
        <h2 className="mb-0">Cash flow statement</h2>
        <p className="muted">Where cash came from and where it went during each fiscal year.</p>
      </header>
      <StatementView periods={bundle.statements?.periods} statement="cashflow" rows={ROWS} caption="Cash flow statement" defaultUnit={unit} />
      <Notice tone="info" title="Sign convention:">
        Inflows are positive and outflows are shown in (brackets). Investing cash flow is usually negative because companies spend on assets;
        financing cash flow is negative when a company repays debt or pays dividends. Capital expenditure is an outflow and is shown in brackets;
        free cash flow = operating cash flow − capital expenditure (the amount spent), calculated by FundamentalX. A dash means the provider did not report the figure, and free cash flow is then not calculated.
      </Notice>
    </div>
  );
}
