import {
  InventoryItemRecord,
  InventoryAdjustmentLog,
  InventoryAdjustmentType,
  PhysicalStockStatus
} from '../types/safetyGate';

const INVENTORY_ITEMS_SESSION_KEY = 'zonos_safety_inventory_items';
const INVENTORY_LOGS_SESSION_KEY = 'zonos_safety_inventory_logs';

/**
 * Creates Initial Default Physical Inventory Items (Spec #3)
 */
export function createInitialInventoryItems(): InventoryItemRecord[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return [
    {
      inventoryId: 'INV-2026-001',
      sku: 'SKU-CAM-001',
      productName: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
      physicalStockQuantity: 3,
      reservedQuantity: 0,
      soldUnshippedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      availableQuantity: 3,
      accountAllocations: {
        acc_01: 2,
        acc_02: 1
      },
      lastStocktakeDate: todayStr,
      lastVerifiedBy: 'Operator',
      verificationStatus: 'Verified',
      notes: '手元現物確認済み (実在庫: 3個)'
    },
    {
      inventoryId: 'INV-2026-002',
      sku: 'SKU-LENS-002',
      productName: 'Canon FD 50mm f/1.4 S.S.C. Prime Lens - Mint Condition',
      physicalStockQuantity: 2,
      reservedQuantity: 0,
      soldUnshippedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      availableQuantity: 2,
      accountAllocations: {
        acc_01: 1,
        acc_02: 1
      },
      lastStocktakeDate: '2026-06-01', // Expired stocktake (> 30 days ago)
      lastVerifiedBy: 'Operator',
      verificationStatus: 'Recheck Required',
      notes: '棚卸し有効期限切れ (30日超過のため再確認が必要)'
    },
    {
      inventoryId: 'INV-2026-003',
      sku: 'SKU-SONY-003',
      productName: 'Sony Alpha A7 IV Mirrorless Digital Camera Body',
      physicalStockQuantity: 1,
      reservedQuantity: 0,
      soldUnshippedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      availableQuantity: 1,
      accountAllocations: {
        acc_01: 1
      },
      lastStocktakeDate: todayStr,
      lastVerifiedBy: 'Operator',
      verificationStatus: 'Verified',
      notes: '高額商品現物確認済み'
    }
  ];
}

export function loadInventoryItems(): InventoryItemRecord[] {
  try {
    const raw = sessionStorage.getItem(INVENTORY_ITEMS_SESSION_KEY);
    if (!raw) return createInitialInventoryItems();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item) => recalculateAvailableQuantity(item));
    }
    return createInitialInventoryItems();
  } catch (e) {
    console.error('Failed to load inventory items:', e);
    return createInitialInventoryItems();
  }
}

export function saveInventoryItems(items: InventoryItemRecord[]): void {
  try {
    sessionStorage.setItem(INVENTORY_ITEMS_SESSION_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save inventory items:', e);
  }
}

export function loadInventoryLogs(): InventoryAdjustmentLog[] {
  try {
    const raw = sessionStorage.getItem(INVENTORY_LOGS_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load inventory logs:', e);
    return [];
  }
}

export function saveInventoryLogs(logs: InventoryAdjustmentLog[]): void {
  try {
    sessionStorage.setItem(INVENTORY_LOGS_SESSION_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save inventory logs:', e);
  }
}

/**
 * Calculates Available Quantity (Spec #4)
 * Available = Physical stock - Reserved - Sold unshipped - Damaged - Lost
 */
export function recalculateAvailableQuantity(item: InventoryItemRecord): InventoryItemRecord {
  const available = Math.max(
    0,
    item.physicalStockQuantity -
      item.reservedQuantity -
      item.soldUnshippedQuantity -
      item.damagedQuantity -
      item.lostQuantity
  );

  return {
    ...item,
    availableQuantity: available
  };
}

/**
 * Checks Stocktake Verification Period (Spec #6: Default 30-day validity)
 */
export function checkStocktakeValidity(item: InventoryItemRecord): {
  isExpired: boolean;
  daysSinceStocktake: number;
  status: PhysicalStockStatus;
} {
  if (!item.lastStocktakeDate) {
    return { isExpired: true, daysSinceStocktake: 999, status: 'Unknown' };
  }

  const stocktakeMs = new Date(item.lastStocktakeDate).getTime();
  if (isNaN(stocktakeMs)) {
    return { isExpired: true, daysSinceStocktake: 999, status: 'Unknown' };
  }

  const diffMs = Date.now() - stocktakeMs;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (days > 30 && item.verificationStatus === 'Verified') {
    return { isExpired: true, daysSinceStocktake: days, status: 'Recheck Required' };
  }

  return {
    isExpired: days > 30,
    daysSinceStocktake: days,
    status: item.verificationStatus
  };
}

/**
 * Adds an Inventory Adjustment Entry (Spec #5)
 */
export function addInventoryAdjustment(
  inventoryId: string,
  type: InventoryAdjustmentType,
  adjustmentDelta: number,
  reason: string,
  relatedOrderId?: string,
  relatedEbayAccountId?: string
): { success: boolean; updatedItem: InventoryItemRecord | null; error?: string } {
  const items = loadInventoryItems();
  const index = items.findIndex((i) => i.inventoryId === inventoryId);
  if (index === -1) {
    return { success: false, updatedItem: null, error: '指定の在庫IDが存在しません。' };
  }

  const item = items[index];
  const newPhysicalStock = item.physicalStockQuantity + adjustmentDelta;

  if (newPhysicalStock < 0) {
    return { success: false, updatedItem: null, error: '在庫調整後に実在庫がマイナスになる操作は許可されません。' };
  }

  const updatedItem = recalculateAvailableQuantity({
    ...item,
    physicalStockQuantity: newPhysicalStock,
    lastStocktakeDate: new Date().toISOString().split('T')[0]
  });

  items[index] = updatedItem;
  saveInventoryItems(items);

  // Add Log Entry
  const logs = loadInventoryLogs();
  const newLog: InventoryAdjustmentLog = {
    id: `adj-${Date.now()}`,
    timestamp: new Date().toLocaleString('ja-JP'),
    inventoryId: item.inventoryId,
    sku: item.sku,
    adjustmentType: type,
    quantityBefore: item.physicalStockQuantity,
    adjustmentQuantity: adjustmentDelta,
    quantityAfter: newPhysicalStock,
    reason,
    userConfirmed: true,
    relatedOrderId,
    relatedEbayAccountId
  };

  saveInventoryLogs([newLog, ...logs]);

  return { success: true, updatedItem };
}
