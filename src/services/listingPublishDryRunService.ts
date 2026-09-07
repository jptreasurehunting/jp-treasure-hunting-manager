import { CentralInventoryItem } from '../types/centralInventory';
import { ListingPreparationDraft } from './listingPreparationService';
import { ListingPublishGateRecord } from './listingPublishGateService';
import {
  isStoredPrePublishCheckStillValid,
  ListingPrePublishCheckRecord
} from './listingPrePublishCheckService';

const LISTING_DRY_RUN_STORAGE_KEY = 'jp_listing_publish_dry_runs_v1';
export const LISTING_DRY_RUN_CHANGED_EVENT = 'jp-listing-publish-dry-run-changed';

export interface ListingPublishDryRunPacket {
  dryRunId: string;
  mode: 'DRY_RUN';
  networkAction: 'NONE';
  draftId: string;
  prePublishCheckId: string;
  publishGateRecordId: string;
  sku: string;
  targetChannel: ListingPrePublishCheckRecord['targetChannel'];
  targetMarketplace: string;
  sellerAccountId: string;
  quantity: number;
  listing: {
    title: string;
    description: string;
    priceAmount: number;
    priceCurrency: string;
    shippingTerms: string;
  };
  clientRequestKey: string;
  requestFingerprint: string;
  generatedAt: string;
  draftUpdatedAtAtGeneration: string;
  availableToSellAtGeneration: number;
  source: 'INVENTORY_SALES_WORKBENCH';
}

export interface ListingPublishDryRunEvaluation {
  canGenerate: boolean;
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface ListingPublishDryRunResult {
  success: boolean;
  packet?: ListingPublishDryRunPacket;
  evaluation: ListingPublishDryRunEvaluation;
  messageJa: string;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function buildFingerprintInput(
  check: ListingPrePublishCheckRecord,
  draft: ListingPreparationDraft,
  item: CentralInventoryItem
): string {
  return JSON.stringify({
    draftId: draft.draftId,
    prePublishCheckId: check.checkId,
    publishGateRecordId: check.publishGateRecordId,
    sku: draft.sku,
    targetChannel: draft.targetChannel,
    targetMarketplace: check.targetMarketplace,
    sellerAccountId: draft.sellerAccountId,
    quantity: check.publishQuantity,
    title: draft.listingTitle,
    description: draft.listingDescription,
    priceAmount: draft.priceAmount,
    priceCurrency: draft.priceCurrency,
    shippingTerms: draft.shippingTerms,
    draftUpdatedAt: draft.updatedAt,
    availableToSell: item.availableToSell
  });
}

export function loadListingPublishDryRuns(): ListingPublishDryRunPacket[] {
  try {
    const raw = localStorage.getItem(LISTING_DRY_RUN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListingPublishDryRuns(packets: ListingPublishDryRunPacket[]): void {
  localStorage.setItem(LISTING_DRY_RUN_STORAGE_KEY, JSON.stringify(packets));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LISTING_DRY_RUN_CHANGED_EVENT));
  }
}

export function evaluateListingPublishDryRun(
  check: ListingPrePublishCheckRecord,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined
): ListingPublishDryRunEvaluation {
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  const storedValidity = isStoredPrePublishCheckStillValid(check, publishGateRecord, draft, item);
  blockingReasonsJa.push(...storedValidity.reasonsJa);

  if (!storedValidity.valid) {
    blockingReasonsJa.push('保存済みの公開直前チェックが現在の状態では有効ではありません。');
  }

  if (!publishGateRecord) {
    blockingReasonsJa.push('対応する最終承認記録が見つかりません。');
  }
  if (!draft) {
    blockingReasonsJa.push('対応する出品下書きが見つかりません。');
  }
  if (!item) {
    blockingReasonsJa.push('対応する中央在庫SKUが見つかりません。');
  }

  if (draft) {
    if (!draft.sellerAccountId) blockingReasonsJa.push('販売アカウントIDがありません。');
    if (!draft.listingTitle) blockingReasonsJa.push('出品タイトルがありません。');
    if (!draft.listingDescription) blockingReasonsJa.push('商品説明がありません。');
    if (!Number.isFinite(draft.priceAmount) || (draft.priceAmount ?? 0) <= 0) blockingReasonsJa.push('有効な販売価格がありません。');
    if (!draft.priceCurrency) blockingReasonsJa.push('通貨コードがありません。');
    if (!draft.shippingTerms) blockingReasonsJa.push('配送条件がありません。');
  }

  if (publishGateRecord && check.publishGateRecordId !== publishGateRecord.recordId) {
    blockingReasonsJa.push('公開直前チェックと最終承認記録が一致しません。');
  }

  if (item && check.publishQuantity > item.availableToSell) {
    blockingReasonsJa.push(`公開予定数量 ${check.publishQuantity} 件が現在の販売可能在庫 ${item.availableToSell} 件を超えています。`);
  }

  warningsJa.push('Dry Runは送信予定データを生成するだけで、Marketplaceへの通信・出品・在庫変更を行いません。');
  warningsJa.push('APIトークン・パスワード等の秘密情報はDry Runパケットへ含めません。');
  warningsJa.push('clientRequestKeyは将来の二重実行防止設計用の内部識別子であり、Marketplace APIの正式な冪等性キー仕様を保証するものではありません。');

  return {
    canGenerate: blockingReasonsJa.length === 0,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function generateListingPublishDryRun(
  check: ListingPrePublishCheckRecord,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined,
  packets: ListingPublishDryRunPacket[] = loadListingPublishDryRuns()
): ListingPublishDryRunResult {
  const evaluation = evaluateListingPublishDryRun(check, publishGateRecord, draft, item);
  if (
    !evaluation.canGenerate ||
    !publishGateRecord ||
    !draft ||
    !item ||
    !draft.sellerAccountId ||
    !draft.listingTitle ||
    !draft.listingDescription ||
    !Number.isFinite(draft.priceAmount) ||
    !draft.priceCurrency ||
    !draft.shippingTerms
  ) {
    return {
      success: false,
      evaluation,
      messageJa: 'Dry Run生成条件を満たしていないため、公開リクエストは生成していません。'
    };
  }

  const generatedAt = new Date().toISOString();
  const fingerprint = stableHash(buildFingerprintInput(check, draft, item));
  const packet: ListingPublishDryRunPacket = {
    dryRunId: `listing_dry_run_${draft.draftId}_${Date.now()}`,
    mode: 'DRY_RUN',
    networkAction: 'NONE',
    draftId: draft.draftId,
    prePublishCheckId: check.checkId,
    publishGateRecordId: publishGateRecord.recordId,
    sku: draft.sku,
    targetChannel: draft.targetChannel,
    targetMarketplace: publishGateRecord.targetMarketplace,
    sellerAccountId: draft.sellerAccountId,
    quantity: check.publishQuantity,
    listing: {
      title: draft.listingTitle,
      description: draft.listingDescription,
      priceAmount: draft.priceAmount!,
      priceCurrency: draft.priceCurrency,
      shippingTerms: draft.shippingTerms
    },
    clientRequestKey: `dryrun:${draft.targetChannel}:${draft.draftId}:${check.checkId}`,
    requestFingerprint: fingerprint,
    generatedAt,
    draftUpdatedAtAtGeneration: draft.updatedAt,
    availableToSellAtGeneration: item.availableToSell,
    source: 'INVENTORY_SALES_WORKBENCH'
  };

  const nextPackets = packets.filter((existing) => existing.draftId !== draft.draftId);
  nextPackets.push(packet);
  saveListingPublishDryRuns(nextPackets);

  return {
    success: true,
    packet,
    evaluation,
    messageJa: 'Dry Run公開リクエストを生成しました。Marketplaceへの通信・出品は行っていません。'
  };
}

export function evaluateStoredListingPublishDryRun(
  packet: ListingPublishDryRunPacket,
  check: ListingPrePublishCheckRecord | undefined,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined
): { valid: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];

  if (!check || check.checkId !== packet.prePublishCheckId) {
    reasonsJa.push('対応する公開直前チェックが変更・消失しています。');
  }
  if (!publishGateRecord || publishGateRecord.recordId !== packet.publishGateRecordId) {
    reasonsJa.push('対応する最終承認記録が変更・消失しています。');
  }
  if (!draft) {
    reasonsJa.push('対応する出品下書きが見つかりません。');
  } else {
    if (draft.updatedAt !== packet.draftUpdatedAtAtGeneration) {
      reasonsJa.push('Dry Run生成後に出品下書きが変更されています。');
    }
    if ((draft.sellerAccountId ?? '') !== packet.sellerAccountId) {
      reasonsJa.push('Dry Run生成後に販売アカウントが変更されています。');
    }
  }

  if (!item) {
    reasonsJa.push('対応する中央在庫SKUが見つかりません。');
  } else {
    if (item.availableToSell < packet.quantity) {
      reasonsJa.push(`現在の販売可能在庫 ${item.availableToSell} 件がDry Run数量 ${packet.quantity} 件を下回っています。`);
    }
    if (item.isLockedForOversellingRisk) {
      reasonsJa.push('二重販売リスクで中央在庫がロックされています。');
    }
    if (item.channelBindings.some((binding) => binding.channel === packet.targetChannel)) {
      reasonsJa.push(`${packet.targetChannel} の既存出品紐付けが追加されています。`);
    }
    if (item.channelBindings.some((binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK')) {
      reasonsJa.push('販売チャネルの在庫同期に要確認があります。');
    }
  }

  if (check && publishGateRecord && draft && item) {
    const currentEvaluation = evaluateListingPublishDryRun(check, publishGateRecord, draft, item);
    reasonsJa.push(...currentEvaluation.blockingReasonsJa);
    const currentFingerprint = stableHash(buildFingerprintInput(check, draft, item));
    if (currentFingerprint !== packet.requestFingerprint) {
      reasonsJa.push('現在の公開予定内容がDry Run生成時の内容と一致しません。再生成してください。');
    }
  }

  return { valid: reasonsJa.length === 0, reasonsJa: Array.from(new Set(reasonsJa)) };
}
