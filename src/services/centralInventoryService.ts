import {
  BuyerAllocationStatus,
  BuyerInventoryAllocation,
  CentralInventoryItem,
  InventorySyncEvent,
  InventoryUnit,
  ProcurementOrder,
  ReconciliationSummary,
  SellableInventoryGate
} from '../types/centralInventory';
import { SalesChannel } from '../types/shippingRouter';
import { registerHealthCheckModule } from './projectHealthService';
import {
  loadCrossChannelInventorySyncRequests,
  queueCrossChannelInventorySync,
  recordCrossChannelInventorySyncAttempt
} from './crossChannelInventorySyncService';

const INVENTORY_STORAGE_KEY = 'zonos_central_inventory_ssot_v2';
const LEGACY_INVENTORY_STORAGE_KEY = 'zonos_central_inventory_ssot_v1';
const BUYER_ALLOCATIONS_STORAGE_KEY = 'zonos_buyer_inventory_allocations_v2';
const LEGACY_RESERVATIONS_STORAGE_KEY = 'zonos_inventory_reservations_v1';
const PROCUREMENT_ORDERS_STORAGE_KEY = 'zonos_procurement_orders_v1';
const INVENTORY_UNITS_STORAGE_KEY = 'zonos_inventory_units_v1';
const SYNC_EVENTS_STORAGE_KEY = 'zonos_inventory_sync_events_v2';
const PROCESSED_EVENT_IDS_KEY = 'zonos_processed_inventory_event_ids_v2';

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueChannels(channels: SalesChannel[]): SalesChannel[] {
  return Array.from(new Set(channels));
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

function recomputeAvailableToSell(item: CentralInventoryItem): CentralInventoryItem {
  return {
    ...item,
    availableToSell: Math.max(0, item.sellableStock - item.buyerAllocatedStock - item.safetyBuffer)
  };
}

function normalizeCentralInventoryItem(raw: any): CentralInventoryItem {
  const physicalStock = nonNegativeInteger(raw?.physicalStock);
  const legacyReservedStock = nonNegativeInteger(raw?.reservedStock);
  const buyerAllocatedStock = nonNegativeInteger(raw?.buyerAllocatedStock, legacyReservedStock);
  const sellableStock = Math.min(
    physicalStock,
    nonNegativeInteger(raw?.sellableStock, physicalStock)
  );

  return recomputeAvailableToSell({
    sku: String(raw?.sku || ''),
    itemTitle: String(raw?.itemTitle || ''),
    physicalStock,
    sellableStock,
    buyerAllocatedStock: Math.min(sellableStock, buyerAllocatedStock),
    inboundStock: nonNegativeInteger(raw?.inboundStock),
    availableToSell: 0,
    safetyBuffer: nonNegativeInteger(raw?.safetyBuffer),
    unitCostJpy: Number(raw?.unitCostJpy || 0),
    weightGrams: Number(raw?.weightGrams || 0),
    dimensionsCm: raw?.dimensionsCm || { length: 0, width: 0, height: 0 },
    category: String(raw?.category || ''),
    channelBindings: Array.isArray(raw?.channelBindings) ? raw.channelBindings : [],
    lastReconciledAt: String(raw?.lastReconciledAt || nowIso()),
    isLockedForOversellingRisk: Boolean(raw?.isLockedForOversellingRisk),
    oversellingRiskReason: raw?.oversellingRiskReason
  });
}

export function getDefaultCentralInventory(): CentralInventoryItem[] {
  const createdAt = nowIso();
  return [
    {
      sku: 'SKU-WATCH-STRAP-01',
      itemTitle: 'イタリアンレザー 交換用時計ベルト 20mm (ブラウン)',
      physicalStock: 8,
      sellableStock: 8,
      buyerAllocatedStock: 0,
      inboundStock: 0,
      availableToSell: 8,
      safetyBuffer: 0,
      unitCostJpy: 1200,
      weightGrams: 45,
      dimensionsCm: { length: 15.0, width: 8.0, height: 1.0 },
      category: 'Watch Accessories',
      channelBindings: [
        {
          channel: 'eBay',
          sellerAccountId: 'jp_treasure_main',
          channelListingId: 'ebay_item_1101',
          syncedStock: 8,
          syncStatus: 'SYNCED',
          lastSyncedAt: createdAt,
          isAutoSyncEnabled: true
        },
        {
          channel: 'Shopee',
          sellerAccountId: 'shopee_sg_01',
          channelListingId: 'shopee_item_sg_2201',
          syncedStock: 8,
          syncStatus: 'SYNCED',
          lastSyncedAt: createdAt,
          isAutoSyncEnabled: true
        },
        {
          channel: 'Shopify',
          sellerAccountId: 'shopify_primary',
          channelListingId: 'shopify_prod_3301',
          syncedStock: 8,
          syncStatus: 'SYNCED',
          lastSyncedAt: createdAt,
          isAutoSyncEnabled: true
        }
      ],
      lastReconciledAt: createdAt,
      isLockedForOversellingRisk: false
    },
    {
      sku: 'SKU-VINTAGE-SEIKO-01',
      itemTitle: 'セイコー 5 自動巻き ヴィンテージ 腕時計 7S26',
      physicalStock: 1,
      sellableStock: 1,
      buyerAllocatedStock: 0,
      inboundStock: 0,
      availableToSell: 1,
      safetyBuffer: 0,
      unitCostJpy: 8500,
      weightGrams: 140,
      dimensionsCm: { length: 12.0, width: 10.0, height: 6.0 },
      category: 'Watches',
      channelBindings: [
        {
          channel: 'eBay',
          sellerAccountId: 'jp_treasure_main',
          channelListingId: 'ebay_item_1102',
          syncedStock: 1,
          syncStatus: 'SYNCED',
          lastSyncedAt: createdAt,
          isAutoSyncEnabled: true
        },
        {
          channel: 'Shopee',
          sellerAccountId: 'shopee_sg_01',
          channelListingId: 'shopee_item_sg_2202',
          syncedStock: 1,
          syncStatus: 'SYNCED',
          lastSyncedAt: createdAt,
          isAutoSyncEnabled: true
        }
      ],
      lastReconciledAt: createdAt,
      isLockedForOversellingRisk: false
    },
    {
      sku: 'SKU-CAMERA-LENS-01',
      itemTitle: 'キヤノン EF 50mm F1.8 STM 単焦点レンズ',
      physicalStock: 3,
      sellableStock: 3,
      buyerAllocatedStock: 0,
      inboundStock: 0,
      availableToSell: 3,
      safetyBuffer: 0,
      unitCostJpy: 9800,
      weightGrams: 280,
      dimensionsCm: { length: 14.0, width: 14.0, height: 10.0 },
      category: 'Camera Lenses',
      channelBindings: [
        {
          channel: 'eBay',
          sellerAccountId: 'jp_treasure_main',
          channelListingId: 'ebay_item_1103',
          syncedStock: 3,
          syncStatus: 'SYNCED',
          lastSyncedAt: createdAt,
          isAutoSyncEnabled: true
        }
      ],
      lastReconciledAt: createdAt,
      isLockedForOversellingRisk: false
    }
  ];
}

export function loadCentralInventory(): CentralInventoryItem[] {
  try {
    const currentRaw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      if (Array.isArray(parsed)) return parsed.map(normalizeCentralInventoryItem);
    }

    const legacyRaw = localStorage.getItem(LEGACY_INVENTORY_STORAGE_KEY);
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      if (Array.isArray(parsed)) {
        const migrated = parsed.map(normalizeCentralInventoryItem);
        saveCentralInventory(migrated);
        return migrated;
      }
    }

    const defaults = getDefaultCentralInventory();
    saveCentralInventory(defaults);
    return defaults;
  } catch {
    return getDefaultCentralInventory();
  }
}

export function saveCentralInventory(items: CentralInventoryItem[]): void {
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items.map(normalizeCentralInventoryItem)));
  } catch (e) {
    console.error('Failed to save central inventory:', e);
  }
}

export function loadBuyerInventoryAllocations(): BuyerInventoryAllocation[] {
  try {
    const currentRaw = localStorage.getItem(BUYER_ALLOCATIONS_STORAGE_KEY);
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      return Array.isArray(parsed) ? parsed : [];
    }

    const legacyRaw = localStorage.getItem(LEGACY_RESERVATIONS_STORAGE_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy)) return [];

    const migrated: BuyerInventoryAllocation[] = legacy.map((record: any) => ({
      allocationId: String(record.reservationId || `legacy_allocation_${Date.now()}`),
      sku: String(record.sku || ''),
      quantity: nonNegativeInteger(record.quantity, 1),
      marketplace: record.channel as SalesChannel,
      sellerAccountId: String(record.sellerAccountId || 'legacy_unknown'),
      orderId: String(record.orderId || 'legacy_unknown'),
      buyerId: 'LEGACY_BUYER_UNKNOWN',
      inventoryUnitIds: [],
      status: record.status === 'RELEASED_CANCELLED'
        ? 'RELEASED_CANCELLED'
        : record.status === 'COMMITTED_SOLD'
          ? 'SHIPPED'
          : 'BUYER_ALLOCATED',
      allocatedAt: String(record.reservedAt || nowIso()),
      shippedAt: record.committedAt,
      releasedAt: record.releasedAt
    }));
    saveBuyerInventoryAllocations(migrated);
    return migrated;
  } catch {
    return [];
  }
}

export function saveBuyerInventoryAllocations(allocations: BuyerInventoryAllocation[]): void {
  try {
    localStorage.setItem(BUYER_ALLOCATIONS_STORAGE_KEY, JSON.stringify(allocations));
  } catch (e) {
    console.error('Failed to save buyer inventory allocations:', e);
  }
}

/** @deprecated Use loadBuyerInventoryAllocations. Kept temporarily for caller compatibility. */
export const loadInventoryReservations = loadBuyerInventoryAllocations;
/** @deprecated Use saveBuyerInventoryAllocations. Kept temporarily for caller compatibility. */
export const saveInventoryReservations = saveBuyerInventoryAllocations;

export function loadProcurementOrders(): ProcurementOrder[] {
  try {
    const raw = localStorage.getItem(PROCUREMENT_ORDERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProcurementOrders(orders: ProcurementOrder[]): void {
  localStorage.setItem(PROCUREMENT_ORDERS_STORAGE_KEY, JSON.stringify(orders));
}

export function loadInventoryUnits(): InventoryUnit[] {
  try {
    const raw = localStorage.getItem(INVENTORY_UNITS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveInventoryUnits(units: InventoryUnit[]): void {
  localStorage.setItem(INVENTORY_UNITS_STORAGE_KEY, JSON.stringify(units));
}

export function loadSyncEvents(): InventorySyncEvent[] {
  try {
    const raw = localStorage.getItem(SYNC_EVENTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSyncEvents(events: InventorySyncEvent[]): void {
  try {
    localStorage.setItem(SYNC_EVENTS_STORAGE_KEY, JSON.stringify(events.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save sync events:', e);
  }
}

function isEventAlreadyProcessed(eventId: string): boolean {
  try {
    const raw = localStorage.getItem(PROCESSED_EVENT_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(eventId);
  } catch {
    return false;
  }
}

function markEventProcessed(eventId: string): void {
  try {
    const raw = localStorage.getItem(PROCESSED_EVENT_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    ids.push(eventId);
    localStorage.setItem(PROCESSED_EVENT_IDS_KEY, JSON.stringify(ids.slice(-200)));
  } catch (e) {
    console.error('Failed to mark event processed:', e);
  }
}

function appendSyncEvent(event: InventorySyncEvent): void {
  const events = loadSyncEvents();
  events.unshift(event);
  saveSyncEvents(events);
}

export function createProcurementOrder(input: {
  sku: string;
  quantity: number;
  supplierName: string;
  supplierOrderReference?: string;
  trackingNumber?: string;
  expectedArrivalAt?: string;
  notes?: string;
}): { success: boolean; procurementOrder?: ProcurementOrder; messageJa: string } {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    return { success: false, messageJa: '仕入数量は1以上の整数で指定してください。' };
  }
  const item = loadCentralInventory().find((candidate) => candidate.sku === input.sku);
  if (!item) return { success: false, messageJa: `SKU [${input.sku}] が中央在庫に存在しません。` };

  const order: ProcurementOrder = {
    procurementOrderId: `po_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    sku: input.sku,
    quantity: input.quantity,
    supplierName: input.supplierName.trim(),
    supplierOrderReference: input.supplierOrderReference?.trim() || undefined,
    status: 'PURCHASE_ORDERED',
    orderedAt: nowIso(),
    trackingNumber: input.trackingNumber?.trim() || undefined,
    expectedArrivalAt: input.expectedArrivalAt,
    notes: input.notes
  };
  const orders = loadProcurementOrders();
  orders.push(order);
  saveProcurementOrders(orders);

  return {
    success: true,
    procurementOrder: order,
    messageJa: `✅ 仕入発注 ${order.procurementOrderId} を登録しました。まだ手元在庫・販売可能在庫には加算していません。`
  };
}

export function markProcurementOrderInbound(procurementOrderId: string): { success: boolean; messageJa: string } {
  const orders = loadProcurementOrders();
  const order = orders.find((candidate) => candidate.procurementOrderId === procurementOrderId);
  if (!order || order.status !== 'PURCHASE_ORDERED') {
    return { success: false, messageJa: 'PURCHASE_ORDERED状態の仕入注文が見つかりません。' };
  }

  const items = loadCentralInventory();
  const item = items.find((candidate) => candidate.sku === order.sku);
  if (!item) return { success: false, messageJa: `SKU [${order.sku}] が見つかりません。` };

  order.status = 'INBOUND';
  order.inboundAt = nowIso();
  item.inboundStock += order.quantity;
  saveProcurementOrders(orders);
  saveCentralInventory(items);

  return {
    success: true,
    messageJa: `✅ 入荷予定 ${order.quantity}点をINBOUNDへ移しました。販売可能数 ${item.availableToSell}点には加算していません。`
  };
}

export function receiveProcurementOrder(
  procurementOrderId: string,
  inventoryUnitIds?: string[]
): { success: boolean; createdInventoryUnitIds: string[]; messageJa: string } {
  const orders = loadProcurementOrders();
  const order = orders.find((candidate) => candidate.procurementOrderId === procurementOrderId);
  if (!order || (order.status !== 'PURCHASE_ORDERED' && order.status !== 'INBOUND')) {
    return { success: false, createdInventoryUnitIds: [], messageJa: '受領可能な仕入注文が見つかりません。' };
  }
  if (inventoryUnitIds && inventoryUnitIds.length !== order.quantity) {
    return { success: false, createdInventoryUnitIds: [], messageJa: 'Inventory Unit ID数と受領数量が一致しません。' };
  }

  const items = loadCentralInventory();
  const item = items.find((candidate) => candidate.sku === order.sku);
  if (!item) return { success: false, createdInventoryUnitIds: [], messageJa: `SKU [${order.sku}] が見つかりません。` };

  const units = loadInventoryUnits();
  const createdAt = nowIso();
  const ids = inventoryUnitIds || Array.from({ length: order.quantity }, (_, index) =>
    `unit_${order.sku}_${Date.now()}_${index + 1}`
  );
  if (ids.some((id) => units.some((unit) => unit.inventoryUnitId === id))) {
    return { success: false, createdInventoryUnitIds: [], messageJa: '重複するInventory Unit IDがあります。' };
  }

  const emptyGate: SellableInventoryGate = {
    identityVerified: false,
    quantityVerified: false,
    conditionVerified: false,
    photoCaptureComplete: false,
    photoQaComplete: false,
    storageLocationRegistered: false
  };
  ids.forEach((inventoryUnitId) => units.push({
    inventoryUnitId,
    sku: order.sku,
    procurementOrderId: order.procurementOrderId,
    status: 'ON_HAND',
    receivedAt: createdAt,
    sellableGate: { ...emptyGate },
    updatedAt: createdAt
  }));

  if (order.status === 'INBOUND') item.inboundStock = Math.max(0, item.inboundStock - order.quantity);
  item.physicalStock += order.quantity;
  order.status = 'RECEIVED';
  order.receivedAt = createdAt;

  saveInventoryUnits(units);
  saveCentralInventory(items);
  saveProcurementOrders(orders);

  return {
    success: true,
    createdInventoryUnitIds: ids,
    messageJa: `✅ ${order.quantity}点をON_HANDとして受領しました。検品・撮影・Photo QA・保管場所登録が終わるまでAVAILABLEにはしません。`
  };
}

export function completeSellableInventoryGate(
  inventoryUnitId: string,
  input: Omit<SellableInventoryGate, 'completedAt'> & { storageLocation: string }
): { success: boolean; messageJa: string } {
  const requiredPassed =
    input.identityVerified &&
    input.quantityVerified &&
    input.conditionVerified &&
    input.photoCaptureComplete &&
    input.photoQaComplete &&
    input.storageLocationRegistered &&
    input.storageLocation.trim().length > 0;
  if (!requiredPassed) {
    return { success: false, messageJa: 'Sellable Inventory Gateが未完了です。販売可能在庫へ昇格できません。' };
  }

  const units = loadInventoryUnits();
  const unit = units.find((candidate) => candidate.inventoryUnitId === inventoryUnitId);
  if (!unit || unit.status !== 'ON_HAND') {
    return { success: false, messageJa: 'ON_HAND状態のInventory Unitが見つかりません。' };
  }

  const items = loadCentralInventory();
  const itemIndex = items.findIndex((candidate) => candidate.sku === unit.sku);
  if (itemIndex < 0) return { success: false, messageJa: `SKU [${unit.sku}] が見つかりません。` };
  const item = items[itemIndex];
  const beforeATS = item.availableToSell;

  const completedAt = nowIso();
  unit.status = 'AVAILABLE';
  unit.storageLocation = input.storageLocation.trim();
  unit.sellableGate = {
    identityVerified: input.identityVerified,
    quantityVerified: input.quantityVerified,
    conditionVerified: input.conditionVerified,
    photoCaptureComplete: input.photoCaptureComplete,
    photoQaComplete: input.photoQaComplete,
    storageLocationRegistered: input.storageLocationRegistered,
    completedAt,
    completedBy: input.completedBy
  };
  unit.updatedAt = completedAt;
  item.sellableStock = Math.min(item.physicalStock, item.sellableStock + 1);
  items[itemIndex] = recomputeAvailableToSell(item);

  saveInventoryUnits(units);
  saveCentralInventory(items);
  appendSyncEvent({
    eventId: `evt_sellable_${inventoryUnitId}_${Date.now()}`,
    sku: item.sku,
    eventType: 'SELLABLE_GATE_PASSED',
    triggerChannel: item.channelBindings[0]?.channel || 'eBay',
    quantityDelta: 1,
    beforePhysicalStock: item.physicalStock,
    afterPhysicalStock: item.physicalStock,
    beforeAvailableToSell: beforeATS,
    afterAvailableToSell: items[itemIndex].availableToSell,
    syncedChannels: [],
    failedChannels: [],
    isIdempotentReplay: false,
    timestamp: completedAt
  });

  return {
    success: true,
    messageJa: `✅ ${inventoryUnitId} はSellable Inventory Gateを通過しAVAILABLEになりました。(ATS: ${items[itemIndex].availableToSell})`
  };
}

export function allocateInventoryToBuyer(
  sku: string,
  quantity: number,
  marketplace: SalesChannel,
  orderId: string,
  buyerId: string,
  sellerAccountId = 'default',
  inventoryUnitIds: string[] = [],
  eventId?: string
): {
  success: boolean;
  allocationId?: string;
  isOversellingRisk: boolean;
  updatedAvailableToSell: number;
  messageJa: string;
} {
  const currentEventId = eventId || `evt_alloc_${sku}_${orderId}_${Date.now()}`;
  if (isEventAlreadyProcessed(currentEventId)) {
    const current = loadCentralInventory().find((item) => item.sku === sku);
    return {
      success: true,
      isOversellingRisk: Boolean(current?.isLockedForOversellingRisk),
      updatedAvailableToSell: current?.availableToSell ?? 0,
      messageJa: '🔄 重複イベントを検知し、安全にスキップしました (Idempotent Replay Protected)'
    };
  }
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return { success: false, isOversellingRisk: true, updatedAvailableToSell: 0, messageJa: 'Buyer割当数量は1以上の整数で指定してください。' };
  }
  if (!orderId.trim() || !buyerId.trim()) {
    return { success: false, isOversellingRisk: true, updatedAvailableToSell: 0, messageJa: 'Buyer Order IDとBuyer IDは必須です。' };
  }

  const items = loadCentralInventory();
  const itemIndex = items.findIndex((item) => item.sku === sku);
  if (itemIndex < 0) {
    return { success: false, isOversellingRisk: true, updatedAvailableToSell: 0, messageJa: `SKU [${sku}] が中央在庫に存在しません。` };
  }
  const item = items[itemIndex];
  const beforeATS = item.availableToSell;
  const beforePhysical = item.physicalStock;
  if (item.availableToSell < quantity) {
    item.isLockedForOversellingRisk = true;
    item.oversellingRiskReason = 'INSUFFICIENT_ATS';
    saveCentralInventory(items);
    return {
      success: false,
      isOversellingRisk: true,
      updatedAvailableToSell: item.availableToSell,
      messageJa: `⛔ [二重販売リスク] SKU [${sku}] のAVAILABLE (${item.availableToSell}) がBuyer要求数量 (${quantity}) 未満です。`
    };
  }

  const units = loadInventoryUnits();
  const trackedUnits = units.filter((unit) => unit.sku === sku);
  if (trackedUnits.length > 0) {
    if (inventoryUnitIds.length !== quantity) {
      return {
        success: false,
        isOversellingRisk: true,
        updatedAvailableToSell: item.availableToSell,
        messageJa: 'Inventory Unit管理中の商品は、Buyer割当数量と同数のInventory Unit ID指定が必要です。'
      };
    }
    const selected = inventoryUnitIds.map((id) => units.find((unit) => unit.inventoryUnitId === id));
    if (selected.some((unit) => !unit || unit.sku !== sku || unit.status !== 'AVAILABLE')) {
      return {
        success: false,
        isOversellingRisk: true,
        updatedAvailableToSell: item.availableToSell,
        messageJa: '指定されたInventory Unitの一部がAVAILABLEではありません。'
      };
    }
  }

  const allocationId = `alloc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const allocation: BuyerInventoryAllocation = {
    allocationId,
    sku,
    quantity,
    marketplace,
    sellerAccountId,
    orderId: orderId.trim(),
    buyerId: buyerId.trim(),
    inventoryUnitIds: [...inventoryUnitIds],
    status: 'BUYER_ALLOCATED',
    allocatedAt: nowIso()
  };

  item.buyerAllocatedStock += quantity;
  items[itemIndex] = recomputeAvailableToSell(item);
  inventoryUnitIds.forEach((id) => {
    const unit = units.find((candidate) => candidate.inventoryUnitId === id)!;
    unit.status = 'BUYER_ALLOCATED';
    unit.buyerAllocationId = allocationId;
    unit.updatedAt = allocation.allocatedAt;
  });

  const allocations = loadBuyerInventoryAllocations();
  allocations.push(allocation);
  saveBuyerInventoryAllocations(allocations);
  saveInventoryUnits(units);

  const syncPlan = queueCrossChannelInventorySync({
    sourceEventId: currentEventId,
    sku,
    targetStock: items[itemIndex].availableToSell,
    triggerChannel: marketplace,
    triggerOrderId: orderId,
    reason: 'BUYER_ALLOCATION',
    bindings: item.channelBindings
  });
  items[itemIndex].channelBindings = syncPlan.bindings;
  if (syncPlan.blockedChannels.length > 0) {
    items[itemIndex].isLockedForOversellingRisk = true;
    items[itemIndex].oversellingRiskReason = 'AUTO_SYNC_DISABLED';
  }
  saveCentralInventory(items);
  markEventProcessed(currentEventId);

  appendSyncEvent({
    eventId: currentEventId,
    sku,
    eventType: 'BUYER_ALLOCATION_CREATED',
    triggerChannel: marketplace,
    triggerOrderId: orderId,
    quantityDelta: -quantity,
    beforePhysicalStock: beforePhysical,
    afterPhysicalStock: item.physicalStock,
    beforeAvailableToSell: beforeATS,
    afterAvailableToSell: items[itemIndex].availableToSell,
    syncedChannels: [],
    pendingChannels: syncPlan.queuedChannels,
    failedChannels: [],
    blockedChannels: syncPlan.blockedChannels,
    isIdempotentReplay: false,
    timestamp: allocation.allocatedAt
  });

  return {
    success: true,
    allocationId,
    isOversellingRisk: syncPlan.blockedChannels.length > 0,
    updatedAvailableToSell: items[itemIndex].availableToSell,
    messageJa: `✅ Buyer Order [${orderId}] / Buyer [${buyerId}] に${quantity}点を割り当てました。(ATS: ${items[itemIndex].availableToSell})`
  };
}

/**
 * Legacy API shim. New code must call allocateInventoryToBuyer with a real buyerId.
 * The legacy placeholder is deliberately visible so it cannot be mistaken for verified Buyer identity.
 */
export function reserveInventory(
  sku: string,
  quantity: number,
  channel: SalesChannel,
  orderId: string,
  sellerAccountId = 'default',
  eventId?: string
): {
  success: boolean;
  reservationId?: string;
  allocationId?: string;
  isOversellingRisk: boolean;
  updatedAvailableToSell: number;
  messageJa: string;
} {
  const result = allocateInventoryToBuyer(
    sku,
    quantity,
    channel,
    orderId,
    'LEGACY_BUYER_UNKNOWN',
    sellerAccountId,
    [],
    eventId
  );
  return { ...result, reservationId: result.allocationId };
}

function transitionBuyerAllocation(
  allocationId: string,
  nextStatus: Extract<BuyerAllocationStatus, 'PICKED' | 'PACKED'>
): { success: boolean; messageJa: string } {
  const allocations = loadBuyerInventoryAllocations();
  const allocation = allocations.find((candidate) => candidate.allocationId === allocationId);
  if (!allocation) return { success: false, messageJa: 'Buyer Allocationが見つかりません。' };

  const allowed = nextStatus === 'PICKED'
    ? allocation.status === 'BUYER_ALLOCATED'
    : allocation.status === 'PICKED';
  if (!allowed) return { success: false, messageJa: `${allocation.status} から ${nextStatus} へは遷移できません。` };

  const changedAt = nowIso();
  allocation.status = nextStatus;
  if (nextStatus === 'PICKED') allocation.pickedAt = changedAt;
  if (nextStatus === 'PACKED') allocation.packedAt = changedAt;

  const units = loadInventoryUnits();
  allocation.inventoryUnitIds.forEach((id) => {
    const unit = units.find((candidate) => candidate.inventoryUnitId === id);
    if (unit) {
      unit.status = nextStatus;
      unit.updatedAt = changedAt;
    }
  });
  saveBuyerInventoryAllocations(allocations);
  saveInventoryUnits(units);
  return { success: true, messageJa: `✅ Buyer Allocation ${allocationId} を ${nextStatus} へ更新しました。` };
}

export function markBuyerAllocationPicked(allocationId: string) {
  return transitionBuyerAllocation(allocationId, 'PICKED');
}

export function markBuyerAllocationPacked(allocationId: string) {
  return transitionBuyerAllocation(allocationId, 'PACKED');
}

export function commitSoldInventory(allocationId: string): { success: boolean; messageJa: string } {
  const allocations = loadBuyerInventoryAllocations();
  const allocation = allocations.find((candidate) => candidate.allocationId === allocationId);
  if (!allocation || !['BUYER_ALLOCATED', 'PICKED', 'PACKED'].includes(allocation.status)) {
    return { success: false, messageJa: '発送確定可能なBuyer Allocationが見つかりません。' };
  }

  const items = loadCentralInventory();
  const item = items.find((candidate) => candidate.sku === allocation.sku);
  if (!item) return { success: false, messageJa: `SKU [${allocation.sku}] が見つかりません。` };
  if (item.physicalStock < allocation.quantity || item.sellableStock < allocation.quantity || item.buyerAllocatedStock < allocation.quantity) {
    return { success: false, messageJa: '在庫数量の整合性が崩れているため発送確定を停止しました。' };
  }

  item.physicalStock -= allocation.quantity;
  item.sellableStock -= allocation.quantity;
  item.buyerAllocatedStock -= allocation.quantity;
  Object.assign(item, recomputeAvailableToSell(item));
  allocation.status = 'SHIPPED';
  allocation.shippedAt = nowIso();

  const units = loadInventoryUnits();
  allocation.inventoryUnitIds.forEach((id) => {
    const unit = units.find((candidate) => candidate.inventoryUnitId === id);
    if (unit) {
      unit.status = 'SHIPPED';
      unit.updatedAt = allocation.shippedAt!;
    }
  });

  saveCentralInventory(items);
  saveBuyerInventoryAllocations(allocations);
  saveInventoryUnits(units);
  return {
    success: true,
    messageJa: `✅ Buyer Order [${allocation.orderId}] をSHIPPEDへ更新しました。(手元実在庫: ${item.physicalStock})`
  };
}

export function releaseBuyerAllocation(allocationId: string, isRestockable = true): { success: boolean; messageJa: string } {
  const allocations = loadBuyerInventoryAllocations();
  const allocation = allocations.find((candidate) => candidate.allocationId === allocationId);
  if (!allocation || !['BUYER_ALLOCATED', 'PICKED', 'PACKED'].includes(allocation.status)) {
    return { success: false, messageJa: '解除可能なBuyer Allocationが見つかりません。' };
  }

  const items = loadCentralInventory();
  const itemIndex = items.findIndex((candidate) => candidate.sku === allocation.sku);
  if (itemIndex < 0) return { success: false, messageJa: `SKU [${allocation.sku}] が見つかりません。` };
  const item = items[itemIndex];
  const beforeATS = item.availableToSell;
  const beforePhysical = item.physicalStock;
  item.buyerAllocatedStock = Math.max(0, item.buyerAllocatedStock - allocation.quantity);
  if (!isRestockable) item.sellableStock = Math.max(0, item.sellableStock - allocation.quantity);
  items[itemIndex] = recomputeAvailableToSell(item);

  const releasedAt = nowIso();
  allocation.status = 'RELEASED_CANCELLED';
  allocation.releasedAt = releasedAt;
  const units = loadInventoryUnits();
  allocation.inventoryUnitIds.forEach((id) => {
    const unit = units.find((candidate) => candidate.inventoryUnitId === id);
    if (unit) {
      unit.status = isRestockable ? 'AVAILABLE' : 'ON_HAND';
      delete unit.buyerAllocationId;
      unit.updatedAt = releasedAt;
    }
  });

  const syncPlan = queueCrossChannelInventorySync({
    sourceEventId: `evt_release_${allocationId}_${Date.now()}`,
    sku: item.sku,
    targetStock: items[itemIndex].availableToSell,
    triggerChannel: allocation.marketplace,
    triggerOrderId: allocation.orderId,
    reason: 'BUYER_ALLOCATION_RELEASE',
    bindings: item.channelBindings
  });
  items[itemIndex].channelBindings = syncPlan.bindings;
  if (syncPlan.blockedChannels.length > 0) {
    items[itemIndex].isLockedForOversellingRisk = true;
    items[itemIndex].oversellingRiskReason = 'AUTO_SYNC_DISABLED';
  }

  saveCentralInventory(items);
  saveBuyerInventoryAllocations(allocations);
  saveInventoryUnits(units);
  appendSyncEvent({
    eventId: `evt_release_log_${allocationId}_${Date.now()}`,
    sku: item.sku,
    eventType: 'BUYER_ALLOCATION_RELEASED',
    triggerChannel: allocation.marketplace,
    triggerOrderId: allocation.orderId,
    quantityDelta: isRestockable ? allocation.quantity : 0,
    beforePhysicalStock: beforePhysical,
    afterPhysicalStock: item.physicalStock,
    beforeAvailableToSell: beforeATS,
    afterAvailableToSell: items[itemIndex].availableToSell,
    syncedChannels: [],
    pendingChannels: syncPlan.queuedChannels,
    failedChannels: [],
    blockedChannels: syncPlan.blockedChannels,
    isIdempotentReplay: false,
    timestamp: releasedAt
  });

  return {
    success: true,
    messageJa: isRestockable
      ? `✅ Buyer Order [${allocation.orderId}] の割当を解除し、${allocation.quantity}点をAVAILABLEへ戻しました。(ATS: ${items[itemIndex].availableToSell})`
      : `✅ Buyer Order [${allocation.orderId}] の割当を解除しました。商品はON_HANDへ戻し、再確認完了までAVAILABLEには戻しません。`
  };
}

/** @deprecated Use releaseBuyerAllocation. */
export const releaseReservation = releaseBuyerAllocation;

export function recordExternalChannelInventorySyncResult(
  requestId: string,
  result: { success: boolean; externalWritePerformed: boolean; errorMessage?: string; completedAt?: string }
): { success: boolean; messageJa: string } {
  const existingRequest = loadCrossChannelInventorySyncRequests().find((request) => request.requestId === requestId);
  if (!existingRequest) return { success: false, messageJa: '対象の外部在庫同期要求が見つかりません。' };

  const recorded = recordCrossChannelInventorySyncAttempt(requestId, result);
  if (!recorded.request) return { success: false, messageJa: recorded.messageJa };
  const request = recorded.request;
  const items = loadCentralInventory();
  const itemIndex = items.findIndex((item) => item.sku === request.sku);
  if (itemIndex < 0) return { success: false, messageJa: `SKU [${request.sku}] が中央在庫に見つかりません。` };

  const item = items[itemIndex];
  const binding = item.channelBindings.find((candidate) =>
    candidate.channel === request.targetChannel &&
    candidate.sellerAccountId === request.sellerAccountId &&
    candidate.channelListingId === request.channelListingId
  );
  if (!binding) return { success: false, messageJa: '対象の販売先在庫Bindingが見つかりません。' };

  if (recorded.success && request.externalWritePerformed) {
    binding.syncedStock = request.targetStock;
    binding.syncStatus = request.targetStock === 0 ? 'PAUSED' : 'SYNCED';
    binding.lastSyncedAt = request.completedAt || nowIso();
    delete binding.lastErrorMessage;
    const remainingRisk = item.channelBindings.some((candidate) =>
      candidate.syncStatus === 'FAILED' || candidate.syncStatus === 'OVERSELLING_RISK'
    );
    if (!remainingRisk && (item.oversellingRiskReason === 'EXTERNAL_SYNC_FAILURE' || item.oversellingRiskReason === 'AUTO_SYNC_DISABLED')) {
      item.isLockedForOversellingRisk = false;
      delete item.oversellingRiskReason;
    }
  } else {
    binding.syncStatus = 'FAILED';
    binding.lastErrorMessage = request.errorMessage || '外部Marketplaceへの在庫反映を確認できませんでした。';
    item.isLockedForOversellingRisk = true;
    item.oversellingRiskReason = 'EXTERNAL_SYNC_FAILURE';
  }
  items[itemIndex] = item;
  saveCentralInventory(items);

  const events = loadSyncEvents();
  const event = events.find((candidate) => candidate.eventId === request.sourceEventId);
  if (event) {
    event.pendingChannels = (event.pendingChannels || []).filter((channel) => channel !== request.targetChannel);
    if (recorded.success) event.syncedChannels = uniqueChannels([...event.syncedChannels, request.targetChannel]);
    else event.failedChannels = uniqueChannels([...event.failedChannels, request.targetChannel]);
    saveSyncEvents(events);
  }
  return { success: recorded.success, messageJa: recorded.messageJa };
}

export function reconcileCentralInventory(): ReconciliationSummary {
  const items = loadCentralInventory();
  const discrepancies: ReconciliationSummary['discrepancies'] = [];
  let syncedCount = 0;
  const reconciliationId = `rec_${Date.now()}`;
  const now = nowIso();

  items.forEach((item) => {
    const normalized = recomputeAvailableToSell(item);
    Object.assign(item, normalized);
    item.channelBindings = item.channelBindings.map((binding) => {
      const externallyConfirmed =
        binding.syncedStock === item.availableToSell &&
        (binding.syncStatus === 'SYNCED' || binding.syncStatus === 'PAUSED');
      if (externallyConfirmed) {
        syncedCount += 1;
        return binding;
      }

      const sourceEventId = `${reconciliationId}_${item.sku}_${binding.channel}_${binding.sellerAccountId}`;
      const syncPlan = queueCrossChannelInventorySync({
        sourceEventId,
        sku: item.sku,
        targetStock: item.availableToSell,
        triggerChannel: binding.channel,
        reason: 'RECONCILIATION',
        bindings: [binding],
        now
      });
      const updatedBinding = syncPlan.bindings[0];
      discrepancies.push({
        sku: item.sku,
        channel: binding.channel,
        centralStock: item.availableToSell,
        channelStock: binding.syncedStock,
        actionTakenJa: syncPlan.blockedChannels.length > 0
          ? `中央ATS ${item.availableToSell} 点との差異を検知。自動同期無効のため要手動確認`
          : `中央ATS ${item.availableToSell} 点への外部同期要求を作成（反映確認待ち）`
      });
      if (syncPlan.blockedChannels.length > 0) {
        item.isLockedForOversellingRisk = true;
        item.oversellingRiskReason = 'AUTO_SYNC_DISABLED';
      }
      return updatedBinding;
    });
    item.lastReconciledAt = now;
  });

  saveCentralInventory(items);
  return {
    reconciliationId,
    timestamp: now,
    totalSkusChecked: items.length,
    syncedSkusCount: syncedCount,
    discrepancyCount: discrepancies.length,
    discrepancies
  };
}

export function initCentralInventoryHealthModule(): void {
  registerHealthCheckModule({
    moduleId: 'module_central_inventory_sync',
    moduleName: '中央在庫同期 ＆ 二重販売防止エンジン (Single Source of Truth)',
    category: 'future_module',
    defaultAuthorityLevel: 'admin_approved',
    defaultVerificationMethod: 'unsupported_live',
    checkHealth: () => {
      const items = loadCentralInventory();
      const lockedItems = items.filter((item) => item.isLockedForOversellingRisk);
      const pendingBindings = items.flatMap((item) => item.channelBindings).filter((binding) => binding.syncStatus === 'PENDING');
      const failedBindings = items.flatMap((item) => item.channelBindings).filter((binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK');
      const isWarning = lockedItems.length > 0 || pendingBindings.length > 0 || failedBindings.length > 0;

      return {
        id: 'module_central_inventory_sync',
        name: 'Central Multi-Channel Inventory Sync',
        category: 'future_module',
        status: isWarning ? 'needs_check' : 'healthy',
        statusLabel: isWarning ? '🟡 要確認' : '✅ 中央在庫正常',
        isLiveVerified: false,
        liveVerificationNote: '中央在庫・Buyer Allocation・同期キューは稼働中。外部Marketplace反映は各APIアダプターの成功確認が必要です。',
        lastVerifiedAt: nowIso(),
        authorityLevel: 'admin_approved',
        authorityLevelLabel: 'B. 管理者承認済み在庫運用ルール',
        verificationMethod: 'unsupported_live',
        verificationMethodLabel: '外部販売先のライブ反映はアダプター接続待ち',
        sourceName: 'Central Inventory Engine v2.0',
        freshness: '中央ATSは即時 / 外部反映は成功確認まで保留',
        isCriticalWarning: lockedItems.length > 0 || failedBindings.length > 0,
        shortOneLineReason: isWarning
          ? `中央在庫リスク: ロック ${lockedItems.length}件 / 同期待ち ${pendingBindings.length}件 / 失敗・要確認 ${failedBindings.length}件`
          : '中央ATSは整合。PURCHASE_ORDERED/INBOUNDは販売可能数に含めていません。',
        details: {
          exactRestriction: '仕入発注・INBOUNDはATSへ加算禁止。Sellable Inventory Gate完了後のみAVAILABLE。Buyer注文時はBUYER_ALLOCATEDへ移し、外部販売先へ絶対在庫数の同期要求を発行する。',
          source: 'Central Inventory Engine v2 + Buyer Allocation + Procurement Lifecycle',
          ruleVersion: 'Ver. 2.0',
          recommendedCorrectiveAction: isWarning ? 'PENDING/FAILEDの販売先同期要求を確認してください。' : '特になし'
        }
      };
    }
  });
}
