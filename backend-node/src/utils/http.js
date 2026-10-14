import { ApiError } from './errors.js';

/**
 * fetch() + JSON with a hard timeout. Never retries automatically (retry loops
 * can burn provider quota). Throws ApiError with `upstream` set so callers can
 * map failures to a user-facing message.
 */
export async function fetchJson(url, { method = 'GET', headers = {}, body, timeoutMs = 5000, upstream = 'upstream' } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    const e = new ApiError(timedOut ? 504 : 503, timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNAVAILABLE',
      `${upstream} ${timedOut ? 'timed out' : 'is unavailable'}`);
    e.upstream = upstream;
    throw e;
  }
  if (res.status === 204) return { status: 204, data: null };
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const e = new ApiError(502, 'UPSTREAM_BAD_RESPONSE', `${upstream} returned a non-JSON response`);
      e.upstream = upstream;
      throw e;
    }
  }
  return { status: res.status, data };
}
