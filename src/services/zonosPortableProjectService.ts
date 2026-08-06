import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  CustomsValidationStatus
} from '../types/zonosCustoms';

export interface ZonosPortableProjectFile {
  schemaVersion: '2.0.0';
  savedAt: string;
  shipmentId: string;
  plannedShipmentDate: string;
  ebayAccountId: string;
  ebayAccountDisplayName: string;
  ebayOrderId: string;
  ebayItemIds: string[];
  originalListingUrls: string[];
  destinationCountry: string;
  ebayTransactionValue: number;
  currency: string;
  exchangeRate: number;
  exchangeRateSource: string;
  exchangeRateTimestamp: string;
  ebayTransactionValueJpy: number;
  regularItemsJpySubtotal: number;
  freeGiftsJpySubtotal: number;
  totalDeclaredJpyValue: number;
  jpyDifference: number;
  items: ZonosCustomsItem[];
  warnings: string[];
  validationErrors: string[];
  isJpyTotalMatched: boolean;
  notes: string;
}

const AUTOSAVE_STORAGE_KEY = 'zonos_customs_autosave_declaration_v2';
const AUTOSAVE_TIME_KEY = 'zonos_customs_autosave_timestamp_v2';

/**
 * Export Declaration as Portable JSON File
 */
export function exportPortableProjectJSON(
  declaration: ZonosCustomsDeclaration,
  validation: CustomsValidationStatus,
  plannedShipmentDate: string = '2026-08-13',
  notes: string = ''
): void {
  const itemIds = Array.from(new Set(declaration.items.map((i) => i.itemId).filter(Boolean))) as string[];
  const urls = itemIds.map((id) => `https://www.ebay.com/itm/${id}`);

  const projectData: ZonosPortableProjectFile = {
    schemaVersion: '2.0.0',
    savedAt: new Date().toISOString(),
    shipmentId: `SHIP-${plannedShipmentDate.replace(/-/g, '')}-${declaration.orderId.replace(/\D/g, '').slice(-4) || '0001'}`,
    plannedShipmentDate,
    ebayAccountId: declaration.selectedAccountId || 'acc_01',
    ebayAccountDisplayName: declaration.selectedAccountDisplayName || 'Main Account',
    ebayOrderId: declaration.orderId,
    ebayItemIds: itemIds,
    originalListingUrls: urls,
    destinationCountry: declaration.destinationCountry,
    ebayTransactionValue: declaration.ebayTransactionValue,
    currency: declaration.currency,
    exchangeRate: declaration.exchangeRate || 155.2,
    exchangeRateSource: declaration.exchangeRateSource || 'Bank of Japan TTM',
    exchangeRateTimestamp: declaration.exchangeRateTimestamp || new Date().toLocaleString(),
    ebayTransactionValueJpy: declaration.ebayTransactionValueJpy || Math.round(declaration.ebayTransactionValue * (declaration.exchangeRate || 155.2)),
    regularItemsJpySubtotal: declaration.regularItemsJpySubtotal || 0,
    freeGiftsJpySubtotal: declaration.freeGiftsJpySubtotal || 0,
    totalDeclaredJpyValue: declaration.totalDeclaredJpyValue || 0,
    jpyDifference: declaration.jpyDifference || 0,
    items: declaration.items,
    warnings: validation.warnings,
    validationErrors: validation.errors,
    isJpyTotalMatched: validation.isJpyTotalMatched || false,
    notes: notes || '2026年8月13日 発送予定 Zonos Prepay 申告データ (別PCポータブル移送対応)'
  };

  const jsonStr = JSON.stringify(projectData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `Zonos_Declaration_${projectData.shipmentId}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate & Parse Imported JSON Project File
 */
export function parseAndValidatePortableProjectJSON(jsonStr: string): {
  success: boolean;
  project?: ZonosPortableProjectFile;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonStr);

    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'ファイル形式が不正なJSONです。' };
    }

    if (parsed.schemaVersion !== '2.0.0') {
      return { success: false, error: `非対応のスキーマバージョン (${parsed.schemaVersion || '不明'}) です。2.0.0 を指定してください。` };
    }

    if (!parsed.ebayOrderId || !parsed.items || !Array.isArray(parsed.items)) {
      return { success: false, error: '必須フィールド (ebayOrderId, items) が不足しています。破損ファイルです。' };
    }

    // Security sanitization check for secrets
    const rawText = JSON.stringify(parsed);
    if (/access_token|client_secret|refresh_token|password|cookie/i.test(rawText)) {
      return { success: false, error: '機密情報 (トークン/パスワード) が含まれているためインポートを拒否しました。' };
    }

    return { success: true, project: parsed as ZonosPortableProjectFile };
  } catch (e) {
    return { success: false, error: `JSONパースエラー: ${(e as Error).message}` };
  }
}

/**
 * Convert Imported Project File back into Declaration object
 */
export function projectFileToDeclaration(project: ZonosPortableProjectFile): ZonosCustomsDeclaration {
  return {
    orderId: project.ebayOrderId,
    itemId: project.ebayItemIds[0] || '',
    title: project.items[0]?.title || '',
    imageUrl: project.items[0]?.imageUrl || '',
    weightKg: 0.35,
    totalItemsWeightGrams: project.items.reduce((acc, i) => acc + (i.subtotalWeightGrams || 250), 0),
    packagingWeightGrams: 150,
    totalPackagedWeightGrams: project.items.reduce((acc, i) => acc + (i.subtotalWeightGrams || 250), 0) + 150,
    ebayTransactionValueCents: Math.round(project.ebayTransactionValue * 100),
    ebayTransactionValue: project.ebayTransactionValue,
    currency: project.currency,
    exchangeRate: project.exchangeRate,
    exchangeRateSource: project.exchangeRateSource,
    exchangeRateTimestamp: project.exchangeRateTimestamp,
    ebayTransactionValueJpy: project.ebayTransactionValueJpy,
    regularItemsJpySubtotal: project.regularItemsJpySubtotal,
    freeGiftsJpySubtotal: project.freeGiftsJpySubtotal,
    totalDeclaredJpyValue: project.totalDeclaredJpyValue,
    jpyDifference: project.jpyDifference,
    carrier: 'JAPAN_POST',
    originCountry: 'JP',
    destinationCountry: project.destinationCountry,
    shippingMethod: '国際小包 船便',
    items: project.items,
    declarationLocked: false,
    confirmedAt: project.savedAt,
    orderDate: project.savedAt,
    paymentStatus: 'Paid',
    fulfillmentStatus: 'Ready for Shipment',
    importedAt: new Date().toLocaleTimeString(),
    importSource: 'mock',
    selectedAccountId: project.ebayAccountId,
    selectedAccountDisplayName: project.ebayAccountDisplayName
  };
}

/**
 * Local Autosave & Recovery
 */
export function saveAutosaveDeclaration(declaration: ZonosCustomsDeclaration): void {
  try {
    const timestamp = new Date().toLocaleString('ja-JP');
    localStorage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(declaration));
    localStorage.setItem(AUTOSAVE_TIME_KEY, timestamp);
  } catch (e) {
    console.error('Autosave failed:', e);
  }
}

export function loadAutosaveDeclaration(): { declaration: ZonosCustomsDeclaration | null; timestamp: string | null } {
  try {
    const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY);
    const timestamp = localStorage.getItem(AUTOSAVE_TIME_KEY);
    if (raw) {
      return { declaration: JSON.parse(raw), timestamp };
    }
  } catch (e) {
    console.error('Failed to load autosave:', e);
  }
  return { declaration: null, timestamp: null };
}
