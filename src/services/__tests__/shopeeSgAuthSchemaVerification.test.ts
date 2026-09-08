import {
  evaluateShopeeSgAuthSchemaVerification,
  getLatestShopeeSgAuthSchemaVerification,
  isShopeeSgAuthSchemaVerificationFresh,
  loadShopeeSgAuthSchemaVerifications,
  recordShopeeSgAuthSchemaVerification
} from '../shopeeSgAuthSchemaVerificationService';

export function runShopeeSgAuthSchemaVerificationTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.removeItem('jp_shopee_sg_auth_schema_verifications_v1');
  const input = {
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
    tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get',
    refreshTokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/access_token/get',
    signatureAlgorithm: 'HMAC-SHA256 as verified in current official documentation',
    authorizationSignBaseRule: 'Field names and concatenation order verified from current official documentation; no Partner Key value stored.',
    authenticatedApiSignBaseRule: 'Authenticated API signature base rule verified from current official documentation; no token value stored.',
    callbackFields: 'code, shop_id (field names only)',
    tokenRequestFields: 'partner_id, code, shop_id (field names only)',
    authenticatedRequestFields: 'partner_id, timestamp, access_token, shop_id, sign (field names only)',
    timestampValidityRule: 'Timestamp validity and clock requirement reviewed in the current official Singapore documentation.',
    checkedBy: 'owner',
    checkedAt: '2026-09-08T01:30:00.000Z',
    verificationNote: 'Current Singapore Open Platform authentication documentation reviewed directly before backend auth implementation.',
    officialDocumentationConfirmed: true,
    currentSingaporeApplicabilityConfirmed: true
  };

  const evaluation = evaluateShopeeSgAuthSchemaVerification(input);
  assert(evaluation.canRecord, 'Test 1: Complete current-SG official auth evidence can be recorded');

  const saved = recordShopeeSgAuthSchemaVerification(input, '2026-09-08T01:31:00.000Z');
  assert(saved.success && saved.record?.status === 'OFFICIAL_AUTH_SCHEMA_VERIFIED', 'Test 2: Auth verification is stored separately from inventory schema');
  assert(saved.record?.externalNetworkAllowed === false && saved.record.externalWriteAllowed === false, 'Test 3: Auth schema verification never grants network or write permission');
  assert(saved.record?.secretsStored === false, 'Test 4: Auth verification explicitly records that secrets are not stored');
  assert(loadShopeeSgAuthSchemaVerifications().length === 1, 'Test 5: Auth verification persists locally');
  assert(getLatestShopeeSgAuthSchemaVerification()?.authorizationEndpoint.includes('/shop/auth_partner') === true, 'Test 6: Latest auth verification can be retrieved');

  const oldScope = evaluateShopeeSgAuthSchemaVerification({ ...input, currentSingaporeApplicabilityConfirmed: false });
  assert(!oldScope.canRecord, 'Test 7: Current Singapore applicability confirmation is mandatory');

  const nonOfficial = evaluateShopeeSgAuthSchemaVerification({ ...input, officialSourceUrl: 'https://example.com/shopee-auth' });
  assert(!nonOfficial.canRecord, 'Test 8: Non-Shopee documentation evidence is rejected');

  const unsafeEndpoint = evaluateShopeeSgAuthSchemaVerification({ ...input, tokenEndpoint: 'https://example.com/token' });
  assert(!unsafeEndpoint.canRecord, 'Test 9: Token endpoint must remain on a Shopee service HTTPS host');

  const leakedSecret = evaluateShopeeSgAuthSchemaVerification({ ...input, verificationNote: 'partner_key=ABCDEFGHIJKLMNOPQRSTUVWX' });
  assert(!leakedSecret.canRecord, 'Test 10: Likely Partner Key leakage blocks persistence');

  assert(isShopeeSgAuthSchemaVerificationFresh(saved.record, Date.parse('2026-09-09T00:00:00.000Z')), 'Test 11: Recent current-SG auth verification is fresh');
  assert(!isShopeeSgAuthSchemaVerificationFresh(saved.record, Date.parse('2027-01-01T00:00:00.000Z')), 'Test 12: Old auth verification requires recheck');

  return { passed, failed, log };
}
