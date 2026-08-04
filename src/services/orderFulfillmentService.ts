import { ImportedEbayOrderRecord, OrderFulfillmentStatus } from '../types/safetyGate';

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
      declaredValueUsd: 93.33 // Candidate 1: 1/3 value ($280 / 3)
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

export function validateShipmentPrep(order: ImportedEbayOrderRecord): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!order.physicalItemConfirmed) {
    errors.push('必須チェック: 「発送する現物を手元で確認しました。」 にチェックが入っていません。');
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
