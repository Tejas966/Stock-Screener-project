import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import ConfirmationDialog from '../components/ConfirmationDialog.jsx';
import FormField from '../components/FormField.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';
import { serverFieldErrors, validateLength } from '../utils/validation.js';

const TITLE_MAX = 150;
const CONTENT_MAX = 10000;
const EMPTY = { title: '', content: '', company_symbol: '' };

function validate(form) {
  const errors = {};
  const t = validateLength(form.title, { label: 'Title', max: TITLE_MAX });
  const c = validateLength(form.content, { label: 'Note text', max: CONTENT_MAX });
  if (t) errors.title = t;
  if (c) errors.content = c;
  return errors;
}

/** Create/edit form; used for new notes and inline edits. */
function NoteForm({ initial = EMPTY, companies, submitLabel, onSubmit, onCancel }) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((er) => ({ ...er, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await onSubmit({ title: form.title.trim(), content: form.content.trim(), company_symbol: form.company_symbol || null });
      setForm(EMPTY);
    } catch (err) {
      setErrors(serverFieldErrors(err));
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form" onSubmit={submit} noValidate>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <FormField label="Title" error={errors.title} required>
        <input className="input" value={form.title} onChange={set('title')} maxLength={TITLE_MAX + 20} />
      </FormField>
      <FormField label="Company (optional)" error={errors.company_symbol}>
        <select className="select" value={form.company_symbol} onChange={set('company_symbol')}>
          <option value="">Not linked to a company</option>
          {companies.map((c) => <option key={c.symbol} value={c.symbol}>{c.name} ({c.symbol})</option>)}
        </select>
      </FormField>
      <FormField label="Note" error={errors.content} required hint="Plain text. Your notes are private to your account.">
        <textarea className="textarea" value={form.content} onChange={set('content')} maxLength={CONTENT_MAX + 100} />
      </FormField>
      <p className="char-count" aria-live="polite">{form.content.length.toLocaleString('en-IN')} / {CONTENT_MAX.toLocaleString('en-IN')} characters</p>
      <div className="btn-row">
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button type="button" className="btn btn--secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function ResearchNotes() {
  useDocumentTitle('Research notes');
  const [params, setParams] = useSearchParams();
  const filter = params.get('company') ?? '';
  const companies = useApi((signal) => api.companies({ signal }), []);
  const notes = useApi((signal) => api.notes({ company: filter || undefined }, { signal }), [filter]);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const create = async (body) => {
    const n = await api.createNote(body);
    setMessage(`Saved “${n.title}”.`);
    notes.reload();
  };
  const update = async (id, body) => {
    await api.updateNote(id, body);
    setEditing(null);
    setMessage('Note updated.');
    notes.reload();
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteNote(confirm.id);
      setMessage(`Deleted “${confirm.title}”.`);
      notes.reload();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const companyList = companies.data ?? [];
  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Research notes' }]} />
      <header className="page-header">
        <h1>Research notes</h1>
        <p className="lead">A private journal for your observations. Link a note to a company to find it again from that company.</p>
      </header>
      <div className="split">
        <section aria-labelledby="notes-list" aria-busy={notes.loading}>
          <div className="section__head">
            <h2 id="notes-list">{notes.data ? `${notes.data.total} note${notes.data.total === 1 ? '' : 's'}` : 'Notes'}</h2>
            <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Filter
              <select className="select" style={{ width: 'auto', minHeight: 34 }} value={filter} onChange={(e) => setParams(e.target.value ? { company: e.target.value } : {})}>
                <option value="">All companies</option>
                {companyList.map((c) => <option key={c.symbol} value={c.symbol}>{c.name}</option>)}
              </select>
            </label>
          </div>
          <p role="status" className="small">{message}</p>
          {notes.loading && !notes.data && <LoadingState />}
          {notes.error && <ErrorState error={notes.error} onRetry={notes.reload} />}
          {notes.data && notes.data.items.length === 0 && <EmptyState title={filter ? 'No notes for this company' : 'No notes yet'}>Write your first note using the form.</EmptyState>}
          <ul className="list-plain stack">
            {notes.data?.items.map((n) => (
              <li key={n.id} className="card card--tight">
                {editing === n.id ? (
                  <NoteForm initial={{ title: n.title, content: n.content, company_symbol: n.company_symbol ?? '' }} companies={companyList} submitLabel="Save changes" onSubmit={(b) => update(n.id, b)} onCancel={() => setEditing(null)} />
                ) : (
                  <article>
                    <h3 className="mb-0">{n.title}</h3>
                    <p className="xsmall muted">
                      {n.company_symbol ? <Link to={`/stocks/${n.company_symbol}`}>{n.company_name}</Link> : 'General note'} · Updated {formatDateTime(n.updated_at)}
                    </p>
                    <p className="note-content">{n.content}</p>
                    <div className="btn-row">
                      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(n.id)}><Pencil size={14} aria-hidden="true" /> Edit</button>
                      <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirm(n)}><Trash2 size={14} aria-hidden="true" /> Delete</button>
                    </div>
                  </article>
                )}
              </li>
            ))}
          </ul>
        </section>
        <aside className="card" aria-labelledby="new-note">
          <h2 id="new-note" style={{ fontSize: 'var(--text-xl)' }}>New note</h2>
          <NoteForm companies={companyList} submitLabel="Save note" onSubmit={create} initial={{ ...EMPTY, company_symbol: filter }} key={filter} />
        </aside>
      </div>
      <ConfirmationDialog open={Boolean(confirm)} title="Delete note?" confirmLabel="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setConfirm(null)}>
        <p>“{confirm?.title}” will be permanently deleted.</p>
      </ConfirmationDialog>
    </div>
  );
}
