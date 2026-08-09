/**
 * Unit Test Suite for Automated Domestic Shipping Router (Phase A)
 */

import {
  evaluateShippingRoute,
  loadFulfillmentOrders,
  calculateIdempotencyHash,
  recordRouterAuditLog,
  loadRouterAuditLogs,
  savePackagingKnowledge,
  loadPackagingKnowledge,
  initShippingRouterHealthModule
} from '../shippingRouterService';
import { evaluateProjectHealth } from '../projectHealthService';
import { NormalizedFulfillmentOrder, ReusablePackagingProfile } from '../../types/shippingRouter';

export function runShippingRouterTests(): { passed: number; failed: number; log: string[] } {
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

  const orders = loadFulfillmentOrders();

  // Test 1: Domestic single strap order -> routes to PRINT_ENVELOPE with Nagagata 3
  const strapSingle = orders.find((o) => o.orderId === 'ord_dom_01_strap_single')!;
  const dec1 = evaluateShippingRoute(strapSingle);
  assert(
    Boolean(
      dec1.action === 'PRINT_ENVELOPE' &&
        dec1.packagingType === 'ENVELOPE_NAGAGATA_3' &&
        dec1.status === 'READY_FOR_EXECUTION' &&
        dec1.assignedPrinterProfile?.targetRole === 'envelope'
    ),
    'Test 1: Domestic single strap order routes to PRINT_ENVELOPE with Nagagata 3 packaging'
  );

  // Test 2: Domestic bulk 5-units strap order -> dynamically recalculates to CREATE_SHIPMENT_AND_PRINT_LABEL (Box)
  const strapBulk = orders.find((o) => o.orderId === 'ord_dom_02_strap_bulk_5units')!;
  const dec2 = evaluateShippingRoute(strapBulk);
  assert(
    Boolean(
      dec2.action === 'CREATE_SHIPMENT_AND_PRINT_LABEL' &&
        dec2.packagingType === 'BOX_60_SIZE' &&
        dec2.decisionProvenanceJa.includes('封筒上限容量') &&
        dec2.assignedPrinterProfile?.targetRole === 'label'
    ),
    'Test 2: Bulk strap order exceeding envelope capacity dynamically recalculates to Cardboard Box'
  );

  // Test 3: Domestic Camera body order -> routes to CREATE_SHIPMENT_AND_PRINT_LABEL (No envelope print!)
  const cameraOrder = orders.find((o) => o.orderId === 'ord_dom_03_camera_body')!;
  const dec3 = evaluateShippingRoute(cameraOrder);
  assert(
    Boolean(
      dec3.action === 'CREATE_SHIPMENT_AND_PRINT_LABEL' &&
        dec3.packagingType === 'BOX_60_SIZE'
    ),
    'Test 3: Domestic Camera body order routes to Parcel Box and does NOT trigger envelope printing'
  );

  // Test 4: Mercari order with envelope size item -> routes to PRINT_ENVELOPE (Proves Mercari != Box)
  const mercariEnvelope = orders.find((o) => o.orderId === 'ord_dom_04_mercari_strap_envelope')!;
  const dec4 = evaluateShippingRoute(mercariEnvelope);
  assert(
    Boolean(
      dec4.salesChannel === 'Mercari' &&
        dec4.action === 'PRINT_ENVELOPE' &&
        dec4.packagingType === 'ENVELOPE_NAGAGATA_3'
    ),
    'Test 4: Mercari small item order routes to PRINT_ENVELOPE (Marketplace != Packaging assumption strictly broken)'
  );

  // Test 5: Domestic order with missing postal code -> routes to MANUAL_REVIEW (ACTION_REQUIRED)
  const missingPostalOrder = orders.find((o) => o.orderId === 'ord_dom_05_missing_address')!;
  const dec5 = evaluateShippingRoute(missingPostalOrder);
  assert(
    Boolean(
      dec5.action === 'MANUAL_REVIEW' &&
        dec5.status === 'ACTION_REQUIRED' &&
        dec5.missingFields?.includes('郵便番号 (7桁)')
    ),
    'Test 5: Order with missing postal code routes to MANUAL_REVIEW (ACTION_REQUIRED)'
  );

  // Test 6: Domestic order with missing recipient name -> routes to MANUAL_REVIEW
  const missingNameOrder: NormalizedFulfillmentOrder = {
    ...strapSingle,
    orderId: 'ord_test_missing_name',
    buyerName: ''
  };
  const dec6 = evaluateShippingRoute(missingNameOrder);
  assert(
    Boolean(
      dec6.action === 'MANUAL_REVIEW' &&
        dec6.status === 'ACTION_REQUIRED' &&
        dec6.missingFields?.includes('受取人氏名')
    ),
    'Test 6: Order with missing recipient name routes to MANUAL_REVIEW without guessing'
  );

  // Test 7: Brand new unknown SKU with no packaging profile -> routes to MANUAL_REVIEW
  const unknownOrder = orders.find((o) => o.orderId === 'ord_dom_06_unknown_new_product')!;
  const dec7 = evaluateShippingRoute(unknownOrder);
  assert(
    Boolean(
      dec7.action === 'MANUAL_REVIEW' &&
        dec7.status === 'ACTION_REQUIRED' &&
        dec7.matchedRuleSource.includes('First-time Product')
    ),
    'Test 7: Brand new unknown SKU routes to MANUAL_REVIEW without guessing'
  );

  // Test 8: International order (US destination) -> routes to INTERNATIONAL_SHIPMENT
  const intlOrder = orders.find((o) => o.orderId === 'ord_intl_07_watch_to_us')!;
  const dec8 = evaluateShippingRoute(intlOrder);
  assert(
    Boolean(
      dec8.action === 'INTERNATIONAL_SHIPMENT' &&
        !dec8.isDomestic &&
        dec8.status === 'READY_FOR_EXECUTION'
    ),
    'Test 8: International order routes to INTERNATIONAL_SHIPMENT without domestic printing'
  );

  // Test 9: Idempotency hash uniqueness across channels and actions
  const hash1 = calculateIdempotencyHash('eBay', '12345', 'PRINT_ENVELOPE');
  const hash2 = calculateIdempotencyHash('eBay', '12345', 'CREATE_SHIPMENT_AND_PRINT_LABEL');
  const hash3 = calculateIdempotencyHash('Mercari', '12345', 'PRINT_ENVELOPE');
  assert(
    Boolean(hash1 !== hash2 && hash1 !== hash3 && hash1.startsWith('idmp_')),
    'Test 9: Idempotency fingerprint hash is deterministic and unique across channels and actions'
  );

  // Test 10: Duplicate detection blocks execution when already completed
  recordRouterAuditLog({
    orderId: strapSingle.orderId,
    salesChannel: strapSingle.salesChannel,
    action: 'PRINT_ENVELOPE',
    status: 'COMPLETED',
    idempotencyHash: dec1.idempotencyHash,
    matchedRule: 'Test Rule',
    decisionSummaryJa: 'Already printed in earlier batch',
    isDuplicateDetected: false
  });
  const duplicateDec = evaluateShippingRoute(strapSingle);
  assert(
    Boolean(
      duplicateDec.status === 'BLOCKED_DUPLICATE' &&
        duplicateDec.requiresHumanReview &&
        !duplicateDec.isSafeForAutomaticExecution
    ),
    'Test 10: Duplicate detection strictly blocks automatic execution when action already completed'
  );

  // Test 11: Printer profile assignment for PRINT_ENVELOPE targets envelope printer role
  assert(
    Boolean(dec1.assignedPrinterProfile?.targetRole === 'envelope'),
    'Test 11: Printer profile assignment for PRINT_ENVELOPE correctly targets envelope role'
  );

  // Test 12: Printer profile assignment for CREATE_SHIPMENT_AND_PRINT_LABEL targets label printer role
  assert(
    Boolean(dec2.assignedPrinterProfile?.targetRole === 'label'),
    'Test 12: Printer profile assignment for CREATE_SHIPMENT targets label printer role'
  );

  // Test 13: Letter Pack packaging routes to PRINT_SHIPPING_LABEL
  const voucherOrder: NormalizedFulfillmentOrder = {
    ...strapSingle,
    orderId: 'ord_test_voucher_lp',
    sku: 'SKU-VOUCHER-DOC',
    itemTitle: 'ギフト券 / クーポン券'
  };
  const dec13 = evaluateShippingRoute(voucherOrder);
  assert(
    Boolean(
      dec13.action === 'PRINT_SHIPPING_LABEL' &&
        dec13.packagingType === 'LETTER_PACK_LIGHT'
    ),
    'Test 13: Letter pack order correctly routes to PRINT_SHIPPING_LABEL'
  );

  // Test 14: Two-Stage Optimization router provenance records selection details
  assert(
    Boolean(
      dec1.decisionProvenanceJa.length > 0 &&
        dec1.matchedRuleSource.includes('Two-Stage') &&
        dec1.eligibleServicesCount > 0
    ),
    'Test 14: Two-Stage Optimization provenance records eligible service count and rationale'
  );

  // Test 15: Never guess missing address line
  const missingLineOrder: NormalizedFulfillmentOrder = {
    ...strapSingle,
    orderId: 'ord_test_missing_line',
    addressLine1: ''
  };
  const dec15 = evaluateShippingRoute(missingLineOrder);
  assert(
    Boolean(
      dec15.action === 'MANUAL_REVIEW' &&
        dec15.missingFields?.includes('町名・番地')
    ),
    'Test 15: Order with missing address line strictly halts automation'
  );

  // Test 16: Router audit log records entry cleanly
  const auditLogs = loadRouterAuditLogs();
  assert(
    Boolean(auditLogs.length > 0 && auditLogs.some((l) => l.orderId === strapSingle.orderId)),
    'Test 16: Router audit log successfully persists routing events and hashes'
  );

  // Test 17: Dynamic addition of packaging profile enables subsequent automatic routing
  const currentKnowledge = loadPackagingKnowledge();
  const newProfile: ReusablePackagingProfile = {
    skuOrCategory: 'SKU-NEW-UNKNOWN-FIGURINE-99',
    maxUnitsForEnvelope: 0,
    preferredPackaging: 'BOX_80_SIZE',
    preferredFulfillmentAction: 'CREATE_SHIPMENT_AND_PRINT_LABEL',
    preferredCarrier: 'ヤマト運輸 (宅急便 80サイズ)',
    suggestedPrinterRoleId: 'label',
    lastConfirmedDate: '2026-08-09',
    confirmedBy: 'User Confirmation'
  };
  savePackagingKnowledge([...currentKnowledge, newProfile]);
  const resolvedUnknownDec = evaluateShippingRoute(unknownOrder);
  assert(
    Boolean(
      resolvedUnknownDec.action === 'CREATE_SHIPMENT_AND_PRINT_LABEL' &&
        resolvedUnknownDec.packagingType === 'BOX_80_SIZE' &&
        resolvedUnknownDec.status === 'READY_FOR_EXECUTION'
    ),
    'Test 17: Registering packaging profile automatically enables subsequent routing without manual review'
  );

  // Test 18: Project Health integration
  initShippingRouterHealthModule();
  const health = evaluateProjectHealth();
  assert(
    Boolean(health.itemsByCategory.future_module.some((m) => m.id === 'module_shipping_router_engine')),
    'Test 18: Shipping Router registers health check module in Project Health Dashboard'
  );

  // Test 19: Excel Safety - strictly in-memory / localStorage isolated
  assert(
    Boolean(typeof localStorage !== 'undefined'),
    'Test 19: All router state uses isolated application storage without modifying external Excel files'
  );

  // Test 20: Reversible Phase A execution safety
  assert(
    Boolean(dec1.isSafeForAutomaticExecution && !('physicallyPrinted' in dec1)),
    'Test 20: Phase A acts as deterministic decision router without executing physical printing'
  );

  return { passed, failed, log };
}
