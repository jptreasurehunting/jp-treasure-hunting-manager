const crypto = require('crypto');
const { setDB } = require('../db/database');
const SqliteProvider = require('../db/sqliteProvider');
const TokenVault = require('../security/tokenVault');
const {
  fingerprintStep,
  stageSandboxMutationExecution,
  getSandboxMutationStageStatus
} = require('../integrations/ebaySandboxMutationExecutionBackend');

describe('eBay Sandbox Mutation Staging Backend Safety', () => {
  let db;
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const accountId = 'ebay-sandbox-stage-account';

  beforeAll(async () => {
    db = new SqliteProvider(':memory:');
    await db.initialize();
    setDB(db);
    process.env.ENCRYPTION_KEY = encryptionKey;
  });

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = encryptionKey;
    await TokenVault.saveTokens(
      accountId,
      'Sandbox',
      'sandbox-refresh-token',
      'sandbox-access-token',
      new Date(Date.now() + 3600000).toISOString()
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  function buildStep(overrides = {}) {
    return {
      order: overrides.order ?? 1,
      operationId: overrides.operationId ?? 'createOrReplaceInventoryItem',
      method: overrides.method ?? 'PUT',
      pathTemplate: overrides.pathTemplate ?? '/sell/inventory/v1/inventory_item/{sku}',
      pathParameters: overrides.pathParameters ?? { sku: 'SKU-STAGE-001' },
      requestBody: overrides.requestBody ?? {
        availability: { shipToLocationAvailability: { quantity: 1 } },
        condition: 'NEW',
        product: {
          title: 'Sandbox Test Item',
          description: 'Sandbox only',
          aspects: { Brand: ['Test'] },
          imageUrls: ['https://example.com/item.jpg']
        }
      }
    };
  }

  function buildAuthorization(step, overrides = {}) {
    const now = overrides.now ?? Date.now();
    return {
      authorizationId: overrides.authorizationId ?? `auth-${now}-${Math.random()}`,
      environment: overrides.environment ?? 'SANDBOX',
      sellerAccountId: overrides.sellerAccountId ?? accountId,
      sku: overrides.sku ?? 'SKU-STAGE-001',
      previewId: overrides.previewId ?? 'preview-stage-001',
      requestFingerprint: overrides.requestFingerprint ?? 'request-fingerprint-001',
      planId: overrides.planId ?? 'plan-stage-001',
      credentialRef: overrides.credentialRef ?? 'EBAY_SANDBOX_MAIN',
      verificationId: overrides.verificationId ?? 'verification-stage-001',
      operationId: overrides.operationId ?? 'createOrReplaceInventoryItem',
      operationOrder: overrides.operationOrder ?? 1,
      method: overrides.method ?? 'PUT',
      pathTemplate: overrides.pathTemplate ?? '/sell/inventory/v1/inventory_item/{sku}',
      stepFingerprint: overrides.stepFingerprint ?? fingerprintStep(step),
      approvedBy: overrides.approvedBy ?? 'owner',
      approvalReason: overrides.approvalReason ?? 'Approved for one Sandbox staging test only.',
      confirmedSandboxOnly: overrides.confirmedSandboxOnly ?? true,
      confirmedSellerAccountAndSku: overrides.confirmedSellerAccountAndSku ?? true,
      confirmedPayloadPreview: overrides.confirmedPayloadPreview ?? true,
      confirmedMutationRisk: overrides.confirmedMutationRisk ?? true,
      approvedAt: overrides.approvedAt ?? new Date(now - 1000).toISOString(),
      expiresAt: overrides.expiresAt ?? new Date(now + 10 * 60 * 1000).toISOString(),
      oneTimeUse: overrides.oneTimeUse ?? true,
      executionTriggered: overrides.executionTriggered ?? false,
      networkAction: overrides.networkAction ?? 'NONE',
      status: overrides.status ?? 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED'
    };
  }

  test('valid step is staged once without any external write or token exposure', async () => {
    const step = buildStep();
    const authorization = buildAuthorization(step, { authorizationId: 'auth-valid-stage-1' });

    const result = await stageSandboxMutationExecution({ authorization, step });

    expect(result.success).toBe(true);
    expect(result.status).toBe('STAGED_NOT_SENT');
    expect(result.networkAction).toBe('NONE');
    expect(result.externalWritePerformed).toBe(false);
    expect(result.tokenReturnedToBrowser).toBe(false);
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');

    const stored = await getSandboxMutationStageStatus(authorization.authorizationId);
    expect(stored.authorizationId).toBe(authorization.authorizationId);
    expect(stored.sku).toBe('SKU-STAGE-001');
    expect(stored.operationId).toBe('createOrReplaceInventoryItem');
    expect(stored.externalWritePerformed).toBe(false);
  });

  test('same authorization cannot be consumed twice', async () => {
    const step = buildStep();
    const authorization = buildAuthorization(step, { authorizationId: 'auth-replay-stage-1' });

    await stageSandboxMutationExecution({ authorization, step });
    await expect(stageSandboxMutationExecution({ authorization, step }))
      .rejects.toMatchObject({ code: 'AUTHORIZATION_ALREADY_CONSUMED' });
  });

  test('expired authorization fails closed', async () => {
    const now = Date.now();
    const step = buildStep();
    const authorization = buildAuthorization(step, {
      authorizationId: 'auth-expired-stage-1',
      approvedAt: new Date(now - 20 * 60 * 1000).toISOString(),
      expiresAt: new Date(now - 5 * 60 * 1000).toISOString()
    });

    await expect(stageSandboxMutationExecution({ authorization, step, now }))
      .rejects.toMatchObject({ code: 'AUTHORIZATION_EXPIRED' });
  });

  test('createOffer remains blocked at backend staging layer', async () => {
    const step = buildStep({
      order: 2,
      operationId: 'createOffer',
      method: 'POST',
      pathTemplate: '/sell/inventory/v1/offer',
      pathParameters: {},
      requestBody: { sku: 'SKU-STAGE-001' }
    });
    const authorization = buildAuthorization(step, {
      authorizationId: 'auth-create-offer-stage-1',
      operationId: 'createOffer',
      operationOrder: 2,
      method: 'POST',
      pathTemplate: '/sell/inventory/v1/offer'
    });

    await expect(stageSandboxMutationExecution({ authorization, step }))
      .rejects.toMatchObject({ code: 'OPERATION_NOT_ALLOWED' });
  });

  test('changed payload after approval is rejected by step fingerprint', async () => {
    const approvedStep = buildStep();
    const changedStep = buildStep({ requestBody: { product: { title: 'Changed after approval' } } });
    const authorization = buildAuthorization(approvedStep, { authorizationId: 'auth-fingerprint-stage-1' });

    await expect(stageSandboxMutationExecution({ authorization, step: changedStep }))
      .rejects.toMatchObject({ code: 'STEP_FINGERPRINT_MISMATCH' });
  });

  test('SKU mismatch is rejected', async () => {
    const step = buildStep({ pathParameters: { sku: 'DIFFERENT-SKU' } });
    const authorization = buildAuthorization(step, {
      authorizationId: 'auth-sku-stage-1',
      sku: 'SKU-STAGE-001'
    });

    await expect(stageSandboxMutationExecution({ authorization, step }))
      .rejects.toMatchObject({ code: 'SKU_MISMATCH' });
  });

  test('missing connected Sandbox token blocks staging', async () => {
    const step = buildStep();
    const authorization = buildAuthorization(step, {
      authorizationId: 'auth-no-token-stage-1',
      sellerAccountId: 'unconnected-sandbox-account'
    });

    await expect(stageSandboxMutationExecution({ authorization, step }))
      .rejects.toMatchObject({ code: 'SANDBOX_TOKEN_NOT_FOUND' });
  });

  test('Production authorization is never accepted', async () => {
    const step = buildStep();
    const authorization = buildAuthorization(step, {
      authorizationId: 'auth-production-stage-1',
      environment: 'PRODUCTION'
    });

    await expect(stageSandboxMutationExecution({ authorization, step }))
      .rejects.toMatchObject({ code: 'PRODUCTION_NOT_ALLOWED' });
  });
});
