const { setDB } = require('../db/database');
const SqliteProvider = require('../db/sqliteProvider');
const {
  prepareShopeeSgAuthorizationSession,
  getShopeeSgAuthorizationSessionStatus,
  SESSION_TTL_MS
} = require('../integrations/shopeeSgAuthorizationSessionBackend');

describe('Shopee SG Authorization Session Preparation Safety', () => {
  let db;
  const credentialRef = 'SHOPEE_SG_SESSION_TEST';
  const now = Date.parse('2026-09-09T02:00:00.000Z');

  const schemaVerification = { verificationId: 'schema-session-1', status: 'OFFICIAL_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory', checkedAt: '2026-09-09T01:00:00.000Z', externalWriteAllowed: false };
  const authSchemaVerification = { verificationId: 'auth-session-1', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner', checkedAt: '2026-09-09T01:05:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const structuredAuthorizationMapping = { mappingId: 'mapping-session-1', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED', authSchemaVerificationId: 'auth-session-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', authorizationEndpoint: authSchemaVerification.authorizationEndpoint, authorizationHttpMethod: 'GET', authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' }, authorizationQueryOrder: ['PARTNER_ID','TIMESTAMP','SIGNATURE','REDIRECT_URI'], signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID','API_PATH','TIMESTAMP'], callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' }, checkedAt: '2026-09-09T01:10:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const signingRuntimeVerification = { runtimeVerificationId: 'runtime-session-1', marketplaceRegion: 'SG', status: 'SIGNING_RUNTIME_VERIFIED', authSchemaVerificationId: 'auth-session-1', structuredMappingId: 'mapping-session-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', signatureAlgorithmLabel: 'HMAC-SHA256', signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', redirectUriSource: 'BACKEND_ENV', checkedAt: '2026-09-09T01:15:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretValuesStored: false };
  const callbackCorrelationMapping = { correlationMappingId: 'corr-session-1', marketplaceRegion: 'SG', status: 'CALLBACK_CORRELATION_VERIFIED', authSchemaVerificationId: 'auth-session-1', structuredMappingId: 'mapping-session-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', correlationMode: 'OFFICIAL_ROUND_TRIP_FIELD', authorizationRequestFieldName: 'state', callbackFieldName: 'state', signatureParticipation: 'NOT_INCLUDED', checkedAt: '2026-09-09T01:20:00.000Z', currentSingaporeApplicabilityConfirmed: true, safeSessionPreparationAllowed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const input = { accountId: 'shopee_sg_main', shopId: '99887766', credentialRef, schemaVerification, authSchemaVerification, structuredAuthorizationMapping, signingRuntimeVerification, callbackCorrelationMapping };

  beforeAll(async () => { db = new SqliteProvider(':memory:'); await db.initialize(); setDB(db); });
  beforeEach(() => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';
  });
  afterEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`]; delete process.env[`${credentialRef}_PARTNER_KEY`]; delete process.env[`${credentialRef}_REDIRECT_URI`];
  });
  afterAll(async () => { if (db) await db.close(); });

  test('prepares a short-lived session without issuing state or contacting Shopee', async () => {
    const result = await prepareShopeeSgAuthorizationSession(input, now);
    expect(result.mode).toBe('AUTHORIZATION_SESSION_PREPARED_NO_NETWORK');
    expect(result.status).toBe('PREPARED');
    expect(result.networkAction).toBe('NONE');
    expect(result.externalWritePerformed).toBe(false);
    expect(result.correlationStateIssued).toBe(false);
    expect(result.canStartAuthorization).toBe(false);
    expect(Date.parse(result.expiresAt) - Date.parse(result.issuedAt)).toBe(SESSION_TTL_MS);
  });

  test('stored session contains no raw state, auth code, signature, or Partner Key', async () => {
    const result = await prepareShopeeSgAuthorizationSession(input, now + 1000);
    const row = await db.getShopeeSgAuthSession(result.sessionId);
    expect(row.correlation_state_hash).toBeNull();
    expect(row.correlation_state_issued_at).toBeNull();
    const serialized = JSON.stringify(row);
    expect(serialized).not.toContain('backend-only-secret');
    expect(serialized.toLowerCase()).not.toContain('authorization_code');
    expect(serialized.toLowerCase()).not.toContain('signature_value');
  });

  test('safe status response exposes no correlation state/hash or secret values', async () => {
    const prepared = await prepareShopeeSgAuthorizationSession(input, now + 2000);
    const result = await getShopeeSgAuthorizationSessionStatus(prepared.sessionId, now + 3000);
    expect(result.sessionId).toBe(prepared.sessionId);
    expect(result.correlationStateValueReturned).toBe(false);
    expect(result.correlationStateHashReturned).toBe(false);
    expect(result.authorizationCodeStored).toBe(false);
    expect(result.secretValuesReturned).toBe(false);
  });

  test('official absence of round-trip correlation blocks session preparation', async () => {
    await expect(prepareShopeeSgAuthorizationSession({ ...input, callbackCorrelationMapping: { ...callbackCorrelationMapping, correlationMode: 'NO_OFFICIAL_ROUND_TRIP_FIELD', authorizationRequestFieldName: '', callbackFieldName: '', safeSessionPreparationAllowed: false } }, now)).rejects.toThrow('safe auth-session preparation is blocked');
  });

  test('correlation participating in signature blocks until structured signing mapping is updated', async () => {
    await expect(prepareShopeeSgAuthorizationSession({ ...input, callbackCorrelationMapping: { ...callbackCorrelationMapping, signatureParticipation: 'INCLUDED_REQUIRES_MAPPING_UPDATE', safeSessionPreparationAllowed: false } }, now)).rejects.toThrow('structured signing mapping must be updated');
  });

  test('correlation field collision with existing authorization query is blocked', async () => {
    await expect(prepareShopeeSgAuthorizationSession({ ...input, callbackCorrelationMapping: { ...callbackCorrelationMapping, authorizationRequestFieldName: 'timestamp' } }, now)).rejects.toThrow('collides with an existing authorization query field');
  });

  test('correlation callback collision with code/shop callback fields is blocked', async () => {
    await expect(prepareShopeeSgAuthorizationSession({ ...input, callbackCorrelationMapping: { ...callbackCorrelationMapping, callbackFieldName: 'code' } }, now)).rejects.toThrow('collides with authorization-code or shop-ID');
  });

  test('expired session status fails closed without becoming executable', async () => {
    const prepared = await prepareShopeeSgAuthorizationSession(input, now + 4000);
    const result = await getShopeeSgAuthorizationSessionStatus(prepared.sessionId, now + 4000 + SESSION_TTL_MS + 1);
    expect(result.status).toBe('EXPIRED');
    expect(result.canIssueCorrelationStateInFutureAuthStart).toBe(false);
    expect(result.canStartAuthorization).toBe(false);
    expect(result.networkAction).toBe('NONE');
  });
});
