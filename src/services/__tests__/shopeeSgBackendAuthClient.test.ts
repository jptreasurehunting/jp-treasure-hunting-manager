import {
  fetchShopeeSgAuthReadiness,
  fetchShopeeSgAuthTransportPlan,
  fetchShopeeSgAuthorizationRequestPreview,
  isValidShopeeSgCredentialRef
} from '../shopeeSgBackendAuthClient';
import { describeBackendError } from '../ebaySandboxBackendClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function runShopeeSgBackendAuthClientTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  assert(isValidShopeeSgCredentialRef('SHOPEE_SG_MAIN'), 'Test 1: Shopee SG credential reference format is accepted');
  assert(!isValidShopeeSgCredentialRef('SHOPEE_MAIN'), 'Test 2: Non-SG credential prefix is rejected');

  const schemaVerification: any = {
    verificationId: 'schema-sg-1',
    marketplaceRegion: 'SG',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory',
    endpointName: 'verified-inventory-endpoint',
    requestFields: 'verified field names only',
    authenticationFields: 'verified auth field names only',
    stockFieldSemantics: 'verified stock semantics',
    checkedBy: 'owner',
    checkedAt: '2026-09-08T01:00:00.000Z',
    verificationNote: 'Official documentation was reviewed.',
    officialDocumentationConfirmed: true,
    status: 'OFFICIAL_SCHEMA_VERIFIED',
    externalWriteAllowed: false,
    createdAt: '2026-09-08T01:00:00.000Z',
    updatedAt: '2026-09-08T01:00:00.000Z'
  };
  const authSchemaVerification: any = {
    verificationId: 'auth-schema-sg-1',
    marketplaceRegion: 'SG',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner',
    tokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/token/get',
    refreshTokenEndpoint: 'https://partner.shopeemobile.com/api/v2/auth/access_token/get',
    signatureAlgorithm: 'verified algorithm',
    authorizationSignBaseRule: 'verified names only',
    authenticatedApiSignBaseRule: 'verified names only',
    callbackFields: 'verified names only',
    tokenRequestFields: 'verified names only',
    authenticatedRequestFields: 'verified names only',
    timestampValidityRule: 'verified rule',
    checkedBy: 'owner',
    checkedAt: '2026-09-08T01:10:00.000Z',
    verificationNote: 'Current Singapore official documentation reviewed.',
    officialDocumentationConfirmed: true,
    currentSingaporeApplicabilityConfirmed: true,
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: '2026-09-08T01:10:00.000Z',
    updatedAt: '2026-09-08T01:10:00.000Z'
  };

  let fetchCalled = false;
  try {
    await fetchShopeeSgAuthReadiness({
      accountId: 'shopee_sg_main',
      credentialRef: 'bad-ref',
      shopId: '123456789',
      schemaVerification
    }, 'http://localhost:3001', async () => {
      fetchCalled = true;
      return jsonResponse({});
    });
    assert(false, 'Test 3: Invalid credential reference should fail');
  } catch (error) {
    assert(!fetchCalled && describeBackendError(error).includes('INVALID_SHOPEE_CREDENTIAL_REF'), 'Test 3: Invalid credential reference fails before backend call');
  }

  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const result = await fetchShopeeSgAuthReadiness({
    accountId: ' shopee_sg_main ',
    credentialRef: ' SHOPEE_SG_MAIN ',
    shopId: ' 123456789 ',
    schemaVerification,
    authSchemaVerification
  }, 'http://localhost:3001/', async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return jsonResponse({
      success: true,
      marketplace: 'Shopee',
      marketplaceRegion: 'SG',
      accountId: 'shopee_sg_main',
      shopId: '123456789',
      credentialRef: 'SHOPEE_SG_MAIN',
      credentialState: {
        partnerIdConfigured: true,
        partnerKeyConfigured: true,
        credentialConfigured: true
      },
      inventorySchemaVerificationId: 'schema-sg-1',
      inventorySchemaStatus: 'OFFICIAL_SCHEMA_VERIFIED',
      inventorySchemaCheckedAt: '2026-09-08T01:00:00.000Z',
      authSchemaVerificationId: 'auth-schema-sg-1',
      authSchemaStatus: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
      authSchemaCheckedAt: '2026-09-08T01:10:00.000Z',
      networkFlagConfigured: false,
      canStartAuthorization: false,
      canExecuteApi: false,
      canWriteInventory: false,
      networkAction: 'NONE',
      externalWritePerformed: false,
      secretValuesReturned: false,
      blockingReasons: ['Shopee auth transport is not implemented.']
    });
  });

  assert(requestUrl === 'http://localhost:3001/api/shopee/sg/auth/readiness' && requestInit?.method === 'POST', 'Test 4: Readiness uses dedicated non-Shopee backend endpoint');

  const sent = JSON.parse(String(requestInit?.body || '{}'));
  assert(
    sent.accountId === 'shopee_sg_main' &&
    sent.credentialRef === 'SHOPEE_SG_MAIN' &&
    sent.shopId === '123456789' &&
    sent.schemaVerification.verificationId === 'schema-sg-1' &&
    sent.authSchemaVerification.verificationId === 'auth-schema-sg-1',
    'Test 5: Readiness sends normalized safe identity plus both schema verification IDs'
  );
  assert(
    Object.keys(sent.authSchemaVerification).sort().join(',') === [
      'authorizationEndpoint',
      'checkedAt',
      'currentSingaporeApplicabilityConfirmed',
      'externalNetworkAllowed',
      'externalWriteAllowed',
      'officialSourceUrl',
      'secretsStored',
      'status',
      'verificationId'
    ].sort().join(','),
    'Test 6: Browser sends only the minimal safe auth-schema snapshot plus verified endpoint'
  );
  const sentText = JSON.stringify(sent).toLowerCase();
  assert(
    !sentText.includes('partnerkey') &&
    !sentText.includes('partner_key') &&
    !sentText.includes('access_token') &&
    !sentText.includes('refreshtoken') &&
    !sentText.includes('refresh_token'),
    'Test 7: Browser request contains no Partner Key or token values'
  );

  assert(
    result.authSchemaStatus === 'OFFICIAL_AUTH_SCHEMA_VERIFIED' &&
    result.canStartAuthorization === false &&
    result.canExecuteApi === false &&
    result.canWriteInventory === false &&
    result.networkAction === 'NONE' &&
    result.externalWritePerformed === false &&
    result.secretValuesReturned === false,
    'Test 8: Verified auth schema still cannot authorize or execute Shopee API writes'
  );

  let optionalBody: any = null;
  await fetchShopeeSgAuthReadiness({
    accountId: 'shopee_sg_main',
    credentialRef: 'SHOPEE_SG_MAIN',
    shopId: '123456789',
    schemaVerification
  }, 'http://localhost:3001', async (_input, init) => {
    optionalBody = JSON.parse(String(init?.body || '{}'));
    return jsonResponse({
      success: true,
      marketplace: 'Shopee', marketplaceRegion: 'SG', accountId: 'shopee_sg_main', shopId: '123456789', credentialRef: 'SHOPEE_SG_MAIN',
      credentialState: { partnerIdConfigured: false, partnerKeyConfigured: false, credentialConfigured: false },
      inventorySchemaVerificationId: 'schema-sg-1', inventorySchemaStatus: 'OFFICIAL_SCHEMA_VERIFIED', inventorySchemaCheckedAt: '2026-09-08T01:00:00.000Z',
      authSchemaVerificationId: null, authSchemaStatus: 'OFFICIAL_AUTH_SCHEMA_REVIEW_REQUIRED', authSchemaCheckedAt: null,
      networkFlagConfigured: false, canStartAuthorization: false, canExecuteApi: false, canWriteInventory: false,
      networkAction: 'NONE', externalWritePerformed: false, secretValuesReturned: false, blockingReasons: ['Auth schema review required.']
    });
  });
  assert(optionalBody.authSchemaVerification === undefined, 'Test 9: Missing auth verification is not fabricated by the browser');

  try {
    await fetchShopeeSgAuthReadiness({
      accountId: 'shopee_sg_main',
      credentialRef: 'SHOPEE_SG_MAIN',
      shopId: '123456789',
      schemaVerification,
      authSchemaVerification
    }, 'http://localhost:3001', async () => jsonResponse({
      success: false,
      errorCode: 'STALE_SHOPEE_AUTH_SCHEMA_VERIFICATION',
      error: 'Auth schema verification is stale.',
      networkAction: 'NONE',
      externalWritePerformed: false,
      secretValuesReturned: false
    }, 409));
    assert(false, 'Test 10: Backend stale-auth-schema response should fail');
  } catch (error) {
    assert(describeBackendError(error).includes('STALE_SHOPEE_AUTH_SCHEMA_VERIFICATION'), 'Test 10: Safe stale-auth-schema backend error code is preserved');
  }

  let transportUrl = '';
  let transportInit: RequestInit | undefined;
  const transport = await fetchShopeeSgAuthTransportPlan({
    accountId: ' shopee_sg_main ',
    credentialRef: ' SHOPEE_SG_MAIN ',
    shopId: ' 123456789 ',
    schemaVerification,
    authSchemaVerification
  }, 'http://localhost:3001/', async (input, init) => {
    transportUrl = String(input);
    transportInit = init;
    return jsonResponse({
      success: true,
      marketplace: 'Shopee', marketplaceRegion: 'SG', accountId: 'shopee_sg_main', shopId: '123456789', credentialRef: 'SHOPEE_SG_MAIN',
      inventorySchemaVerificationId: 'schema-sg-1', authSchemaVerificationId: 'auth-schema-sg-1',
      transportImplementationStatus: 'CONTRACT_ONLY',
      credentialState: { partnerIdConfigured: true, partnerKeyConfigured: true, credentialConfigured: true },
      stages: [
        { stage: 'AUTHORIZATION_REQUEST_BUILD', status: 'NOT_IMPLEMENTED', networkAllowed: false, secretsRequiredInBrowser: false, description: 'contract only' },
        { stage: 'AUTHORIZATION_CALLBACK_VALIDATE', status: 'NOT_IMPLEMENTED', networkAllowed: false, secretsRequiredInBrowser: false, description: 'contract only' },
        { stage: 'TOKEN_EXCHANGE', status: 'NOT_IMPLEMENTED', networkAllowed: false, secretsRequiredInBrowser: false, description: 'contract only' },
        { stage: 'TOKEN_REFRESH', status: 'NOT_IMPLEMENTED', networkAllowed: false, secretsRequiredInBrowser: false, description: 'contract only' },
        { stage: 'AUTHENTICATED_REQUEST_SIGNING', status: 'NOT_IMPLEMENTED', networkAllowed: false, secretsRequiredInBrowser: false, description: 'contract only' },
        { stage: 'API_EXECUTION', status: 'NOT_IMPLEMENTED', networkAllowed: false, secretsRequiredInBrowser: false, description: 'contract only' }
      ],
      canGenerateAuthorizationRequest: false, canReceiveAuthorizationCallback: false, canExchangeToken: false,
      canRefreshToken: false, canSignApiRequest: false, canExecuteApi: false, canWriteInventory: false,
      networkAction: 'NONE', externalWritePerformed: false, secretValuesReturned: false,
      requiresSeparateExecutionApproval: true, blockingReasons: ['Transport is contract-only.']
    });
  });
  assert(transportUrl === 'http://localhost:3001/api/shopee/sg/auth/transport/plan' && transportInit?.method === 'POST', 'Test 11: Transport plan uses dedicated backend-only contract endpoint');

  const transportSent = JSON.parse(String(transportInit?.body || '{}'));
  const transportSentText = JSON.stringify(transportSent).toLowerCase();
  assert(
    transportSent.authSchemaVerification.verificationId === 'auth-schema-sg-1' &&
    !transportSentText.includes('partner_key') &&
    !transportSentText.includes('access_token') &&
    !transportSentText.includes('refresh_token'),
    'Test 12: Transport planning sends schema evidence but no secrets or tokens'
  );
  assert(
    transport.transportImplementationStatus === 'CONTRACT_ONLY' &&
    transport.stages.length === 6 &&
    transport.stages.every((stage) => stage.status === 'NOT_IMPLEMENTED' && stage.networkAllowed === false) &&
    transport.canExecuteApi === false &&
    transport.canWriteInventory === false &&
    transport.networkAction === 'NONE',
    'Test 13: Transport plan remains completely non-executable'
  );

  let missingAuthFetchCalled = false;
  try {
    await fetchShopeeSgAuthTransportPlan({
      accountId: 'shopee_sg_main', credentialRef: 'SHOPEE_SG_MAIN', shopId: '123456789', schemaVerification
    }, 'http://localhost:3001', async () => {
      missingAuthFetchCalled = true;
      return jsonResponse({});
    });
    assert(false, 'Test 14: Missing auth schema should fail before transport backend call');
  } catch (error) {
    assert(!missingAuthFetchCalled && describeBackendError(error).includes('MISSING_SHOPEE_AUTH_SCHEMA_VERIFICATION'), 'Test 14: Missing auth schema is blocked before transport backend call');
  }

  let previewUrl = '';
  let previewInit: RequestInit | undefined;
  const preview = await fetchShopeeSgAuthorizationRequestPreview({
    accountId: ' shopee_sg_main ',
    credentialRef: ' SHOPEE_SG_MAIN ',
    shopId: ' 123456789 ',
    schemaVerification,
    authSchemaVerification
  }, 'http://localhost:3001/', async (input, init) => {
    previewUrl = String(input);
    previewInit = init;
    return jsonResponse({
      success: true,
      marketplace: 'Shopee',
      marketplaceRegion: 'SG',
      mode: 'AUTHORIZATION_REQUEST_PREVIEW_ONLY',
      stage: 'AUTHORIZATION_REQUEST_BUILD',
      previewStatus: 'STRUCTURED_MAPPING_REQUIRED',
      accountId: 'shopee_sg_main',
      shopId: '123456789',
      credentialRef: 'SHOPEE_SG_MAIN',
      inventorySchemaVerificationId: 'schema-sg-1',
      authSchemaVerificationId: 'auth-schema-sg-1',
      authorizationEndpoint: authSchemaVerification.authorizationEndpoint,
      requestMethod: 'UNVERIFIED',
      executableAuthorizationUrl: null,
      signatureValue: null,
      partnerIdValueReturned: false,
      partnerKeyValueReturned: false,
      secretValuesReturned: false,
      credentialState: { partnerIdConfigured: true, partnerKeyConfigured: true, credentialConfigured: true },
      requirements: [
        { requirement: 'CURRENT_SG_AUTH_SCHEMA', status: 'VERIFIED', detail: 'verified' },
        { requirement: 'STRUCTURED_AUTHORIZATION_QUERY_MAPPING', status: 'REVIEW_REQUIRED', detail: 'not structured' }
      ],
      canGenerateAuthorizationRequest: false,
      canStartAuthorization: false,
      sendAllowed: false,
      networkAction: 'NONE',
      externalWritePerformed: false,
      requiresSeparateExecutionApproval: true,
      blockingReasons: ['Structured mapping required.']
    });
  });

  assert(
    previewUrl === 'http://localhost:3001/api/shopee/sg/auth/authorization-request/preview' && previewInit?.method === 'POST',
    'Test 15: Authorization preview uses the dedicated backend preview endpoint'
  );
  const previewSent = JSON.parse(String(previewInit?.body || '{}'));
  const previewSentText = JSON.stringify(previewSent).toLowerCase();
  assert(
    previewSent.authSchemaVerification.authorizationEndpoint === authSchemaVerification.authorizationEndpoint &&
    previewSent.authSchemaVerification.authorizationSignBaseRule === undefined &&
    !previewSentText.includes('partner_key') &&
    !previewSentText.includes('access_token') &&
    !previewSentText.includes('refresh_token'),
    'Test 16: Authorization preview sends only safe verification metadata and endpoint, not free-text signing rules or secrets'
  );
  assert(
    preview.previewStatus === 'STRUCTURED_MAPPING_REQUIRED' &&
    preview.executableAuthorizationUrl === null &&
    preview.signatureValue === null &&
    preview.canGenerateAuthorizationRequest === false &&
    preview.canStartAuthorization === false &&
    preview.sendAllowed === false &&
    preview.networkAction === 'NONE' &&
    preview.externalWritePerformed === false,
    'Test 17: Authorization preview cannot be mistaken for an executable authorization request'
  );

  let missingPreviewAuthFetchCalled = false;
  try {
    await fetchShopeeSgAuthorizationRequestPreview({
      accountId: 'shopee_sg_main', credentialRef: 'SHOPEE_SG_MAIN', shopId: '123456789', schemaVerification
    }, 'http://localhost:3001', async () => {
      missingPreviewAuthFetchCalled = true;
      return jsonResponse({});
    });
    assert(false, 'Test 18: Missing auth schema should fail before authorization-preview backend call');
  } catch (error) {
    assert(
      !missingPreviewAuthFetchCalled && describeBackendError(error).includes('MISSING_SHOPEE_AUTH_SCHEMA_VERIFICATION'),
      'Test 18: Missing auth schema is blocked before authorization-preview backend call'
    );
  }

  return { passed, failed, log };
}
