if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

import { runShopeeSgStructuredTokenMappingTests } from './shopeeSgStructuredTokenMapping.test';

const result = runShopeeSgStructuredTokenMappingTests();
console.log(result.log.join('\n'));
console.log(`Shopee SG Structured Token Mapping Tests: ${result.passed} passed, ${result.failed} failed`);
if (result.failed > 0) (globalThis as any).process?.exit(1);
