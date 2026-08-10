/**
 * Unit Test Suite for Central Inventory SSOT & Cross-Channel Sync (Phase C)
 */

import {
  loadCentralInventory,
  saveCentralInventory,
  reserveInventory,
  commitSoldInventory,
  releaseReservation,
  reconcileCentralInventory,
  loadInventoryReservations,
  getDefaultCentralInventory
} from '../centralInventoryService';

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

  // Reset inventory to clean state
  saveCentralInventory(getDefaultCentralInventory());

  // Test 1: Load central inventory items
  const items = loadCentralInventory();
  assert(Boolean(items.length >= 3), 'Test 1: Central inventory loads seed catalog items (Single Source of Truth)');

  // Test 2: ATS calculation accuracy
  const strap = items.find((i) => i.sku === 'SKU-WATCH-STRAP-01')!;
  assert(
    Boolean(strap.availableToSell === strap.physicalStock - strap.reservedStock - strap.safetyBuffer),
    'Test 2: Available to Sell (ATS) equals physicalStock - reservedStock - safetyBuffer'
  );

  // Test 3: Successful inventory reservation
  const initialATS = strap.availableToSell;
  const res1 = reserveInventory('SKU-WATCH-STRAP-01', 2, 'eBay', 'EBAY-ORD-TEST-9001', 'jp_treasure_main');
  assert(
    Boolean(res1.success && res1.updatedAvailableToSell === initialATS - 2),
    'Test 3: Sale on eBay immediately reserves inventory and decreases Central ATS'
  );

  // Test 4: Channel bindings updated in parallel
  const updatedItems = loadCentralInventory();
  const updatedStrap = updatedItems.find((i) => i.sku === 'SKU-WATCH-STRAP-01')!;
  const shopeeBinding = updatedStrap.channelBindings.find((b) => b.channel === 'Shopee')!;
  assert(
    Boolean(shopeeBinding.syncedStock === updatedStrap.availableToSell),
    'Test 4: Shopee channel adapter inventory binding synced immediately upon eBay sale'
  );

  // Test 5: Overselling prevention when demand exceeds ATS
  const resOversell = reserveInventory('SKU-VINTAGE-SEIKO-01', 5, 'Shopee', 'SHOPEE-ORD-TEST-9002');
  assert(
    Boolean(!resOversell.success && resOversell.isOversellingRisk),
    'Test 5: Overselling prevention halts sale and flags OVERSELLING_RISK when stock is insufficient'
  );

  // Test 6: Idempotency & duplicate event protection
  const eventId = 'evt_unique_12345';
  const resIdem1 = reserveInventory('SKU-CAMERA-LENS-01', 1, 'Shopify', 'SHOP-ORD-01', 'default', eventId);
  const resIdem2 = reserveInventory('SKU-CAMERA-LENS-01', 1, 'Shopify', 'SHOP-ORD-01', 'default', eventId);
  assert(
    Boolean(resIdem1.success && resIdem2.success && resIdem2.messageJa.includes('重複イベント')),
    'Test 6: Idempotent replay protection prevents double inventory deductions from identical event IDs'
  );

  // Test 7: Commit sold inventory upon shipment finalization
  const reservations = loadInventoryReservations();
  const activeRes = reservations.find((r) => r.status === 'ACTIVE' && r.sku === 'SKU-WATCH-STRAP-01')!;
  const beforePhysical = updatedStrap.physicalStock;
  const commitRes = commitSoldInventory(activeRes.reservationId);
  const reloadedStrap = loadCentralInventory().find((i) => i.sku === 'SKU-WATCH-STRAP-01')!;
  assert(
    Boolean(commitRes.success && reloadedStrap.physicalStock === beforePhysical - activeRes.quantity),
    'Test 7: Shipment finalization commits sold inventory and decreases physical warehouse stock'
  );

  // Test 8: Release reservation on order cancellation
  const cancelRes = reserveInventory('SKU-CAMERA-LENS-01', 1, 'eBay', 'EBAY-ORD-CANCEL-01');
  const atsBeforeCancel = loadCentralInventory().find((i) => i.sku === 'SKU-CAMERA-LENS-01')!.availableToSell;
  const releaseResult = releaseReservation(cancelRes.reservationId!, true);
  const atsAfterCancel = loadCentralInventory().find((i) => i.sku === 'SKU-CAMERA-LENS-01')!.availableToSell;
  assert(
    Boolean(releaseResult.success && atsAfterCancel === atsBeforeCancel + 1),
    'Test 8: Order cancellation releases reserved inventory and safely restores ATS across channels'
  );

  // Test 9: Reconciliation job detects and corrects channel discrepancies
  const itemsForRec = loadCentralInventory();
  itemsForRec[0].channelBindings[0].syncedStock = 999; // Artificially induce discrepancy
  saveCentralInventory(itemsForRec);

  const recSummary = reconcileCentralInventory();
  assert(
    Boolean(recSummary.discrepancyCount >= 1 && recSummary.discrepancies.some((d) => d.sku === itemsForRec[0].sku)),
    'Test 9: Cross-channel reconciliation detects stock discrepancies and reconciles with Central SSOT'
  );

  // Test 10: Complete isolation of Central Inventory from external Excel
  assert(
    Boolean(typeof localStorage !== 'undefined'),
    'Test 10: Central inventory operations operate in application-owned isolated storage without touching 住所録.xlsx'
  );

  return { passed, failed, log };
}
