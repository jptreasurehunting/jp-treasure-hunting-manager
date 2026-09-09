const { setDB } = require('../db/database');
const SqliteProvider = require('../db/sqliteProvider');
const { prepareShopeeSgAuthorizationSession, getShopeeSgAuthorizationSessionStatus, SESSION_TTL_MS } = require('../integrations/shopeeSgAuthorizationSessionBackend');
const { issueShopeeSgAuthorizationRequestPreview, STATE_BYTES } = require('../integrations/shopeeSgAuthorizationRequestAssemblyBackend');

describe('Shopee SG Preview-Only Signed Authorization Request Assembly', () => {
  let db;
  const credentialRef = 'SHOPEE_SG_ASSEMBLY_TEST';
  const now = Date.parse('2026-09-09T03:00:00.000Z');

  const schemaVerification = { verificationId: 'schema-assembly-1', status: 'OFFICIAL_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory', checkedAt: '2026-09-09T02:00:00.000Z', externalWriteAllowed: false };
  const authSchemaVerification = { verificationId: 'auth-assembly-1', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner', checkedAt: '2026-09-09T02:05:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const structuredAuthorizationMapping = { mappingId: 'mapping-assembly-1', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED', authSchemaVerificationId: 'auth-assembly-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', authorizationEndpoint: authSchemaVerification.authorizationEndpoint, authorizationHttpMethod: 'GET', authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' }, authorizationQueryOrder: ['PARTNER_ID','TIMESTAMP','SIGNATURE','REDIRECT_URI'], signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID','API_PATH','TIMESTAMP'], callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' }, checkedAt: '2026-09-09T02:10:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const signingRuntimeVerification = { runtimeVerificationId: 'runtime-assembly-1', marketplaceRegion: 'SG', status: 'SIGNING_RUNTIME_VERIFIED', authSchemaVerificationId: 'auth-assembly-1', structuredMappingId: 'mapping-assembly-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', signatureAlgorithmLabel: 'HMAC-SHA256', signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', redirectUriSource: 'BACKEND_ENV', checkedAt: '2026-09-09T02:15:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretValuesStored: false };
  const callbackCorrelationMapping = { correlationMappingId: 'corr-assembly-1', marketplaceRegion: 'SG', status: 'CALLBACK_CORRELATION_VERIFIED', authSchemaVerificationId: 'auth-assembly-1', structuredMappingId: 'mapping-assembly-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', correlationMode: 'OFFICIAL_ROUND_TRIP_FIELD', authorizationRequestFieldName: 'state', callbackFieldName: 'state', signatureParticipation: 'NOT_INCLUDED', checkedAt: '2026-09-09T02:20:00.000Z', currentSingaporeApplicabilityConfirmed: true, safeSessionPreparationAllowed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const input = { accountId: 'shopee_sg_main', shopId: '99887766', credentialRef, schemaVerification, authSchemaVerification, structuredAuthorizationMapping, signingRuntimeVerification, callbackCorrelationMapping };

  beforeAll(async () => { db = new SqliteProvider(':memory:'); await db.initialize(); setDB(db); });
  beforeEach(() => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'assembly-backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';
  });
  afterEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    delete process.env[`${credentialRef}_REDIRECT_URI`];
  });
  afterAll(async () => { if (db) await db.close(); });

  test('issues one preview state, stores only its hash, and never returns executable secret material', async () => {
    const session = await prepareShopeeSgAuthorizationSession(input, now);
    const result = await issueShopeeSgAuthorizationRequestPreview({ ...input, sessionId: session.sessionId }, now + 1000);

    expect(result.mode).toBe('SIGNED_AUTHORIZATION_REQUEST_PREVIEW_NO_NETWORK');
    expect(result.sessionStatus).toBe('STATE_ISSUED_PREVIEW_ONLY');
    expect(result.correlationStateIssued).toBe(true);
    expect(result.correlationStateEntropyBytes).toBe(STATE_BYTES);
    expect(result.signatureGenerated).toBe(true);
    expect(result.networkAction).toBe('NONE');
    expect(result.sendAllowed).toBe(false);
    expect(result.externalWritePerformed).toBe(false);
    expect(result.executableAuthorizationUrlReturned).toBe(false);
    expect(result.correlationStateValueReturned).toBe(false);
    expect(result.correlationStateHashReturned).toBe(false);
    expect(result.signatureValueReturned).toBe(false);
    expect(result.signatureBaseReturned).toBe(false);
    expect(result.partnerIdValueReturned).toBe(false);
    expect(result.partnerKeyValueReturned).toBe(false);
    expect(result.authorizationRequestFingerprint).toMatch(/^[a-f0-9]{64}$/);

    const row = await db.getShopeeSgAuthSession(session.sessionId);
    expect(row.status).toBe('STATE_ISSUED_PREVIEW_ONLY');
    expect(row.correlation_state_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.correlation_state_issued_at).toBeTruthy();
    const responseText = JSON.stringify(result);
    const storedText = JSON.stringify(row);
    expect(responseText).not.toContain('assembly-backend-only-secret');
    expect(storedText).not.toContain('assembly-backend-only-secret');
    expect(responseText).not.toContain('123456');
  });

  test('same session cannot issue preview correlation state twice', async () => {
    const session = await prepareShopeeSgAuthorizationSession(input, now + 2000);
    await issueShopeeSgAuthorizationRequestPreview({ ...input, sessionId: session.sessionId }, now + 3000);
    await expect(issueShopeeSgAuthorizationRequestPreview({ ...input, sessionId: session.sessionId }, now + 4000)).rejects.toMatchObject({ code: 'SHOPEE_AUTH_SESSION_STATE_ALREADY_ISSUED' });
  });

  test('safe session status reports preview-only state issuance without returning state or hash', async () => {
    const session = await prepareShopeeSgAuthorizationSession(input, now + 5000);
    await issueShopeeSgAuthorizationRequestPreview({ ...input, sessionId: session.sessionId }, now + 6000);
    const status = await getShopeeSgAuthorizationSessionStatus(session.sessionId, now + 7000);
    expect(status.status).toBe('STATE_ISSUED_PREVIEW_ONLY');
    expect(status.correlationStateIssued).toBe(true);
    expect(status.correlationStateValueReturned).toBe(false);
    expect(status.correlationStateHashReturned).toBe(false);
    expect(status.canIssueCorrelationStateInFutureAuthStart).toBe(false);
    expect(status.canStartAuthorization).toBe(false);
  });

  test('expired session cannot issue preview state', async () => {
    const session = await prepareShopeeSgAuthorizationSession(input, now + 8000);
    await expect(issueShopeeSgAuthorizationRequestPreview({ ...input, sessionId: session.sessionId }, now + 8000 + SESSION_TTL_MS + 1)).rejects.toMatchObject({ code: 'SHOPEE_AUTH_SESSION_EXPIRED' });
  });

  test('session identity drift is blocked before state issuance', async () => {
    const session = await prepareShopeeSgAuthorizationSession(input, now + 9000);
    await expect(issueShopeeSgAuthorizationRequestPreview({ ...input, accountId: 'different_account', sessionId: session.sessionId }, now + 10000)).rejects.toMatchObject({ code: 'SHOPEE_AUTH_SESSION_BINDING_MISMATCH' });
    const row = await db.getShopeeSgAuthSession(session.sessionId);
    expect(row.correlation_state_hash).toBeNull();
    expect(row.status).toBe('PREPARED');
  });
});
