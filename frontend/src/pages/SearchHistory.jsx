import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmationDialog from '../components/ConfirmationDialog.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { formatDate, formatDateTime } from '../utils/format.js';

export default function SearchHistory() {
  useDocumentTitle('Search history');
  const { data, error, loading, reload, setData } = useApi((signal) => api.searchHistory({ signal }), []);
  const [confirmClear, setConfirmClear] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const clearAll = async () => {
    setBusy(true);
    try {
      const r = await api.clearHistory();
      setMessage(`Cleared ${r.deleted} entr${r.deleted === 1 ? 'y' : 'ies'}.`);
      reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
      setConfirmClear(false);
    }
  };

  const removeOne = async (item) => {
    try {
      await api.deleteHistoryItem(item.id);
      setData((d) => ({ items: d.items.filter((i) => i.id !== item.id) }));
      setMessage('Entry removed.');
    } catch (e) {
      setMessage(e.message);
    }
  };

  // Group entries by calendar day (IST) for readability.
  const groups = (data?.items ?? []).reduce((acc, item) => {
    const day = formatDate(item.searched_at);
    (acc[day] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search history' }]} />
      <header className="page-header page-header__row">
        <div>
          <h1>Search history</h1>
          <p className="lead mb-0">Your recent company searches (stored in your account, most recent first).</p>
        </div>
        {data?.items.length > 0 && <button type="button" className="btn btn--danger" onClick={() => setConfirmClear(true)}><Trash2 size={16} aria-hidden="true" /> Clear history</button>}
      </header>
      <p role="status" className="small">{message}</p>
      {loading && !data && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.items.length === 0 && <EmptyState title="No searches yet" action={<Link to="/search" className="btn btn--secondary">Search companies</Link>} />}
      {Object.entries(groups).map(([day, items]) => (
        <section key={day} className="section" aria-label={day} style={{ marginTop: 'var(--space-4)' }}>
          <h2 style={{ fontSize: 'var(--text-md)', fontFamily: 'var(--font-sans)' }}>{day}</h2>
          <ul className="list-plain card card--flush">
            {items.map((h) => (
              <li key={h.id} className="history-row">
                <div>
                  <Link to={`/search?q=${encodeURIComponent(h.query)}`}>“{h.query}”</Link>
                  {h.symbol && <> → <Link to={`/stocks/${h.symbol}`}>{h.company_name} ({h.exchange})</Link></>}
                  <div className="xsmall muted">{formatDateTime(h.searched_at)}</div>
                </div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => removeOne(h)} aria-label={`Remove search “${h.query}”`}><Trash2 size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ConfirmationDialog open={confirmClear} title="Clear all search history?" confirmLabel="Clear history" danger busy={busy} onConfirm={clearAll} onCancel={() => setConfirmClear(false)}>
        <p>This permanently deletes every search in your history.</p>
      </ConfirmationDialog>
    </div>
  );
}
