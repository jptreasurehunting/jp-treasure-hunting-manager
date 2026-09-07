import { CentralInventoryItem } from '../../types/centralInventory';
import {
  applyInventoryImportPreview,
  buildInventoryImportPreview,
  getLastInventoryImportBackup,
  parseInventoryCsv,
  restoreLastInventoryImportBackup
} from '../inventoryImportService';
import { loadCentralInventory, saveCentralInventory } from '../centralInventoryService';

function makeExistingItem(): CentralInventoryItem {
  return {
    sku: 'SKU-EXISTING',
    itemTitle: 'Existing Item',
    physicalStock: 2,
    reservedStock: 0,
    availableToSell: 2,
    safetyBuffer: 0,
    unitCostJpy: 1000,
    weightGrams: 100,
    dimensionsCm: { length: 10, width: 8, height: 3 },
    category: 'Test',
    channelBindings: [
      {
        channel: 'eBay',
        sellerAccountId: 'account-1',
        channelListingId: 'listing-1',
        syncedStock: 2,
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ],
    lastReconciledAt: '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: false
  };
}

const HEADER = 'sku,itemTitle,physicalStock,reservedStock,safetyBuffer,unitCostJpy,weightGrams,lengthCm,widthCm,heightCm,category';

export function runInventoryImportTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];

  const assert = (condition: boolean, name: string) => {
    if (condition) {
      passed += 1;
      log.push(`✅ [PASS] ${name}`);
    } else {
      failed += 1;
      log.push(`❌ [FAIL] ${name}`);
    }
  };

  localStorage.clear();
  const existing = makeExistingItem();
  saveCentralInventory([existing]);

  const validCsv = [
    HEADER,
    'SKU-EXISTING,"Existing Item Updated",3,1,0,1200,110,10,8,3,"Test"',
    'SKU-NEW,"New Item",1,0,0,2500,90,9,7,2,"Collectibles"'
  ].join('\n');

  const parsed = parseInventoryCsv(validCsv);
  assert(parsed.errors.length === 0 && parsed.rows.length === 2, 'Test 1: Valid CSV parses into inventory rows');

  const preview = buildInventoryImportPreview(validCsv, [existing]);
  assert(preview.canApply && preview.added === 1 && preview.updated === 1, 'Test 2: Preview identifies ADD and UPDATE without writing data');
  assert(loadCentralInventory()[0].physicalStock === 2, 'Test 3: Preview does not modify current inventory');

  const updateRow = preview.rows.find((row) => row.sku === 'SKU-EXISTING');
  assert(updateRow?.after?.channelBindings.length === 1, 'Test 4: Existing marketplace bindings are preserved during import preview');
  assert(updateRow?.after?.availableToSell === 2, 'Test 5: Available-to-sell is recalculated from physical, reserved and safety stock');

  const applyResult = applyInventoryImportPreview(preview, [existing]);
  const afterApply = loadCentralInventory();
  assert(applyResult.success && applyResult.appliedCount === 2, 'Test 6: Approved preview applies valid changes');
  assert(afterApply.length === 2 && afterApply.find((item) => item.sku === 'SKU-NEW')?.physicalStock === 1, 'Test 7: New SKU is added after approval');
  assert(Boolean(getLastInventoryImportBackup()), 'Test 8: Import creates a rollback backup before writing');

  const restoreResult = restoreLastInventoryImportBackup();
  const restored = loadCentralInventory();
  assert(restoreResult.success && restored.length === 1 && restored[0].physicalStock === 2, 'Test 9: Rollback restores the pre-import inventory state');

  const duplicateCsv = [
    HEADER,
    'DUP,"Duplicate A",1,0,0,100,10,1,1,1,"Test"',
    'DUP,"Duplicate B",1,0,0,100,10,1,1,1,"Test"'
  ].join('\n');
  const duplicatePreview = buildInventoryImportPreview(duplicateCsv, [existing]);
  assert(!duplicatePreview.canApply && duplicatePreview.errorRows === 2, 'Test 10: Duplicate SKUs block the entire import preview');

  const invalidCsv = [
    HEADER,
    'BAD,"Invalid",1,2,0,-100,10,1,1,1,"Test"'
  ].join('\n');
  const invalidPreview = buildInventoryImportPreview(invalidCsv, [existing]);
  assert(!invalidPreview.canApply && invalidPreview.errorRows === 1, 'Test 11: Invalid stock/cost values block import');

  const beforeBlockedApply = JSON.stringify(loadCentralInventory());
  const blockedResult = applyInventoryImportPreview(invalidPreview, loadCentralInventory());
  assert(!blockedResult.success && JSON.stringify(loadCentralInventory()) === beforeBlockedApply, 'Test 12: Failed preview cannot modify inventory');

  const unchangedCsv = [
    HEADER,
    'SKU-EXISTING,"Existing Item",2,0,0,1000,100,10,8,3,"Test"'
  ].join('\n');
  const unchangedPreview = buildInventoryImportPreview(unchangedCsv, [existing]);
  assert(!unchangedPreview.canApply && unchangedPreview.unchanged === 1, 'Test 13: No-op imports are detected and not applied');

  return { passed, failed, log };
}
