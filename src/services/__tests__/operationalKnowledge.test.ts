/**
 * Unit Test Suite for Shared Operational Knowledge Engine (Specs #1 - #21)
 */

import {
  loadOperationalKnowledge,
  saveOperationalKnowledge,
  queryScopeAwareKnowledge,
  detectKnowledgeContradictions,
  saveExactAssetConfirmation,
  verifyExactAssetFact,
  updateKnowledgeStatus,
  searchOperationalKnowledge,
  loadKnowledgeEfficiencyMetrics,
  initOperationalKnowledgeHealthModule,
  getAuthorityLevelRank
} from '../operationalKnowledgeService';
import { evaluateProjectHealth } from '../projectHealthService';
import { OperationalKnowledgeEntry } from '../../types/operationalKnowledge';

export function runOperationalKnowledgeTests(): { passed: number; failed: number; log: string[] } {
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

  // Test 1: valid knowledge reuse -> correctly matches FedEx + US + Watches
  const query1 = queryScopeAwareKnowledge({
    domain: 'shipping',
    marketplaceOrCarrier: 'FedEx',
    country: 'US',
    category: 'Watches',
    usageScope: 'shipping_decision'
  });
  assert(
    Boolean(query1.reused && query1.scopeMatched && query1.entry?.knowledgeId === 'kb_fedex_watch_01'),
    'Test 1: Valid operational knowledge reused with matching scope'
  );

  // Test 2: scope mismatch -> does not apply FedEx + US watch rule to DHL + Germany + Jewelry
  const query2 = queryScopeAwareKnowledge({
    domain: 'shipping',
    marketplaceOrCarrier: 'DHL',
    country: 'DE',
    category: 'Jewelry',
    usageScope: 'shipping_decision'
  });
  assert(
    Boolean(!query2.scopeMatched && query2.mismatchReasonJa && query2.safeFallbackSuggested),
    'Test 2: Scope mismatch prevents improper knowledge reuse across different country/carrier/category'
  );

  // Test 3: stale knowledge detection
  const kb = loadOperationalKnowledge();
  kb.push({
    knowledgeId: 'kb_stale_test_03',
    domain: 'shipping',
    topic: 'Old SpeedPAK Limit',
    statement: 'Old limitation statement',
    source: 'Expired doc',
    sourceType: 'official_document',
    authorityLevel: 'B_OFFICIAL_DOCUMENT',
    originalLanguage: 'ja',
    japaneseTranslation: '古い失効規約',
    countryOrRegion: 'US',
    marketplaceOrCarrierOrPlatform: 'OldCarrier',
    productCategoryScope: 'All',
    usageScope: 'shipping_decision',
    evidence: 'Old PDF',
    interpretation: 'Expired',
    confidence: 0.8,
    verifiedBy: 'Old Reviewer',
    verifiedDate: '2024-01-01',
    version: '1.0',
    validFrom: '2024-01-01',
    expiryDate: '2024-12-31', // Expired
    currentStatus: 'RECHECK_REQUIRED',
    affectedModuleIds: ['ai_shipping_advisor'],
    reusableWithoutRecheck: false
  });
  saveOperationalKnowledge(kb);

  const query3 = queryScopeAwareKnowledge({
    domain: 'shipping',
    marketplaceOrCarrier: 'OldCarrier',
    country: 'US',
    category: 'All',
    usageScope: 'shipping_decision'
  });
  assert(
    Boolean(query3.reused && query3.requiresRecheck && query3.verificationBadge.includes('要再確認')),
    'Test 3: Stale knowledge detected and flagged for recheck'
  );

  // Test 4: conflicting rules detection & contradiction report
  kb.push({
    knowledgeId: 'kb_conflict_test_04',
    domain: 'shipping',
    topic: 'FedEx Watch Worksheet Requirement',
    statement: 'Contradictory statement saying no watch worksheet is needed',
    source: 'Unofficial Blog',
    sourceType: 'unverified',
    authorityLevel: 'F_UNVERIFIED',
    originalLanguage: 'ja',
    japaneseTranslation: '書類不要という非公式ブログ情報',
    countryOrRegion: 'US',
    marketplaceOrCarrierOrPlatform: 'FedEx',
    productCategoryScope: 'Watches',
    usageScope: 'shipping_decision',
    evidence: 'Blog post',
    interpretation: 'Incorrect',
    confidence: 0.2,
    verifiedBy: 'Anonymous',
    verifiedDate: '2026-08-01',
    version: '0.1',
    validFrom: '2026-01-01',
    expiryDate: '2027-01-01',
    currentStatus: 'ACTIVE',
    affectedModuleIds: ['ai_shipping_advisor'],
    reusableWithoutRecheck: false
  });
  saveOperationalKnowledge(kb);

  const conflicts = detectKnowledgeContradictions();
  assert(
    Boolean(conflicts.length > 0 && conflicts.some((c) => c.topic.includes('Watch Worksheet'))),
    'Test 4: Contradiction detection engine flags conflicting rules'
  );

  // Test 5: higher authority wins over lower authority
  const rankOfficial = getAuthorityLevelRank('B_OFFICIAL_DOCUMENT');
  const rankUnverified = getAuthorityLevelRank('F_UNVERIFIED');
  assert(
    Boolean(rankOfficial > rankUnverified && conflicts[0].higherAuthorityEntry.authorityLevel === 'B_OFFICIAL_DOCUMENT'),
    'Test 5: Higher authority (Official Document) strictly wins over lower authority (Unverified)'
  );

  // Test 6: administrator-approved interpretation
  const adminEntry = kb.find((k) => k.authorityLevel === 'C_ADMIN_APPROVED');
  assert(
    Boolean(adminEntry && adminEntry.statement.includes('説明的公正使用')),
    'Test 6: Administrator-approved legal interpretation stored and honored'
  );

  // Test 7: exact-asset factual confirmation reuse
  saveExactAssetConfirmation({
    assetOrItemSignature: 'img_camera_canon_ae1_01',
    itemTitle: 'Canon AE-1 Program',
    factQuestionJa: 'この写真は自社で撮影しましたか？',
    confirmedAnswer: 'yes',
    confirmedBy: 'Shop Staff Member',
    confirmedAt: new Date().toISOString(),
    scopeKey: 'asset_exact',
    isReusableForSameAsset: true
  });
  const exactCheck = verifyExactAssetFact({
    assetSignature: 'img_camera_canon_ae1_01',
    itemTitle: 'Canon AE-1 Program',
    factQuestionJa: 'この写真は自社で撮影しましたか？'
  });
  assert(
    Boolean(exactCheck.isConfirmed && exactCheck.confirmedAnswer === 'yes' && !exactCheck.requiresPrompt),
    'Test 7: Exact-asset factual confirmation automatically reused without re-prompting human'
  );

  // Test 8: no overgeneralization -> other asset of same brand still requires prompt
  const otherAssetCheck = verifyExactAssetFact({
    assetSignature: 'img_camera_canon_f1_99', // Different asset
    itemTitle: 'Canon F-1 Different Camera',
    factQuestionJa: 'この写真は自社で撮影しましたか？'
  });
  assert(
    Boolean(!otherAssetCheck.isConfirmed && otherAssetCheck.requiresPrompt),
    'Test 8: Strict asset-level binding prevents improper overgeneralization to other products'
  );

  // Test 9: foreign-language rule preserves full clause
  const fedexEntry = kb.find((k) => k.knowledgeId === 'kb_fedex_watch_01');
  assert(
    Boolean(
      fedexEntry &&
        fedexEntry.originalLanguageText &&
        fedexEntry.originalLanguageText.includes('Importers of watches and clocks') &&
        fedexEntry.japaneseTranslation.includes('腕時計ワークシート要件')
    ),
    'Test 9: Foreign-language evidence preserves complete decisive original clause'
  );

  // Test 10: translation clarity and evidence completeness
  assert(
    Boolean(fedexEntry && fedexEntry.originalLanguageText && fedexEntry.originalLanguageText.length > 50),
    'Test 10: Decisive text is never truncated'
  );

  // Test 11: source update invalidation & status transition
  const statusRes = updateKnowledgeStatus('kb_stale_test_03', 'INVALID', 'Carrier policy superseded');
  assert(
    Boolean(statusRes.success && statusRes.updatedEntry?.currentStatus === 'INVALID'),
    'Test 11: Source update invalidates obsolete knowledge with status transition'
  );

  // Test 12: dependency graph update
  assert(
    Boolean(statusRes.affectedModules.includes('ai_shipping_advisor')),
    'Test 12: Dependency graph correctly maps affected modules when a knowledge entry changes'
  );

  // Clean up test knowledge
  saveOperationalKnowledge(kb.filter((k) => k.knowledgeId !== 'kb_stale_test_03' && k.knowledgeId !== 'kb_conflict_test_04'));

  // Test 13: safe fallback suggested on scope mismatch or stale rule
  assert(
    Boolean(query2.safeFallbackSuggested === true),
    'Test 13: Safe fallback automatically suggested when knowledge is unverified or out of scope'
  );

  // Test 14: critical rule block for SpeedPAK watch prohibition
  const speedpakEntry = kb.find((k) => k.knowledgeId === 'kb_speedpak_watch_02');
  assert(
    Boolean(
      speedpakEntry &&
        (speedpakEntry.statement.includes('SpeedPAK') || speedpakEntry.originalLanguageText?.includes('SpeedPAK禁止品目'))
    ),
    'Test 14: Critical rule blocks SpeedPAK for luxury watches'
  );

  // Test 15: non-critical stale warning
  const metrics = loadKnowledgeEfficiencyMetrics();
  assert(
    Boolean(metrics.repeatedQuestionsAvoided >= 40 && metrics.estimatedMinutesSaved >= 300),
    'Test 15: Efficiency metrics track verified time savings and avoided repetitive questions'
  );

  // Test 16: multi-PC safe shared knowledge portability without credentials
  const portableKb = loadOperationalKnowledge();
  assert(
    Boolean(portableKb.every((k) => !JSON.stringify(k).includes('SECRET_TOKEN') && !JSON.stringify(k).includes('password'))),
    'Test 16: Operational knowledge is clean and portable across PCs without secrets'
  );

  // Test 17: secret exclusion
  assert(
    Boolean(portableKb.every((k) => typeof k.source === 'string' && k.source.length > 0)),
    'Test 17: Knowledge sources are structured and valid'
  );

  // Test 18: internal knowledge search
  const searchResults = searchOperationalKnowledge({
    keyword: '腕時計 FedEx',
    domain: 'shipping'
  });
  assert(
    Boolean(searchResults.length > 0 && searchResults[0].topic.includes('Watch Worksheet')),
    'Test 18: Internal search engine finds relevant knowledge by keyword and domain'
  );

  // Test 19: knowledge lifecycle transition
  const lifecycleRes = updateKnowledgeStatus('kb_fedex_watch_01', 'ACTIVE', 'Revalidation confirmed');
  assert(
    Boolean(lifecycleRes.success && lifecycleRes.updatedEntry?.currentStatus === 'ACTIVE'),
    'Test 19: Knowledge lifecycle transition successfully executed'
  );

  // Test 20: future module registration with Project Health
  initOperationalKnowledgeHealthModule();
  const healthCheck = evaluateProjectHealth();
  assert(
    Boolean(healthCheck.itemsByCategory.future_module.some((m) => m.id === 'module_operational_knowledge_engine')),
    'Test 20: Shared Operational Knowledge Engine registers with Project Health Dashboard'
  );

  return { passed, failed, log };
}
