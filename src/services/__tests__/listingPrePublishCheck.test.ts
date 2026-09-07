import { CentralInventoryItem } from '../../types/centralInventory';
import { createListingPreparationDraft, loadListingPreparationDrafts } from '../listingPreparationService';
import { updateListingDraftReview } from '../listingDraftReviewService';
import {
  loadListingPublishGateRecords,
  recordListingPublishApproval
} from '../listingPublishGateService';
import {
  evaluateListingPrePublishCheck,
  isStoredPrePublishCheckStillValid,
  loadListingPrePublishChecks,
  recordListingPrePublishCheck
} from '../listingPrePublishCheckService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makeItem(overrides: Partial<CentralInventoryItem> = {}): CentralInventoryItem {
  return {
    sku: overrides.sku ?? 'SKU-PRE-PUBLISH-001',
    itemTitle: overrides.itemTitle ?? 'Pre Publish Test Item',
    physicalStock: overrides.physicalStock ?? 3,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 3,
    safetyBuffer: overrides.safetyBuffer ?? 0,
    unitCostJpy: overrides.unitCostJpy ?? 2000,
    weightGrams: overrides.weightGrams ?? 100,
    dimensionsCm: overrides.dimensionsCm ?? { length: 10, width: 8, height: 4 },
    category: overrides.category ?? 'Test',
    channelBindings: overrides.channelBindings ?? [],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false
  };
}

export function runListingPrePublishCheckTests(): { passed: number; failed: number; log: string[] } {
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

  localStorage.clear();
  const item = makeItem();
  const created = createListingPreparationDraft(item, 'eBay', []);
  const draft = created.draft!;
  const reviewed = updateListingDraftReview(
    draft.draftId,
    {
      sellerAccountId: 'ebay-main',
      listingTitle: 'Accurate Listing Title',
      listingDescription: 'Accurate item description.',
      priceAmount: 59.99,
      priceCurrency: 'USD',
      shippingTerms: 'Confirmed shipping terms'
    },
    item,
    loadListingPreparationDrafts()
  );
  const readyDraft = reviewed.draft!;
  const approval = recordListingPublishApproval(
    readyDraft,
    item,
    {
      targetMarketplace: 'eBay US',
      sellerAccountVerified: true,
      sellerAccountVerificationNote: 'Seller Hub account checked',
      marketplaceRulesVerified: true,
      marketplaceRulesSourceUrl: 'https://www.ebay.com/help/selling',
      marketplaceRulesCheckedAt: '2026-09-07T12:00:00Z',
      marketplaceRulesNote: 'Current rules checked',
      finalApproved: true,
      approvedBy: 'owner',
      approvalNote: 'Final review complete'
    },
    loadListingPublishGateRecords()
  );
  const gateRecord = approval.record!;

  const completeInput = {
    publishQuantity: 2,
    inventoryReconfirmed: true,
    duplicateListingReconfirmed: true,
    listingContentReconfirmed: true,
    sellerAccountReconfirmed: true,
    marketplaceRulesReconfirmed: true,
    marketplaceRulesRecheckSourceUrl: 'https://www.ebay.com/help/selling',
    marketplaceRulesRecheckedAt: '2026-09-07T12:30:00Z',
    checkedBy: 'owner',
    checkNote: 'Pre-publish checks completed'
  };

  const evaluation = evaluateListingPrePublishCheck(gateRecord, readyDraft, item, completeInput);
  assert(evaluation.canPreparePublishExecution, 'Test 1: Fully reconfirmed safe listing can prepare publish execution');

  const missingConfirmations = evaluateListingPrePublishCheck(gateRecord, readyDraft, item, {
    ...completeInput,
    inventoryReconfirmed: false,
    marketplaceRulesReconfirmed: false
  });
  assert(!missingConfirmations.canPreparePublishExecution && missingConfirmations.missingOrInvalidFieldsJa.length >= 2, 'Test 2: Missing final confirmations block pre-publish pass');

  const excessiveQuantity = evaluateListingPrePublishCheck(gateRecord, readyDraft, item, {
    ...completeInput,
    publishQuantity: 4
  });
  assert(!excessiveQuantity.canPreparePublishExecution && excessiveQuantity.blockingReasonsJa.some((reason) => reason.includes('超えています')), 'Test 3: Publish quantity above available inventory is blocked');

  const nonIntegerQuantity = evaluateListingPrePublishCheck(gateRecord, readyDraft, item, {
    ...completeInput,
    publishQuantity: 1.5
  });
  assert(!nonIntegerQuantity.canPreparePublishExecution && nonIntegerQuantity.missingOrInvalidFieldsJa.some((reason) => reason.includes('整数')), 'Test 4: Publish quantity must be a positive integer');

  const badUrl = evaluateListingPrePublishCheck(gateRecord, readyDraft, item, {
    ...completeInput,
    marketplaceRulesRecheckSourceUrl: 'http://example.com/rules'
  });
  assert(!badUrl.canPreparePublishExecution && badUrl.missingOrInvalidFieldsJa.some((reason) => reason.includes('HTTPS')), 'Test 5: Rule recheck source requires HTTPS');

  const recordResult = recordListingPrePublishCheck(
    gateRecord,
    readyDraft,
    item,
    completeInput,
    loadListingPrePublishChecks()
  );
  assert(recordResult.success && recordResult.record?.status === 'PRE_PUBLISH_CHECK_PASSED', 'Test 6: Passing check is stored without publishing externally');
  assert(recordResult.record?.publishQuantity === 2 && recordResult.record?.sellerAccountId === 'ebay-main', 'Test 7: Stored check snapshots publish quantity and approved seller account');

  const stored = recordResult.record!;
  const validStored = isStoredPrePublishCheckStillValid(stored, gateRecord, readyDraft, item);
  assert(validStored.valid, 'Test 8: Stored pre-publish check remains valid while draft and inventory stay safe');

  const stockDropped = makeItem({ physicalStock: 1, availableToSell: 1 });
  const invalidAfterStockDrop = isStoredPrePublishCheckStillValid(stored, gateRecord, readyDraft, stockDropped);
  assert(!invalidAfterStockDrop.valid && invalidAfterStockDrop.reasonsJa.some((reason) => reason.includes('下回っています')), 'Test 9: Stored check invalidates when stock drops below planned publish quantity');

  const duplicateItem = makeItem({
    channelBindings: [{
      channel: 'eBay',
      sellerAccountId: 'ebay-main',
      channelListingId: 'existing-listing',
      syncedStock: 1,
      syncStatus: 'SYNCED',
      lastSyncedAt: '2026-09-07T12:40:00Z',
      isAutoSyncEnabled: true
    }]
  });
  const duplicateEvaluation = evaluateListingPrePublishCheck(gateRecord, readyDraft, duplicateItem, completeInput);
  assert(!duplicateEvaluation.canPreparePublishExecution && duplicateEvaluation.blockingReasonsJa.some((reason) => reason.includes('重複')), 'Test 10: Newly discovered same-channel listing blocks pre-publish execution');

  const editedDraft = { ...readyDraft, updatedAt: '2026-09-07T13:00:00.000Z', listingTitle: 'Changed after approval' };
  const editedDraftEvaluation = evaluateListingPrePublishCheck(gateRecord, editedDraft, item, completeInput);
  assert(!editedDraftEvaluation.canPreparePublishExecution && editedDraftEvaluation.blockingReasonsJa.some((reason) => reason.includes('最終承認後')), 'Test 11: Draft edits after final approval require reapproval');

  const changedGate = { ...gateRecord, recordId: 'replacement-gate-record' };
  const staleGateCheck = isStoredPrePublishCheckStillValid(stored, changedGate, readyDraft, item);
  assert(!staleGateCheck.valid && staleGateCheck.reasonsJa.some((reason) => reason.includes('最終承認記録')), 'Test 12: Replaced final approval invalidates stored pre-publish check');

  localStorage.clear();
  return { passed, failed, log };
}
