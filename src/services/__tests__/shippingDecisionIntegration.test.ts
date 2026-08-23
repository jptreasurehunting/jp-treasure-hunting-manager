import { evaluateShippingRoute } from '../shippingRouterService';
import {
  evaluateShippingDecision,
  updateShippingDecisionConfig,
  resetShippingDecisionConfig
} from '../shippingDecisionEngineService';
import { runPreTransferCheck } from '../zonosTransferService';
import { NormalizedFulfillmentOrder } from '../../types/shippingRouter';
import { ZonosCustomsDeclaration, CustomsValidationStatus } from '../../types/zonosCustoms';

export interface TestResultSummary {
  passed: number;
  failed: number;
  log: string[];
}

export function runShippingDecisionIntegrationTests(): TestResultSummary {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      log.push(`  ✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`  ❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  log.push('=== Running Shipping Decision Engine Architecture Integration Tests ===');
  resetShippingDecisionConfig();

  // Test 1: Domestic JP order by country code "JP"
  try {
    const order: NormalizedFulfillmentOrder = {
      orderId: 'test_dom_01',
      orderNumber: 'EBAY-DOM-101',
      salesChannel: 'eBay',
      buyerName: '山田 太郎',
      postalCode: '150-0001',
      stateOrProvince: '東京都',
      city: '渋谷区',
      addressLine1: '神宮前1-2-3',
      destinationCountryCode: 'JP',
      sku: 'SKU-STRAP-LEATHER',
      itemTitle: 'レザーベルト 20mm',
      quantity: 1,
      unitPriceJpyOrUsd: 2500,
      currency: 'JPY',
      createdDate: '2026-08-23T00:00:00Z'
    };

    const decision = evaluateShippingDecision(order);
    assert(decision.route === 'DOMESTIC_FLOW', 'eBay JP destination routes to DOMESTIC_FLOW');
    assert(decision.requiresZonos === false, 'Domestic JP bypasses Zonos');
    assert(decision.requiresCustoms === false, 'Domestic JP bypasses Customs');
    assert(decision.requiresCPass === false, 'Domestic JP bypasses C-PASS');

    const routeResult = evaluateShippingRoute(order);
    assert(routeResult.isDomestic === true, 'Router recognizes domestic order');
    assert(routeResult.action !== 'INTERNATIONAL_SHIPMENT', 'Router does NOT hand off to international flow');
  } catch (e: any) {
    assert(false, 'Domestic JP order integration test', e.message);
  }

  // Test 2: Domestic JP order by country name "Japan" / "日本"
  try {
    const decisionJapan = evaluateShippingDecision({
      orderId: 'test_dom_name_1',
      destinationCountryName: 'Japan',
      salesChannel: 'eBay'
    });
    assert(decisionJapan.route === 'DOMESTIC_FLOW', 'Country name "Japan" classifies as DOMESTIC_FLOW');

    const decisionKanji = evaluateShippingDecision({
      orderId: 'test_dom_name_2',
      destinationCountryName: '日本',
      salesChannel: 'Mercari'
    });
    assert(decisionKanji.route === 'DOMESTIC_FLOW', 'Country name "日本" classifies as DOMESTIC_FLOW');
  } catch (e: any) {
    assert(false, 'Domestic JP by country name test', e.message);
  }

  // Test 3: International ISO country "US" and "DE"
  try {
    const order: NormalizedFulfillmentOrder = {
      orderId: 'test_intl_us',
      orderNumber: 'EBAY-INTL-201',
      salesChannel: 'eBay',
      buyerName: 'John Smith',
      postalCode: '90210',
      stateOrProvince: 'CA',
      city: 'Beverly Hills',
      addressLine1: '123 Main St',
      destinationCountryCode: 'US',
      sku: 'SKU-WATCH-01',
      itemTitle: 'Seiko Vintage Chronograph',
      quantity: 1,
      unitPriceJpyOrUsd: 350,
      currency: 'USD',
      createdDate: '2026-08-23T00:00:00Z'
    };

    const decision = evaluateShippingDecision(order);
    assert(decision.route === 'INTERNATIONAL_FLOW', 'US destination routes to INTERNATIONAL_FLOW');
    assert(decision.requiresZonos === true, 'US destination requires Zonos');
    assert(decision.requiresCustoms === true, 'US destination requires Customs');
    assert(decision.requiresCPass === true, 'eBay US order requires C-PASS');

    const routeResult = evaluateShippingRoute(order);
    assert(routeResult.action === 'INTERNATIONAL_SHIPMENT', 'Router hands off US order to INTERNATIONAL_SHIPMENT');
    assert(routeResult.isSafeForAutomaticExecution === true, 'Valid international shipment is safe for execution');
  } catch (e: any) {
    assert(false, 'International order routing test', e.message);
  }

  // Test 4: Missing, ambiguous, and invalid country data (Never Guess Policy)
  try {
    const missingOrder: NormalizedFulfillmentOrder = {
      orderId: 'test_missing_country',
      orderNumber: 'EBAY-MISSING-01',
      salesChannel: 'eBay',
      buyerName: 'Unknown',
      postalCode: '100-0000',
      stateOrProvince: 'Unknown',
      city: 'City',
      addressLine1: 'Address',
      destinationCountryCode: '',
      sku: 'SKU-TEST',
      itemTitle: 'Test Item',
      quantity: 1,
      unitPriceJpyOrUsd: 100,
      currency: 'USD',
      createdDate: '2026-08-23T00:00:00Z'
    };

    const missingDecision = evaluateShippingDecision(missingOrder);
    assert(missingDecision.route === 'REVIEW_REQUIRED', 'Missing country code yields REVIEW_REQUIRED');

    const missingRoute = evaluateShippingRoute(missingOrder);
    assert(missingRoute.action === 'MANUAL_REVIEW', 'Missing country yields MANUAL_REVIEW in router');
    assert(missingRoute.status === 'ACTION_REQUIRED', 'Missing country status is ACTION_REQUIRED');
    assert(missingRoute.isSafeForAutomaticExecution === false, 'Missing country is NOT safe for automatic execution');

    const apacDecision = evaluateShippingDecision({
      orderId: 'test_apac',
      destinationCountryCode: 'APAC',
      salesChannel: 'eBay'
    });
    assert(apacDecision.route === 'REVIEW_REQUIRED', 'Ambiguous country code "APAC" yields REVIEW_REQUIRED');

    const fictionalDecision = evaluateShippingDecision({
      orderId: 'test_zz',
      destinationCountryCode: 'ZZ',
      salesChannel: 'eBay'
    });
    assert(fictionalDecision.route === 'REVIEW_REQUIRED', 'Fictional country code "ZZ" yields REVIEW_REQUIRED');
  } catch (e: any) {
    assert(false, 'Never Guess policy test', e.message);
  }

  // Test 5: Configurable settings layer
  try {
    updateShippingDecisionConfig({ allDomesticEnvelopeEligible: false, defaultDomesticPackageProfile: 'STANDARD_PACKAGE' });
    const configDecision = evaluateShippingDecision({
      orderId: 'test_config',
      destinationCountryCode: 'JP',
      salesChannel: 'eBay'
    });
    assert(configDecision.packageProfile === 'STANDARD_PACKAGE', 'Config override reflects in packageProfile');
    resetShippingDecisionConfig();
  } catch (e: any) {
    assert(false, 'Configurable settings layer test', e.message);
  }

  // Test 6: Zonos Transfer Gate domestic bypass
  try {
    const dummyDeclaration: ZonosCustomsDeclaration = {
      orderId: '14-12345-67890',
      totalItemsWeightGrams: 400,
      packagingWeightGrams: 100,
      totalPackagedWeightGrams: 500,
      ebayTransactionValueCents: 10000,
      ebayTransactionValue: 100,
      currency: 'USD',
      carrier: 'JAPAN_POST',
      originCountry: 'JP',
      destinationCountry: 'JP',
      shippingMethod: 'EMS',
      items: [],
      declarationLocked: true
    };

    const dummyStatus: CustomsValidationStatus = {
      isValid: false,
      canLock: false,
      canCopyZonos: false,
      errors: [],
      warnings: [],
      totalDeclaredValueCents: 10000,
      totalDeclaredValue: 100,
      differenceCents: 0,
      difference: 0,
      materialMissing: false,
      productTypeMissing: false,
      quantityInvalid: false,
      originMissing: false,
      valueInvalid: false,
      currencyMismatch: false,
      isDomesticShipment: true,
      carrierInvalid: false,
      originInvalid: false,
      destinationMissing: false,
      shippingMethodMissing: false,
      shippingConditionsValid: true,
      weightMissing: false
    };

    const preCheck = runPreTransferCheck(dummyDeclaration, dummyStatus);
    assert(preCheck.canStart === false, 'Zonos pre-transfer check blocks domestic shipment');
    assert(preCheck.errors.some((err) => err.includes('DOMESTIC_JP')), 'Zonos pre-transfer check includes DOMESTIC_JP error message');
  } catch (e: any) {
    assert(false, 'Zonos transfer gate domestic bypass test', e.message);
  }

  return { passed, failed, log };
}
