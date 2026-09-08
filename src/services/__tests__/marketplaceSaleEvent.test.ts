import type { CentralInventoryItem } from '../../types/centralInventory';
import {
  getDefaultCentralInventory,
  loadCentralInventory,
  loadInventoryReservations,
  reserveInventory,
  saveCentralInventory
} from '../centralInventoryService';
import { loadCrossChannelInventorySyncRequests } from '../crossChannelInventorySyncService';
import {
  loadMarketplaceSaleEvents,
  MarketplaceSaleEventInput,
  preflightMarketplaceSaleEvent,
  processMarketplaceSaleEvent
} from '../marketplaceSaleEventService';

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

function testItem(sku: string, availableToSell = 3): CentralInventoryItem {
  return {
    sku,
    itemTitle: `Test ${sku}`,
    physicalStock: availableToSell,
    reservedStock: 0,
    availableToSell,
    safetyBuffer: 0,
    unitCostJpy: 1000,
    weightGrams: 100,
    dimensionsCm: { length: 10, width: 8, height: 3 },
    category: 'Collectible',
    channelBindings: [
      {
        channel: 'eBay',
        sellerAccountId: 'ebay-main',
        channelListingId: `ebay-${sku}`,
        syncedStock: availableToSell,
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-09-08T00:00:00.000Z',
        isAutoSyncEnabled: true
      },
      {
        channel: 'Shopee',
        sellerAccountId: 'shopee-main',
        channelListingId: `shopee-${sku}`,
        syncedStock: availableToSell,
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-09-08T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ],
    lastReconciledAt: '2026-09-08T00:00:00.000Z',
    isLockedForOversellingRisk: false
  };
}

function event(overrides: Partial<MarketplaceSaleEventInput> = {}): MarketplaceSaleEventInput {
  return {
    eventId: 'evt-sale-001',
    channel: 'eBay',
    sellerAccountId: 'ebay-main',
    orderId: 'order-001',
    occurredAt: '2026-09-08T09:00:00+09:00',
    lines: [{ sku: 'SKU-A', quantity: 1 }],
    source: 'MANUAL_SIMULATION',
    ...overrides
  };
}

function reset(items: CentralInventoryItem[]): void {
  localStorage.clear();
  saveCentralInventory(items);
}

export function runMarketplaceSaleEventTests(): { passed: number; failed: number; log: string[] } {
  ensureLocalStorage();
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  reset([testItem('SKU-A', 3)]);
  const ebaySale = processMarketplaceSaleEvent(event(), '2026-09-08T00:01:00.000Z');
  const afterEbay = loadCentralInventory().find((item) => item.sku === 'SKU-A')!;
  const ebayQueue = loadCrossChannelInventorySyncRequests();
  assert(ebaySale.success && afterEbay.availableToSell === 2 && afterEbay.reservedStock === 1, 'Test 1: eBay sale immediately reserves Central ATS');
  assert(ebayQueue.some((request) => request.targetChannel === 'Shopee' && request.sku === 'SKU-A' && request.targetStock === 2 && request.status === 'QUEUED'), 'Test 2: eBay sale queues absolute remaining stock for Shopee');

  reset([testItem('SKU-A', 3)]);
  const shopeeSale = processMarketplaceSaleEvent(event({
    eventId: 'evt-shopee-001',
    channel: 'Shopee',
    sellerAccountId: 'shopee-main',
    orderId: 'shopee-order-001'
  }), '2026-09-08T00:02:00.000Z');
  const afterShopee = loadCentralInventory().find((item) => item.sku === 'SKU-A')!;
  const shopeeQueue = loadCrossChannelInventorySyncRequests();
  assert(shopeeSale.success && afterShopee.availableToSell === 2, 'Test 3: Shopee sale uses the same Central Inventory reservation path');
  assert(shopeeQueue.some((request) => request.targetChannel === 'eBay' && request.targetStock === 2), 'Test 4: Shopee sale queues the remaining stock for eBay');

  reset([testItem('SKU-A', 3)]);
  const first = processMarketplaceSaleEvent(event({ eventId: 'evt-replay-001' }), '2026-09-08T00:03:00.000Z');
  const atsAfterFirst = loadCentralInventory()[0].availableToSell;
  const replay = processMarketplaceSaleEvent(event({ eventId: 'evt-replay-001' }), '2026-09-08T00:04:00.000Z');
  const storedReplaySource = loadMarketplaceSaleEvents().find((record) => record.eventId === 'evt-replay-001')!;
  assert(first.success && replay.success && replay.replaySkipped && loadCentralInventory()[0].availableToSell === atsAfterFirst, 'Test 5: Replayed marketplace event never double-decrements inventory');
  assert(storedReplaySource.status === 'PROCESSED' && storedReplaySource.replayCount === 1, 'Test 6: Replay is audited without replacing the original processed event');

  reset([testItem('SKU-A', 3)]);
  const unknown = processMarketplaceSaleEvent(event({ eventId: 'evt-unknown', lines: [{ sku: 'NO-SUCH-SKU', quantity: 1 }] }));
  assert(!unknown.success && unknown.record.status === 'BLOCKED' && loadCentralInventory()[0].availableToSell === 3, 'Test 7: Unknown SKU blocks before Central Inventory mutation');

  reset([testItem('SKU-A', 3)]);
  const wrongAccount = processMarketplaceSaleEvent(event({ eventId: 'evt-wrong-account', sellerAccountId: 'wrong-ebay-account' }));
  assert(!wrongAccount.success && wrongAccount.record.blockingReasons.some((reason) => reason.includes('販売先Binding')), 'Test 8: Missing source marketplace/account Binding blocks incorrect SKU reservation');

  reset([testItem('SKU-A', 1)]);
  const insufficient = processMarketplaceSaleEvent(event({ eventId: 'evt-insufficient', lines: [{ sku: 'SKU-A', quantity: 2 }] }));
  assert(!insufficient.success && loadCentralInventory()[0].availableToSell === 1 && loadInventoryReservations().length === 0, 'Test 9: Insufficient ATS blocks before creating reservations');

  reset([testItem('SKU-A', 2), testItem('SKU-B', 1)]);
  const multiPreflight = processMarketplaceSaleEvent(event({
    eventId: 'evt-multi-block',
    lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-B', quantity: 2 }]
  }));
  const multiBlockedInventory = loadCentralInventory();
  assert(
    !multiPreflight.success && multiBlockedInventory.find((item) => item.sku === 'SKU-A')?.availableToSell === 2 && loadInventoryReservations().length === 0,
    'Test 10: Multi-line preflight prevents partial reservation when any line is unsafe'
  );

  reset([testItem('SKU-A', 3)]);
  const duplicateLines = processMarketplaceSaleEvent(event({
    eventId: 'evt-aggregate',
    lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-A', quantity: 1 }]
  }));
  assert(duplicateLines.success && duplicateLines.record.lines.length === 1 && duplicateLines.record.lines[0].quantity === 2 && loadCentralInventory()[0].availableToSell === 1, 'Test 11: Duplicate SKU lines are aggregated before reservation');

  reset([testItem('SKU-A', 2), testItem('SKU-B', 2)]);
  let reserveCalls = 0;
  const rollback = processMarketplaceSaleEvent(
    event({
      eventId: 'evt-rollback',
      lines: [{ sku: 'SKU-A', quantity: 1 }, { sku: 'SKU-B', quantity: 1 }]
    }),
    '2026-09-08T00:05:00.000Z',
    (...args) => {
      reserveCalls += 1;
      if (reserveCalls === 2) {
        return {
          success: false,
          isOversellingRisk: true,
          updatedAvailableToSell: 2,
          messageJa: 'Injected second-line failure'
        };
      }
      return reserveInventory(...args);
    }
  );
  const rollbackInventory = loadCentralInventory();
  assert(
    !rollback.success && rollback.record.status === 'ROLLED_BACK' && rollbackInventory.every((item) => item.availableToSell === 2) && loadInventoryReservations().length === 0 && loadCrossChannelInventorySyncRequests().length === 0,
    'Test 12: Unexpected mid-batch failure restores inventory, reservations, and sync queue atomically'
  );

  reset([testItem('SKU-A', 3)]);
  const badQuantityPreflight = preflightMarketplaceSaleEvent(event({ eventId: 'evt-bad-qty', lines: [{ sku: 'SKU-A', quantity: 1.5 }] }));
  assert(!badQuantityPreflight.canProcess && badQuantityPreflight.blockingReasons.some((reason) => reason.includes('1以上の整数')), 'Test 13: Sale quantities must be positive integers');

  reset([testItem('SKU-A', 3)]);
  const processedAudit = processMarketplaceSaleEvent(event({ eventId: 'evt-audit-ok' }));
  const processedStored = loadMarketplaceSaleEvents().find((record) => record.eventId === 'evt-audit-ok');
  assert(processedAudit.success && processedStored?.status === 'PROCESSED' && processedStored.reservationIds.length === 1, 'Test 14: Successful intake stores a processed audit record and reservation reference');

  reset([testItem('SKU-A', 3)]);
  const blockedAudit = processMarketplaceSaleEvent(event({ eventId: 'evt-audit-block', sellerAccountId: 'not-mapped' }));
  const blockedStored = loadMarketplaceSaleEvents().find((record) => record.eventId === 'evt-audit-block');
  assert(!blockedAudit.success && blockedStored?.status === 'BLOCKED' && Boolean(blockedStored.blockingReasons.length), 'Test 15: Blocked intake stores the reason for review');

  // Isolate subsequent master-suite tests from this suite's inventory/event state.
  localStorage.clear();
  saveCentralInventory(getDefaultCentralInventory());

  return { passed, failed, log };
}
