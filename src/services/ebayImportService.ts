import { EbayOrderPayload, EbayOrderItemPayload } from '../types/zonosCustoms';
import { suggestMaterialAndProductType } from '../utils/zonosCustomsValidation';

// Mock Database of eBay Orders & Listings for explicit development/testing mode ONLY
const MOCK_EBAY_ORDERS: Record<string, EbayOrderPayload> = {
  '14-12345-67890': {
    orderId: '14-12345-67890',
    ebayTransactionValue: 300.0,
    currency: 'USD',
    destinationCountry: 'United States (US)',
    orderDate: '2026-07-28 15:30 (JST)',
    paymentStatus: 'Paid / Cleared',
    fulfillmentStatus: 'Paid / Ready for Shipment',
    importSource: 'mock',
    items: [
      {
        itemId: '256123456789',
        title: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
        quantity: 1,
        actualPrice: 300.0,
        weightKg: 0.85,
        unitWeightGrams: 850,
        weightUnit: 'kg',
        weightSource: 'eBay API',
        imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=80',
        derivedMaterial: 'PVC',
        derivedProductType: 'Figure'
      }
    ]
  },

  '14-99999-88888': {
    orderId: '14-99999-88888',
    ebayTransactionValue: 425.5,
    currency: 'USD',
    destinationCountry: 'United Kingdom (GB)',
    orderDate: '2026-07-29 11:20 (JST)',
    paymentStatus: 'Paid / Cleared',
    fulfillmentStatus: 'Paid / Ready for Shipment',
    importSource: 'mock',
    items: [
      {
        itemId: '256123456789',
        title: 'Canon AE-1 Program Vintage Camera',
        quantity: 1,
        actualPrice: 300.0,
        weightKg: 0.85,
        unitWeightGrams: 850,
        weightUnit: 'kg',
        weightSource: 'eBay API',
        imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=80',
        derivedMaterial: 'PVC',
        derivedProductType: 'Figure'
      },
      {
        itemId: '256987654321',
        title: 'Canon FD 50mm f/1.4 S.S.C. Prime Lens',
        quantity: 1,
        actualPrice: 125.5,
        weightKg: 0.35,
        unitWeightGrams: 350,
        weightUnit: 'g',
        weightSource: 'Item Specifics',
        imageUrl: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=400&auto=format&fit=crop&q=80',
        derivedMaterial: 'Acrylic',
        derivedProductType: 'Display Stand'
      }
    ]
  },

  '14-55555-66666': {
    orderId: '14-55555-66666',
    ebayTransactionValue: 2100.0,
    currency: 'USD',
    destinationCountry: 'Australia (AU)',
    orderDate: '2026-07-30 09:15 (JST)',
    paymentStatus: 'Paid / Cleared',
    fulfillmentStatus: 'Paid / Ready for Shipment',
    importSource: 'mock',
    items: [
      {
        itemId: '256444333222',
        title: 'Sony Alpha A7 IV Mirrorless Digital Camera Body',
        quantity: 3,
        actualPrice: 2100.0,
        weightKg: 0.65,
        unitWeightGrams: 650,
        weightUnit: 'kg',
        weightSource: 'eBay API',
        imageUrl: 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?w=400&auto=format&fit=crop&q=80',
        derivedMaterial: 'PVC',
        derivedProductType: 'Toy'
      }
    ]
  },

  '14-10000-20000': {
    orderId: '14-10000-20000',
    ebayTransactionValue: 100.0,
    currency: 'USD',
    destinationCountry: 'United States (US)',
    orderDate: '2026-07-30 14:00 (JST)',
    paymentStatus: 'Paid / Cleared',
    fulfillmentStatus: 'Paid / Ready for Shipment',
    importSource: 'mock',
    items: [
      {
        itemId: '256111222333',
        title: 'Nikon F3 HP SLR 35mm Film Camera Body',
        quantity: 1,
        actualPrice: 100.0,
        weightKg: 0.34,
        unitWeightGrams: 340,
        weightUnit: 'oz',
        weightSource: 'Item Specifics',
        imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=400&auto=format&fit=crop&q=80',
        derivedMaterial: 'PVC',
        derivedProductType: 'Figure'
      }
    ]
  },

  '14-00000-11111': {
    orderId: '14-00000-11111',
    ebayTransactionValue: 150.0,
    currency: 'USD',
    destinationCountry: 'Japan',
    orderDate: '2026-07-30 16:45 (JST)',
    paymentStatus: 'Paid / Cleared',
    fulfillmentStatus: 'Paid / Ready for Shipment',
    importSource: 'mock',
    items: [
      {
        itemId: '256777888999',
        title: 'Leica M6 Rangefinder Camera',
        quantity: 1,
        actualPrice: 150.0,
        weightKg: 0,
        unitWeightGrams: 0,
        weightUnit: 'g',
        weightSource: '未取得',
        imageUrl: 'https://images.unsplash.com/photo-1510127034890-ba27508e9f1c?w=400&auto=format&fit=crop&q=80',
        derivedMaterial: 'Metal',
        derivedProductType: 'Toy'
      }
    ]
  }
};

const MOCK_ITEM_TO_ORDER_MAP: Record<string, string> = {
  '256123456789': '14-12345-67890',
  '256987654321': '14-99999-88888',
  '256444333222': '14-55555-66666',
  '256111222333': '14-10000-20000',
  '256777888999': '14-00000-11111'
};

/**
 * Fetches eBay Order Data by Order ID or Item ID
 * Strictly requires real eBay API in normal production mode.
 * Mock data is restricted strictly to explicit development/testing mode (VITE_EBAY_API_MODE=mock).
 */
export async function fetchEbayOrderData(
  orderIdInput?: string,
  itemIdInput?: string
): Promise<EbayOrderPayload> {
  const apiMode = import.meta.env.VITE_EBAY_API_MODE;

  const cleanOrderId = (orderIdInput || '').trim();
  const cleanItemId = (itemIdInput || '').trim();

  if (!cleanOrderId && !cleanItemId) {
    throw new Error('注文番号またはItem IDのどちらかを入力してください。');
  }

  let targetOrderId = cleanOrderId;
  if (!targetOrderId && cleanItemId) {
    targetOrderId = MOCK_ITEM_TO_ORDER_MAP[cleanItemId] || '';
  }

  // Explicit dev mode check ONLY
  if (apiMode === 'mock') {
    return fetchMockEbayData(targetOrderId, cleanItemId, cleanOrderId);
  }

  // Normal Production Flow - Strictly Real API (NO silent fallback)
  return fetchLiveEbayApi(targetOrderId, cleanItemId, cleanOrderId);
}

/**
 * Explicit Mock Data Fetcher for Development Testing ONLY
 */
async function fetchMockEbayData(
  targetOrderId: string,
  cleanItemId: string,
  cleanOrderId: string
): Promise<EbayOrderPayload> {
  await new Promise((resolve) => setTimeout(resolve, 500));

  let order = MOCK_EBAY_ORDERS[targetOrderId];

  if (!order && cleanItemId) {
    const matchedOrderId = MOCK_ITEM_TO_ORDER_MAP[cleanItemId];
    if (matchedOrderId) {
      order = MOCK_EBAY_ORDERS[matchedOrderId];
    }
  }

  if (!order) {
    if (cleanOrderId && cleanItemId) {
      throw new Error(`(開発用モック) 指定されたeBay注文番号 (${cleanOrderId}) または Item ID (${cleanItemId}) が見つかりませんでした。`);
    } else if (cleanOrderId) {
      throw new Error(`(開発用モック) 指定されたeBay注文番号 (${cleanOrderId}) が見つかりませんでした。`);
    } else {
      throw new Error(`(開発用モック) 指定されたItem ID (${cleanItemId}) に対応する注文情報が見つかりませんでした。`);
    }
  }

  const enrichedItems: EbayOrderItemPayload[] = order.items.map((item) => {
    const derived = suggestMaterialAndProductType(item.title);
    return {
      ...item,
      derivedMaterial: item.derivedMaterial || derived.material,
      derivedProductType: item.derivedProductType || derived.productType
    };
  });

  return {
    ...order,
    items: enrichedItems,
    importSource: 'mock'
  };
}

/**
 * Live eBay API Fetcher for Production Flow
 * Strictly throws explicit error if API is unconfigured or fails. NEVER silently falls back to mock.
 */
async function fetchLiveEbayApi(
  orderId: string,
  itemId: string,
  rawOrderId: string
): Promise<EbayOrderPayload> {
  const baseUrl = import.meta.env.VITE_EBAY_API_BASE_URL;

  if (!baseUrl) {
    throw new Error('実際のeBay注文データを読み込めません。eBay API設定を確認してください。');
  }

  try {
    const searchTarget = orderId || itemId || rawOrderId;
    const response = await fetch(`${baseUrl}/orders/${searchTarget}`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('実際のeBay注文データを読み込めません。eBay API設定を確認してください。');
    }

    const data = await response.json();
    return {
      orderId: data.orderId,
      ebayTransactionValue: data.total,
      currency: data.currency || 'USD',
      destinationCountry: data.destinationCountry,
      orderDate: data.orderDate,
      paymentStatus: data.paymentStatus,
      fulfillmentStatus: data.fulfillmentStatus,
      importSource: 'live_api',
      items: data.items.map((i: any) => {
        const derived = suggestMaterialAndProductType(i.title || '');
        return {
          itemId: i.itemId,
          title: i.title,
          quantity: i.quantity,
          actualPrice: i.price,
          weightKg: i.weightKg || 0.5,
          unitWeightGrams: i.unitWeightGrams || 500,
          weightUnit: i.weightUnit || 'g',
          weightSource: i.weightSource || 'eBay API',
          imageUrl: i.imageUrl,
          derivedMaterial: derived.material,
          derivedProductType: derived.productType
        };
      })
    };
  } catch (err: any) {
    // Explicit error requirement: NEVER silently fall back to mock data
    throw new Error('実際のeBay注文データを読み込めません。eBay API設定を確認してください。');
  }
}
