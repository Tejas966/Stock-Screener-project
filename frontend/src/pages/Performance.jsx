import { useState } from 'react';
import { PriceChart } from '../components/Charts.jsx';
import DataFreshness from '../components/DataFreshness.jsx';
import { ErrorState, LoadingState, Notice } from '../components/States.jsx';
import { useApi } from '../hooks/useApi.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useStock } from '../hooks/useStock.js';
import { api } from '../services/api.js';
import { changeClass, formatDate, formatPercent } from '../utils/format.js';

const RANGES = [['1M', '1 month'], ['6M', '6 months'], ['1Y', '1 year'], ['3Y', '3 years'], ['5Y', '5 years']];

export default function Performance() {
  const { bundle } = useStock();
  const { company } = bundle;
  useDocumentTitle(`${company.ticker} performance`);
  const [range, setRange] = useState('1Y');
  const { data, error, loading, reload } = useApi((signal) => api.history(company.symbol, range, { signal }), [company.symbol, range]);
  const returns = data?.returns;

  return (
    <div className="stack" style={{ gap: 'var(--space-5)' }}>
      <header>
        <h2 className="mb-0">Historical performance</h2>
        <p className="muted">Daily closing prices and period returns.</p>
      </header>
      <section className="card" aria-labelledby="perf-chart">
        <div className="section__head">
          <h3 id="perf-chart" style={{ margin: 0 }}>Closing price</h3>
          <div className="segmented" role="group" aria-label="Time window">
            {RANGES.map(([r, label]) => <button key={r} type="button" aria-pressed={range === r} aria-label={label} onClick={() => setRange(r)}>{r}</button>)}
          </div>
        </div>
        {loading && <LoadingState label="Loading prices…" />}
        {error && <ErrorState error={error} onRetry={reload} />}
        {data && !loading && (
          <>
            <PriceChart prices={data.prices} isDemo={data.meta?.is_demo} />
            <DataFreshness meta={data.meta} label={data.available ? `history available ${formatDate(data.available.from)} – ${formatDate(data.available.to)}` : 'no history'} />
          </>
        )}
      </section>
      <section aria-labelledby="ret-title">
        <h3 id="ret-title">Period returns</h3>
        <Notice tone="info" title="Price return only:">dividends are not included, so these figures understate the total return of dividend-paying companies. Past performance does not indicate future results.</Notice>
        {data?.returns_error && <ErrorState title="Returns could not be calculated" error={data.returns_error} />}
        {returns && (
          <div className="table-wrap" style={{ marginTop: 12 }} tabIndex={0} role="region" aria-label="Period returns">
            <table className="table">
              <caption className="visually-hidden">Price returns by period</caption>
              <thead><tr><th scope="col">Period</th><th scope="col" className="num">Price return</th><th scope="col" className="num">Annualised</th><th scope="col">From</th></tr></thead>
              <tbody>
                {RANGES.map(([r, label]) => {
                  const w = returns.windows?.[r];
                  return (
                    <tr key={r}>
                      <th scope="row">{label}</th>
                      <td className={`num ${changeClass(w?.value)}`}>{w?.value == null ? <span className="na" title={w?.reason}>Not enough history</span> : formatPercent(w.value, 1, { sign: true })}</td>
                      <td className="num">{w?.annualized_pct == null ? '—' : formatPercent(w.annualized_pct, 1, { sign: true })}</td>
                      <td>{w?.start_date ? formatDate(w.start_date) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {returns && (
          <dl className="kv card card--tight" style={{ marginTop: 12 }}>
            <dt>Annualised volatility</dt><dd>{formatPercent(returns.annualized_volatility_pct)} <span className="muted">(std. dev. of daily log returns × √252)</span></dd>
            <dt>Maximum drawdown</dt><dd>{formatPercent(returns.max_drawdown_pct)} <span className="muted">(largest fall from a previous peak)</span></dd>
            <dt>Observations</dt><dd>{returns.observations} trading days</dd>
          </dl>
        )}
      </section>
    </div>
  );
}
