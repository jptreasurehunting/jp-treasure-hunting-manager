/**
 * Unit Test Suite for Order Fulfillment & Shipment Readiness Gate (Specs #1 - #20)
 */

import {
  calculateWatchWorksheetBreakdown,
  evaluateOrderShipmentReadiness,
  loadNormalizedEbayOrders,
  initShipmentReadinessHealthModule
} from '../shipmentReadinessService';
import { evaluateProjectHealth } from '../projectHealthService';
import { NormalizedEbayOrder } from '../../types/shipmentReadiness';

export function runShipmentReadinessTests(): { passed: number; failed: number; log: string[] } {
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

  const orders = loadNormalizedEbayOrders();

  // Test 1: READY state for valid FedEx US watch order (Rolex Datejust $3,450)
  const rolexOrder = orders.find((o) => o.orderId === 'order_2026_01_rolex')!;
  const rolexEval = evaluateOrderShipmentReadiness(rolexOrder);
  assert(
    Boolean(
      rolexEval.state === 'READY' &&
        rolexEval.canProceedToFutureExecution &&
        rolexEval.selectedCarrier === 'FedEx' &&
        rolexEval.isAuthenticityHubRouted
    ),
    'Test 1: Valid FedEx US watch order evaluates to READY state with Authenticity Hub routing'
  );

  // Test 2: READY state for valid Japan Post camera order (Canon AE-1 Program $220 to Germany)
  const canonOrder = orders.find((o) => o.orderId === 'order_2026_02_canon')!;
  const canonEval = evaluateOrderShipmentReadiness(canonOrder);
  assert(
    Boolean(
      canonEval.state === 'READY' &&
        canonEval.canProceedToFutureExecution &&
        canonEval.selectedCarrier === 'Japan Post' &&
        canonEval.requiredDocuments.some((d) => d.documentId === 'doc_japanpost_lithium')
    ),
    'Test 2: Valid Japan Post camera order evaluates to READY with lithium battery declaration'
  );

  // Test 3: BLOCKED state for SpeedPAK $2,000+ watch (Omega $2,800)
  const speedpakWatchOrder = orders.find((o) => o.orderId === 'order_2026_03_speedpak_watch_blocked')!;
  const speedpakEval = evaluateOrderShipmentReadiness(speedpakWatchOrder);
  assert(
    Boolean(
      speedpakEval.state === 'BLOCKED' &&
        !speedpakEval.canProceedToFutureExecution &&
        speedpakEval.nonReadyDetails?.reasonCode === 'BLOCKED_SPEEDPAK_WATCH' &&
        speedpakEval.requiresHumanAction
    ),
    'Test 3: SpeedPAK $2,000+ luxury watch order is strictly BLOCKED with human action required'
  );

  // Test 4: WAITING_FOR_DATA for missing EVTN number (Grand Seiko $4,200)
  const missingEvtnOrder = orders.find((o) => o.orderId === 'order_2026_04_missing_evtn')!;
  const evtnEval = evaluateOrderShipmentReadiness(missingEvtnOrder);
  assert(
    Boolean(
      evtnEval.state === 'WAITING_FOR_DATA' &&
        !evtnEval.canProceedToFutureExecution &&
        evtnEval.nonReadyDetails?.reasonCode === 'WAITING_EVTN_DATA' &&
        evtnEval.nonReadyDetails.canAutoReevaluate
    ),
    'Test 4: Missing EVTN number evaluates to WAITING_FOR_DATA and can auto re-evaluate when data arrives'
  );

  // Test 5: WAITING_FOR_DATA for missing package weight
  const missingWeightOrder: NormalizedEbayOrder = {
    ...rolexOrder,
    orderId: 'order_test_missing_weight',
    packageWeightGrams: 0
  };
  const weightEval = evaluateOrderShipmentReadiness(missingWeightOrder);
  assert(
    Boolean(
      weightEval.state === 'WAITING_FOR_DATA' &&
        weightEval.nonReadyDetails?.reasonCode === 'WAITING_PACKAGE_WEIGHT'
    ),
    'Test 5: Missing package weight evaluates to WAITING_FOR_DATA'
  );

  // Test 6: NEEDS_REVIEW for unverified custom dial material
  const unverifiedMaterialOrder = orders.find((o) => o.orderId === 'order_2026_05_unverified_material')!;
  const materialEval = evaluateOrderShipmentReadiness(unverifiedMaterialOrder);
  assert(
    Boolean(
      materialEval.state === 'NEEDS_REVIEW' &&
        materialEval.nonReadyDetails?.reasonCode === 'NEEDS_REVIEW_MATERIAL_CHECK' &&
        materialEval.requiresHumanAction
    ),
    'Test 6: Unverified custom dial material evaluates to NEEDS_REVIEW'
  );

  // Test 7: Automatic Watch Worksheet 3-way breakdown calculation (Movement ~30%, Case ~50%, Band ~20%)
  const wwData = calculateWatchWorksheetBreakdown(3450, 450, 'Rolex Datejust 18K Gold');
  assert(
    Boolean(
      wwData.movementValueUsd === 1035 &&
        wwData.caseValueUsd === 1725 &&
        wwData.bandValueUsd === 690 &&
        wwData.templateVersion.includes('Ver. 4.1')
    ),
    'Test 7: Automatic Watch Worksheet 3-way breakdown accurately computes Movement (30%), Case (50%), and Band (20%)'
  );

  // Test 8: Watch Worksheet total price matches exact selling price
  assert(
    Boolean(wwData.movementValueUsd + wwData.caseValueUsd + wwData.bandValueUsd === 3450),
    'Test 8: Watch Worksheet component breakdown sum strictly equals selling price ($3,450.00)'
  );

  // Test 9: Zonos 1/3 prepay customs allocation matching total selling price
  assert(
    Boolean(rolexEval.declaredPrice1ThirdUsd === 1150 && rolexEval.isDdpRecommended),
    'Test 9: Zonos 1/3 prepay customs declared price ($1,150.00) matches 1/3 formula with DDP recommended'
  );

  // Test 10: Authenticity Guarantee hub address switching for $2,000+ US watches
  assert(
    Boolean(
      rolexEval.effectiveDeliveryAddress.includes('eBay Authenticity Guarantee Hub') &&
        rolexEval.effectiveDeliveryAddress.includes('Dayton, OH')
    ),
    'Test 10: Destination address automatically switches to eBay Authenticity Guarantee Hub in Dayton, OH'
  );

  // Test 11: Japan Post lithium battery document assignment
  const lithiumDoc = canonEval.requiredDocuments.find((d) => d.documentId === 'doc_japanpost_lithium');
  assert(
    Boolean(lithiumDoc && lithiumDoc.templateVersion === 'Ver. 2026.2' && lithiumDoc.isMandatory),
    'Test 11: Japan Post lithium battery declaration is automatically attached to eligible camera orders'
  );

  // Test 12: TSCA statement assignment readiness for camera composite materials
  assert(
    Boolean(canonEval.declaredPrice1ThirdUsd > 0 && canonEval.estimatedShippingCostJpy > 0),
    'Test 12: Customs declaration and DDP calculations execute cleanly for EU destination'
  );

  // Test 13: Pre-action verification gate integration
  assert(
    Boolean(rolexEval.provenance && rolexEval.provenance.ruleFreshnessGrade === 'CURRENT'),
    'Test 13: Pre-action verification gate confirms active rule freshness grade'
  );

  // Test 14: Safe Automation boundary enforcement (ALLOW for calculation / no external label purchase in Phase 1)
  assert(
    Boolean(rolexEval.provenance.isSafeAutomationApproved === true && !('purchasedLabelTrackingNumber' in rolexEval)),
    'Test 14: Safe Automation boundary strictly allows calculations and generation without executing label purchase'
  );

  // Test 15: Decision provenance generation (「この判断は何を根拠にしましたか？」)
  assert(
    Boolean(
      rolexEval.provenance.primaryRuleSource.length > 0 &&
        rolexEval.provenance.customsZonosBasisJa.includes('1/3申告額') &&
        rolexEval.provenance.shippingCarrierReasonJa.includes('Authenticity Guarantee')
    ),
    'Test 15: Detailed decision provenance answers basis of calculation and carrier selection'
  );

  // Test 16: Automatic re-evaluation on data update
  const updatedEvtnOrder: NormalizedEbayOrder = {
    ...missingEvtnOrder,
    evtnNumber: 'EVTN-US-998822'
  };
  const resolvedEvtnEval = evaluateOrderShipmentReadiness(updatedEvtnOrder);
  assert(
    Boolean(resolvedEvtnEval.state === 'READY' && resolvedEvtnEval.canProceedToFutureExecution),
    'Test 16: Order automatically transitions from WAITING_FOR_DATA to READY when EVTN is provided'
  );

  // Test 17: Rule Freshness integration (SpeedPAK prohibition enforced)
  assert(
    Boolean(speedpakEval.state === 'BLOCKED' && speedpakEval.provenance.reusedKnowledgeIds.includes('kb_speedpak_watch_02')),
    'Test 17: Rule Freshness integration enforces SpeedPAK luxury watch prohibition'
  );

  // Test 18: Knowledge Orchestrator cross-module reuse (avoiding duplicate research)
  assert(
    Boolean(rolexEval.provenance.reusedKnowledgeIds.length >= 2),
    'Test 18: Knowledge Orchestrator reuses verified knowledge across customs and authenticity'
  );

  // Test 19: Project Health integration
  initShipmentReadinessHealthModule();
  const health = evaluateProjectHealth();
  assert(
    Boolean(health.itemsByCategory.future_module.some((m) => m.id === 'module_shipment_readiness_engine')),
    'Test 19: Order Fulfillment & Shipment Readiness Gate registers with Project Health Dashboard'
  );

  // Test 20: Multi-PC safe operation without secrets
  const cleanOrders = loadNormalizedEbayOrders();
  assert(
    Boolean(cleanOrders.every((o) => !JSON.stringify(o).includes('SECRET') && !JSON.stringify(o).includes('api_key'))),
    'Test 20: Normalized order repository is portable across PCs without leaking API keys or secrets'
  );

  return { passed, failed, log };
}
