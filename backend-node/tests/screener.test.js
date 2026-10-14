import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criteriaSchema, runScreen } from '../src/services/screenerService.js';

const row = (name, metrics, sector = 'it') => ({ company: { name, symbol: `${name}.NS`, sector: { slug: sector } }, metrics });
const rows = [
  row('Alpha', { pe_ratio: 10, roe: 25 }),
  row('Beta', { pe_ratio: 30, roe: 12 }),
  row('Gamma', { pe_ratio: null, roe: 30 }),
  row('Delta', { pe_ratio: 18, roe: 18 }, 'banking'),
];

test('filters by min/max and excludes companies missing a filtered metric', () => {
  const r = runScreen(rows, criteriaSchema.parse({ filters: { pe_ratio: { max: 20 } } }));
  assert.deepEqual(r.results.map((x) => x.company.name), ['Alpha', 'Delta']);
  assert.equal(r.excluded_missing_data, 1);
  assert.equal(r.universe_size, 4);
});

test('sector filter and sorting descending', () => {
  const r = runScreen(rows, criteriaSchema.parse({ filters: {}, sector: 'it', sort: { field: 'roe', direction: 'desc' } }));
  assert.deepEqual(r.results.map((x) => x.company.name), ['Gamma', 'Alpha', 'Beta']);
  assert.equal(r.considered, 3);
});

test('missing values sort last in both directions', () => {
  for (const direction of ['asc', 'desc']) {
    const r = runScreen(rows, criteriaSchema.parse({ sort: { field: 'pe_ratio', direction } }));
    assert.equal(r.results.at(-1).company.name, 'Gamma');
  }
});

test('pagination', () => {
  const r = runScreen(rows, criteriaSchema.parse({}), { page: 2, pageSize: 3 });
  assert.equal(r.total, 4);
  assert.equal(r.pages, 2);
  assert.equal(r.results.length, 1);
  const clamped = runScreen(rows, criteriaSchema.parse({}), { page: 99, pageSize: 3 });
  assert.equal(clamped.page, 2);
});

test('criteria validation rejects unknown fields, inverted ranges and non-numbers', () => {
  assert.equal(criteriaSchema.safeParse({ filters: { invented: { min: 1 } } }).success, false);
  assert.equal(criteriaSchema.safeParse({ filters: { pe_ratio: { min: 9, max: 1 } } }).success, false);
  assert.equal(criteriaSchema.safeParse({ filters: { pe_ratio: { min: '5' } } }).success, false);
  assert.equal(criteriaSchema.safeParse({ filters: { pe_ratio: {} } }).success, false);
  assert.equal(criteriaSchema.safeParse({ filters: {}, sort: { field: 'name; DROP', direction: 'asc' } }).success, false);
  assert.equal(criteriaSchema.safeParse({ filters: { pe_ratio: { min: 1 } }, sort: { field: 'roe', direction: 'desc' } }).success, true);
});
