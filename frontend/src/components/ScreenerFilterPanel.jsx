import { RotateCcw, SlidersHorizontal } from 'lucide-react';

/**
 * Controlled filter form. `values` = { [fieldKey]: { min: string, max: string } }.
 * Inputs are kept as strings while typing and converted/validated by the parent.
 */
export default function ScreenerFilterPanel({ fields, sectors, values, sector, errors, onChange, onSector, onSubmit, onReset, busy }) {
  const groups = fields.reduce((acc, f) => ({ ...acc, [f.group]: [...(acc[f.group] ?? []), f] }), {});
  return (
    <form className="card card--tight" onSubmit={(e) => { e.preventDefault(); onSubmit(); }} noValidate aria-labelledby="filters-title">
      <h2 id="filters-title" style={{ fontSize: 'var(--text-lg)', display: 'flex', gap: 8, alignItems: 'center' }}><SlidersHorizontal size={18} aria-hidden="true" /> Filters</h2>
      <div className="field" style={{ marginBottom: 12 }}>
        <label htmlFor="sector-filter">Sector</label>
        <select id="sector-filter" className="select" value={sector} onChange={(e) => onSector(e.target.value)}>
          <option value="">All sectors</option>
          {sectors.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>
      {Object.entries(groups).map(([group, list]) => (
        <fieldset key={group} className="filter-group">
          <legend>{group}</legend>
          {list.map((f) => {
            const err = errors[f.key];
            const v = values[f.key] ?? { min: '', max: '' };
            return (
              <div key={f.key} className="field filter-field">
                <span className="label" id={`lbl-${f.key}`}>{f.label} <span className="muted xsmall">({f.unit})</span></span>
                <div className="range-inputs">
                  <input className="input" inputMode="decimal" aria-label={`${f.label} minimum`} placeholder="Min" value={v.min} onChange={(e) => onChange(f.key, 'min', e.target.value)} aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `err-${f.key}` : undefined} />
                  <input className="input" inputMode="decimal" aria-label={`${f.label} maximum`} placeholder="Max" value={v.max} onChange={(e) => onChange(f.key, 'max', e.target.value)} aria-invalid={err ? 'true' : undefined} aria-describedby={err ? `err-${f.key}` : undefined} />
                </div>
                {err && <span id={`err-${f.key}`} className="field-error" role="alert">{err}</span>}
              </div>
            );
          })}
        </fieldset>
      ))}
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Running…' : 'Run screen'}</button>
        <button type="button" className="btn btn--secondary" onClick={onReset}><RotateCcw size={14} aria-hidden="true" /> Reset filters</button>
      </div>
    </form>
  );
}
