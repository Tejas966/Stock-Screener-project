export const CRORE = 1e7;

/** Round to n decimals, keeping null as null. */
export const round = (v, n = 2) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** n) / 10 ** n);

/** Normalize a free-text search query: trim, collapse whitespace, cap length. */
export function normalizeQuery(q) {
  return String(q ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function slugify(s) {
  return String(s).toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
