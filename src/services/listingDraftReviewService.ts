import { CentralInventoryItem } from '../types/centralInventory';
import {
  ListingPreparationDraft,
  loadListingPreparationDrafts,
  saveListingPreparationDrafts
} from './listingPreparationService';

export interface ListingDraftReviewInput {
  sellerAccountId: string;
  listingTitle: string;
  listingDescription: string;
  priceAmount: number;
  priceCurrency: string;
  shippingTerms: string;
}

export interface ListingDraftReadiness {
  canAdvanceToFinalReview: boolean;
  missingOrInvalidFieldsJa: string[];
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface UpdateListingDraftReviewResult {
  success: boolean;
  draft?: ListingPreparationDraft;
  readiness: ListingDraftReadiness;
  messageJa: string;
}

function normalizeText(value: string): string {
  return value.trim();
}

function normalizeCurrency(value: string): string {
  return value.trim().toUpperCase();
}

function validateReviewFields(input: ListingDraftReviewInput): string[] {
  const issues: string[] = [];
  if (!normalizeText(input.sellerAccountId)) issues.push('販売アカウントIDが未入力です。');
  if (!normalizeText(input.listingTitle)) issues.push('出品タイトルが未入力です。');
  if (!normalizeText(input.listingDescription)) issues.push('商品説明が未入力です。');
  if (!Number.isFinite(input.priceAmount) || input.priceAmount <= 0) issues.push('販売価格は0より大きい数値で入力してください。');
  if (!/^[A-Z]{3}$/.test(normalizeCurrency(input.priceCurrency))) issues.push('通貨コードはUSD・JPYなど3文字で入力してください。');
  if (!normalizeText(input.shippingTerms)) issues.push('配送条件が未入力です。');
  return issues;
}

function getInventoryBlockingReasons(
  draft: ListingPreparationDraft,
  item?: CentralInventoryItem
): string[] {
  if (!item) return ['対応する中央在庫SKUが見つかりません。'];

  const reasons: string[] = [];
  if (item.availableToSell <= 0) reasons.push('販売可能在庫が0になっています。');
  if (item.isLockedForOversellingRisk) reasons.push('二重販売リスクで中央在庫がロックされています。');

  const hasSyncIssue = item.channelBindings.some(
    (binding) => binding.syncStatus === 'PENDING' || binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK'
  );
  if (hasSyncIssue) reasons.push('既存販売チャネルの在庫同期が未完了または要確認です。外部反映の成功確認後に進めてください。');

  const targetAlreadyExists = item.channelBindings.some(
    (binding) => binding.channel === draft.targetChannel
  );
  if (targetAlreadyExists) {
    reasons.push(`${draft.targetChannel} の既存出品紐付けが追加されています。重複出品防止のため最終確認へ進めません。`);
  }

  return reasons;
}

export function evaluateListingDraftReadiness(
  draft: ListingPreparationDraft,
  item?: CentralInventoryItem
): ListingDraftReadiness {
  const input: ListingDraftReviewInput = {
    sellerAccountId: draft.sellerAccountId ?? '',
    listingTitle: draft.listingTitle ?? '',
    listingDescription: draft.listingDescription ?? '',
    priceAmount: draft.priceAmount ?? Number.NaN,
    priceCurrency: draft.priceCurrency ?? '',
    shippingTerms: draft.shippingTerms ?? ''
  };

  const missingOrInvalidFieldsJa = validateReviewFields(input);
  const blockingReasonsJa = getInventoryBlockingReasons(draft, item);
  const warningsJa: string[] = [];

  if (item && item.availableToSell !== draft.availableToSellAtCreation) {
    warningsJa.push(
      `下書き作成時の販売可能在庫 ${draft.availableToSellAtCreation} 件から現在 ${item.availableToSell} 件へ変化しています。最終確認時に数量を再確認してください。`
    );
  }

  warningsJa.push('販売アカウントIDは入力値を保存するだけで、現時点では外部サービス上の実在確認をしていません。');
  warningsJa.push('この判定は社内入力項目と在庫安全性の確認です。eBay / Shopeeの最新出品ルール確認は最終公開前に別途必要です。');

  return {
    canAdvanceToFinalReview: missingOrInvalidFieldsJa.length === 0 && blockingReasonsJa.length === 0,
    missingOrInvalidFieldsJa,
    blockingReasonsJa,
    warningsJa
  };
}

export function updateListingDraftReview(
  draftId: string,
  input: ListingDraftReviewInput,
  item: CentralInventoryItem | undefined,
  drafts: ListingPreparationDraft[] = loadListingPreparationDrafts()
): UpdateListingDraftReviewResult {
  const index = drafts.findIndex((draft) => draft.draftId === draftId);
  if (index < 0) {
    const readiness: ListingDraftReadiness = {
      canAdvanceToFinalReview: false,
      missingOrInvalidFieldsJa: [],
      blockingReasonsJa: ['対象の出品準備下書きが見つかりません。'],
      warningsJa: []
    };
    return { success: false, readiness, messageJa: '対象の出品準備下書きが見つかりません。' };
  }

  const current = drafts[index];
  const updated: ListingPreparationDraft = {
    ...current,
    sellerAccountId: normalizeText(input.sellerAccountId),
    listingTitle: normalizeText(input.listingTitle),
    listingDescription: normalizeText(input.listingDescription),
    priceAmount: Number(input.priceAmount),
    priceCurrency: normalizeCurrency(input.priceCurrency),
    shippingTerms: normalizeText(input.shippingTerms),
    updatedAt: new Date().toISOString()
  };

  const readiness = evaluateListingDraftReadiness(updated, item);
  updated.status = readiness.canAdvanceToFinalReview
    ? 'READY_FOR_FINAL_REVIEW'
    : 'DRAFT_REVIEW_REQUIRED';

  const nextDrafts = [...drafts];
  nextDrafts[index] = updated;
  saveListingPreparationDrafts(nextDrafts);

  return {
    success: true,
    draft: updated,
    readiness,
    messageJa: readiness.canAdvanceToFinalReview
      ? '必要項目と在庫安全性の確認を通過しました。最終確認待ちです。外部公開はしていません。'
      : '下書きを保存しました。未入力項目または安全上の確認事項が残っています。'
  };
}
