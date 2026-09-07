import {
  describeBackendError,
  fetchBackendHealth,
  fetchEbaySandboxConnectionStatus,
  fetchEbaySandboxMutationStageStatus,
  isValidEbaySandboxCredentialRef,
  stageEbaySandboxMutationAuthorization,
  startEbaySandboxOAuth,
  verifyEbaySandboxInventoryVersion
} from '../ebaySandboxBackendClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function runEbaySandboxBackendClientAsyncTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  const baseUrl = 'http://localhost:3001';
  assert(isValidEbaySandboxCredentialRef('EBAY_SANDBOX_MAIN'), 'Test 1: Backend credential reference format is accepted');
  assert(!isValidEbaySandboxCredentialRef('secret-store:ebay-main'), 'Test 2: Free-form secret reference is rejected before backend call');

  let startRequest: { url?: string; init?: RequestInit } = {};
  const start = await startEbaySandboxOAuth(' ebay-main ', ' EBAY_SANDBOX_MAIN ', baseUrl, async (input, init) => {
    startRequest = { url: String(input), init };
    return jsonResponse({
      success: true,
      environment: 'Sandbox',
      accountId: 'ebay-main',
      credentialRef: 'EBAY_SANDBOX_MAIN',
      authorizationUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize?state=abc',
      expiresAt: '2026-09-08T00:10:00.000Z',
      scope: 'https://api.ebay.com/oauth/api_scope/sell.inventory',
      networkAction: 'NONE',
      secretValuesReturned: false
    });
  });
  assert(start.authorizationUrl.includes('auth.sandbox.ebay.com'), 'Test 3: OAuth start returns backend-issued authorization URL');
  const body = JSON.parse(String(startRequest.init?.body || '{}'));
  assert(body.accountId === 'ebay-main' && body.credentialRef === 'EBAY_SANDBOX_MAIN' && !('clientSecret' in body), 'Test 4: OAuth start sends no secret');

  let invalidFetchCalled = false;
  try {
    await startEbaySandboxOAuth('ebay-main', 'bad-ref', baseUrl, async () => {
      invalidFetchCalled = true;
      return jsonResponse({});
    });
    assert(false, 'Test 5: Invalid credential reference should fail');
  } catch (error) {
    assert(!invalidFetchCalled && describeBackendError(error).includes('INVALID_CREDENTIAL_REF'), 'Test 5: Invalid credential reference fails before network call');
  }

  const status = await fetchEbaySandboxConnectionStatus('ebay-main', baseUrl, async () => jsonResponse({
    success: true,
    accounts: [
      { accountId: 'ebay-main', environment: 'Production', connectionStatus: 'connected', lastAuthDate: null },
      { accountId: 'ebay-main', environment: 'Sandbox', connectionStatus: 'connected', lastAuthDate: '2026-09-08T00:00:00.000Z' }
    ]
  }));
  assert(status.connected && status.account?.environment === 'Sandbox', 'Test 6: Matching Sandbox account is recognized');

  const productionOnly = await fetchEbaySandboxConnectionStatus('ebay-main', baseUrl, async () => jsonResponse({
    success: true,
    accounts: [{ accountId: 'ebay-main', environment: 'Production', connectionStatus: 'connected', lastAuthDate: null }]
  }));
  assert(!productionOnly.connected, 'Test 7: Production is not treated as Sandbox');

  let versionUrl = '';
  const version = await verifyEbaySandboxInventoryVersion('ebay-main', baseUrl, async (input) => {
    versionUrl = String(input);
    return jsonResponse({
      success: true,
      environment: 'Sandbox',
      accountId: 'ebay-main',
      endpoint: '/sell/inventory/v1/getVersion',
      version: '1.18.5',
      checkedAt: '2026-09-08T00:00:00.000Z',
      mutatingOperation: false,
      tokenReturnedToBrowser: false
    });
  });
  assert(version.mutatingOperation === false && version.tokenReturnedToBrowser === false && versionUrl.includes('accountId=ebay-main'), 'Test 8: Version check is non-mutating and account-scoped');

  const health = await fetchBackendHealth(baseUrl, async (input) => {
    assert(String(input) === `${baseUrl}/health`, 'Test 9: Health endpoint is correct');
    return jsonResponse({ status: 'UP', database: 'READY', timestamp: '2026-09-08T00:00:00.000Z' });
  });
  assert(health.status === 'UP' && health.database === 'READY', 'Test 10: Backend health is readable');

  try {
    await verifyEbaySandboxInventoryVersion('ebay-main', baseUrl, async () => jsonResponse({
      success: false,
      errorCode: 'SANDBOX_NETWORK_DISABLED',
      error: 'Sandbox network execution is disabled.'
    }, 503));
    assert(false, 'Test 11: Disabled Sandbox network should fail closed');
  } catch (error) {
    assert(describeBackendError(error).includes('SANDBOX_NETWORK_DISABLED'), 'Test 11: Disabled-network error is preserved');
  }

  const authorization: any = {
    authorizationId: 'auth-stage-client-1',
    environment: 'SANDBOX',
    sellerAccountId: 'ebay-main',
    sku: 'SKU-001',
    previewId: 'preview-001',
    requestFingerprint: 'request-fingerprint-001',
    planId: 'plan-001',
    credentialRef: 'EBAY_SANDBOX_MAIN',
    verificationId: 'verification-001',
    backendBaseUrl: baseUrl,
    operationId: 'createOrReplaceInventoryItem',
    operationOrder: 1,
    method: 'PUT',
    pathTemplate: '/sell/inventory/v1/inventory_item/{sku}',
    stepFingerprint: 'step-fingerprint-001',
    approvedBy: 'owner',
    approvalReason: 'Sandbox staging test',
    confirmedSandboxOnly: true,
    confirmedSellerAccountAndSku: true,
    confirmedPayloadPreview: true,
    confirmedMutationRisk: true,
    approvedAt: '2026-09-08T00:00:00.000Z',
    expiresAt: '2026-09-08T00:15:00.000Z',
    oneTimeUse: true,
    executionTriggered: false,
    networkAction: 'NONE',
    status: 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED'
  };
  const step: any = {
    order: 1,
    operationId: 'createOrReplaceInventoryItem',
    method: 'PUT',
    pathTemplate: '/sell/inventory/v1/inventory_item/{sku}',
    pathParameters: { sku: 'SKU-001' },
    requestBody: { availability: { shipToLocationAvailability: { quantity: 1 } } }
  };

  let stageRequest: { url?: string; init?: RequestInit } = {};
  const staged = await stageEbaySandboxMutationAuthorization(authorization, step, baseUrl, async (input, init) => {
    stageRequest = { url: String(input), init };
    return jsonResponse({
      success: true,
      environment: 'Sandbox',
      authorizationId: authorization.authorizationId,
      sellerAccountId: 'ebay-main',
      sku: 'SKU-001',
      operationId: 'createOrReplaceInventoryItem',
      stagedAt: '2026-09-08T00:05:00.000Z',
      expiresAt: authorization.expiresAt,
      status: 'STAGED_NOT_SENT',
      networkAction: 'NONE',
      externalWritePerformed: false,
      tokenReturnedToBrowser: false,
      message: 'No eBay API request was sent.'
    });
  });
  const stageBody = JSON.parse(String(stageRequest.init?.body || '{}'));
  assert(stageRequest.url === `${baseUrl}/api/ebay/sandbox/mutation/stage` && stageRequest.init?.method === 'POST', 'Test 12: Sandbox mutation staging uses dedicated backend endpoint');
  assert(stageBody.authorization.authorizationId === authorization.authorizationId && stageBody.step.operationId === 'createOrReplaceInventoryItem', 'Test 13: Staging sends approved authorization and exact step');
  assert(staged.status === 'STAGED_NOT_SENT' && staged.externalWritePerformed === false && staged.tokenReturnedToBrowser === false, 'Test 14: Staging response confirms no external write or token exposure');

  let stageStatusUrl = '';
  const stagedStatus = await fetchEbaySandboxMutationStageStatus(authorization.authorizationId, baseUrl, async (input) => {
    stageStatusUrl = String(input);
    return jsonResponse({
      success: true,
      environment: 'Sandbox',
      authorizationId: authorization.authorizationId,
      sellerAccountId: 'ebay-main',
      sku: 'SKU-001',
      previewId: 'preview-001',
      operationId: 'createOrReplaceInventoryItem',
      method: 'PUT',
      pathTemplate: '/sell/inventory/v1/inventory_item/{sku}',
      stagedAt: '2026-09-08T00:05:00.000Z',
      expiresAt: authorization.expiresAt,
      status: 'STAGED_NOT_SENT',
      networkAction: 'NONE',
      externalWritePerformed: false,
      tokenReturnedToBrowser: false
    });
  });
  assert(stageStatusUrl.endsWith(`/api/ebay/sandbox/mutation/stage/${authorization.authorizationId}`), 'Test 15: Staging status endpoint is authorization-scoped');
  assert(stagedStatus.status === 'STAGED_NOT_SENT' && stagedStatus.networkAction === 'NONE', 'Test 16: Backend staging status remains explicitly unsent');

  return { passed, failed, log };
}
