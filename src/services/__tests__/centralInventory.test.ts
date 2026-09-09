/**
 * Unit Test Suite for Central Inventory SSOT, Procurement Separation & Buyer Allocation
 */

import {
  allocateInventoryToBuyer,
  commitSoldInventory,
  completeSellableInventoryGate,
  createProcurementOrder,
  getDefaultCentralInventory,
  loadBuyerInventoryAllocations,
  loadCentralInventory,
  loadInventoryUnits,
  markProcurementOrderInbound,
  receiveProcurementOrder,
  reconcileCentralInventory,
  recordExternalChannelInventorySyncResult,
  releaseBuyerAllocation,
  saveCentralInventory
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
  assert(items.length >= 3, 'Test 1: Central inventory loads seed catalog items');

  const strap = items.find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  assert(
    strap.availableToSell === strap.sellableStock - strap.buyerAllocatedStock - strap.safetyBuffer,
    'Test 2: ATS equals sellableStock - buyerAllocatedStock - safetyBuffer'
  );

  const lensBeforeProcurement = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  const atsBeforeProcurement = lensBeforeProcurement.availableToSell;
  const physicalBeforeProcurement = lensBeforeProcurement.physicalStock;

  const procurement = createProcurementOrder({
    sku: 'SKU-CAMERA-LENS-01',
    quantity: 1,
    supplierName: 'Test Supplier',
    supplierOrderReference: 'SUP-ORDER-001'
  });
  const afterPurchaseOrdered = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  assert(
    procurement.success &&
    afterPurchaseOrdered.availableToSell === atsBeforeProcurement &&
    afterPurchaseOrdered.physicalStock === physicalBeforeProcurement,
    'Test 3: PURCHASE_ORDERED does not increase physical stock or ATS'
  );

  const inbound = markProcurementOrderInbound(procurement.procurementOrder!.procurementOrderId);
  const afterInbound = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  assert(
    inbound.success && afterInbound.inboundStock === 1 && afterInbound.availableToSell === atsBeforeProcurement,
    'Test 4: INBOUND is tracked separately and never counted in ATS'
  );

  const received = receiveProcurementOrder(
    procurement.procurementOrder!.procurementOrderId,
    ['INV-UNIT-LENS-NEW-001']
  );
  const afterReceived = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  const receivedUnit = loadInventoryUnits().find((unit) => unit.inventoryUnitId === 'INV-UNIT-LENS-NEW-001');
  assert(
    received.success &&
    afterReceived.physicalStock === physicalBeforeProcurement + 1 &&
    afterReceived.inboundStock === 0 &&
    afterReceived.availableToSell === atsBeforeProcurement &&
    receivedUnit?.status === 'ON_HAND',
    'Test 5: Receipt increases ON_HAND physical stock but not ATS before Sellable Inventory Gate'
  );

  const gate = completeSellableInventoryGate('INV-UNIT-LENS-NEW-001', {
    identityVerified: true,
    quantityVerified: true,
    conditionVerified: true,
    photoCaptureComplete: true,
    photoQaComplete: true,
    storageLocationRegistered: true,
    storageLocation: 'A-01-01',
    completedBy: 'test-operator'
  });
  const afterGate = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  const availableUnit = loadInventoryUnits().find((unit) => unit.inventoryUnitId === 'INV-UNIT-LENS-NEW-001');
  assert(
    gate.success && afterGate.availableToSell === atsBeforeProcurement + 1 && availableUnit?.status === 'AVAILABLE',
    'Test 6: Only Sellable Inventory Gate completion promotes a received unit to AVAILABLE'
  );

  const buyerAllocation = allocateInventoryToBuyer(
    'SKU-CAMERA-LENS-01',
    1,
    'eBay',
    'EBAY-ORDER-BUYER-001',
    'buyer_example_001',
    'jp_treasure_main',
    ['INV-UNIT-LENS-NEW-001'],
    'evt_buyer_alloc_001'
  );
  const afterBuyerAllocation = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  const allocationRecord = loadBuyerInventoryAllocations().find(
    (allocation) => allocation.allocationId === buyerAllocation.allocationId
  );
  const allocatedUnit = loadInventoryUnits().find((unit) => unit.inventoryUnitId === 'INV-UNIT-LENS-NEW-001');
  assert(
    buyerAllocation.success &&
    afterBuyerAllocation.availableToSell === afterGate.availableToSell - 1 &&
    allocationRecord?.orderId === 'EBAY-ORDER-BUYER-001' &&
    allocationRecord?.buyerId === 'buyer_example_001' &&
    allocationRecord?.marketplace === 'eBay' &&
    allocationRecord?.inventoryUnitIds[0] === 'INV-UNIT-LENS-NEW-001' &&
    allocatedUnit?.status === 'BUYER_ALLOCATED',
    'Test 7: Buyer allocation records who bought which physical unit and decreases ATS'
  );

  const trackedWithoutUnit = allocateInventoryToBuyer(
    'SKU-CAMERA-LENS-01',
    1,
    'eBay',
    'EBAY-ORDER-MISSING-UNIT',
    'buyer_example_002'
  );
  assert(
    !trackedWithoutUnit.success && trackedWithoutUnit.messageJa.includes('Inventory Unit ID'),
    'Test 8: Inventory-unit-managed SKU cannot be Buyer allocated without explicit physical unit IDs'
  );

  const initialStrapATS = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!.availableToSell;
  const initialShopeeStock = loadCentralInventory()
    .find((item) => item.sku === 'SKU-WATCH-STRAP-01')!
    .channelBindings.find((binding) => binding.channel === 'Shopee')!.syncedStock;
  const saleEventId = 'evt_test_ebay_buyer_allocation_001';
  const strapAllocation = allocateInventoryToBuyer(
    'SKU-WATCH-STRAP-01',
    2,
    'eBay',
    'EBAY-ORD-TEST-9001',
    'buyer_strap_test',
    'jp_treasure_main',
    [],
    saleEventId
  );
  assert(
    strapAllocation.success && strapAllocation.updatedAvailableToSell === initialStrapATS - 2,
    'Test 9: eBay Buyer Order immediately reduces Central ATS through BUYER_ALLOCATED'
  );

  const afterStrapAllocation = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  const shopeeAfterSale = afterStrapAllocation.channelBindings.find((binding) => binding.channel === 'Shopee')!;
  assert(
    shopeeAfterSale.syncStatus === 'PENDING' && shopeeAfterSale.syncedStock === initialShopeeStock,
    'Test 10: Cross-channel stock stays PENDING until external marketplace confirms the write'
  );

  const queued = loadCrossChannelInventorySyncRequests();
  const shopeeRequest = queued.find(
    (request) => request.sourceEventId === saleEventId && request.targetChannel === 'Shopee'
  );
  assert(
    Boolean(
      shopeeRequest &&
      shopeeRequest.reason === 'BUYER_ALLOCATION' &&
      shopeeRequest.status === 'QUEUED' &&
      shopeeRequest.targetStock === afterStrapAllocation.availableToSell &&
      !shopeeRequest.externalWritePerformed
    ),
    'Test 11: Buyer allocation creates an explicit cross-channel absolute-stock sync request'
  );

  const oversell = allocateInventoryToBuyer(
    'SKU-VINTAGE-SEIKO-01',
    5,
    'Shopee',
    'SHOPEE-ORD-TEST-9002',
    'buyer_oversell_test'
  );
  assert(!oversell.success && oversell.isOversellingRisk, 'Test 12: Overselling prevention blocks Buyer allocation beyond ATS');

  const eventId = 'evt_unique_buyer_12345';
  const idem1 = allocateInventoryToBuyer(
    'SKU-WATCH-STRAP-01', 1, 'Shopify', 'SHOP-ORD-01', 'buyer_idem', 'default', [], eventId
  );
  const atsAfterFirst = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!.availableToSell;
  const idem2 = allocateInventoryToBuyer(
    'SKU-WATCH-STRAP-01', 1, 'Shopify', 'SHOP-ORD-01', 'buyer_idem', 'default', [], eventId
  );
  const atsAfterReplay = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!.availableToSell;
  assert(
    idem1.success && idem2.success && idem2.messageJa.includes('重複イベント') && atsAfterReplay === atsAfterFirst,
    'Test 13: Idempotent replay protection prevents duplicate Buyer allocation deduction'
  );

  const beforeShip = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  const shipped = commitSoldInventory(buyerAllocation.allocationId!);
  const afterShip = loadCentralInventory().find((item) => item.sku === 'SKU-CAMERA-LENS-01')!;
  assert(
    shipped.success &&
    afterShip.physicalStock === beforeShip.physicalStock - 1 &&
    afterShip.sellableStock === beforeShip.sellableStock - 1 &&
    loadInventoryUnits().find((unit) => unit.inventoryUnitId === 'INV-UNIT-LENS-NEW-001')?.status === 'SHIPPED',
    'Test 14: SHIPPED removes the allocated physical unit from ON_HAND and sellable stock'
  );

  const successfulShopeeSync = recordExternalChannelInventorySyncResult(shopeeRequest!.requestId, {
    success: true,
    externalWritePerformed: true,
    completedAt: '2026-09-10T12:00:00.000Z'
  });
  const afterShopeeSync = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  const confirmedShopee = afterShopeeSync.channelBindings.find((binding) => binding.channel === 'Shopee')!;
  assert(
    successfulShopeeSync.success && confirmedShopee.syncedStock === shopeeRequest!.targetStock && confirmedShopee.syncStatus === 'SYNCED',
    'Test 15: Only confirmed external success updates syncedStock and SYNCED status'
  );

  saveCentralInventory(getDefaultCentralInventory());
  const cancellationAllocation = allocateInventoryToBuyer(
    'SKU-WATCH-STRAP-01',
    1,
    'eBay',
    'EBAY-ORD-CANCEL-01',
    'buyer_cancel_test',
    'default',
    [],
    'evt_cancel_base_001'
  );
  const atsBeforeCancel = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!.availableToSell;
  const released = releaseBuyerAllocation(cancellationAllocation.allocationId!, true);
  const strapAfterCancel = loadCentralInventory().find((item) => item.sku === 'SKU-WATCH-STRAP-01')!;
  assert(
    released.success && strapAfterCancel.availableToSell === atsBeforeCancel + 1 && strapAfterCancel.channelBindings[0].syncStatus === 'PENDING',
    'Test 16: Buyer cancellation releases BUYER_ALLOCATED and queues external restock confirmation'
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
    'Test 17: Reconciliation queues correction without pretending the marketplace already changed'
  );
  assert(
    reconciliation.discrepancies.some((entry) => entry.actionTakenJa.includes('反映確認待ち')),
    'Test 18: Reconciliation truthfully reports pending external confirmation'
  );

  return { passed, failed, log };
}
