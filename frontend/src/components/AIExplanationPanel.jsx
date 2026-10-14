import { Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useMeta } from '../context/MetaContext.jsx';
import { api } from '../services/api.js';
import { formatDateTime } from '../utils/format.js';

/**
 * "Explain these fundamentals" - calls the Node gateway, which calls Gemini.
 * The validated JSON is rendered as plain text only (React escapes it; no
 * HTML is ever injected). Failures never affect the numbers on the page.
 */
export default function AIExplanationPanel({ symbol, analysisAvailable }) {
  const { user } = useAuth();
  const { meta } = useMeta();
  const [state, setState] = useState({ loading: false, data: null, error: null });

  const run = async () => {
    setState({ loading: true, data: null, error: null });
    try {
      setState({ loading: false, data: await api.explain(symbol), error: null });
    } catch (error) {
      setState({ loading: false, data: null, error });
    }
  };

  const ex = state.data?.explanation;
  return (
    <section className="card ai-panel" aria-labelledby="ai-title" aria-busy={state.loading}>
      <div className="ai-panel__head">
        <h2 id="ai-title" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 'var(--text-xl)', margin: 0 }}>
          <Sparkles size={20} aria-hidden="true" /> AI explanation
        </h2>
        {user ? (
          <button type="button" className="btn btn--primary" onClick={run} disabled={state.loading || !analysisAvailable || meta?.ai?.configured === false}>
            {state.loading ? 'Generating…' : ex ? 'Regenerate' : 'Explain these fundamentals'}
          </button>
        ) : (
          <Link to="/login" state={{ from: `/stocks/${symbol}/fundamentals` }} className="btn btn--secondary">Log in to use AI explanations</Link>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 'var(--space-2)' }}>
        Gemini receives only the figures shown on this page and is instructed not to add numbers, predictions or buy/sell advice.
        AI-generated explanations can be incorrect and do not replace your own research.
      </p>
      {meta?.ai?.configured === false && <p className="notice notice--warning">AI explanations are not configured on this server (no Gemini API key). All numerical analysis still works.</p>}
      {!analysisAvailable && <p className="notice notice--warning">The numerical analysis is not available, so there is nothing to explain yet.</p>}
      <div aria-live="polite">
        {state.loading && <p className="muted">Asking Gemini to explain the calculated metrics…</p>}
        {state.error && (
          <div className="state--error" role="alert">
            <strong>Explanation unavailable.</strong> {state.error.message}
            <p className="small mb-0">The numerical fundamentals above are unaffected.</p>
          </div>
        )}
        {ex && (
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            {state.data.is_demo_data && <p className="notice notice--demo mb-0">This explanation describes <strong>illustrative demo figures</strong>, not the company's real results.</p>}
            {state.data.ungrounded_numbers?.length > 0 && (
              <p className="notice notice--warning mb-0"><TriangleAlert size={16} aria-hidden="true" /> These numbers in the AI text could not be matched to the supplied data and may be wrong: {state.data.ungrounded_numbers.join(', ')}</p>
            )}
            <div><h3>Summary</h3><p>{ex.executive_summary}</p></div>
            <div className="grid grid--2">
              <div><h3>Relative strengths in the data</h3>{ex.positive_observations.length ? <ul>{ex.positive_observations.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="muted">None identified.</p>}</div>
              <div><h3>Risk factors indicated</h3>{ex.risk_factors.length ? <ul>{ex.risk_factors.map((t) => <li key={t}>{t}</li>)}</ul> : <p className="muted">None identified.</p>}</div>
            </div>
            {ex.metric_explanations.length > 0 && (
              <div><h3>What the metrics mean</h3><dl>{ex.metric_explanations.map((m) => <div key={m.metric}><dt>{m.metric}</dt><dd>{m.explanation}</dd></div>)}</dl></div>
            )}
            <div><h3>Data limitations</h3><ul>{ex.data_limitations.map((t) => <li key={t}>{t}</li>)}</ul></div>
            <p className="notice notice--info mb-0">{ex.overall_caveat}</p>
            <p className="xsmall muted mb-0">Model: {state.data.model} · {state.data.cached ? 'cached result' : 'generated'} {formatDateTime(state.data.generated_at)} · {state.data.disclaimer}</p>
          </div>
        )}
      </div>
    </section>
  );
}
