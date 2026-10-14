import { useMemo, useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { EmptyState } from '../components/States.jsx';
import { GLOSSARY } from '../data/glossary.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function Glossary() {
  useDocumentTitle('Financial glossary');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All');
  const categories = useMemo(() => ['All', ...new Set(GLOSSARY.map((g) => g.category))], []);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return GLOSSARY
      .filter((g) => category === 'All' || g.category === category)
      .filter((g) => !needle || `${g.term} ${g.definition} ${g.formula}`.toLowerCase().includes(needle))
      .sort((a, b) => a.term.localeCompare(b.term));
  }, [q, category]);

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Glossary' }]} />
      <header className="page-header">
        <h1>Financial glossary</h1>
        <p className="lead">Plain-language definitions of every metric FundamentalX calculates, with formulas and worked examples.</p>
      </header>
      <div className="inline-fields" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label htmlFor="g-search">Search terms</label>
          <input id="g-search" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. ROE, cash, debt" />
        </div>
        <div className="field">
          <span className="label" id="g-cat">Category</span>
          <div className="segmented" role="group" aria-labelledby="g-cat" style={{ flexWrap: 'wrap' }}>
            {categories.map((c) => <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
        </div>
      </div>
      <p className="small muted" aria-live="polite">{shown.length} term{shown.length === 1 ? '' : 's'}</p>
      {shown.length === 0 && <EmptyState title="No terms match your search" />}
      <div className="grid grid--wide-auto">
        {shown.map((g) => (
          <article key={g.slug} id={g.slug} className="card card--tight glossary-entry">
            <p className="eyebrow mb-0">{g.category}</p>
            <h2 style={{ fontSize: 'var(--text-lg)', fontFamily: 'var(--font-sans)' }}>{g.term}</h2>
            <p>{g.definition}</p>
            <dl className="kv">
              <dt>Formula</dt><dd><code>{g.formula}</code></dd>
              <dt>Example</dt><dd>{g.example}</dd>
            </dl>
            <p className="small" style={{ marginTop: 'var(--space-3)', color: 'var(--warning)' }}><strong>Watch out:</strong> {g.caveat}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
