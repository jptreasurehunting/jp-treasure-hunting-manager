import {
  EbayPublishPrerequisiteInput,
  evaluateEbayPublishPrerequisites,
  evaluateStoredEbayPublishPrerequisites,
  loadEbayPublishPrerequisites,
  recordEbayPublishPrerequisites
} from '../ebayPublishPrerequisiteService';
import { ListingPublishAdapterSimulation } from '../listingPublishAdapterService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makeSimulation(overrides: Partial<ListingPublishAdapterSimulation> = {}): ListingPublishAdapterSimulation {
  return {
    simulationId: overrides.simulationId ?? 'sim-ebay-001',
    adapterId: overrides.adapterId ?? 'EBAY_PUBLISH_ADAPTER_V1',
    adapterVersion: '1',
    mode: overrides.mode ?? 'SIMULATION_ONLY',
    networkAction: overrides.networkAction ?? 'NONE',
    sendAllowed: false,
    schemaStatus: 'INTERNAL_PREVIEW_NOT_MARKETPLACE_API_SCHEMA',
    dryRunId: overrides.dryRunId ?? 'dryrun-001',
    draftId: overrides.draftId ?? 'draft-001',
    sku: overrides.sku ?? 'SKU-001',
    targetChannel: overrides.targetChannel ?? 'eBay',
    targetMarketplace: overrides.targetMarketplace ?? 'eBay US',
    sellerAccountId: overrides.sellerAccountId ?? 'ebay-main',
    clientRequestKey: overrides.clientRequestKey ?? 'dryrun:eBay:draft-001:check-001',
    requestFingerprint: overrides.requestFingerprint ?? 'abcd1234',
    requestPreview: overrides.requestPreview ?? {},
    generatedAt: overrides.generatedAt ?? '2026-09-08T01:00:00.000Z',
    source: 'INVENTORY_SALES_WORKBENCH'
  };
}

function makeInput(overrides: Partial<EbayPublishPrerequisiteInput> = {}): EbayPublishPrerequisiteInput {
  return {
    marketplaceId: overrides.marketplaceId ?? 'EBAY_US',
    categoryId: overrides.categoryId ?? '12345',
    condition: overrides.condition ?? 'NEW',
    aspectsReviewed: overrides.aspectsReviewed ?? true,
    aspects: overrides.aspects ?? { Brand: ['Test Brand'] },
    imageUrls: overrides.imageUrls ?? ['https://example.com/item-1.jpg'],
    merchantLocationKey: overrides.merchantLocationKey ?? 'JP-WAREHOUSE-1',
    paymentPolicyId: overrides.paymentPolicyId ?? 'PAY-001',
    fulfillmentPolicyId: overrides.fulfillmentPolicyId ?? 'FUL-001',
    returnPolicyId: overrides.returnPolicyId ?? 'RET-001',
    format: overrides.format ?? 'FIXED_PRICE',
    listingDuration: overrides.listingDuration ?? 'GTC',
    officialSourcesVerified: overrides.officialSourcesVerified ?? true,
    checkedAt: overrides.checkedAt ?? '2026-09-08T01:30:00.000Z',
    checkedBy: overrides.checkedBy ?? 'owner',
    verificationNote: overrides.verificationNote ?? 'Verified against official eBay screens and documentation.'
  };
}

export function runEbayPublishPrerequisiteTests(): { passed: number; failed: number; log: string[] } {
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
  const simulation = makeSimulation();
  const input = makeInput();

  const evaluation = evaluateEbayPublishPrerequisites(simulation, input);
  assert(evaluation.canSaveVerifiedPrerequisites, 'Test 1: Complete eBay prerequisites are accepted');

  const recorded = recordEbayPublishPrerequisites(simulation, input, []);
  assert(recorded.success && recorded.record?.status === 'PREREQUISITES_VERIFIED', 'Test 2: Verified prerequisites can be stored');
  assert(recorded.record?.networkAction === 'NONE' && recorded.record?.sendAllowed === false, 'Test 3: Stored prerequisites remain strictly non-network');
  assert(loadEbayPublishPrerequisites().length === 1, 'Test 4: Prerequisite record is persisted locally');

  const invalidImage = evaluateEbayPublishPrerequisites(simulation, makeInput({ imageUrls: ['http://example.com/item.jpg'] }));
  assert(!invalidImage.canSaveVerifiedPrerequisites && invalidImage.missingOrInvalidFieldsJa.some((item) => item.includes('HTTPS')), 'Test 5: Non-HTTPS image URL is rejected');

  const missingAspectReview = evaluateEbayPublishPrerequisites(simulation, makeInput({ aspectsReviewed: false }));
  assert(!missingAspectReview.canSaveVerifiedPrerequisites && missingAspectReview.missingOrInvalidFieldsJa.some((item) => item.includes('Item Specifics')), 'Test 6: Category-specific aspects review is required');

  const emptyAspectsButReviewed = evaluateEbayPublishPrerequisites(simulation, makeInput({ aspects: {}, aspectsReviewed: true }));
  assert(emptyAspectsButReviewed.canSaveVerifiedPrerequisites, 'Test 7: Empty aspects are allowed only when the category review itself is explicitly completed');

  const shopeeSimulation = makeSimulation({
    targetChannel: 'Shopee',
    adapterId: 'SHOPEE_PUBLISH_ADAPTER_V1'
  });
  const wrongChannel = evaluateEbayPublishPrerequisites(shopeeSimulation, input);
  assert(!wrongChannel.canSaveVerifiedPrerequisites && wrongChannel.blockingReasonsJa.some((item) => item.includes('eBay用')), 'Test 8: Shopee simulation cannot use the eBay prerequisite layer');

  const stored = recorded.record!;
  const unchangedValidity = evaluateStoredEbayPublishPrerequisites(stored, simulation);
  assert(unchangedValidity.valid, 'Test 9: Stored prerequisites remain valid when simulation is unchanged');

  const changedSimulation = makeSimulation({ requestFingerprint: 'ffff9999' });
  const changedValidity = evaluateStoredEbayPublishPrerequisites(stored, changedSimulation);
  assert(!changedValidity.valid && changedValidity.reasonsJa.some((item) => item.includes('送信予定内容')), 'Test 10: Changed publish fingerprint invalidates stored prerequisites');

  const missingPolicy = evaluateEbayPublishPrerequisites(simulation, makeInput({ fulfillmentPolicyId: '' }));
  assert(!missingPolicy.canSaveVerifiedPrerequisites && missingPolicy.missingOrInvalidFieldsJa.some((item) => item.includes('Fulfillment Policy')), 'Test 11: Missing fulfillment policy blocks readiness');

  const trimmed = recordEbayPublishPrerequisites(simulation, makeInput({ marketplaceId: '  EBAY_US  ', categoryId: '  12345  ' }), []);
  assert(trimmed.record?.marketplaceId === 'EBAY_US' && trimmed.record?.categoryId === '12345', 'Test 12: Identifiers are normalized before storage');

  localStorage.clear();
  return { passed, failed, log };
}
