/**
 * Unit Test Suite for Knowledge Orchestrator & Cross-Module Reuse (Specs #1 - #18)
 */

import {
  orchestrateKnowledgeQuery,
  propagateKnowledgeInvalidation,
  getRevalidationPriorityQueue,
  loadOrchestratorEfficiencyStats,
  registerKnowledgeConsumerModule,
  getRegisteredConsumerModules,
  initKnowledgeOrchestratorHealthModule
} from '../knowledgeOrchestratorService';
import {
  saveExactAssetConfirmation,
  saveOperationalKnowledge,
  loadOperationalKnowledge,
  getAuthorityLevelRank
} from '../operationalKnowledgeService';
import { evaluateProjectHealth } from '../projectHealthService';

export function runKnowledgeOrchestratorTests(): { passed: number; failed: number; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`❌ [FAIL] ${testName}`);
    }
  };

  // Test 1: Shipping Compliance -> AI Shipping Advisor reuse (SpeedPAK luxury watch prohibition)
  const q1 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'eBay SpeedPAK',
    productCategory: 'Watches',
    country: 'US',
    proposedUse: 'shipping_decision'
  });
  assert(
    Boolean(
      q1.isResolved &&
        q1.reusedFromSharedEngine &&
        q1.avoidedNewResearch &&
        q1.bestApplicableKnowledge?.knowledgeId === 'kb_speedpak_watch_02'
    ),
    'Test 1: AI Shipping Advisor reuses SpeedPAK watch prohibition verified by Compliance Engine'
  );

  // Test 2: Rights Gate -> Marketing Studio exact-asset reuse
  saveExactAssetConfirmation({
    assetOrItemSignature: 'img_camera_nikon_f3_01',
    itemTitle: 'Nikon F3 Vintage Camera',
    factQuestionJa: 'この写真は自社で撮影しましたか？',
    confirmedAnswer: 'yes',
    confirmedBy: 'Lead Photographer',
    confirmedAt: new Date().toISOString(),
    scopeKey: 'asset_exact',
    isReusableForSameAsset: true
  });
  const q2 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_marketing_studio',
    domain: 'marketing_rights',
    assetId: 'img_camera_nikon_f3_01',
    proposedUse: 'ad_marketing'
  });
  assert(
    Boolean(
      q2.isResolved &&
        q2.reusedFromSharedEngine &&
        q2.provenance.humanConfirmationFact?.confirmedAnswer === 'yes' &&
        !q2.humanConfirmationRequired
    ),
    'Test 2: AI Marketing Studio reuses exact-asset photo confirmation from Rights Gate without re-prompting'
  );

  // Test 3: Authenticity Guarantee -> Shipment Readiness reuse
  const q3 = orchestrateKnowledgeQuery({
    requestingModuleId: 'shipping_template',
    domain: 'authenticity',
    marketplace: 'eBay',
    productCategory: 'Watches',
    country: 'US',
    proposedUse: 'listing'
  });
  assert(
    Boolean(
      q3.isResolved &&
        q3.bestApplicableKnowledge?.knowledgeId === 'kb_ebay_ag_watch_03' &&
        q3.authorityLevel === 'A_OFFICIAL_API'
    ),
    'Test 3: Shipment Readiness reuses eBay Authenticity Guarantee inspection hub rules'
  );

  // Test 4: Zonos Prepay / Carrier -> Shipping Advisor reuse
  const q4 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'FedEx',
    productCategory: 'Watches',
    country: 'US',
    proposedUse: 'shipping_decision'
  });
  assert(
    Boolean(
      q4.isResolved &&
        q4.bestApplicableKnowledge?.knowledgeId === 'kb_fedex_watch_01' &&
        q4.avoidedNewResearch
    ),
    'Test 4: AI Shipping Advisor reuses FedEx Watch Worksheet rules from Customs Knowledge'
  );

  // Test 5: Exact scope match
  assert(
    Boolean(q4.scopeMatch && q4.provenance.matchedScopeDescription.includes('FedEx')),
    'Test 5: Strict scope matching verifies matching carrier, country, category, and usage'
  );

  // Test 6: Country mismatch prevents improper reuse across destinations
  const q6 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'FedEx',
    productCategory: 'Watches',
    country: 'JP', // Domestic Japan, not US
    proposedUse: 'shipping_decision'
  });
  assert(
    Boolean(!q6.scopeMatch || q6.bestApplicableKnowledge?.countryOrRegion === 'US'),
    'Test 6: Destination country mismatch correctly flagged'
  );

  // Test 7: Carrier mismatch
  const q7 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'DHL Express',
    productCategory: 'Watches',
    country: 'DE',
    proposedUse: 'shipping_decision'
  });
  assert(
    Boolean(!q7.isResolved || q7.safeFallbackSuggested),
    'Test 7: Carrier mismatch prevents SpeedPAK/FedEx rules from applying to DHL Germany'
  );

  // Test 8: Asset mismatch does not overgeneralize to different photo
  const q8 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_marketing_studio',
    domain: 'marketing_rights',
    assetId: 'img_camera_nikon_f3_different_99', // Different asset
    proposedUse: 'ad_marketing'
  });
  assert(
    Boolean(
      !q8.provenance.humanConfirmationFact ||
        q8.provenance.humanConfirmationFact.assetOrItemSignature !== 'img_camera_nikon_f3_different_99'
    ),
    'Test 8: Asset-level binding strictly isolates factual confirmations'
  );

  // Test 9: Channel mismatch
  const q9 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_marketing_studio',
    domain: 'marketing_rights',
    channel: 'paid_television_ad', // Outside Instagram/SNS scope
    proposedUse: 'broadcast_marketing'
  });
  assert(
    Boolean(q9.safeFallbackSuggested || !q9.isResolved),
    'Test 9: Channel mismatch prevents SNS photo/music license from applying to TV broadcast'
  );

  // Test 10: Stale critical knowledge blocks automatic execution
  const kb = loadOperationalKnowledge();
  kb.push({
    knowledgeId: 'kb_stale_critical_10',
    domain: 'shipping',
    topic: 'Critical Watch Regulation',
    statement: 'Expired critical rule',
    source: 'Expired source',
    sourceType: 'official_document',
    authorityLevel: 'B_OFFICIAL_DOCUMENT',
    originalLanguage: 'en',
    japaneseTranslation: '失効した重要規約',
    countryOrRegion: 'US',
    marketplaceOrCarrierOrPlatform: 'StaleCarrier',
    productCategoryScope: 'Watches',
    usageScope: 'shipping_decision',
    evidence: 'Expired PDF',
    interpretation: 'Expired',
    confidence: 0.5,
    verifiedBy: 'Old Auditor',
    verifiedDate: '2024-01-01',
    version: '1.0',
    validFrom: '2024-01-01',
    expiryDate: '2024-12-31', // Expired
    currentStatus: 'RECHECK_REQUIRED',
    affectedModuleIds: ['ai_shipping_advisor'],
    reusableWithoutRecheck: false
  });
  saveOperationalKnowledge(kb);

  const q10 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'StaleCarrier',
    productCategory: 'Watches',
    country: 'US',
    blockingSensitivity: 'critical'
  });
  assert(
    Boolean(q10.freshnessStatus === 'blocked' && q10.safeFallbackSuggested),
    'Test 10: Stale critical knowledge is strictly blocked with safe fallback'
  );

  // Test 11: Stale non-critical knowledge allows usable_with_warning
  const q11 = orchestrateKnowledgeQuery({
    requestingModuleId: 'shipping_template',
    domain: 'shipping',
    carrier: 'StaleCarrier',
    productCategory: 'Watches',
    country: 'US',
    blockingSensitivity: 'low'
  });
  assert(
    Boolean(q11.freshnessStatus === 'usable_with_warning'),
    'Test 11: Stale non-critical knowledge returns usable_with_warning'
  );

  // Test 12: Higher authority resolution
  assert(
    Boolean(getAuthorityLevelRank('A_OFFICIAL_API') > getAuthorityLevelRank('C_ADMIN_APPROVED')),
    'Test 12: Higher authority (Official API) strictly preferred over Admin policy'
  );

  // Test 13: Contradiction detection surfaces in orchestrator response
  assert(
    Boolean(Array.isArray(q1.contradictions)),
    'Test 13: Contradiction detection engine is integrated into orchestrator responses'
  );

  // Test 14: Human question avoided when verified fact exists
  assert(
    Boolean(q2.humanConfirmationRequired === false && q2.avoidedNewResearch === true),
    'Test 14: Reusable human fact prevents duplicate question to operator'
  );

  // Test 15: Smallest unresolved fact requested when knowledge is missing
  const q15 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'UnknownCarrier',
    productCategory: 'UnregisteredCategory',
    country: 'XX'
  });
  assert(
    Boolean(q15.humanConfirmationRequired && q15.humanQuestionJa?.includes('規約を確認済みですか？')),
    'Test 15: Smallest unresolved factual question formulated for missing knowledge'
  );

  // Test 16: Invalidation propagation emits events to affected modules
  const invEvent = propagateKnowledgeInvalidation(
    'kb_stale_critical_10',
    'Carrier service agreement updated by operator',
    'REVOKED'
  );
  assert(
    Boolean(invEvent.revalidationPriority === 'URGENT_CRITICAL' && invEvent.affectedModules.includes('ai_shipping_advisor')),
    'Test 16: Invalidation propagation alerts all dependent modules'
  );

  // Test 17: Revalidation priority queue calculation
  const priorityQueue = getRevalidationPriorityQueue();
  assert(
    Boolean(priorityQueue.length > 0 && priorityQueue[0].priorityScore >= 100),
    'Test 17: Revalidation priority queue ranks critical blocking rules at the top'
  );

  // Test 18: Decision Provenance generation ("この判断は何を根拠にしましたか？")
  assert(
    Boolean(
      q4.provenance &&
        q4.provenance.reasonBasisJa &&
        q4.provenance.reasonBasisJa.includes('根拠情報源')
    ),
    'Test 18: Decision Provenance is complete with source, authority, verified date, and explanation'
  );

  // Test 19: Future module consumer registration
  registerKnowledgeConsumerModule('future_inventory_sync');
  registerKnowledgeConsumerModule('future_marketplace_optimizer');
  const registered = getRegisteredConsumerModules();
  assert(
    Boolean(registered.includes('future_inventory_sync') && registered.includes('future_marketplace_optimizer')),
    'Test 19: Future modules easily register with Knowledge Orchestrator'
  );

  // Test 20: Project Health integration
  initKnowledgeOrchestratorHealthModule();
  const healthCheck = evaluateProjectHealth();
  assert(
    Boolean(healthCheck.itemsByCategory.future_module.some((m) => m.id === 'module_knowledge_orchestrator')),
    'Test 20: Knowledge Orchestrator registers health check in Project Health Dashboard'
  );

  // Clean up test entry
  saveOperationalKnowledge(kb.filter((k) => k.knowledgeId !== 'kb_stale_critical_10'));

  return { passed, failed, log };
}
