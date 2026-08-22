import {
  evaluateShippingDecision,
  classifyDestination,
  getShippingDecisionConfig,
  updateShippingDecisionConfig,
  resetShippingDecisionConfig
} from '../shippingDecisionEngineService';

export interface TestResultSummary {
  passed: number;
  failed: number;
  log: string[];
}

export function runShippingDecisionEngineTests(): TestResultSummary {
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

  log.push('=== Running Shipping Decision Engine Foundation Tests ===');
  resetShippingDecisionConfig();

  // Test 1: Japanese Domestic Address (eBay)
  try {
    const res = evaluateShippingDecision({
      orderId: 'ord_jp_ebay_01',
      salesChannel: 'eBay',
      destinationCountryCode: 'JP',
      destinationCountryName: 'Japan',
      buyerName: 'Yamada Taro',
      stateOrProvince: '東京都',
      city: 'Shibuya',
      addressLine1: 'Jingumae 1-2-3'
    });

    assert(res.route === 'DOMESTIC_FLOW', 'eBay JP destination routes to DOMESTIC_FLOW');
    assert(res.destinationClassification === 'DOMESTIC_JP', 'eBay JP destination classified as DOMESTIC_JP');
    assert(res.isDomestic === true, 'isDomestic is true for JP');
    assert(res.requiresCustoms === false, 'requiresCustoms is false for domestic JP');
    assert(res.requiresZonos === false, 'requiresZonos is false for domestic JP (No Zonos)');
    assert(res.requiresCPass === false, 'requiresCPass is false for domestic JP (No C-PASS)');
    assert(res.requiresDDP === false, 'requiresDDP is false for domestic JP (No DDP)');
    assert(res.packageProfile === 'ENVELOPE_ELIGIBLE', 'Default domestic packageProfile is ENVELOPE_ELIGIBLE');
    assert(res.reasonCode === 'DOMESTIC_JP_EBAY', 'reasonCode is DOMESTIC_JP_EBAY for eBay JP order');
    assert(typeof res.explanation === 'string' && res.explanation.length > 0, 'Includes human-readable explanation');
  } catch (e: any) {
    assert(false, 'Japanese Domestic Address (eBay) test threw error', e.message);
  }

  // Test 2: Japanese Domestic Address (Non-eBay / Kanji Country Name '日本')
  try {
    const res = evaluateShippingDecision({
      orderId: 'ord_jp_kanji_02',
      salesChannel: 'Mercari',
      destinationCountryName: '日本',
      stateOrProvince: '大阪府'
    });

    assert(res.route === 'DOMESTIC_FLOW', 'Kanji "日本" routes to DOMESTIC_FLOW');
    assert(res.isDomestic === true, 'isDomestic is true for "日本"');
    assert(res.requiresZonos === false, 'Mercari JP does not require Zonos');
    assert(res.reasonCode === 'DOMESTIC_JP_GENERAL', 'reasonCode is DOMESTIC_JP_GENERAL');
  } catch (e: any) {
    assert(false, 'Japanese Domestic Address (Kanji) test threw error', e.message);
  }

  // Test 3: United States Address
  try {
    const res = evaluateShippingDecision({
      orderId: 'ord_us_01',
      salesChannel: 'eBay',
      destinationCountryCode: 'US',
      destinationCountryName: 'United States',
      buyerName: 'John Doe',
      stateOrProvince: 'CA',
      city: 'Los Angeles'
    });

    assert(res.route === 'INTERNATIONAL_FLOW', 'US address routes to INTERNATIONAL_FLOW');
    assert(res.destinationClassification === 'INTERNATIONAL', 'US classified as INTERNATIONAL');
    assert(res.isDomestic === false, 'isDomestic is false for US');
    assert(res.requiresCustoms === true, 'requiresCustoms is true for US');
    assert(res.requiresZonos === true, 'requiresZonos is true for US');
    assert(res.requiresCPass === true, 'requiresCPass is true for eBay US');
    assert(res.requiresDDP === true, 'requiresDDP is true for US');
    assert(res.packageProfile === 'REQUIRES_DIMENSIONAL_CHECK', 'US packageProfile is REQUIRES_DIMENSIONAL_CHECK');
    assert(res.reasonCode === 'INTERNATIONAL_STANDARD', 'reasonCode is INTERNATIONAL_STANDARD');
  } catch (e: any) {
    assert(false, 'United States Address test threw error', e.message);
  }

  // Test 4: Another Non-Japan Country (Germany & Australia & Canada)
  try {
    const resDe = evaluateShippingDecision({
      orderId: 'ord_de_01',
      salesChannel: 'eBay',
      destinationCountryCode: 'DE',
      destinationCountryName: 'Germany'
    });

    const resAu = evaluateShippingDecision({
      orderId: 'ord_au_01',
      salesChannel: 'Shopify',
      destinationCountryCode: 'AU',
      destinationCountryName: 'Australia'
    });

    assert(resDe.route === 'INTERNATIONAL_FLOW', 'Germany (DE) routes to INTERNATIONAL_FLOW');
    assert(resDe.requiresCustoms === true, 'Germany requires customs');
    assert(resAu.route === 'INTERNATIONAL_FLOW', 'Australia (AU) routes to INTERNATIONAL_FLOW');
    assert(resAu.requiresZonos === true, 'Australia requires Zonos');
  } catch (e: any) {
    assert(false, 'Another Non-Japan Country test threw error', e.message);
  }

  // Test 5: Missing Destination Data (Must NOT guess)
  try {
    const resMissing = evaluateShippingDecision({
      orderId: 'ord_missing_01',
      salesChannel: 'eBay',
      destinationCountryCode: '',
      destinationCountryName: undefined
    });

    assert(resMissing.route === 'REVIEW_REQUIRED', 'Missing destination data routes to REVIEW_REQUIRED');
    assert(resMissing.destinationClassification === 'UNKNOWN_OR_INVALID', 'Missing destination classified as UNKNOWN_OR_INVALID');
    assert(resMissing.reasonCode === 'MISSING_DESTINATION_COUNTRY', 'reasonCode is MISSING_DESTINATION_COUNTRY');
    assert(resMissing.packageProfile === 'REVIEW_REQUIRED', 'packageProfile is REVIEW_REQUIRED');
    assert(resMissing.requiresZonos === false, 'Missing data does not trigger Zonos write/invoke');
    assert(resMissing.requiresCPass === false, 'Missing data does not trigger C-PASS');
  } catch (e: any) {
    assert(false, 'Missing Destination Data test threw error', e.message);
  }

  // Test 6: Invalid or Ambiguous Destination Data (Must NOT guess)
  try {
    const resInvalid = evaluateShippingDecision({
      orderId: 'ord_invalid_01',
      salesChannel: 'eBay',
      destinationCountryCode: 'INVALID_999'
    });

    const resAmbiguous = evaluateShippingDecision({
      orderId: 'ord_ambiguous_01',
      salesChannel: 'eBay',
      destinationCountryCode: 'OVERSEAS'
    });

    assert(resInvalid.route === 'REVIEW_REQUIRED', 'Invalid country code routes to REVIEW_REQUIRED');
    assert(resInvalid.reasonCode === 'INVALID_DESTINATION_COUNTRY', 'Invalid country code produces INVALID_DESTINATION_COUNTRY');
    assert(resAmbiguous.route === 'REVIEW_REQUIRED', 'Ambiguous "OVERSEAS" routes to REVIEW_REQUIRED');
    assert(resAmbiguous.reasonCode === 'AMBIGUOUS_DESTINATION_COUNTRY', 'Ambiguous country produces AMBIGUOUS_DESTINATION_COUNTRY');
  } catch (e: any) {
    assert(false, 'Invalid/Ambiguous Destination Data test threw error', e.message);
  }

  // Test 7: Configurable Rule/Settings Layer (Rule 3 Verification)
  try {
    // 1. Initial state (allDomesticEnvelopeEligible = true)
    const initialRes = evaluateShippingDecision({
      orderId: 'ord_config_01',
      salesChannel: 'eBay',
      destinationCountryCode: 'JP'
    });
    assert(initialRes.packageProfile === 'ENVELOPE_ELIGIBLE', 'Initial config treats JP order as ENVELOPE_ELIGIBLE');

    // 2. Change configurable setting: set allDomesticEnvelopeEligible = false
    updateShippingDecisionConfig({
      allDomesticEnvelopeEligible: false,
      defaultDomesticPackageProfile: 'STANDARD_PACKAGE'
    });

    const updatedRes = evaluateShippingDecision({
      orderId: 'ord_config_02',
      salesChannel: 'eBay',
      destinationCountryCode: 'JP'
    });

    assert(
      updatedRes.packageProfile === 'STANDARD_PACKAGE',
      'When allDomesticEnvelopeEligible setting is toggled to false, packageProfile changes to STANDARD_PACKAGE'
    );

    // 3. Reset config back
    resetShippingDecisionConfig();
    const resetRes = evaluateShippingDecision({
      orderId: 'ord_config_03',
      salesChannel: 'eBay',
      destinationCountryCode: 'JP'
    });
    assert(resetRes.packageProfile === 'ENVELOPE_ELIGIBLE', 'Config reset restores ENVELOPE_ELIGIBLE default');

  } catch (e: any) {
    assert(false, 'Configurable Rule/Settings Layer test threw error', e.message);
  }

  // Regression Test 8: Safety Fix - Never classify DOMESTIC_JP from stateOrProvince alone
  try {
    // Case 8A: Country is explicitly US, but stateOrProvince happens to contain '東京都'
    const resUsWithJpState = evaluateShippingDecision({
      orderId: 'ord_us_jp_state',
      salesChannel: 'eBay',
      destinationCountryCode: 'US',
      destinationCountryName: 'United States',
      stateOrProvince: '東京都'
    });
    assert(
      resUsWithJpState.route === 'INTERNATIONAL_FLOW' && resUsWithJpState.destinationClassification === 'INTERNATIONAL',
      'Safety Fix 1A: US order with stateOrProvince "東京都" must route to INTERNATIONAL_FLOW, NOT DOMESTIC_JP'
    );

    // Case 8B: Country fields are completely missing, but stateOrProvince contains '東京都'
    const resMissingWithJpState = evaluateShippingDecision({
      orderId: 'ord_missing_jp_state',
      salesChannel: 'eBay',
      destinationCountryCode: '',
      destinationCountryName: '',
      stateOrProvince: '東京都'
    });
    assert(
      resMissingWithJpState.route === 'REVIEW_REQUIRED' &&
        resMissingWithJpState.destinationClassification === 'UNKNOWN_OR_INVALID' &&
        resMissingWithJpState.reasonCode === 'MISSING_DESTINATION_COUNTRY',
      'Safety Fix 1B: Order with missing country and stateOrProvince "東京都" must route to REVIEW_REQUIRED (Never Guess Policy)'
    );
  } catch (e: any) {
    assert(false, 'Regression Test 8 (stateOrProvince safety isolation) threw error', e.message);
  }

  // Regression Test 9: Authoritative Worldwide Country Validation (ISO 3166-1 Dataset)
  try {
    // 1. Syntactically valid non-existent codes/names must NOT be accepted (Must evaluate to REVIEW_REQUIRED)
    const resZz = evaluateShippingDecision({ orderId: 'ord_zz', destinationCountryCode: 'ZZ' });
    const resAaa = evaluateShippingDecision({ orderId: 'ord_aaa', destinationCountryCode: 'AAA' });
    const resAtlantis = evaluateShippingDecision({ orderId: 'ord_atlantis', destinationCountryName: 'Atlantis' });

    assert(
      resZz.route === 'REVIEW_REQUIRED' && resZz.reasonCode === 'INVALID_DESTINATION_COUNTRY',
      'Safety Fix 2A: Syntactically valid code "ZZ" is NOT a real country -> routes to REVIEW_REQUIRED'
    );
    assert(
      resAaa.route === 'REVIEW_REQUIRED' && resAaa.reasonCode === 'INVALID_DESTINATION_COUNTRY',
      'Safety Fix 2B: Syntactically valid code "AAA" is NOT a real country -> routes to REVIEW_REQUIRED'
    );
    assert(
      resAtlantis.route === 'REVIEW_REQUIRED' && resAtlantis.reasonCode === 'INVALID_DESTINATION_COUNTRY',
      'Safety Fix 2C: Syntactically valid name "Atlantis" is NOT a real country -> routes to REVIEW_REQUIRED'
    );

    // 2. Real worldwide countries must evaluate to INTERNATIONAL
    const resNz = evaluateShippingDecision({ orderId: 'ord_nz', destinationCountryCode: 'NZ', destinationCountryName: 'New Zealand' });
    const resFi = evaluateShippingDecision({ orderId: 'ord_fi', destinationCountryCode: 'FI', destinationCountryName: 'Finland' });
    const resZa = evaluateShippingDecision({ orderId: 'ord_za', destinationCountryCode: 'ZA', destinationCountryName: 'South Africa' });
    const resAe = evaluateShippingDecision({ orderId: 'ord_ae', destinationCountryCode: 'AE', destinationCountryName: 'United Arab Emirates' });

    assert(
      resNz.route === 'INTERNATIONAL_FLOW' && resNz.destinationClassification === 'INTERNATIONAL',
      'Safety Fix 2D: Recognized country "NZ" (New Zealand) routes to INTERNATIONAL_FLOW'
    );
    assert(
      resFi.route === 'INTERNATIONAL_FLOW' && resFi.destinationClassification === 'INTERNATIONAL',
      'Safety Fix 2E: Recognized country "FI" (Finland) routes to INTERNATIONAL_FLOW'
    );
    assert(
      resZa.route === 'INTERNATIONAL_FLOW' && resZa.destinationClassification === 'INTERNATIONAL',
      'Safety Fix 2F: Recognized country "ZA" (South Africa) routes to INTERNATIONAL_FLOW'
    );
    assert(
      resAe.route === 'INTERNATIONAL_FLOW' && resAe.destinationClassification === 'INTERNATIONAL',
      'Safety Fix 2G: Recognized country "AE" (UAE) routes to INTERNATIONAL_FLOW'
    );
  } catch (e: any) {
    assert(false, 'Regression Test 9 (Worldwide Country Validation) threw error', e.message);
  }

  return {
    passed,
    failed,
    log
  };
}
