/**
 * Builds the version-controlled ILLUSTRATIVE demo dataset.
 *
 *   node scripts/build-demo-data.js
 *
 * Output:
 *   data/demo-dataset.json                      - fundamentals used by the demo provider
 *   ../database/seeds/001_sectors_companies.sql - company universe seed
 *
 * IMPORTANT: company names, tickers and sectors are real listings so the
 * search workflow is realistic, but EVERY financial figure produced here is
 * synthetic (generated from a seeded random process). They are not, and must
 * never be presented as, the companies' actual reported fundamentals.
 *
 * Amounts are written in INR crore (the convention of Indian annual reports);
 * the demo provider adapter converts them to absolute rupees during
 * normalization, just as a real provider adapter would convert its units.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const SECTORS = [
  { name: 'Information Technology', slug: 'information-technology', description: 'Software services, consulting and digital transformation businesses.' },
  { name: 'Banking', slug: 'banking', description: 'Private and public sector banks. Balance-sheet ratios designed for industrial companies are often not meaningful here.' },
  { name: 'Energy', slug: 'energy', description: 'Oil, gas, refining and integrated energy conglomerates.' },
  { name: 'FMCG', slug: 'fmcg', description: 'Fast-moving consumer goods: food, personal care and household products.' },
  { name: 'Automobile', slug: 'automobile', description: 'Passenger vehicle, two-wheeler and utility vehicle manufacturers.' },
  { name: 'Pharmaceuticals', slug: 'pharmaceuticals', description: 'Generic and branded drug manufacturers.' },
  { name: 'Telecommunications', slug: 'telecommunications', description: 'Mobile, broadband and enterprise connectivity providers.' },
  { name: 'Metals & Mining', slug: 'metals-mining', description: 'Steel and other metal producers; highly cyclical earnings.' },
  { name: 'Cement', slug: 'cement', description: 'Cement and building-materials manufacturers.' },
];

// Base parameters for FY2025 (crore). Growth/margins are illustrative.
// kind: 'industrial' (default) or 'bank'
const COMPANIES = [
  { name: 'Reliance Industries Ltd', ticker: 'RELIANCE', roe: 0.09, bse: '500325', isin: 'INE002A01018', sector: 'energy', industry: 'Integrated Oil & Gas', revenue: 900000, growth: 0.07, gm: 0.30, om: 0.11, nm: 0.075, shares: 1353, price: 1380, dps: 5.5, debtRatio: 0.38, featured: true },
  { name: 'Oil & Natural Gas Corporation Ltd', ticker: 'ONGC', roe: 0.12, sector: 'energy', industry: 'Oil Exploration & Production', revenue: 610000, growth: 0.04, gm: 0.28, om: 0.10, nm: 0.06, shares: 1258, price: 245, dps: 12, debtRatio: 0.45 },
  { name: 'Tata Consultancy Services Ltd', ticker: 'TCS', roe: 0.45, bse: '532540', isin: 'INE467B01029', sector: 'information-technology', industry: 'IT Services & Consulting', revenue: 255000, growth: 0.09, gm: 0.42, om: 0.245, nm: 0.19, shares: 362, price: 3450, dps: 120, debtRatio: 0.05, featured: true },
  { name: 'Infosys Ltd', ticker: 'INFY', roe: 0.3, sector: 'information-technology', industry: 'IT Services & Consulting', revenue: 162000, growth: 0.085, gm: 0.31, om: 0.21, nm: 0.165, shares: 415, price: 1520, dps: 42, debtRatio: 0.04, featured: true },
  { name: 'Wipro Ltd', ticker: 'WIPRO', roe: 0.15, sector: 'information-technology', industry: 'IT Services & Consulting', revenue: 89000, growth: 0.03, gm: 0.30, om: 0.165, nm: 0.135, shares: 1046, price: 255, dps: 6, debtRatio: 0.18 },
  { name: 'HCL Technologies Ltd', ticker: 'HCLTECH', roe: 0.24, sector: 'information-technology', industry: 'IT Services & Consulting', revenue: 117000, growth: 0.08, gm: 0.38, om: 0.185, nm: 0.15, shares: 271, price: 1610, dps: 60, debtRatio: 0.05 },
  { name: 'Tech Mahindra Ltd', ticker: 'TECHM', roe: 0.09, sector: 'information-technology', industry: 'IT Services & Consulting', revenue: 52900, growth: 0.02, gm: 0.27, om: 0.09, nm: 0.06, shares: 98, price: 1490, dps: 45, debtRatio: 0.08 },
  { name: 'HDFC Bank Ltd', ticker: 'HDFCBANK', roe: 0.15, sector: 'banking', industry: 'Private Sector Bank', kind: 'bank', revenue: 336000, growth: 0.14, om: 0.27, nm: 0.20, shares: 765, price: 1960, dps: 22, featured: true },
  { name: 'ICICI Bank Ltd', ticker: 'ICICIBANK', roe: 0.17, sector: 'banking', industry: 'Private Sector Bank', kind: 'bank', revenue: 270000, growth: 0.15, om: 0.30, nm: 0.20, shares: 712, price: 1420, dps: 11, featured: true },
  { name: 'State Bank of India', ticker: 'SBIN', roe: 0.18, sector: 'banking', industry: 'Public Sector Bank', kind: 'bank', revenue: 520000, growth: 0.12, om: 0.19, nm: 0.135, shares: 892, price: 810, dps: 15.9 },
  { name: 'Kotak Mahindra Bank Ltd', ticker: 'KOTAKBANK', roe: 0.13, sector: 'banking', industry: 'Private Sector Bank', kind: 'bank', revenue: 94000, growth: 0.13, om: 0.32, nm: 0.24, shares: 199, price: 2050, dps: 2.5 },
  { name: 'Hindustan Unilever Ltd', ticker: 'HINDUNILVR', roe: 0.21, sector: 'fmcg', industry: 'Personal & Household Products', revenue: 63000, growth: 0.05, gm: 0.51, om: 0.23, nm: 0.165, shares: 235, price: 2380, dps: 53, debtRatio: 0.02 },
  { name: 'ITC Ltd', ticker: 'ITC', roe: 0.28, sector: 'fmcg', industry: 'Diversified FMCG', revenue: 75000, growth: 0.06, gm: 0.56, om: 0.36, nm: 0.27, shares: 1251, price: 415, dps: 14.35, debtRatio: 0.01 },
  { name: 'Nestle India Ltd', ticker: 'NESTLEIND', roe: 0.85, sector: 'fmcg', industry: 'Packaged Foods', revenue: 20200, growth: 0.07, gm: 0.56, om: 0.22, nm: 0.16, shares: 96, price: 2310, dps: 32, debtRatio: 0.06, gaps: { cashflowCapexFY: 2023 } },
  { name: 'Maruti Suzuki India Ltd', ticker: 'MARUTI', roe: 0.15, sector: 'automobile', industry: 'Passenger Vehicles', revenue: 152000, growth: 0.11, gm: 0.29, om: 0.115, nm: 0.092, shares: 31.4, price: 12400, dps: 135, debtRatio: 0.01 },
  { name: 'Mahindra & Mahindra Ltd', ticker: 'M&M', roe: 0.18, sector: 'automobile', industry: 'Utility Vehicles & Tractors', revenue: 159000, growth: 0.13, gm: 0.25, om: 0.10, nm: 0.075, shares: 124, price: 3050, dps: 25, debtRatio: 0.9, lossYears: [2021] },
  { name: 'Bajaj Auto Ltd', ticker: 'BAJAJ-AUTO', roe: 0.27, sector: 'automobile', industry: 'Two & Three Wheelers', revenue: 50000, growth: 0.10, gm: 0.30, om: 0.195, nm: 0.155, shares: 27.9, price: 8600, dps: 210, debtRatio: 0.03 },
  { name: 'Sun Pharmaceutical Industries Ltd', ticker: 'SUNPHARMA', roe: 0.16, sector: 'pharmaceuticals', industry: 'Specialty & Generic Pharma', revenue: 52000, growth: 0.09, gm: 0.79, om: 0.27, nm: 0.20, shares: 240, price: 1690, dps: 15.5, debtRatio: 0.03 },
  { name: "Dr. Reddy's Laboratories Ltd", ticker: 'DRREDDY', roe: 0.19, sector: 'pharmaceuticals', industry: 'Generic Pharma', revenue: 32500, growth: 0.11, gm: 0.58, om: 0.22, nm: 0.175, shares: 83.4, price: 1260, dps: 8, debtRatio: 0.08 },
  { name: 'Cipla Ltd', ticker: 'CIPLA', roe: 0.16, sector: 'pharmaceuticals', industry: 'Generic Pharma', revenue: 27500, growth: 0.07, gm: 0.66, om: 0.23, nm: 0.19, shares: 80.8, price: 1480, dps: 16, debtRatio: 0.01 },
  { name: 'Bharti Airtel Ltd', ticker: 'BHARTIARTL', roe: 0.22, sector: 'telecommunications', industry: 'Integrated Telecom', revenue: 172000, growth: 0.14, gm: 0.62, om: 0.25, nm: 0.09, shares: 600, price: 1850, dps: 16, debtRatio: 1.6 },
  { name: 'Tata Steel Ltd', ticker: 'TATASTEEL', roe: 0.05, sector: 'metals-mining', industry: 'Integrated Steel', revenue: 218000, growth: 0.02, gm: 0.40, om: 0.07, nm: 0.015, shares: 1248, price: 150, dps: 3.6, debtRatio: 0.95, lossYears: [2024], volatility: 0.35 },
  { name: 'UltraTech Cement Ltd', ticker: 'ULTRACEMCO', roe: 0.11, sector: 'cement', industry: 'Cement', revenue: 76000, growth: 0.09, gm: 0.34, om: 0.15, nm: 0.09, shares: 29.5, price: 11800, dps: 77.5, debtRatio: 0.2 },
];

const YEARS = [2021, 2022, 2023, 2024, 2025];

// mulberry32 - tiny seeded PRNG so the dataset is reproducible.
function prng(seedText) {
  let seed = 0;
  for (const ch of seedText) seed = (Math.imul(31, seed) + ch.charCodeAt(0)) | 0;
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

function buildIndustrialYear(c, revenue, rnd, isLoss) {
  const wobble = () => 1 + (rnd() - 0.5) * 0.08;
  const grossProfit = revenue * c.gm * wobble();
  const operatingIncome = isLoss ? -revenue * 0.02 : revenue * c.om * wobble();
  const depreciation = revenue * 0.035 * wobble();
  const ebitda = operatingIncome + depreciation;
  const equity = (revenue * c.nm) / (c.roe ?? 0.16) * wobble(); // c.roe = illustrative target ROE
  const totalDebt = equity * c.debtRatio * wobble();
  const interest = totalDebt * 0.085 * wobble();
  const pbt = operatingIncome - interest + revenue * 0.01;
  const tax = pbt > 0 ? pbt * 0.25 : 0;
  const netIncome = isLoss ? pbt - tax - revenue * 0.03 : revenue * c.nm * wobble();
  const totalAssets = equity + totalDebt + revenue * 0.35 * wobble();
  const currentAssets = totalAssets * 0.42 * wobble();
  const currentLiabilities = currentAssets / (1.3 + rnd() * 0.9);
  const totalLiabilities = totalAssets - equity;
  const cash = currentAssets * 0.25 * wobble();
  const ocf = isLoss ? netIncome + depreciation * 2.5 : netIncome * (1.05 + rnd() * 0.3) + depreciation;
  const capex = revenue * (0.03 + rnd() * 0.05);
  return {
    income: {
      revenue: r2(revenue), cost_of_revenue: r2(revenue - grossProfit), gross_profit: r2(grossProfit),
      operating_expenses: r2(grossProfit - operatingIncome), ebitda: r2(ebitda), depreciation: r2(depreciation),
      operating_income: r2(operatingIncome), interest_expense: r2(interest), profit_before_tax: r2(pbt),
      income_tax: r2(tax), net_income: r2(netIncome), eps: r2(netIncome / c.shares),
    },
    balance: {
      cash_and_equivalents: r2(cash), current_assets: r2(currentAssets), non_current_assets: r2(totalAssets - currentAssets),
      total_assets: r2(totalAssets), current_liabilities: r2(currentLiabilities),
      non_current_liabilities: r2(totalLiabilities - currentLiabilities), total_liabilities: r2(totalLiabilities),
      total_debt: r2(totalDebt), total_equity: r2(equity),
    },
    cashflow: {
      operating_cash_flow: r2(ocf), investing_cash_flow: r2(-capex * (1.1 + rnd() * 0.4)),
      financing_cash_flow: r2(-(c.dps * c.shares) - totalDebt * 0.05 * rnd()),
      capital_expenditure: r2(-capex), // provider convention: outflow is NEGATIVE
      dividends_paid: r2(-(c.dps * c.shares) * 0.9),
    },
  };
}

// Banks: revenue = total income; no gross profit / current assets split.
function buildBankYear(c, revenue, rnd) {
  const wobble = () => 1 + (rnd() - 0.5) * 0.06;
  const interest = revenue * 0.48 * wobble();
  const pbt = revenue * c.om * wobble();
  const netIncome = revenue * c.nm * wobble();
  const equity = netIncome / (c.roe ?? 0.15) * wobble();
  const totalAssets = equity * 8.5 * wobble();
  const borrowings = totalAssets * 0.12 * wobble();
  const cash = totalAssets * 0.06 * wobble();
  return {
    income: {
      revenue: r2(revenue), cost_of_revenue: null, gross_profit: null,
      operating_expenses: r2(revenue - interest - pbt), ebitda: null, depreciation: r2(revenue * 0.01),
      operating_income: r2(pbt), interest_expense: r2(interest), profit_before_tax: r2(pbt),
      income_tax: r2(pbt - netIncome), net_income: r2(netIncome), eps: r2(netIncome / c.shares),
    },
    balance: {
      cash_and_equivalents: r2(cash), current_assets: null, non_current_assets: null,
      total_assets: r2(totalAssets), current_liabilities: null, non_current_liabilities: null,
      total_liabilities: r2(totalAssets - equity), total_debt: r2(borrowings), total_equity: r2(equity),
    },
    cashflow: {
      operating_cash_flow: r2(netIncome * (0.6 + rnd() * 1.6)), investing_cash_flow: r2(-revenue * 0.05 * wobble()),
      financing_cash_flow: r2(revenue * 0.02 * (rnd() - 0.3)), capital_expenditure: r2(-revenue * 0.012 * wobble()),
      dividends_paid: r2(-(c.dps * c.shares) * 0.9),
    },
  };
}

function buildCompany(c) {
  const rnd = prng(c.ticker);
  const annual = YEARS.map((year) => {
    const yearsBack = 2025 - year;
    const revenue = c.revenue / Math.pow(1 + c.growth, yearsBack) * (1 + (rnd() - 0.5) * 0.04);
    const isLoss = (c.lossYears || []).includes(year);
    const data = c.kind === 'bank' ? buildBankYear(c, revenue, rnd) : buildIndustrialYear(c, revenue, rnd, isLoss);
    if (c.gaps?.cashflowCapexFY === year) {
      data.cashflow.capital_expenditure = null; // deliberately missing to exercise "unavailable" handling
    }
    return { fiscal_year: year, fiscal_period: 'FY', period_end: `${year}-03-31`, ...data };
  });

  // Four quarters of FY2025 (Apr-Jun 2024 ... Jan-Mar 2025).
  const fy25 = annual[annual.length - 1];
  const quarterEnds = ['2024-06-30', '2024-09-30', '2024-12-31', '2025-03-31'];
  const quarterly = quarterEnds.map((end, i) => {
    const share = [0.235, 0.245, 0.255, 0.265][i];
    const scale = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v == null ? null : r2(v * share)]));
    const income = scale(fy25.income);
    income.eps = r2(fy25.income.eps * share);
    return { fiscal_year: 2025, fiscal_period: `Q${i + 1}`, period_end: end, income, balance: null, cashflow: null };
  });

  return {
    ticker: c.ticker,
    shares_outstanding_crore: c.shares,
    illustrative_price: c.price,
    dividend_per_share: c.dps,
    price_volatility: c.volatility ?? 0.24,
    statements: { annual, quarterly },
  };
}

const dataset = {
  _notice: 'ILLUSTRATIVE DEMO DATA. Generated by scripts/build-demo-data.js from a seeded random process. These figures are NOT actual reported fundamentals or prices of the named companies and must not be used for any investment decision.',
  generated_by: 'scripts/build-demo-data.js',
  amount_unit: 'INR crore',
  share_unit: 'crore shares',
  as_of: '2025-06-30',
  companies: Object.fromEntries(COMPANIES.map((c) => [c.ticker, buildCompany(c)])),
};

mkdirSync(join(here, '..', 'data'), { recursive: true });
writeFileSync(join(here, '..', 'data', 'demo-dataset.json'), JSON.stringify(dataset, null, 1) + '\n');

// ---- SQL seed for the company universe -----------------------------------
const esc = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const lines = [
  '-- FundamentalX seed: sectors and company universe (generated by backend-node/scripts/build-demo-data.js).',
  '-- Company names/tickers are real listings; NO financial figures are seeded here.',
  'SET NAMES utf8mb4;',
  '',
  'INSERT INTO sectors (sector_name, sector_slug, description) VALUES',
  SECTORS.map((s) => `  (${esc(s.name)}, ${esc(s.slug)}, ${esc(s.description)})`).join(',\n'),
  'ON DUPLICATE KEY UPDATE description = VALUES(description);',
  '',
];
const rows = [];
for (const c of COMPANIES) {
  const sectorRef = `(SELECT id FROM sectors WHERE sector_slug = ${esc(c.sector)})`;
  rows.push(`  (${esc(c.name)}, ${esc(`${c.ticker}.NS`)}, ${esc(c.ticker)}, 'NSE', ${esc(c.isin)}, ${sectorRef}, ${esc(c.industry)}, 'INR', ${c.featured ? 1 : 0})`);
  if (c.bse) {
    rows.push(`  (${esc(c.name)}, ${esc(`${c.bse}.BO`)}, ${esc(c.bse)}, 'BSE', ${esc(c.isin)}, ${sectorRef}, ${esc(c.industry)}, 'INR', 0)`);
  }
}
lines.push(
  'INSERT INTO companies (company_name, symbol, ticker, exchange, isin, sector_id, industry, currency, is_featured) VALUES',
  rows.join(',\n'),
  'ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), sector_id = VALUES(sector_id), industry = VALUES(industry), is_featured = VALUES(is_featured);',
  '',
);
writeFileSync(join(here, '..', '..', 'database', 'seeds', '001_sectors_companies.sql'), lines.join('\n'));

// BSE listings reuse the NSE ticker's demo fundamentals.
const bseMap = Object.fromEntries(COMPANIES.filter((c) => c.bse).map((c) => [c.bse, c.ticker]));
writeFileSync(join(here, '..', 'data', 'demo-listing-aliases.json'), JSON.stringify(bseMap, null, 2) + '\n');

console.log(`Demo dataset written: ${COMPANIES.length} companies, ${SECTORS.length} sectors.`);
