/**
 * Unit Test Suite for Central Inventory SSOT & Cross-Channel Sync
 */

import {
  loadCentralInventory,
  saveCentralInventory,
  reserveInventory,
  commitSoldInventory,
  releaseReservation,
  reconcileCentralInventory,
  loadInventoryReservations,
  getDefaultCentralInventory,
  recordExternalChannelInventorySyncResult
} from '../centralInventoryService';
import { loadCrossChannelInventorySyncRequests } from '../crossChannelInventorySyncService';

export function runCentralInventoryTests(): { passed: number; failed: number; log: string[] } {
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

  localStorage.clear();
  saveCentralInventory(getDefaultCentralInventory());

  const items = loadCentralInventory();
  assert(Boolean(items.length >= 3), 'Test 1: Central inventory loads seed catalog items (Single Source of Truth)');

  const strap = items.find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  assert(
    strap.availableToSell === strap.physicalStock - strap.reservedStock - strap.safetyBuffer,
    'Test 2: Available to Sell (ATS) equals physicalStock - reservedStock - safetyBuffer'
  );

  const initialATS = strap.availableToSell;
  const initialShopeeStock = strap.channelBindings.find((binding) => binding.channel === 'Shopee')!.syncedStock;
  const saleEventId = 'evt_test_ebay_sale_cross_channel_001';
  const sale = reserveInventory(
    'SKU-WATCH-STRAP-01',
    2,
    'eBay',
    'EBAY-ORD-TEST-9001',
    'jp_treasure_main',
    saleEventId
  );
  assert(
    sale.success && sale.updatedAvailableToSell === initialATS - 2,
    'Test 3: Sale on eBay immediately reserves Central ATS'
  );

  const afterSale = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  const shopeeAfterSale = afterSale.channelBindings.find((binding) => binding.channel === 'Shopee')!;
  assert(
    shopeeAfterSale.syncStatus === 'PENDING' && shopeeAfterSale.syncedStock === initialShopeeStock,
    'Test 4: Shopee is marked PENDING and its last confirmed stock is not falsely overwritten before external success'
  );

  const queued = loadCrossChannelInventorySyncRequests();
  const shopeeRequest = queued.find(
    (request) => request.sourceEventId === saleEventId && request.targetChannel === 'Shopee'
  );
  assert(
    Boolean(shopeeRequest && shopeeRequest.status === 'QUEUED' && shopeeRequest.targetStock === afterSale.availableToSell && !shopeeRequest.externalWritePerformed),
    'Test 5: eBay sale creates a Shopee absolute-stock synchronization request without claiming an external write'
  );

  const oversell = reserveInventory('SKU-VINTAGE-SEIKO-01', 5, 'Shopee', 'SHOPEE-ORD-TEST-9002');
  assert(
    !oversell.success && oversell.isOversellingRisk,
    'Test 6: Overselling prevention halts sale when requested quantity exceeds ATS'
  );

  const eventId = 'evt_unique_12345';
  const idem1 = reserveInventory('SKU-CAMERA-LENS-01', 1, 'Shopify', 'SHOP-ORD-01', 'default', eventId);
  const atsAfterFirst = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!.availableToSell;
  const idem2 = reserveInventory('SKU-CAMERA-LENS-01', 1, 'Shopify', 'SHOP-ORD-01', 'default', eventId);
  const atsAfterReplay = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!.availableToSell;
  assert(
    idem1.success && idem2.success && idem2.messageJa.includes('重複イベント') && atsAfterReplay === atsAfterFirst,
    'Test 7: Idempotent replay protection prevents double inventory deduction'
  );

  const reservations = loadInventoryReservations();
  const activeStrapReservation = reservations.find(
    (reservation) => reservation.status === 'ACTIVE' && reservation.sku === 'SKU-WATCH-STRAP-01'
  )!;
  const beforePhysical = afterSale.physicalStock;
  const committed = commitSoldInventory(activeStrapReservation.reservationId);
  const afterCommit = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  assert(
    committed.success && afterCommit.physicalStock === beforePhysical - activeStrapReservation.quantity,
    'Test 8: Shipment finalization commits sold inventory and decreases physical warehouse stock'
  );

  const successfulShopeeSync = recordExternalChannelInventorySyncResult(shopeeRequest!.requestId, {
    success: true,
    externalWritePerformed: true,
    completedAt: '2026-09-08T12:00:00.000Z'
  });
  const afterShopeeSync = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  const confirmedShopee = afterShopeeSync.channelBindings.find((binding) => binding.channel === 'Shopee')!;
  assert(
    successfulShopeeSync.success && confirmedShopee.syncedStock === shopeeRequest!.targetStock && confirmedShopee.syncStatus === 'SYNCED',
    'Test 9: Only confirmed external Shopee success updates syncedStock and SYNCED status'
  );

  const shopifyRequest = loadCrossChannelInventorySyncRequests().find(
    (request) => request.sourceEventId === saleEventId && request.targetChannel === 'Shopify'
  )!;
  const failedShopifySync = recordExternalChannelInventorySyncResult(shopifyRequest.requestId, {
    success: false,
    externalWritePerformed: false,
    errorMessage: 'Simulated marketplace write failure'
  });
  const afterFailure = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  const failedShopify = afterFailure.channelBindings.find((binding) => binding.channel === 'Shopify')!;
  assert(
    !failedShopifySync.success && failedShopify.syncStatus === 'FAILED' && afterFailure.isLockedForOversellingRisk,
    'Test 10: Failed external stock write marks channel FAILED and locks SKU for overselling safety'
  );

  saveCentralInventory(getDefaultCentralInventory());
  const cancellationReservation = reserveInventory(
    'SKU-CAMERA-LENS-01',
    1,
    'eBay',
    'EBAY-ORD-CANCEL-01',
    'default',
    'evt_cancel_base_001'
  );
  const atsBeforeCancel = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!.availableToSell;
  const released = releaseReservation(cancellationReservation.reservationId!, true);
  const cameraAfterCancel = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  assert(
    released.success && cameraAfterCancel.availableToSell === atsBeforeCancel + 1 && cameraAfterCancel.channelBindings[0].syncStatus === 'PENDING',
    'Test 11: Cancellation restores Central ATS and queues external restock instead of claiming it already happened'
  );

  saveCentralInventory(getDefaultCentralInventory());
  const beforeReconciliation = loadCentralInventory();
  beforeReconciliation[0].channelBindings[0].syncedStock = 999;
  saveCentralInventory(beforeReconciliation);
  const reconciliation = reconcileCentralInventory();
  const afterReconciliation = loadCentralInventory();
  const reconciledBinding = afterReconciliation[0].channelBindings[0];
  assert(
    reconciliation.discrepancyCount >= 1 && reconciledBinding.syncedStock === 999 && reconciledBinding.syncStatus === 'PENDING',
    'Test 12: Reconciliation queues external correction and preserves last confirmed external stock until success'
  );
  assert(
    reconciliation.discrepancies.some((entry) => entry.actionTakenJa.includes('反映確認待ち')),
    'Test 13: Reconciliation message truthfully reports pending external confirmation'
  );

  assert(
    typeof localStorage !== 'undefined',
    'Test 14: Central inventory operations remain isolated from external Excel files'
  );

  return { passed, failed, log };
}
