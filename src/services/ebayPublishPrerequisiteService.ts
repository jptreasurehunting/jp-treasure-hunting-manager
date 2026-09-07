import { ListingPublishAdapterSimulation } from './listingPublishAdapterService';

const EBAY_PUBLISH_PREREQUISITES_STORAGE_KEY = 'jp_ebay_publish_prerequisites_v1';
export const EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT = 'jp-ebay-publish-prerequisites-changed';

export interface EbayPublishPrerequisiteInput {
  marketplaceId: string;
  categoryId: string;
  condition: string;
  aspectsReviewed: boolean;
  aspects: Record<string, string[]>;
  imageUrls: string[];
  merchantLocationKey: string;
  paymentPolicyId: string;
  fulfillmentPolicyId: string;
  returnPolicyId: string;
  format: string;
  listingDuration: string;
  officialSourcesVerified: boolean;
  checkedAt: string;
  checkedBy: string;
  verificationNote: string;
}

export interface EbayPublishPrerequisiteEvaluation {
  canSaveVerifiedPrerequisites: boolean;
  missingOrInvalidFieldsJa: string[];
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface EbayPublishPrerequisiteRecord extends EbayPublishPrerequisiteInput {
  recordId: string;
  simulationId: string;
  dryRunId: string;
  draftId: string;
  sku: string;
  targetMarketplaceLabel: string;
  sellerAccountIdAtSave: string;
  requestFingerprintAtSave: string;
  savedAt: string;
  status: 'PREREQUISITES_VERIFIED';
  networkAction: 'NONE';
  sendAllowed: false;
}

export interface EbayPublishPrerequisiteResult {
  success: boolean;
  record?: EbayPublishPrerequisiteRecord;
  evaluation: EbayPublishPrerequisiteEvaluation;
  messageJa: string;
}

function normalize(value: string): string {
  return value.trim();
}

function isValidDateTime(value: string): boolean {
  return normalize(value).length > 0 && Number.isFinite(Date.parse(value));
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeAspects(aspects: Record<string, string[]>): Record<string, string[]> {
  const normalized: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(aspects)) {
    const cleanKey = normalize(key);
    const cleanValues = values.map(normalize).filter(Boolean);
    if (cleanKey && cleanValues.length > 0) normalized[cleanKey] = cleanValues;
  }
  return normalized;
}

export function loadEbayPublishPrerequisites(): EbayPublishPrerequisiteRecord[] {
  try {
    const raw = localStorage.getItem(EBAY_PUBLISH_PREREQUISITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEbayPublishPrerequisites(records: EbayPublishPrerequisiteRecord[]): void {
  localStorage.setItem(EBAY_PUBLISH_PREREQUISITES_STORAGE_KEY, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT));
  }
}

export function evaluateEbayPublishPrerequisites(
  simulation: ListingPublishAdapterSimulation,
  input: EbayPublishPrerequisiteInput
): EbayPublishPrerequisiteEvaluation {
  const missingOrInvalidFieldsJa: string[] = [];
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  if (simulation.targetChannel !== 'eBay' || simulation.adapterId !== 'EBAY_PUBLISH_ADAPTER_V1') {
    blockingReasonsJa.push('この公開前提条件レイヤーはeBay用です。Shopee等のSimulationには使用できません。');
  }
  if (simulation.mode !== 'SIMULATION_ONLY' || simulation.networkAction !== 'NONE' || simulation.sendAllowed !== false) {
    blockingReasonsJa.push('入力Simulationが安全な送信禁止状態ではありません。');
  }

  if (!normalize(input.marketplaceId)) missingOrInvalidFieldsJa.push('eBay正式MarketplaceIdが未入力です。');
  if (!normalize(input.categoryId)) missingOrInvalidFieldsJa.push('カテゴリIDが未入力です。');
  if (!normalize(input.condition)) missingOrInvalidFieldsJa.push('商品状態（Condition）が未入力です。');
  if (!input.aspectsReviewed) missingOrInvalidFieldsJa.push('カテゴリ別Item Specifics / aspectsの確認が未完了です。');

  const normalizedImageUrls = input.imageUrls.map(normalize).filter(Boolean);
  if (normalizedImageUrls.length === 0) {
    missingOrInvalidFieldsJa.push('商品画像URLを1件以上入力してください。');
  } else if (normalizedImageUrls.some((url) => !isHttpsUrl(url))) {
    missingOrInvalidFieldsJa.push('商品画像URLはすべてHTTPS URLにしてください。');
  }

  if (!normalize(input.merchantLocationKey)) missingOrInvalidFieldsJa.push('merchantLocationKeyが未入力です。');
  if (!normalize(input.paymentPolicyId)) missingOrInvalidFieldsJa.push('Payment Policy IDが未入力です。');
  if (!normalize(input.fulfillmentPolicyId)) missingOrInvalidFieldsJa.push('Fulfillment Policy IDが未入力です。');
  if (!normalize(input.returnPolicyId)) missingOrInvalidFieldsJa.push('Return Policy IDが未入力です。');
  if (!normalize(input.format)) missingOrInvalidFieldsJa.push('出品形式（format）が未入力です。');
  if (!normalize(input.listingDuration)) missingOrInvalidFieldsJa.push('listingDurationが未入力です。');
  if (!input.officialSourcesVerified) missingOrInvalidFieldsJa.push('eBay公式情報で各ID・条件を確認した記録が必要です。');
  if (!isValidDateTime(input.checkedAt)) missingOrInvalidFieldsJa.push('公式情報の確認日時が未入力または不正です。');
  if (!normalize(input.checkedBy)) missingOrInvalidFieldsJa.push('確認者の識別名・IDが未入力です。');
  if (!normalize(input.verificationNote)) missingOrInvalidFieldsJa.push('確認内容・根拠メモが未入力です。');

  warningsJa.push('このレイヤーは入力済みID・条件の完全性を確認するだけで、eBay APIから値を取得・検証しません。');
  warningsJa.push('カテゴリやBusiness Policy等の値を推測して自動補完しません。公式情報または実アカウントで確認した値を使用してください。');
  warningsJa.push('APIトークン・OAuth Secret・パスワード等の認証秘密情報はここへ保存しないでください。');
  warningsJa.push('前提条件がそろっても外部通信・出品は行いません。');

  return {
    canSaveVerifiedPrerequisites: missingOrInvalidFieldsJa.length === 0 && blockingReasonsJa.length === 0,
    missingOrInvalidFieldsJa,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function recordEbayPublishPrerequisites(
  simulation: ListingPublishAdapterSimulation,
  input: EbayPublishPrerequisiteInput,
  records: EbayPublishPrerequisiteRecord[] = loadEbayPublishPrerequisites()
): EbayPublishPrerequisiteResult {
  const evaluation = evaluateEbayPublishPrerequisites(simulation, input);
  if (!evaluation.canSaveVerifiedPrerequisites) {
    return {
      success: false,
      evaluation,
      messageJa: '未確認または不正な前提条件があるため、eBay公開前提条件を保存していません。'
    };
  }

  const now = new Date().toISOString();
  const record: EbayPublishPrerequisiteRecord = {
    recordId: `ebay_prereq_${simulation.draftId}_${Date.now()}`,
    simulationId: simulation.simulationId,
    dryRunId: simulation.dryRunId,
    draftId: simulation.draftId,
    sku: simulation.sku,
    targetMarketplaceLabel: simulation.targetMarketplace,
    sellerAccountIdAtSave: simulation.sellerAccountId,
    requestFingerprintAtSave: simulation.requestFingerprint,
    marketplaceId: normalize(input.marketplaceId),
    categoryId: normalize(input.categoryId),
    condition: normalize(input.condition),
    aspectsReviewed: true,
    aspects: normalizeAspects(input.aspects),
    imageUrls: input.imageUrls.map(normalize).filter(Boolean),
    merchantLocationKey: normalize(input.merchantLocationKey),
    paymentPolicyId: normalize(input.paymentPolicyId),
    fulfillmentPolicyId: normalize(input.fulfillmentPolicyId),
    returnPolicyId: normalize(input.returnPolicyId),
    format: normalize(input.format),
    listingDuration: normalize(input.listingDuration),
    officialSourcesVerified: true,
    checkedAt: new Date(input.checkedAt).toISOString(),
    checkedBy: normalize(input.checkedBy),
    verificationNote: normalize(input.verificationNote),
    savedAt: now,
    status: 'PREREQUISITES_VERIFIED',
    networkAction: 'NONE',
    sendAllowed: false
  };

  const next = records.filter((existing) => existing.draftId !== simulation.draftId);
  next.push(record);
  saveEbayPublishPrerequisites(next);

  return {
    success: true,
    record,
    evaluation,
    messageJa: 'eBay公開前提条件を確認済みとして保存しました。外部通信・出品は行っていません。'
  };
}

export function evaluateStoredEbayPublishPrerequisites(
  record: EbayPublishPrerequisiteRecord,
  simulation: ListingPublishAdapterSimulation | undefined
): { valid: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];

  if (!simulation) {
    reasonsJa.push('対応する公開アダプターSimulationが見つかりません。');
  } else {
    if (simulation.simulationId !== record.simulationId) {
      reasonsJa.push('公開アダプターSimulationが再生成されています。前提条件を再確認してください。');
    }
    if (simulation.dryRunId !== record.dryRunId) {
      reasonsJa.push('対応するDry Runが変更されています。前提条件を再確認してください。');
    }
    if (simulation.requestFingerprint !== record.requestFingerprintAtSave) {
      reasonsJa.push('送信予定内容が前提条件確認時から変更されています。');
    }
    if (simulation.sellerAccountId !== record.sellerAccountIdAtSave) {
      reasonsJa.push('販売アカウントが前提条件確認時から変更されています。');
    }
    if (simulation.targetChannel !== 'eBay') {
      reasonsJa.push('対象チャネルがeBayではありません。');
    }
  }

  if (record.networkAction !== 'NONE' || record.sendAllowed !== false) {
    reasonsJa.push('保存済み前提条件が安全な送信禁止状態ではありません。');
  }

  return { valid: reasonsJa.length === 0, reasonsJa: Array.from(new Set(reasonsJa)) };
}
