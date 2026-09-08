/**
 * Central Test Suite Runner for JP Treasure Hunting Manager
 */

// Node.js test runtime in-memory storage polyfill
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => { store[key] = String(val); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); }
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  const sessStore: Record<string, string> = {};
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => sessStore[key] || null,
    setItem: (key: string, val: string) => { sessStore[key] = String(val); },
    removeItem: (key: string) => { delete sessStore[key]; },
    clear: () => { Object.keys(sessStore).forEach((k) => delete sessStore[k]); }
  };
}

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
import { runConsolidationTests } from './consolidation.test';
import { runCentralInventoryTests } from './centralInventory.test';
import { runMarketplaceSaleEventTests } from './marketplaceSaleEvent.test';
import { runInventorySalesWorkbenchTests } from './inventorySalesWorkbench.test';
import { runInventoryImportTests } from './inventoryImport.test';
import { runInventorySalesPriorityTests } from './inventorySalesPriority.test';
import { runListingPreparationTests } from './listingPreparation.test';
import { runListingDraftReviewTests } from './listingDraftReview.test';
import { runListingPublishGateTests } from './listingPublishGate.test';
import { runListingPrePublishCheckTests } from './listingPrePublishCheck.test';
import { runListingPublishDryRunTests } from './listingPublishDryRun.test';
import { runListingPublishAdapterTests } from './listingPublishAdapter.test';
import { runMarketplaceApiMappingTests } from './marketplaceApiMapping.test';
import { runEbayPublishPrerequisiteTests } from './ebayPublishPrerequisite.test';
import { runEbayOfficialPayloadPreviewTests } from './ebayOfficialPayloadPreview.test';
import { runEbaySandboxOAuthTests } from './ebaySandboxOAuth.test';
import { runEbaySandboxVerificationTests } from './ebaySandboxVerification.test';
import { runEbaySandboxMutationGateTests } from './ebaySandboxMutationGate.test';
import { runShopeeSgInventoryMappingTests } from './shopeeSgInventoryMapping.test';
import { runShopeeSgApiSchemaVerificationTests } from './shopeeSgApiSchemaVerification.test';
import { runShopeeSgAuthSchemaVerificationTests } from './shopeeSgAuthSchemaVerification.test';
import { runShopeeAutomationTests } from './shopeeAutomation.test';
import { runI18nTests } from './i18n.test';
import { runZonosAugust13ReadinessTests } from './zonosAugust13Readiness.test';
import { runOpportunityHunterTests } from './opportunityHunter.test';
import { runOpportunityHunterPhase2Tests } from './opportunityHunterPhase2.test';
import { runShippingDecisionEngineTests } from './shippingDecisionEngine.test';
import { runShippingDecisionIntegrationTests } from './shippingDecisionIntegration.test';

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
    { name: 'eBay Sandbox Mutation Authorization Gate Tests', fn: runEbaySandboxMutationGateTests },
    { name: 'eBay Sandbox Connection Verification Tests', fn: runEbaySandboxVerificationTests },
    { name: 'eBay Sandbox OAuth Safety Tests', fn: runEbaySandboxOAuthTests },
    { name: 'eBay Official Payload Preview Safety Tests', fn: runEbayOfficialPayloadPreviewTests },
    { name: 'eBay Publish Prerequisite Safety Tests', fn: runEbayPublishPrerequisiteTests },
    { name: 'Marketplace API Mapping Verification Tests', fn: runMarketplaceApiMappingTests },
    { name: 'Listing Publish Adapter Simulation Tests', fn: runListingPublishAdapterTests },
    { name: 'Listing Publish Dry Run Safety Tests', fn: runListingPublishDryRunTests },
    { name: 'Listing Pre-Publish Safety Tests', fn: runListingPrePublishCheckTests },
    { name: 'Listing Publish Gate Safety Tests', fn: runListingPublishGateTests },
    { name: 'Listing Draft Final Review Safety Tests', fn: runListingDraftReviewTests },
    { name: 'Listing Preparation Safety Tests', fn: runListingPreparationTests },
    { name: 'Inventory Sales Priority Queue Tests', fn: runInventorySalesPriorityTests },
    { name: 'Inventory Import Safety Tests', fn: runInventoryImportTests },
    { name: 'Inventory Sales Workbench Tests', fn: runInventorySalesWorkbenchTests },
    { name: 'Shipping Decision Engine Integration Tests', fn: runShippingDecisionIntegrationTests },
    { name: 'Shipping Decision Engine Foundation Tests', fn: runShippingDecisionEngineTests },
    { name: 'Zonos Prepay August 13 Production-Readiness Tests', fn: runZonosAugust13ReadinessTests },
    { name: 'Pre-Release Opportunity Hunter Phase 1 Tests', fn: runOpportunityHunterTests },
    { name: 'Pre-Release Opportunity Hunter Phase 2 Discovery & Lifecycle Tests', fn: runOpportunityHunterPhase2Tests },
    { name: 'Marketplace-Aware Shipment Consolidation Tests', fn: runConsolidationTests },
    { name: 'Central Inventory SSOT & Cross-Channel Sync Tests', fn: runCentralInventoryTests },
    { name: 'Marketplace Sale Event Intake Safety Tests', fn: runMarketplaceSaleEventTests },
    { name: 'Shopee SG Inventory Identity Mapping Safety Tests', fn: runShopeeSgInventoryMappingTests },
    { name: 'Shopee SG API Schema Verification Tests', fn: runShopeeSgApiSchemaVerificationTests },
    { name: 'Shopee SG Auth Schema Verification Tests', fn: runShopeeSgAuthSchemaVerificationTests },
    { name: 'Shopee Automation & Optimization Scoring Tests', fn: runShopeeAutomationTests },
    { name: 'Internationalization (i18n) & Locale Formatter Tests', fn: runI18nTests },
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
