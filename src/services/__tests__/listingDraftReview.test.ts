import { CentralInventoryItem } from '../../types/centralInventory';
import {
  createListingPreparationDraft,
  loadListingPreparationDrafts
} from '../listingPreparationService';
import {
  evaluateListingDraftReadiness,
  updateListingDraftReview
} from '../listingDraftReviewService';
import {
  resolveDraftPhotoPreview,
  registerDryRunPhotoHandoff,
  clearDryRunPhotoHandoffs,
  getChannelPhotoConstraints
} from '../photoListingBridgeService';
import type { DryRunListingPhotoHandoff } from '../../types/photoCapture';

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
  const physicalStock = overrides.physicalStock ?? 2;
  const buyerAllocatedStock = overrides.buyerAllocatedStock ?? overrides.reservedStock ?? 0;
  const sellableStock = overrides.sellableStock ?? (overrides.availableToSell !== undefined ? overrides.availableToSell + buyerAllocatedStock : physicalStock);
  const availableToSell = overrides.availableToSell ?? Math.max(0, sellableStock - buyerAllocatedStock - (overrides.safetyBuffer ?? 0));

  return {
    sku: overrides.sku ?? 'SKU-REVIEW-001',
    itemTitle: overrides.itemTitle ?? 'Review Test Item',
    physicalStock,
    sellableStock,
    buyerAllocatedStock,
    inboundStock: overrides.inboundStock ?? 0,
    reservedStock: buyerAllocatedStock,
    availableToSell,
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

  // Photo Capture Listing Candidate Preview Tests (STEP 26)
  clearDryRunPhotoHandoffs();

  // Test 12: NO_PHOTOS_RECORDED when no handoff is registered
  const unlinkedPreview = resolveDraftPhotoPreview({ sku: 'SKU-UNLINKED-999', targetChannel: 'eBay' });
  assert(
    unlinkedPreview.status === 'NO_PHOTOS_RECORDED' && unlinkedPreview.canDisplayListingCandidate === false,
    'Test 12: resolveDraftPhotoPreview returns NO_PHOTOS_RECORDED for SKU without photo handoff'
  );

  // Sample Mock Dry Run Handoff
  const sampleHandoff: DryRunListingPhotoHandoff = {
    isDryRun: true,
    handoffId: 'test-handoff-001',
    sku: draft.sku,
    inventoryUnitId: 'UNIT-DRAFT-001',
    targetChannels: ['eBay', 'Shopee'],
    canPrepareDraft: true,
    reasonCode: 'READY_FOR_LISTING_DRAFT',
    reasonMessageJa: '撮影QA合格: 写真候補準備完了',
    heroPhoto: {
      photoId: 'photo-hero-01',
      angle: 'FRONT',
      originalDataUrl: 'data:image/jpeg;base64,RAW_FRONT_EVIDENCE',
      selectedListingUrl: 'data:image/jpeg;base64,ENHANCED_FRONT_LISTING',
      isAutoFixed: true,
      autoFixCount: 1,
      qaStatus: 'USE_AS_IS',
      isHeroImageCandidate: true
    },
    galleryPhotos: [
      {
        photoId: 'photo-hero-01',
        angle: 'FRONT',
        originalDataUrl: 'data:image/jpeg;base64,RAW_FRONT_EVIDENCE',
        selectedListingUrl: 'data:image/jpeg;base64,ENHANCED_FRONT_LISTING',
        isAutoFixed: true,
        autoFixCount: 1,
        qaStatus: 'USE_AS_IS',
        isHeroImageCandidate: true
      },
      {
        photoId: 'photo-back-01',
        angle: 'BACK',
        originalDataUrl: 'data:image/jpeg;base64,RAW_BACK_EVIDENCE',
        selectedListingUrl: 'data:image/jpeg;base64,RAW_BACK_EVIDENCE',
        isAutoFixed: false,
        autoFixCount: 0,
        qaStatus: 'USE_AS_IS',
        isHeroImageCandidate: false
      }
    ],
    totalPhotoCount: 2,
    evidencePreserved: true,
    nonPhotoGatesUntouched: true,
    overallListingEligible: false,
    inventoryGateStatus: {
      identityVerified: false,
      quantityVerified: false,
      conditionVerified: false,
      photoCaptureComplete: true,
      photoQaComplete: true,
      storageLocationRegistered: false
    },
    draftPhotoPayloadPreview: {
      sku: draft.sku,
      inventoryUnitId: 'UNIT-DRAFT-001',
      channelCandidates: ['eBay', 'Shopee'],
      primaryImageUrl: 'data:image/jpeg;base64,ENHANCED_FRONT_LISTING',
      additionalImageUrls: ['data:image/jpeg;base64,RAW_BACK_EVIDENCE'],
      totalImageCount: 2
    }
  };

  // Test 13: AVAILABLE_PREVIEW with valid handoff & hero photo candidate
  registerDryRunPhotoHandoff(sampleHandoff);
  const ebayPreview = resolveDraftPhotoPreview(draft);
  assert(
    ebayPreview.status === 'AVAILABLE_PREVIEW' && ebayPreview.canDisplayListingCandidate === true,
    'Test 13-a: resolveDraftPhotoPreview resolves AVAILABLE_PREVIEW for registered SKU'
  );
  assert(
    ebayPreview.heroPhotoCandidate !== null && ebayPreview.heroPhotoCandidate.angle === 'FRONT',
    'Test 13-b: Front view is designated as primary hero image candidate'
  );
  assert(
    ebayPreview.galleryPhotoCandidates.length === 2,
    'Test 13-c: Gallery photo candidates list includes all 2 photos'
  );

  // Test 14: Original raw evidence preservation without mutation
  assert(
    ebayPreview.heroPhotoCandidate?.originalDataUrl === 'data:image/jpeg;base64,RAW_FRONT_EVIDENCE' &&
    ebayPreview.heroPhotoCandidate?.selectedListingUrl === 'data:image/jpeg;base64,ENHANCED_FRONT_LISTING' &&
    ebayPreview.evidencePreserved === true,
    'Test 14: Original raw evidence is preserved and separated from enhanced listing URL'
  );

  // Test 15: Cross-SKU pollution detection & rejection
  const mismatchedHandoffPreview = resolveDraftPhotoPreview(
    { sku: 'SKU-DIFFERENT-MODEL', targetChannel: 'eBay' },
    sampleHandoff
  );
  assert(
    mismatchedHandoffPreview.status === 'HOLD_BLOCKED' &&
    mismatchedHandoffPreview.reasonCode === 'HOLD_CROSS_PRODUCT_POLLUTION' &&
    mismatchedHandoffPreview.canDisplayListingCandidate === false,
    'Test 15: Cross-SKU pollution between draft SKU and photo handoff SKU is rejected with HOLD'
  );

  // Test 16: HOLD status display when handoff is blocked
  const blockedHandoff: DryRunListingPhotoHandoff = {
    ...sampleHandoff,
    canPrepareDraft: false,
    reasonCode: 'HOLD_INSUFFICIENT_ANGLES',
    reasonMessageJa: '撮影不足: 必須4アングルが不足しています'
  };
  const blockedPreview = resolveDraftPhotoPreview(draft, blockedHandoff);
  assert(
    blockedPreview.status === 'HOLD_BLOCKED' &&
    blockedPreview.reasonCode === 'HOLD_INSUFFICIENT_ANGLES' &&
    blockedPreview.canDisplayListingCandidate === false,
    'Test 16: Blocked handoff preserves HOLD reason code and blocks candidate display'
  );

  // Test 17: Channel constraints customization (eBay vs Shopee) and non-guarantee disclaimers
  const ebayConstraints = getChannelPhotoConstraints('eBay');
  const shopeeConstraints = getChannelPhotoConstraints('Shopee');
  assert(
    ebayConstraints.maxImagesAllowed === 24 && (ebayConstraints.disclaimerJa.includes('保証するものではありません') || false),
    'Test 17-a: eBay photo constraints set to max 24 with explicit non-guarantee disclaimer'
  );
  assert(
    shopeeConstraints.maxImagesAllowed === 9 && (shopeeConstraints.aspectRatioGuideline.includes('正方形') || false),
    'Test 17-b: Shopee photo constraints set to max 9 with square ratio guideline'
  );

  // Test 18: In-memory registry isolation without localStorage mutation
  const initialStorageLength = Object.keys(localStorage).length;
  registerDryRunPhotoHandoff({ ...sampleHandoff, sku: 'SKU-EPHEMERAL-01' });
  clearDryRunPhotoHandoffs();
  assert(
    Object.keys(localStorage).length === initialStorageLength,
    'Test 18: In-memory registry operations do not mutate localStorage'
  );

  localStorage.removeItem(STORAGE_KEY);
  return { passed, failed, log };
}
