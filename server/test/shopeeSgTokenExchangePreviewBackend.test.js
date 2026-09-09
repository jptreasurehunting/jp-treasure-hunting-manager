const { buildShopeeSgTokenExchangeRequestPreview } = require('../integrations/shopeeSgTokenExchangePreviewBackend');

describe('Shopee SG Token Exchange Preview Safety', () => {
  const credentialRef = 'SHOPEE_SG_TOKEN_PREVIEW_TEST';
  const now = Date.parse('2026-09-09T04:00:00.000Z');
  const authSchemaVerification = {
    verificationId: 'auth-token-preview-1', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get',
    signatureAlgorithm: 'HMAC-SHA256', checkedAt: '2026-09-09T03:00:00.000Z',
    currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false
  };
  const tokenMapping = {
    tokenMappingId: 'token-map-preview-1', marketplaceRegion: 'SG', status: 'STRUCTURED_TOKEN_MAPPING_VERIFIED',
    authSchemaVerificationId: authSchemaVerification.verificationId,
    officialSourceUrl: authSchemaVerification.officialSourceUrl,
    tokenEndpoint: authSchemaVerification.tokenEndpoint,
    tokenHttpMethod: 'POST', tokenBodyEncoding: 'JSON',
    tokenQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign' },
    tokenQueryOrder: ['PARTNER_ID_QUERY', 'TIMESTAMP_QUERY', 'SIGNATURE_QUERY'],
    tokenBodyFieldNames: { authorizationCode: 'code', shopId: 'shop_id', partnerId: 'partner_id' },
    tokenBodyRoles: ['AUTHORIZATION_CODE_BODY', 'SHOP_ID_BODY', 'PARTNER_ID_BODY'],
    signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
    tokenResponseFieldNames: { accessToken: 'access_token', refreshToken: 'refresh_token', expiresIn: 'expire_in' },
    expiresInUnit: 'SECONDS', allRequiredRequestFieldsRepresented: true, allRequiredResponseFieldsRepresented: true,
    checkedAt: '2026-09-09T03:10:00.000Z', currentSingaporeApplicabilityConfirmed: true,
    tokenExchangeAllowed: false, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false
  };
  const tokenRuntimeVerification = {
    runtimeVerificationId: 'token-runtime-preview-1', marketplaceRegion: 'SG', status: 'TOKEN_EXCHANGE_RUNTIME_VERIFIED',
    authSchemaVerificationId: authSchemaVerification.verificationId, tokenMappingId: tokenMapping.tokenMappingId,
    officialSourceUrl: authSchemaVerification.officialSourceUrl, signatureAlgorithmLabel: 'HMAC-SHA256',
    signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR',
    checkedAt: '2026-09-09T03:20:00.000Z', currentSingaporeApplicabilityConfirmed: true,
    previewAllowed: true, tokenExchangeAllowed: false, externalNetworkAllowed: false, externalWriteAllowed: false, secretValuesStored: false
  };
  const input = { accountId: 'shopee_sg_main', shopId: '99887766', credentialRef, authSchemaVerification, tokenMapping, tokenRuntimeVerification };

  beforeEach(() => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-token-preview-secret';
    process.env[`${credentialRef}_REDIRECT_URI`] = 'https://example.jp/api/shopee/sg/auth/callback';
  });
  afterEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    delete process.env[`${credentialRef}_REDIRECT_URI`];
  });

  test('builds a fully redacted synthetic token request preview without network permission', () => {
    const result = buildShopeeSgTokenExchangeRequestPreview(input, now);
    expect(result.mode).toBe('TOKEN_EXCHANGE_REQUEST_PREVIEW_NO_NETWORK');
    expect(result.signatureGenerated).toBe(true);
    expect(result.authorizationCodeSource).toBe('SYNTHETIC_PREVIEW_ONLY');
    expect(result.canExchangeToken).toBe(false);
    expect(result.canStoreTokens).toBe(false);
    expect(result.sendAllowed).toBe(false);
    expect(result.networkAction).toBe('NONE');
    expect(result.externalWritePerformed).toBe(false);
  });

  test('response exposes neither code, signature, Partner credentials nor token values', () => {
    const result = buildShopeeSgTokenExchangeRequestPreview(input, now + 1000);
    expect(result.authorizationCodeStored).toBe(false);
    expect(result.authorizationCodeReturned).toBe(false);
    expect(result.signatureValueReturned).toBe(false);
    expect(result.signatureBaseReturned).toBe(false);
    expect(result.partnerIdValueReturned).toBe(false);
    expect(result.partnerKeyValueReturned).toBe(false);
    expect(result.tokenValuesReturned).toBe(false);
    expect(result.executableRequestReturned).toBe(false);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('backend-only-token-preview-secret');
    expect(serialized).not.toContain('123456');
  });

  test('uses only mapped field names and returns a request fingerprint', () => {
    const result = buildShopeeSgTokenExchangeRequestPreview(input, now + 2000);
    expect(result.queryFields.map((x) => x.fieldName)).toEqual(['partner_id', 'timestamp', 'sign']);
    expect(result.bodyFields.map((x) => x.fieldName)).toEqual(['code', 'shop_id', 'partner_id']);
    expect(result.responseFields.accessToken).toBe('access_token');
    expect(result.requestFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test('mapping that claims live token exchange permission is blocked', () => {
    expect(() => buildShopeeSgTokenExchangeRequestPreview({ ...input, tokenMapping: { ...tokenMapping, tokenExchangeAllowed: true } }, now)).toThrow('must grant no live exchange');
  });

  test('runtime that claims live network permission is blocked', () => {
    expect(() => buildShopeeSgTokenExchangeRequestPreview({ ...input, tokenRuntimeVerification: { ...tokenRuntimeVerification, externalNetworkAllowed: true } }, now)).toThrow('may allow preview only');
  });

  test('unsupported signature component fails closed rather than guessing', () => {
    expect(() => buildShopeeSgTokenExchangeRequestPreview({ ...input, tokenMapping: { ...tokenMapping, signatureBaseComponents: ['PARTNER_ID', 'ACCESS_TOKEN'] } }, now)).toThrow('unresolved components');
  });

  test('missing backend Partner Key blocks preview', () => {
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    expect(() => buildShopeeSgTokenExchangeRequestPreview(input, now)).toThrow('Partner ID / Partner Key configuration is incomplete');
  });

  test('stale token mapping is blocked', () => {
    expect(() => buildShopeeSgTokenExchangeRequestPreview({ ...input, tokenMapping: { ...tokenMapping, checkedAt: '2026-01-01T00:00:00Z' } }, now)).toThrow('older than 90 days');
  });
});
