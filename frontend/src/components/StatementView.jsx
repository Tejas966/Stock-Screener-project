import { useMemo, useState } from 'react';
import FinancialTable from './FinancialTable.jsx';
import { Notice } from './States.jsx';

/** Period (annual/quarterly) + unit (crore/lakh) toggles around a FinancialTable. */
export default function StatementView({ periods, statement, rows, caption, defaultUnit = 'crore', defaultPeriod = 'annual', allowQuarterly = false, children, note }) {
  const [period, setPeriod] = useState(allowQuarterly ? defaultPeriod : 'annual');
  const [unit, setUnit] = useState(defaultUnit);
  const shown = useMemo(() => (periods ?? []).filter((p) => p.period_type === period && p[statement]), [periods, period, statement]);
  const currency = shown[0]?.currency ?? 'INR';

  return (
    <div className="stack">
      <div className="btn-row" style={{ justifyContent: 'space-between' }}>
        <div className="segmented" role="group" aria-label="Reporting period">
          <button type="button" aria-pressed={period === 'annual'} onClick={() => setPeriod('annual')}>Annual</button>
          <button type="button" aria-pressed={period === 'quarterly'} onClick={() => setPeriod('quarterly')} disabled={!allowQuarterly} title={allowQuarterly ? undefined : 'Quarterly data is not available for this statement'}>Quarterly</button>
        </div>
        <div className="segmented" role="group" aria-label="Display unit">
          <button type="button" aria-pressed={unit === 'crore'} onClick={() => setUnit('crore')}>₹ crore</button>
          <button type="button" aria-pressed={unit === 'lakh'} onClick={() => setUnit('lakh')}>₹ lakh</button>
        </div>
      </div>
      {!allowQuarterly && <p className="xsmall muted mb-0">Only annual figures are available for this statement from the current data source.</p>}
      {shown.length === 0
        ? <Notice tone="warning">No {period} {caption.toLowerCase()} data is available.</Notice>
        : <FinancialTable periods={shown} rows={rows} unit={unit} currency={currency} caption={`${caption} (${period})`} note={note} />}
      {children}
    </div>
  );
}
