import { CentralInventoryItem } from '../../types/centralInventory';
import {
  createListingPreparationDraft,
  loadListingPreparationDrafts
} from '../listingPreparationService';
import {
  evaluateListingDraftReadiness,
  updateListingDraftReview
} from '../listingDraftReviewService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

const STORAGE_KEY = 'jp_listing_preparation_drafts_v1';

function makeItem(overrides: Partial<CentralInventoryItem> = {}): CentralInventoryItem {
  return {
    sku: overrides.sku ?? 'SKU-REVIEW-001',
    itemTitle: overrides.itemTitle ?? 'Review Test Item',
    physicalStock: overrides.physicalStock ?? 2,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 2,
    safetyBuffer: overrides.safetyBuffer ?? 0,
    unitCostJpy: overrides.unitCostJpy ?? 1500,
    weightGrams: overrides.weightGrams ?? 100,
    dimensionsCm: overrides.dimensionsCm ?? { length: 10, width: 8, height: 4 },
    category: overrides.category ?? 'Test',
    channelBindings: overrides.channelBindings ?? [],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false
  };
}

export function runListingDraftReviewTests(): { passed: number; failed: number; log: string[] } {
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

  localStorage.removeItem(STORAGE_KEY);
  const item = makeItem();
  const create = createListingPreparationDraft(item, 'eBay', []);
  const draft = create.draft!;

  const initial = evaluateListingDraftReadiness(draft, item);
  assert(!initial.canAdvanceToFinalReview && initial.missingOrInvalidFieldsJa.length >= 6, 'Test 1: New preparation draft is incomplete and cannot advance');

  const beforeInventory = JSON.stringify(item);
  const complete = updateListingDraftReview(
    draft.draftId,
    {
      sellerAccountId: '  ebay-main  ',
      listingTitle: '  Test Listing Title  ',
      listingDescription: '  Accurate item description.  ',
      priceAmount: 49.99,
      priceCurrency: ' usd ',
      shippingTerms: '  Confirmed shipping policy  '
    },
    item,
    loadListingPreparationDrafts()
  );
  assert(complete.success && complete.draft?.status === 'READY_FOR_FINAL_REVIEW', 'Test 2: Complete safe draft advances to final review');
  assert(complete.draft?.priceCurrency === 'USD' && complete.draft?.sellerAccountId === 'ebay-main', 'Test 3: Currency and text fields are normalized');
  assert(JSON.stringify(item) === beforeInventory, 'Test 4: Reviewing a listing draft does not mutate central inventory');

  const changedQtyItem = makeItem({ availableToSell: 1, physicalStock: 1 });
  const changedQtyReadiness = evaluateListingDraftReadiness(complete.draft!, changedQtyItem);
  assert(changedQtyReadiness.canAdvanceToFinalReview && changedQtyReadiness.warningsJa.some((warning) => warning.includes('変化')), 'Test 5: Stock quantity changes produce a warning without guessing a failure when stock remains sellable');

  const zeroStockItem = makeItem({ physicalStock: 0, availableToSell: 0 });
  const zeroStockReadiness = evaluateListingDraftReadiness(complete.draft!, zeroStockItem);
  assert(!zeroStockReadiness.canAdvanceToFinalReview && zeroStockReadiness.blockingReasonsJa.some((reason) => reason.includes('販売可能在庫が0')), 'Test 6: Zero sellable stock blocks final review readiness');

  const duplicateChannelItem = makeItem({
    channelBindings: [{
      channel: 'eBay',
      sellerAccountId: 'existing-account',
      channelListingId: 'existing-listing',
      syncedStock: 2,
      syncStatus: 'SYNCED',
      lastSyncedAt: '2026-09-07T00:00:00.000Z',
      isAutoSyncEnabled: true
    }]
  });
  const duplicateReadiness = evaluateListingDraftReadiness(complete.draft!, duplicateChannelItem);
  assert(!duplicateReadiness.canAdvanceToFinalReview && duplicateReadiness.blockingReasonsJa.some((reason) => reason.includes('重複出品防止')), 'Test 7: A newly discovered same-channel listing blocks duplicate publication preparation');

  const syncFailedItem = makeItem({
    channelBindings: [{
      channel: 'Shopify',
      sellerAccountId: 'shopify-account',
      channelListingId: 'shopify-listing',
      syncedStock: 2,
      syncStatus: 'FAILED',
      lastSyncedAt: '2026-09-07T00:00:00.000Z',
      isAutoSyncEnabled: true
    }]
  });
  const syncReadiness = evaluateListingDraftReadiness(complete.draft!, syncFailedItem);
  assert(!syncReadiness.canAdvanceToFinalReview && syncReadiness.blockingReasonsJa.some((reason) => reason.includes('在庫同期')), 'Test 8: Existing channel sync failure blocks advancement');

  const invalid = updateListingDraftReview(
    draft.draftId,
    {
      sellerAccountId: 'ebay-main',
      listingTitle: 'Test Listing Title',
      listingDescription: 'Description',
      priceAmount: 0,
      priceCurrency: 'US',
      shippingTerms: 'Shipping policy'
    },
    item,
    loadListingPreparationDrafts()
  );
  assert(invalid.success && invalid.draft?.status === 'DRAFT_REVIEW_REQUIRED', 'Test 9: Invalid commercial fields move a previously ready draft back to review-required');
  assert(invalid.readiness.missingOrInvalidFieldsJa.some((issue) => issue.includes('販売価格')) && invalid.readiness.missingOrInvalidFieldsJa.some((issue) => issue.includes('通貨コード')), 'Test 10: Invalid price and currency are explained explicitly');

  const missingItemReadiness = evaluateListingDraftReadiness(complete.draft!, undefined);
  assert(!missingItemReadiness.canAdvanceToFinalReview && missingItemReadiness.blockingReasonsJa.some((reason) => reason.includes('中央在庫SKU')), 'Test 11: Missing central inventory blocks advancement');

  localStorage.removeItem(STORAGE_KEY);
  return { passed, failed, log };
}
