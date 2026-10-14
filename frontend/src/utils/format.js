/**
 * Number formatting for Indian users: en-IN digit grouping (1,23,45,678),
 * crore / lakh units for large rupee amounts, and consistent precision.
 * Every formatter returns "—" for null/undefined so missing data is never
 * shown as 0.
 */
export const CRORE = 1e7;
export const LAKH = 1e5;
export const NA = '—';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export function formatNumber(v, { min = 0, max = 2 } = {}) {
  if (!isNum(v)) return NA;
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: min, maximumFractionDigits: max }).format(v);
}

/** Price or per-share amount in rupees: ₹1,234.50 */
export function formatPrice(v, currency = 'INR') {
  if (!isNum(v)) return NA;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

/** Large absolute amount -> crore or lakh: ₹2,55,000 Cr */
export function formatAmount(v, unit = 'crore', { decimals } = {}) {
  if (!isNum(v)) return NA;
  const divisor = unit === 'lakh' ? LAKH : CRORE;
  const scaled = v / divisor;
  const dp = decimals ?? (Math.abs(scaled) >= 1000 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2);
  return `${scaled < 0 ? '−' : ''}₹${formatNumber(Math.abs(scaled), { min: dp, max: dp })} ${unit === 'lakh' ? 'L' : 'Cr'}`;
}

/** Value already in crore (e.g. market_cap_cr). */
export const formatCrore = (v) => (isNum(v) ? `₹${formatNumber(v, { max: 0 })} Cr` : NA);

export function formatPercent(v, dp = 1, { sign = false } = {}) {
  if (!isNum(v)) return NA;
  const s = formatNumber(v, { min: dp, max: dp });
  return `${sign && v > 0 ? '+' : ''}${s}%`;
}

export const formatMultiple = (v, dp = 1) => (isNum(v) ? `${formatNumber(v, { min: dp, max: dp })}×` : NA);
export const formatRatio = (v, dp = 2) => (isNum(v) ? formatNumber(v, { min: dp, max: dp }) : NA);

/** Format a Python Metric object according to its unit. */
export function formatMetric(metric, { unit = 'crore' } = {}) {
  if (!metric || !isNum(metric.value)) return NA;
  switch (metric.unit) {
    case 'percent': return formatPercent(metric.value);
    case 'multiple': return formatMultiple(metric.value);
    case 'currency': return formatAmount(metric.value, unit);
    case 'per_share': return formatPrice(metric.value);
    default: return formatRatio(metric.value);
  }
}

export function changeClass(v) {
  if (!isNum(v) || v === 0) return 'change--flat';
  return v > 0 ? 'change--pos' : 'change--neg';
}

const DATE_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const DATETIME_FMT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata', timeZoneName: 'short' });

export function formatDate(iso) {
  if (!iso) return NA;
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00+05:30` : iso);
  return Number.isNaN(d.getTime()) ? NA : DATE_FMT.format(d);
}

export function formatDateTime(iso) {
  if (!iso) return NA;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? NA : DATETIME_FMT.format(d);
}

export const fyLabel = (fy, fp = 'FY') => (fp && fp !== 'FY' ? `${fp} FY${String(fy).slice(-2)}` : `FY${String(fy).slice(-2)}`);
