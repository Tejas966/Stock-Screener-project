import { Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmationDialog from '../components/ConfirmationDialog.jsx';
import FormField from '../components/FormField.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { formatDateTime, formatNumber } from '../utils/format.js';

const LABELS = {
  market_cap_cr: 'Market cap (₹ Cr)', pe_ratio: 'P/E', pb_ratio: 'P/B', ev_ebitda: 'EV/EBITDA', dividend_yield: 'Dividend yield %', roe: 'ROE %', roce: 'ROCE %',
  operating_margin: 'Operating margin %', net_margin: 'Net margin %', revenue_growth: 'Revenue growth %', net_income_growth: 'Profit growth %', eps_growth: 'EPS growth %',
  debt_to_equity: 'Debt-to-equity', current_ratio: 'Current ratio', interest_coverage: 'Interest coverage', company_name: 'Company name',
};

export function describeCriteria(c) {
  const parts = Object.entries(c?.filters ?? {}).map(([k, { min, max }]) => {
    const label = LABELS[k] ?? k;
    if (min != null && max != null) return `${label} between ${formatNumber(min)} and ${formatNumber(max)}`;
    if (min != null) return `${label} ≥ ${formatNumber(min)}`;
    return `${label} ≤ ${formatNumber(max)}`;
  });
  if (c?.sector) parts.push(`Sector: ${c.sector}`);
  return parts.length ? parts : ['No filters (whole universe)'];
}

function ScreenItem({ screen, onChanged, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(screen.name);
  const [description, setDescription] = useState(screen.description ?? '');
  const [state, setState] = useState({ busy: false, error: null });
  const navigate = useNavigate();

  const save = async (e) => {
    e.preventDefault();
    const n = name.trim();
    if (!n || n.length > 80) return setState({ busy: false, error: { name: 'Name must be 1-80 characters' } });
    if (description.length > 300) return setState({ busy: false, error: { description: 'At most 300 characters' } });
    setState({ busy: true, error: null });
    try {
      await api.updateScreen(screen.id, { name: n, description: description.trim() || null });
      setEditing(false);
      setState({ busy: false, error: null });
      onChanged();
    } catch (err) {
      setState({ busy: false, error: err.details ?? { name: err.message } });
    }
  };

  return (
    <li className="card card--tight">
      <article>
        {editing ? (
          <form className="form" onSubmit={save} noValidate aria-label={`Rename ${screen.name}`}>
            <FormField label="Name" error={state.error?.name} required><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} /></FormField>
            <FormField label="Description" error={state.error?.description} hint="Optional, up to 300 characters"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={320} /></FormField>
            <div className="btn-row"><button type="submit" className="btn btn--primary btn--sm" disabled={state.busy}>Save</button><button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(false)}>Cancel</button></div>
          </form>
        ) : (
          <>
            <div className="section__head" style={{ marginBottom: 4 }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-sans)', margin: 0 }}>{screen.name}</h2>
              <span className="xsmall muted">Updated {formatDateTime(screen.updated_at)}</span>
            </div>
            {screen.description && <p className="small">{screen.description}</p>}
            <ul className="small" style={{ margin: '4px 0 12px', paddingLeft: 18 }}>{describeCriteria(screen.criteria).map((p) => <li key={p}>{p}</li>)}</ul>
            <p className="xsmall muted">Sorted by {LABELS[screen.criteria.sort?.field] ?? screen.criteria.sort?.field} ({screen.criteria.sort?.direction})</p>
            <div className="btn-row">
              <button type="button" className="btn btn--primary btn--sm" onClick={() => navigate(`/screener?screen=${screen.id}`)}><Play size={14} aria-hidden="true" /> Run</button>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}><Pencil size={14} aria-hidden="true" /> Rename</button>
              <button type="button" className="btn btn--danger btn--sm" onClick={() => onDelete(screen)}><Trash2 size={14} aria-hidden="true" /> Delete</button>
            </div>
          </>
        )}
      </article>
    </li>
  );
}

export default function SavedScreens() {
  useDocumentTitle('Saved screens');
  const { data, error, loading, reload } = useApi((signal) => api.savedScreens({ signal }), []);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteScreen(confirm.id);
      setMessage(`Deleted “${confirm.name}”.`);
      reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Saved screens' }]} />
      <header className="page-header page-header__row">
        <div>
          <h1>Saved screens</h1>
          <p className="lead mb-0">Your saved screener configurations. Run one to see today's matching companies.</p>
        </div>
        <Link to="/screener" className="btn btn--primary"><Plus size={16} aria-hidden="true" /> Create a new screen</Link>
      </header>
      <p role="status" className="small">{message}</p>
      {loading && !data && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && data.items.length === 0 && <EmptyState title="No saved screens yet" action={<Link to="/screener" className="btn btn--secondary">Open the screener</Link>}>Set filters in the screener and choose “Save as new”.</EmptyState>}
      {data && data.items.length > 0 && <ul className="list-plain grid grid--wide-auto">{data.items.map((s) => <ScreenItem key={s.id} screen={s} onChanged={reload} onDelete={setConfirm} />)}</ul>}
      <ConfirmationDialog open={Boolean(confirm)} title="Delete saved screen?" confirmLabel="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setConfirm(null)}>
        <p>“{confirm?.name}” will be permanently deleted.</p>
      </ConfirmationDialog>
    </div>
  );
}
