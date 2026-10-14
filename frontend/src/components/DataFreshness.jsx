import { Clock, Database, FlaskConical, TriangleAlert } from 'lucide-react';
import { formatDate, formatDateTime } from '../utils/format.js';

/**
 * Shows where data came from and how fresh it is. Demo data is ALWAYS
 * labelled "Illustrative"; nothing here ever claims to be real-time.
 */
export default function DataFreshness({ meta, observedAt, periodEnd, label }) {
  if (!meta) return null;
  const status = { fresh: 'Fetched just now', cached: 'Cached copy', stale: 'Stale cache (provider unavailable)' }[meta.cache_status] ?? meta.cache_status;
  return (
    <p className="freshness">
      {meta.is_demo
        ? <span className="badge badge--demo"><FlaskConical size={12} aria-hidden="true" /> Illustrative demo data</span>
        : <span className="badge badge--neutral"><Database size={12} aria-hidden="true" /> {meta.source_label ?? meta.source}</span>}
      {meta.cache_status === 'stale'
        ? <span className="badge badge--warning"><TriangleAlert size={12} aria-hidden="true" /> {status}</span>
        : <span>{status}</span>}
      {label && <span>· {label}</span>}
      {observedAt && <span><Clock size={12} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Price as of {formatDateTime(observedAt)} ({meta.is_demo ? 'illustrative' : 'delayed / end-of-day'})</span>}
      {periodEnd && <span>· Statements to {formatDate(periodEnd)}</span>}
      <span>· Retrieved {formatDateTime(meta.retrieved_at)}</span>
    </p>
  );
}
