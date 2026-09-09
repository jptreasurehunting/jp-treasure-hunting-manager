import {
  evaluateShopeeSgCallbackCorrelationMapping,
  getLatestShopeeSgCallbackCorrelationMapping,
  isShopeeSgCallbackCorrelationMappingFresh,
  loadShopeeSgCallbackCorrelationMappings,
  recordShopeeSgCallbackCorrelationMapping,
  saveShopeeSgCallbackCorrelationMappings
} from '../shopeeSgCallbackCorrelationMappingService';
import type { ShopeeSgAuthSchemaVerificationRecord } from '../shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredAuthMappingRecord } from '../shopeeSgStructuredAuthMappingService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = { getItem: (k: string) => store[k] || null, setItem: (k: string, v: string) => { store[k] = String(v); }, removeItem: (k: string) => { delete store[k]; }, clear: () => Object.keys(store).forEach((k) => delete store[k]) };
}

export function runShopeeSgCallbackCorrelationMappingTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0; let failed = 0; const log: string[] = [];
  const assert = (condition: boolean, name: string) => { if (condition) { passed++; log.push(`✅ [PASS] ${name}`); } else { failed++; log.push(`❌ [FAIL] ${name}`); } };
  const now = Date.parse('2026-09-09T02:00:00.000Z');
  const auth: ShopeeSgAuthSchemaVerificationRecord = {
    verificationId: 'auth-corr-1', marketplaceRegion: 'SG', officialSourceUrl: 'https://open.shopee.com/developer-guide/auth', authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner', tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get', refreshTokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/access_token/get', signatureAlgorithm: 'HMAC-SHA256', authorizationSignBaseRule: 'verified', authenticatedApiSignBaseRule: 'verified', callbackFields: 'verified', tokenRequestFields: 'verified', authenticatedRequestFields: 'verified', timestampValidityRule: 'verified', checkedBy: 'owner', checkedAt: '2026-09-09T01:00:00.000Z', verificationNote: 'verified', officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true, status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false, createdAt: '2026-09-09T01:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z'
  };
  const structured: ShopeeSgStructuredAuthMappingRecord = {
    mappingId: 'structured-corr-1', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED', authSchemaVerificationId: auth.verificationId, officialSourceUrl: auth.officialSourceUrl, authorizationEndpoint: auth.authorizationEndpoint, authorizationHttpMethod: 'GET', authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' }, authorizationQueryOrder: ['PARTNER_ID','TIMESTAMP','SIGNATURE','REDIRECT_URI'], signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID','API_PATH','TIMESTAMP'], callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' }, checkedBy: 'owner', checkedAt: '2026-09-09T01:10:00.000Z', verificationNote: 'verified', officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false, createdAt: '2026-09-09T01:10:00.000Z', updatedAt: '2026-09-09T01:10:00.000Z'
  };
  const valid: any = { authSchemaVerificationId: auth.verificationId, structuredMappingId: structured.mappingId, officialSourceUrl: auth.officialSourceUrl, correlationMode: 'OFFICIAL_ROUND_TRIP_FIELD', authorizationRequestFieldName: 'state', callbackFieldName: 'state', signatureParticipation: 'NOT_INCLUDED', checkedBy: 'owner', checkedAt: '2026-09-09T01:20:00.000Z', verificationNote: 'Current SG round-trip correlation field verified.', officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true };

  localStorage.clear();
  const evaluation = evaluateShopeeSgCallbackCorrelationMapping(valid, structured, auth, now);
  assert(evaluation.canRecord && evaluation.safeSessionPreparationAllowed, 'Test 1: Verified round-trip field can allow safe session preparation');
  const saved = recordShopeeSgCallbackCorrelationMapping(valid, structured, auth, now);
  assert(saved.success && saved.record?.safeSessionPreparationAllowed === true, 'Test 2: Safe correlation mapping persists with session-preparation flag');
  assert(saved.record?.externalNetworkAllowed === false && saved.record?.externalWriteAllowed === false && saved.record?.secretsStored === false, 'Test 3: Correlation mapping grants no network/write permission and stores no secrets');
  assert(loadShopeeSgCallbackCorrelationMappings().length === 1, 'Test 4: Correlation mapping persists locally');
  assert(isShopeeSgCallbackCorrelationMappingFresh(saved.record, structured, auth, now), 'Test 5: Fresh correlation mapping remains valid for exact structured mapping');
  assert(getLatestShopeeSgCallbackCorrelationMapping(structured.mappingId)?.correlationMappingId === saved.record?.correlationMappingId, 'Test 6: Latest correlation lookup is structured-mapping scoped');

  const noRoundTrip = evaluateShopeeSgCallbackCorrelationMapping({ ...valid, correlationMode: 'NO_OFFICIAL_ROUND_TRIP_FIELD', authorizationRequestFieldName: '', callbackFieldName: '' }, structured, auth, now);
  assert(noRoundTrip.canRecord && !noRoundTrip.safeSessionPreparationAllowed, 'Test 7: Official absence can be recorded but safely blocks auth-session preparation');
  const signedState = evaluateShopeeSgCallbackCorrelationMapping({ ...valid, signatureParticipation: 'INCLUDED_REQUIRES_MAPPING_UPDATE' }, structured, auth, now);
  assert(signedState.canRecord && !signedState.safeSessionPreparationAllowed, 'Test 8: Correlation included in signature base blocks session until structured signing mapping is updated');
  const badField = evaluateShopeeSgCallbackCorrelationMapping({ ...valid, callbackFieldName: 'state=value' }, structured, auth, now);
  assert(!badField.canRecord && badField.blockingReasons.some((r) => r.includes('wire field')), 'Test 9: Unsafe callback wire field is rejected');
  const wrongMapping = evaluateShopeeSgCallbackCorrelationMapping({ ...valid, structuredMappingId: 'other' }, structured, auth, now);
  assert(!wrongMapping.canRecord && wrongMapping.blockingReasons.some((r) => r.includes('Mapping ID')), 'Test 10: Correlation mapping cannot bind to another structured mapping');
  const leaked = evaluateShopeeSgCallbackCorrelationMapping({ ...valid, verificationNote: 'authorization_code=VERY_SECRET_CODE_123456789' }, structured, auth, now);
  assert(!leaked.canRecord && leaked.blockingReasons.some((r) => r.includes('秘密値')), 'Test 11: Secret-like values are blocked');
  const stale = { ...saved.record!, checkedAt: '2026-01-01T00:00:00.000Z' };
  assert(!isShopeeSgCallbackCorrelationMappingFresh(stale, structured, auth, now), 'Test 12: Stale correlation mapping expires');
  saveShopeeSgCallbackCorrelationMappings([]);
  assert(loadShopeeSgCallbackCorrelationMappings().length === 0, 'Test 13: Correlation mapping storage can be reset');
  return { passed, failed, log };
}
