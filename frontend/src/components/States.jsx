import { AlertTriangle, Inbox } from 'lucide-react';

export function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, children, icon: Icon = Inbox, action }) {
  return (
    <div className="state">
      <Icon className="state__icon" size={32} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
      {action && <div style={{ marginTop: 'var(--space-3)' }}>{action}</div>}
    </div>
  );
}

/** Error box; pass the ApiError so its message (never a stack trace) is shown. */
export function ErrorState({ error, title = 'Something went wrong', onRetry }) {
  return (
    <div className="state--error" role="alert">
      <h3 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={18} aria-hidden="true" /> {title}</h3>
      <p className="mb-0">{error?.message ?? String(error ?? 'Unknown error')}</p>
      {onRetry && <button type="button" className="btn btn--secondary btn--sm" style={{ marginTop: 12 }} onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Notice({ tone = 'info', icon: Icon, children, title }) {
  return (
    <div className={`notice notice--${tone}`} role={tone === 'warning' ? 'note' : undefined}>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <div>{title && <strong>{title} </strong>}{children}</div>
    </div>
  );
}
