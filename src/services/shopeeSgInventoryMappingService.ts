import type { CentralInventoryItem } from '../types/centralInventory';
import { loadCentralInventory, saveCentralInventory } from './centralInventoryService';

const STORAGE_KEY = 'jp_shopee_sg_inventory_mappings_v1';
export const SHOPEE_SG_INVENTORY_MAPPING_CHANGED_EVENT = 'jp-shopee-sg-inventory-mapping-changed';
export const SHOPEE_SG_SELLER_CENTRE_URL = 'https://seller.shopee.sg/portal/product/list/live/all?operationSortBy=recommend_v2';

export type ShopeeSgModelResolutionStatus =
  | 'NOT_CHECKED'
  | 'MODEL_ID_VERIFIED'
  | 'NO_MODEL_ID_CONFIRMED';

export type ShopeeSgCentralLinkStatus =
  | 'MATCHED'
  | 'NOT_LINKED'
  | 'CONFLICT';

export type ShopeeSgApiSchemaStatus =
  | 'OFFICIAL_SCHEMA_REVIEW_REQUIRED'
  | 'OFFICIAL_SCHEMA_VERIFIED';

export type ShopeeSgInventoryMappingStatus =
  | 'REVIEW_REQUIRED'
  | 'IDENTITY_VERIFIED_API_BLOCKED'
  | 'IDENTITY_VERIFIED_API_READY';

export interface ShopeeSgInventoryMappingInput {
  sku: string;
  sellerAccountId: string;
  shopId: string;
  shopeeItemId: string;
  modelResolutionStatus: ShopeeSgModelResolutionStatus;
  shopeeModelId?: string;
  sellerCentreChecked: boolean;
  mappingConfirmed: boolean;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
}

export interface ShopeeSgInventoryMappingRecord extends ShopeeSgInventoryMappingInput {
  mappingId: string;
  marketplaceRegion: 'SG';
  sellerCentreUrl: string;
  status: ShopeeSgInventoryMappingStatus;
  centralLinkStatus: ShopeeSgCentralLinkStatus;
  centralBindingListingId?: string;
  apiSchemaStatus: ShopeeSgApiSchemaStatus;
  externalWriteAllowed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgInventoryMappingEvaluation {
  normalized: ShopeeSgInventoryMappingInput;
  centralLinkStatus: ShopeeSgCentralLinkStatus;
  centralBindingListingId?: string;
  missingFields: string[];
  blockingReasons: string[];
  warnings: string[];
  canSave: boolean;
  canMarkIdentityVerified: boolean;
}

export interface ShopeeSgCentralBindingAttachInput {
  mappingId: string;
  confirmedExternalStock: number;
  stockConfirmedInSellerCentre: boolean;
  attachedBy: string;
  attachedAt: string;
  attachmentNote: string;
}

export interface ShopeeSgCentralBindingAttachResult {
  success: boolean;
  record?: ShopeeSgInventoryMappingRecord;
  messageJa: string;
  blockingReasons: string[];
}

function normalize(value: string | undefined): string {
  return String(value || '').trim();
}

function isPositiveNumericId(value: string): boolean {
  return /^[1-9]\d*$/.test(value);
}

function normalizeCheckedAt(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : normalize(value);
}

function getCentralLinkState(
  input: ShopeeSgInventoryMappingInput,
  items: CentralInventoryItem[]
): { status: ShopeeSgCentralLinkStatus; listingId?: string; warning?: string; blockingReason?: string } {
  const boundElsewhere = items.find((candidate) =>
    candidate.sku !== input.sku &&
    candidate.channelBindings.some((binding) =>
      binding.channel === 'Shopee' &&
      binding.sellerAccountId === input.sellerAccountId &&
      binding.channelListingId === input.shopeeItemId
    )
  );
  if (boundElsewhere) {
    return {
      status: 'CONFLICT',
      listingId: input.shopeeItemId,
      blockingReason: `Shopee Item ID [${input.shopeeItemId}] は中央在庫の別SKU [${boundElsewhere.sku}] に既に紐付いています。`
    };
  }

  const item = items.find((candidate) => candidate.sku === input.sku);
  if (!item) {
    return {
      status: 'CONFLICT',
      blockingReason: `中央在庫にSKU [${input.sku}] が存在しません。`
    };
  }

  const shopeeBindings = item.channelBindings.filter((binding) => binding.channel === 'Shopee');
  const exact = shopeeBindings.find((binding) =>
    binding.sellerAccountId === input.sellerAccountId &&
    binding.channelListingId === input.shopeeItemId
  );
  if (exact) return { status: 'MATCHED', listingId: exact.channelListingId };

  const sameAccount = shopeeBindings.find((binding) => binding.sellerAccountId === input.sellerAccountId);
  if (sameAccount) {
    return {
      status: 'CONFLICT',
      listingId: sameAccount.channelListingId,
      blockingReason: `中央在庫のShopee BindingはListing ID [${sameAccount.channelListingId}] ですが、入力されたShopee Item IDは [${input.shopeeItemId}] です。誤商品への在庫更新を防ぐため保存できません。`
    };
  }

  return {
    status: 'NOT_LINKED',
    warning: 'Shopeeの商品Identityは確認できますが、中央在庫のShopee Bindingにはまだ接続されていません。実在庫同期を有効にする前に別工程で紐付けが必要です。'
  };
}

export function loadShopeeSgInventoryMappings(): ShopeeSgInventoryMappingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSgInventoryMappings(records: ShopeeSgInventoryMappingRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-1000)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOPEE_SG_INVENTORY_MAPPING_CHANGED_EVENT));
  }
}

export function evaluateShopeeSgInventoryMapping(
  input: ShopeeSgInventoryMappingInput,
  items: CentralInventoryItem[],
  existingRecords: ShopeeSgInventoryMappingRecord[] = loadShopeeSgInventoryMappings()
): ShopeeSgInventoryMappingEvaluation {
  const normalized: ShopeeSgInventoryMappingInput = {
    sku: normalize(input.sku),
    sellerAccountId: normalize(input.sellerAccountId),
    shopId: normalize(input.shopId),
    shopeeItemId: normalize(input.shopeeItemId),
    modelResolutionStatus: input.modelResolutionStatus,
    shopeeModelId: normalize(input.shopeeModelId) || undefined,
    sellerCentreChecked: input.sellerCentreChecked === true,
    mappingConfirmed: input.mappingConfirmed === true,
    checkedBy: normalize(input.checkedBy),
    checkedAt: normalizeCheckedAt(input.checkedAt),
    verificationNote: normalize(input.verificationNote)
  };

  const missingFields: string[] = [];
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!normalized.sku) missingFields.push('SKU');
  if (!normalized.sellerAccountId) missingFields.push('Shopee販売アカウントID');
  if (!normalized.shopId) missingFields.push('Shopee Shop ID');
  if (!normalized.shopeeItemId) missingFields.push('Shopee Item ID');
  if (!normalized.checkedBy) missingFields.push('確認者');
  if (!normalized.checkedAt || !Number.isFinite(Date.parse(normalized.checkedAt))) missingFields.push('確認日時');
  if (!normalized.verificationNote) missingFields.push('確認メモ');
  if (!normalized.sellerCentreChecked) missingFields.push('Seller Centre確認');
  if (!normalized.mappingConfirmed) missingFields.push('SKUとShopee商品の一致確認');
  if (normalized.modelResolutionStatus === 'NOT_CHECKED') missingFields.push('Model ID/バリエーション確認');

  if (normalized.shopId && !isPositiveNumericId(normalized.shopId)) {
    blockingReasons.push('Shopee Shop IDは正の整数IDとして入力してください。');
  }
  if (normalized.shopeeItemId && !isPositiveNumericId(normalized.shopeeItemId)) {
    blockingReasons.push('Shopee Item IDは正の整数IDとして入力してください。');
  }
  if (normalized.modelResolutionStatus === 'MODEL_ID_VERIFIED') {
    if (!normalized.shopeeModelId) missingFields.push('Shopee Model ID');
    else if (!isPositiveNumericId(normalized.shopeeModelId)) blockingReasons.push('Shopee Model IDは正の整数IDとして入力してください。');
  }
  if (normalized.modelResolutionStatus === 'NO_MODEL_ID_CONFIRMED' && normalized.shopeeModelId) {
    blockingReasons.push('「Model IDなし確認済み」を選んだ場合はShopee Model IDを空欄にしてください。');
  }

  const duplicateItem = existingRecords.find((record) =>
    record.sellerAccountId === normalized.sellerAccountId &&
    record.shopId === normalized.shopId &&
    record.shopeeItemId === normalized.shopeeItemId &&
    record.sku !== normalized.sku
  );
  if (duplicateItem) {
    blockingReasons.push(`同じShopee Item IDが別SKU [${duplicateItem.sku}] に登録済みです。誤在庫更新防止のため重複登録できません。`);
  }

  const central = normalized.sku && normalized.sellerAccountId && normalized.shopeeItemId
    ? getCentralLinkState(normalized, items)
    : { status: 'NOT_LINKED' as ShopeeSgCentralLinkStatus };
  if (central.blockingReason) blockingReasons.push(central.blockingReason);
  if (central.warning) warnings.push(central.warning);

  warnings.push('Shopee Singapore Open Platformの現在の在庫更新Request Schemaはまだ公式仕様確認待ちです。このMappingを保存してもAPI書き込みは許可されません。');

  const canSave = missingFields.length === 0 && blockingReasons.length === 0;
  return {
    normalized,
    centralLinkStatus: central.status,
    centralBindingListingId: central.listingId,
    missingFields,
    blockingReasons,
    warnings,
    canSave,
    canMarkIdentityVerified: canSave
  };
}

export function upsertShopeeSgInventoryMapping(
  input: ShopeeSgInventoryMappingInput,
  items: CentralInventoryItem[],
  now = new Date().toISOString()
): { success: boolean; record?: ShopeeSgInventoryMappingRecord; evaluation: ShopeeSgInventoryMappingEvaluation; messageJa: string } {
  const records = loadShopeeSgInventoryMappings();
  const evaluation = evaluateShopeeSgInventoryMapping(input, items, records);
  if (!evaluation.canSave) {
    return {
      success: false,
      evaluation,
      messageJa: `Shopee SG商品Mappingを保存できません。${[...evaluation.missingFields, ...evaluation.blockingReasons].join(' / ')}`
    };
  }

  const timestamp = Number.isFinite(Date.parse(now)) ? new Date(now).toISOString() : new Date().toISOString();
  const existingIndex = records.findIndex((record) =>
    record.sku === evaluation.normalized.sku &&
    record.sellerAccountId === evaluation.normalized.sellerAccountId
  );
  const existing = existingIndex >= 0 ? records[existingIndex] : undefined;

  const record: ShopeeSgInventoryMappingRecord = {
    ...evaluation.normalized,
    mappingId: existing?.mappingId || `shopee_sg_map_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    sellerCentreUrl: SHOPEE_SG_SELLER_CENTRE_URL,
    status: 'IDENTITY_VERIFIED_API_BLOCKED',
    centralLinkStatus: evaluation.centralLinkStatus,
    centralBindingListingId: evaluation.centralBindingListingId,
    apiSchemaStatus: 'OFFICIAL_SCHEMA_REVIEW_REQUIRED',
    externalWriteAllowed: false,
    createdAt: existing?.createdAt || timestamp,
    updatedAt: timestamp
  };

  const next = [...records];
  if (existingIndex >= 0) next[existingIndex] = record;
  else next.push(record);
  saveShopeeSgInventoryMappings(next);

  return {
    success: true,
    record,
    evaluation,
    messageJa: evaluation.centralLinkStatus === 'MATCHED'
      ? 'Shopee SGの商品Identityと中央在庫Bindingの一致を保存しました。API書き込みはまだ無効です。'
      : 'Shopee SGの商品Identityを保存しました。中央在庫Bindingへの接続と公式API Schema確認が残っています。'
  };
}

export function attachShopeeSgMappingToCentralInventory(
  input: ShopeeSgCentralBindingAttachInput
): ShopeeSgCentralBindingAttachResult {
  const records = loadShopeeSgInventoryMappings();
  const recordIndex = records.findIndex((record) => record.mappingId === normalize(input.mappingId));
  if (recordIndex < 0) {
    return { success: false, blockingReasons: ['対象のShopee SG商品Mappingが見つかりません。'], messageJa: '中央在庫Bindingへ接続できませんでした。' };
  }

  const record = records[recordIndex];
  const blockingReasons: string[] = [];
  const attachedBy = normalize(input.attachedBy);
  const attachmentNote = normalize(input.attachmentNote);
  const attachedAtMs = Date.parse(input.attachedAt);

  if (record.status !== 'IDENTITY_VERIFIED_API_BLOCKED') blockingReasons.push('商品Identity確認済み・API停止中のMappingだけを中央在庫へ接続できます。');
  if (record.centralLinkStatus === 'CONFLICT') blockingReasons.push('Mappingに中央在庫との不一致があります。先にItem ID/SKUを確認してください。');
  if (record.centralLinkStatus === 'MATCHED') blockingReasons.push('このMappingはすでに中央在庫Bindingと一致しています。');
  if (!Number.isInteger(input.confirmedExternalStock) || input.confirmedExternalStock < 0) blockingReasons.push('Seller Centreで確認した現在在庫は0以上の整数で入力してください。');
  if (input.stockConfirmedInSellerCentre !== true) blockingReasons.push('Seller Centreに表示されている現在在庫の確認が必要です。');
  if (!attachedBy) blockingReasons.push('Binding接続の確認者が必要です。');
  if (!Number.isFinite(attachedAtMs)) blockingReasons.push('Binding接続の確認日時が不正です。');
  if (!attachmentNote) blockingReasons.push('Binding接続の確認メモが必要です。');

  const items = loadCentralInventory();
  const itemIndex = items.findIndex((item) => item.sku === record.sku);
  if (itemIndex < 0) blockingReasons.push(`中央在庫にSKU [${record.sku}] が存在しません。`);

  const duplicateBindingItem = items.find((item) =>
    item.sku !== record.sku &&
    item.channelBindings.some((binding) =>
      binding.channel === 'Shopee' &&
      binding.sellerAccountId === record.sellerAccountId &&
      binding.channelListingId === record.shopeeItemId
    )
  );
  if (duplicateBindingItem) blockingReasons.push(`Shopee Item ID [${record.shopeeItemId}] は別SKU [${duplicateBindingItem.sku}] の中央在庫Bindingに使用されています。`);

  const item = itemIndex >= 0 ? items[itemIndex] : undefined;
  if (item) {
    const sameAccountBinding = item.channelBindings.find((binding) =>
      binding.channel === 'Shopee' && binding.sellerAccountId === record.sellerAccountId
    );
    if (sameAccountBinding) blockingReasons.push(`このSKUにはShopeeアカウント [${record.sellerAccountId}] のBindingが既にあります。`);
    if (Number.isInteger(input.confirmedExternalStock) && input.confirmedExternalStock >= 0 && input.confirmedExternalStock !== item.availableToSell) {
      blockingReasons.push(`Seller Centre確認在庫 ${input.confirmedExternalStock} 点と中央ATS ${item.availableToSell} 点が一致しません。接続前にShopee側を中央ATSへ手動調整し、再確認してください。`);
    }
  }

  if (blockingReasons.length > 0 || !item) {
    return {
      success: false,
      record,
      blockingReasons,
      messageJa: `中央在庫Bindingへ接続できません。${blockingReasons.join(' / ')}`
    };
  }

  const confirmedAt = new Date(attachedAtMs).toISOString();
  item.channelBindings.push({
    channel: 'Shopee',
    sellerAccountId: record.sellerAccountId,
    channelListingId: record.shopeeItemId,
    syncedStock: input.confirmedExternalStock,
    syncStatus: input.confirmedExternalStock === 0 ? 'PAUSED' : 'SYNCED',
    lastSyncedAt: confirmedAt,
    isAutoSyncEnabled: false
  });
  items[itemIndex] = item;
  saveCentralInventory(items);

  const updatedRecord: ShopeeSgInventoryMappingRecord = {
    ...record,
    centralLinkStatus: 'MATCHED',
    centralBindingListingId: record.shopeeItemId,
    updatedAt: confirmedAt,
    verificationNote: `${record.verificationNote} / Binding接続: ${attachmentNote} / 確認者: ${attachedBy}`
  };
  const nextRecords = [...records];
  nextRecords[recordIndex] = updatedRecord;
  saveShopeeSgInventoryMappings(nextRecords);

  return {
    success: true,
    record: updatedRecord,
    blockingReasons: [],
    messageJa: `Shopee Item ID [${record.shopeeItemId}] を中央SKU [${record.sku}] に接続しました。確認在庫 ${input.confirmedExternalStock} 点を最後の外部確認値として保存しました。Shopee API自動同期はまだOFFです。`
  };
}

export function isShopeeSgMappingReadyForInventoryWrite(record: ShopeeSgInventoryMappingRecord): boolean {
  return Boolean(
    record.status === 'IDENTITY_VERIFIED_API_READY' &&
    record.centralLinkStatus === 'MATCHED' &&
    record.apiSchemaStatus === 'OFFICIAL_SCHEMA_VERIFIED' &&
    record.externalWriteAllowed === true
  );
}
