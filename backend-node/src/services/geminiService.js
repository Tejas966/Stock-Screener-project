/**
 * Gemini integration (server-side only, official @google/genai SDK).
 *
 * Gemini is an EXPLAINER, not a data source:
 *   - it receives a compact "fact sheet" built only from provider data and
 *     Python-calculated metrics (no user data, no email, no free text from users);
 *   - it must answer in a fixed JSON schema (structured output);
 *   - the response is validated with zod and treated as untrusted plain text;
 *   - numbers in the answer that do not appear in the fact sheet are flagged.
 */
import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { config } from '../config.js';
import * as cacheRepo from '../repositories/marketCacheRepo.js';
import { ApiError } from '../utils/errors.js';
import { CRORE, round } from '../utils/format.js';

const MAX_FACT_SHEET_CHARS = 12000;

// --- output contract ---------------------------------------------------------
const text = (max) => z.string().trim().min(1).max(max);
export const explanationSchema = z.object({
  executive_summary: text(1500),
  positive_observations: z.array(text(500)).max(8),
  risk_factors: z.array(text(500)).max(8),
  metric_explanations: z.array(z.object({ metric: text(80), explanation: text(600) }).strict()).max(12),
  data_limitations: z.array(text(500)).max(8),
  overall_caveat: text(600),
}).strict();

/** JSON Schema handed to Gemini via `responseJsonSchema` (mirrors the zod schema). */
export const responseJsonSchema = {
  type: 'object',
  properties: {
    executive_summary: { type: 'string', description: '3-5 plain-language sentences summarising the supplied fundamentals.' },
    positive_observations: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    risk_factors: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    metric_explanations: {
      type: 'array', maxItems: 12,
      items: { type: 'object', properties: { metric: { type: 'string' }, explanation: { type: 'string' } }, required: ['metric', 'explanation'], additionalProperties: false },
    },
    data_limitations: { type: 'array', items: { type: 'string' }, maxItems: 8 },
    overall_caveat: { type: 'string' },
  },
  required: ['executive_summary', 'positive_observations', 'risk_factors', 'metric_explanations', 'data_limitations', 'overall_caveat'],
  additionalProperties: false,
};

export const SYSTEM_INSTRUCTION = `You explain company financial fundamentals to students and beginner investors in India.
STRICT RULES:
1. Use ONLY the facts in the JSON fact sheet you are given. Do not use outside knowledge about the company, its news, management or share price.
2. Never invent or estimate numbers. Quote figures exactly as given (you may round). If a metric is null, "unavailable" or "not_meaningful", say it is unavailable and why if a reason is given - never fill the gap.
3. Do not predict future prices or returns, and do not give buy, sell or hold recommendations or price targets.
4. Do not call the company "healthy", "cheap" or "expensive" based on a single metric. A low P/E does not by itself mean undervalued.
5. Remember that norms differ by sector (for example, banks are not judged on current ratio or debt-to-equity like manufacturers). Mention sector limits when relevant.
6. If "is_demo_data" is true, state clearly in data_limitations that the figures are illustrative demo data, not the company's real results.
7. Mention stale data, missing periods and data-quality warnings from the fact sheet in data_limitations.
8. Do not claim you fetched, verified or audited anything. You are only interpreting the supplied numbers.
9. Write plain text only (no Markdown, no HTML). Keep each list item to one or two sentences.`;

// --- fact sheet --------------------------------------------------------------
const pickMetric = (m) => (m ? { value: m.value == null ? null : round(m.value, 2), status: m.status, ...(m.reason ? { reason: m.reason } : {}), ...(m.flags?.length ? { flags: m.flags } : {}) } : null);
const toCrore = (v) => (v == null ? null : round(v / CRORE, 0));

/** Build the only data Gemini will see. Deterministic, so it can be hashed for caching. */
export function buildFactSheet(bundle) {
  const { company, quote, analysis, provider } = bundle;
  const metricsFrom = (group) => Object.fromEntries(Object.entries(group ?? {}).map(([k, m]) => [k, pickMetric(m)]));
  const annual = (bundle.statements?.periods ?? []).filter((p) => p.period_type === 'annual').slice(-5);
  return {
    company: { name: company.name, symbol: company.symbol, exchange: company.exchange, sector: company.sector?.name ?? null, industry: company.industry },
    data_source: provider.label,
    is_demo_data: provider.is_demo,
    currency: analysis?.currency ?? company.currency,
    price: quote ? { value: quote.price, as_of: quote.observed_at, delayed_or_end_of_day: true } : null,
    latest_fiscal_year: analysis?.latest_annual_period ?? null,
    valuation: metricsFrom(analysis?.valuation),
    profitability: metricsFrom(analysis?.latest?.profitability),
    growth_yoy: metricsFrom(analysis?.latest?.growth),
    multi_year_cagr: metricsFrom(analysis?.cagr),
    financial_health: metricsFrom(analysis?.latest?.health),
    cash_flow: { ...metricsFrom(analysis?.latest?.cashflow), note: 'free_cash_flow values are in absolute currency units' },
    annual_history_in_crore: annual.map((p) => ({
      fiscal_year: p.fiscal_year, revenue: toCrore(p.income?.revenue), net_income: toCrore(p.income?.net_income),
      eps: p.income?.eps == null ? null : round(p.income.eps, 2), operating_cash_flow: toCrore(p.cashflow?.operating_cash_flow),
    })),
    data_quality: {
      completeness_pct: analysis?.quality?.completeness?.overall_pct ?? null,
      warnings: [...(analysis?.warnings ?? []), ...(analysis?.quality?.checks ?? []).filter((c) => c.severity !== 'info').map((c) => c.message)].slice(0, 12),
    },
  };
}

// --- grounding check -----------------------------------------------------------
/** Collect every number in the fact sheet (plus common roundings) for the grounding check. */
function allowedNumbers(factSheet) {
  const set = new Set();
  const add = (n) => {
    if (!Number.isFinite(n)) return;
    for (const v of [n, Math.abs(n)]) {
      for (const dp of [0, 1, 2]) set.add(Number(v.toFixed(dp)));
      set.add(Math.round(v / 1000) * 1000); // "about 2,40,000 crore" style
    }
  };
  JSON.stringify(factSheet, (_, v) => { if (typeof v === 'number') add(v); return v; });
  for (const y of [1, 2, 3, 4, 5, 10]) set.add(y);
  return set;
}

/** Numbers in the model's text that cannot be traced to the fact sheet. */
export function findUngroundedNumbers(explanation, factSheet) {
  const allowed = allowedNumbers(factSheet);
  const strings = [explanation.executive_summary, explanation.overall_caveat, ...explanation.positive_observations,
    ...explanation.risk_factors, ...explanation.data_limitations, ...explanation.metric_explanations.map((m) => m.explanation)];
  const out = new Set();
  for (const s of strings) {
    for (const match of s.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
      const raw = match[0].replace(/,/g, '');
      const n = Number(raw);
      if (!Number.isFinite(n) || (n >= 1900 && n <= 2100 && Number.isInteger(n))) continue; // years
      const ok = [n, Number(n.toFixed(0)), Number(n.toFixed(1)), Number(n.toFixed(2))].some((v) => allowed.has(v) || allowed.has(-v));
      if (!ok) out.add(match[0]);
    }
  }
  return [...out].slice(0, 20);
}

// --- client ------------------------------------------------------------------
let clientOverride = null;
let client = null;
export function setGeminiClientForTests(c) { clientOverride = c; }

function getClient() {
  if (clientOverride) return clientOverride;
  if (!config.gemini.apiKey) throw new ApiError(503, 'AI_NOT_CONFIGURED', 'AI explanations are not configured on this server (GEMINI_API_KEY is missing). Numerical analysis is unaffected.');
  client ??= new GoogleGenAI({ apiKey: config.gemini.apiKey });
  return client;
}

function mapGeminiError(err) {
  if (err instanceof ApiError) return err;
  const status = err?.status ?? err?.code;
  if (err?.name === 'AbortError' || err?.name === 'TimeoutError' || /abort|timed? ?out/i.test(String(err?.message))) {
    return new ApiError(504, 'AI_TIMEOUT', 'The AI service took too long to respond. Please try again later.');
  }
  if (status === 429) return new ApiError(503, 'AI_QUOTA_EXCEEDED', 'The AI service quota has been reached. Please try again later.');
  if (status === 400 || status === 404) return new ApiError(502, 'AI_REQUEST_REJECTED', 'The AI service rejected the request (check GEMINI_MODEL).');
  if (status === 401 || status === 403) return new ApiError(503, 'AI_NOT_AUTHORIZED', 'The AI service rejected the server credentials.');
  return new ApiError(502, 'AI_UNAVAILABLE', 'The AI service is currently unavailable.');
}

/**
 * Generate (or load cached) explanation for a company bundle.
 * @returns {{ explanation, model, cached, generated_at, ungrounded_numbers, fact_sheet_hash }}
 */
export async function explain(bundle) {
  if (!bundle.analysis) throw new ApiError(409, 'ANALYSIS_REQUIRED', 'Numerical analysis must be available before an explanation can be generated');
  const factSheet = buildFactSheet(bundle);
  const factJson = JSON.stringify(factSheet);
  if (factJson.length > MAX_FACT_SHEET_CHARS) throw new ApiError(413, 'AI_INPUT_TOO_LARGE', 'Too much data to explain in one request');
  const model = config.gemini.model;
  const inputHash = createHash('sha256').update(`${model}\n${SYSTEM_INSTRUCTION}\n${factJson}`).digest('hex');

  try {
    const cached = await cacheRepo.getExplanation(bundle.company.id, inputHash, model);
    if (cached) {
      const parsed = explanationSchema.safeParse(cached.explanation);
      if (parsed.success) {
        return { explanation: parsed.data, model, cached: true, generated_at: new Date(cached.createdAt).toISOString(),
          ungrounded_numbers: findUngroundedNumbers(parsed.data, factSheet), fact_sheet_hash: inputHash };
      }
    }
  } catch (err) {
    console.warn(`[gemini] cache read failed: ${err.code || err.message}`);
  }

  const ai = getClient();
  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: `Explain these fundamentals using only this fact sheet:\n${factJson}` }] }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseJsonSchema,
        temperature: 0.2,
        maxOutputTokens: 2048,
        abortSignal: AbortSignal.timeout(config.gemini.timeoutMs),
      },
    });
  } catch (err) {
    throw mapGeminiError(err);
  }

  const raw = response?.text;
  if (!raw) {
    const reason = response?.promptFeedback?.blockReason || response?.candidates?.[0]?.finishReason || 'empty response';
    throw new ApiError(502, 'AI_NO_RESPONSE', `The AI service returned no explanation (${reason}).`);
  }
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI response was not valid JSON and was discarded.');
  }
  const parsed = explanationSchema.safeParse(json);
  if (!parsed.success) throw new ApiError(502, 'AI_INVALID_RESPONSE', 'The AI response did not match the expected structure and was discarded.');

  try {
    await cacheRepo.saveExplanation(bundle.company.id, inputHash, model, parsed.data);
  } catch (err) {
    console.warn(`[gemini] cache write failed: ${err.code || err.message}`);
  }
  return { explanation: parsed.data, model, cached: false, generated_at: new Date().toISOString(),
    ungrounded_numbers: findUngroundedNumbers(parsed.data, factSheet), fact_sheet_hash: inputHash };
}
