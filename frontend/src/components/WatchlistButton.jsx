import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';

/** Adds a company to the watchlist; shows the real server result (not an optimistic fake). */
export default function WatchlistButton({ symbol }) {
  const { user } = useAuth();
  const [state, setState] = useState({ busy: false, itemId: null, message: null, error: null });

  useEffect(() => {
    if (!user) return undefined;
    const controller = new AbortController();
    api.watchlist({ signal: controller.signal })
      .then((d) => setState((s) => ({ ...s, itemId: d.items.find((i) => i.company.symbol === symbol)?.id ?? null })))
      .catch(() => {});
    return () => controller.abort();
  }, [user, symbol]);

  if (!user) return <Link to="/login" state={{ from: `/stocks/${symbol}` }} className="btn btn--secondary btn--sm"><Star size={14} aria-hidden="true" /> Log in to watch</Link>;

  const toggle = async () => {
    setState((s) => ({ ...s, busy: true, error: null, message: null }));
    try {
      if (state.itemId) {
        await api.removeFromWatchlist(state.itemId);
        setState({ busy: false, itemId: null, message: 'Removed from watchlist', error: null });
      } else {
        const r = await api.addToWatchlist(symbol);
        setState({ busy: false, itemId: r.id, message: 'Added to watchlist', error: null });
      }
    } catch (e) {
      setState((s) => ({ ...s, busy: false, error: e.message }));
    }
  };

  return (
    <span className="btn-row">
      <button type="button" className={`btn btn--sm ${state.itemId ? 'btn--secondary' : 'btn--primary'}`} onClick={toggle} disabled={state.busy} aria-pressed={Boolean(state.itemId)}>
        <Star size={14} aria-hidden="true" fill={state.itemId ? 'currentColor' : 'none'} /> {state.itemId ? 'In watchlist' : 'Add to watchlist'}
      </button>
      <span role="status" className="xsmall muted">{state.error ? <span className="change--neg">{state.error}</span> : state.message}</span>
    </span>
  );
}
