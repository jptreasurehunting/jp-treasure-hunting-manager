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
export interface EbayListingClipboardPayloadInput {
  sku: string;
  inventoryUnitId?: string;
  sellerAccountId?: string;
  listingTitle: string;
  listingDescription: string;
  priceAmount: number;
  priceCurrency: string;
  shippingTerms: string;
}

export interface EbayListingCopyReadiness {
  canCopy: boolean;
  warningsJa: string[];
  blockingIssuesJa: string[];
  formattedPayload: string;
}

/**
 * Formats eBay listing draft fields into a clearly demarcated plain text block
 * suitable for manual copy-pasting into eBay Seller Hub.
 */
export function formatEbayListingClipboardPayload(input: EbayListingClipboardPayloadInput): string {
  const title = input.listingTitle || '';
  const priceFormatted = Number.isFinite(input.priceAmount) ? input.priceAmount.toFixed(2) : '0.00';
  const currency = input.priceCurrency ? input.priceCurrency.toUpperCase() : 'USD';

  return [
    `=== eBay LISTING DRAFT [SKU: ${input.sku || 'N/A'}] ===`,
    `SKU: ${input.sku || '未指定'}`,
    input.inventoryUnitId ? `Unit ID (個体管理番号): ${input.inventoryUnitId}` : 'Unit ID: 未指定 (現物個体未確定)',
    input.sellerAccountId ? `Seller Account: ${input.sellerAccountId}` : 'Seller Account: 未指定',
    '',
    `--- 1. TITLE (タイトル: 最大80文字) [現在: ${title.length}文字] ---`,
    title,
    '',
    '--- 2. PRICE (販売価格) ---',
    `${currency} ${priceFormatted}`,
    '',
    '--- 3. DESCRIPTION (商品説明) ---',
    input.listingDescription || '',
    '',
    '--- 4. SHIPPING TERMS (配送条件・ポリシー) ---',
    input.shippingTerms || '',
    '',
    '=== END OF DRAFT ===',
    '※ 注意: 本テキストはeBay Seller Hub手動転記用のドラフト出力です。',
    '※ クリップボードコピーによって出品状態（Published/Committed）は変更されません。eBay上で最終確認のうえ公開してください。'
  ].join('\n');
}

/**
 * Evaluates whether the draft is ready to be copied for eBay Seller Hub entry.
 * Checks for missing required fields, 80-char title limit, USD currency convention,
 * and individual unit confirmation, without mutating any draft state.
 */
export function evaluateEbayListingCopyReadiness(
  input: EbayListingClipboardPayloadInput,
  item?: CentralInventoryItem
): EbayListingCopyReadiness {
  const blockingIssuesJa: string[] = [];
  const warningsJa: string[] = [];

  const title = (input.listingTitle || '').trim();
  const desc = (input.listingDescription || '').trim();
  const terms = (input.shippingTerms || '').trim();
  const currency = (input.priceCurrency || '').trim().toUpperCase();

  if (!title) blockingIssuesJa.push('出品タイトルが未入力です。');
  if (!desc) blockingIssuesJa.push('商品説明が未入力です。');
  if (!terms) blockingIssuesJa.push('配送条件が未入力です。');
  if (!Number.isFinite(input.priceAmount) || input.priceAmount <= 0) {
    blockingIssuesJa.push('販売価格は0より大きい数値を入力してください。');
  }

  // Warnings (non-blocking for clipboard copy, but critical for eBay Seller Hub input)
  if (title.length > 80) {
    warningsJa.push(`出品タイトルが80文字を超過しています（現在: ${title.length}文字）。eBayのタイトル上限80字に合わせて切り詰めが必要です。`);
  }
  if (currency && currency !== 'USD') {
    warningsJa.push(`通貨コードが [${currency}] です。eBay US出品では通常 USD が指定されます。`);
  }
  if (!input.inventoryUnitId) {
    warningsJa.push('実物個体管理番号（Unit ID）が未指定です。現物個体の取り違えにご注意ください。');
  }
  if (item && item.sku !== input.sku) {
    warningsJa.push(`対象SKU（${input.sku}）と選択中の中央在庫アイテム（${item.sku}）が一致していません。個体の取り違えがないか確認してください。`);
  }

  return {
    canCopy: blockingIssuesJa.length === 0,
    warningsJa,
    blockingIssuesJa,
    formattedPayload: formatEbayListingClipboardPayload(input)
  };
}
