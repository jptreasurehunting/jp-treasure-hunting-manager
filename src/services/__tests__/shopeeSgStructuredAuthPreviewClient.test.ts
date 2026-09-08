import { fetchShopeeSgAuthorizationRequestPreview } from '../shopeeSgBackendAuthClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function runShopeeSgStructuredAuthPreviewClientTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  const schemaVerification: any = {
    verificationId: 'schema-sg-preview-1',
    marketplaceRegion: 'SG',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory',
    checkedAt: '2026-09-08T03:00:00.000Z',
    status: 'OFFICIAL_SCHEMA_VERIFIED',
    externalWriteAllowed: false
  };
  const authSchemaVerification: any = {
    verificationId: 'auth-schema-sg-preview-1',
    marketplaceRegion: 'SG',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/example/verified-auth-endpoint',
    checkedAt: '2026-09-08T03:10:00.000Z',
    currentSingaporeApplicabilityConfirmed: true,
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false
  };
  const structuredAuthorizationMapping: any = {
    mappingId: 'structured-auth-preview-1',
    marketplaceRegion: 'SG',
    status: 'STRUCTURED_AUTH_MAPPING_VERIFIED',
    authSchemaVerificationId: authSchemaVerification.verificationId,
    officialSourceUrl: authSchemaVerification.officialSourceUrl,
    authorizationEndpoint: authSchemaVerification.authorizationEndpoint,
    authorizationHttpMethod: 'GET',
    authorizationQueryFieldNames: {
      partnerId: 'test_partner_field',
      timestamp: 'test_time_field',
      signature: 'test_sign_field',
      redirectUri: 'test_redirect_field'
    },
    authorizationQueryOrder: ['REDIRECT_URI', 'PARTNER_ID', 'TIMESTAMP', 'SIGNATURE'],
    signatureAlgorithm: 'TEST_VERIFIED_ALGORITHM_LABEL',
    signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
    callbackFieldNames: {
      authorizationCode: 'test_code_field',
      shopId: 'test_shop_field'
    },
    checkedAt: '2026-09-08T03:20:00.000Z',
    currentSingaporeApplicabilityConfirmed: true,
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: '2026-09-08T03:20:00.000Z',
    updatedAt: '2026-09-08T03:20:00.000Z'
  };

  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const response = await fetchShopeeSgAuthorizationRequestPreview({
    accountId: ' shopee_sg_main ',
    credentialRef: ' SHOPEE_SG_MAIN ',
    shopId: ' 123456789 ',
    schemaVerification,
    authSchemaVerification,
    structuredAuthorizationMapping
  }, 'http://localhost:3001/', async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return jsonResponse({
      success: true,
      marketplace: 'Shopee',
      marketplaceRegion: 'SG',
      mode: 'AUTHORIZATION_REQUEST_PREVIEW_ONLY',
      stage: 'AUTHORIZATION_REQUEST_BUILD',
      previewStatus: 'STRUCTURED_MAPPING_VERIFIED',
      accountId: 'shopee_sg_main',
      shopId: '123456789',
      credentialRef: 'SHOPEE_SG_MAIN',
      inventorySchemaVerificationId: schemaVerification.verificationId,
      authSchemaVerificationId: authSchemaVerification.verificationId,
      structuredMappingId: structuredAuthorizationMapping.mappingId,
      authorizationEndpoint: authSchemaVerification.authorizationEndpoint,
      requestMethod: 'GET',
      queryTemplate: [
        { role: 'REDIRECT_URI', fieldName: 'test_redirect_field', valueSource: 'BACKEND_CONFIGURED_REDIRECT_URI' },
        { role: 'PARTNER_ID', fieldName: 'test_partner_field', valueSource: 'BACKEND_PARTNER_ID' },
        { role: 'TIMESTAMP', fieldName: 'test_time_field', valueSource: 'CURRENT_UNIX_TIMESTAMP' },
        { role: 'SIGNATURE', fieldName: 'test_sign_field', valueSource: 'BACKEND_GENERATED_SIGNATURE' }
      ],
      signatureTemplate: {
        algorithm: 'TEST_VERIFIED_ALGORITHM_LABEL',
        baseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'],
        apiPath: '/example/verified-auth-endpoint'
      },
      callbackTemplate: {
        authorizationCodeField: 'test_code_field',
        shopIdField: 'test_shop_field'
      },
      executableAuthorizationUrl: null,
      signatureValue: null,
      partnerIdValueReturned: false,
      partnerKeyValueReturned: false,
      secretValuesReturned: false,
      credentialState: { partnerIdConfigured: true, partnerKeyConfigured: true, credentialConfigured: true },
      requirements: [],
      canGenerateAuthorizationRequest: false,
      canStartAuthorization: false,
      sendAllowed: false,
      networkAction: 'NONE',
      externalWritePerformed: false,
      requiresSeparateExecutionApproval: true,
      blockingReasons: ['Execution remains separately gated.']
    });
  });

  assert(
    requestUrl === 'http://localhost:3001/api/shopee/sg/auth/authorization-request/preview' && requestInit?.method === 'POST',
    'Test 1: Structured authorization preview uses only the local backend preview endpoint'
  );

  const sent = JSON.parse(String(requestInit?.body || '{}'));
  assert(
    sent.structuredAuthorizationMapping.mappingId === 'structured-auth-preview-1' &&
    sent.structuredAuthorizationMapping.authSchemaVerificationId === 'auth-schema-sg-preview-1' &&
    sent.structuredAuthorizationMapping.authorizationQueryOrder.join(',') === 'REDIRECT_URI,PARTNER_ID,TIMESTAMP,SIGNATURE',
    'Test 2: Browser preserves explicit structured query-role order and schema binding'
  );

  assert(
    Object.keys(sent.structuredAuthorizationMapping).sort().join(',') === [
      'authSchemaVerificationId',
      'authorizationEndpoint',
      'authorizationHttpMethod',
      'authorizationQueryFieldNames',
      'authorizationQueryOrder',
      'callbackFieldNames',
      'checkedAt',
      'currentSingaporeApplicabilityConfirmed',
      'externalNetworkAllowed',
      'externalWriteAllowed',
      'mappingId',
      'marketplaceRegion',
      'officialSourceUrl',
      'secretsStored',
      'signatureAlgorithm',
      'signatureBaseComponents',
      'status'
    ].sort().join(','),
    'Test 3: Browser sends only the allowlisted structured mapping snapshot'
  );

  const sentText = JSON.stringify(sent).toLowerCase();
  assert(
    !sentText.includes('partner_key') &&
    !sentText.includes('access_token') &&
    !sentText.includes('refresh_token') &&
    !sentText.includes('authorizationcodevalue') &&
    sent.structuredAuthorizationMapping.verificationNote === undefined,
    'Test 4: Structured preview request contains no secret/token/code values or free-text notes'
  );

  assert(
    response.previewStatus === 'STRUCTURED_MAPPING_VERIFIED' &&
    response.requestMethod === 'GET' &&
    response.queryTemplate?.map((entry) => entry.role).join(',') === 'REDIRECT_URI,PARTNER_ID,TIMESTAMP,SIGNATURE',
    'Test 5: Structured preview response exposes only the verified semantic request template'
  );

  assert(
    response.executableAuthorizationUrl === null &&
    response.signatureValue === null &&
    response.partnerIdValueReturned === false &&
    response.partnerKeyValueReturned === false &&
    response.secretValuesReturned === false,
    'Test 6: Preview never returns executable URL, signature, Partner ID value, Partner Key, or secrets'
  );

  assert(
    response.canGenerateAuthorizationRequest === false &&
    response.canStartAuthorization === false &&
    response.sendAllowed === false &&
    response.networkAction === 'NONE' &&
    response.externalWritePerformed === false &&
    response.requiresSeparateExecutionApproval === true,
    'Test 7: Structured mapping cannot turn preview into an external authorization action'
  );

  return { passed, failed, log };
}
