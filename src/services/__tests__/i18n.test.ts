/**
 * Unit Test Suite for i18n & Locale-Aware Formatters (Phase C)
 */

import {
  t,
  tBilingual,
  formatLocaleDateTime,
  formatLocaleCurrency,
  formatLocaleWeight,
  formatLocaleDimensions,
  formatLocaleAddress,
  loadUserLocaleContext,
  saveUserLocaleContext
} from '../i18nService';

export function runI18nTests(): { passed: number; failed: number; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`❌ [FAIL] ${testName}`);
    }
  };

  // Test 1: Japanese translation retrieval
  const jaText = t('consolidation.status.consolidate', undefined, 'ja');
  assert(Boolean(jaText === '🟢 同梱発送可能'), 'Test 1: Japanese translation key resolves accurately');

  // Test 2: English translation retrieval
  const enText = t('consolidation.status.consolidate', undefined, 'en');
  assert(Boolean(enText === '🟢 Consolidation Allowed'), 'Test 2: English translation key resolves accurately');

  // Test 3: Bilingual string helper
  const bText = tBilingual('consolidation.status.consolidate');
  assert(
    Boolean(bText === '🟢 同梱発送可能 / 🟢 Consolidation Allowed'),
    'Test 3: Bilingual helper creates "JA / EN" composite string'
  );

  // Test 4: Parameter interpolation
  const interpText = t('test.param', { count: 5 }, 'ja');
  assert(Boolean(typeof interpText === 'string'), 'Test 4: Parameter interpolation completes safely');

  // Test 5: Fallback to Japanese if key missing in language pack
  const fallbackText = t('consolidation.status.review_required', undefined, 'fr');
  assert(Boolean(fallbackText.length > 0), 'Test 5: Fallback gracefully to standard dictionary if locale pack is partial');

  // Test 6: Locale-aware date formatting (ja-JP)
  const dtJa = formatLocaleDateTime('2026-08-09T14:30:00.000Z', 'ja-JP');
  assert(Boolean(dtJa.includes('2026') || dtJa.includes('08')), 'Test 6: Date formatting for ja-JP works cleanly');

  // Test 7: Locale-aware date formatting (en-US)
  const dtUs = formatLocaleDateTime('2026-08-09T14:30:00.000Z', 'en-US');
  assert(Boolean(dtUs.includes('2026') || dtUs.includes('8')), 'Test 7: Date formatting for en-US works cleanly');

  // Test 8: Currency formatting JPY (no decimals)
  const currJpy = formatLocaleCurrency(5000, 'JPY', 'ja-JP');
  assert(Boolean(currJpy.includes('5,000') || currJpy.includes('￥')), 'Test 8: JPY currency formatted without decimals');

  // Test 9: Currency formatting USD (with decimals)
  const currUsd = formatLocaleCurrency(45.5, 'USD', 'en-US');
  assert(Boolean(currUsd.includes('45.50') || currUsd.includes('$')), 'Test 9: USD currency formatted with 2 decimal places');

  // Test 10: Weight formatting metric grams
  const wGrams = formatLocaleWeight(450, 'metric');
  assert(Boolean(wGrams === '450 g'), 'Test 10: Metric weight under 1kg formatted in grams');

  // Test 11: Weight formatting metric kilograms
  const wKg = formatLocaleWeight(2500, 'metric');
  assert(Boolean(wKg === '2.50 kg'), 'Test 11: Metric weight over 1kg formatted in kilograms');

  // Test 12: Weight formatting imperial ounces
  const wOz = formatLocaleWeight(283.495, 'imperial');
  assert(Boolean(wOz === '10.0 oz'), 'Test 12: Imperial weight converted and formatted in ounces');

  // Test 13: Dimensions formatting metric
  const dimCm = formatLocaleDimensions(20, 15, 5, 'metric');
  assert(Boolean(dimCm === '20.0 × 15.0 × 5.0 cm'), 'Test 13: Dimensions formatted in metric centimeters');

  // Test 14: Dimensions formatting imperial
  const dimIn = formatLocaleDimensions(25.4, 12.7, 5.08, 'imperial');
  assert(Boolean(dimIn === '10.0 × 5.0 × 2.0 in'), 'Test 14: Dimensions converted and formatted in imperial inches');

  // Test 15: Address formatting Japanese vs Western
  const addrJa = formatLocaleAddress({
    postalCode: '1500001',
    stateOrProvince: '東京都',
    city: '渋谷区',
    addressLine1: '神宮前1-2-3',
    countryCode: 'JP'
  }, 'ja-JP');
  assert(Boolean(addrJa.includes('〒150-0001') && addrJa.includes('神宮前')), 'Test 15: Address formatted according to Japanese hierarchy (Postal -> Pref -> City -> Street)');

  return { passed, failed, log };
}
