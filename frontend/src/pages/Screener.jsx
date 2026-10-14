import { Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import FormField from '../components/FormField.jsx';
import Pagination from '../components/Pagination.jsx';
import ScreenerFilterPanel from '../components/ScreenerFilterPanel.jsx';
import { EmptyState, ErrorState, LoadingState, Notice } from '../components/States.jsx';
import StockTable from '../components/StockTable.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { api } from '../services/api.js';

const DEFAULT_SORT = { field: 'market_cap_cr', direction: 'desc' };
const PAGE_SIZE = 10;

/** Convert form strings into API criteria; returns { criteria, errors }. */
export function buildCriteria(values, sector, sort) {
  const filters = {};
  const errors = {};
  for (const [key, { min = '', max = '' }] of Object.entries(values)) {
    const parse = (s) => (s.trim() === '' ? null : Number(s.replace(/,/g, '')));
    const lo = parse(min);
    const hi = parse(max);
    if ((lo !== null && !Number.isFinite(lo)) || (hi !== null && !Number.isFinite(hi))) { errors[key] = 'Enter numbers only'; continue; }
    if (lo !== null && hi !== null && lo > hi) { errors[key] = 'Minimum must not exceed maximum'; continue; }
    if (lo !== null || hi !== null) filters[key] = { min: lo, max: hi };
  }
  return { criteria: { filters, sector: sector || null, sort }, errors };
}

const toFormValues = (filters = {}) => Object.fromEntries(Object.entries(filters).map(([k, r]) => [k, { min: r.min == null ? '' : String(r.min), max: r.max == null ? '' : String(r.max) }]));

export default function Screener() {
  useDocumentTitle('Stock screener');
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const filtersMeta = useApi((signal) => api.screenerFilters({ signal }), []);
  const [values, setValues] = useState({});
  const [sector, setSector] = useState('');
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [errors, setErrors] = useState({});
  const [run, setRun] = useState({ loading: false, data: null, error: null });
  const [loadedScreen, setLoadedScreen] = useState(null);
  const [save, setSave] = useState({ name: '', error: null, message: null, busy: false });

  const execute = useCallback(async (criteria, pageNo = 1) => {
    setRun((r) => ({ ...r, loading: true, error: null }));
    try {
      const data = await api.runScreener({ criteria, page: pageNo, page_size: PAGE_SIZE });
      setRun({ loading: false, data, error: null });
    } catch (error) {
      setRun({ loading: false, data: null, error });
    }
  }, []);

  // Load a saved screen from ?screen=<id> (opened from the Saved Screens page).
  const screenId = params.get('screen');
  useEffect(() => {
    if (!screenId || !user) {
      if (!screenId) execute({ filters: {}, sector: null, sort: DEFAULT_SORT });
      return;
    }
    api.savedScreen(screenId).then((s) => {
      setLoadedScreen(s);
      setValues(toFormValues(s.criteria.filters));
      setSector(s.criteria.sector ?? '');
      setSort(s.criteria.sort ?? DEFAULT_SORT);
      execute({ ...s.criteria, filters: s.criteria.filters ?? {} });
    }).catch((error) => setRun({ loading: false, data: null, error }));
  }, [screenId, user, execute]);

  const current = useMemo(() => buildCriteria(values, sector, sort), [values, sector, sort]);

  const submit = (pageNo = 1) => {
    setErrors(current.errors);
    if (Object.keys(current.errors).length) return;
    execute(current.criteria, pageNo);
  };

  const reset = () => {
    setValues({}); setSector(''); setSort(DEFAULT_SORT); setErrors({}); setLoadedScreen(null);
    if (screenId) setParams({});
    execute({ filters: {}, sector: null, sort: DEFAULT_SORT });
  };

  const changeSort = (s) => {
    setSort(s);
    if (!Object.keys(current.errors).length) execute({ ...current.criteria, sort: s }, 1);
  };

  const saveScreen = async (e) => {
    e.preventDefault();
    if (Object.keys(current.errors).length) return setErrors(current.errors);
    const name = save.name.trim();
    if (!name) return setSave((s) => ({ ...s, error: 'Give the screen a name' }));
    if (name.length > 80) return setSave((s) => ({ ...s, error: 'Name must be at most 80 characters' }));
    setSave((s) => ({ ...s, busy: true, error: null, message: null }));
    try {
      const created = await api.createScreen({ name, criteria: current.criteria });
      setSave({ name: '', busy: false, error: null, message: `Saved “${created.name}”.` });
      setLoadedScreen(created);
    } catch (err) {
      setSave((s) => ({ ...s, busy: false, error: err.details?.name ?? err.message }));
    }
  };

  const updateLoaded = async () => {
    setSave((s) => ({ ...s, busy: true, error: null, message: null }));
    try {
      const updated = await api.updateScreen(loadedScreen.id, { criteria: current.criteria });
      setLoadedScreen(updated);
      setSave((s) => ({ ...s, busy: false, message: `Updated “${updated.name}”.` }));
    } catch (err) {
      setSave((s) => ({ ...s, busy: false, error: err.message }));
    }
  };

  const fields = filtersMeta.data?.fields ?? [];
  const columns = fields.filter((f) => ['market_cap_cr', 'pe_ratio', 'pb_ratio', 'roe', 'roce', 'debt_to_equity', 'revenue_growth', 'net_income_growth', 'dividend_yield'].includes(f.key)).map((f) => ({ key: f.key, label: f.label.replace(' (YoY)', '') }));
  const d = run.data;

  return (
    <div className="container page">
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Screener' }]} />
      <header className="page-header">
        <h1>Stock screener</h1>
        <p className="lead">Filter the supported company universe by fundamentals. A company is excluded from a filtered result if the metric is unavailable for it.</p>
        {loadedScreen && <Notice tone="info">Saved screen: <strong>{loadedScreen.name}</strong>{loadedScreen.description ? ` - ${loadedScreen.description}` : ''}</Notice>}
      </header>
      {filtersMeta.loading && <LoadingState label="Loading filters…" />}
      {filtersMeta.error && <ErrorState error={filtersMeta.error} onRetry={filtersMeta.reload} />}
      {filtersMeta.data && (
        <div className="screener-layout">
          <div className="stack">
            <ScreenerFilterPanel fields={fields} sectors={filtersMeta.data.sectors} values={values} sector={sector} errors={errors} busy={run.loading}
              onChange={(key, bound, v) => setValues((s) => ({ ...s, [key]: { ...(s[key] ?? { min: '', max: '' }), [bound]: v } }))}
              onSector={setSector} onSubmit={() => submit(1)} onReset={reset} />
            <section className="card card--tight" aria-labelledby="save-title">
              <h2 id="save-title" style={{ fontSize: 'var(--text-lg)', display: 'flex', gap: 8, alignItems: 'center' }}><Save size={18} aria-hidden="true" /> Save this screen</h2>
              {!user && <p className="small mb-0"><Link to="/login" state={{ from: '/screener' }}>Log in</Link> to save screens.</p>}
              {user && (
                <form className="form" onSubmit={saveScreen} noValidate>
                  <FormField label="Screen name" error={save.error}>
                    <input className="input" value={save.name} maxLength={100} onChange={(e) => setSave((s) => ({ ...s, name: e.target.value, error: null }))} />
                  </FormField>
                  <div className="btn-row">
                    <button type="submit" className="btn btn--secondary" disabled={save.busy}>Save as new</button>
                    {loadedScreen && <button type="button" className="btn btn--ghost" onClick={updateLoaded} disabled={save.busy}>Update “{loadedScreen.name}”</button>}
                  </div>
                  <p role="status" className="small mb-0">{save.message && <span className="change--pos">{save.message} <Link to="/saved-screens">View saved screens</Link></span>}</p>
                </form>
              )}
            </section>
          </div>
          <section aria-labelledby="results-title" aria-live="polite" aria-busy={run.loading}>
            <div className="section__head">
              <h2 id="results-title">Results</h2>
              <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>Sort by
                <select className="select" style={{ width: 'auto', minHeight: 34 }} value={`${sort.field}:${sort.direction}`} onChange={(e) => { const [field, direction] = e.target.value.split(':'); changeSort({ field, direction }); }}>
                  <option value="company_name:asc">Company name (A-Z)</option>
                  {fields.flatMap((f) => [<option key={`${f.key}d`} value={`${f.key}:desc`}>{f.label} (high → low)</option>, <option key={`${f.key}a`} value={`${f.key}:asc`}>{f.label} (low → high)</option>])}
                </select>
              </label>
            </div>
            {run.loading && !d && <LoadingState label="Running screen…" />}
            {run.error && <ErrorState error={run.error} />}
            {d && (
              <>
                <p className="small">
                  <strong>{d.total}</strong> of {d.considered} companies match{d.considered !== d.universe_size ? ` (sector filter applied; universe ${d.universe_size})` : ''}.
                  {d.excluded_missing_data > 0 && ` ${d.excluded_missing_data} excluded because a filtered metric is unavailable.`}
                  {d.unavailable?.length > 0 && ` ${d.unavailable.length} companies had no data.`}
                </p>
                {d.provider?.is_demo && <Notice tone="demo">Results are based on illustrative demo data.</Notice>}
                {d.total === 0
                  ? <EmptyState title="No companies match these filters">Try widening a range or removing a filter.</EmptyState>
                  : <StockTable rows={d.results} columns={columns} caption="Screener results" sort={sort} onSort={changeSort} />}
                <Pagination page={d.page} pages={d.pages} total={d.total} onPage={(p) => submit(p)} label="matching companies" />
              </>
            )}
            <p className="xsmall muted" style={{ marginTop: 12 }}>Results depend on the companies FundamentalX covers and on the freshness and completeness of their data. Growth is year-on-year for the latest fiscal year. This is not a recommendation to buy or sell any security.</p>
          </section>
        </div>
      )}
    </div>
  );
}
