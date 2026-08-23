import {
  ZonosCustomsDeclaration,
  CustomsValidationStatus,
  TransferSession
} from '../types/zonosCustoms';
import { formatZonosCustomsDescription } from '../utils/zonosCustomsValidation';
import { classifyDestination } from './shippingDecisionEngineService';

const TRANSFER_SESSION_STORAGE_KEY = 'zonos_transfer_active_session';

export interface PreTransferCheckResult {
  canStart: boolean;
  errors: string[];
  missingItems: Array<{ fieldName: string; stepTarget: string; reason: string }>;
}

/**
 * Executes 12-Point Pre-Transfer Validation (Spec #4)
 */
export function runPreTransferCheck(
  declaration: ZonosCustomsDeclaration,
  status: CustomsValidationStatus
): PreTransferCheckResult {
  const errors: string[] = [];
  const missingItems: Array<{ fieldName: string; stepTarget: string; reason: string }> = [];

  // 1. Carrier check
  if (declaration.carrier !== 'JAPAN_POST') {
    errors.push('配送会社が日本郵便ではありません。');
    missingItems.push({ fieldName: '配送会社', stepTarget: 'shipping_info', reason: '日本郵便を指定してください' });
  }

  // 2. Origin country check
  if (declaration.originCountry !== 'JP') {
    errors.push('発送元国が日本(JP)ではありません。');
    missingItems.push({ fieldName: '発送元国', stepTarget: 'shipping_info', reason: '日本を指定してください' });
  }

  // 3. Destination country non-Japan (Validated via Shipping Decision Engine)
  const destClass = classifyDestination(declaration.destinationCountry);
  if (destClass.classification === 'DOMESTIC_JP' || status.isDomesticShipment || status.destinationMissing) {
    const reasonMsg = destClass.classification === 'DOMESTIC_JP'
      ? '日本国内発送(DOMESTIC_JP)の注文です。Zonos Prepay 転記処理は不要です（スキップされます）。'
      : '発送先国が国内または未設定です。';
    errors.push(reasonMsg);
    missingItems.push({ fieldName: '発送先国', stepTarget: 'shipping_info', reason: '海外の発送先国を指定してください' });
  }

  // 4. Shipping method selected
  if (!declaration.shippingMethod || !declaration.shippingMethod.trim()) {
    errors.push('配送方法が未選択です。');
    missingItems.push({ fieldName: '配送方法', stepTarget: 'shipping_info', reason: '日本郵便の配送方法を選択してください' });
  }

  // 5. Quantity >= 1
  if (status.quantityInvalid) {
    errors.push('数量が正しくありません (1以上が必要です)。');
    missingItems.push({ fieldName: '数量', stepTarget: 'items_editor', reason: '数量を1以上に設定してください' });
  }

  // 6. Declared value positive
  if (status.valueInvalid) {
    errors.push('申告価格に不正な値が含まれています。');
    missingItems.push({ fieldName: '申告価格', stepTarget: 'items_editor', reason: '正の申告金額を入力してください' });
  }

  // 7. Material filled
  if (status.materialMissing) {
    errors.push('未入力の材質があります。');
    missingItems.push({ fieldName: '材質', stepTarget: 'items_editor', reason: '全ての品目に材質を入力してください' });
  }

  // 8. Product type filled
  if (status.productTypeMissing) {
    errors.push('未入力の商品種類があります。');
    missingItems.push({ fieldName: '商品種類', stepTarget: 'items_editor', reason: '全ての品目に商品種類を入力してください' });
  }

  // 9. Origin country filled
  if (status.originMissing) {
    errors.push('原産国が未入力です。');
    missingItems.push({ fieldName: '原産国', stepTarget: 'items_editor', reason: '原産国(Japan)を確認してください' });
  }

  // 10. Total value matches eBay transaction value
  if (status.differenceCents !== 0) {
    errors.push(`申告価格合計がeBay取引金額と一致していません (差額: $${status.difference.toFixed(2)})。`);
    missingItems.push({ fieldName: '申告価格合計', stepTarget: 'status_check', reason: '申告価格の合計額を取引金額と一致させてください' });
  }

  // 11. Included item value positive
  for (const item of declaration.items) {
    if (item.isIncludedItem && item.declaredValueCents <= 0) {
      errors.push('同梱品の申告価格が0以下です。');
      missingItems.push({ fieldName: '同梱品価格', stepTarget: 'items_editor', reason: '同梱品の申告価格は0より大きい金額を入力してください' });
      break;
    }
  }

  // 12. Declaration state locked
  if (!declaration.declarationLocked) {
    errors.push('申告価格が確定（ロック）されていません。');
    missingItems.push({ fieldName: '確定状態', stepTarget: 'status_check', reason: '「申告価格を確定」ボタンを押してください' });
  }

  return {
    canStart: errors.length === 0,
    errors,
    missingItems
  };
}

/**
 * Currency JPY Rounding Helper (Spec #10)
 * Converts USD to JPY using exchange rate and adjusts rounding on included items
 */
export function calculateJpyDeclarationValues(
  declaration: ZonosCustomsDeclaration,
  exchangeRateJpyPerUsd: number = 150.0
): { itemsJpy: Array<{ id: string; jpyValue: number }>; totalJpy: number } {
  const totalJpy = Math.round(declaration.ebayTransactionValue * exchangeRateJpyPerUsd);

  const items = declaration.items;
  let accumulatedJpy = 0;
  const itemsJpy: Array<{ id: string; jpyValue: number }> = [];

  // Calculate proportional JPY value for each item
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLastIncluded = i === items.length - 1 && item.isIncludedItem;

    let itemJpy = Math.round(item.declaredValue * exchangeRateJpyPerUsd);

    // End rounding adjustment on last included item if present
    if (isLastIncluded) {
      itemJpy = totalJpy - accumulatedJpy;
    }

    accumulatedJpy += itemJpy;
    itemsJpy.push({ id: item.id, jpyValue: Math.max(1, itemJpy) });
  }

  return { itemsJpy, totalJpy };
}

/**
 * Saves Active Transfer Session to SessionStorage (Spec #15 - In-Memory Session for MAD Compliance)
 */
export function saveTransferSession(session: TransferSession): void {
  try {
    sessionStorage.setItem(TRANSFER_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save transfer session:', e);
  }
}

/**
 * Loads Active Transfer Session from SessionStorage
 */
export function loadTransferSession(): TransferSession | null {
  try {
    const raw = sessionStorage.getItem(TRANSFER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load transfer session:', e);
    return null;
  }
}

/**
 * Clears Active Transfer Session from SessionStorage
 */
export function clearTransferSession(): void {
  try {
    sessionStorage.removeItem(TRANSFER_SESSION_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear transfer session:', e);
  }
}

/**
 * Temporary Image Download Utility (Spec #7)
 * Downloads image as a temporary blob file for user drag-and-drop into Zonos
 */
export async function downloadTemporaryImage(imageUrl: string, filename: string): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { mode: 'cors' });
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'zonos_customs_item_image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    return true;
  } catch (err) {
    console.warn('Direct blob fetch failed, triggering fallback direct link download:', err);
    const a = document.createElement('a');
    a.href = imageUrl;
    a.target = '_blank';
    a.download = filename || 'zonos_customs_item_image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  }
}
