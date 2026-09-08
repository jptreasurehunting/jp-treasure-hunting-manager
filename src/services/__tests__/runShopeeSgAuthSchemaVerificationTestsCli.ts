if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
    get length() { return Object.keys(store).length; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); },
    getItem: (key: string) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null,
    key: (index: number) => Object.keys(store)[index] ?? null,
    removeItem: (key: string) => { delete store[key]; },
    setItem: (key: string, value: string) => { store[key] = String(value); }
  };
}

import { runShopeeSgAuthSchemaVerificationTests } from './shopeeSgAuthSchemaVerification.test';

const result = runShopeeSgAuthSchemaVerificationTests();
console.log(result.log.join('\n'));
console.log(`Shopee SG Auth Schema Verification Tests: ${result.passed} passed, ${result.failed} failed`);
if (result.failed > 0) (globalThis as any).process?.exit(1);
