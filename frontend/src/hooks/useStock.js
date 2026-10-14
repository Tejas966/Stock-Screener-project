import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/** Data bundle loaded by StockLayout + the user's preferred amount unit. */
export function useStock() {
  const ctx = useOutletContext();
  const { user } = useAuth();
  return { ...ctx, unit: user?.preferred_unit ?? 'crore', preferredPeriod: user?.preferred_period ?? 'annual' };
}

/** Annual series from the analysis as chart rows. */
export function seriesRows(analysis, group, keys) {
  return (analysis?.series ?? []).map((s) => {
    const row = { label: `FY${String(s.fiscal_year).slice(-2)}` };
    for (const k of keys) row[k] = s[group]?.[k]?.value ?? null;
    return row;
  });
}
