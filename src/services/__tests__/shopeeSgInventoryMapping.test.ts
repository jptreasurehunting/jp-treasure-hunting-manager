import type { CentralInventoryItem } from '../../types/centralInventory';
import { loadCentralInventory, saveCentralInventory } from '../centralInventoryService';
import {
  attachShopeeSgMappingToCentralInventory,
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

  const elsewhereBindingItems = [
    item('SKU-001'),
    item('SKU-002', [{
      channel: 'Shopee',
      sellerAccountId: 'shopee_sg_main',
      channelListingId: '987654321',
      syncedStock: 3,
      syncStatus: 'SYNCED',
      lastSyncedAt: '2026-09-08T00:00:00.000Z',
      isAutoSyncEnabled: false
    }])
  ];
  const elsewhereConflict = evaluateShopeeSgInventoryMapping(validInput(), elsewhereBindingItems, []);
  assert(elsewhereConflict.centralLinkStatus === 'CONFLICT' && !elsewhereConflict.canSave, 'Test 15: A Shopee Item ID already bound to another Central SKU is blocked globally');

  localStorage.clear();
  const attachItems = [item('SKU-ATTACH-001')];
  saveCentralInventory(attachItems);
  const attachMapping = upsertShopeeSgInventoryMapping(validInput({
    sku: 'SKU-ATTACH-001',
    shopId: '222222222',
    shopeeItemId: '333333333'
  }), attachItems, '2026-09-08T00:10:00.000Z');
  const attachBase = {
    mappingId: attachMapping.record!.mappingId,
    confirmedExternalStock: 3,
    stockConfirmedInSellerCentre: true,
    attachedBy: 'owner',
    attachedAt: '2026-09-08T00:15:00.000Z',
    attachmentNote: 'Seller Centreの現在在庫3点と中央ATS3点の一致を確認。'
  };

  const missingStockConfirmation = attachShopeeSgMappingToCentralInventory({ ...attachBase, stockConfirmedInSellerCentre: false });
  assert(!missingStockConfirmation.success && missingStockConfirmation.blockingReasons.some((reason) => reason.includes('現在在庫の確認')), 'Test 16: Central Binding attachment requires explicit Seller Centre stock confirmation');

  const mismatchStock = attachShopeeSgMappingToCentralInventory({ ...attachBase, confirmedExternalStock: 2 });
  assert(!mismatchStock.success && mismatchStock.blockingReasons.some((reason) => reason.includes('中央ATS 3 点')), 'Test 17: Binding attachment blocks when confirmed Shopee stock differs from Central ATS');

  const attached = attachShopeeSgMappingToCentralInventory(attachBase);
  const attachedCentral = loadCentralInventory().find((candidate) => candidate.sku === 'SKU-ATTACH-001')!;
  const attachedBinding = attachedCentral.channelBindings.find((binding) => binding.channel === 'Shopee')!;
  assert(
    attached.success && attachedBinding.channelListingId === '333333333' && attachedBinding.syncedStock === 3 && attachedBinding.syncStatus === 'SYNCED',
    'Test 18: Confirmed matching Shopee stock creates the Central Inventory Binding with the observed stock'
  );
  assert(attachedBinding.isAutoSyncEnabled === false, 'Test 19: Newly attached Shopee Binding keeps automatic inventory writes disabled');

  const updatedMapping = loadShopeeSgInventoryMappings().find((record) => record.mappingId === attachBase.mappingId)!;
  assert(updatedMapping.centralLinkStatus === 'MATCHED' && updatedMapping.centralBindingListingId === '333333333', 'Test 20: Successful attachment updates the Shopee Mapping to MATCHED');
  assert(!isShopeeSgMappingReadyForInventoryWrite(updatedMapping), 'Test 21: Matched Central Binding still cannot write to Shopee while official API schema is unverified');

  return { passed, failed, log };
}
