/**
 * Unit Test Suite for Project Health Dashboard & Safety Architecture (Specs #1 - #13)
 */

import {
  evaluateProjectHealth,
  checkBusinessReadiness,
  runDevelopmentDiagnostics,
  runBusinessDiagnostics,
  refreshProjectHealth,
  registerHealthCheckModule,
  unregisterHealthCheckModule,
  getRegisteredHealthModules,
  getStatusDisplayLabel,
  getAuthorityLevelDisplayLabel
} from '../projectHealthService';
import { initRuleFreshnessHealthModule } from '../ruleFreshnessService';
import { initShipmentReadinessHealthModule } from '../shipmentReadinessService';
import { initShippingRouterHealthModule } from '../shippingRouterService';
import { initCentralInventoryHealthModule } from '../centralInventoryService';
import { initConsolidationHealthModule } from '../consolidationService';
import { initShopeeAutomationHealthModule } from '../shopeeAutomationService';
import { HealthCheckModulePlugin } from '../../types/projectHealth';

export function runProjectHealthTests(): { passed: number; failed: number; log: string[] } {
  try {
    localStorage.clear();
    unregisterHealthCheckModule('module_central_inventory_sync');
    unregisterHealthCheckModule('module_shopee_automation_engine');
    unregisterHealthCheckModule('module_shipment_consolidation_engine');
    unregisterHealthCheckModule('module_shipping_router_engine');
    unregisterHealthCheckModule('module_shipment_readiness_engine');
    unregisterHealthCheckModule('module_rule_freshness_engine');
    unregisterHealthCheckModule('module_knowledge_orchestrator');
  } catch (e) {
    // Ignore
  }

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

  // Test 1: All healthy default environment -> 「業務開始可能」
  const health1 = evaluateProjectHealth();
  assert(
    Boolean(health1.overallStatus === 'ready' && health1.canProceed && health1.overallStatusLabel === '業務開始可能'),
    'Test 1: All healthy environment produces 「業務開始可能」'
  );

  // Test 2: Git behind remote -> 🟡 要確認
  const health2 = evaluateProjectHealth({
    forceDevEnvOverrides: { isBehind: true, hasUncommittedChanges: false }
  });
  assert(
    Boolean(health2.overallStatus === 'needs_verification' && health2.overallStatusLabel === '要確認'),
    'Test 2: Git behind remote produces 🟡 要確認'
  );

  // Test 3: Git divergence -> ⛔ 処理停止 & Critical warning visible
  const health3 = evaluateProjectHealth({
    forceDevEnvOverrides: { isDiverged: true }
  });
  assert(
    Boolean(
      health3.overallStatus === 'blocked' &&
        !health3.canProceed &&
        health3.criticalWarnings.some((w) => w.id === 'dev_sync') &&
        health3.blockingReasons.some((r) => r.includes('Git divergence'))
    ),
    'Test 3: Git divergence produces ⛔ 処理停止 and critical warning'
  );

  // Test 4: Missing environment variable -> ⛔ 処理停止 (even if score high)
  const health4 = evaluateProjectHealth({
    forceDevEnvOverrides: {
      envVarsValid: false,
      missingEnvVars: ['VITE_EBAY_CLIENT_ID']
    }
  });
  assert(
    Boolean(
      health4.overallStatus === 'blocked' &&
        !health4.canProceed &&
        health4.blockingReasons.some((r) => r.includes('必須の環境変数'))
    ),
    'Test 4: Missing required environment variable produces ⛔ 処理停止'
  );

  // Test 5: Development server unavailable -> 🟡 要確認
  const health5 = evaluateProjectHealth({
    forceDevEnvOverrides: { localhostServerOnline: false }
  });
  assert(
    Boolean(
      health5.overallStatus === 'needs_verification' &&
        health5.itemsByCategory.dev_env.some((i) => i.id === 'dev_localhost_server' && i.status === 'needs_check')
    ),
    'Test 5: Development server unavailable produces 🟡 要確認'
  );

  // Test 6: Chrome extension unavailable -> 🟡 要確認
  const health6 = evaluateProjectHealth({
    forceDevEnvOverrides: { chromeExtensionFolderExist: false }
  });
  assert(
    Boolean(
      health6.overallStatus === 'needs_verification' &&
        health6.itemsByCategory.dev_env.some((i) => i.id === 'dev_chrome_ext' && i.status === 'needs_check')
    ),
    'Test 6: Chrome extension unavailable produces 🟡 要確認'
  );

  // Test 7: eBay authentication failure -> ⛔ 処理停止
  const health7 = evaluateProjectHealth({
    forceEbayAuthError: true
  });
  assert(
    Boolean(
      health7.overallStatus === 'blocked' &&
        !health7.canProceed &&
        health7.criticalWarnings.some((w) => w.id === 'app_ebay_api_connection')
    ),
    'Test 7: eBay authentication failure produces ⛔ 処理停止'
  );

  // Test 8: Stale shipping rule -> ⚠ 要再取得 & 「要確認」
  const health8 = evaluateProjectHealth({
    forceStaleShippingRule: true
  });
  assert(
    Boolean(
      health8.overallStatus === 'needs_verification' &&
        health8.itemsByCategory.shipping_rules.some(
          (i) => i.id === 'rule_ebay_shipping_compliance' && i.status === 'needs_refetch'
        )
    ),
    'Test 8: Stale shipping rule produces ⚠ 要再取得 and 「要確認」'
  );

  // Test 9: Carrier rule update failure -> ❌ エラー & ⛔ 処理停止
  const health9 = evaluateProjectHealth({
    forceCarrierSyncFailure: true
  });
  assert(
    Boolean(
      health9.overallStatus === 'blocked' &&
        health9.itemsByCategory.shipping_rules.some((i) => i.id === 'rule_fedex' && i.status === 'error')
    ),
    'Test 9: Carrier rule update failure produces ❌ エラー and ⛔ 処理停止'
  );

  // Test 10: DDU blocking condition -> ⛔ 処理停止 & Critical warning
  const health10 = evaluateProjectHealth({
    forceDduCondition: true
  });
  assert(
    Boolean(
      health10.overallStatus === 'blocked' &&
        !health10.canProceed &&
        health10.criticalWarnings.some((w) => w.id === 'app_shipping_compliance_engine')
    ),
    'Test 10: DDU blocking condition produces ⛔ 処理停止 and critical warning'
  );

  // Test 11: Missing required document (AG EVTN / Worksheet) -> ⛔ 処理停止
  const health11 = evaluateProjectHealth({
    forceMissingDocument: true
  });
  assert(
    Boolean(
      health11.overallStatus === 'blocked' &&
        !health11.canProceed &&
        health11.blockingReasons.some((r) => r.includes('Authenticity Guarantee'))
    ),
    'Test 11: Missing required document produces ⛔ 処理停止'
  );

  // Test 12: Unverified critical rule (distinguishes A, B, C, D) -> 🟡 要確認
  const health12 = evaluateProjectHealth({
    forceUnverifiedCriticalRule: true
  });
  const zonosItem12 = health12.itemsByCategory.shipping_rules.find((i) => i.id === 'rule_zonos');
  assert(
    Boolean(
      health12.overallStatus === 'needs_verification' &&
        zonosItem12 &&
        zonosItem12.authorityLevel === 'unverified' &&
        zonosItem12.liveVerificationNote === 'ライブ確認未対応'
    ),
    'Test 12: Unverified critical rule accurately classified as D. unverified and ライブ確認未対応'
  );

  // Test 13: Administrator-approved rule -> recognized as B. admin_approved
  const health13 = evaluateProjectHealth({
    forceAdminApprovedRule: true
  });
  const zonosItem13 = health13.itemsByCategory.shipping_rules.find((i) => i.id === 'rule_zonos');
  assert(
    Boolean(zonosItem13 && zonosItem13.authorityLevel === 'admin_approved'),
    'Test 13: Administrator-approved rule recognized as B. admin_approved'
  );

  // Test 14: Cached but stale rule -> recognized as C. cached & ⚠ 要再取得
  const health14 = evaluateProjectHealth({
    forceCachedStaleRule: true
  });
  const zonosItem14 = health14.itemsByCategory.shipping_rules.find((i) => i.id === 'rule_zonos');
  assert(
    Boolean(zonosItem14 && zonosItem14.authorityLevel === 'cached' && zonosItem14.status === 'needs_refetch'),
    'Test 14: Cached stale rule recognized as C. cached and ⚠ 要再取得'
  );

  // Test 15: Successful manual emergency refresh -> updates sync status
  const refresh15 = refreshProjectHealth(true);
  assert(
    Boolean(refresh15.syncMessage.includes('最新ルールを今すぐ再確認') && refresh15.result.lastVerifiedAt.length > 0),
    'Test 15: Successful manual emergency refresh executes cleanly'
  );

  // Test 16: Automatic refresh status update
  const refresh16 = refreshProjectHealth(false);
  assert(
    Boolean(refresh16.syncMessage.includes('自動同期') && refresh16.result.overallStatusLabel.length > 0),
    'Test 16: Automatic refresh status reflected in health result'
  );

  // Test 17: Business readiness gate check
  const gate17 = checkBusinessReadiness('publication');
  assert(
    Boolean(typeof gate17.canProceed === 'boolean' && Array.isArray(gate17.blockingReasons)),
    'Test 17: Reusable business readiness gate evaluates publication context'
  );

  // Test 18: Future module registration without redesigning dashboard
  const customPlugin: HealthCheckModulePlugin = {
    moduleId: 'module_custom_test_plugin',
    moduleName: 'Custom Analytics Plugin (テスト拡張モジュール)',
    category: 'future_module',
    checkHealth: () => ({
      id: 'module_custom_test_plugin',
      name: 'Custom Analytics Plugin',
      category: 'future_module',
      status: 'healthy',
      statusLabel: getStatusDisplayLabel('healthy'),
      isLiveVerified: true,
      liveVerificationNote: '最終確認: 2026-08-08 10:00',
      lastVerifiedAt: '2026-08-08 10:00',
      authorityLevel: 'authoritative_source',
      authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
      verificationMethod: 'official_structured',
      verificationMethodLabel: '公式構造化データ',
      sourceName: 'Plugin Hub',
      freshness: '即時',
      isCriticalWarning: false,
      shortOneLineReason: 'カスタムプラグイン正常稼働中',
      details: {
        exactRestriction: 'テスト制限なし',
        source: 'Plugin Module',
        ruleVersion: '1.0.0'
      }
    })
  };
  registerHealthCheckModule(customPlugin);
  const health18 = evaluateProjectHealth();
  assert(
    Boolean(
      health18.itemsByCategory.future_module.some((m) => m.id === 'module_custom_test_plugin')
    ),
    'Test 18: Future module dynamically registered without redesigning dashboard'
  );
  unregisterHealthCheckModule('module_custom_test_plugin');

  initRuleFreshnessHealthModule();
  initShipmentReadinessHealthModule();
  initShippingRouterHealthModule();
  initCentralInventoryHealthModule();
  initConsolidationHealthModule();
  initShopeeAutomationHealthModule();

  return { passed, failed, log };
}
