import {
  evaluateShopeeSgStructuredAuthMapping,
  getLatestShopeeSgStructuredAuthMapping,
  isShopeeSgStructuredAuthMappingFresh,
  loadShopeeSgStructuredAuthMappings,
  recordShopeeSgStructuredAuthMapping,
  saveShopeeSgStructuredAuthMappings,
  ShopeeSgStructuredAuthMappingInput
} from '../shopeeSgStructuredAuthMappingService';
import type { ShopeeSgAuthSchemaVerificationRecord } from '../shopeeSgAuthSchemaVerificationService';

export function runShopeeSgStructuredAuthMappingTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  const now = Date.parse('2026-09-08T04:00:00.000Z');
  const authSchema: ShopeeSgAuthSchemaVerificationRecord = {
    verificationId: 'auth-schema-live-sg-1',
    marketplaceRegion: 'SG',
    officialSourceUrl: 'https://open.shopee.com/developer-guide/16',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
    tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get',
    refreshTokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/access_token/get',
    signatureAlgorithm: 'OFFICIALLY_VERIFIED_ALGORITHM',
    authorizationSignBaseRule: 'officially verified textual rule',
    authenticatedApiSignBaseRule: 'officially verified textual rule',
    callbackFields: 'officially verified textual fields',
    tokenRequestFields: 'officially verified textual fields',
    authenticatedRequestFields: 'officially verified textual fields',
    timestampValidityRule: 'officially verified textual rule',
    checkedBy: 'owner',
    checkedAt: '2026-09-08T03:00:00.000Z',
    verificationNote: 'Current Singapore official documentation reviewed.',
    officialDocumentationConfirmed: true,
    currentSingaporeApplicabilityConfirmed: true,
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: '2026-09-08T03:00:00.000Z',
    updatedAt: '2026-09-08T03:00:00.000Z'
  };

  const validInput: ShopeeSgStructuredAuthMappingInput = {
    authSchemaVerificationId: authSchema.verificationId,
    officialSourceUrl: authSchema.officialSourceUrl,
    authorizationEndpoint: authSchema.authorizationEndpoint,
    authorizationHttpMethod: 'GET',
    authorizationQueryFieldNames: {
      partnerId: 'partner_id',
      timestamp: 'timestamp',
      signature: 'sign',
      redirectUri: 'redirect'
    },
    authorizationQueryOrder: ['PARTNER_ID', 'TIMESTAMP', 'SIGNATURE', 'REDIRECT_URI'],
    signatureAlgorithm: 'OFFICIAL_ALGORITHM_LABEL',
    signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
    callbackFieldNames: {
      authorizationCode: 'code',
      shopId: 'shop_id'
    },
    checkedBy: 'owner',
    checkedAt: '2026-09-08T03:30:00.000Z',
    verificationNote: 'Exact wire names and component order checked against current SG official docs.',
    officialDocumentationConfirmed: true,
    currentSingaporeApplicabilityConfirmed: true
  };

  localStorage.clear();

  const evaluation = evaluateShopeeSgStructuredAuthMapping(validInput, authSchema, now);
  assert(evaluation.canRecord && evaluation.blockingReasons.length === 0, 'Test 1: Fresh linked structured mapping can be recorded');

  const saved = recordShopeeSgStructuredAuthMapping(validInput, authSchema, now);
  assert(saved.success && saved.record?.status === 'STRUCTURED_AUTH_MAPPING_VERIFIED', 'Test 2: Structured mapping is saved as verified mapping metadata');
  assert(
    saved.record?.externalNetworkAllowed === false &&
    saved.record?.externalWriteAllowed === false &&
    saved.record?.secretsStored === false,
    'Test 3: Structured mapping cannot grant network/write permission or store secrets'
  );

  const stored = loadShopeeSgStructuredAuthMappings();
  assert(stored.length === 1 && stored[0].authSchemaVerificationId === authSchema.verificationId, 'Test 4: Mapping is persisted and linked to the exact auth schema verification');
  assert(isShopeeSgStructuredAuthMappingFresh(stored[0], authSchema, now), 'Test 5: Fresh mapping linked to current auth schema is reusable');
  assert(getLatestShopeeSgStructuredAuthMapping(authSchema.verificationId)?.mappingId === stored[0].mappingId, 'Test 6: Latest mapping lookup is scoped by auth schema verification ID');

  const badWire = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    authorizationQueryFieldNames: { ...validInput.authorizationQueryFieldNames, signature: 'sign=value' }
  }, authSchema, now);
  assert(!badWire.canRecord && badWire.blockingReasons.some((reason) => reason.includes('wire name')), 'Test 7: Unsafe wire field names are blocked');

  const duplicateWire = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    authorizationQueryFieldNames: { ...validInput.authorizationQueryFieldNames, signature: 'timestamp' }
  }, authSchema, now);
  assert(!duplicateWire.canRecord && duplicateWire.blockingReasons.some((reason) => reason.includes('重複')), 'Test 8: Duplicate authorization query field mappings are blocked');

  const invalidQueryOrder = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    authorizationQueryOrder: ['PARTNER_ID', 'TIMESTAMP', 'SIGNATURE', 'SIGNATURE'] as any
  }, authSchema, now);
  assert(!invalidQueryOrder.canRecord && invalidQueryOrder.blockingReasons.some((reason) => reason.includes('Query順序')), 'Test 9: Query order must contain each structured role exactly once');

  const unsupportedComponent = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'UNKNOWN_COMPONENT' as any]
  }, authSchema, now);
  assert(!unsupportedComponent.canRecord && unsupportedComponent.blockingReasons.some((reason) => reason.includes('未対応')), 'Test 10: Unknown signature components are blocked instead of guessed');

  const mismatchedSchema = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    authSchemaVerificationId: 'another-auth-schema'
  }, authSchema, now);
  assert(!mismatchedSchema.canRecord && mismatchedSchema.blockingReasons.some((reason) => reason.includes('verificationId')), 'Test 11: Mapping cannot attach to a different auth schema verification');

  const mismatchedEndpoint = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/another_auth_path'
  }, authSchema, now);
  assert(!mismatchedEndpoint.canRecord && mismatchedEndpoint.blockingReasons.some((reason) => reason.includes('Endpoint')), 'Test 12: Mapping endpoint must match the verified auth schema endpoint');

  const staleMapping = { ...stored[0], checkedAt: '2026-05-01T00:00:00.000Z' };
  assert(!isShopeeSgStructuredAuthMappingFresh(staleMapping, authSchema, now), 'Test 13: Old structured mapping expires instead of being treated as permanently valid');

  const leakedSecret = evaluateShopeeSgStructuredAuthMapping({
    ...validInput,
    verificationNote: 'partner_key=THIS_LOOKS_LIKE_A_REAL_SECRET_123456789'
  }, authSchema, now);
  assert(!leakedSecret.canRecord && leakedSecret.blockingReasons.some((reason) => reason.includes('秘密値')), 'Test 14: Secret-like values are blocked from structured mapping storage');

  const newerAuthSchema: ShopeeSgAuthSchemaVerificationRecord = {
    ...authSchema,
    verificationId: 'auth-schema-live-sg-2',
    checkedAt: '2026-09-08T03:45:00.000Z',
    createdAt: '2026-09-08T03:45:00.000Z',
    updatedAt: '2026-09-08T03:45:00.000Z'
  };
  assert(!isShopeeSgStructuredAuthMappingFresh(stored[0], newerAuthSchema, now), 'Test 15: A new auth schema verification invalidates the old structured mapping');

  saveShopeeSgStructuredAuthMappings([]);
  assert(loadShopeeSgStructuredAuthMappings().length === 0, 'Test 16: Structured mapping storage can be reset without affecting other records');

  return { passed, failed, log };
}
