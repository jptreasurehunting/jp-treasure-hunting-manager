import {
  fetchShopeeSgAuthorizationSessionStatus,
  issueShopeeSgSignedAuthorizationRequestPreview,
  prepareShopeeSgAuthorizationSession
} from '../shopeeSgAuthorizationSessionClient';
import { describeBackendError } from '../ebaySandboxBackendClient';

function jsonResponse(payload: unknown, status = 200): Response { return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } }); }

export async function runShopeeSgAuthorizationSessionClientTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0; let failed = 0; const log: string[] = [];
  const assert = (condition: boolean, name: string) => { if (condition) { passed++; log.push(`✅ [PASS] ${name}`); } else { failed++; log.push(`❌ [FAIL] ${name}`); } };
  const schema: any = { verificationId: 'schema-session-client', status: 'OFFICIAL_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/inventory', checkedAt: '2026-09-09T01:00:00Z', externalWriteAllowed: false };
  const auth: any = { verificationId: 'auth-session-client', status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED', officialSourceUrl: 'https://open.shopee.com/auth', authorizationEndpoint: 'https://partner.shopeemobile.com/api/v2/shop/auth_partner', checkedAt: '2026-09-09T01:05:00Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const structured: any = { mappingId: 'structured-session-client', marketplaceRegion: 'SG', status: 'STRUCTURED_AUTH_MAPPING_VERIFIED', authSchemaVerificationId: auth.verificationId, officialSourceUrl: auth.officialSourceUrl, authorizationEndpoint: auth.authorizationEndpoint, authorizationHttpMethod: 'GET', authorizationQueryFieldNames: { partnerId: 'partner_id', timestamp: 'timestamp', signature: 'sign', redirectUri: 'redirect' }, authorizationQueryOrder: ['PARTNER_ID','TIMESTAMP','SIGNATURE','REDIRECT_URI'], signatureAlgorithm: 'HMAC-SHA256', signatureBaseComponents: ['PARTNER_ID','API_PATH','TIMESTAMP'], callbackFieldNames: { authorizationCode: 'code', shopId: 'shop_id' }, checkedAt: '2026-09-09T01:10:00Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const runtime: any = { runtimeVerificationId: 'runtime-session-client', marketplaceRegion: 'SG', status: 'SIGNING_RUNTIME_VERIFIED', authSchemaVerificationId: auth.verificationId, structuredMappingId: structured.mappingId, officialSourceUrl: auth.officialSourceUrl, signatureAlgorithmLabel: 'HMAC-SHA256', signatureImplementation: 'HMAC_SHA256_HEX', signatureBaseSerialization: 'CONCAT_NO_SEPARATOR', redirectUriSource: 'BACKEND_ENV', checkedAt: '2026-09-09T01:15:00Z', currentSingaporeApplicabilityConfirmed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretValuesStored: false };
  const correlation: any = { correlationMappingId: 'corr-session-client', marketplaceRegion: 'SG', status: 'CALLBACK_CORRELATION_VERIFIED', authSchemaVerificationId: auth.verificationId, structuredMappingId: structured.mappingId, officialSourceUrl: auth.officialSourceUrl, correlationMode: 'OFFICIAL_ROUND_TRIP_FIELD', authorizationRequestFieldName: 'state', callbackFieldName: 'state', signatureParticipation: 'NOT_INCLUDED', checkedAt: '2026-09-09T01:20:00Z', currentSingaporeApplicabilityConfirmed: true, safeSessionPreparationAllowed: true, externalNetworkAllowed: false, externalWriteAllowed: false, secretsStored: false };
  const safeInput = { accountId: ' shopee_sg_main ', shopId: ' 99887766 ', credentialRef: ' SHOPEE_SG_MAIN ', schemaVerification: schema, authSchemaVerification: auth, structuredAuthorizationMapping: structured, signingRuntimeVerification: runtime, callbackCorrelationMapping: correlation };

  let url = ''; let init: RequestInit | undefined;
  const result = await prepareShopeeSgAuthorizationSession(safeInput, 'http://localhost:3001/', async (input, requestInit) => {
    url = String(input); init = requestInit;
    return jsonResponse({ success: true, marketplace: 'Shopee', marketplaceRegion: 'SG', mode: 'AUTHORIZATION_SESSION_PREPARED_NO_NETWORK', sessionId: 'shopee_sg_authsess_abcdefghijklmnopqrstuvwxyz123456', accountId: 'shopee_sg_main', shopId: '99887766', credentialRef: 'SHOPEE_SG_MAIN', authSchemaVerificationId: auth.verificationId, structuredMappingId: structured.mappingId, signingRuntimeId: runtime.runtimeVerificationId, correlationMappingId: correlation.correlationMappingId, redirectUri: 'https://example.jp/callback', correlationRequestField: 'state', correlationCallbackField: 'state', issuedAt: '2026-09-09T01:30:00Z', expiresAt: '2026-09-09T01:40:00Z', status: 'PREPARED', correlationStateIssued: false, correlationStateValueReturned: false, correlationStateHashReturned: false, authorizationCodeStored: false, authorizationCodeReturned: false, signatureValueReturned: false, partnerKeyValueReturned: false, secretValuesReturned: false, canIssueCorrelationStateInFutureAuthStart: true, canStartAuthorization: false, canReceiveAuthorizationCallback: false, canExchangeToken: false, sendAllowed: false, networkAction: 'NONE', externalWritePerformed: false, blockingReasons: ['No external auth yet.'] });
  });
  assert(url === 'http://localhost:3001/api/shopee/sg/auth/session/prepare' && init?.method === 'POST', 'Test 1: Session preparation uses dedicated backend endpoint');
  const sent = JSON.parse(String(init?.body || '{}')); const sentText = JSON.stringify(sent).toLowerCase();
  assert(sent.accountId === 'shopee_sg_main' && sent.shopId === '99887766' && sent.credentialRef === 'SHOPEE_SG_MAIN', 'Test 2: Session client normalizes safe identity');
  assert(sent.callbackCorrelationMapping.correlationMappingId === correlation.correlationMappingId && sent.signingRuntimeVerification.runtimeVerificationId === runtime.runtimeVerificationId, 'Test 3: Exact runtime and correlation evidence IDs are sent');
  assert(!sentText.includes('partner_key') && !sentText.includes('access_token') && !sentText.includes('refresh_token') && !sentText.includes('authorization_code='), 'Test 4: Session preparation request contains no secret values');
  assert(result.correlationStateIssued === false && result.correlationStateValueReturned === false && result.authorizationCodeStored === false, 'Test 5: Session response contains no issued state or authorization code');
  assert(result.canStartAuthorization === false && result.networkAction === 'NONE' && result.externalWritePerformed === false, 'Test 6: Prepared session remains non-network and non-executable');

  let statusUrl = '';
  const status = await fetchShopeeSgAuthorizationSessionStatus(result.sessionId, 'http://localhost:3001', async (input) => { statusUrl = String(input); return jsonResponse(result); });
  assert(statusUrl.endsWith(`/api/shopee/sg/auth/session/${result.sessionId}`) && status.sessionId === result.sessionId, 'Test 7: Session status uses session-scoped safe endpoint');

  let called = false;
  try { await fetchShopeeSgAuthorizationSessionStatus('bad', 'http://localhost:3001', async () => { called = true; return jsonResponse({}); }); assert(false, 'Test 8: Invalid session id should fail'); }
  catch (error) { assert(!called && describeBackendError(error).includes('INVALID_SHOPEE_AUTH_SESSION_ID'), 'Test 8: Invalid session ID is blocked before backend call'); }

  try { await prepareShopeeSgAuthorizationSession({ ...safeInput, accountId: 'shopee_sg_main', shopId: '99887766', credentialRef: 'SHOPEE_SG_MAIN' }, 'http://localhost:3001', async () => jsonResponse({ success: false, errorCode: 'SHOPEE_SAFE_CALLBACK_CORRELATION_UNAVAILABLE', error: 'Correlation unavailable.', networkAction: 'NONE', externalWritePerformed: false }, 400)); assert(false, 'Test 9: Unsafe backend correlation should fail'); }
  catch (error) { assert(describeBackendError(error).includes('SHOPEE_SAFE_CALLBACK_CORRELATION_UNAVAILABLE'), 'Test 9: Safe backend correlation error code is preserved'); }

  let previewUrl = ''; let previewInit: RequestInit | undefined;
  const preview = await issueShopeeSgSignedAuthorizationRequestPreview(result.sessionId, safeInput, 'http://localhost:3001/', async (input, requestInit) => {
    previewUrl = String(input); previewInit = requestInit;
    return jsonResponse({
      success: true,
      marketplace: 'Shopee',
      marketplaceRegion: 'SG',
      mode: 'SIGNED_AUTHORIZATION_REQUEST_PREVIEW_NO_NETWORK',
      sessionId: result.sessionId,
      sessionStatus: 'STATE_ISSUED_PREVIEW_ONLY',
      accountId: 'shopee_sg_main',
      shopId: '99887766',
      credentialRef: 'SHOPEE_SG_MAIN',
      authorizationEndpoint: auth.authorizationEndpoint,
      requestMethod: 'GET',
      redirectUri: 'https://example.jp/callback',
      queryFields: [
        { role: 'PARTNER_ID', fieldName: 'partner_id' },
        { role: 'TIMESTAMP', fieldName: 'timestamp' },
        { role: 'SIGNATURE', fieldName: 'sign' },
        { role: 'REDIRECT_URI', fieldName: 'redirect' },
        { role: 'CALLBACK_CORRELATION', fieldName: 'state' }
      ],
      signatureImplementation: 'HMAC_SHA256_HEX',
      signatureBaseSerialization: 'CONCAT_NO_SEPARATOR',
      signatureComponentRoles: ['PARTNER_ID','API_PATH','TIMESTAMP'],
      signatureGenerated: true,
      signatureLength: 64,
      correlationStateIssued: true,
      correlationStateLength: 43,
      correlationStateEntropyBytes: 32,
      correlationStatePlaintextStored: false,
      correlationStateValueReturned: false,
      correlationStateHashReturned: false,
      signatureValueReturned: false,
      signatureBaseReturned: false,
      partnerIdValueReturned: false,
      partnerKeyValueReturned: false,
      secretValuesReturned: false,
      executableAuthorizationUrlReturned: false,
      authorizationRequestFingerprint: 'a'.repeat(64),
      stateIssuedAt: '2026-09-09T01:31:00Z',
      expiresAt: result.expiresAt,
      canStartAuthorization: false,
      canReceiveAuthorizationCallback: false,
      canExchangeToken: false,
      sendAllowed: false,
      networkAction: 'NONE',
      externalWritePerformed: false,
      blockingReasons: ['Preview only.']
    });
  });
  assert(previewUrl === `http://localhost:3001/api/shopee/sg/auth/session/${result.sessionId}/authorization-request-preview` && previewInit?.method === 'POST', 'Test 10: Signed request preview uses session-scoped preview endpoint');
  const previewBody = JSON.parse(String(previewInit?.body || '{}')); const previewBodyText = JSON.stringify(previewBody).toLowerCase();
  assert(previewBody.accountId === 'shopee_sg_main' && previewBody.structuredAuthorizationMapping.mappingId === structured.mappingId && previewBody.signingRuntimeVerification.runtimeVerificationId === runtime.runtimeVerificationId, 'Test 11: Preview sends only bound safe verification records');
  assert(!previewBodyText.includes('partner_key') && !previewBodyText.includes('access_token') && !previewBodyText.includes('refresh_token') && !previewBodyText.includes('authorization_code='), 'Test 12: Preview client request contains no Partner Key, token, or authorization code');
  assert(preview.correlationStateIssued === true && preview.correlationStatePlaintextStored === false && preview.correlationStateValueReturned === false && preview.correlationStateHashReturned === false, 'Test 13: Preview response exposes neither state plaintext nor hash');
  assert(preview.signatureGenerated === true && preview.signatureValueReturned === false && preview.signatureBaseReturned === false && preview.partnerIdValueReturned === false && preview.partnerKeyValueReturned === false, 'Test 14: Signature and backend credential values remain redacted');
  assert(preview.executableAuthorizationUrlReturned === false && preview.canStartAuthorization === false && preview.sendAllowed === false && preview.networkAction === 'NONE' && preview.externalWritePerformed === false, 'Test 15: Preview cannot navigate, send, or mutate externally');

  let invalidPreviewCalled = false;
  try {
    await issueShopeeSgSignedAuthorizationRequestPreview('bad', safeInput, 'http://localhost:3001', async () => { invalidPreviewCalled = true; return jsonResponse({}); });
    assert(false, 'Test 16: Invalid preview session id should fail');
  } catch (error) {
    assert(!invalidPreviewCalled && describeBackendError(error).includes('INVALID_SHOPEE_AUTH_SESSION_ID'), 'Test 16: Invalid preview session ID is blocked before backend call');
  }

  return { passed, failed, log };
}
