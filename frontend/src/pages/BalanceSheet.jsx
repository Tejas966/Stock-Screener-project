import StatementView from '../components/StatementView.jsx';
import { Notice } from '../components/States.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';

const ROWS = [
  { key: 'cash_and_equivalents', label: 'Cash & cash equivalents', statement: 'balance', kind: 'sub' },
  { key: 'current_assets', label: 'Current assets', statement: 'balance' },
  { key: 'non_current_assets', label: 'Non-current assets', statement: 'balance' },
  { key: 'total_assets', label: 'Total assets', statement: 'balance', kind: 'total' },
  { key: 'current_liabilities', label: 'Current liabilities', statement: 'balance' },
  { key: 'non_current_liabilities', label: 'Long-term (non-current) liabilities', statement: 'balance' },
  { key: 'total_liabilities', label: 'Total liabilities', statement: 'balance', kind: 'total' },
  { key: 'total_debt', label: 'Total debt (borrowings)', statement: 'balance', kind: 'sub' },
  { key: 'total_equity', label: "Shareholders' equity", statement: 'balance', kind: 'total' },
  { key: 'liab_plus_equity', label: 'Liabilities + equity (check)', statement: 'balance', kind: 'calc',
    get: (p) => (p.balance?.total_liabilities == null || p.balance?.total_equity == null ? null : p.balance.total_liabilities + p.balance.total_equity) },
];

export default function BalanceSheet() {
  const { bundle, unit } = useStock();
  useDocumentTitle(`${bundle.company.ticker} balance sheet`);
  const checks = (bundle.analysis?.quality?.checks ?? []).filter((c) => ['balance_identity', 'balance_identity_ok', 'asset_split_mismatch', 'non_positive_equity'].includes(c.code));
  const failed = checks.filter((c) => c.severity !== 'info');
  return (
    <div className="stack" style={{ gap: 'var(--space-4)' }}>
      <header>
        <h2 className="mb-0">Balance sheet</h2>
        <p className="muted">What the company owns and owes at each fiscal year end (31 March).</p>
      </header>
      <StatementView periods={bundle.statements?.periods} statement="balance" rows={ROWS} caption="Balance sheet" defaultUnit={unit}>
        <section aria-labelledby="bs-checks">
          <h3 id="bs-checks">Consistency checks</h3>
          {checks.length === 0 && <p className="muted small">Not enough line items to run consistency checks.</p>}
          {failed.length > 0
            ? failed.map((c) => <Notice key={c.code + c.period_end} tone="warning">{c.message} (period ending {c.period_end})</Notice>)
            : checks.length > 0 && <Notice tone="info">Total assets equal total liabilities plus equity (within 1%) for all {checks.length} checked period(s).</Notice>}
          {bundle.company.sector?.slug === 'banking' && <p className="small muted">Banks do not split assets and liabilities into current and non-current, so those rows are not reported.</p>}
        </section>
      </StatementView>
    </div>
  );
}
