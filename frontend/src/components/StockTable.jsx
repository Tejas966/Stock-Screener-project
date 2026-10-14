import { ArrowDown, ArrowUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { changeClass, formatCrore, formatMultiple, formatPercent, formatPrice, formatRatio } from '../utils/format.js';

export const COLUMN_FORMAT = {
  market_cap_cr: formatCrore, pe_ratio: formatMultiple, pb_ratio: formatMultiple, ev_ebitda: formatMultiple,
  dividend_yield: (v) => formatPercent(v, 2), roe: formatPercent, roce: formatPercent, operating_margin: formatPercent, net_margin: formatPercent,
  revenue_growth: (v) => formatPercent(v, 1, { sign: true }), net_income_growth: (v) => formatPercent(v, 1, { sign: true }), eps_growth: (v) => formatPercent(v, 1, { sign: true }),
  debt_to_equity: (v) => formatRatio(v), current_ratio: (v) => formatRatio(v), interest_coverage: formatMultiple,
};

/**
 * Table of metric rows (screener, watchlist, sector peers).
 * columns: [{ key, label }]. Sorting is controlled by the parent.
 */
export default function StockTable({ rows, columns, caption, sort, onSort, actions, showPrice = true }) {
  const header = (c) => {
    if (!onSort) return c.label;
    const activeSort = sort?.field === c.key;
    const nextDir = activeSort && sort.direction === 'desc' ? 'asc' : 'desc';
    return (
      <button type="button" className="sort-btn" onClick={() => onSort({ field: c.key, direction: c.key === 'company_name' && !activeSort ? 'asc' : nextDir })}>
        {c.label}{activeSort && (sort.direction === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
      </button>
    );
  };
  const ariaSort = (key) => (sort?.field === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined);
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort={ariaSort('company_name')}>{header({ key: 'company_name', label: 'Company' })}</th>
            {showPrice && <th scope="col" className="num">Price</th>}
            {columns.map((c) => <th key={c.key} scope="col" className="num" aria-sort={ariaSort(c.key)}>{header(c)}</th>)}
            {actions && <th scope="col"><span className="visually-hidden">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.company.symbol}>
              <th scope="row">
                <Link to={`/stocks/${encodeURIComponent(r.company.symbol)}`}>{r.company.name}</Link>
                <div className="xsmall muted">{r.company.ticker} · {r.company.exchange} · {r.company.sector?.name}</div>
              </th>
              {showPrice && (
                <td className="num">{formatPrice(r.price)}<div className={`xsmall ${changeClass(r.change_pct)}`}>{formatPercent(r.change_pct, 2, { sign: true })}</div></td>
              )}
              {columns.map((c) => {
                const v = r.metrics?.[c.key];
                const st = r.statuses?.[c.key];
                return (
                  <td key={c.key} className="num">
                    {v == null
                      ? <span className="na" title={st?.reason ?? 'Not available'}>{st?.status === 'not_meaningful' ? 'n.m.' : '—'}</span>
                      : (COLUMN_FORMAT[c.key] ?? formatRatio)(v)}
                  </td>
                );
              })}
              {actions && <td>{actions(r)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
