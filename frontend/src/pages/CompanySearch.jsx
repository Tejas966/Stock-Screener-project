import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { EmptyState, ErrorState, LoadingState, Notice } from '../components/States.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';

export default function CompanySearch() {
  useDocumentTitle('Company search');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [text, setText] = useState(q);
  const [formError, setFormError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => setText(q), [q]);
  const results = useApi((signal) => api.search(q, { record: true, signal }), [q], { enabled: q.length > 0 });
  const recent = useApi((signal) => api.searchHistory({ signal }), [user?.id, q], { enabled: Boolean(user) });

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return setFormError('Enter a company name or ticker symbol.');
    if (t.length > 60) return setFormError('Search text must be at most 60 characters.');
    setFormError(null);
    setParams({ q: t });
  };

  const open = (symbol) => {
    if (user) api.recordSearch(q, symbol).catch(() => {});
    navigate(`/stocks/${encodeURIComponent(symbol)}`);
  };

  const d = results.data;
  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Search' }]} />
      <header className="page-header">
        <h1>Company search</h1>
        <p className="lead">Search by company name, NSE ticker (e.g. INFY), BSE code (e.g. 500325) or ISIN.</p>
      </header>
      <div className="split">
        <div>
          <form className="card card--tight" role="search" onSubmit={submit} noValidate>
            <div className="field">
              <label htmlFor="q">Company or symbol</label>
              <div className="inline-fields">
                <input id="q" className="input" style={{ flex: 1, minWidth: 200 }} value={text} maxLength={80} onChange={(e) => setText(e.target.value)} aria-invalid={formError ? 'true' : undefined} aria-describedby={formError ? 'q-err' : undefined} placeholder="e.g. Tata" />
                <button type="submit" className="btn btn--primary">Search</button>
              </div>
              {formError && <span id="q-err" className="field-error" role="alert">{formError}</span>}
            </div>
          </form>

          <section className="section" aria-live="polite" aria-busy={results.loading}>
            {!q && <EmptyState title="Start by searching for a company">Results come from the supported universe of NSE/BSE companies.</EmptyState>}
            {results.loading && <LoadingState label="Searching…" />}
            {results.error && <ErrorState error={results.error} />}
            {d && (
              <>
                <h2 style={{ fontSize: 'var(--text-xl)' }}>{d.results.length} listing{d.results.length === 1 ? '' : 's'} for “{d.query}”</h2>
                {d.results.length === 0 && <EmptyState title="No matching companies">Check the spelling or try the NSE ticker. Only companies in the supported universe can be analysed.</EmptyState>}
                {d.ambiguous && d.results.length > 0 && <Notice tone="info">Several companies or listings match. Choose the company <em>and</em> the exchange listing you want to analyse.</Notice>}
                <ul className="list-plain stack" style={{ marginTop: 12 }}>
                  {d.groups.map((g) => (
                    <li key={g.isin ?? g.name} className="card card--tight">
                      <article>
                        <h3 className="mb-0">{g.name}</h3>
                        <p className="small muted">{g.sector?.name ?? 'Unclassified'} · {g.industry}{g.isin ? ` · ISIN ${g.isin}` : ''}</p>
                        <div className="btn-row">
                          {g.listings.map((l) => (
                            <button key={l.symbol} type="button" className={`btn btn--sm ${l.symbol === d.exact_match ? 'btn--primary' : 'btn--secondary'}`} onClick={() => open(l.symbol)}>
                              {l.exchange}: {l.ticker}
                            </button>
                          ))}
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
        <aside className="card card--tight" aria-labelledby="recent-title">
          <h2 id="recent-title" style={{ fontSize: 'var(--text-lg)', display: 'flex', gap: 8, alignItems: 'center' }}><History size={18} aria-hidden="true" /> Recent searches</h2>
          {!user && <p className="small muted mb-0"><Link to="/login" state={{ from: '/search' }}>Log in</Link> to keep a history of your searches.</p>}
          {user && recent.loading && <p className="small muted">Loading…</p>}
          {user && recent.data && (recent.data.items.length === 0
            ? <p className="small muted mb-0">No searches yet.</p>
            : (
              <ul className="list-plain stack small">
                {recent.data.items.slice(0, 8).map((h) => (
                  <li key={h.id}>
                    {h.symbol ? <Link to={`/stocks/${h.symbol}`}>{h.company_name}</Link> : <Link to={`/search?q=${encodeURIComponent(h.query)}`}>“{h.query}”</Link>}
                    <div className="xsmall muted">{formatDateTime(h.searched_at)}</div>
                  </li>
                ))}
              </ul>
            ))}
          {user && <p className="small" style={{ marginTop: 12 }}><Link to="/history">Full search history</Link></p>}
        </aside>
      </div>
    </div>
  );
}
