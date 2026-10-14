import { config } from '../../config.js';
import { demoProvider } from './demoProvider.js';
import { fmpProvider } from './fmpProvider.js';

/**
 * Provider registry. Every adapter implements:
 *   name, isDemo, label,
 *   getQuote(company), getStatements(company), getHistory(company), getIndices()
 * and returns the normalized model documented in normalize.js.
 * Adding a vendor = adding one adapter file and one line here.
 */
const PROVIDERS = { demo: demoProvider, fmp: fmpProvider };

let override = null;

export function getProvider() {
  if (override) return override;
  const p = PROVIDERS[config.provider.name];
  if (!p) throw new Error(`Unknown FINANCIAL_PROVIDER "${config.provider.name}". Use one of: ${Object.keys(PROVIDERS).join(', ')}`);
  return p;
}

/** Test hook: replace the active provider. */
export function setProviderForTests(p) {
  override = p;
}
