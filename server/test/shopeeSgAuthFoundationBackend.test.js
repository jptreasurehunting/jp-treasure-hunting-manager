const {
  validateShopeeSgCredentialRef,
  resolveShopeeSgCredentialMetadata,
  validateSchemaVerification,
  getShopeeSgAuthReadiness
} = require('../integrations/shopeeSgAuthFoundationBackend');

describe('Shopee SG Backend Auth Readiness Safety', () => {
  const credentialRef = 'SHOPEE_SG_TEST';
  const now = Date.parse('2026-09-08T02:00:00.000Z');
  const schemaVerification = {
    verificationId: 'schema-sg-1',
    status: 'OFFICIAL_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory',
    checkedAt: '2026-09-08T01:00:00.000Z',
    externalWriteAllowed: false
  };

  beforeEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    process.env.SHOPEE_SG_NETWORK_ENABLED = 'false';
  });

  afterEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
    delete process.env.SHOPEE_SG_NETWORK_ENABLED;
  });

  test('credential reference is restricted to Shopee Singapore backend prefix', () => {
    expect(validateShopeeSgCredentialRef('SHOPEE_SG_MAIN')).toBe('SHOPEE_SG_MAIN');
    expect(() => validateShopeeSgCredentialRef('SHOPEE_MAIN')).toThrow('SHOPEE_SG_MAIN');
    expect(() => validateShopeeSgCredentialRef('secret-key')).toThrow('SHOPEE_SG_MAIN');
  });

  test('credential metadata exposes configuration booleans only, never secret values', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'super-secret-partner-key';
    const metadata = resolveShopeeSgCredentialMetadata(credentialRef);

    expect(metadata.partnerIdConfigured).toBe(true);
    expect(metadata.partnerKeyConfigured).toBe(true);
    expect(metadata.credentialConfigured).toBe(true);
    expect(JSON.stringify(metadata)).not.toContain('123456');
    expect(JSON.stringify(metadata)).not.toContain('super-secret-partner-key');
  });

  test('incomplete credentials remain visible only as safe readiness state', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    const result = getShopeeSgAuthReadiness({
      accountId: 'shopee_sg_main',
      shopId: '987654321',
      credentialRef,
      schemaVerification
    }, now);

    expect(result.credentialState.partnerIdConfigured).toBe(true);
    expect(result.credentialState.partnerKeyConfigured).toBe(false);
    expect(result.canStartAuthorization).toBe(false);
    expect(result.canExecuteApi).toBe(false);
    expect(result.canWriteInventory).toBe(false);
    expect(result.networkAction).toBe('NONE');
    expect(result.secretValuesReturned).toBe(false);
  });

  test('complete backend credentials still do not enable auth or API execution', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'super-secret-partner-key';
    process.env.SHOPEE_SG_NETWORK_ENABLED = 'true';

    const result = getShopeeSgAuthReadiness({
      accountId: 'shopee_sg_main',
      shopId: '987654321',
      credentialRef,
      schemaVerification
    }, now);

    expect(result.credentialState.credentialConfigured).toBe(true);
    expect(result.authSchemaStatus).toBe('OFFICIAL_AUTH_SCHEMA_REVIEW_REQUIRED');
    expect(result.canStartAuthorization).toBe(false);
    expect(result.canExecuteApi).toBe(false);
    expect(result.canWriteInventory).toBe(false);
    expect(result.externalWritePerformed).toBe(false);
    expect(JSON.stringify(result)).not.toContain('super-secret-partner-key');
    expect(result.blockingReasons.some((reason) => reason.includes('network execution remains disabled'))).toBe(true);
  });

  test('missing account and invalid shop id are rejected before any execution state is returned', () => {
    expect(() => getShopeeSgAuthReadiness({
      accountId: '', shopId: '987654321', credentialRef, schemaVerification
    }, now)).toMatchObject;
    expect(() => getShopeeSgAuthReadiness({
      accountId: '', shopId: '987654321', credentialRef, schemaVerification
    }, now)).toThrow('seller account ID');
    expect(() => getShopeeSgAuthReadiness({
      accountId: 'shopee_sg_main', shopId: 'abc', credentialRef, schemaVerification
    }, now)).toThrow('positive integer');
  });

  test('invalid, stale, future, or write-granting schema evidence is rejected', () => {
    expect(() => validateSchemaVerification({ ...schemaVerification, status: 'REVIEW_REQUIRED' }, now))
      .toThrow('OFFICIAL_SCHEMA_VERIFIED');
    expect(() => validateSchemaVerification({ ...schemaVerification, officialSourceUrl: 'https://example.com/docs' }, now))
      .toThrow('official Shopee HTTPS source');
    expect(() => validateSchemaVerification({ ...schemaVerification, checkedAt: '2026-05-01T00:00:00.000Z' }, now))
      .toThrow('older than 90 days');
    expect(() => validateSchemaVerification({ ...schemaVerification, checkedAt: '2026-09-09T00:00:00.000Z' }, now))
      .toThrow('future-dated');
    expect(() => validateSchemaVerification({ ...schemaVerification, externalWriteAllowed: true }, now))
      .toThrow('must not itself grant external write permission');
  });

  test('readiness result contains no network transport or token-exchange capability', () => {
    const result = getShopeeSgAuthReadiness({
      accountId: 'shopee_sg_main',
      shopId: '987654321',
      credentialRef,
      schemaVerification
    }, now);

    expect(result.networkAction).toBe('NONE');
    expect(result.externalWritePerformed).toBe(false);
    expect(result.secretValuesReturned).toBe(false);
    expect(result.blockingReasons.some((reason) => reason.includes('authorization start, callback/token exchange'))).toBe(true);
  });
});
