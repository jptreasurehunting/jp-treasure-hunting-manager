const {
  buildShopeeSgAuthTransportPlan,
  buildShopeeSgAuthorizationRequestPreview
} = require('../integrations/shopeeSgAuthTransportBackend');

describe('Shopee SG Auth Transport Contract Safety', () => {
  const credentialRef = 'SHOPEE_SG_TRANSPORT_TEST';
  const now = Date.parse('2026-09-08T03:00:00.000Z');
  const schemaVerification = {
    verificationId: 'schema-sg-transport-1',
    status: 'OFFICIAL_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory',
    checkedAt: '2026-09-08T02:00:00.000Z',
    externalWriteAllowed: false
  };
  const authSchemaVerification = {
    verificationId: 'auth-schema-sg-transport-1',
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/example/verified-auth-endpoint',
    checkedAt: '2026-09-08T02:10:00.000Z',
    currentSingaporeApplicabilityConfirmed: true,
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false
  };

  beforeEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
  });

  afterEach(() => {
    delete process.env[`${credentialRef}_PARTNER_ID`];
    delete process.env[`${credentialRef}_PARTNER_KEY`];
  });

  test('fresh verified schemas can produce only a contract-only transport plan', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';

    const result = buildShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);

    expect(result.transportImplementationStatus).toBe('CONTRACT_ONLY');
    expect(result.inventorySchemaVerificationId).toBe('schema-sg-transport-1');
    expect(result.authSchemaVerificationId).toBe('auth-schema-sg-transport-1');
    expect(result.stages).toHaveLength(6);
    expect(result.stages.every((stage) => stage.status === 'NOT_IMPLEMENTED')).toBe(true);
    expect(result.stages.every((stage) => stage.networkAllowed === false)).toBe(true);
  });

  test('all executable capabilities remain false even when backend credentials exist', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';

    const result = buildShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);

    expect(result.canGenerateAuthorizationRequest).toBe(false);
    expect(result.canReceiveAuthorizationCallback).toBe(false);
    expect(result.canExchangeToken).toBe(false);
    expect(result.canRefreshToken).toBe(false);
    expect(result.canSignApiRequest).toBe(false);
    expect(result.canExecuteApi).toBe(false);
    expect(result.canWriteInventory).toBe(false);
    expect(result.networkAction).toBe('NONE');
    expect(result.externalWritePerformed).toBe(false);
    expect(result.requiresSeparateExecutionApproval).toBe(true);
  });

  test('plan exposes only credential configuration booleans and never secret values', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';

    const result = buildShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);
    const serialized = JSON.stringify(result);

    expect(result.credentialState.credentialConfigured).toBe(true);
    expect(result.secretValuesReturned).toBe(false);
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('backend-only-secret');
  });

  test('missing auth schema verification is blocked rather than guessed', () => {
    expect(() => buildShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification
    }, now)).toThrow('fresh current-Singapore Shopee auth schema verification');
  });

  test('tampered auth schema cannot reach transport planning', () => {
    expect(() => buildShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification: { ...authSchemaVerification, externalNetworkAllowed: true }
    }, now)).toThrow('must not itself grant external network or write permission');
  });

  test('incomplete credentials do not cause secret prompting or hidden execution', () => {
    const result = buildShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);

    expect(result.credentialState.credentialConfigured).toBe(false);
    expect(result.blockingReasons.some((reason) => reason.includes('Partner ID / Partner Key configuration is incomplete'))).toBe(true);
    expect(result.networkAction).toBe('NONE');
  });

  test('authorization request preview exposes endpoint but never generates executable URL or signature', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';

    const result = buildShopeeSgAuthorizationRequestPreview({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);

    expect(result.mode).toBe('AUTHORIZATION_REQUEST_PREVIEW_ONLY');
    expect(result.previewStatus).toBe('STRUCTURED_MAPPING_REQUIRED');
    expect(result.authorizationEndpoint).toBe(authSchemaVerification.authorizationEndpoint);
    expect(result.requestMethod).toBe('UNVERIFIED');
    expect(result.executableAuthorizationUrl).toBeNull();
    expect(result.signatureValue).toBeNull();
    expect(result.canGenerateAuthorizationRequest).toBe(false);
    expect(result.canStartAuthorization).toBe(false);
    expect(result.sendAllowed).toBe(false);
    expect(result.networkAction).toBe('NONE');
  });

  test('authorization preview never returns Partner ID, Partner Key, or secret values', () => {
    process.env[`${credentialRef}_PARTNER_ID`] = '123456';
    process.env[`${credentialRef}_PARTNER_KEY`] = 'backend-only-secret';

    const result = buildShopeeSgAuthorizationRequestPreview({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);
    const serialized = JSON.stringify(result);

    expect(result.partnerIdValueReturned).toBe(false);
    expect(result.partnerKeyValueReturned).toBe(false);
    expect(result.secretValuesReturned).toBe(false);
    expect(serialized).not.toContain('123456');
    expect(serialized).not.toContain('backend-only-secret');
  });

  test('authorization preview keeps machine-structured query/sign/callback requirements blocked', () => {
    const result = buildShopeeSgAuthorizationRequestPreview({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification
    }, now);

    const structuredRequirements = result.requirements.filter((requirement) =>
      requirement.requirement.startsWith('STRUCTURED_') || requirement.requirement === 'CALLBACK_BINDING_CONTRACT'
    );
    expect(structuredRequirements).toHaveLength(3);
    expect(structuredRequirements.every((requirement) => requirement.status === 'REVIEW_REQUIRED')).toBe(true);
    expect(result.externalWritePerformed).toBe(false);
  });

  test('authorization preview rejects missing or non-Shopee authorization endpoint instead of guessing one', () => {
    expect(() => buildShopeeSgAuthorizationRequestPreview({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification: { ...authSchemaVerification, authorizationEndpoint: '' }
    }, now)).toThrow('verified Shopee HTTPS authorization endpoint');

    expect(() => buildShopeeSgAuthorizationRequestPreview({
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef,
      schemaVerification,
      authSchemaVerification: { ...authSchemaVerification, authorizationEndpoint: 'https://example.com/auth' }
    }, now)).toThrow('verified Shopee HTTPS authorization endpoint');
  });
});
