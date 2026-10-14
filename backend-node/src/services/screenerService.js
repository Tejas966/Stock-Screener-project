/**
 * Screener: filter + sort + paginate metric rows.
 * Filter fields are defined once in shared/screener-fields.json (also read by PHP).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';

export const screenerSpec = JSON.parse(readFileSync(join(config.rootDir, 'shared', 'screener-fields.json'), 'utf8'));
export const FILTER_KEYS = screenerSpec.fields.map((f) => f.key);
const SORT_KEYS = [...FILTER_KEYS, ...screenerSpec.sortable_extra];
const MAX_ABS = screenerSpec.limits.max_abs_value;

const bound = z.number().finite().min(-MAX_ABS).max(MAX_ABS).nullable().optional();
const range = z.object({ min: bound, max: bound }).strict()
  .refine((r) => r.min != null || r.max != null, 'Provide min and/or max')
  .refine((r) => r.min == null || r.max == null || r.min <= r.max, 'min must not exceed max');

export const criteriaSchema = z.object({
  filters: z.partialRecord(z.enum(FILTER_KEYS), range).default({}),
  sector: z.string().regex(/^[a-z0-9-]{1,80}$/).nullable().optional(),
  sort: z.object({ field: z.enum(SORT_KEYS), direction: z.enum(['asc', 'desc']) }).strict()
    .default({ field: 'company_name', direction: 'asc' }),
}).strict();

export const runSchema = z.object({
  criteria: criteriaSchema,
  page: z.number().int().min(1).max(1000).default(1),
  page_size: z.number().int().min(5).max(100).default(20),
}).strict();

/**
 * @param rows      metricRow() objects
 * @param criteria  validated criteria
 * @returns paginated results with counts explaining every exclusion
 */
export function runScreen(rows, criteria, { page = 1, pageSize = 20 } = {}) {
  const filters = Object.entries(criteria.filters ?? {});
  let excludedMissing = 0;
  const inSector = criteria.sector ? rows.filter((r) => r.company.sector?.slug === criteria.sector) : rows;

  const matched = inSector.filter((row) => {
    let missing = false;
    for (const [key, { min, max }] of filters) {
      const v = row.metrics[key];
      if (v === null || v === undefined) {
        missing = true; // a company without the metric cannot satisfy the filter
        continue;
      }
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
    }
    if (missing) {
      excludedMissing += 1;
      return false;
    }
    return true;
  });

  const { field, direction } = criteria.sort ?? { field: 'company_name', direction: 'asc' };
  const dir = direction === 'desc' ? -1 : 1;
  const value = (r) => (field === 'company_name' ? r.company.name : r.metrics[field]);
  matched.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    // Missing values always sort last regardless of direction.
    if (va == null && vb == null) return a.company.name.localeCompare(b.company.name);
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });

  const total = matched.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pages);
  return {
    results: matched.slice((current - 1) * pageSize, current * pageSize),
    total,
    page: current,
    pages,
    page_size: pageSize,
    universe_size: rows.length,
    considered: inSector.length,
    excluded_missing_data: excludedMissing,
  };
}
