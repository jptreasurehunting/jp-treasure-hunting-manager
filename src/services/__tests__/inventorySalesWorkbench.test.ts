import { buildInventorySalesWorkbench } from '../inventorySalesWorkbenchService';
import { CentralInventoryItem } from '../../types/centralInventory';

function makeItem(
  overrides: Partial<CentralInventoryItem> & Pick<CentralInventoryItem, 'sku' | 'itemTitle'>
): CentralInventoryItem {
  return {
    sku: overrides.sku,
    itemTitle: overrides.itemTitle,
    physicalStock: overrides.physicalStock ?? 2,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 2,
    safetyBuffer: overrides.safetyBuffer ?? 0,
    unitCostJpy: overrides.unitCostJpy ?? 1000,
    weightGrams: overrides.weightGrams ?? 100,
    dimensionsCm: overrides.dimensionsCm ?? { length: 10, width: 10, height: 5 },
    category: overrides.category ?? 'Test',
    channelBindings: overrides.channelBindings ?? [
      {
        channel: 'eBay',
        sellerAccountId: 'test',
        channelListingId: `listing-${overrides.sku}`,
        syncedStock: overrides.availableToSell ?? 2,
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false,
    oversellingRiskReason: overrides.oversellingRiskReason
  };
}

export function runInventorySalesWorkbenchTests(): { passed: number; failed: number; log: string[] } {
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

  const readyHigh = makeItem({
    sku: 'READY-HIGH',
    itemTitle: 'Ready High',
    availableToSell: 3,
    physicalStock: 3,
    unitCostJpy: 5000
  });
  const readyLow = makeItem({
    sku: 'READY-LOW',
    itemTitle: 'Ready Low',
    availableToSell: 1,
    physicalStock: 1,
    unitCostJpy: 1000
  });
  const review = makeItem({
    sku: 'REVIEW',
    itemTitle: 'Review',
    channelBindings: [
      {
        channel: 'eBay',
        sellerAccountId: 'test',
        channelListingId: 'listing-review',
        syncedStock: 2,
        syncStatus: 'FAILED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ]
  });
  const blocked = makeItem({
    sku: 'BLOCKED',
    itemTitle: 'Blocked',
    isLockedForOversellingRisk: true
  });
  const out = makeItem({
    sku: 'OUT',
    itemTitle: 'Out',
    physicalStock: 0,
    availableToSell: 0
  });

  const snapshot = buildInventorySalesWorkbench([out, readyLow, blocked, review, readyHigh]);

  assert(snapshot.summary.totalSkus === 5, 'Test 1: Summary counts all SKUs');
  assert(snapshot.summary.readySkus === 2, 'Test 2: READY count is correct');
  assert(snapshot.summary.reviewRequiredSkus === 1, 'Test 3: REVIEW_REQUIRED count is correct');
  assert(snapshot.summary.blockedSkus === 1, 'Test 4: BLOCKED count is correct');
  assert(snapshot.summary.outOfStockSkus === 1, 'Test 5: OUT_OF_STOCK count is correct');
  assert(snapshot.summary.totalSellableUnits === 8, 'Test 6: Sellable unit total is correct');
  assert(snapshot.summary.totalSellableCostBasisJpy === 20000, 'Test 7: Sellable cost basis is calculated from unit cost × ATS');
  assert(snapshot.rows[0].sku === 'READY-HIGH' && snapshot.rows[1].sku === 'READY-LOW', 'Test 8: READY rows are sorted by tied cost basis descending');
  assert(snapshot.rows[2].state === 'REVIEW_REQUIRED', 'Test 9: Sync failures require review');
  assert(snapshot.rows[3].state === 'BLOCKED', 'Test 10: Overselling lock blocks sale readiness');
  assert(snapshot.rows[4].state === 'OUT_OF_STOCK', 'Test 11: Zero ATS is out of stock');

  const unbound = makeItem({
    sku: 'UNBOUND',
    itemTitle: 'Unbound',
    channelBindings: []
  });
  const unboundResult = buildInventorySalesWorkbench([unbound]);
  assert(unboundResult.rows[0].state === 'REVIEW_REQUIRED', 'Test 12: Sellable inventory with no sales channel binding requires review');

  const pendingZero = makeItem({
    sku: 'PENDING-ZERO',
    itemTitle: 'Pending Zero',
    physicalStock: 0,
    availableToSell: 0,
    channelBindings: [
      {
        channel: 'Shopee',
        sellerAccountId: 'shopee-sg',
        channelListingId: 'listing-pending-zero',
        syncedStock: 1,
        syncStatus: 'PENDING',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ]
  });
  const pendingResult = buildInventorySalesWorkbench([pendingZero]);
  assert(
    pendingResult.rows[0].state === 'REVIEW_REQUIRED' && pendingResult.rows[0].reasonsJa.some((reason) => reason.includes('反映待ち')),
    'Test 13: Pending external zero-stock write stays visible as review required instead of silently appearing out-of-stock'
  );

  return { passed, failed, log };
}
