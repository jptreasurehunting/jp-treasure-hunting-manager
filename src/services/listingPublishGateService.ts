import { CentralInventoryItem } from '../types/centralInventory';
import { SalesChannel } from '../types/shippingRouter';
import { evaluateListingDraftReadiness } from './listingDraftReviewService';
import { ListingPreparationDraft } from './listingPreparationService';

const LISTING_PUBLISH_GATE_STORAGE_KEY = 'jp_listing_publish_gate_records_v1';
export const LISTING_PUBLISH_GATE_CHANGED_EVENT = 'jp-listing-publish-gate-changed';

export interface ListingPublishGateInput {
  targetMarketplace: string;
  sellerAccountVerified: boolean;
  sellerAccountVerificationNote: string;
  marketplaceRulesVerified: boolean;
  marketplaceRulesSourceUrl: string;
  marketplaceRulesCheckedAt: string;
  marketplaceRulesNote: string;
  finalApproved: boolean;
  approvedBy: string;
  approvalNote: string;
}

export interface ListingPublishGateEvaluation {
  canRecordApproval: boolean;
  missingOrInvalidFieldsJa: string[];
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface ListingPublishGateRecord {
  recordId: string;
  draftId: string;
  sku: string;
  targetChannel: SalesChannel;
  targetMarketplace: string;
  sellerAccountIdAtApproval: string;
  sellerAccountVerificationNote: string;
  sellerAccountVerifiedAt: string;
  marketplaceRulesSourceUrl: string;
  marketplaceRulesCheckedAt: string;
  marketplaceRulesNote: string;
  approvedBy: string;
  approvalNote: string;
  approvedAt: string;
  draftUpdatedAtAtApproval: string;
  availableToSellAtApproval: number;
  status: 'READY_FOR_PUBLISH_ACTION';
}

export interface ListingPublishGateResult {
  success: boolean;
  record?: ListingPublishGateRecord;
  evaluation: ListingPublishGateEvaluation;
  messageJa: string;
}

export interface StoredPublishReadiness {
  readyForPublishAction: boolean;
  blockingReasonsJa: string[];
  warningsJa: string[];
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
  if (!normalizeText(value)) return false;
  return Number.isFinite(Date.parse(value));
}

export function loadListingPublishGateRecords(): ListingPublishGateRecord[] {
  try {
    const raw = localStorage.getItem(LISTING_PUBLISH_GATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListingPublishGateRecords(records: ListingPublishGateRecord[]): void {
  localStorage.setItem(LISTING_PUBLISH_GATE_STORAGE_KEY, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LISTING_PUBLISH_GATE_CHANGED_EVENT));
  }
}

export function evaluateListingPublishGate(
  draft: ListingPreparationDraft,
  item: CentralInventoryItem | undefined,
  input: ListingPublishGateInput
): ListingPublishGateEvaluation {
  const missingOrInvalidFieldsJa: string[] = [];
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  const draftReadiness = evaluateListingDraftReadiness(draft, item);
  blockingReasonsJa.push(...draftReadiness.blockingReasonsJa);

  if (draft.status !== 'READY_FOR_FINAL_REVIEW' || !draftReadiness.canAdvanceToFinalReview) {
    blockingReasonsJa.push('出品下書きが「最終確認待ち」の安全条件を満たしていません。');
  }

  if (!normalizeText(input.targetMarketplace)) {
    missingOrInvalidFieldsJa.push('対象マーケットが未入力です。国・地域を明確にしてください。');
  }

  if (!input.sellerAccountVerified) {
    missingOrInvalidFieldsJa.push('販売アカウントの実在・対象ショップ確認が未完了です。');
  }
  if (!normalizeText(input.sellerAccountVerificationNote)) {
    missingOrInvalidFieldsJa.push('販売アカウントをどのように確認したか記録してください。');
  }

  if (!input.marketplaceRulesVerified) {
    missingOrInvalidFieldsJa.push('Marketplace最新ルールの確認が未完了です。');
  }
  if (!isHttpsUrl(normalizeText(input.marketplaceRulesSourceUrl))) {
    missingOrInvalidFieldsJa.push('Marketplaceルールの確認元はHTTPSのURLで記録してください。');
  }
  if (!isValidDateTime(input.marketplaceRulesCheckedAt)) {
    missingOrInvalidFieldsJa.push('Marketplaceルールの確認日時が未入力または不正です。');
  }

  if (!input.finalApproved) {
    missingOrInvalidFieldsJa.push('最終承認が未完了です。');
  }
  if (!normalizeText(input.approvedBy)) {
    missingOrInvalidFieldsJa.push('最終承認者の識別名・IDが未入力です。');
  }
  if (!normalizeText(input.approvalNote)) {
    missingOrInvalidFieldsJa.push('最終承認理由・確認内容を記録してください。');
  }

  if (draft.targetChannel === 'Shopee') {
    warningsJa.push('ShopeeはマーケットごとにSeller Centreとルールが分かれます。対象国・地域と確認元URLが一致しているか確認してください。');
  }

  warningsJa.push('このゲートは公開可能な内部状態を作るだけで、eBay・Shopeeへの出品API実行は行いません。');
  warningsJa.push('実際の公開操作時にも、在庫・重複出品・最新ルールを再確認する必要があります。');

  return {
    canRecordApproval: missingOrInvalidFieldsJa.length === 0 && blockingReasonsJa.length === 0,
    missingOrInvalidFieldsJa,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function recordListingPublishApproval(
  draft: ListingPreparationDraft,
  item: CentralInventoryItem | undefined,
  input: ListingPublishGateInput,
  records: ListingPublishGateRecord[] = loadListingPublishGateRecords()
): ListingPublishGateResult {
  const evaluation = evaluateListingPublishGate(draft, item, input);
  if (!evaluation.canRecordApproval || !item || !draft.sellerAccountId) {
    return {
      success: false,
      evaluation,
      messageJa: '未確認項目または安全上の停止理由があるため、公開可能状態にはしていません。'
    };
  }

  const now = new Date().toISOString();
  const record: ListingPublishGateRecord = {
    recordId: `publish_gate_${draft.draftId}_${Date.now()}`,
    draftId: draft.draftId,
    sku: draft.sku,
    targetChannel: draft.targetChannel,
    targetMarketplace: normalizeText(input.targetMarketplace),
    sellerAccountIdAtApproval: draft.sellerAccountId,
    sellerAccountVerificationNote: normalizeText(input.sellerAccountVerificationNote),
    sellerAccountVerifiedAt: now,
    marketplaceRulesSourceUrl: normalizeText(input.marketplaceRulesSourceUrl),
    marketplaceRulesCheckedAt: new Date(input.marketplaceRulesCheckedAt).toISOString(),
    marketplaceRulesNote: normalizeText(input.marketplaceRulesNote),
    approvedBy: normalizeText(input.approvedBy),
    approvalNote: normalizeText(input.approvalNote),
    approvedAt: now,
    draftUpdatedAtAtApproval: draft.updatedAt,
    availableToSellAtApproval: item.availableToSell,
    status: 'READY_FOR_PUBLISH_ACTION'
  };

  const nextRecords = records.filter((existing) => existing.draftId !== draft.draftId);
  nextRecords.push(record);
  saveListingPublishGateRecords(nextRecords);

  return {
    success: true,
    record,
    evaluation,
    messageJa: '最終確認記録を保存し、「公開操作へ進める状態」にしました。外部公開はまだ行っていません。'
  };
}

export function evaluateStoredPublishReadiness(
  record: ListingPublishGateRecord,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined
): StoredPublishReadiness {
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  if (!draft) {
    blockingReasonsJa.push('対応する出品下書きが見つかりません。');
  } else {
    if (draft.status !== 'READY_FOR_FINAL_REVIEW') {
      blockingReasonsJa.push('出品下書きが最終確認待ち状態ではありません。');
    }
    if (draft.updatedAt !== record.draftUpdatedAtAtApproval) {
      blockingReasonsJa.push('最終承認後に出品下書きが変更されています。再承認が必要です。');
    }
    if ((draft.sellerAccountId ?? '') !== record.sellerAccountIdAtApproval) {
      blockingReasonsJa.push('承認時と販売アカウントが変わっています。再承認が必要です。');
    }

    const draftReadiness = evaluateListingDraftReadiness(draft, item);
    blockingReasonsJa.push(...draftReadiness.blockingReasonsJa);
    if (!draftReadiness.canAdvanceToFinalReview) {
      blockingReasonsJa.push('現在の在庫・下書き状態が公開前の安全条件を満たしていません。');
    }
  }

  if (item && item.availableToSell !== record.availableToSellAtApproval) {
    warningsJa.push(`承認時の販売可能在庫 ${record.availableToSellAtApproval} 件から現在 ${item.availableToSell} 件へ変化しています。公開操作時に数量を再確認してください。`);
  }

  warningsJa.push('「公開操作へ進める状態」は実際の出品完了を意味しません。');

  return {
    readyForPublishAction: blockingReasonsJa.length === 0,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}
