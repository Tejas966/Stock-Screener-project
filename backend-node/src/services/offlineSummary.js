/**
 * Built-in, rule-based written summary - the offline alternative to Gemini.
 *
 * It produces exactly the same structure as the AI explanation
 * (explanationSchema), but every sentence comes from a fixed rule applied to
 * the Python-calculated metrics, so it works without internet and cannot
 * invent numbers. Comparisons are made against the company's own history and
 * against its sector peers in the FundamentalX universe - never against
 * universal "good/bad" thresholds - and it never says buy, sell or hold.
 */
import { CRORE } from '../utils/format.js';
import { explanationSchema } from './geminiService.js';

const MIN_PEERS = 3; // below this, peer comparisons are skipped (not representative)
const SECTOR_SPECIFIC_NM = new Set(['current_ratio', 'roce', 'ev_ebitda', 'gross_margin', 'interest_coverage', 'enterprise_value']);

const fmt = (v, dp = 1) => Number(v).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (v, dp = 1) => `${fmt(v, dp)}%`;
const times = (v, dp = 1) => `${fmt(v, dp)}×`;
const crore = (v) => `₹${fmt(v / CRORE, 0)} crore`;
const val = (m) => (m && m.value !== null && m.value !== undefined ? m.value : null);
const fy = (y) => `FY${String(y).slice(-2)}`;

/** Peer median for a metric, only when enough peers report it. */
function peerMedian(peerStats, key) {
  const s = peerStats?.[key];
  return s && s.count >= MIN_PEERS && s.median !== null ? { median: s.median, n: s.count } : null;
}

/**
 * @param bundle     getCompanyBundle() result (needs bundle.analysis)
 * @param peerStats  Python /v1/statistics output for the company's sector, or null
 * @returns explanation object that passes explanationSchema
 */
export function buildOfflineSummary(bundle, peerStats = null) {
  const { company, analysis, provider } = bundle;
  const v = analysis.valuation ?? {};
  const latest = analysis.latest ?? {};
  const p = latest.profitability ?? {};
  const h = latest.health ?? {};
  const g = latest.growth ?? {};
  const c = latest.cashflow ?? {};
  const series = analysis.series ?? [];
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const year = analysis.latest_annual_period?.fiscal_year;
  const isBank = company.sector?.slug === 'banking';
  const sectorName = company.sector?.name ?? 'its sector';
  const annual = (bundle.statements?.periods ?? []).filter((x) => x.period_type === 'annual');
  const lastIncome = annual.at(-1)?.income;

  const positives = [];
  const risks = [];
  // Only material gaps are mentioned: tiny differences from the median are noise.
  const compare = (key, label, value, { higherSounds = 'stronger', lowerSounds = 'weaker', unit = pct, invert = false, minGap = 2 } = {}) => {
    const peer = peerMedian(peerStats, key);
    if (value === null || !peer) return;
    const gap = value - peer.median;
    if (Math.abs(gap) < Math.max(minGap, Math.abs(peer.median) * 0.1)) return;
    const above = gap > 0;
    const favourable = invert ? !above : above;
    const text = `${label} of ${unit(value)} is ${above ? 'above' : 'below'} the median of ${unit(peer.median)} for ${peer.n} ${sectorName} companies in the FundamentalX universe`;
    (favourable ? positives : risks).push(`${text} (relatively ${favourable ? higherSounds : lowerSounds} within this peer group).`);
  };

  // ---- executive summary ---------------------------------------------------
  const parts = [];
  if (lastIncome?.revenue != null) {
    const rg = val(g.revenue_growth);
    parts.push(`${company.name} (${sectorName}) reported revenue of ${crore(lastIncome.revenue)} in ${fy(year)}${rg !== null ? `, ${rg >= 0 ? 'up' : 'down'} ${pct(Math.abs(rg))} on the previous year` : ''}.`);
  }
  const nm = val(p.net_margin);
  const roe = val(p.roe);
  if (nm !== null || roe !== null) {
    parts.push(`It kept ${nm !== null ? `${pct(nm)} of revenue as net profit` : 'an unreported share of revenue as profit'}${roe !== null ? ` and earned a return on equity of ${pct(roe)}` : ''}.`);
  }
  const pe = val(v.pe_ratio);
  if (pe !== null) {
    const peer = peerMedian(peerStats, 'pe_ratio');
    parts.push(`At the listed price the P/E ratio is ${times(pe)}${peer ? ` against a sector median of ${times(peer.median)}` : ''}.`);
  } else if (v.pe_ratio?.status === 'not_meaningful') {
    parts.push(`A P/E ratio is not meaningful because ${String(v.pe_ratio.reason ?? 'earnings are not positive').toLowerCase()}.`);
  }
  const de = val(h.debt_to_equity);
  if (de !== null && !isBank) parts.push(`Debt-to-equity is ${fmt(de, 2)}.`);
  if (isBank) parts.push('As a bank, its balance sheet is funded by deposits, so industrial leverage and liquidity ratios do not apply.');
  if (parts.length === 0) parts.push(`There is not enough reported data to summarise ${company.name}'s fundamentals.`);

  // ---- observations from the company's own history ------------------------
  const om = val(p.operating_margin);
  const omPrev = val(prev?.profitability?.operating_margin);
  if (om !== null && omPrev !== null && Math.abs(om - omPrev) >= 1) {
    (om > omPrev ? positives : risks).push(`Operating margin ${om > omPrev ? 'improved' : 'declined'} from ${pct(omPrev)} in ${fy(prev.fiscal_year)} to ${pct(om)} in ${fy(year)}.`);
  }
  const cagr = val(analysis.cagr?.revenue_cagr_4y) ?? val(analysis.cagr?.revenue_cagr_3y);
  const cagrYears = val(analysis.cagr?.revenue_cagr_4y) !== null ? 4 : 3;
  if (cagr !== null) {
    (cagr > 0 ? positives : risks).push(`Revenue ${cagr > 0 ? 'grew' : 'shrank'} at a compound ${pct(Math.abs(cagr))} a year over the last ${cagrYears} years.`);
  }
  const nig = g.net_income_growth;
  if (val(nig) !== null && val(nig) < 0) risks.push(`Net profit fell ${pct(Math.abs(val(nig)))} in ${fy(year)} compared with the previous year.`);
  if (nig?.flags?.includes('turnaround_loss_to_profit')) positives.push(`The company returned to profit in ${fy(year)} after a loss in the previous year.`);
  const lossYears = series.filter((s) => {
    const ni = annual.find((a) => a.fiscal_year === s.fiscal_year)?.income?.net_income;
    return ni != null && ni < 0;
  }).map((s) => fy(s.fiscal_year));
  if (lossYears.length) risks.push(`The company reported a net loss in ${lossYears.join(', ')}, so earnings have not been consistently positive.`);

  const fcfYears = series.map((s) => val(s.cashflow?.free_cash_flow)).filter((x) => x !== null);
  const fcf = val(c.free_cash_flow);
  if (!isBank && fcfYears.length >= 3 && fcfYears.every((x) => x > 0)) positives.push(`Free cash flow was positive in all ${fcfYears.length} years with data${fcf !== null ? `, at ${crore(fcf)} in ${fy(year)}` : ''}.`);
  if (!isBank && fcf !== null && fcf < 0) risks.push(`Free cash flow was negative (${crore(fcf)}) in ${fy(year)}: capital spending exceeded operating cash flow.`);
  const conv = val(c.cash_conversion);
  if (!isBank && conv !== null && conv < 0.8) risks.push(`Operating cash flow was only ${fmt(conv, 2)} times net profit, so a part of reported profit did not arrive as cash.`);

  if (h.net_debt?.flags?.includes('net_cash_position') && !isBank) positives.push(`The company holds more cash than debt (a net cash position of ${crore(Math.abs(val(h.net_debt)))}).`);
  const cr = val(h.current_ratio);
  if (cr !== null && cr < 1) risks.push(`Current ratio is ${fmt(cr, 2)}: short-term liabilities exceed short-term assets.`);
  const ic = val(h.interest_coverage);
  if (ic !== null && ic < 3 && !isBank) risks.push(`Operating profit covers interest only ${times(ic)}, leaving less room if earnings fall.`);

  // ---- observations relative to sector peers ------------------------------
  compare('roe', 'Return on equity', roe);
  compare('operating_margin', 'Operating margin', om);
  compare('revenue_growth', 'Revenue growth', val(g.revenue_growth), { higherSounds: 'faster', lowerSounds: 'slower' });
  if (!isBank) compare('debt_to_equity', 'Debt-to-equity', de, { unit: (x) => fmt(x, 2), invert: true, higherSounds: 'lower leverage', lowerSounds: 'higher leverage', minGap: 0.2 });
  const pePeer = peerMedian(peerStats, 'pe_ratio');
  if (pe !== null && pePeer && pe > pePeer.median * 1.25) {
    risks.push(`The P/E of ${times(pe)} is well above the sector median of ${times(pePeer.median)}, meaning the price already assumes stronger future earnings than for typical peers.`);
  }

  // ---- metric explanations (only for metrics that have values) -------------
  const explanations = [];
  const addExpl = (metric, m, text) => { if (val(m) !== null) explanations.push({ metric, explanation: text }); };
  addExpl('P/E ratio', v.pe_ratio, `Price divided by earnings per share. At ${times(pe ?? 0)}, investors pay ₹${fmt(pe ?? 0, 2)} for each ₹1 of the latest annual earnings. A higher multiple usually reflects higher expected growth or lower perceived risk, not automatically over-valuation.`);
  addExpl('Return on equity', p.roe, `Net profit divided by average shareholders' equity. ${pct(roe ?? 0)} means the company earned ₹${fmt(roe ?? 0, 1)} of profit for every ₹100 of shareholders' money during ${fy(year)}.`);
  addExpl('Net profit margin', p.net_margin, `Net profit as a share of revenue: ₹${fmt(nm ?? 0, 1)} of every ₹100 of sales remained as profit for shareholders.`);
  if (!isBank) addExpl('Debt-to-equity', h.debt_to_equity, `Total borrowings divided by shareholders' equity. A value of ${fmt(de ?? 0, 2)} means ₹${fmt(de ?? 0, 2)} of debt for every ₹1 of equity; comfortable levels differ by industry.`);
  if (!isBank) addExpl('Free cash flow', c.free_cash_flow, `Operating cash flow minus capital expenditure: the cash left after investing in the business, which can fund dividends, debt repayment or growth.`);
  addExpl('Revenue growth', g.revenue_growth, `Change in revenue compared with the previous fiscal year. Growth is only calculated between consecutive years and is withheld when the previous value was zero or negative.`);

  // ---- data limitations ------------------------------------------------------
  const limits = [];
  if (provider?.is_demo) limits.push('These are illustrative demo figures generated for teaching, not the company\'s real reported results.');
  limits.push('This is a built-in rule-based summary written from fixed templates, not an AI explanation; it only restates the calculated metrics.');
  if (peerStats) limits.push(`Peer comparisons use only the companies in the FundamentalX universe for ${sectorName}, not the whole market.`);
  const missing = [...Object.values(v), ...Object.values(p), ...Object.values(h), ...Object.values(g)]
    .filter((m) => m && m.value == null && !(isBank && SECTOR_SPECIFIC_NM.has(m.key)))
    .map((m) => m.label);
  if (missing.length) limits.push(`Unavailable or not meaningful for this company: ${[...new Set(missing)].slice(0, 6).join(', ')}.`);
  for (const w of (analysis.quality?.checks ?? []).filter((x) => x.severity !== 'info').slice(0, 2)) limits.push(w.message.endsWith('.') ? w.message : `${w.message}.`);

  const result = {
    executive_summary: parts.join(' '),
    positive_observations: positives.slice(0, 6),
    risk_factors: risks.slice(0, 6),
    metric_explanations: explanations.slice(0, 6),
    data_limitations: limits.slice(0, 6),
    overall_caveat: 'This summary describes past reported figures only. It is not a forecast and not a recommendation to buy, sell or hold any security; read it together with the company\'s filings and sector context.',
  };
  // Same validation as AI output: guarantees the UI contract and length limits.
  return explanationSchema.parse(result);
}
