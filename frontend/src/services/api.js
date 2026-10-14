/**
 * Thin Fetch API wrapper for the Node gateway. All requests send the session
 * cookie (credentials: 'include'); no tokens or API keys live in the browser.
 */
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function request(path, { method = 'GET', body, signal, query } = {}) {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ''))}` : '';
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the FundamentalX server. Check that the backend is running.');
  }
  if (res.status === 204) return null;
  let json = null;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(res.status, 'BAD_RESPONSE', `Unexpected response from server (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const e = json?.error ?? {};
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? `Request failed (HTTP ${res.status})`, e.details);
  }
  return json?.data;
}

const enc = encodeURIComponent;

/** Endpoint catalogue - every API call the UI makes is listed here. */
export const api = {
  meta: (o) => request('/meta', o),
  // auth & profile
  me: (o) => request('/auth/me', o),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  register: (body) => request('/auth/register', { method: 'POST', body }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateProfile: (body) => request('/users/me', { method: 'PUT', body }),
  changePassword: (body) => request('/users/me/password', { method: 'PUT', body }),
  // companies
  search: (q, { record = false, signal } = {}) => request('/companies/search', { query: { q, record: record ? '1' : '0' }, signal }),
  featured: (o) => request('/companies/featured', o),
  companies: (o) => request('/companies', o),
  company: (symbol, o) => request(`/companies/${enc(symbol)}`, o),
  fundamentals: (symbol, o) => request(`/companies/${enc(symbol)}/fundamentals`, o),
  statements: (symbol, query, o = {}) => request(`/companies/${enc(symbol)}/statements`, { ...o, query }),
  history: (symbol, range, o = {}) => request(`/companies/${enc(symbol)}/history`, { ...o, query: { range } }),
  explain: (symbol, mode = 'auto') => request(`/analysis/${enc(symbol)}/explanation`, { method: 'POST', body: { mode } }),
  // research tools
  screenerFilters: (o) => request('/screener/filters', o),
  runScreener: (body, o = {}) => request('/screener/run', { ...o, method: 'POST', body }),
  compare: (symbols, o = {}) => request('/compare', { ...o, method: 'POST', body: { symbols } }),
  sectors: (o) => request('/sectors', o),
  sector: (slug, o) => request(`/sectors/${enc(slug)}`, o),
  market: (o) => request('/market/overview', o),
  // user data (Node-owned)
  watchlist: (o) => request('/watchlist', o),
  addToWatchlist: (symbol) => request('/watchlist', { method: 'POST', body: { symbol } }),
  removeFromWatchlist: (id) => request(`/watchlist/${id}`, { method: 'DELETE' }),
  searchHistory: (o) => request('/history', o),
  recordSearch: (query, symbol) => request('/history', { method: 'POST', body: { query, symbol } }),
  clearHistory: () => request('/history', { method: 'DELETE' }),
  deleteHistoryItem: (id) => request(`/history/${id}`, { method: 'DELETE' }),
  // user data (PHP-owned, via the gateway)
  savedScreens: (o) => request('/saved-screens', o),
  savedScreen: (id, o) => request(`/saved-screens/${id}`, o),
  createScreen: (body) => request('/saved-screens', { method: 'POST', body }),
  updateScreen: (id, body) => request(`/saved-screens/${id}`, { method: 'PUT', body }),
  deleteScreen: (id) => request(`/saved-screens/${id}`, { method: 'DELETE' }),
  notes: (query, o = {}) => request('/research-notes', { ...o, query }),
  createNote: (body) => request('/research-notes', { method: 'POST', body }),
  updateNote: (id, body) => request(`/research-notes/${id}`, { method: 'PUT', body }),
  deleteNote: (id) => request(`/research-notes/${id}`, { method: 'DELETE' }),
};
