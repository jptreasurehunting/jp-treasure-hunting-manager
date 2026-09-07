import { CentralInventoryItem } from '../../types/centralInventory';
import {
  buildListingPreparationCandidates,
  createListingPreparationDraft,
  evaluateListingPreparation,
  loadListingPreparationDrafts
} from '../listingPreparationService';

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

function makeItem(
  overrides: Partial<CentralInventoryItem> & Pick<CentralInventoryItem, 'sku' | 'itemTitle'>
): CentralInventoryItem {
  return {
    sku: overrides.sku,
    itemTitle: overrides.itemTitle,
    physicalStock: overrides.physicalStock ?? 2,
    reservedStock: overrides.reservedStock ?? 0,
    availableToSell: overrides.availableToSell ?? 2,
    safetyBuffer: overrides.safetyBuffer ?? 0,
    unitCostJpy: overrides.unitCostJpy ?? 1000,
    weightGrams: overrides.weightGrams ?? 100,
    dimensionsCm: overrides.dimensionsCm ?? { length: 10, width: 8, height: 4 },
    category: overrides.category ?? 'Test',
    channelBindings: overrides.channelBindings ?? [],
    lastReconciledAt: overrides.lastReconciledAt ?? '2026-09-07T00:00:00.000Z',
    isLockedForOversellingRisk: overrides.isLockedForOversellingRisk ?? false
  };
}

export function runListingPreparationTests(): { passed: number; failed: number; log: string[] } {
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

  const unlisted = makeItem({
    sku: 'UNLISTED-HIGH',
    itemTitle: 'Unlisted High',
    availableToSell: 3,
    physicalStock: 3,
    unitCostJpy: 5000
  });
  const unlistedEligibility = evaluateListingPreparation(unlisted, []);
  assert(
    unlistedEligibility.availableTargetChannels.includes('eBay') && unlistedEligibility.availableTargetChannels.includes('Shopee'),
    'Test 1: Unlisted sellable inventory can prepare eBay and Shopee drafts'
  );

  const existingEbay = makeItem({
    sku: 'EXISTING-EBAY',
    itemTitle: 'Existing eBay',
    channelBindings: [
      {
        channel: 'eBay',
        sellerAccountId: 'seller-1',
        channelListingId: 'listing-1',
        syncedStock: 2,
        syncStatus: 'SYNCED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ]
  });
  const existingEligibility = evaluateListingPreparation(existingEbay, []);
  assert(
    !existingEligibility.availableTargetChannels.includes('eBay') && existingEligibility.availableTargetChannels.includes('Shopee'),
    'Test 2: Existing eBay binding blocks duplicate eBay preparation but allows Shopee'
  );

  const locked = makeItem({
    sku: 'LOCKED',
    itemTitle: 'Locked',
    isLockedForOversellingRisk: true
  });
  assert(
    !evaluateListingPreparation(locked, []).canPrepareAny,
    'Test 3: Overselling lock blocks listing preparation'
  );

  const zeroStock = makeItem({
    sku: 'ZERO',
    itemTitle: 'Zero Stock',
    physicalStock: 0,
    availableToSell: 0
  });
  assert(
    !evaluateListingPreparation(zeroStock, []).canPrepareAny,
    'Test 4: Zero sellable stock blocks listing preparation'
  );

  const syncFailed = makeItem({
    sku: 'SYNC-FAILED',
    itemTitle: 'Sync Failed',
    channelBindings: [
      {
        channel: 'Shopify',
        sellerAccountId: 'shopify-1',
        channelListingId: 'shopify-listing-1',
        syncedStock: 2,
        syncStatus: 'FAILED',
        lastSyncedAt: '2026-09-07T00:00:00.000Z',
        isAutoSyncEnabled: true
      }
    ]
  });
  assert(
    !evaluateListingPreparation(syncFailed, []).canPrepareAny,
    'Test 5: Existing channel sync failure must be resolved before new listing preparation'
  );

  const beforeBindings = unlisted.channelBindings.length;
  const createResult = createListingPreparationDraft(unlisted, 'eBay', []);
  assert(createResult.success && loadListingPreparationDrafts().length === 1, 'Test 6: Listing preparation draft persists locally');
  assert(unlisted.channelBindings.length === beforeBindings, 'Test 7: Creating a draft does not mutate central inventory bindings');
  assert(createResult.draft?.sellerAccountId === undefined, 'Test 8: Seller account is not guessed or auto-selected');

  const persistedDrafts = loadListingPreparationDrafts();
  const duplicateResult = createListingPreparationDraft(unlisted, 'eBay', persistedDrafts);
  assert(!duplicateResult.success, 'Test 9: Duplicate local draft for the same SKU and channel is blocked');

  const duplicateExistingResult = createListingPreparationDraft(existingEbay, 'eBay', []);
  assert(!duplicateExistingResult.success, 'Test 10: Existing marketplace binding blocks same-channel draft creation');

  const lowUnlisted = makeItem({
    sku: 'UNLISTED-LOW',
    itemTitle: 'Unlisted Low',
    availableToSell: 1,
    physicalStock: 1,
    unitCostJpy: 1000
  });
  const candidates = buildListingPreparationCandidates([existingEbay, lowUnlisted, unlisted], persistedDrafts);
  assert(candidates[0].sku === 'UNLISTED-HIGH', 'Test 11: Unlisted candidates are prioritized before partially listed inventory');
  assert(candidates.some((row) => row.sku === 'UNLISTED-HIGH' && row.pendingDraftChannels.includes('eBay')), 'Test 12: Existing preparation draft is visible in candidate state');

  localStorage.removeItem(STORAGE_KEY);
  return { passed, failed, log };
}
