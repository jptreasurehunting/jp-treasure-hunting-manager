import { CentralInventoryItem } from '../../types/centralInventory';
import {
  createListingPreparationDraft,
  ListingPreparationDraft,
  loadListingPreparationDrafts
} from '../listingPreparationService';
import { updateListingDraftReview } from '../listingDraftReviewService';
import {
  evaluateListingPublishGate,
  evaluateStoredPublishReadiness,
  loadListingPublishGateRecords,
  recordListingPublishApproval
} from '../listingPublishGateService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

const DRAFT_STORAGE_KEY = 'jp_listing_preparation_drafts_v1';
const GATE_STORAGE_KEY = 'jp_listing_publish_gate_records_v1';

function makeItem(overrides: Partial<CentralInventoryItem> = {}): CentralInventoryItem {
  return {
    sku: overrides.sku ?? 'SKU-PUBLISH-001',
    itemTitle: overrides.itemTitle ?? 'Publish Gate Test Item',
    physicalStock: overrides.physicalStock ?? 2,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 2,
    safetyBuffer: overrides.safetyBuffer ?? 0,
    unitCostJpy: overrides.unitCostJpy ?? 2000,
    weightGrams: overrides.weightGrams ?? 120,
    dimensionsCm: overrides.dimensionsCm ?? { length: 12, width: 9, height: 4 },
    category: overrides.category ?? 'Test',
    channelBindings: overrides.channelBindings ?? [],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false
  };
}

function makeReadyDraft(item: CentralInventoryItem, channel: 'eBay' | 'Shopee'): ListingPreparationDraft {
  const created = createListingPreparationDraft(item, channel, loadListingPreparationDrafts());
  const draft = created.draft!;
  const reviewed = updateListingDraftReview(
    draft.draftId,
    {
      sellerAccountId: `${channel.toLowerCase()}-main`,
      listingTitle: 'Accurate Test Listing',
      listingDescription: 'Accurate test description.',
      priceAmount: 39.99,
      priceCurrency: 'USD',
      shippingTerms: 'Confirmed shipping policy'
    },
    item,
    loadListingPreparationDrafts()
  );
  return reviewed.draft!;
}

export function runListingPublishGateTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) {
      passed += 1;
      log.push(`✅ [PASS] ${name}`);
    } else {
      failed += 1;
      log.push(`❌ [FAIL] ${name}`);
    }
  };

  localStorage.removeItem(DRAFT_STORAGE_KEY);
  localStorage.removeItem(GATE_STORAGE_KEY);

  const item = makeItem();
  const readyDraft = makeReadyDraft(item, 'eBay');
  assert(readyDraft.status === 'READY_FOR_FINAL_REVIEW', 'Test 1: Test fixture reaches final-review-ready state before publish gate');

  const incomplete = evaluateListingPublishGate(readyDraft, item, {
    targetMarketplace: '',
    sellerAccountVerified: false,
    sellerAccountVerificationNote: '',
    marketplaceRulesVerified: false,
    marketplaceRulesSourceUrl: '',
    marketplaceRulesCheckedAt: '',
    marketplaceRulesNote: '',
    finalApproved: false,
    approvedBy: '',
    approvalNote: ''
  });
  assert(!incomplete.canRecordApproval && incomplete.missingOrInvalidFieldsJa.length >= 7, 'Test 2: Missing verification evidence blocks final approval');

  const beforeInventory = JSON.stringify(item);
  const approved = recordListingPublishApproval(readyDraft, item, {
    targetMarketplace: 'eBay US',
    sellerAccountVerified: true,
    sellerAccountVerificationNote: 'Signed in and confirmed the intended seller account.',
    marketplaceRulesVerified: true,
    marketplaceRulesSourceUrl: 'https://www.ebay.com/help/policies/default/ebays-rules-policies?id=4205',
    marketplaceRulesCheckedAt: '2026-09-07T12:00:00.000Z',
    marketplaceRulesNote: 'Official policy source reviewed for this listing.',
    finalApproved: true,
    approvedBy: 'owner',
    approvalNote: 'Inventory, account, listing content and policy source checked.'
  });
  assert(approved.success && approved.record?.status === 'READY_FOR_PUBLISH_ACTION', 'Test 3: Complete safe evidence records publish-action-ready approval');
  assert(loadListingPublishGateRecords().length === 1, 'Test 4: Final approval record persists separately from listing draft');
  assert(JSON.stringify(item) === beforeInventory, 'Test 5: Final approval does not mutate central inventory');

  const storedReady = evaluateStoredPublishReadiness(approved.record!, readyDraft, item);
  assert(storedReady.readyForPublishAction, 'Test 6: Stored approval remains ready when draft and inventory are unchanged');

  const modifiedDraft: ListingPreparationDraft = {
    ...readyDraft,
    listingTitle: 'Changed after approval',
    updatedAt: '2026-09-07T13:00:00.000Z'
  };
  const staleDraft = evaluateStoredPublishReadiness(approved.record!, modifiedDraft, item);
  assert(!staleDraft.readyForPublishAction && staleDraft.blockingReasonsJa.some((reason) => reason.includes('再承認')), 'Test 7: Draft change after approval invalidates stored readiness');

  const zeroStock = makeItem({ physicalStock: 0, availableToSell: 0 });
  const staleInventory = evaluateStoredPublishReadiness(approved.record!, readyDraft, zeroStock);
  assert(!staleInventory.readyForPublishAction && staleInventory.blockingReasonsJa.some((reason) => reason.includes('在庫')), 'Test 8: Inventory becoming unsellable invalidates stored readiness');

  const invalidUrl = evaluateListingPublishGate(readyDraft, item, {
    targetMarketplace: 'eBay US',
    sellerAccountVerified: true,
    sellerAccountVerificationNote: 'Account checked.',
    marketplaceRulesVerified: true,
    marketplaceRulesSourceUrl: 'http://example.com/rules',
    marketplaceRulesCheckedAt: '2026-09-07T12:00:00.000Z',
    marketplaceRulesNote: '',
    finalApproved: true,
    approvedBy: 'owner',
    approvalNote: 'Checked.'
  });
  assert(!invalidUrl.canRecordApproval && invalidUrl.missingOrInvalidFieldsJa.some((issue) => issue.includes('HTTPS')), 'Test 9: Non-HTTPS rule evidence is rejected');

  localStorage.removeItem(DRAFT_STORAGE_KEY);
  localStorage.removeItem(GATE_STORAGE_KEY);
  const shopeeItem = makeItem({ sku: 'SKU-SHOPEE-001', itemTitle: 'Shopee Test Item' });
  const shopeeDraft = makeReadyDraft(shopeeItem, 'Shopee');
  const shopeeEvaluation = evaluateListingPublishGate(shopeeDraft, shopeeItem, {
    targetMarketplace: 'Singapore',
    sellerAccountVerified: true,
    sellerAccountVerificationNote: 'Shopee Seller Centre shop confirmed.',
    marketplaceRulesVerified: true,
    marketplaceRulesSourceUrl: 'https://seller.shopee.sg/',
    marketplaceRulesCheckedAt: '2026-09-07T12:00:00.000Z',
    marketplaceRulesNote: 'Correct market Seller Centre checked.',
    finalApproved: true,
    approvedBy: 'owner',
    approvalNote: 'Market and shop confirmed.'
  });
  assert(shopeeEvaluation.canRecordApproval && shopeeEvaluation.warningsJa.some((warning) => warning.includes('マーケットごと')), 'Test 10: Shopee approval explicitly warns that Seller Centre and rules are market-specific');

  const notFinalReviewDraft: ListingPreparationDraft = { ...shopeeDraft, status: 'DRAFT_REVIEW_REQUIRED' };
  const blockedByDraftStatus = evaluateListingPublishGate(notFinalReviewDraft, shopeeItem, {
    targetMarketplace: 'Singapore',
    sellerAccountVerified: true,
    sellerAccountVerificationNote: 'Account checked.',
    marketplaceRulesVerified: true,
    marketplaceRulesSourceUrl: 'https://seller.shopee.sg/',
    marketplaceRulesCheckedAt: '2026-09-07T12:00:00.000Z',
    marketplaceRulesNote: '',
    finalApproved: true,
    approvedBy: 'owner',
    approvalNote: 'Checked.'
  });
  assert(!blockedByDraftStatus.canRecordApproval && blockedByDraftStatus.blockingReasonsJa.some((reason) => reason.includes('最終確認待ち')), 'Test 11: Drafts not ready for final review cannot pass the publish gate');

  localStorage.removeItem(DRAFT_STORAGE_KEY);
  localStorage.removeItem(GATE_STORAGE_KEY);
  return { passed, failed, log };
}
