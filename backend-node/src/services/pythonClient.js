/** Client for the internal Python financial-processing service (FastAPI). */
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';
import { fetchJson } from '../utils/http.js';

async function post(path, body) {
  const headers = config.services.pythonSecret ? { 'X-Internal-Secret': config.services.pythonSecret } : {};
  let res;
  try {
    res = await fetchJson(`${config.services.pythonUrl}${path}`, {
      method: 'POST', body, headers, timeoutMs: config.services.timeoutMs, upstream: 'Financial processing service',
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw new ApiError(503, 'ANALYSIS_SERVICE_UNAVAILABLE', 'The financial calculation service is unavailable. Raw statements can still be viewed.');
    }
    throw err;
  }
  if (res.status === 422) {
    // Our own payload failed validation: a bug or unexpected provider data, not the user's fault.
    console.error('[python] rejected payload', JSON.stringify(res.data?.detail ?? res.data).slice(0, 800));
    throw new ApiError(502, 'ANALYSIS_INPUT_REJECTED', 'Financial data could not be processed (failed validation)');
  }
  if (res.status >= 500) {
    throw new ApiError(503, 'ANALYSIS_SERVICE_UNAVAILABLE', 'The financial calculation service is unavailable. Raw statements can still be viewed.');
  }
  if (res.status !== 200) throw new ApiError(502, 'ANALYSIS_FAILED', `Financial processing service returned HTTP ${res.status}`);
  return res.data;
}

export const python = {
  analyze: (payload) => post('/v1/analyze', payload),
  analyzeBatch: (items) => post('/v1/analyze/batch', { items }).then((r) => r.results),
  returns: (prices) => post('/v1/returns', { prices }),
  statistics: (metrics) => post('/v1/statistics', { metrics }).then((r) => r.statistics),
  async health() {
    try {
      const r = await fetchJson(`${config.services.pythonUrl}/health`, { timeoutMs: 1500 });
      return r.status === 200;
    } catch {
      return false;
    }
  },
};
