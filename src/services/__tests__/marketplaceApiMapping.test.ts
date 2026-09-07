import { ListingPublishAdapterSimulation } from '../listingPublishAdapterService';
import {
  EBAY_API_MAPPING_PROFILE,
  SHOPEE_API_MAPPING_PROFILE,
  evaluateMarketplaceApiMapping,
  getMarketplaceApiMappingProfile
} from '../marketplaceApiMappingService';

function makeSimulation(channel: 'eBay' | 'Shopee'): ListingPublishAdapterSimulation {
  return {
    simulationId: `sim-${channel}`,
    adapterId: channel === 'eBay' ? 'EBAY_PUBLISH_ADAPTER_V1' : 'SHOPEE_PUBLISH_ADAPTER_V1',
    adapterVersion: '1',
    mode: 'SIMULATION_ONLY',
    networkAction: 'NONE',
    sendAllowed: false,
    schemaStatus: 'INTERNAL_PREVIEW_NOT_MARKETPLACE_API_SCHEMA',
    dryRunId: `dry-${channel}`,
    draftId: `draft-${channel}`,
    sku: `SKU-${channel.toUpperCase()}`,
    targetChannel: channel,
    targetMarketplace: channel === 'eBay' ? 'eBay US' : 'Singapore',
    sellerAccountId: 'seller-main',
    clientRequestKey: `key-${channel}`,
    requestFingerprint: 'deadbeef',
    requestPreview: {},
    generatedAt: '2026-09-08T00:00:00.000Z',
    source: 'INVENTORY_SALES_WORKBENCH'
  };
}

export function runMarketplaceApiMappingTests(): { passed: number; failed: number; log: string[] } {
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

  assert(
    EBAY_API_MAPPING_PROFILE.apiVersion === '1.18.5' &&
      EBAY_API_MAPPING_PROFILE.verificationStatus === 'OFFICIAL_VERIFIED_WITH_REQUIRED_INPUTS',
    'Test 1: eBay mapping records the verified Inventory API version and verification status'
  );

  assert(
    EBAY_API_MAPPING_PROFILE.callPlan.length === 3 &&
      EBAY_API_MAPPING_PROFILE.callPlan.map((step) => step.operationId).join(',') ===
        'createOrReplaceInventoryItem,createOffer,publishOffer',
    'Test 2: eBay mapping follows Inventory Item -> Offer -> Publish flow'
  );

  const ebayMappings = EBAY_API_MAPPING_PROFILE.callPlan.flatMap((step) => step.mappings);
  assert(
    ebayMappings.some((mapping) => mapping.apiField === 'listingPolicies.fulfillmentPolicyId' && mapping.status === 'POLICY_RESOLUTION_REQUIRED') &&
      ebayMappings.some((mapping) => mapping.apiField === 'product.imageUrls' && mapping.status === 'REQUIRES_INPUT') &&
      ebayMappings.some((mapping) => mapping.apiField === 'product.aspects' && mapping.status === 'CATEGORY_DEPENDENT'),
    'Test 3: eBay mapping does not treat free-text shipping, images or category aspects as already resolved'
  );

  assert(
    ebayMappings.some((mapping) => mapping.internalField === 'sellerAccountId' && mapping.status === 'NOT_REQUEST_BODY'),
    'Test 4: Seller account is modeled as authentication context rather than request-body data'
  );

  const ebayEvaluation = evaluateMarketplaceApiMapping(makeSimulation('eBay'));
  assert(
    ebayEvaluation.simulationSafe && ebayEvaluation.canBuildOfficialPayloadAfterRequiredInputs && ebayEvaluation.blockingReasonsJa.length === 0,
    'Test 5: Safe eBay simulation may advance only to official payload construction after required inputs are resolved'
  );

  assert(
    SHOPEE_API_MAPPING_PROFILE.verificationStatus === 'OFFICIAL_SCHEMA_REVIEW_REQUIRED' && SHOPEE_API_MAPPING_PROFILE.callPlan.length === 0,
    'Test 6: Shopee exact payload mapping remains blocked until current official schema is verified'
  );

  const shopeeEvaluation = evaluateMarketplaceApiMapping(makeSimulation('Shopee'));
  assert(
    !shopeeEvaluation.canBuildOfficialPayloadAfterRequiredInputs &&
      shopeeEvaluation.blockingReasonsJa.some((reason) => reason.includes('Schema確認が未完了')),
    'Test 7: Shopee cannot be promoted to a real API payload from guessed or incomplete schema information'
  );

  const unsafe = { ...makeSimulation('eBay'), sendAllowed: true as any };
  const unsafeEvaluation = evaluateMarketplaceApiMapping(unsafe);
  assert(
    !unsafeEvaluation.simulationSafe && unsafeEvaluation.blockingReasonsJa.some((reason) => reason.includes('安全なSimulation状態ではありません')),
    'Test 8: Mapping evaluation rejects a simulation that can send'
  );

  assert(
    getMarketplaceApiMappingProfile('eBay').channel === 'eBay' && getMarketplaceApiMappingProfile('Shopee').channel === 'Shopee',
    'Test 9: Channel-specific mapping profiles are selected deterministically'
  );

  assert(
    EBAY_API_MAPPING_PROFILE.sendAllowed === false &&
      SHOPEE_API_MAPPING_PROFILE.sendAllowed === false &&
      EBAY_API_MAPPING_PROFILE.networkAction === 'NONE' &&
      SHOPEE_API_MAPPING_PROFILE.networkAction === 'NONE',
    'Test 10: Mapping profiles cannot perform external network or publish actions'
  );

  return { passed, failed, log };
}
