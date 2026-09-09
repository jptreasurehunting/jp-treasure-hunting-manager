import {
  evaluateShopeeSgStructuredTokenMapping,
  getLatestShopeeSgStructuredTokenMapping,
  isShopeeSgStructuredTokenMappingFresh,
  recordShopeeSgStructuredTokenMapping
} from '../shopeeSgStructuredTokenMappingService';

export function runShopeeSgStructuredTokenMappingTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0; let failed = 0; const log: string[] = [];
  const assert = (condition: boolean, name: string) => { if (condition) { passed++; log.push(`✅ [PASS] ${name}`); } else { failed++; log.push(`❌ [FAIL] ${name}`); } };
  localStorage.clear();
  const now = Date.parse('2026-09-09T03:00:00.000Z');
  const authSchema: any = {
    verificationId: 'auth-token-map-1', marketplaceRegion: 'SG', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
    tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get',
    refreshTokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/access_token/get',
    signatureAlgorithm: 'HMAC-SHA256', authorizationSignBaseRule: 'verified', authenticatedApiSignBaseRule: 'verified',
    callbackFields: 'verified', tokenRequestFields: 'verified', authenticatedRequestFields: 'verified', timestampValidityRule: 'verified',
    checkedBy: 'tester', checkedAt: '2026-09-09T02:00:00.000Z', verificationNote: 'official SG auth checked',
    officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true,
    externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false, createdAt: '2026-09-09T02:00:00.000Z', updatedAt: '2026-09-09T02:00:00.000Z'
  };
  const input: any = {
    authSchemaVerificationId: authSchema.verificationId,
    officialSourceUrl: authSchema.officialSourceUrl,
    tokenEndpoint: authSchema.tokenEndpoint,
    tokenHttpMethod: 'POST',
    tokenBodyEncoding: 'JSON',
    tokenQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign' },
    tokenQueryOrder: ['PARTNER_ID_QUERY', 'TIMESTAMP_QUERY', 'SIGNATURE_QUERY'],
    tokenBodyFieldNames: { authorizationCode: 'code', shopId: 'shop_id', partnerId: 'partner_id' },
    tokenBodyRoles: ['AUTHORIZATION_CODE_BODY', 'SHOP_ID_BODY', 'PARTNER_ID_BODY'],
    signatureAlgorithm: 'HMAC-SHA256',
    signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
    tokenResponseFieldNames: { accessToken: 'access_token', refreshToken: 'refresh_token', expiresIn: 'expire_in' },
    expiresInUnit: 'SECONDS',
    allRequiredRequestFieldsRepresented: true,
    allRequiredResponseFieldsRepresented: true,
    checkedBy: 'tester', checkedAt: '2026-09-09T02:30:00.000Z', verificationNote: 'Current SG token exchange fields verified from official docs.',
    officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true
  };

  const evaluation = evaluateShopeeSgStructuredTokenMapping(input, authSchema, now);
  assert(evaluation.canRecord, 'Test 1: Complete official SG token mapping is recordable');

  const saved = recordShopeeSgStructuredTokenMapping(input, authSchema, now);
  assert(Boolean(saved.success && saved.record), 'Test 2: Safe token mapping is stored');
  assert(saved.record?.tokenExchangeAllowed === false && saved.record?.externalNetworkAllowed === false && saved.record?.externalWriteAllowed === false, 'Test 3: Stored mapping grants no token exchange/network/write permission');
  assert(saved.record?.secretsStored === false && JSON.stringify(saved.record).includes('backend-only-secret') === false, 'Test 4: Mapping stores no secret values');

  const latest = getLatestShopeeSgStructuredTokenMapping(authSchema.verificationId);
  assert(latest?.tokenMappingId === saved.record?.tokenMappingId && isShopeeSgStructuredTokenMappingFresh(latest, authSchema, now), 'Test 5: Latest matching token mapping is fresh');

  const endpointMismatch = evaluateShopeeSgStructuredTokenMapping({ ...input, tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/other' }, authSchema, now);
  assert(!endpointMismatch.canRecord && endpointMismatch.blockingReasons.some((r) => r.includes('Token Endpoint')), 'Test 6: Token endpoint mismatch is blocked');

  const duplicateQuery = evaluateShopeeSgStructuredTokenMapping({ ...input, tokenQueryFieldNames: { partnerId: 'x', timestamp: 'x', signature: 'sign' } }, authSchema, now);
  assert(!duplicateQuery.canRecord && duplicateQuery.blockingReasons.some((r) => r.includes('Query内')), 'Test 7: Duplicate query wire names are blocked');

  const incompleteRequest = evaluateShopeeSgStructuredTokenMapping({ ...input, allRequiredRequestFieldsRepresented: false }, authSchema, now);
  assert(!incompleteRequest.canRecord && incompleteRequest.blockingReasons.some((r) => r.includes('必須項目')), 'Test 8: Incomplete required request coverage is blocked');

  const stale = evaluateShopeeSgStructuredTokenMapping({ ...input, checkedAt: '2026-01-01T00:00:00.000Z' }, authSchema, now);
  assert(!stale.canRecord && stale.blockingReasons.some((r) => r.includes('90日以内')), 'Test 9: Stale token mapping evidence is blocked');

  const secretLeak = evaluateShopeeSgStructuredTokenMapping({ ...input, verificationNote: 'access_token=abcdefghijklmnop123456' }, authSchema, now);
  assert(!secretLeak.canRecord && secretLeak.blockingReasons.some((r) => r.includes('秘密値')), 'Test 10: Secret-like token values are blocked from mapping records');

  const wrongSchema = { ...authSchema, verificationId: 'auth-token-map-other' };
  assert(!isShopeeSgStructuredTokenMappingFresh(latest, wrongSchema as any, now), 'Test 11: Mapping is invalidated by auth-schema ID change');

  return { passed, failed, log };
}
