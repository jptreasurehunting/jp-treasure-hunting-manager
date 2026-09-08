import {
  evaluateShopeeSingaporeInventoryBinding,
  evaluateShopeeSingaporeSyncReadiness,
  findShopeeSingaporeBindingForSyncRequest,
  loadShopeeSingaporeInventoryBindings,
  upsertShopeeSingaporeInventoryBinding
} from '../shopeeSingaporeInventoryBindingService';

export function runShopeeSingaporeInventoryBindingTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.removeItem('jp_shopee_sg_inventory_bindings_v1');

  const validInput = {
    centralSku: 'SKU-SG-001',
    sellerAccountId: 'shopee-sg-main',
    shopId: '123456789',
    itemId: '987654321',
    modelId: '111222333',
    sellerCentreUrl: 'https://seller.shopee.sg/portal/product/list/live/all?operationSortBy=recommend_v2',
    verifiedBy: 'owner',
    verificationNote: 'Seller Centreの商品と中央在庫SKUを画像・商品名で照合。'
  };

  const evaluation = evaluateShopeeSingaporeInventoryBinding(validInput);
  assert(evaluation.canSave, 'Test 1: Complete Singapore Seller Centre mapping is accepted for storage');

  const saved = upsertShopeeSingaporeInventoryBinding(validInput, '2026-09-08T01:00:00.000Z');
  assert(saved.success && saved.record?.schemaStatus === 'OFFICIAL_SCHEMA_REVIEW_REQUIRED', 'Test 2: Saved binding remains official-schema-review-required');
  assert(saved.record?.externalWriteAllowed === false, 'Test 3: Saving mapping never enables Shopee write');
  assert(loadShopeeSingaporeInventoryBindings().length === 1, 'Test 4: Binding is persisted locally');

  const badHost = evaluateShopeeSingaporeInventoryBinding({ ...validInput, sellerCentreUrl: 'https://seller.shopee.co.th/portal/product/list' });
  assert(!badHost.canSave, 'Test 5: Non-Singapore Seller Centre URL is rejected');

  const badIds = evaluateShopeeSingaporeInventoryBinding({ ...validInput, shopId: 'abc', itemId: '0' });
  assert(!badIds.canSave, 'Test 6: Invalid shop/item IDs are rejected');

  const request: any = {
    requestId: 'sync-sg-1', sourceEventId: 'evt-1', sku: 'SKU-SG-001', targetChannel: 'Shopee',
    sellerAccountId: 'shopee-sg-main', channelListingId: 'legacy-listing-ref', targetStock: 0,
    triggerChannel: 'eBay', reason: 'SALE_RESERVATION', status: 'QUEUED', createdAt: '2026-09-08T01:00:00.000Z', externalWritePerformed: false
  };
  const found = findShopeeSingaporeBindingForSyncRequest(request);
  assert(found?.itemId === '987654321' && found?.modelId === '111222333', 'Test 7: Sync request resolves to verified Shopee item/model mapping');

  const readiness = evaluateShopeeSingaporeSyncReadiness(request);
  assert(readiness.readyForExternalWrite === false, 'Test 8: Shopee external write is blocked while official schema is unverified');
  assert(readiness.blockingReasons.some((reason) => reason.includes('Request Schema')), 'Test 9: Blocking reason explains official schema requirement');

  const missing: any = { ...request, sku: 'SKU-NOT-MAPPED' };
  const missingReadiness = evaluateShopeeSingaporeSyncReadiness(missing);
  assert(missingReadiness.blockingReasons.some((reason) => reason.includes('対応関係が未登録')), 'Test 10: Unmapped SKU is blocked explicitly');

  const wrongChannel: any = { ...request, targetChannel: 'eBay' };
  assert(!findShopeeSingaporeBindingForSyncRequest(wrongChannel), 'Test 11: eBay request cannot use Shopee mapping');

  return { passed, failed, log };
}
