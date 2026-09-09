const { buildShopeeSgAuthorizationSigningPreview } = require('../integrations/shopeeSgAuthorizationSigningPreviewBackend');

describe('Shopee SG Authorization Signing Preview Safety', () => {
  const credentialRef = 'SHOPEE_SG_SIGNING_TEST';
  const now = Date.parse('2026-09-09T01:00:00.000Z');
  const schemaVerification = {
    verificationId: 'schema-signing-1', status: 'OFFICIAL_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory', checkedAt: '2026-09-09T00:00:00.000Z', externalWriteAllowed: false
  };
  const authSchemaVerification = {
    verificationId: 'auth-signing-1', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
    checkedAt: '2026-09-09T00:05:00.000Z', currentSingaporeApplicabilityConfirmed: true,
    externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false
  };
  const structuredAuthorizationMapping = {
    mappingId: 'mapping-signing-1', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED',
    authSchemaVerificationId: 'auth-signing-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner', authorizationHttpMethod: 'GET',
    authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' },
    authorizationQueryOrder: ['PARTNER_ID', 'TIMESTAMP', 'SIGNATURE', 'REDIRECT_URI'],
    signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
    callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' }, checkedAt: '2026-09-09T00:10:00.000Z',
    currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false
  };
  const signingRuntimeVerification = {
    runtimeVerificationId: 'runtime-signing-1', marketplaceRegion: 'SG', status: 'SIGNING_RUNTIME_VERIFIED',
    authSchemaVerificationId: 'auth-signing-1', structuredMappingId: 'mapping-signing-1',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', signatureAlgorithmLabel: 'HMAC-SHA256',
    signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', redirectUriSource: 'BACKEND_ENV',
    checkedAt: '2026-09-09T00:15:00.000Z', currentSingaporeApplicabilityConfirmed: true,
    externalNetworkAllowed: false, externalWriteAllowed: false, secretValuesStored: false
  };

  const input = {
    accountId: 'shopee_sg_main', shopId: '99887766', credentialRef,
    schemaVerification, authSchemaVerification, structuredAuthorizationMapping, signingRuntimeVerification
  };

  beforeEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    delete process.env[`${credentialRef}_REDIRECT_URI`];
  });

  afterEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    delete process.env[`${credentialRef}_REDIRECT_URI`];
  });

  test('complete backend config can compute a signature internally without returning it', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';

    const result = buildShopeeSgAuthorizationSigningPreview(input, now);
    expect(result.mode).toBe('AUTHORIZATION_SIGNING_PREVIEW_ONLY');
    expect(result.runtimeConfigState.complete).toBe(true);
    expect(result.signatureGenerated).toBe(true);
    expect(result.signatureLength).toBe(64);
    expect(result.canPrepareSignedAuthorizationRequest).toBe(true);
    expect(result.canStartAuthorization).toBe(false);
    expect(result.sendAllowed).toBe(false);
    expect(result.networkAction).toBe('NONE');
  });

  test('secret values and signature material are never returned', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';

    const result = buildShopeeSgAuthorizationSigningPreview(input, now);
    const serialized = JSON.stringify(result);
    expect(result.signatureValueReturned).toBe(false);
    expect(result.signatureBaseReturned).toBe(false);
    expect(result.partnerIdValueReturned).toBe(false);
    expect(result.partnerKeyValueReturned).toBe(false);
    expect(result.secretValuesReturned).toBe(false);
    expect(result.authorizationUrlReturned).toBe(false);
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('backend-only-secret');
  });

  test('missing runtime config produces a blocked preview without hidden network action', () => {
    const result = buildShopeeSgAuthorizationSigningPreview(input, now);
    expect(result.runtimeConfigState.complete).toBe(false);
    expect(result.signatureGenerated).toBe(false);
    expect(result.canPrepareSignedAuthorizationRequest).toBe(false);
    expect(result.networkAction).toBe('NONE');
    expect(result.blockingReasons.some((reason) => reason.includes('Partner ID'))).toBe(true);
    expect(result.blockingReasons.some((reason) => reason.includes('Redirect URI'))).toBe(true);
  });

  test('non-HTTPS redirect URI is rejected before signature generation', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'http://localhost:3001/callback';
    expect(() => buildShopeeSgAuthorizationSigningPreview(input, now)).toThrow('must use HTTPS');
  });

  test('unsupported authorization-stage signature component is blocked rather than guessed', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';
    const result = buildShopeeSgAuthorizationSigningPreview({
      ...input,
      structuredAuthorizationMapping: { ...structuredAuthorizationMapping, signatureBaseComponents: ['PARTNER_ID', 'ACCESS_TOKEN', 'TIMESTAMP'] }
    }, now);
    expect(result.signatureGenerated).toBe(false);
    expect(result.unresolvedComponents).toContain('ACCESS_TOKEN');
    expect(result.networkAction).toBe('NONE');
  });

  test('runtime mapping mismatch is rejected', () => {
    expect(() => buildShopeeSgAuthorizationSigningPreview({
      ...input,
      signingRuntimeVerification: { ...signingRuntimeVerification, structuredMappingId: 'other-mapping' }
    }, now)).toThrow('must match the current structured mapping');
  });

  test('base64 HMAC implementation is supported only when explicitly selected', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';
    const result = buildShopeeSgAuthorizationSigningPreview({
      ...input,
      signingRuntimeVerification: { ...signingRuntimeVerification, signatureImplementation: 'HMAC_SHA256_BASE64' }
    }, now);
    expect(result.signatureGenerated).toBe(true);
    expect(result.signatureLength).toBeGreaterThan(0);
    expect(result.signatureImplementation).toBe('HMAC_SHA256_BASE64');
  });
});
