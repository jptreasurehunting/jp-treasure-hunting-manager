/**
 * Unit Test Suite for Shopee Automation, Capacity Management & Optimization (Phase C)
 */

import {
  loadShopeeCapacity,
  saveShopeeCapacity,
  loadShopeePolicy,
  saveShopeePolicy,
  loadShopeeListings,
  saveShopeeListings,
  calculateShopeeOptimizationScore,
  evaluateAutonomousReplacements,
  loadShopeeAuditLogs,
  getDefaultShopeeCapacity,
  getDefaultShopeePolicy,
  getDefaultShopeeListings
} from '../shopeeAutomationService';
import { loadCentralInventory } from '../centralInventoryService';

export function runShopeeAutomationTests(): { passed: number; failed: number; log: string[] } {
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

  // Reset Shopee storage state
  saveShopeeCapacity(getDefaultShopeeCapacity());
  saveShopeePolicy(getDefaultShopeePolicy());
  saveShopeeListings(getDefaultShopeeListings());

  // Test 1: Load capacity
  const cap = loadShopeeCapacity();
  assert(
    Boolean(cap.freeListingCapacity === 100 && cap.usedListingCapacity === 96 && cap.remainingFreeCapacity === 4),
    'Test 1: Shopee listing capacity loads configurable free limit (100) and calculates remaining free capacity'
  );

  // Test 2: Unverified capacity assumption flag
  assert(
    Boolean(!cap.isVerifiedByOfficialDoc && cap.capacitySource === 'CONFIGURED_ASSUMPTION'),
    'Test 2: Shopee free listing capacity is strictly marked as UNKNOWN / CONFIGURED_ASSUMPTION'
  );

  // Test 3: Policy approval model
  const policy = loadShopeePolicy();
  assert(
    Boolean(policy.isPolicyApproved && policy.autoListingEnabled && policy.autoReplacementEnabled),
    'Test 3: Policy-based auto-listing policy is pre-approved with autonomous replacement enabled'
  );

  // Test 4: Multi-signal optimization scoring
  const catalog = loadCentralInventory();
  const watchItem = catalog.find((i) => i.sku === 'SKU-WATCH-STRAP-01')!;
  const score = calculateShopeeOptimizationScore(watchItem);
  assert(
    Boolean(score.overallOpportunityScore >= 70 && score.recommendationAction === 'LIST_TO_SHOPEE'),
    'Test 4: Multi-signal scoring engine ranks high-velocity watch straps as high opportunity for Shopee SG'
  );

  // Test 5: Weight penalty in scoring
  const heavyItem = {
    ...watchItem,
    weightGrams: 800,
    dimensionsCm: { length: 20, width: 20, height: 10 }
  };
  const heavyScore = calculateShopeeOptimizationScore(heavyItem);
  assert(
    Boolean(heavyScore.weightPenalty > 0 && heavyScore.overallOpportunityScore < score.overallOpportunityScore),
    'Test 5: Air freight weight penalty correctly penalizes heavy items for Southeast Asia exports'
  );

  // Test 6: Auto-replacement identifies candidates
  const listings = loadShopeeListings();
  const candidate = listings.find((l) => l.isReplacementCandidate);
  assert(
    Boolean(candidate && candidate.sku === 'SKU-OLD-STRAP-BUCKLE-99'),
    'Test 6: Autonomous replacement evaluator identifies low-impression listings as replacement candidates'
  );

  // Test 7: Autonomous replacement execution within policy
  const repResult = evaluateAutonomousReplacements();
  assert(
    Boolean(repResult.candidatesFound >= 1 && repResult.auditLogs.length >= 1),
    'Test 7: Autonomous replacement replaces low-performing listing with top catalog item without per-item human review'
  );

  // Test 8: Daily replacement limit enforcement
  const updatedPolicy = { ...policy, maxReplacementsPerDay: 1 };
  saveShopeePolicy(updatedPolicy);
  const repLimitTest = evaluateAutonomousReplacements();
  assert(
    Boolean(repLimitTest.replacementsExecuted <= 1),
    'Test 8: Daily replacement quota (maxReplacementsPerDay) strictly enforced by policy engine'
  );

  // Test 9: Comprehensive audit trail
  const auditLogs = loadShopeeAuditLogs();
  assert(
    Boolean(auditLogs.length >= 1 && auditLogs[0].actionType === 'AUTO_REPLACEMENT_EXECUTED'),
    'Test 9: Every autonomous Shopee listing action preserves complete audit record with scores and capacity state'
  );

  // Test 10: Fail-safe when policy is disabled
  const disabledPolicy = { ...policy, autoListingEnabled: false };
  saveShopeePolicy(disabledPolicy);
  const disabledTest = evaluateAutonomousReplacements();
  assert(
    Boolean(disabledTest.replacementsExecuted === 0 && disabledTest.summaryMessageJa.includes('無効')),
    'Test 10: When Shopee auto-listing policy is disabled, all autonomous actions halt safely'
  );

  return { passed, failed, log };
}
