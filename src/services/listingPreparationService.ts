import { CentralInventoryItem } from '../types/centralInventory';
import { SalesChannel } from '../types/shippingRouter';

const LISTING_PREPARATION_STORAGE_KEY = 'jp_listing_preparation_drafts_v1';
export const LISTING_DRAFTS_CHANGED_EVENT = 'jp-listing-drafts-changed';

export const MVP_LISTING_CHANNELS: SalesChannel[] = ['eBay', 'Shopee'];

export type ListingPreparationDraftStatus =
  | 'DRAFT_REVIEW_REQUIRED'
  | 'READY_FOR_FINAL_REVIEW';

export interface ListingPreparationDraft {
  draftId: string;
  sku: string;
  itemTitle: string;
  targetChannel: SalesChannel;
  sellerAccountId?: string;
  listingTitle?: string;
  listingDescription?: string;
  priceAmount?: number;
  priceCurrency?: string;
  shippingTerms?: string;
  status: ListingPreparationDraftStatus;
  availableToSellAtCreation: number;
  unitCostJpyAtCreation: number;
  createdAt: string;
  updatedAt: string;
  source: 'INVENTORY_SALES_WORKBENCH';
}

export interface ListingPreparationEligibility {
  sku: string;
  itemTitle: string;
  existingChannels: SalesChannel[];
  availableTargetChannels: SalesChannel[];
  blockedReasonsJa: string[];
  warningsJa: string[];
  canPrepareAny: boolean;
}

export interface ListingPreparationCandidate {
  sku: string;
  itemTitle: string;
  availableToSell: number;
  unitCostJpy: number;
  tiedCostJpy: number;
  existingChannels: SalesChannel[];
  availableTargetChannels: SalesChannel[];
  pendingDraftChannels: SalesChannel[];
  blockedReasonsJa: string[];
  warningsJa: string[];
}

export interface CreateListingPreparationDraftResult {
  success: boolean;
  draft?: ListingPreparationDraft;
  messageJa: string;
}

export function loadListingPreparationDrafts(): ListingPreparationDraft[] {
  try {
    const raw = localStorage.getItem(LISTING_PREPARATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListingPreparationDrafts(drafts: ListingPreparationDraft[]): void {
  localStorage.setItem(LISTING_PREPARATION_STORAGE_KEY, JSON.stringify(drafts));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LISTING_DRAFTS_CHANGED_EVENT));
  }
}

function getExistingChannels(item: CentralInventoryItem): SalesChannel[] {
  return Array.from(new Set(item.channelBindings.map((binding) => binding.channel)));
}

function hasBlockingSyncIssue(item: CentralInventoryItem): boolean {
  return item.channelBindings.some(
    (binding) => binding.syncStatus === 'PENDING' || binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK'
  );
}

export function evaluateListingPreparation(
  item: CentralInventoryItem,
  drafts: ListingPreparationDraft[] = loadListingPreparationDrafts()
): ListingPreparationEligibility {
  const blockedReasonsJa: string[] = [];
  const warningsJa: string[] = [];
  const existingChannels = getExistingChannels(item);
  const pendingDraftChannels = new Set(
    drafts.filter((draft) => draft.sku === item.sku).map((draft) => draft.targetChannel)
  );

  if (item.availableToSell <= 0) {
    blockedReasonsJa.push('販売可能在庫が0のため、出品準備を開始できません。');
  }

  if (item.isLockedForOversellingRisk) {
    blockedReasonsJa.push('二重販売リスクで在庫がロックされています。');
  }

  if (hasBlockingSyncIssue(item)) {
    blockedReasonsJa.push('既存販売チャネルの在庫同期が未完了または要確認です。外部販売先への反映成功を確認してから出品準備を開始してください。');
  }

  const availableTargetChannels = MVP_LISTING_CHANNELS.filter(
    (channel) => !existingChannels.includes(channel) && !pendingDraftChannels.has(channel)
  );

  if (existingChannels.length > 0) {
    warningsJa.push(`既存出品あり: ${existingChannels.join(', ')}。同じ販売先への重複下書きは作成しません。`);
  } else {
    warningsJa.push('販売チャネルへの紐付けがない未出品在庫です。');
  }

  if (pendingDraftChannels.size > 0) {
    warningsJa.push(`準備中の下書きあり: ${Array.from(pendingDraftChannels).join(', ')}。`);
  }

  if (availableTargetChannels.length === 0 && blockedReasonsJa.length === 0) {
    warningsJa.push('現在のMVP対象販売先（eBay / Shopee）には追加の出品準備候補がありません。');
  }

  return {
    sku: item.sku,
    itemTitle: item.itemTitle,
    existingChannels,
    availableTargetChannels: blockedReasonsJa.length > 0 ? [] : availableTargetChannels,
    blockedReasonsJa,
    warningsJa,
    canPrepareAny: blockedReasonsJa.length === 0 && availableTargetChannels.length > 0
  };
}

export function createListingPreparationDraft(
  item: CentralInventoryItem,
  targetChannel: SalesChannel,
  drafts: ListingPreparationDraft[] = loadListingPreparationDrafts()
): CreateListingPreparationDraftResult {
  if (!MVP_LISTING_CHANNELS.includes(targetChannel)) {
    return {
      success: false,
      messageJa: `現在のMVPでは ${targetChannel} の出品準備下書き作成には対応していません。`
    };
  }

  const eligibility = evaluateListingPreparation(item, drafts);
  if (!eligibility.availableTargetChannels.includes(targetChannel)) {
    const existing = eligibility.existingChannels.includes(targetChannel);
    const pending = drafts.some((draft) => draft.sku === item.sku && draft.targetChannel === targetChannel);

    if (existing) {
      return {
        success: false,
        messageJa: `${targetChannel} には既存出品の紐付けがあります。重複出品防止のため下書きを作成しません。`
      };
    }

    if (pending) {
      return {
        success: false,
        messageJa: `${targetChannel} 向けの出品準備下書きはすでに存在します。`
      };
    }

    return {
      success: false,
      messageJa: eligibility.blockedReasonsJa.join(' ') || 'この在庫は現在、出品準備を開始できません。'
    };
  }

  const now = new Date().toISOString();
  const draft: ListingPreparationDraft = {
    draftId: `listing_draft_${item.sku}_${targetChannel}_${Date.now()}`,
    sku: item.sku,
    itemTitle: item.itemTitle,
    targetChannel,
    status: 'DRAFT_REVIEW_REQUIRED',
    availableToSellAtCreation: item.availableToSell,
    unitCostJpyAtCreation: item.unitCostJpy,
    createdAt: now,
    updatedAt: now,
    source: 'INVENTORY_SALES_WORKBENCH'
  };

  saveListingPreparationDrafts([...drafts, draft]);

  return {
    success: true,
    draft,
    messageJa: `${targetChannel} 向けの出品準備下書きを作成しました。外部販売サイトへの公開は行っていません。`
  };
}

export function buildListingPreparationCandidates(
  items: CentralInventoryItem[],
  drafts: ListingPreparationDraft[] = loadListingPreparationDrafts()
): ListingPreparationCandidate[] {
  return items
    .map((item) => {
      const eligibility = evaluateListingPreparation(item, drafts);
      const pendingDraftChannels = drafts
        .filter((draft) => draft.sku === item.sku)
        .map((draft) => draft.targetChannel);

      return {
        sku: item.sku,
        itemTitle: item.itemTitle,
        availableToSell: item.availableToSell,
        unitCostJpy: item.unitCostJpy,
        tiedCostJpy: Math.max(0, item.availableToSell) * Math.max(0, item.unitCostJpy),
        existingChannels: eligibility.existingChannels,
        availableTargetChannels: eligibility.availableTargetChannels,
        pendingDraftChannels,
        blockedReasonsJa: eligibility.blockedReasonsJa,
        warningsJa: eligibility.warningsJa
      };
    })
    .filter((candidate) => candidate.availableTargetChannels.length > 0 || candidate.pendingDraftChannels.length > 0)
    .sort((a, b) => {
      const aUnlisted = a.existingChannels.length === 0 ? 0 : 1;
      const bUnlisted = b.existingChannels.length === 0 ? 0 : 1;
      if (aUnlisted !== bUnlisted) return aUnlisted - bUnlisted;
      const tiedCostDifference = b.tiedCostJpy - a.tiedCostJpy;
      if (tiedCostDifference !== 0) return tiedCostDifference;
      return a.sku.localeCompare(b.sku);
    });
}
