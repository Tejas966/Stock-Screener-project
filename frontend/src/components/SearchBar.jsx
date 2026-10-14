import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebounce } from '../hooks/useDebounce.js';
import { api } from '../services/api.js';

/**
 * Company search with suggestions (ARIA combobox pattern):
 *   ↑/↓ move through suggestions, Enter opens the highlighted company (or the
 *   full results page), Escape closes the list.
 * `onSelect(company)` overrides the default "open stock page" behaviour.
 */
export default function SearchBar({ variant = 'default', placeholder = 'Search company or symbol, e.g. Infosys or TCS', onSelect, autoFocus = false, label = 'Search companies', clearOnSelect = false }) {
  const [text, setText] = useState('');
  const [result, setResult] = useState({ query: '', items: [] });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState(null);
  const debounced = useDebounce(text.trim(), 200);
  const navigate = useNavigate();
  const { user } = useAuth();
  const listId = useId();
  const inputId = useId();
  const wrapRef = useRef(null);

  useEffect(() => {
    if (debounced.length < 1 || debounced.length > 60) {
      setResult({ query: '', items: [] });
      return undefined;
    }
    const controller = new AbortController();
    api.search(debounced, { signal: controller.signal })
      .then((d) => { setResult({ query: debounced, items: d.results.slice(0, 8) }); setError(null); setActive(-1); })
      .catch((e) => { if (e.name !== 'AbortError') { setResult({ query: debounced, items: [] }); setError(e.message); } });
    return () => controller.abort();
  }, [debounced]);

  useEffect(() => {
    const close = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (company) => {
    setOpen(false);
    if (clearOnSelect) setText('');
    if (onSelect) return onSelect(company);
    if (user) api.recordSearch(text.trim() || company.ticker, company.symbol).catch(() => {});
    navigate(`/stocks/${encodeURIComponent(company.symbol)}`);
    setText('');
  };

  const submit = (e) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return choose(items[active]);
    const q = text.trim();
    if (!q) return;
    setOpen(false);
    if (onSelect) {
      if (items[0]) choose(items[0]);
      return;
    }
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, -1)); }
    else if (e.key === 'Escape') { setOpen(false); setActive(-1); }
  };

  // Only show suggestions that belong to the text currently typed (never stale results).
  const pending = text.trim() !== result.query;
  const items = pending ? [] : result.items;
  const showList = open && text.trim().length > 0;
  return (
    <form role="search" className={`search ${variant !== 'default' ? `search--${variant}` : ''}`} onSubmit={submit} ref={wrapRef}>
      <label htmlFor={inputId} className="visually-hidden">{label}</label>
      <div className="search__box">
        <Search size={variant === 'lg' ? 22 : 18} aria-hidden="true" />
        <input
          id={inputId}
          className="search__input"
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          autoComplete="off"
          maxLength={60}
          placeholder={placeholder}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => { setText(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {variant === 'lg' && <button type="submit" className="btn btn--primary" style={{ margin: 4 }}>Search</button>}
      </div>
      {showList && (
        <ul className="search__list" id={listId} role="listbox" aria-label="Suggestions">
          {pending && <li className="search__empty" role="option" aria-selected="false" aria-disabled="true">Searching…</li>}
          {!pending && error && <li className="search__empty" role="option" aria-selected="false" aria-disabled="true">{error}</li>}
          {!pending && !error && items.length === 0 && <li className="search__empty" role="option" aria-selected="false" aria-disabled="true">No matching companies in the supported universe</li>}
          {items.map((c, i) => (
            <li
              key={c.symbol}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="search__option"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(c)}
              onMouseEnter={() => setActive(i)}
            >
              <span><strong>{c.name}</strong> <span className="muted">· {c.sector?.name ?? 'Unclassified'}</span></span>
              <span className="badge badge--neutral">{c.ticker} · {c.exchange}</span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
