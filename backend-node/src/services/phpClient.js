/**
 * Client for the internal PHP persistence service (saved screens, notes).
 * Node has ALREADY authenticated the user; it forwards the user id together
 * with the shared service secret. The browser never reaches PHP directly.
 */
import { config } from '../config.js';
import { ApiError } from '../utils/errors.js';
import { fetchJson } from '../utils/http.js';

export async function phpRequest(method, path, userId, { body, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== ''))}` : '';
  let res;
  try {
    res = await fetchJson(`${config.services.phpUrl}${path}${qs}`, {
      method,
      body,
      headers: { 'X-Internal-Secret': config.services.phpSecret, 'X-User-Id': String(userId) },
      timeoutMs: config.services.timeoutMs,
      upstream: 'Persistence service',
    });
  } catch (err) {
    if (err instanceof ApiError) throw new ApiError(503, 'PERSISTENCE_SERVICE_UNAVAILABLE', 'Saved screens and notes are temporarily unavailable');
    throw err;
  }
  if (res.status === 204) return null;
  if (res.status >= 200 && res.status < 300) return res.data?.data;
  const e = res.data?.error;
  // Pass through client errors (validation, not found, conflicts) unchanged.
  if ([400, 404, 409, 413, 415, 422].includes(res.status) && e) throw new ApiError(res.status, e.code, e.message, e.details);
  if (res.status === 401) {
    console.error('[php] service authentication failed - check PHP_SERVICE_SECRET matches in both services');
    throw new ApiError(503, 'PERSISTENCE_SERVICE_UNAVAILABLE', 'Saved screens and notes are temporarily unavailable');
  }
  throw new ApiError(502, 'PERSISTENCE_SERVICE_ERROR', 'The persistence service failed to complete the request');
}

export async function phpHealth() {
  try {
    const r = await fetchJson(`${config.services.phpUrl}/health`, { timeoutMs: 1500 });
    return r.status === 200;
  } catch {
    return false;
  }
}
