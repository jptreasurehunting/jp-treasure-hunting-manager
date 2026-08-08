/**
 * Unit Test Suite for Safe Automation Policy & Risk-Based Approval Engine (Specs #1 - #18)
 */

import {
  evaluateActionRiskAndPolicy,
  resolvePrecedence,
  registerCustomActionDefinition,
  loadAutomationPolicies,
  saveAutomationPolicies,
  getAntigravityGuidance,
  loadSafeAutomationAuditTrail,
  initSafeAutomationHealthModule
} from '../safeAutomationPolicyService';
import { evaluateProjectHealth } from '../projectHealthService';

export function runSafeAutomationPolicyTests(): { passed: number; failed: number; log: string[] } {
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

  // Test 1: build auto-allowed
  const eval1 = evaluateActionRiskAndPolicy({ commandOrAction: 'npm run build' });
  assert(
    Boolean(eval1.canAutoRun && eval1.riskLevel === 'LOW_RISK' && eval1.decision === 'ALLOW'),
    'Test 1: npm run build is auto-allowed as LOW_RISK'
  );

  // Test 2: type check auto-allowed
  const eval2 = evaluateActionRiskAndPolicy({ commandOrAction: 'npx tsc --noEmit' });
  assert(
    Boolean(eval2.canAutoRun && eval2.riskLevel === 'LOW_RISK' && eval2.decision === 'ALLOW'),
    'Test 2: npx tsc --noEmit is auto-allowed as LOW_RISK'
  );

  // Test 3: test auto-allowed
  const eval3 = evaluateActionRiskAndPolicy({ commandOrAction: 'npm test' });
  assert(
    Boolean(eval3.canAutoRun && eval3.riskLevel === 'LOW_RISK' && eval3.decision === 'ALLOW'),
    'Test 3: npm test is auto-allowed as LOW_RISK'
  );

  // Test 4: git status auto-allowed
  const eval4 = evaluateActionRiskAndPolicy({ commandOrAction: 'git status' });
  assert(
    Boolean(eval4.canAutoRun && eval4.riskLevel === 'LOW_RISK' && eval4.decision === 'ALLOW'),
    'Test 4: git status is auto-allowed as read-only LOW_RISK'
  );

  // Test 5: git fetch classified safely
  const eval5 = evaluateActionRiskAndPolicy({ commandOrAction: 'git fetch' });
  assert(
    Boolean(eval5.canAutoRun && eval5.riskLevel === 'LOW_RISK' && eval5.decision === 'ALLOW'),
    'Test 5: git fetch is classified safely as read-only with respect to working tree'
  );

  // Test 6: git pull clean/safe -> allowed when working tree is clean and no divergence
  const eval6 = evaluateActionRiskAndPolicy({
    commandOrAction: 'git pull',
    isWorkingTreeClean: true,
    isDiverged: false,
    hasUncommittedChanges: false
  });
  assert(
    Boolean(eval6.canAutoRun && eval6.decision === 'ALLOW'),
    'Test 6: git pull is allowed when working tree is completely clean and no divergence'
  );

  // Test 7: git pull with local changes -> requires confirmation
  const eval7 = evaluateActionRiskAndPolicy({
    commandOrAction: 'git pull',
    isWorkingTreeClean: false,
    hasUncommittedChanges: true
  });
  assert(
    Boolean(!eval7.canAutoRun && eval7.decision === 'REQUIRE_CONFIRMATION' && eval7.contextWarnings.length > 0),
    'Test 7: git pull with local uncommitted changes requires human confirmation'
  );

  // Test 8: git divergence -> requires confirmation
  const eval8 = evaluateActionRiskAndPolicy({
    commandOrAction: 'git pull',
    isWorkingTreeClean: true,
    isDiverged: true
  });
  assert(
    Boolean(!eval8.canAutoRun && eval8.decision === 'REQUIRE_CONFIRMATION' && eval8.contextWarnings.some((w) => w.includes('分岐'))),
    'Test 8: git pull with divergence requires human confirmation'
  );

  // Test 9: git push confirmation required
  const eval9 = evaluateActionRiskAndPolicy({ commandOrAction: 'git push' });
  assert(
    Boolean(
      !eval9.canAutoRun &&
        eval9.riskLevel === 'HIGH_RISK' &&
        eval9.decision === 'REQUIRE_CONFIRMATION' &&
        eval9.confirmationPrompt?.riskCategoryJa.includes('外部リポジトリ')
    ),
    'Test 9: git push strictly requires human confirmation with business meaning explanation'
  );

  // Test 10: git reset --hard blocked by default
  const eval10 = evaluateActionRiskAndPolicy({ commandOrAction: 'git reset --hard' });
  assert(
    Boolean(!eval10.canAutoRun && eval10.riskLevel === 'BLOCKED' && eval10.decision === 'BLOCK'),
    'Test 10: git reset --hard is strictly BLOCKED from automatic execution'
  );

  // Test 11: destructive delete blocked
  const eval11 = evaluateActionRiskAndPolicy({ commandOrAction: 'rm -rf ./dist' });
  assert(
    Boolean(!eval11.canAutoRun && eval11.riskLevel === 'BLOCKED' && eval11.decision === 'BLOCK'),
    'Test 11: Destructive recursive deletion is strictly BLOCKED'
  );

  // Test 12: npm install context-sensitive (MEDIUM RISK)
  const eval12 = evaluateActionRiskAndPolicy({ commandOrAction: 'npm install lodash' });
  assert(
    Boolean(eval12.riskLevel === 'MEDIUM_RISK' && eval12.decision === 'REQUIRE_CONFIRMATION'),
    'Test 12: npm install is context-sensitive MEDIUM_RISK requiring confirmation'
  );

  // Test 13: production API write / financial transfer confirmation
  const eval13 = evaluateActionRiskAndPolicy({ commandOrAction: 'payment:executeTransfer' });
  assert(
    Boolean(!eval13.canAutoRun && eval13.riskLevel === 'HIGH_RISK' && eval13.decision === 'REQUIRE_CONFIRMATION'),
    'Test 13: Financial payment / transfer strictly requires human confirmation'
  );

  // Test 14: marketplace publication confirmation
  const eval14 = evaluateActionRiskAndPolicy({ commandOrAction: 'ebay:publishListing' });
  assert(
    Boolean(!eval14.canAutoRun && eval14.riskLevel === 'HIGH_RISK' && eval14.decision === 'REQUIRE_CONFIRMATION'),
    'Test 14: Marketplace listing publication strictly requires human confirmation'
  );

  // Test 15: repeated approvals do not override high-risk rule
  const eval15 = evaluateActionRiskAndPolicy({ commandOrAction: 'git push' });
  assert(
    Boolean(!eval15.canAutoRun && eval15.stats?.totalApprovals === 25 && eval15.decision === 'REQUIRE_CONFIRMATION'),
    'Test 15: Repeated approvals (25 times) do not auto-promote high-risk git push to auto-run'
  );

  // Test 16: restrictive policy precedence (BLOCK > REQUIRE_CONFIRMATION > ALLOW)
  const prec1 = resolvePrecedence(['ALLOW', 'REQUIRE_CONFIRMATION']);
  const prec2 = resolvePrecedence(['ALLOW', 'BLOCK']);
  const prec3 = resolvePrecedence(['REQUIRE_CONFIRMATION', 'BLOCK', 'ALLOW']);
  assert(
    Boolean(prec1 === 'REQUIRE_CONFIRMATION' && prec2 === 'BLOCK' && prec3 === 'BLOCK'),
    'Test 16: Policy precedence enforces BLOCK > REQUIRE_CONFIRMATION > ALLOW'
  );

  // Test 17: administrator-approved auto policy
  const policies = loadAutomationPolicies();
  const hasAutoBuild = policies.some((p) => p.actionPattern === 'npm run build' && p.decision === 'ALLOW');
  assert(
    Boolean(hasAutoBuild),
    'Test 17: Administrator-approved auto policy exists for safe build command'
  );

  // Test 18: operator-level user cannot override high-risk rule
  const eval18 = evaluateActionRiskAndPolicy({
    commandOrAction: 'git push',
    operatorRole: 'operator'
  });
  assert(
    Boolean(!eval18.canAutoRun && eval18.decision === 'REQUIRE_CONFIRMATION'),
    'Test 18: Operator role cannot override high-risk confirmation gate'
  );

  // Test 19: multi-PC mismatch / incompatible portable project requires confirmation
  const eval19 = evaluateActionRiskAndPolicy({
    commandOrAction: 'git pull',
    isWorkingTreeClean: true,
    isPortableProjectCompatible: false
  });
  assert(
    Boolean(!eval19.canAutoRun && eval19.contextWarnings.some((w) => w.includes('ポータブル'))),
    'Test 19: Multi-PC portable project mismatch prevents automatic pull'
  );

  // Test 20: audit log creation without secrets
  const auditLogs = loadSafeAutomationAuditTrail();
  assert(
    Boolean(auditLogs.length > 0 && auditLogs.every((l) => !l.detailsJa.includes('SECRET'))),
    'Test 20: Audit logs created properly without storing secret credentials'
  );

  // Test 21: future action registration
  registerCustomActionDefinition({
    actionId: 'custom_sns_publish',
    signaturePattern: 'sns:publishPost',
    category: 'sns',
    baseRiskLevel: 'HIGH_RISK',
    defaultPrecedence: 'REQUIRE_CONFIRMATION',
    businessNameJa: 'SNSアカウントへ投稿を公式公開',
    technicalCommand: 'publishSnsPost()',
    externalImpact: 'social_media',
    isDestructive: false,
    isIrreversible: true
  });
  const eval21 = evaluateActionRiskAndPolicy({ commandOrAction: 'sns:publishPost' });
  assert(
    Boolean(!eval21.canAutoRun && eval21.riskLevel === 'HIGH_RISK'),
    'Test 21: Future custom action dynamically registered and evaluated correctly'
  );

  // Test 22: Project Health integration
  initSafeAutomationHealthModule();
  const health22 = evaluateProjectHealth();
  assert(
    Boolean(health22.itemsByCategory.future_module.some((m) => m.id === 'module_safe_automation_policy')),
    'Test 22: Safe Automation Policy registers with Project Health Dashboard'
  );

  // Test 23: Antigravity IDE guidance items
  const guidance = getAntigravityGuidance();
  assert(
    Boolean(guidance.length >= 5 && guidance.some((g) => g.recommendedSetting === 'AUTO_APPROVE')),
    'Test 23: Antigravity IDE configuration guidance generated with recommended settings'
  );

  return { passed, failed, log };
}
