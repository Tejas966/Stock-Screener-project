import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatNumber, formatPrice } from '../utils/format.js';

const SERIES_COLORS = ['#1f4e8c', '#c2410c', '#146c4e', '#6b3fa0', '#9a6700'];

const shortDate = (iso) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

/**
 * Close-price line chart. Only actual observations are plotted - gaps are
 * not filled and never drawn as zero. A text summary and a data table give
 * screen-reader users the same information.
 */
export function PriceChart({ prices, height = 300, isDemo, title = 'Closing price' }) {
  const summary = useMemo(() => {
    if (!prices?.length) return null;
    const closes = prices.map((p) => p.close);
    const first = prices[0];
    const last = prices[prices.length - 1];
    return { first, last, min: Math.min(...closes), max: Math.max(...closes), change: (last.close / first.close - 1) * 100 };
  }, [prices]);
  if (!prices?.length) return <p className="muted">No price history is available for this period.</p>;
  const step = Math.max(1, Math.ceil(prices.length / 120)); // keep tables short
  return (
    <figure className="mb-0" style={{ margin: 0 }}>
      <div className="chart-box" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={prices} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#e6e9ee" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={40} tick={{ fontSize: 12, fill: '#56637a' }} />
            <YAxis domain={['auto', 'auto']} tickFormatter={(v) => formatNumber(v, { max: 0 })} width={64} tick={{ fontSize: 12, fill: '#56637a' }} />
            <Tooltip formatter={(v) => [formatPrice(v), isDemo ? 'Close (illustrative)' : 'Close']} labelFormatter={(l) => formatDate(l)} />
            <Line type="monotone" dataKey="close" stroke="#1f4e8c" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="chart-summary">
        {title}{isDemo ? ' (illustrative demo prices)' : ''}: from {formatPrice(summary.first.close)} on {formatDate(summary.first.date)} to {formatPrice(summary.last.close)} on {formatDate(summary.last.date)}
        {' '}({summary.change >= 0 ? '+' : ''}{formatNumber(summary.change, { min: 1, max: 1 })}%). Range {formatPrice(summary.min)} – {formatPrice(summary.max)}. {prices.length} trading-day observations.
      </figcaption>
      <details className="data-table-toggle">
        <summary>Show price data table</summary>
        <div className="table-wrap" tabIndex={0} style={{ maxHeight: 280 }}>
          <table className="table">
            <caption className="visually-hidden">{title}</caption>
            <thead><tr><th scope="col">Date</th><th scope="col" className="num">Close (₹)</th></tr></thead>
            <tbody>{prices.filter((_, i) => i % step === 0 || i === prices.length - 1).map((p) => <tr key={p.date}><td>{formatDate(p.date)}</td><td className="num">{formatNumber(p.close, { min: 2, max: 2 })}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * Annual trend chart (bars or lines). `data` rows: { label, [seriesKey]: number|null }.
 * Null values are left as gaps so a missing year never looks like zero.
 */
export function TrendChart({ data, series, kind = 'bar', unitLabel, valueFormatter = (v) => formatNumber(v, { max: 1 }), height = 280, caption }) {
  const hasData = data?.some((row) => series.some((s) => row[s.key] != null));
  if (!hasData) return <p className="muted">Not enough data to draw this chart.</p>;
  const Chart = kind === 'line' ? LineChart : BarChart;
  return (
    <figure style={{ margin: 0 }}>
      <div className="chart-box" style={{ height }} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="#e6e9ee" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#56637a' }} />
            <YAxis tickFormatter={(v) => formatNumber(v, { max: 0 })} width={70} tick={{ fontSize: 12, fill: '#56637a' }} label={unitLabel ? { value: unitLabel, angle: -90, position: 'insideLeft', fontSize: 12, fill: '#56637a' } : undefined} />
            <Tooltip formatter={(v, name) => [v == null ? 'Not available' : valueFormatter(v), name]} />
            <Legend wrapperStyle={{ fontSize: 13 }} />
            {series.map((s, i) => (kind === 'line'
              ? <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES_COLORS[i % 5]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
              : <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES_COLORS[i % 5]} isAnimationActive={false} />))}
          </Chart>
        </ResponsiveContainer>
      </div>
      <details className="data-table-toggle">
        <summary>Show chart data as a table</summary>
        <div className="table-wrap" tabIndex={0}>
          <table className="table">
            <caption>{caption ?? 'Chart data'}{unitLabel ? ` (${unitLabel})` : ''}</caption>
            <thead><tr><th scope="col">Period</th>{series.map((s) => <th key={s.key} scope="col" className="num">{s.label}</th>)}</tr></thead>
            <tbody>{data.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{series.map((s) => <td key={s.key} className="num">{row[s.key] == null ? <span className="na">n/a</span> : valueFormatter(row[s.key])}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
