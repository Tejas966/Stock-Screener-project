import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';

export default function Sectors() {
  useDocumentTitle('Sectors');
  const { data, error, loading, reload } = useApi((signal) => api.sectors({ signal }), []);
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!data) return [];
    return data.filter((s) => !f || s.name.toLowerCase().includes(f) || s.companies.some((c) => c.name.toLowerCase().includes(f)));
  }, [data, filter]);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Sectors' }]} />
      <header className="page-header">
        <h1>Sector directory</h1>
        <p className="lead">Sectors represented in the supported company universe. Open a sector for peer comparisons and medians.</p>
      </header>
      <div className="field" style={{ maxWidth: 420, marginBottom: 'var(--space-4)' }}>
        <label htmlFor="sector-search">Filter sectors or companies</label>
        <input id="sector-search" type="search" className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="e.g. bank, pharma, Infosys" />
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && shown.length === 0 && <EmptyState title="No sectors match your filter" />}
      <ul className="grid grid--wide-auto list-plain">
        {shown.map((s) => (
          <li key={s.slug}>
            <article className="card card--tight" style={{ height: '100%' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-sans)' }}><Link to={`/sectors/${s.slug}`}>{s.name}</Link></h2>
              <p className="small muted">{s.description}</p>
              <p className="xsmall muted">{s.companies.length} {s.companies.length === 1 ? 'company' : 'companies'}</p>
              <ul className="list-plain small" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                {s.companies.map((c) => <li key={c.symbol}><Link to={`/stocks/${c.symbol}`}>{c.name}</Link></li>)}
              </ul>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
