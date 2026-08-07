/**
 * Unit Test Suite for Air Shipping Quotation & Upgrade Automation
 */

import {
  calculateCheapestAirOption,
  generateBuyerAirUpgradeNote,
  generateBuyerAirQuoteResponse,
  generateAirShippingListingTitle,
  validateAirQuoteGate,
  createAirShippingQuote,
  loadAirShippingQuotes
} from '../airShippingQuoteService';
import { AirShippingOption } from '../../types/airShippingQuote';

export function runAirShippingQuoteTests(): { passed: number; failed: number; log: string[] } {
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

  // Test 1: Revise existing listing priority strategy
  const res1 = createAirShippingQuote('buyer_test_1', '2561001', 'Test Item', 'acc_01', 'Main Store', 1000, 100, 'revise_listing_options');
  assert(Boolean(res1.success && res1.quote?.revisionStrategy === 'revise_listing_options'), 'Test 1: Revise existing listing strategy preference');

  // Test 2: Revise shipping policy strategy
  const res2 = createAirShippingQuote('buyer_test_2', '2561002', 'Test Item 2', 'acc_01', 'Main Store', 1000, 100, 'revise_shipping_policy');
  assert(Boolean(res2.success && res2.quote?.revisionStrategy === 'revise_shipping_policy'), 'Test 2: Revise shipping policy strategy');

  // Test 3: Create air-shipping listing strategy & title formatting
  const airTitle = generateAirShippingListingTitle('john_smith_long_username_test');
  assert(Boolean(airTitle === 'For john_smith_long_username_test Air Shipping' && airTitle.length <= 80), 'Test 3: Air shipping listing title formatting within 80 chars');

  // Test 4: Quote expiration (7 days validation)
  if (res1.quote) {
    const createdTime = new Date(res1.quote.createdAt).getTime();
    const expTime = new Date(res1.quote.expirationDate).getTime();
    const diffDays = Math.round((expTime - createdTime) / (1000 * 60 * 60 * 24));
    assert(Boolean(diffDays === 7), 'Test 4: Quote expiration exactly 7 days');
  }

  // Test 5: Cheapest air-service selection
  const { cheapestAirOption } = calculateCheapestAirOption(1200, 150);
  assert(Boolean(cheapestAirOption && cheapestAirOption.isEligible && cheapestAirOption.airShippingCostUsd > 0), 'Test 5: Cheapest air-service selection calculation');

  // Test 6: DDP validation gate for air options
  const mockDduAir: AirShippingOption = {
    methodId: 'ddu_air',
    carrier: 'DDU Air Express',
    serviceName: 'DDU Express',
    estimatedDeliveryText: '2 days',
    airShippingCostUsd: 20,
    additionalCostUsd: 5,
    rateSource: 'mock',
    comparisonTimestamp: new Date().toISOString(),
    isEligible: true
  };
  const gate6 = validateAirQuoteGate('buyer1', 'item1', 'acc_01', 'DDU', false, mockDduAir);
  assert(Boolean(!gate6.isValid && gate6.errors.some((e) => e.includes('DDUは規約により禁止'))), 'Test 6: DDP validation gate blocks DDU air quote');

  // Test 7: Unsupported carrier / ineligible handling
  const mockIneligibleAir: AirShippingOption = {
    methodId: 'overweight_air',
    carrier: 'Heavy Air',
    serviceName: 'Overweight Express',
    estimatedDeliveryText: '5 days',
    airShippingCostUsd: 100,
    additionalCostUsd: 80,
    rateSource: 'mock',
    comparisonTimestamp: new Date().toISOString(),
    isEligible: false,
    ineligibleReason: '重量オーバー'
  };
  const gate7 = validateAirQuoteGate('buyer1', 'item1', 'acc_01', 'DDP', true, mockIneligibleAir);
  assert(Boolean(!gate7.isValid && gate7.errors.some((e) => e.includes('利用可能な航空便配送サービスが見つかりません'))), 'Test 7: Unsupported or ineligible carrier handled properly');

  // Test 8: Unavailable API / Missing parameters handling
  const gate8 = validateAirQuoteGate('', '', '', 'DDP', true, undefined);
  assert(Boolean(!gate8.isValid && gate8.errors.length >= 3), 'Test 8: Missing parameters / unavailable API handling');

  // Test 9: Duplicate active quote prevention
  const res9 = createAirShippingQuote('buyer_test_1', '2561001', 'Test Item', 'acc_01', 'Main Store', 1000, 100, 'revise_listing_options');
  assert(Boolean(!res9.success && res9.error?.includes('重複見積もりは防止されました')), 'Test 9: Duplicate active quote prevention');

  return { passed, failed, log };
}
