import { CentralInventoryItem } from '../../types/centralInventory';
import { buildInventorySalesPriorityQueue } from '../inventorySalesPriorityService';

function makeItem(overrides: Partial<CentralInventoryItem> & Pick<CentralInventoryItem, 'sku' | 'itemTitle'>): CentralInventoryItem {
  return {
    sku: overrides.sku,
    itemTitle: overrides.itemTitle,
    physicalStock: overrides.physicalStock ?? 1,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 1,
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
        syncedStock: overrides.availableToSell ?? 1,
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false
  };
}

export function runInventorySalesPriorityTests(): { passed: number; failed: number; log: string[] } {
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

  const blocked = makeItem({
    sku: 'BLOCKED',
    itemTitle: 'Blocked',
    isLockedForOversellingRisk: true,
    unitCostJpy: 9000
  });
  const sync = makeItem({
    sku: 'SYNC',
    itemTitle: 'Sync Review',
    unitCostJpy: 7000,
    channelBindings: [
      {
        channel: 'eBay',
        sellerAccountId: 'test',
        channelListingId: 'listing-sync',
        syncedStock: 1,
        syncStatus: 'FAILED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ]
  });
  const unlistedHigh = makeItem({
    sku: 'UNLISTED-HIGH',
    itemTitle: 'Unlisted High',
    availableToSell: 3,
    physicalStock: 3,
    unitCostJpy: 5000,
    channelBindings: []
  });
  const unlistedLow = makeItem({
    sku: 'UNLISTED-LOW',
    itemTitle: 'Unlisted Low',
    unitCostJpy: 1000,
    channelBindings: []
  });
  const ready = makeItem({
    sku: 'READY',
    itemTitle: 'Ready',
    availableToSell: 2,
    physicalStock: 2,
    unitCostJpy: 3000
  });
  const out = makeItem({
    sku: 'OUT',
    itemTitle: 'Out',
    physicalStock: 0,
    availableToSell: 0,
    unitCostJpy: 4000
  });

  const queue = buildInventorySalesPriorityQueue([
    ready,
    unlistedLow,
    out,
    sync,
    blocked,
    unlistedHigh
  ]);

  assert(queue.rows[0].actionKind === 'CLEAR_BLOCK', 'Test 1: Safety block is handled before sales actions');
  assert(queue.rows[1].actionKind === 'FIX_SYNC', 'Test 2: Sync failures are prioritized before listing work');
  assert(queue.rows[2].sku === 'UNLISTED-HIGH' && queue.rows[3].sku === 'UNLISTED-LOW', 'Test 3: Unlisted items sort by tied cost within action type');
  assert(queue.rows[4].actionKind === 'SELL_READY', 'Test 4: Ready inventory follows prerequisite fixes');
  assert(queue.rows[5].actionKind === 'NO_SALE_ACTION', 'Test 5: Zero ATS is excluded from active sales work');
  assert(queue.summary.activeActionCount === 5, 'Test 6: Active action count excludes zero-stock rows');
  assert(queue.summary.blockedCount === 1, 'Test 7: Blocked count is correct');
  assert(queue.summary.syncReviewCount === 1, 'Test 8: Sync review count is correct');
  assert(queue.summary.unlistedCount === 2, 'Test 9: Unlisted count is correct');
  assert(queue.summary.readyToSellCount === 1, 'Test 10: Ready-to-sell count is correct');
  assert(queue.summary.actionableTiedCostJpy === 38000, 'Test 11: Actionable tied cost excludes zero ATS and totals cost basis correctly');
  assert(queue.rows[2].priority === 'P1' && queue.rows[4].priority === 'P2', 'Test 12: Priority labels distinguish prerequisite work from ready sales');

  return { passed, failed, log };
}
