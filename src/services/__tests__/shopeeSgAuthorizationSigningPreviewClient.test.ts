import { fetchShopeeSgAuthorizationSigningPreview } from '../shopeeSgAuthorizationSigningPreviewClient';
import { describeBackendError } from '../ebaySandboxBackendClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function runShopeeSgAuthorizationSigningPreviewClientTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  const schemaVerification: any = {
    verificationId: 'schema-sign-client-1', status: 'OFFICIAL_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/documents/v2/inventory',
    checkedAt: '2026-09-09T00:00:00.000Z', externalWriteAllowed: false
  };
  const authSchemaVerification: any = {
    verificationId: 'auth-sign-client-1', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication',
    authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner', checkedAt: '2026-09-09T00:05:00.000Z',
    currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false
  };
  const structuredAuthorizationMapping: any = {
    mappingId: 'mapping-sign-client-1', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED', authSchemaVerificationId: 'auth-sign-client-1',
    officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', authorizationEndpoint: authSchemaVerification.authorizationEndpoint,
    authorizationHttpMethod: 'GET', authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' },
    authorizationQueryOrder: ['PARTNER_ID', 'TIMESTAMP', 'SIGNATURE', 'REDIRECT_URI'], signatureAlgorithm: 'HMAC-SHA256',
    signatureBaseComponents: ['PARTNER_ID', 'API_PATH', 'TIMESTAMP'], callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' },
    checkedAt: '2026-09-09T00:10:00.000Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false
  };
  const signingRuntimeVerification: any = {
    runtimeVerificationId: 'runtime-sign-client-1', marketplaceRegion: 'SG', status: 'SIGNING_RUNTIME_VERIFIED', authSchemaVerificationId: 'auth-sign-client-1',
    structuredMappingId: 'mapping-sign-client-1', officialSourceUrl: 'https://open.shopee.com/documents/v2/authentication', signatureAlgorithmLabel: 'HMAC-SHA256',
    signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', redirectUriSource: 'BACKEND_ENV', checkedAt: '2026-09-09T00:15:00.000Z',
    currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretValuesStored: false
  };

  let requestUrl = '';
  let requestInit: RequestInit | undefined;
  const response = await fetchShopeeSgAuthorizationSigningPreview({
    accountId: ' shopee_sg_main ', shopId: ' 99887766 ', credentialRef: ' SHOPEE_SG_MAIN ',
    schemaVerification, authSchemaVerification, structuredAuthorizationMapping, signingRuntimeVerification
  }, 'http://localhost:3001/', async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return jsonResponse({
      success: true, marketplace: 'Shopee', marketplaceRegion: 'SG', mode: 'AUTHORIZATION_SIGNING_PREVIEW_ONLY',
      accountId: 'shopee_sg_main', shopId: '99887766', credentialRef: 'SHOPEE_SG_MAIN', authSchemaVerificationId: 'auth-sign-client-1',
      structuredMappingId: 'mapping-sign-client-1', runtimeVerificationId: 'runtime-sign-client-1', authorizationEndpoint: authSchemaVerification.authorizationEndpoint,
      requestMethod: 'GET', redirectUriPreview: 'https://example.jp/callback', redirectUriSource: 'BACKEND_ENV', timestampPreview: 1,
      signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', signatureComponentRoles: ['PARTNER_ID','API_PATH','TIMESTAMP'],
      signatureGenerated: true, signatureLength: 64, signatureValueReturned: false, signatureBaseReturned: false, partnerIdValueReturned: false,
      partnerKeyValueReturned: false, secretValuesReturned: false, authorizationUrlReturned: false,
      runtimeConfigState: { partnerIdConfigured: true, partnerKeyConfigured: true, redirectUriConfigured: true, complete: true },
      unresolvedComponents: [], queryTemplate: [], callbackTemplate: { authorizationCodeField: 'code', shopIdField: 'shop_id' },
      canPrepareSignedAuthorizationRequest: true, canStartAuthorization: false, canReceiveAuthorizationCallback: false, canExchangeToken: false,
      sendAllowed: false, networkAction: 'NONE', externalWritePerformed: false, requiresSeparateExecutionApproval: true,
      blockingReasons: ['External Shopee authorization navigation/network action remains disabled in preview mode.']
    });
  });

  assert(requestUrl === 'http://localhost:3001/api/shopee/sg/auth/authorization-request/signing-preview' && requestInit?.method === 'POST', 'Test 1: Signing preview uses dedicated backend endpoint');
  const sent = JSON.parse(String(requestInit?.body || '{}'));
  const sentText = JSON.stringify(sent).toLowerCase();
  assert(sent.accountId === 'shopee_sg_main' && sent.shopId === '99887766' && sent.credentialRef === 'SHOPEE_SG_MAIN', 'Test 2: Client normalizes account, shop, and credential reference');
  assert(sent.structuredAuthorizationMapping.mappingId === 'mapping-sign-client-1' && sent.signingRuntimeVerification.runtimeVerificationId === 'runtime-sign-client-1', 'Test 3: Exact structured mapping and runtime evidence IDs are sent');
  assert(!sentText.includes('partner_key') && !sentText.includes('access_token') && !sentText.includes('refresh_token') && !sentText.includes('authorization_code='), 'Test 4: Browser request contains no secret values');
  assert(response.signatureGenerated && !response.signatureValueReturned && !response.signatureBaseReturned && !response.authorizationUrlReturned, 'Test 5: Response can confirm internal signing without exposing signature/base/URL');
  assert(response.canPrepareSignedAuthorizationRequest && !response.canStartAuthorization && response.networkAction === 'NONE' && !response.externalWritePerformed, 'Test 6: Signing readiness does not authorize Shopee navigation or writes');

  let called = false;
  try {
    await fetchShopeeSgAuthorizationSigningPreview({
      accountId: 'shopee_sg_main', shopId: '99887766', credentialRef: 'bad-ref',
      schemaVerification, authSchemaVerification, structuredAuthorizationMapping, signingRuntimeVerification
    }, 'http://localhost:3001', async () => { called = true; return jsonResponse({}); });
    assert(false, 'Test 7: Invalid credential ref should fail');
  } catch (error) {
    assert(!called && describeBackendError(error).includes('INVALID_SHOPEE_CREDENTIAL_REF'), 'Test 7: Invalid credential ref is blocked before backend call');
  }

  try {
    await fetchShopeeSgAuthorizationSigningPreview({
      accountId: 'shopee_sg_main', shopId: '99887766', credentialRef: 'SHOPEE_SG_MAIN',
      schemaVerification, authSchemaVerification, structuredAuthorizationMapping, signingRuntimeVerification
    }, 'http://localhost:3001', async () => jsonResponse({
      success: false, errorCode: 'STALE_SHOPEE_SIGNING_RUNTIME', error: 'Signing runtime is stale.', networkAction: 'NONE', externalWritePerformed: false
    }, 409));
    assert(false, 'Test 8: Backend stale runtime should fail');
  } catch (error) {
    assert(describeBackendError(error).includes('STALE_SHOPEE_SIGNING_RUNTIME'), 'Test 8: Safe backend stale-runtime error code is preserved');
  }

  return { passed, failed, log };
}
