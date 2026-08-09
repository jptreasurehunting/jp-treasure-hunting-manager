/**
 * Central Test Suite Runner for JP Treasure Hunting Manager
 */

import { runProjectHealthTests } from './projectHealth.test';
import { runDevEnvManagerTests } from './devEnvManager.test';
import { runRuleSyncTests } from './ruleSync.test';
import { runAiShippingAdvisorTests } from './aiShippingAdvisor.test';
import { runAirShippingQuoteTests } from './airShippingQuote.test';
import { runShippingRegistryTests } from './shippingRegistry.test';
import { runShippingTemplateTests } from './shippingTemplate.test';
import { runZonosPortableTests } from './zonosPortableProject.test';
import { runAiMarketingStudioTests } from './aiMarketingStudio.test';
import { runSafeAutomationPolicyTests } from './safeAutomationPolicy.test';
import { runOperationalKnowledgeTests } from './operationalKnowledge.test';
import { runKnowledgeOrchestratorTests } from './knowledgeOrchestrator.test';
import { runRuleFreshnessTests } from './ruleFreshness.test';
import { runShipmentReadinessTests } from './shipmentReadiness.test';
import { runShippingRouterTests } from './shippingRouter.test';
import { runEnvelopeLayoutTests } from './envelopeLayout.test';

export interface MasterTestSummary {
  totalPassed: number;
  totalFailed: number;
  suites: {
    name: string;
    passed: number;
    failed: number;
    log: string[];
  }[];
}

export function runAllAppTests(): MasterTestSummary {
  const suites = [
    { name: 'Envelope Vector Layout & Safe Test Mode Tests', fn: runEnvelopeLayoutTests },
    { name: 'Automated Domestic Shipping Router Tests', fn: runShippingRouterTests },
    { name: 'Order Fulfillment & Shipment Readiness Gate Tests', fn: runShipmentReadinessTests },
    { name: 'Rule Freshness & Live Source Verification Tests', fn: runRuleFreshnessTests },
    { name: 'Knowledge Orchestrator & Cross-Module Reuse Tests', fn: runKnowledgeOrchestratorTests },
    { name: 'Shared Operational Knowledge Engine Tests', fn: runOperationalKnowledgeTests },
    { name: 'Safe Automation Policy & Risk-Based Approval Tests', fn: runSafeAutomationPolicyTests },
    { name: 'AI Marketing Studio & Rights Gate Tests', fn: runAiMarketingStudioTests },
    { name: 'Project Health Dashboard & Safety Architecture Tests', fn: runProjectHealthTests },
    { name: 'Dev Environment Manager Tests', fn: runDevEnvManagerTests },
    { name: 'Rule Sync & Pre-action Verification Tests', fn: runRuleSyncTests },
    { name: 'AI Shipping Advisor Tests', fn: runAiShippingAdvisorTests },
    { name: 'Air Shipping Quote Tests', fn: runAirShippingQuoteTests },
    { name: 'Shipping Method Registry Tests', fn: runShippingRegistryTests },
    { name: 'Shipping Template Tests', fn: runShippingTemplateTests },
    { name: 'Zonos Portable Project Tests', fn: runZonosPortableTests }
  ];

  let totalPassed = 0;
  let totalFailed = 0;

  const results = suites.map((s) => {
    const res = s.fn();
    totalPassed += res.passed;
    totalFailed += res.failed;
    return {
      name: s.name,
      passed: res.passed,
      failed: res.failed,
      log: res.log
    };
  });

  return {
    totalPassed,
    totalFailed,
    suites: results
  };
}
