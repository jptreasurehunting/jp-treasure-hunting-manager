import {
  evaluateShopeeSgTokenExchangeRuntime,
  getLatestShopeeSgTokenExchangeRuntime,
  isShopeeSgTokenExchangeRuntimeFresh,
  recordShopeeSgTokenExchangeRuntime
} from '../shopeeSgTokenExchangeRuntimeService';

export function runShopeeSgTokenExchangeRuntimeTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0; let failed = 0; const log: string[] = [];
  const assert = (condition: boolean, name: string) => { if (condition) { passed++; log.push(`✅ [PASS] ${name}`); } else { failed++; log.push(`❌ [FAIL] ${name}`); } };
  localStorage.clear();
  const now = Date.parse('2026-09-09T04:00:00.000Z');
  const auth: any = { verificationId: 'auth-token-runtime-1', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/auth', tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get', signatureAlgorithm: 'HMAC-SHA256', checkedAt: '2026-09-09T03:00:00Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const mapping: any = { tokenMappingId: 'token-map-runtime-1', marketplaceRegion: 'SG', status: 'STRUCTURED_TOKEN_MAPPING_VERIFIED', authSchemaVerificationId: auth.verificationId, officialSourceUrl: auth.officialSourceUrl, tokenEndpoint: auth.tokenEndpoint, tokenHttpMethod: 'POST', tokenBodyEncoding: 'JSON', tokenQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign' }, tokenQueryOrder: ['PARTNER_ID_QUERY','TIMESTAMP_QUERY','SIGNATURE_QUERY'], tokenBodyFieldNames: { authorizationCode: 'code', shopId: 'shop_id', partnerId: 'partner_id' }, tokenBodyRoles: ['AUTHORIZATION_CODE_BODY','SHOP_ID_BODY','PARTNER_ID_BODY'], signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID','API_PATH','TIMESTAMP'], tokenResponseFieldNames: { accessToken: 'access_token', refreshToken: 'refresh_token', expiresIn: 'expire_in' }, expiresInUnit: 'SECONDS', allRequiredRequestFieldsRepresented: true, allRequiredResponseFieldsRepresented: true, checkedAt: '2026-09-09T03:10:00Z', currentSingaporeApplicabilityConfirmed: true, tokenExchangeAllowed: false, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const input: any = { authSchemaVerificationId: auth.verificationId, tokenMappingId: mapping.tokenMappingId, officialSourceUrl: auth.officialSourceUrl, signatureAlgorithmLabel: 'HMAC-SHA256', signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', checkedBy: 'tester', checkedAt: '2026-09-09T03:20:00Z', verificationNote: 'Current SG token signing runtime checked from official docs.', officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true };

  const evaluation = evaluateShopeeSgTokenExchangeRuntime(input, mapping, auth, now);
  assert(evaluation.canRecord, 'Test 1: Complete token runtime verification is recordable');
  const saved = recordShopeeSgTokenExchangeRuntime(input, mapping, auth, now);
  assert(Boolean(saved.success && saved.record), 'Test 2: Token runtime verification is stored');
  assert(saved.record?.previewAllowed === true && saved.record?.tokenExchangeAllowed === false && saved.record?.externalNetworkAllowed === false, 'Test 3: Runtime allows preview only, never live token exchange');
  assert(saved.record?.secretValuesStored === false, 'Test 4: Runtime stores no secret values');
  const latest = getLatestShopeeSgTokenExchangeRuntime(mapping.tokenMappingId);
  assert(latest?.runtimeVerificationId === saved.record?.runtimeVerificationId && isShopeeSgTokenExchangeRuntimeFresh(latest, mapping, auth, now), 'Test 5: Latest runtime is fresh for matching mapping');
  const wrongMapping = evaluateShopeeSgTokenExchangeRuntime({ ...input, tokenMappingId: 'other' }, mapping, auth, now);
  assert(!wrongMapping.canRecord && wrongMapping.blockingReasons.some((r) => r.includes('Mapping ID')), 'Test 6: Runtime mapping ID mismatch is blocked');
  const wrongAlgorithm = evaluateShopeeSgTokenExchangeRuntime({ ...input, signatureAlgorithmLabel: 'OTHER' }, mapping, auth, now);
  assert(!wrongAlgorithm.canRecord && wrongAlgorithm.blockingReasons.some((r) => r.includes('アルゴリズム')), 'Test 7: Algorithm-label mismatch is blocked');
  const stale = evaluateShopeeSgTokenExchangeRuntime({ ...input, checkedAt: '2026-01-01T00:00:00Z' }, mapping, auth, now);
  assert(!stale.canRecord && stale.blockingReasons.some((r) => r.includes('90日以内')), 'Test 8: Stale runtime evidence is blocked');
  const secret = evaluateShopeeSgTokenExchangeRuntime({ ...input, verificationNote: 'authorization_code=abcdefghijklmnop123456' }, mapping, auth, now);
  assert(!secret.canRecord && secret.blockingReasons.some((r) => r.includes('秘密値')), 'Test 9: Secret-like code values are blocked');
  const changedMapping = { ...mapping, tokenMappingId: 'changed' };
  assert(!isShopeeSgTokenExchangeRuntimeFresh(latest, changedMapping as any, auth, now), 'Test 10: Mapping change invalidates runtime');
  return { passed, failed, log };
}
