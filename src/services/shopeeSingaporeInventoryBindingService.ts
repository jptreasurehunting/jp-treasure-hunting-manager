import { CrossChannelInventorySyncRequest } from './crossChannelInventorySyncService';

const STORAGE_KEY = 'jp_shopee_sg_inventory_bindings_v1';
export const SHOPEE_SG_BINDINGS_CHANGED_EVENT = 'jp-shopee-sg-bindings-changed';

export type ShopeeSingaporeSchemaStatus =
  | 'OFFICIAL_SCHEMA_REVIEW_REQUIRED'
  | 'OFFICIAL_SCHEMA_VERIFIED';

export interface ShopeeSingaporeInventoryBindingRecord {
  bindingId: string;
  centralSku: string;
  sellerAccountId: string;
  shopId: string;
  itemId: string;
  modelId?: string;
  sellerCentreUrl: string;
  schemaStatus: ShopeeSingaporeSchemaStatus;
  verifiedBy: string;
  verificationNote: string;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
  externalWriteAllowed: false;
}

export interface ShopeeSingaporeInventoryBindingInput {
  centralSku: string;
  sellerAccountId: string;
  shopId: string;
  itemId: string;
  modelId?: string;
  sellerCentreUrl: string;
  verifiedBy: string;
  verificationNote: string;
}

export interface ShopeeSingaporeInventoryBindingEvaluation {
  canSave: boolean;
  blockingReasons: string[];
  warnings: string[];
  normalized: ShopeeSingaporeInventoryBindingInput;
}

const SELLER_CENTRE_HOST = 'seller.shopee.sg';

function normalize(value: string | undefined): string {
  return String(value || '').trim();
}

function isPositiveIntegerText(value: string): boolean {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function isShopeeSingaporeSellerCentreUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === SELLER_CENTRE_HOST;
  } catch {
    return false;
  }
}

function bindingIdFor(input: ShopeeSingaporeInventoryBindingInput): string {
  const model = normalize(input.modelId) || 'NO_MODEL';
  return [input.centralSku, input.sellerAccountId, input.shopId, input.itemId, model]
    .map((value) => encodeURIComponent(normalize(value)))
    .join('__');
}

export function loadShopeeSingaporeInventoryBindings(): ShopeeSingaporeInventoryBindingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSingaporeInventoryBindings(records: ShopeeSingaporeInventoryBindingRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-2000)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOPEE_SG_BINDINGS_CHANGED_EVENT));
  }
}

export function evaluateShopeeSingaporeInventoryBinding(
  input: ShopeeSingaporeInventoryBindingInput
): ShopeeSingaporeInventoryBindingEvaluation {
  const normalized: ShopeeSingaporeInventoryBindingInput = {
    centralSku: normalize(input.centralSku),
    sellerAccountId: normalize(input.sellerAccountId),
    shopId: normalize(input.shopId),
    itemId: normalize(input.itemId),
    modelId: normalize(input.modelId) || undefined,
    sellerCentreUrl: normalize(input.sellerCentreUrl),
    verifiedBy: normalize(input.verifiedBy),
    verificationNote: normalize(input.verificationNote)
  };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!normalized.centralSku) blockingReasons.push('中央在庫SKUが未指定です。');
  if (!normalized.sellerAccountId) blockingReasons.push('Shopee販売アカウントIDが未指定です。');
  if (!isPositiveIntegerText(normalized.shopId)) blockingReasons.push('Shopee shopIdは正の整数で確認してください。');
  if (!isPositiveIntegerText(normalized.itemId)) blockingReasons.push('Shopee itemIdは正の整数で確認してください。');
  if (normalized.modelId && !isPositiveIntegerText(normalized.modelId)) blockingReasons.push('Shopee modelIdを入力する場合は正の整数で確認してください。');
  if (!isShopeeSingaporeSellerCentreUrl(normalized.sellerCentreUrl)) {
    blockingReasons.push('Seller Centre URLは https://seller.shopee.sg/ のURLで確認してください。');
  }
  if (!normalized.verifiedBy) blockingReasons.push('確認者を入力してください。');
  if (!normalized.verificationNote) blockingReasons.push('SKUとShopee商品を同一商品と判断した確認メモを入力してください。');

  warnings.push('現在のShopee Open Platform在庫更新Request Schemaは公式本文で再確認が必要です。');
  warnings.push('このBindingを保存してもShopeeへの外部書き込みは有効になりません。');

  return {
    canSave: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    normalized
  };
}

export function upsertShopeeSingaporeInventoryBinding(
  input: ShopeeSingaporeInventoryBindingInput,
  now = new Date().toISOString()
): { success: boolean; record?: ShopeeSingaporeInventoryBindingRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSingaporeInventoryBinding(input);
  if (!evaluation.canSave) {
    return {
      success: false,
      messageJa: 'Shopee Singapore在庫Bindingを保存できません。確認項目を修正してください。',
      blockingReasons: evaluation.blockingReasons
    };
  }

  const records = loadShopeeSingaporeInventoryBindings();
  const bindingId = bindingIdFor(evaluation.normalized);
  const existingIndex = records.findIndex((record) => record.bindingId === bindingId);
  const timestamp = Number.isFinite(Date.parse(now)) ? new Date(now).toISOString() : new Date().toISOString();
  const existing = existingIndex >= 0 ? records[existingIndex] : undefined;

  const record: ShopeeSingaporeInventoryBindingRecord = {
    bindingId,
    centralSku: evaluation.normalized.centralSku,
    sellerAccountId: evaluation.normalized.sellerAccountId,
    shopId: evaluation.normalized.shopId,
    itemId: evaluation.normalized.itemId,
    modelId: evaluation.normalized.modelId,
    sellerCentreUrl: evaluation.normalized.sellerCentreUrl,
    schemaStatus: 'OFFICIAL_SCHEMA_REVIEW_REQUIRED',
    verifiedBy: evaluation.normalized.verifiedBy,
    verificationNote: evaluation.normalized.verificationNote,
    verifiedAt: timestamp,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp,
    externalWriteAllowed: false
  };

  const next = [...records];
  if (existingIndex >= 0) next[existingIndex] = record;
  else next.push(record);
  saveShopeeSingaporeInventoryBindings(next);

  return {
    success: true,
    record,
    messageJa: 'Shopee Singaporeの商品対応関係を保存しました。公式API Schema確認までは外部在庫更新を禁止します。',
    blockingReasons: []
  };
}

export function findShopeeSingaporeBindingForSyncRequest(
  request: Pick<CrossChannelInventorySyncRequest, 'targetChannel' | 'sku' | 'sellerAccountId'>,
  records = loadShopeeSingaporeInventoryBindings()
): ShopeeSingaporeInventoryBindingRecord | undefined {
  if (request.targetChannel !== 'Shopee') return undefined;
  return records.find((record) =>
    record.centralSku === normalize(request.sku) &&
    record.sellerAccountId === normalize(request.sellerAccountId)
  );
}

export function evaluateShopeeSingaporeSyncReadiness(
  request: CrossChannelInventorySyncRequest,
  records = loadShopeeSingaporeInventoryBindings()
): { readyForExternalWrite: false; binding?: ShopeeSingaporeInventoryBindingRecord; blockingReasons: string[] } {
  const blockingReasons: string[] = [];
  if (request.targetChannel !== 'Shopee') {
    blockingReasons.push('Shopee以外の在庫同期要求です。');
    return { readyForExternalWrite: false, blockingReasons };
  }

  const binding = findShopeeSingaporeBindingForSyncRequest(request, records);
  if (!binding) {
    blockingReasons.push('中央在庫SKUとShopee Singapore商品IDの対応関係が未登録です。');
    return { readyForExternalWrite: false, blockingReasons };
  }

  if (binding.schemaStatus !== 'OFFICIAL_SCHEMA_VERIFIED') {
    blockingReasons.push('Shopee Open Platformの現在の在庫更新Request Schemaが公式確認済みではありません。');
  }
  if (binding.externalWriteAllowed !== false) {
    blockingReasons.push('未承認の外部書き込み状態を検知しました。');
  }

  return { readyForExternalWrite: false, binding, blockingReasons };
}
