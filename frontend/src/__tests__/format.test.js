import { describe, expect, it } from 'vitest';
import { formatAmount, formatMetric, formatPercent, formatPrice, NA } from '../utils/format.js';
import { validateEmail, validatePassword } from '../utils/validation.js';
import { validateRegistration } from '../pages/Register.jsx';
import { buildCriteria } from '../pages/Screener.jsx';
import { describeCriteria } from '../pages/SavedScreens.jsx';

describe('Indian number formatting', () => {
  it('formats crore and lakh with en-IN grouping', () => {
    expect(formatAmount(2.55e12)).toBe('₹2,55,000 Cr');
    expect(formatAmount(1.5e7, 'lakh')).toBe('₹150.0 L');
    expect(formatAmount(-1.5063e11)).toBe('−₹15,063 Cr');
  });
  it('never shows missing values as zero', () => {
    for (const fn of [formatAmount, formatPercent, formatPrice]) {
      expect(fn(null)).toBe(NA);
      expect(fn(undefined)).toBe(NA);
      expect(fn(Number.NaN)).toBe(NA);
    }
    expect(formatMetric({ value: null, unit: 'percent', status: 'unavailable' })).toBe(NA);
  });
  it('formats metrics by unit', () => {
    expect(formatMetric({ value: 26.1245, unit: 'multiple' })).toBe('26.1×');
    expect(formatMetric({ value: 45.08, unit: 'percent' })).toBe('45.1%');
    expect(formatPrice(3450)).toBe('₹3,450.00');
    expect(formatPercent(1.234, 1, { sign: true })).toBe('+1.2%');
  });
});

describe('form validation', () => {
  it('validates email and password rules', () => {
    expect(validateEmail('')).toMatch(/required/);
    expect(validateEmail('bad@')).toMatch(/valid/);
    expect(validateEmail('ok@example.com')).toBeNull();
    expect(validatePassword('short1')).toMatch(/8/);
    expect(validatePassword('onlyletters')).toMatch(/digit/);
    expect(validatePassword('Good1234')).toBeNull();
  });
  it('registration requires matching passwords', () => {
    const errors = validateRegistration({ name: 'A', email: 'x', password: 'abc12345', password_confirmation: 'abc12346' });
    expect(Object.keys(errors).sort()).toEqual(['email', 'name', 'password_confirmation']);
  });
});

describe('screener criteria', () => {
  it('converts form strings to numeric filters and drops empty ones', () => {
    const { criteria, errors } = buildCriteria({ roe: { min: '15', max: '' }, pe_ratio: { min: '', max: '' } }, 'banking', { field: 'roe', direction: 'desc' });
    expect(errors).toEqual({});
    expect(criteria).toEqual({ filters: { roe: { min: 15, max: null } }, sector: 'banking', sort: { field: 'roe', direction: 'desc' } });
  });
  it('rejects non-numbers and inverted ranges', () => {
    const { errors } = buildCriteria({ roe: { min: 'abc', max: '' }, pe_ratio: { min: '50', max: '10' } }, '', {});
    expect(errors.roe).toMatch(/numbers/);
    expect(errors.pe_ratio).toMatch(/exceed/);
  });
  it('describes saved criteria in words', () => {
    expect(describeCriteria({ filters: { pe_ratio: { min: null, max: 20 }, roe: { min: 10, max: 30 } }, sector: 'fmcg' }))
      .toEqual(['P/E ≤ 20', 'ROE % between 10 and 30', 'Sector: fmcg']);
  });
});
