import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { glossaryForMetric } from '../data/glossary.js';
import { formatDate, formatMetric } from '../utils/format.js';

const STATUS_TEXT = { unavailable: 'Unavailable', not_meaningful: 'Not meaningful' };

const FLAG_TEXT = {
  extreme: 'Unusually large change - check for one-off items',
  turnaround_loss_to_profit: 'Moved from a loss to a profit',
  loss_in_both_periods: 'Loss in both periods',
  turned_negative: 'Turned negative',
  net_cash_position: 'Net cash position (cash exceeds debt)',
  negative_ebit: 'Operating loss',
  ebitda_derived_from_ebit_plus_da: 'EBITDA derived as EBIT + D&A',
  gross_profit_derived_from_revenue_minus_cost: 'Gross profit derived as revenue − cost',
  capex_sign_normalized: 'Capex sign normalised',
  financial_sector_interpret_with_care: 'Bank: interpret leverage differently',
};
export const flagText = (f) => FLAG_TEXT[f] ?? f.replaceAll('_', ' ');

/**
 * One financial metric from the Python engine. Missing values are shown as
 * "Unavailable"/"Not meaningful" with the reason - never as 0 and never
 * with a green/red colour.
 */
export default function MetricCard({ metric, label, description, unit, sourceNote = 'Calculated', signed = false }) {
  const name = label ?? metric?.label ?? 'Metric';
  const has = metric && metric.value !== null && metric.value !== undefined;
  const glossary = metric ? glossaryForMetric(metric.key) : null;
  const tone = signed && has ? (metric.value > 0 ? 'change--pos' : metric.value < 0 ? 'change--neg' : '') : '';
  return (
    <article className="metric-card" aria-label={name}>
      <h3 className="metric-card__name mb-0">
        <span>{name}</span>
        {glossary && (
          <Link to={`/glossary#${glossary.slug}`} className="info-link" title={`${glossary.formula} - open glossary`}>
            <Info size={14} aria-hidden="true" /><span className="visually-hidden">What is {name}?</span>
          </Link>
        )}
      </h3>
      {has
        ? <p className={`metric-card__value mb-0 ${tone}`}>{formatMetric(metric, { unit })}</p>
        : <p className="metric-card__value metric-card__value--na mb-0">{STATUS_TEXT[metric?.status] ?? 'Unavailable'}</p>}
      {!has && metric?.reason && <p className="metric-card__reason">{metric.reason}</p>}
      {has && metric.flags?.length > 0 && <p className="metric-card__reason">{metric.flags.map(flagText).join(' · ')}</p>}
      {description && <p className="metric-card__desc">{description}</p>}
      <p className="metric-card__meta mb-0">
        {[metric?.status === 'reported' ? 'Reported by provider' : metric?.status === 'calculated' ? sourceNote : null,
          metric?.period_end ? `FY ending ${formatDate(metric.period_end)}` : null].filter(Boolean).join(' · ')}
      </p>
    </article>
  );
}

export function MetricGrid({ metrics, keys, unit, descriptions = {}, signedKeys = [] }) {
  return (
    <div className="metric-grid">
      {keys.filter((k) => metrics?.[k] !== undefined).map((k) => (
        <MetricCard key={k} metric={metrics[k]} unit={unit} description={descriptions[k]} signed={signedKeys.includes(k)} />
      ))}
    </div>
  );
}
