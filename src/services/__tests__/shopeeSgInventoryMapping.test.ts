import type { CentralInventoryItem } from '../../types/centralInventory';
import {
  evaluateShopeeSgInventoryMapping,
  isShopeeSgMappingReadyForInventoryWrite,
  loadShopeeSgInventoryMappings,
  ShopeeSgInventoryMappingInput,
  upsertShopeeSgInventoryMapping
} from '../shopeeSgInventoryMappingService';

function ensureLocalStorage(): void {
  if (typeof globalThis.localStorage !== 'undefined') return;
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function item(
  sku: string,
  bindings: CentralInventoryItem['channelBindings'] = []
): CentralInventoryItem {
  return {
    sku,
    itemTitle: `Item ${sku}`,
    physicalStock: 3,
    reservedStock: 0,
    availableToSell: 3,
    safetyBuffer: 0,
    unitCostJpy: 1000,
    weightGrams: 100,
    dimensionsCm: { length: 10, width: 8, height: 3 },
    category: 'Collectible',
    channelBindings: bindings,
    lastReconciledAt: '2026-09-08T00:00:00.000Z',
    isLockedForOversellingRisk: false
  };
}

function validInput(overrides: Partial<ShopeeSgInventoryMappingInput> = {}): ShopeeSgInventoryMappingInput {
  return {
    sku: 'SKU-001',
    sellerAccountId: 'shopee_sg_main',
    shopId: '123456789',
    shopeeItemId: '987654321',
    modelResolutionStatus: 'NO_MODEL_ID_CONFIRMED',
    sellerCentreChecked: true,
    mappingConfirmed: true,
    checkedBy: 'owner',
    checkedAt: '2026-09-08T08:50:00+09:00',
    verificationNote: 'Seller Centreで商品タイトル・画像・SKUを照合した。',
    ...overrides
  };
}

export function runShopeeSgInventoryMappingTests(): { passed: number; failed: number; log: string[] } {
  ensureLocalStorage();
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.clear();
  const noBindingItems = [item('SKU-001'), item('SKU-002')];
  const evaluation = evaluateShopeeSgInventoryMapping(validInput(), noBindingItems, []);
  assert(evaluation.canSave && evaluation.centralLinkStatus === 'NOT_LINKED', 'Test 1: Verified Shopee identity can be saved before Central Binding exists');

  const beforeItems = JSON.stringify(noBindingItems);
  const saved = upsertShopeeSgInventoryMapping(validInput(), noBindingItems, '2026-09-08T00:00:00.000Z');
  assert(
    saved.success && saved.record?.status === 'IDENTITY_VERIFIED_API_BLOCKED' && saved.record.apiSchemaStatus === 'OFFICIAL_SCHEMA_REVIEW_REQUIRED' && saved.record.externalWriteAllowed === false,
    'Test 2: Saved identity remains API-blocked until official Shopee schema is verified'
  );
  assert(JSON.stringify(noBindingItems) === beforeItems, 'Test 3: Saving Shopee identity mapping does not mutate Central Inventory');
  assert(loadShopeeSgInventoryMappings().length === 1, 'Test 4: Shopee SG mapping persists locally');
  assert(Boolean(saved.record && !isShopeeSgMappingReadyForInventoryWrite(saved.record)), 'Test 5: Unverified API schema can never become inventory-write ready');

  const invalidIds = evaluateShopeeSgInventoryMapping(validInput({ shopId: 'shop-1', shopeeItemId: 'item-1' }), noBindingItems, []);
  assert(invalidIds.blockingReasons.length >= 2 && !invalidIds.canSave, 'Test 6: Shop ID and Item ID must be positive numeric IDs');

  const missingModel = evaluateShopeeSgInventoryMapping(validInput({ modelResolutionStatus: 'MODEL_ID_VERIFIED', shopeeModelId: '' }), noBindingItems, []);
  assert(missingModel.missingFields.includes('Shopee Model ID') && !missingModel.canSave, 'Test 7: Model-verified products require a Shopee Model ID');

  const contradictoryModel = evaluateShopeeSgInventoryMapping(validInput({ modelResolutionStatus: 'NO_MODEL_ID_CONFIRMED', shopeeModelId: '123' }), noBindingItems, []);
  assert(contradictoryModel.blockingReasons.some((reason) => reason.includes('Model IDなし確認済み')), 'Test 8: No-model confirmation rejects a contradictory Model ID');

  const unknownSku = evaluateShopeeSgInventoryMapping(validInput({ sku: 'SKU-NOT-FOUND' }), noBindingItems, []);
  assert(unknownSku.centralLinkStatus === 'CONFLICT' && !unknownSku.canSave, 'Test 9: Mapping a Shopee item to a missing Central SKU is blocked');

  const exactBindingItems = [item('SKU-001', [{
    channel: 'Shopee',
    sellerAccountId: 'shopee_sg_main',
    channelListingId: '987654321',
    syncedStock: 3,
    syncStatus: 'SYNCED',
    lastSyncedAt: '2026-09-08T00:00:00.000Z',
    isAutoSyncEnabled: true
  }])];
  const exact = evaluateShopeeSgInventoryMapping(validInput(), exactBindingItems, []);
  assert(exact.canSave && exact.centralLinkStatus === 'MATCHED' && exact.centralBindingListingId === '987654321', 'Test 10: Exact account and Shopee Item ID match is recognized as linked');

  const conflictItems = [item('SKU-001', [{
    channel: 'Shopee',
    sellerAccountId: 'shopee_sg_main',
    channelListingId: '111111111',
    syncedStock: 3,
    syncStatus: 'SYNCED',
    lastSyncedAt: '2026-09-08T00:00:00.000Z',
    isAutoSyncEnabled: true
  }])];
  const conflict = evaluateShopeeSgInventoryMapping(validInput(), conflictItems, []);
  assert(conflict.centralLinkStatus === 'CONFLICT' && !conflict.canSave, 'Test 11: Same-account Central Binding with a different Item ID is blocked');

  const duplicateRecord = saved.record!;
  const duplicate = evaluateShopeeSgInventoryMapping(validInput({ sku: 'SKU-002' }), noBindingItems, [duplicateRecord]);
  assert(duplicate.blockingReasons.some((reason) => reason.includes('別SKU')) && !duplicate.canSave, 'Test 12: One Shopee Item ID cannot be mapped to two Central SKUs');

  const incompleteCheck = evaluateShopeeSgInventoryMapping(validInput({ sellerCentreChecked: false, mappingConfirmed: false }), noBindingItems, []);
  assert(
    incompleteCheck.missingFields.includes('Seller Centre確認') && incompleteCheck.missingFields.includes('SKUとShopee商品の一致確認') && !incompleteCheck.canSave,
    'Test 13: Human Seller Centre and product-identity confirmations are mandatory'
  );

  const modelVerified = evaluateShopeeSgInventoryMapping(validInput({ modelResolutionStatus: 'MODEL_ID_VERIFIED', shopeeModelId: '555555555' }), noBindingItems, []);
  assert(modelVerified.canSave && modelVerified.normalized.shopeeModelId === '555555555', 'Test 14: A verified positive Shopee Model ID is accepted');

  return { passed, failed, log };
}
