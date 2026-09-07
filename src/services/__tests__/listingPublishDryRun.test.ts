import { CentralInventoryItem } from '../../types/centralInventory';
import { createListingPreparationDraft, loadListingPreparationDrafts } from '../listingPreparationService';
import { updateListingDraftReview } from '../listingDraftReviewService';
import { loadListingPublishGateRecords, recordListingPublishApproval } from '../listingPublishGateService';
import { loadListingPrePublishChecks, recordListingPrePublishCheck } from '../listingPrePublishCheckService';
import {
  evaluateListingPublishDryRun,
  evaluateStoredListingPublishDryRun,
  generateListingPublishDryRun,
  loadListingPublishDryRuns
} from '../listingPublishDryRunService';

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
    sku: overrides.sku ?? 'SKU-DRYRUN-001',
    itemTitle: overrides.itemTitle ?? 'Dry Run Test Item',
    physicalStock: overrides.physicalStock ?? 3,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 3,
    safetyBuffer: overrides.safetyBuffer ?? 0,
    unitCostJpy: overrides.unitCostJpy ?? 1800,
    weightGrams: overrides.weightGrams ?? 120,
    dimensionsCm: overrides.dimensionsCm ?? { length: 12, width: 8, height: 5 },
    category: overrides.category ?? 'Test',
    channelBindings: overrides.channelBindings ?? [],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-08T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false
  };
}

export function runListingPublishDryRunTests(): { passed: number; failed: number; log: string[] } {
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
  const reviewed = updateListingDraftReview(
    created.draft!.draftId,
    {
      sellerAccountId: 'ebay-main',
      listingTitle: 'Dry Run Listing Title',
      listingDescription: 'Accurate description for dry run.',
      priceAmount: 39.99,
      priceCurrency: 'USD',
      shippingTerms: 'Confirmed shipping policy'
    },
    item,
    loadListingPreparationDrafts()
  );
  const draft = reviewed.draft!;

  const gate = recordListingPublishApproval(
    draft,
    item,
    {
      targetMarketplace: 'eBay US',
      sellerAccountVerified: true,
      sellerAccountVerificationNote: 'Seller Hub account confirmed.',
      marketplaceRulesVerified: true,
      marketplaceRulesSourceUrl: 'https://www.ebay.com/help/policies/default/ebays-rules-policies?id=4205',
      marketplaceRulesCheckedAt: '2026-09-08T00:30:00.000Z',
      marketplaceRulesNote: 'Current listing rules checked.',
      finalApproved: true,
      approvedBy: 'owner',
      approvalNote: 'Inventory and listing content reviewed.'
    },
    []
  );
  const gateRecord = gate.record!;

  const prePublish = recordListingPrePublishCheck(
    gateRecord,
    draft,
    item,
    {
      publishQuantity: 2,
      inventoryReconfirmed: true,
      duplicateListingReconfirmed: true,
      listingContentReconfirmed: true,
      sellerAccountReconfirmed: true,
      marketplaceRulesReconfirmed: true,
      marketplaceRulesRecheckSourceUrl: 'https://www.ebay.com/help/policies/default/ebays-rules-policies?id=4205',
      marketplaceRulesRecheckedAt: '2026-09-08T00:45:00.000Z',
      checkedBy: 'owner',
      checkNote: 'Pre-publish safety check completed.'
    },
    []
  );
  const check = prePublish.record!;

  const evaluation = evaluateListingPublishDryRun(check, gateRecord, draft, item);
  assert(evaluation.canGenerate, 'Test 1: Valid pre-publish state can generate a dry-run request');

  const beforeInventory = JSON.stringify(item);
  const generated = generateListingPublishDryRun(check, gateRecord, draft, item, []);
  const packet = generated.packet!;
  assert(generated.success && packet.mode === 'DRY_RUN' && packet.networkAction === 'NONE', 'Test 2: Dry run is explicitly non-network and non-publishing');
  assert(packet.quantity === 2 && packet.sellerAccountId === 'ebay-main' && packet.listing.priceAmount === 39.99, 'Test 3: Dry-run packet mirrors approved quantity, account and price');
  assert(packet.listing.title === 'Dry Run Listing Title' && packet.targetMarketplace === 'eBay US', 'Test 4: Dry-run packet mirrors approved listing and marketplace');
  assert(packet.clientRequestKey.startsWith('dryrun:eBay:') && packet.requestFingerprint.length === 8, 'Test 5: Internal request key and deterministic fingerprint are generated');
  assert(JSON.stringify(item) === beforeInventory, 'Test 6: Dry-run generation does not mutate central inventory');
  assert(loadListingPublishDryRuns().length === 1, 'Test 7: Dry-run packet is stored locally for review');

  const currentValidity = evaluateStoredListingPublishDryRun(packet, check, gateRecord, draft, item);
  assert(currentValidity.valid, 'Test 8: Stored dry-run remains valid when source data is unchanged');

  const reducedStock = makeItem({ physicalStock: 1, availableToSell: 1 });
  const reducedValidity = evaluateStoredListingPublishDryRun(packet, check, gateRecord, draft, reducedStock);
  assert(!reducedValidity.valid && reducedValidity.reasonsJa.some((reason) => reason.includes('下回っています')), 'Test 9: Stock dropping below planned quantity invalidates the dry run');

  const duplicateItem = makeItem({
    channelBindings: [{
      channel: 'eBay',
      sellerAccountId: 'ebay-main',
      channelListingId: 'existing-listing',
      syncedStock: 3,
      syncStatus: 'SYNCED',
      lastSyncedAt: '2026-09-08T01:00:00.000Z',
      isAutoSyncEnabled: true
    }]
  });
  const duplicateValidity = evaluateStoredListingPublishDryRun(packet, check, gateRecord, draft, duplicateItem);
  assert(!duplicateValidity.valid && duplicateValidity.reasonsJa.some((reason) => reason.includes('既存出品')), 'Test 10: Newly detected same-channel listing invalidates the dry run');

  const changedDraft = { ...draft, listingTitle: 'Changed Title', updatedAt: '2026-09-08T02:00:00.000Z' };
  const changedValidity = evaluateStoredListingPublishDryRun(packet, check, gateRecord, changedDraft, item);
  assert(!changedValidity.valid && changedValidity.reasonsJa.some((reason) => reason.includes('下書きが変更')), 'Test 11: Draft changes after generation invalidate the dry run');

  const noGateEvaluation = evaluateListingPublishDryRun(check, undefined, draft, item);
  assert(!noGateEvaluation.canGenerate && noGateEvaluation.blockingReasonsJa.some((reason) => reason.includes('最終承認')), 'Test 12: Missing final approval record blocks dry-run generation');

  localStorage.clear();
  return { passed, failed, log };
}
