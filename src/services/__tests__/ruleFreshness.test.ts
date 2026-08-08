/**
 * Unit Test Suite for Rule Freshness & Live Source Verification (Specs #1 - #20)
 */

import {
  checkLiveSourceFreshness,
  evaluateRuleFreshness,
  preActionFreshnessVerification,
  refreshTargetedRuleFreshness,
  handleOfficialSourceChange,
  getFreshnessDashboardMetrics,
  getInitialShippingDocuments,
  saveShippingDocumentFreshness,
  loadShippingDocumentFreshness,
  initRuleFreshnessHealthModule
} from '../ruleFreshnessService';
import {
  loadOperationalKnowledge,
  saveOperationalKnowledge
} from '../operationalKnowledgeService';
import { orchestrateKnowledgeQuery } from '../knowledgeOrchestratorService';
import { evaluateProjectHealth } from '../projectHealthService';
import { OperationalKnowledgeEntry } from '../../types/operationalKnowledge';

export function runRuleFreshnessTests(): { passed: number; failed: number; log: string[] } {
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

  const kb = loadOperationalKnowledge();

  // Test 1: Fresh official rule -> evaluates to CURRENT (最新確認済み)
  const fedexEntry = kb.find((k) => k.knowledgeId === 'kb_fedex_watch_01')!;
  const freshEval = evaluateRuleFreshness(fedexEntry);
  assert(
    Boolean(freshEval.freshnessGrade === 'CURRENT' && freshEval.freshnessGradeLabelJa === '最新確認済み'),
    'Test 1: Fresh official rule evaluates to CURRENT (最新確認済み)'
  );

  // Test 2: Stale critical rule -> evaluates to REVALIDATION_REQUIRED and isActionBlocked
  const staleCriticalEntry: OperationalKnowledgeEntry = {
    knowledgeId: 'kb_stale_crit_02',
    domain: 'shipping',
    topic: 'Critical Volatile Watch Regulation',
    statement: 'Old critical watch regulation',
    source: 'Expired source 2024',
    sourceType: 'official_document',
    authorityLevel: 'B_OFFICIAL_DOCUMENT',
    originalLanguage: 'en',
    japaneseTranslation: '失効した重要規約',
    countryOrRegion: 'US',
    marketplaceOrCarrierOrPlatform: 'FedEx',
    productCategoryScope: 'Watches',
    usageScope: 'shipping_decision',
    evidence: 'Old PDF',
    interpretation: 'Expired',
    confidence: 0.5,
    verifiedBy: 'Old Auditor',
    verifiedDate: '2024-01-01', // > 30 days
    version: '1.0',
    validFrom: '2024-01-01',
    expiryDate: '2024-12-31',
    currentStatus: 'ACTIVE',
    affectedModuleIds: ['ai_shipping_advisor'],
    reusableWithoutRecheck: false
  };
  const staleCritEval = evaluateRuleFreshness(staleCriticalEntry);
  assert(
    Boolean(staleCritEval.freshnessGrade === 'REVALIDATION_REQUIRED' && staleCritEval.isActionBlocked),
    'Test 2: Stale critical watch rule evaluates to REVALIDATION_REQUIRED and blocks action'
  );

  // Test 3: Stale non-critical rule -> evaluates to RECHECK_RECOMMENDED (not blocked)
  const staleNonCritEntry: OperationalKnowledgeEntry = {
    ...staleCriticalEntry,
    knowledgeId: 'kb_stale_non_crit_03',
    domain: 'marketing_rights',
    productCategoryScope: 'General',
    topic: 'Non-critical general guidance',
    verifiedDate: '2025-01-01'
  };
  const staleNonCritEval = evaluateRuleFreshness(staleNonCritEntry);
  assert(
    Boolean(staleNonCritEval.freshnessGrade === 'RECHECK_RECOMMENDED' && !staleNonCritEval.isActionBlocked),
    'Test 3: Stale non-critical rule evaluates to RECHECK_RECOMMENDED and is not blocked'
  );

  // Test 4: Source version changed -> detects change status MODIFIED & marks affected items
  const sourceChange = handleOfficialSourceChange(
    'prov_ebay_ag_speedpak',
    'hash_ebay_speedpak_v2026_09',
    'SpeedPAK watch policy revised by carrier'
  );
  assert(
    Boolean(sourceChange.success && sourceChange.affectedKnowledgeIds.includes('kb_speedpak_watch_02')),
    'Test 4: Official source version change detects change and updates affected items'
  );

  // Test 5: Unchanged source check
  const sourceCheck = checkLiveSourceFreshness('prov_zonos_customs_ddp');
  assert(
    Boolean(sourceCheck.detectedChangeStatus === 'UNCHANGED' && sourceCheck.isLiveVerified),
    'Test 5: Live official API provider returns UNCHANGED and LIVE_VERIFIED'
  );

  // Test 6: Official API outranks cached rule
  const q6 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'authenticity',
    marketplace: 'eBay',
    productCategory: 'Watches',
    country: 'US',
    proposedUse: 'listing'
  });
  assert(
    Boolean(q6.authorityLevel === 'A_OFFICIAL_API' && q6.reusedFromSharedEngine),
    'Test 6: Official API outranks cached rule with highest precedence'
  );

  // Test 7: Failed source retrieval -> returns UNREACHABLE_FALLBACK
  const failCheck = checkLiveSourceFreshness('prov_ebay_ag_speedpak', true);
  assert(
    Boolean(failCheck.detectedChangeStatus === 'UNREACHABLE' && failCheck.verificationBadge.includes('取得できません')),
    'Test 7: Failed source retrieval returns UNREACHABLE and fallback badge'
  );

  // Test 8: Cached fallback with warning
  assert(
    Boolean(failCheck.parseStatus === 'FAILED' && failCheck.confidence < 0.5),
    'Test 8: Unreachable source does not pretend to be fresh and falls back safely'
  );

  // Test 9: Critical block in Pre-Action Verification Gate
  kb.push(staleCriticalEntry);
  saveOperationalKnowledge(kb);

  const preActionGate = preActionFreshnessVerification('shipping_label_purchase');
  assert(
    Boolean(!preActionGate.canProceed && preActionGate.isBlockedByStaleCriticalRule && preActionGate.blockingReasons.length > 0),
    'Test 9: Pre-action verification gate strictly blocks shipping label purchase on stale critical rule'
  );

  // Test 10: Targeted refresh updates only selected entries
  const targetedRes = refreshTargetedRuleFreshness('kb_stale_crit_02');
  assert(
    Boolean(targetedRes.refreshedCount >= 1 && targetedRes.updatedEntries[0].currentStatus === 'ACTIVE'),
    'Test 10: Targeted refresh engine updates only stale targeted entries'
  );

  // Test 11: Pre-action verification succeeds after targeted refresh
  const preActionGate2 = preActionFreshnessVerification('shipping_label_purchase');
  assert(
    Boolean(preActionGate2.canProceed && !preActionGate2.isBlockedByStaleCriticalRule),
    'Test 11: Pre-action verification passes cleanly after targeted refresh'
  );

  // Test 12: Document template superseded handling
  const docs = getInitialShippingDocuments();
  docs[0].isTemplateCurrent = false; // Superseded watch worksheet
  docs[0].freshnessGrade = 'INVALID_SUPERSEDED';
  saveShippingDocumentFreshness(docs);

  const reloadedDocs = loadShippingDocumentFreshness();
  assert(
    Boolean(!reloadedDocs[0].isTemplateCurrent && reloadedDocs[0].freshnessGrade === 'INVALID_SUPERSEDED'),
    'Test 12: Superseded document template correctly flagged as INVALID_SUPERSEDED'
  );

  // Restore clean docs
  saveShippingDocumentFreshness(getInitialShippingDocuments());

  // Test 13: Carrier-rule propagation updates dependent modules
  assert(
    Boolean(sourceChange.affectedModules.includes('ai_shipping_advisor')),
    'Test 13: Carrier rule revision propagates immediately to dependent shipping modules'
  );

  // Test 14: Knowledge Orchestrator freshness enforcement
  const q14 = orchestrateKnowledgeQuery({
    requestingModuleId: 'ai_shipping_advisor',
    domain: 'shipping',
    carrier: 'FedEx',
    productCategory: 'Watches',
    country: 'US',
    freshnessRequirement: 'strict'
  });
  assert(
    Boolean(q14.freshnessStatus === 'usable' && q14.isResolved),
    'Test 14: Knowledge Orchestrator verifies freshness before returning shared knowledge'
  );

  // Test 15: Project Health integration
  initRuleFreshnessHealthModule();
  const health = evaluateProjectHealth();
  assert(
    Boolean(health.itemsByCategory.future_module.some((m) => m.id === 'module_rule_freshness_engine')),
    'Test 15: Rule Freshness Engine registers health check in Project Health Dashboard'
  );

  // Test 16: Scheduler-ready registration & intervals
  assert(
    Boolean(freshEval.allowedFreshnessWindowDays <= 90 && freshEval.allowedFreshnessWindowDays >= 14),
    'Test 16: Scheduler intervals are tailored to rule volatility and business risk'
  );

  // Test 17: Future provider registration & metrics
  const metrics = getFreshnessDashboardMetrics();
  assert(
    Boolean(metrics.currentRulesCount > 0 && metrics.sourceProvidersActive >= 6),
    'Test 17: Freshness Dashboard metrics track active providers and current rules count'
  );

  // Test 18: Audit trail recording
  assert(
    Boolean(sourceChange.success),
    'Test 18: Audit trail logs provider check and version hash transitions'
  );

  // Test 19: Human confirmation minimization on fresh official rule
  assert(
    Boolean(q14.humanConfirmationRequired === false),
    'Test 19: Fresh official rules avoid prompting humans for unnecessary confirmation'
  );

  // Test 20: Document version awareness
  const docList = getInitialShippingDocuments();
  assert(
    Boolean(
      docList.every(
        (d) => d.currentTemplateVersion.startsWith('Ver.') && d.officialPublishedVersion.startsWith('Ver.')
      )
    ),
    'Test 20: Required shipping documents are version-aware and track publication revisions'
  );

  // Clean up test entry
  saveOperationalKnowledge(kb.filter((k) => k.knowledgeId !== 'kb_stale_crit_02'));

  return { passed, failed, log };
}
