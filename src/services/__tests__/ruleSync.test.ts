/**
 * Unit Test Suite for Automatic Compliance-Rule Synchronization & Pre-Action Verification Engine
 */

import {
  triggerAutomaticSync,
  performPreActionVerification,
  loadSourceHealth,
  saveSourceHealth,
  loadPolicyProposals,
  savePolicyProposals,
  approvePolicyProposal,
  rollbackRuleVersion,
  addSyncNotification,
  loadSyncNotifications,
  checkExistingListingImpacts
} from '../ruleSyncService';
import { UnstructuredPolicyProposal } from '../../types/ruleSync';

export function runRuleSyncTests(): { passed: number; failed: number; log: string[] } {
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

  // Test 1: Application-start automatic update trigger
  const sync1 = triggerAutomaticSync(false);
  assert(Boolean(sync1.success && sync1.updatedSourcesCount > 0), 'Test 1: Application-start automatic update trigger');

  // Test 2: 24-hour scheduled refresh interval
  const sources = loadSourceHealth();
  const nextSyncTime = new Date(sources[0].nextScheduledSync).getTime();
  const lastSyncTime = new Date(sources[0].lastSuccessfulSync).getTime();
  const hoursDiff = Math.round((nextSyncTime - lastSyncTime) / (1000 * 60 * 60));
  assert(Boolean(hoursDiff === 24), 'Test 2: 24-hour scheduled refresh interval setting');

  // Test 3: Pre-publication verification gate
  const gatePub = performPreActionVerification('publication');
  assert(Boolean(gatePub.canProceed), 'Test 3: Pre-publication verification gate check');

  // Test 4: Pre-shipment verification gate
  const gateShip = performPreActionVerification('shipment_completion');
  assert(Boolean(gateShip.canProceed), 'Test 4: Pre-shipment verification gate check');

  // Test 5: Automatic structured API update
  const sync5 = triggerAutomaticSync(false);
  assert(Boolean(sync5.success && sync5.message.includes('自動同期')), 'Test 5: Automatic structured API update');

  // Test 6: Unstructured policy proposal requiring administrator approval
  const sampleProposal: UnstructuredPolicyProposal = {
    proposalId: 'prop_test_01',
    ruleId: 'rule_watch_luxury_01',
    currentRuleText: 'FedEx Watch Worksheet Optional',
    proposedRuleText: 'FedEx Watch Worksheet Mandatory for all watches over $2,000',
    sourceName: 'Official Carrier Email Bulletin',
    publicationDate: '2026-08-07',
    affectedCategories: ['Watches & Jewelry'],
    affectedServices: ['FedEx International Connect Plus'],
    expectedOperationalImpact: 'Requires Watch Worksheet attachment before shipment',
    status: 'pending_approval',
    submittedAt: new Date().toISOString()
  };
  savePolicyProposals([sampleProposal]);
  const proposals = loadPolicyProposals();
  assert(Boolean(proposals.some((p) => p.proposalId === 'prop_test_01' && p.status === 'pending_approval')), 'Test 6: Unstructured policy proposal requiring administrator approval');

  // Test 7: Stale blocking rule fail-safe error message
  const gateFail = performPreActionVerification('publication');
  assert(
    Boolean(
      !gateFail.canProceed &&
        gateFail.isStaleRuleDetected &&
        gateFail.japaneseErrorMessage?.includes('最新の配送規則を確認できないため')
    ),
    'Test 7: Stale blocking rule triggers fail-safe Japanese error message'
  );

  // Test 8: Administrator approval of policy proposal
  const approved = approvePolicyProposal('prop_test_01', 'Admin Officer');
  const gateAfterApprove = performPreActionVerification('publication');
  assert(Boolean(approved && gateAfterApprove.canProceed), 'Test 8: Administrator approval unlocks pre-action gate');

  // Test 9: Update failure handling
  const brokenSources = sources.map((s) => ({ ...s, status: 'failed' as const }));
  saveSourceHealth(brokenSources);
  const gateBroken = performPreActionVerification('shipment_completion');
  assert(Boolean(!gateBroken.canProceed && gateBroken.blockingReasons.length > 0), 'Test 9: Source health failure properly blocks shipment');

  // Clean sources back to healthy
  triggerAutomaticSync(false);

  // Test 10: Affected existing listing scan & correction action
  const impacts = checkExistingListingImpacts();
  assert(Boolean(impacts.length > 0 && impacts[0].requiredCorrectionAction.length > 0), 'Test 10: Existing listing impact scan and correction action');

  // Test 11: Duplicate notification prevention
  addSyncNotification('service_unavailable', 'Carrier Notice', 'SpeedPAK Service Interruption Alert');
  addSyncNotification('service_unavailable', 'Carrier Notice', 'SpeedPAK Service Interruption Alert'); // Duplicate
  const notifs = loadSyncNotifications();
  const matching = notifs.filter((n) => n.title === 'Carrier Notice');
  assert(Boolean(matching.length === 1), 'Test 11: Duplicate notification prevention (deduplication)');

  // Test 12: Rule rollback capability by administrator
  const rolledBack = rollbackRuleVersion('rule_watch_luxury_01', 'Admin Officer', 'Reverted back to previous specification');
  assert(Boolean(rolledBack), 'Test 12: Rule rollback by administrator');

  // Test 13: Manual emergency refresh button trigger
  const manualSync = triggerAutomaticSync(true);
  assert(Boolean(manualSync.success && manualSync.message.includes('最新ルールを今すぐ再確認')), 'Test 13: Manual emergency refresh trigger');

  return { passed, failed, log };
}
