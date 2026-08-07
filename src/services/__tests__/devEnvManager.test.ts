/**
 * Unit Test Suite for AI Development Environment Manager & Multi-PC Workflow
 */

import {
  detectEnvironmentStatus,
  performReadinessCheck,
  executeSafeOneClickUpdate,
  verifyPortableProjectCompatibility,
  CURRENT_APPLICATION_VERSION
} from '../devEnvManagerService';

export function runDevEnvManagerTests(): { passed: number; failed: number; log: string[] } {
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

  // Test 1: Existing configured PC already current
  const env1 = detectEnvironmentStatus({ isBehind: false, hasUncommittedChanges: false });
  assert(Boolean(env1.pcState === 'configured_up_to_date'), 'Test 1: Existing configured PC already current');

  // Test 2: Existing PC behind remote
  const env2 = detectEnvironmentStatus({ isBehind: true, hasUncommittedChanges: false });
  assert(Boolean(env2.pcState === 'configured_github_update_available'), 'Test 2: Existing PC behind remote (GitHub update available)');

  // Test 3: Local uncommitted changes & Safety Gate
  const env3 = detectEnvironmentStatus({ hasUncommittedChanges: true });
  const updateRes3 = executeSafeOneClickUpdate(env3);
  assert(
    Boolean(
      env3.pcState === 'local_changes_exist' &&
        updateRes3.requiresSafetyGate &&
        updateRes3.safetyGateMessage?.includes('未保存の開発変更があります')
    ),
    'Test 3: Local uncommitted changes triggers safety gate warning'
  );

  // Test 4: Local unpushed commit
  const env4 = detectEnvironmentStatus({ hasUnpushedCommits: true, hasUncommittedChanges: false, isBehind: false });
  assert(Boolean(env4.hasUnpushedCommits && env4.pcState === 'ready_for_dev'), 'Test 4: Local unpushed commit status check');

  // Test 5: Branch divergence (conflict risk)
  const env5 = detectEnvironmentStatus({ isDiverged: true });
  assert(Boolean(env5.pcState === 'git_diverged_conflict_risk'), 'Test 5: Branch divergence detects conflict risk');

  // Test 6: First-time PC detection
  const env6 = detectEnvironmentStatus({ isGitRepo: false });
  assert(Boolean(env6.pcState === 'first_time_setup'), 'Test 6: Missing Git repository detects first-time setup');

  // Test 7: Missing node_modules
  const env7 = detectEnvironmentStatus({ nodeModulesExist: false, envVarsValid: false });
  const readiness7 = performReadinessCheck(env7);
  assert(Boolean(!readiness7.allReady && readiness7.items.some((i) => i.key === 'dependencies' && i.status === 'error')), 'Test 7: Missing node_modules triggers dependency error');

  // Test 8: Dependency change triggers npm install step
  const env8 = detectEnvironmentStatus({ isBehind: true, hasUncommittedChanges: false });
  const updateRes8 = executeSafeOneClickUpdate(env8);
  assert(Boolean(updateRes8.success && updateRes8.steps.some((s) => s.stepName === 'npm install' && s.status === 'success')), 'Test 8: Dependency change triggers npm install step');

  // Test 9: Chrome extension status check
  const env9 = detectEnvironmentStatus({ chromeExtensionFolderExist: true });
  const readiness9 = performReadinessCheck(env9);
  assert(Boolean(readiness9.items.some((i) => i.key === 'chrome_ext' && i.status === 'ok')), 'Test 9: Chrome extension status check');

  // Test 10: Missing environment variable detection
  const env10 = detectEnvironmentStatus({ envVarsValid: false, missingEnvVars: ['VITE_EBAY_CLIENT_ID'] });
  const readiness10 = performReadinessCheck(env10);
  assert(Boolean(readiness10.items.some((i) => i.key === 'env_vars' && i.status === 'warning')), 'Test 10: Missing environment variable detection');

  // Test 11: Development server offline status
  const env11 = detectEnvironmentStatus({ localhostServerOnline: false });
  const readiness11 = performReadinessCheck(env11);
  assert(Boolean(readiness11.items.some((i) => i.key === 'localhost_server' && i.status === 'warning')), 'Test 11: Development server offline status');

  // Test 12: Safe one-click update execution with stash
  const env12 = detectEnvironmentStatus({ hasUncommittedChanges: true, isBehind: true });
  const updateRes12 = executeSafeOneClickUpdate(env12, 'stash');
  assert(Boolean(updateRes12.success && updateRes12.steps.some((s) => s.stepName === 'git stash')), 'Test 12: Safe one-click update with stash option');

  // Test 13: Portable project version mismatch check
  const comp13 = verifyPortableProjectCompatibility('Ver. 4.0');
  assert(Boolean(!comp13.isCompatible && comp13.warningMessage?.includes('上位互換性がありません')), 'Test 13: Newer incompatible portable project version warning');

  return { passed, failed, log };
}
