import {
  evaluateShopeeSgAuthorizationSigningRuntime,
  getLatestShopeeSgAuthorizationSigningRuntime,
  isShopeeSgAuthorizationSigningRuntimeFresh,
  loadShopeeSgAuthorizationSigningRuntimeRecords,
  recordShopeeSgAuthorizationSigningRuntime,
  saveShopeeSgAuthorizationSigningRuntimeRecords,
  ShopeeSgAuthorizationSigningRuntimeInput
} from '../shopeeSgAuthorizationSigningRuntimeService';
import type { ShopeeSgAuthSchemaVerificationRecord } from '../shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredAuthMappingRecord } from '../shopeeSgStructuredAuthMappingService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

export function runShopeeSgAuthorizationSigningRuntimeTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  const now = Date.parse('2026-09-09T01:00:00.000Z');
  const authSchema: ShopeeSgAuthSchemaVerificationRecord = {
    verificationId: 'auth-schema-runtime-1', marketplaceRegion: 'SG',
    officialSourceUrl: 'https://open.shopee.com/developer-guide/auth',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
    tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get',
    refreshTokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/access_token/get',
    signatureAlgorithm: 'HMAC-SHA256', authorizationSignBaseRule: 'verified', authenticatedApiSignBaseRule: 'verified',
    callbackFields: 'verified', tokenRequestFields: 'verified', authenticatedRequestFields: 'verified', timestampValidityRule: 'verified',
    checkedBy: 'owner', checkedAt: '2026-09-09T00:00:00.000Z', verificationNote: 'verified',
    officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true,
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false,
    createdAt: '2026-09-09T00:00:00.000Z', updatedAt: '2026-09-09T00:00:00.000Z'
  };
  const structured: ShopeeSgStructuredAuthMappingRecord = {
    mappingId: 'structured-runtime-1', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED',
    authSchemaVerificationId: authSchema.verificationId,
    officialSourceUrl: authSchema.officialSourceUrl,
    authorizationEndpoint: authSchema.authorizationEndpoint,
    authorizationHttpMethod: 'GET',
    authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' },
    authorizationQueryOrder: ['PARTNER_ID', 'TIMESTAMP', 'SIGNATURE', 'REDIRECT_URI'],
    signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
    callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' },
    checkedBy: 'owner', checkedAt: '2026-09-09T00:10:00.000Z', verificationNote: 'verified mapping',
    officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true,
    externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false,
    createdAt: '2026-09-09T00:10:00.000Z', updatedAt: '2026-09-09T00:10:00.000Z'
  };
  const input: ShopeeSgAuthorizationSigningRuntimeInput = {
    authSchemaVerificationId: authSchema.verificationId,
    structuredMappingId: structured.mappingId,
    officialSourceUrl: authSchema.officialSourceUrl,
    signatureAlgorithmLabel: structured.signatureAlgorithm,
    signatureImplementation: 'HMAC_SHA256_HEX',
    signatureBaseSerialization: 'CONCAT_NO_SEPARATOR',
    redirectUriSource: 'BACKEND_ENV',
    checkedBy: 'owner', checkedAt: '2026-09-09T00:20:00.000Z', verificationNote: 'Exact runtime encoding and serialization verified.',
    officialDocumentationConfirmed: true, currentSingaporeApplicabilityConfirmed: true
  };

  localStorage.clear();
  const evaluation = evaluateShopeeSgAuthorizationSigningRuntime(input, structured, authSchema, now);
  assert(evaluation.canRecord, 'Test 1: Fresh exact signing runtime can be recorded');

  const saved = recordShopeeSgAuthorizationSigningRuntime(input, structured, authSchema, now);
  assert(saved.success && saved.record?.status === 'SIGNING_RUNTIME_VERIFIED', 'Test 2: Signing runtime is stored as verified metadata');
  assert(saved.record?.externalNetworkAllowed === false && saved.record?.externalWriteAllowed === false && saved.record?.secretValuesStored === false, 'Test 3: Runtime record grants no external permission and stores no secrets');
  assert(loadShopeeSgAuthorizationSigningRuntimeRecords().length === 1, 'Test 4: Runtime record persists locally');
  assert(isShopeeSgAuthorizationSigningRuntimeFresh(saved.record, structured, authSchema, now), 'Test 5: Fresh runtime remains reusable with the exact mapping');
  assert(getLatestShopeeSgAuthorizationSigningRuntime(structured.mappingId)?.runtimeVerificationId === saved.record?.runtimeVerificationId, 'Test 6: Runtime lookup is scoped by structured mapping ID');

  const wrongAlgorithm = evaluateShopeeSgAuthorizationSigningRuntime({ ...input, signatureAlgorithmLabel: 'different' }, structured, authSchema, now);
  assert(!wrongAlgorithm.canRecord && wrongAlgorithm.blockingReasons.some((reason) => reason.includes('完全一致')), 'Test 7: Runtime algorithm label must match structured mapping exactly');

  const wrongMapping = evaluateShopeeSgAuthorizationSigningRuntime({ ...input, structuredMappingId: 'other' }, structured, authSchema, now);
  assert(!wrongMapping.canRecord && wrongMapping.blockingReasons.some((reason) => reason.includes('Mapping ID')), 'Test 8: Runtime cannot bind to another structured mapping');

  const secretLeak = evaluateShopeeSgAuthorizationSigningRuntime({ ...input, verificationNote: 'partner_key=THIS_IS_A_SECRET_VALUE_123456' }, structured, authSchema, now);
  assert(!secretLeak.canRecord && secretLeak.blockingReasons.some((reason) => reason.includes('秘密値')), 'Test 9: Secret-like values are blocked');

  const stale = { ...saved.record!, checkedAt: '2026-01-01T00:00:00.000Z' };
  assert(!isShopeeSgAuthorizationSigningRuntimeFresh(stale, structured, authSchema, now), 'Test 10: Stale runtime verification expires');

  const newerMapping = { ...structured, mappingId: 'structured-runtime-2' };
  assert(!isShopeeSgAuthorizationSigningRuntimeFresh(saved.record, newerMapping, authSchema, now), 'Test 11: Replacing structured mapping invalidates prior runtime verification');

  saveShopeeSgAuthorizationSigningRuntimeRecords([]);
  assert(loadShopeeSgAuthorizationSigningRuntimeRecords().length === 0, 'Test 12: Signing runtime records can be reset');

  return { passed, failed, log };
}
