import {
  evaluateShopeeSgApiSchemaVerification,
  getLatestShopeeSgApiSchemaVerification,
  isShopeeSgSchemaVerificationFresh,
  loadShopeeSgApiSchemaVerifications,
  recordShopeeSgApiSchemaVerification
} from '../shopeeSgApiSchemaVerificationService';

export function runShopeeSgApiSchemaVerificationTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.removeItem('jp_shopee_sg_api_schema_verifications_v1');
  const input = {
    officialSourceUrl: 'https://open.shopee.com/documents/v2/v2.product.update_stock',
    endpointName: 'v2.product.update_stock',
    requestFields: 'item_id, stock_list, model_id / seller_stock fields as verified in official docs',
    authenticationFields: 'partner_id, timestamp, access_token, shop_id, sign (names only; no secret values)',
    stockFieldSemantics: 'Absolute stock quantity; model/location semantics verified from the official Singapore documentation.',
    checkedBy: 'owner',
    checkedAt: '2026-09-08T00:30:00.000Z',
    verificationNote: 'Official Open Platform page reviewed directly before enabling any adapter implementation.',
    officialDocumentationConfirmed: true
  };

  const evaluation = evaluateShopeeSgApiSchemaVerification(input);
  assert(evaluation.canRecord, 'Test 1: Complete official-schema evidence can be recorded');

  const saved = recordShopeeSgApiSchemaVerification(input, '2026-09-08T00:31:00.000Z');
  assert(saved.success && saved.record?.status === 'OFFICIAL_SCHEMA_VERIFIED', 'Test 2: Verification is stored as official-schema-verified');
  assert(saved.record?.externalWriteAllowed === false, 'Test 3: Schema verification never enables external write');
  assert(loadShopeeSgApiSchemaVerifications().length === 1, 'Test 4: Verification record persists');
  assert(getLatestShopeeSgApiSchemaVerification()?.endpointName === 'v2.product.update_stock', 'Test 5: Latest verification can be retrieved');

  const nonOfficial = evaluateShopeeSgApiSchemaVerification({ ...input, officialSourceUrl: 'https://example.com/shopee-docs' });
  assert(!nonOfficial.canRecord, 'Test 6: Non-Shopee evidence URL is rejected');

  const unchecked = evaluateShopeeSgApiSchemaVerification({ ...input, officialDocumentationConfirmed: false });
  assert(!unchecked.canRecord, 'Test 7: Explicit official-documentation confirmation is required');

  const missingSemantics = evaluateShopeeSgApiSchemaVerification({ ...input, stockFieldSemantics: '' });
  assert(!missingSemantics.canRecord, 'Test 8: Stock semantics must be documented before schema verification');

  assert(isShopeeSgSchemaVerificationFresh(saved.record, Date.parse('2026-09-09T00:00:00.000Z')), 'Test 9: Recent schema verification is considered fresh');
  assert(!isShopeeSgSchemaVerificationFresh(saved.record, Date.parse('2027-01-01T00:00:00.000Z')), 'Test 10: Old schema verification requires recheck');

  return { passed, failed, log };
}
