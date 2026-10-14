import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmationDialog from '../components/ConfirmationDialog.jsx';
import SearchBar from '../components/SearchBar.jsx';
import { EmptyState, ErrorState, LoadingState, Notice } from '../components/States.jsx';
import StockTable from '../components/StockTable.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';

const COLS = [['market_cap_cr', 'Market cap'], ['pe_ratio', 'P/E'], ['roe', 'ROE'], ['debt_to_equity', 'D/E'], ['revenue_growth', 'Revenue growth'], ['dividend_yield', 'Div. yield']];

export default function Watchlist() {
  useDocumentTitle('Watchlist');
  const { data, error, loading, reload } = useApi((signal) => api.watchlist({ signal }), []);
  const [status, setStatus] = useState({ message: null, error: null });
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const add = async (company) => {
    setStatus({ message: null, error: null });
    try {
      await api.addToWatchlist(company.symbol);
      setStatus({ message: `${company.name} added.`, error: null });
      reload();
    } catch (e) {
      setStatus({ message: null, error: e.message });
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.removeFromWatchlist(confirm.id);
      setStatus({ message: `${confirm.company.name} removed.`, error: null });
      reload();
    } catch (e) {
      setStatus({ message: null, error: e.message });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const items = data?.items ?? [];
  const rows = items.filter((i) => i.row).map((i) => ({ ...i.row, itemId: i.id }));
  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Watchlist' }]} />
      <header className="page-header">
        <h1>Your watchlist</h1>
        <p className="lead">Companies you are following, with their latest available price and selected ratios.</p>
      </header>
      <section className="card card--tight" style={{ maxWidth: 560, marginBottom: 'var(--space-4)' }}>
        <SearchBar onSelect={add} clearOnSelect label="Add a company to your watchlist" placeholder="Add a company to your watchlist…" />
        <p role="status" className="small mb-0" style={{ marginTop: 8 }}>{status.error ? <span className="change--neg">{status.error}</span> : status.message}</p>
      </section>
      {loading && !data && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && items.length === 0 && <EmptyState title="Your watchlist is empty">Search above, or use “Add to watchlist” on any company page.</EmptyState>}
      {data && items.length > 0 && (
        <>
          {rows.some((r) => r.data_meta?.is_demo) && <Notice tone="demo">Prices and ratios are illustrative demo data.</Notice>}
          <div style={{ marginTop: 12 }}>
            <StockTable rows={rows} columns={COLS.map(([key, label]) => ({ key, label }))} caption="Watchlist"
              actions={(r) => <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirm(items.find((i) => i.id === r.itemId))} aria-label={`Remove ${r.company.name}`}><Trash2 size={14} aria-hidden="true" /> Remove</button>} />
          </div>
          {items.filter((i) => !i.row).map((i) => <Notice key={i.id} tone="warning">{i.company.name}: data unavailable ({i.error?.message ?? 'unknown error'}).</Notice>)}
          <p className="xsmall muted" style={{ marginTop: 8 }}>{items.length} of {data.max_items} slots used.</p>
        </>
      )}
      <ConfirmationDialog open={Boolean(confirm)} title="Remove from watchlist?" confirmLabel="Remove" danger busy={busy} onConfirm={remove} onCancel={() => setConfirm(null)}>
        <p>{confirm?.company.name} will be removed from your watchlist.</p>
      </ConfirmationDialog>
    </div>
  );
}
