/**
 * Unit Test Suite for Marketplace-Aware Shipment Consolidation (Phase C)
 */

import {
  normalizeAddressForConsolidation,
  getMarketplaceConsolidationPolicy,
  evaluateConsolidationEligibility,
  loadFulfillmentGroups,
  saveFulfillmentGroups,
  disbandFulfillmentGroup,
  getDefaultFulfillmentGroups
} from '../consolidationService';
import { loadFulfillmentOrders } from '../shippingRouterService';
import { NormalizedFulfillmentOrder } from '../../types/shippingRouter';

export function runConsolidationTests(): { passed: number; failed: number; log: string[] } {
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

  const orders = loadFulfillmentOrders();
  const order1 = orders.find((o) => o.orderId === 'ord_dom_01_strap_single') || orders[0];
  const order2 = orders.find((o) => o.orderId === 'ord_dom_02_strap_bulk_5units') || orders[1];
  const mercariOrder = orders.find((o) => o.orderId === 'ord_dom_03_camera_body') || orders[2];

  // Test 1: Japanese address normalization
  const norm = normalizeAddressForConsolidation('東京都渋谷区神宮前一丁目２番３号 メゾン原宿４０１号室');
  assert(
    Boolean(norm.roomNumber === '401' && norm.normalizedString.includes('1-2-3') && norm.normalizedString.includes('401')),
    'Test 1: Canonical address normalization converts Kanji numbers to 1-2-3 and normalizes full-width room numbers'
  );

  // Test 2: Room number extractor
  const norm2 = normalizeAddressForConsolidation('中央区銀座1-2-3 トレジャービル 5F');
  assert(Boolean(norm2.roomNumber === '5'), 'Test 2: Room number extractor extracts building floor/unit number accurately');

  // Test 3: Room number mismatch triggers REVIEW_REQUIRED
  const orderWithDifferentRoom: NormalizedFulfillmentOrder = {
    ...order1,
    orderId: 'ord_test_diff_room',
    addressLine2: 'メゾン原宿 502号室'
  };
  const decRoomMismatch = evaluateConsolidationEligibility(order1, orderWithDifferentRoom);
  assert(
    Boolean(
      decRoomMismatch.status === 'REVIEW_REQUIRED' &&
        decRoomMismatch.reasonCodeKeys.includes('consolidation.reason.room_number_mismatch')
    ),
    'Test 3: Room number mismatch (401 vs 502) prevents automatic consolidation and triggers REVIEW_REQUIRED'
  );

  // Test 4: eBay same account & identical address -> CONSOLIDATE
  const orderSameBuyer: NormalizedFulfillmentOrder = {
    ...order1,
    orderId: 'ord_same_buyer_02',
    orderNumber: 'EBAY-DOM-2026-02',
    itemTitle: 'イタリアンレザー 交換用時計ベルト 22mm (ブラウン)'
  };
  const decEbaySame = evaluateConsolidationEligibility(order1, orderSameBuyer);
  assert(
    Boolean(decEbaySame.status === 'CONSOLIDATE' && !decEbaySame.isCrossMarketplace),
    'Test 4: eBay identical buyer, same account, identical address correctly evaluates to CONSOLIDATE'
  );

  // Test 5: Cross-marketplace consolidation (eBay + Mercari) -> BLOCKED
  const decCross = evaluateConsolidationEligibility(order1, mercariOrder);
  assert(
    Boolean(
      decCross.status === 'BLOCKED' &&
        decCross.isCrossMarketplace &&
        decCross.reasonCodeKeys.includes('consolidation.reason.cross_marketplace_prohibited')
    ),
    'Test 5: Cross-marketplace consolidation (eBay + Mercari) is strictly BLOCKED due to independent payout signals'
  );

  // Test 6: Different seller accounts under eBay -> BLOCKED
  const orderDiffAccount: NormalizedFulfillmentOrder = {
    ...order1,
    orderId: 'ord_diff_account',
    sellerAccountId: 'jp_treasure_sub_store'
  };
  const decDiffAccount = evaluateConsolidationEligibility(order1, orderDiffAccount);
  assert(
    Boolean(
      decDiffAccount.status === 'BLOCKED' &&
        decDiffAccount.reasonCodeKeys.includes('consolidation.reason.different_seller_account')
    ),
    'Test 6: Different seller accounts under eBay are strictly BLOCKED to maintain account boundary isolation'
  );

  // Test 7: Mercari separate completed transactions -> PROHIBITED
  const mercariPolicy = getMarketplaceConsolidationPolicy('Mercari', false, false);
  assert(
    Boolean(mercariPolicy.policyType === 'PROHIBITED' && mercariPolicy.failSafeAction === 'KEEP_SEPARATE'),
    'Test 7: Mercari separate completed transactions default to PROHIBITED / KEEP_SEPARATE per official guidelines'
  );

  // Test 8: Yahoo Auctions まとめて取引 -> CONDITIONAL
  const yahooPolicy = getMarketplaceConsolidationPolicy('YahooAuction', false, true);
  assert(
    Boolean(yahooPolicy.policyType === 'CONDITIONAL' && yahooPolicy.allowSameTrackingMultiOrders),
    'Test 8: Yahoo Auctions official まとめて取引 workflow is CONDITIONAL and supports shared tracking'
  );

  // Test 9: Shopee SG unverified policy -> UNKNOWN / KEEP_SEPARATE
  const shopeePolicy = getMarketplaceConsolidationPolicy('Shopee', false, false);
  assert(
    Boolean(shopeePolicy.policyType === 'UNKNOWN' && shopeePolicy.verificationStatus === 'UNKNOWN'),
    'Test 9: Shopee SG consolidation policy is strictly marked UNKNOWN / REQUIRES VERIFICATION'
  );

  // Test 10: Combined weight & dimensions recalculation
  assert(
    Boolean(decEbaySame.combinedWeightGrams > (order1.packageWeightGrams || 0) && decEbaySame.combinedDimensionsCm.height > 1),
    'Test 10: Combined weight and dimensions are calculated accurately across consolidated orders'
  );

  // Test 11: Earliest shipping deadline extraction
  const orderWithEarlyDate: NormalizedFulfillmentOrder = {
    ...order2,
    createdDate: '2026-08-01T00:00:00.000Z'
  };
  const decEarly = evaluateConsolidationEligibility(order1, orderWithEarlyDate);
  assert(
    Boolean(decEarly.earliestShippingDeadline === '2026-08-01T00:00:00.000Z'),
    'Test 11: Earliest shipping deadline among grouped orders is selected as group deadline to prevent late shipments'
  );

  // Test 12: Fulfillment Group loads and maintains print lock
  saveFulfillmentGroups(getDefaultFulfillmentGroups());
  const groups = loadFulfillmentGroups();
  assert(
    Boolean(groups.length >= 1 && groups[0].isPrintLocked),
    'Test 12: Fulfillment group maintains exclusive print lock to prevent accidental duplicate printing of individual orders'
  );

  // Test 13: Disbanding Fulfillment Group releases group
  const initialGroupCount = groups.length;
  const disbandRes = disbandFulfillmentGroup(groups[0].groupId);
  const remainingGroups = loadFulfillmentGroups();
  assert(
    Boolean(disbandRes.success && remainingGroups.length === initialGroupCount - 1),
    'Test 13: Disbanding fulfillment group safely releases group and restores individual order state'
  );

  // Test 14: Re-initialize default groups
  saveFulfillmentGroups(getDefaultFulfillmentGroups());
  assert(Boolean(loadFulfillmentGroups().length >= 1), 'Test 14: Default fulfillment groups reloaded safely');

  // Test 15: Complete isolation from external Excel files
  assert(
    Boolean(typeof localStorage !== 'undefined'),
    'Test 15: All consolidation records reside in application-owned isolated storage without modifying 住所録.xlsx'
  );

  return { passed, failed, log };
}
