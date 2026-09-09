import '../types/inventoryOrderLinkage';
import { ImportedEbayOrderRecord } from '../types/safetyGate';
import { loadBuyerInventoryAllocations } from './centralInventoryService';

const ORDER_FULFILLMENT_SESSION_KEY = 'zonos_imported_ebay_orders';

export function createInitialImportedOrders(): ImportedEbayOrderRecord[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return [
    {
      id: 'ord-rec-001',
      ebayOrderId: '14-09812-43210',
      ebayLineItemId: 'line-396123-01',
      sku: 'SKU-CAM-001',
      productTitle: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
      buyerUsername: 'vintage_collector_us',
      destinationCountry: 'US',
      salePriceUsd: 280,
      paidDate: `${todayStr} 09:15`,
      fulfillmentStatus: 'Unshipped',
      physicalItemConfirmed: false,
      packageWeightGrams: 850,
      packageLengthCm: 20,
      packageWidthCm: 15,
      packageHeightCm: 12,
      carrierName: 'Japan Post (EMS)',
      trackingNumber: '',
      declaredValueUsd: 93.33
    },
    {
      id: 'ord-rec-002',
      ebayOrderId: '14-09812-99887',
      ebayLineItemId: 'line-396124-02',
      sku: 'SKU-WATCH-002',
      productTitle: 'Seiko Speedtimer Vintage Chronograph Automatic Watch',
      buyerUsername: 'watch_enthusiast_de',
      destinationCountry: 'DE',
      salePriceUsd: 450,
      paidDate: `${todayStr} 11:30`,
      fulfillmentStatus: 'Unshipped',
      physicalItemConfirmed: false,
      packageWeightGrams: 450,
      packageLengthCm: 15,
      packageWidthCm: 10,
      packageHeightCm: 8,
      carrierName: 'FedEx (Connect Plus)',
      trackingNumber: '',
      declaredValueUsd: 150.0
    }
  ];
}

export function loadImportedOrders(): ImportedEbayOrderRecord[] {
  try {
    const raw = sessionStorage.getItem(ORDER_FULFILLMENT_SESSION_KEY);
    if (!raw) return createInitialImportedOrders();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialImportedOrders();
  } catch (e) {
    console.error('Failed to load imported orders:', e);
    return createInitialImportedOrders();
  }
}

export function saveImportedOrders(orders: ImportedEbayOrderRecord[]): void {
  try {
    sessionStorage.setItem(ORDER_FULFILLMENT_SESSION_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to save imported orders:', e);
  }
}

/**
 * Explicitly links the marketplace Buyer Order to the Central Inventory v2 allocation.
 * This prevents a generic "reserved" quantity from losing who bought which physical item.
 */
export function linkImportedOrderToBuyerAllocation(
  importedOrderRecordId: string,
  buyerAllocationId: string
): { success: boolean; messageJa: string } {
  const orders = loadImportedOrders();
  const order = orders.find((candidate) => candidate.id === importedOrderRecordId);
  if (!order) return { success: false, messageJa: '対象の取込注文が見つかりません。' };

  const allocation = loadBuyerInventoryAllocations().find(
    (candidate) => candidate.allocationId === buyerAllocationId
  );
  if (!allocation) return { success: false, messageJa: '対象のBuyer Allocationが見つかりません。' };

  if (allocation.marketplace !== 'eBay' || allocation.orderId !== order.ebayOrderId || allocation.sku !== order.sku) {
    return {
      success: false,
      messageJa: 'Buyer AllocationのMarketplace / Order ID / SKUが取込eBay注文と一致しないため、紐付けを停止しました。'
    };
  }

  if (allocation.buyerId !== order.buyerUsername && allocation.buyerId !== 'LEGACY_BUYER_UNKNOWN') {
    return {
      success: false,
      messageJa: 'Buyer AllocationのBuyer IDが取込注文のBuyerと一致しないため、紐付けを停止しました。'
    };
  }

  order.buyerAllocationId = allocation.allocationId;
  order.inventoryUnitIds = [...allocation.inventoryUnitIds];
  saveImportedOrders(orders);

  return {
    success: true,
    messageJa: `✅ eBay Order [${order.ebayOrderId}] をBuyer Allocation [${allocation.allocationId}] に紐付けました。`
  };
}

export function validateShipmentPrep(order: ImportedEbayOrderRecord): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!order.physicalItemConfirmed) {
    errors.push('必須チェック: 「発送する現物を手元で確認しました。」 にチェックが入っていません。');
  }

  if (!order.buyerAllocationId) {
    errors.push('必須チェック: Buyer OrderにBuyer Allocation IDが紐付いていません。');
  }

  if (!order.packageWeightGrams || order.packageWeightGrams <= 0) {
    errors.push('梱包重量 (Package Weight) が入力されていません。');
  }

  if (!order.trackingNumber || order.trackingNumber.trim().length < 6) {
    errors.push('有効な追跡番号 (Tracking Number) が入力されていません。');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
