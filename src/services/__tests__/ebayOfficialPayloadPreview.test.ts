import { EbayPublishPrerequisiteRecord } from '../ebayPublishPrerequisiteService';
import { EBAY_REST_REQUEST_HEADERS_SOURCE_URL } from '../ebayMarketplaceLocaleService';
import {
  evaluateEbayOfficialPayloadPreview,
  evaluateStoredEbayOfficialPayloadPreview,
  generateEbayOfficialPayloadPreview,
  loadEbayOfficialPayloadPreviews
} from '../ebayOfficialPayloadPreviewService';
import { ListingPublishAdapterSimulation } from '../listingPublishAdapterService';
import { ListingPublishDryRunPacket } from '../listingPublishDryRunService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makePacket(overrides: Partial<ListingPublishDryRunPacket> = {}): ListingPublishDryRunPacket {
  return {
    dryRunId: overrides.dryRunId ?? 'dryrun-ebay-001', mode: 'DRY_RUN', networkAction: 'NONE',
    draftId: overrides.draftId ?? 'draft-ebay-001', prePublishCheckId: overrides.prePublishCheckId ?? 'check-001',
    publishGateRecordId: overrides.publishGateRecordId ?? 'gate-001', sku: overrides.sku ?? 'SKU-EBAY-001',
    targetChannel: overrides.targetChannel ?? 'eBay', targetMarketplace: overrides.targetMarketplace ?? 'eBay US',
    sellerAccountId: overrides.sellerAccountId ?? 'ebay-main', quantity: overrides.quantity ?? 2,
    listing: overrides.listing ?? { title: 'Official Payload Test Item', description: 'Accurate test description.', priceAmount: 49.99, priceCurrency: 'USD', shippingTerms: 'Confirmed policy mapping' },
    clientRequestKey: overrides.clientRequestKey ?? 'dryrun:eBay:draft-ebay-001:check-001',
    requestFingerprint: overrides.requestFingerprint ?? 'abcd1234', generatedAt: overrides.generatedAt ?? '2026-09-08T02:00:00.000Z',
    draftUpdatedAtAtGeneration: overrides.draftUpdatedAtAtGeneration ?? '2026-09-08T01:30:00.000Z',
    availableToSellAtGeneration: overrides.availableToSellAtGeneration ?? 3, source: 'INVENTORY_SALES_WORKBENCH'
  };
}

function makeSimulation(overrides: Partial<ListingPublishAdapterSimulation> = {}): ListingPublishAdapterSimulation {
  return {
    simulationId: overrides.simulationId ?? 'sim-ebay-001', adapterId: overrides.adapterId ?? 'EBAY_PUBLISH_ADAPTER_V1', adapterVersion: '1',
    mode: 'SIMULATION_ONLY', networkAction: 'NONE', sendAllowed: false, schemaStatus: 'INTERNAL_PREVIEW_NOT_MARKETPLACE_API_SCHEMA',
    dryRunId: overrides.dryRunId ?? 'dryrun-ebay-001', draftId: overrides.draftId ?? 'draft-ebay-001', sku: overrides.sku ?? 'SKU-EBAY-001',
    targetChannel: overrides.targetChannel ?? 'eBay', targetMarketplace: overrides.targetMarketplace ?? 'eBay US', sellerAccountId: overrides.sellerAccountId ?? 'ebay-main',
    clientRequestKey: overrides.clientRequestKey ?? 'dryrun:eBay:draft-ebay-001:check-001', requestFingerprint: overrides.requestFingerprint ?? 'abcd1234',
    requestPreview: overrides.requestPreview ?? {}, generatedAt: overrides.generatedAt ?? '2026-09-08T02:05:00.000Z', source: 'INVENTORY_SALES_WORKBENCH'
  };
}

function makePrerequisite(overrides: Partial<EbayPublishPrerequisiteRecord> = {}): EbayPublishPrerequisiteRecord {
  return {
    recordId: overrides.recordId ?? 'ebay-prereq-001', simulationId: overrides.simulationId ?? 'sim-ebay-001', dryRunId: overrides.dryRunId ?? 'dryrun-ebay-001',
    draftId: overrides.draftId ?? 'draft-ebay-001', sku: overrides.sku ?? 'SKU-EBAY-001', targetMarketplaceLabel: overrides.targetMarketplaceLabel ?? 'eBay US',
    sellerAccountIdAtSave: overrides.sellerAccountIdAtSave ?? 'ebay-main', requestFingerprintAtSave: overrides.requestFingerprintAtSave ?? 'abcd1234',
    marketplaceId: overrides.marketplaceId ?? 'EBAY_US', contentLanguage: overrides.contentLanguage ?? 'en-US', contentLanguageReviewed: overrides.contentLanguageReviewed ?? true,
    contentLanguageSourceUrl: overrides.contentLanguageSourceUrl ?? EBAY_REST_REQUEST_HEADERS_SOURCE_URL,
    categoryId: overrides.categoryId ?? '12345', condition: overrides.condition ?? 'NEW', aspectsReviewed: true,
    aspects: overrides.aspects ?? { Brand: ['Test Brand'], Type: ['Collectible'] }, imageUrls: overrides.imageUrls ?? ['https://example.com/image-1.jpg'],
    merchantLocationKey: overrides.merchantLocationKey ?? 'JP-WAREHOUSE-1', paymentPolicyId: overrides.paymentPolicyId ?? 'PAY-001',
    fulfillmentPolicyId: overrides.fulfillmentPolicyId ?? 'FUL-001', returnPolicyId: overrides.returnPolicyId ?? 'RET-001',
    format: overrides.format ?? 'FIXED_PRICE', listingDuration: overrides.listingDuration ?? 'GTC', officialSourcesVerified: true,
    checkedAt: overrides.checkedAt ?? '2026-09-08T02:10:00.000Z', checkedBy: overrides.checkedBy ?? 'owner',
    verificationNote: overrides.verificationNote ?? 'Official prerequisites verified.', savedAt: overrides.savedAt ?? '2026-09-08T02:11:00.000Z',
    status: 'PREREQUISITES_VERIFIED', networkAction: 'NONE', sendAllowed: false
  };
}

export function runEbayOfficialPayloadPreviewTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0; let failed = 0; const log: string[] = [];
  const assert = (condition: boolean, name: string) => { if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); } else { failed += 1; log.push(`❌ [FAIL] ${name}`); } };

  localStorage.clear();
  const packet = makePacket(); const simulation = makeSimulation(); const prerequisite = makePrerequisite();
  const evaluation = evaluateEbayOfficialPayloadPreview(packet, simulation, prerequisite);
  assert(evaluation.canGenerate, 'Test 1: Matching verified eBay inputs can generate an official payload preview');

  const result = generateEbayOfficialPayloadPreview(packet, simulation, prerequisite, []);
  const preview = result.preview!;
  assert(result.success && preview.mode === 'PAYLOAD_PREVIEW_ONLY' && preview.networkAction === 'NONE' && preview.sendAllowed === false, 'Test 2: Payload preview remains strictly non-network');
  assert(preview.marketplaceId === 'EBAY_US' && preview.contentLanguage === 'en-US', 'Test 3: Verified MarketplaceId and Content-Language are frozen into preview');
  assert(preview.apiVersion === '1.18.5' && preview.steps.length === 3, 'Test 4: Preview uses mapped Inventory API version and three-step flow');

  const inventoryBody = preview.steps[0].requestBody as any;
  assert(inventoryBody.availability.shipToLocationAvailability.quantity === 2 && inventoryBody.condition === 'NEW', 'Test 5: Inventory item payload maps quantity and condition');
  assert(inventoryBody.product.title === 'Official Payload Test Item' && inventoryBody.product.imageUrls[0].startsWith('https://'), 'Test 6: Inventory item payload maps title and HTTPS images');
  assert(inventoryBody.product.aspects.Brand[0] === 'Test Brand', 'Test 7: Category aspects are carried into inventory payload');

  const offerBody = preview.steps[1].requestBody as any;
  assert(offerBody.marketplaceId === 'EBAY_US' && offerBody.categoryId === '12345' && offerBody.merchantLocationKey === 'JP-WAREHOUSE-1', 'Test 8: Offer payload maps marketplace, category and location');
  assert(offerBody.listingPolicies.fulfillmentPolicyId === 'FUL-001' && offerBody.listingPolicies.paymentPolicyId === 'PAY-001' && offerBody.listingPolicies.returnPolicyId === 'RET-001', 'Test 9: Offer maps Business Policy IDs');
  assert(offerBody.pricingSummary.price.value === '49.99' && offerBody.pricingSummary.price.currency === 'USD', 'Test 10: Offer price uses value and currency');
  assert(preview.steps[2].requestBody === null && preview.steps[2].pathParameters.offerId.includes('createOffer'), 'Test 11: publishOffer waits for response-derived offerId');
  assert(preview.authenticationStatus === 'NOT_ATTACHED' && !JSON.stringify(preview).toLowerCase().includes('access_token'), 'Test 12: Preview never embeds OAuth access tokens');
  assert(loadEbayOfficialPayloadPreviews().length === 1, 'Test 13: Payload preview is stored locally for review');

  const storedValidity = evaluateStoredEbayOfficialPayloadPreview(preview, packet, simulation, prerequisite);
  assert(storedValidity.valid, 'Test 14: Stored preview remains valid while source records are unchanged');

  const changedLocale = makePrerequisite({ contentLanguage: 'en-CA' });
  const changedLocaleValidity = evaluateStoredEbayOfficialPayloadPreview(preview, packet, simulation, changedLocale);
  assert(!changedLocaleValidity.valid, 'Test 15: Content-Language change invalidates stored preview');

  const changedPacket = makePacket({ requestFingerprint: 'ffff9999' });
  const changedValidity = evaluateStoredEbayOfficialPayloadPreview(preview, changedPacket, simulation, prerequisite);
  assert(!changedValidity.valid, 'Test 16: Changed Dry Run fingerprint invalidates stored payload preview');

  const stalePrerequisite = makePrerequisite({ simulationId: 'older-simulation' });
  assert(!evaluateEbayOfficialPayloadPreview(packet, simulation, stalePrerequisite).canGenerate, 'Test 17: Stale prerequisite blocks generation');
  assert(!evaluateEbayOfficialPayloadPreview(makePacket({ targetChannel: 'Shopee' }), simulation, prerequisite).canGenerate, 'Test 18: Shopee Dry Run cannot generate eBay preview');

  localStorage.clear();
  return { passed, failed, log };
}
