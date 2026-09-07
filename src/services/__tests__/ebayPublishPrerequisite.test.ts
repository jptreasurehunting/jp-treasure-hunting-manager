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
    contentLanguage: overrides.contentLanguage ?? 'en-US',
    contentLanguageReviewed: overrides.contentLanguageReviewed ?? true,
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
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.clear();
  const simulation = makeSimulation();
  const input = makeInput();

  const evaluation = evaluateEbayPublishPrerequisites(simulation, input);
  assert(evaluation.canSaveVerifiedPrerequisites, 'Test 1: Complete eBay prerequisites including Content-Language are accepted');

  const recorded = recordEbayPublishPrerequisites(simulation, input, []);
  assert(recorded.success && recorded.record?.status === 'PREREQUISITES_VERIFIED', 'Test 2: Verified prerequisites can be stored');
  assert(recorded.record?.contentLanguage === 'en-US' && recorded.record?.marketplaceId === 'EBAY_US', 'Test 3: Marketplace and Content-Language are bound together');
  assert(recorded.record?.networkAction === 'NONE' && recorded.record?.sendAllowed === false, 'Test 4: Stored prerequisites remain strictly non-network');
  assert(loadEbayPublishPrerequisites().length === 1, 'Test 5: Prerequisite record is persisted locally');

  const wrongLocale = evaluateEbayPublishPrerequisites(simulation, makeInput({ contentLanguage: 'de-DE' }));
  assert(!wrongLocale.canSaveVerifiedPrerequisites && wrongLocale.missingOrInvalidFieldsJa.some((item) => item.includes('公式対応Locale')), 'Test 6: Unsupported marketplace locale is rejected');

  const missingLocaleReview = evaluateEbayPublishPrerequisites(simulation, makeInput({ contentLanguageReviewed: false }));
  assert(!missingLocaleReview.canSaveVerifiedPrerequisites && missingLocaleReview.missingOrInvalidFieldsJa.some((item) => item.includes('Content-Language')), 'Test 7: Explicit Content-Language review is required');

  const canadaFrench = evaluateEbayPublishPrerequisites(simulation, makeInput({ marketplaceId: 'EBAY_CA', contentLanguage: 'fr-CA' }));
  assert(canadaFrench.canSaveVerifiedPrerequisites, 'Test 8: Multi-locale marketplace accepts an officially supported explicit locale');

  const invalidImage = evaluateEbayPublishPrerequisites(simulation, makeInput({ imageUrls: ['http://example.com/item.jpg'] }));
  assert(!invalidImage.canSaveVerifiedPrerequisites && invalidImage.missingOrInvalidFieldsJa.some((item) => item.includes('HTTPS')), 'Test 9: Non-HTTPS image URL is rejected');

  const missingAspectReview = evaluateEbayPublishPrerequisites(simulation, makeInput({ aspectsReviewed: false }));
  assert(!missingAspectReview.canSaveVerifiedPrerequisites && missingAspectReview.missingOrInvalidFieldsJa.some((item) => item.includes('Item Specifics')), 'Test 10: Category-specific aspects review is required');

  const shopeeSimulation = makeSimulation({ targetChannel: 'Shopee', adapterId: 'SHOPEE_PUBLISH_ADAPTER_V1' });
  const wrongChannel = evaluateEbayPublishPrerequisites(shopeeSimulation, input);
  assert(!wrongChannel.canSaveVerifiedPrerequisites, 'Test 11: Shopee simulation cannot use the eBay prerequisite layer');

  const stored = recorded.record!;
  const unchangedValidity = evaluateStoredEbayPublishPrerequisites(stored, simulation);
  assert(unchangedValidity.valid, 'Test 12: Stored prerequisites remain valid when simulation and locale are unchanged');

  const changedSimulation = makeSimulation({ requestFingerprint: 'ffff9999' });
  const changedValidity = evaluateStoredEbayPublishPrerequisites(stored, changedSimulation);
  assert(!changedValidity.valid && changedValidity.reasonsJa.some((item) => item.includes('送信予定内容')), 'Test 13: Changed publish fingerprint invalidates stored prerequisites');

  const missingPolicy = evaluateEbayPublishPrerequisites(simulation, makeInput({ fulfillmentPolicyId: '' }));
  assert(!missingPolicy.canSaveVerifiedPrerequisites, 'Test 14: Missing fulfillment policy blocks readiness');

  localStorage.clear();
  return { passed, failed, log };
}
