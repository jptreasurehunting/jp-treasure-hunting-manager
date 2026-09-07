import { CentralInventoryItem } from '../types/centralInventory';
import {
  evaluateStoredPublishReadiness,
  ListingPublishGateRecord
} from './listingPublishGateService';
import { ListingPreparationDraft } from './listingPreparationService';

const PRE_PUBLISH_CHECK_STORAGE_KEY = 'jp_listing_pre_publish_checks_v1';
export const PRE_PUBLISH_CHECK_CHANGED_EVENT = 'jp-listing-pre-publish-check-changed';

export interface ListingPrePublishInput {
  publishQuantity: number;
  inventoryReconfirmed: boolean;
  duplicateListingReconfirmed: boolean;
  listingContentReconfirmed: boolean;
  sellerAccountReconfirmed: boolean;
  marketplaceRulesReconfirmed: boolean;
  marketplaceRulesRecheckSourceUrl: string;
  marketplaceRulesRecheckedAt: string;
  checkedBy: string;
  checkNote: string;
}

export interface ListingPrePublishEvaluation {
  canPreparePublishExecution: boolean;
  missingOrInvalidFieldsJa: string[];
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface ListingPrePublishCheckRecord {
  checkId: string;
  publishGateRecordId: string;
  draftId: string;
  sku: string;
  targetChannel: ListingPublishGateRecord['targetChannel'];
  targetMarketplace: string;
  sellerAccountId: string;
  publishQuantity: number;
  listingTitle: string;
  priceAmount: number;
  priceCurrency: string;
  marketplaceRulesRecheckSourceUrl: string;
  marketplaceRulesRecheckedAt: string;
  checkedBy: string;
  checkNote: string;
  checkedAt: string;
  draftUpdatedAtAtCheck: string;
  availableToSellAtCheck: number;
  status: 'PRE_PUBLISH_CHECK_PASSED';
}

export interface ListingPrePublishResult {
  success: boolean;
  record?: ListingPrePublishCheckRecord;
  evaluation: ListingPrePublishEvaluation;
  messageJa: string;
}

function normalizeText(value: string): string {
  return value.trim();
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidDateTime(value: string): boolean {
  return normalizeText(value).length > 0 && Number.isFinite(Date.parse(value));
}

export function loadListingPrePublishChecks(): ListingPrePublishCheckRecord[] {
  try {
    const raw = localStorage.getItem(PRE_PUBLISH_CHECK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListingPrePublishChecks(records: ListingPrePublishCheckRecord[]): void {
  localStorage.setItem(PRE_PUBLISH_CHECK_STORAGE_KEY, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PRE_PUBLISH_CHECK_CHANGED_EVENT));
  }
}

export function evaluateListingPrePublishCheck(
  publishGateRecord: ListingPublishGateRecord,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined,
  input: ListingPrePublishInput
): ListingPrePublishEvaluation {
  const missingOrInvalidFieldsJa: string[] = [];
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  const storedReadiness = evaluateStoredPublishReadiness(publishGateRecord, draft, item);
  blockingReasonsJa.push(...storedReadiness.blockingReasonsJa);

  if (!storedReadiness.readyForPublishAction) {
    blockingReasonsJa.push('保存済みの最終承認が現在の下書き・在庫状態では有効ではありません。');
  }

  if (!draft) {
    blockingReasonsJa.push('対応する出品下書きが見つかりません。');
  }
  if (!item) {
    blockingReasonsJa.push('対応する中央在庫SKUが見つかりません。');
  }

  if (!Number.isInteger(input.publishQuantity) || input.publishQuantity <= 0) {
    missingOrInvalidFieldsJa.push('公開数量は1以上の整数で入力してください。');
  } else if (item && input.publishQuantity > item.availableToSell) {
    blockingReasonsJa.push(`公開数量 ${input.publishQuantity} 件が現在の販売可能在庫 ${item.availableToSell} 件を超えています。`);
  }

  if (!input.inventoryReconfirmed) {
    missingOrInvalidFieldsJa.push('公開直前の中央在庫確認が未完了です。');
  }
  if (!input.duplicateListingReconfirmed) {
    missingOrInvalidFieldsJa.push('同一SKU・同一販売先の重複出品確認が未完了です。');
  }
  if (!input.listingContentReconfirmed) {
    missingOrInvalidFieldsJa.push('タイトル・価格・商品説明・配送条件の最終確認が未完了です。');
  }
  if (!input.sellerAccountReconfirmed) {
    missingOrInvalidFieldsJa.push('販売アカウントの公開直前確認が未完了です。');
  }
  if (!input.marketplaceRulesReconfirmed) {
    missingOrInvalidFieldsJa.push('Marketplace最新ルールの公開直前確認が未完了です。');
  }
  if (!isHttpsUrl(normalizeText(input.marketplaceRulesRecheckSourceUrl))) {
    missingOrInvalidFieldsJa.push('公開直前に確認したMarketplace公式情報のHTTPS URLを記録してください。');
  }
  if (!isValidDateTime(input.marketplaceRulesRecheckedAt)) {
    missingOrInvalidFieldsJa.push('Marketplaceルールの公開直前確認日時が未入力または不正です。');
  }
  if (!normalizeText(input.checkedBy)) {
    missingOrInvalidFieldsJa.push('公開直前チェック実施者の識別名・IDが未入力です。');
  }
  if (!normalizeText(input.checkNote)) {
    missingOrInvalidFieldsJa.push('公開直前チェックの確認内容を記録してください。');
  }

  if (draft && draft.sellerAccountId !== publishGateRecord.sellerAccountIdAtApproval) {
    blockingReasonsJa.push('最終承認時と販売アカウントが一致しません。');
  }

  if (item) {
    const sameChannelBinding = item.channelBindings.some(
      (binding) => binding.channel === publishGateRecord.targetChannel
    );
    if (sameChannelBinding) {
      blockingReasonsJa.push(`${publishGateRecord.targetChannel} の既存出品紐付けが見つかりました。重複公開を停止します。`);
    }

    if (item.availableToSell !== publishGateRecord.availableToSellAtApproval) {
      warningsJa.push(
        `最終承認時の販売可能在庫 ${publishGateRecord.availableToSellAtApproval} 件から現在 ${item.availableToSell} 件へ変化しています。公開数量を現在値に合わせて確認してください。`
      );
    }
  }

  if (draft && draft.updatedAt !== publishGateRecord.draftUpdatedAtAtApproval) {
    blockingReasonsJa.push('最終承認後に下書きが変更されています。最終承認からやり直してください。');
  }

  if (draft?.targetChannel === 'Shopee') {
    warningsJa.push('Shopeeは対象国・地域ごとにSeller Centreとルールが異なります。最終ゲートの対象マーケットと今回の公式確認元が一致しているか確認してください。');
  }

  warningsJa.push('このチェックを通過しても外部Marketplaceへの公開処理は実行しません。');

  return {
    canPreparePublishExecution: missingOrInvalidFieldsJa.length === 0 && blockingReasonsJa.length === 0,
    missingOrInvalidFieldsJa,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function recordListingPrePublishCheck(
  publishGateRecord: ListingPublishGateRecord,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined,
  input: ListingPrePublishInput,
  records: ListingPrePublishCheckRecord[] = loadListingPrePublishChecks()
): ListingPrePublishResult {
  const evaluation = evaluateListingPrePublishCheck(publishGateRecord, draft, item, input);
  if (
    !evaluation.canPreparePublishExecution ||
    !draft ||
    !item ||
    !draft.sellerAccountId ||
    !draft.listingTitle ||
    !Number.isFinite(draft.priceAmount) ||
    !draft.priceCurrency
  ) {
    return {
      success: false,
      evaluation,
      messageJa: '公開直前チェックに未確認項目または停止理由があるため、公開実行可能状態にはしていません。'
    };
  }

  const now = new Date().toISOString();
  const record: ListingPrePublishCheckRecord = {
    checkId: `pre_publish_${draft.draftId}_${Date.now()}`,
    publishGateRecordId: publishGateRecord.recordId,
    draftId: draft.draftId,
    sku: draft.sku,
    targetChannel: draft.targetChannel,
    targetMarketplace: publishGateRecord.targetMarketplace,
    sellerAccountId: draft.sellerAccountId,
    publishQuantity: input.publishQuantity,
    listingTitle: draft.listingTitle,
    priceAmount: draft.priceAmount!,
    priceCurrency: draft.priceCurrency,
    marketplaceRulesRecheckSourceUrl: normalizeText(input.marketplaceRulesRecheckSourceUrl),
    marketplaceRulesRecheckedAt: new Date(input.marketplaceRulesRecheckedAt).toISOString(),
    checkedBy: normalizeText(input.checkedBy),
    checkNote: normalizeText(input.checkNote),
    checkedAt: now,
    draftUpdatedAtAtCheck: draft.updatedAt,
    availableToSellAtCheck: item.availableToSell,
    status: 'PRE_PUBLISH_CHECK_PASSED'
  };

  const nextRecords = records.filter((existing) => existing.draftId !== draft.draftId);
  nextRecords.push(record);
  saveListingPrePublishChecks(nextRecords);

  return {
    success: true,
    record,
    evaluation,
    messageJa: '公開直前チェックを記録しました。外部公開はまだ行っていません。'
  };
}

export function isStoredPrePublishCheckStillValid(
  record: ListingPrePublishCheckRecord,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined
): { valid: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];

  if (!publishGateRecord || publishGateRecord.recordId !== record.publishGateRecordId) {
    reasonsJa.push('対応する最終承認記録が変更・消失しています。');
  }
  if (!draft) {
    reasonsJa.push('対応する出品下書きが見つかりません。');
  } else {
    if (draft.updatedAt !== record.draftUpdatedAtAtCheck) {
      reasonsJa.push('公開直前チェック後に出品下書きが変更されています。');
    }
    if ((draft.sellerAccountId ?? '') !== record.sellerAccountId) {
      reasonsJa.push('公開直前チェック後に販売アカウントが変更されています。');
    }
  }

  if (!item) {
    reasonsJa.push('対応する中央在庫SKUが見つかりません。');
  } else {
    if (item.availableToSell < record.publishQuantity) {
      reasonsJa.push(`現在の販売可能在庫 ${item.availableToSell} 件が公開予定数量 ${record.publishQuantity} 件を下回っています。`);
    }
    if (item.isLockedForOversellingRisk) {
      reasonsJa.push('二重販売リスクで中央在庫がロックされています。');
    }
    if (item.channelBindings.some((binding) => binding.channel === record.targetChannel)) {
      reasonsJa.push(`${record.targetChannel} の既存出品紐付けが追加されています。`);
    }
    if (item.channelBindings.some((binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK')) {
      reasonsJa.push('販売チャネルの在庫同期に要確認があります。');
    }
  }

  return { valid: reasonsJa.length === 0, reasonsJa: Array.from(new Set(reasonsJa)) };
}
