import { CentralInventoryItem } from '../../types/centralInventory';
import { createListingPreparationDraft, loadListingPreparationDrafts } from '../listingPreparationService';
import { updateListingDraftReview } from '../listingDraftReviewService';
import { recordListingPublishApproval } from '../listingPublishGateService';
import { recordListingPrePublishCheck } from '../listingPrePublishCheckService';
import { generateListingPublishDryRun } from '../listingPublishDryRunService';
import {
  evaluateListingPublishAdapterSimulation,
  evaluateStoredListingPublishAdapterSimulation,
  generateListingPublishAdapterSimulation,
  loadListingPublishAdapterSimulations
} from '../listingPublishAdapterService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makeItem(sku: string): CentralInventoryItem {
  return {
    sku,
    itemTitle: `Adapter Test ${sku}`,
    physicalStock: 3,
    reservedStock: 0,
    availableToSell: 3,
    safetyBuffer: 0,
    unitCostJpy: 2000,
    weightGrams: 150,
    dimensionsCm: { length: 12, width: 9, height: 5 },
    category: 'Test',
    channelBindings: [],
    lastReconciledAt: '2026-09-08T00:00:00.000Z',
    isLockedForOversellingRisk: false
  };
}

function buildContext(channel: 'eBay' | 'Shopee', sku: string) {
  const item = makeItem(sku);
  const created = createListingPreparationDraft(item, channel, []);
  const reviewed = updateListingDraftReview(
    created.draft!.draftId,
    {
      sellerAccountId: channel === 'eBay' ? 'ebay-main' : 'shopee-main',
      listingTitle: `${channel} Adapter Test Listing`,
      listingDescription: 'Accurate adapter simulation description.',
      priceAmount: 49.99,
      priceCurrency: 'USD',
      shippingTerms: 'Confirmed shipping terms'
    },
    item,
    loadListingPreparationDrafts()
  );
  const draft = reviewed.draft!;

  const gate = recordListingPublishApproval(
    draft,
    item,
    {
      targetMarketplace: channel === 'eBay' ? 'eBay US' : 'Shopee Singapore',
      sellerAccountVerified: true,
      sellerAccountVerificationNote: 'Seller account confirmed.',
      marketplaceRulesVerified: true,
      marketplaceRulesSourceUrl: 'https://example.com/marketplace-rules',
      marketplaceRulesCheckedAt: '2026-09-08T01:00:00.000Z',
      marketplaceRulesNote: 'Rules reviewed for test.',
      finalApproved: true,
      approvedBy: 'owner',
      approvalNote: 'Final approval completed.'
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
      marketplaceRulesRecheckSourceUrl: 'https://example.com/marketplace-rules',
      marketplaceRulesRecheckedAt: '2026-09-08T01:10:00.000Z',
      checkedBy: 'owner',
      checkNote: 'Pre-publish check completed.'
    },
    []
  );
  const check = prePublish.record!;
  const dryRun = generateListingPublishDryRun(check, gateRecord, draft, item, []);

  return { item, draft, gateRecord, check, packet: dryRun.packet! };
}

export function runListingPublishAdapterTests(): { passed: number; failed: number; log: string[] } {
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

  const ebay = buildContext('eBay', 'SKU-ADAPTER-EBAY-001');
  const ebayEvaluation = evaluateListingPublishAdapterSimulation(
    ebay.packet,
    ebay.check,
    ebay.gateRecord,
    ebay.draft,
    ebay.item
  );
  assert(ebayEvaluation.canGenerateSimulation, 'Test 1: Valid eBay Dry Run can enter adapter simulation');

  const ebayResult = generateListingPublishAdapterSimulation(
    ebay.packet,
    ebay.check,
    ebay.gateRecord,
    ebay.draft,
    ebay.item,
    []
  );
  const ebaySimulation = ebayResult.simulation!;
  assert(
    ebayResult.success &&
      ebaySimulation.adapterId === 'EBAY_PUBLISH_ADAPTER_V1' &&
      ebaySimulation.mode === 'SIMULATION_ONLY' &&
      ebaySimulation.networkAction === 'NONE' &&
      ebaySimulation.sendAllowed === false,
    'Test 2: eBay adapter is forced to simulation-only with sending disabled'
  );
  assert(
    ebaySimulation.schemaStatus === 'INTERNAL_PREVIEW_NOT_MARKETPLACE_API_SCHEMA',
    'Test 3: Adapter preview is explicitly not claimed as the official Marketplace API schema'
  );
  const ebayPreview = ebaySimulation.requestPreview as any;
  assert(
    ebayPreview.title === 'eBay Adapter Test Listing' && ebayPreview.quantity === 2 && ebayPreview.price.value === 49.99,
    'Test 4: eBay preview mirrors approved listing, quantity and price'
  );

  const serializedEbay = JSON.stringify(ebaySimulation).toLowerCase();
  assert(
    !serializedEbay.includes('"token"') && !serializedEbay.includes('"password"') && !serializedEbay.includes('"secret"') && !serializedEbay.includes('"apikey"'),
    'Test 5: Adapter simulation contains no credential fields'
  );
  assert(loadListingPublishAdapterSimulations().length === 1, 'Test 6: Adapter simulation is stored locally for review');

  const ebayStored = evaluateStoredListingPublishAdapterSimulation(
    ebaySimulation,
    ebay.packet,
    ebay.check,
    ebay.gateRecord,
    ebay.draft,
    ebay.item
  );
  assert(ebayStored.valid, 'Test 7: Stored eBay adapter simulation remains valid when sources are unchanged');

  const changedPacket = { ...ebay.packet, requestFingerprint: 'ffffffff' };
  const stale = evaluateStoredListingPublishAdapterSimulation(
    ebaySimulation,
    changedPacket,
    ebay.check,
    ebay.gateRecord,
    ebay.draft,
    ebay.item
  );
  assert(!stale.valid && stale.reasonsJa.some((reason) => reason.includes('変わっています')), 'Test 8: Changed Dry Run fingerprint invalidates stored adapter simulation');

  localStorage.clear();
  const shopee = buildContext('Shopee', 'SKU-ADAPTER-SHOPEE-001');
  const shopeeResult = generateListingPublishAdapterSimulation(
    shopee.packet,
    shopee.check,
    shopee.gateRecord,
    shopee.draft,
    shopee.item,
    []
  );
  const shopeeSimulation = shopeeResult.simulation!;
  const shopeePreview = shopeeSimulation.requestPreview as any;
  assert(
    shopeeResult.success && shopeeSimulation.adapterId === 'SHOPEE_PUBLISH_ADAPTER_V1' && shopeeSimulation.sendAllowed === false,
    'Test 9: Shopee has a separate simulation-only adapter'
  );
  assert(
    shopeePreview.item.name === 'Shopee Adapter Test Listing' && shopeePreview.item.quantity === 2 && shopeePreview.item.price.value === 49.99,
    'Test 10: Shopee preview maps listing data into its separate internal preview shape'
  );

  const unsupportedPacket = { ...shopee.packet, targetChannel: 'Shopify' as any };
  const unsupported = evaluateListingPublishAdapterSimulation(
    unsupportedPacket,
    shopee.check,
    shopee.gateRecord,
    shopee.draft,
    shopee.item
  );
  assert(
    !unsupported.canGenerateSimulation && unsupported.blockingReasonsJa.some((reason) => reason.includes('eBay・Shopeeのみ')),
    'Test 11: Unsupported channels are blocked by the adapter foundation'
  );

  localStorage.clear();
  return { passed, failed, log };
}
