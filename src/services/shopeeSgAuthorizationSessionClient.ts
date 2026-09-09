import type { ShopeeSgApiSchemaVerificationRecord } from './shopeeSgApiSchemaVerificationService';
import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredAuthMappingRecord } from './shopeeSgStructuredAuthMappingService';
import type { ShopeeSgAuthorizationSigningRuntimeRecord } from './shopeeSgAuthorizationSigningRuntimeService';
import type { ShopeeSgCallbackCorrelationMappingRecord } from './shopeeSgCallbackCorrelationMappingService';
import { BackendSafeError, getConfiguredBackendBaseUrl } from './ebaySandboxBackendClient';

export interface ShopeeSgAuthorizationSessionPrepareInput {
  accountId: string;
  shopId: string;
  credentialRef: string;
  schemaVerification: ShopeeSgApiSchemaVerificationRecord;
  authSchemaVerification: ShopeeSgAuthSchemaVerificationRecord;
  structuredAuthorizationMapping: ShopeeSgStructuredAuthMappingRecord;
  signingRuntimeVerification: ShopeeSgAuthorizationSigningRuntimeRecord;
  callbackCorrelationMapping: ShopeeSgCallbackCorrelationMappingRecord;
}

export interface ShopeeSgAuthorizationSessionResponse {
  success: true;
  marketplace: 'Shopee';
  marketplaceRegion: 'SG';
  mode: 'AUTHORIZATION_SESSION_PREPARED_NO_NETWORK';
  sessionId: string;
  accountId: string;
  shopId: string;
  credentialRef: string;
  authSchemaVerificationId: string;
  structuredMappingId: string;
  signingRuntimeId: string;
  correlationMappingId: string;
  redirectUri: string;
  correlationRequestField: string;
  correlationCallbackField: string;
  issuedAt: string;
  expiresAt: string;
  status: 'PREPARED' | 'STATE_ISSUED_PREVIEW_ONLY' | 'EXPIRED' | string;
  correlationStateIssued: boolean;
  correlationStateValueReturned: false;
  correlationStateHashReturned: false;
  authorizationCodeStored: false;
  authorizationCodeReturned: false;
  signatureValueReturned: false;
  partnerKeyValueReturned: false;
  secretValuesReturned: false;
  canIssueCorrelationStateInFutureAuthStart: boolean;
  canStartAuthorization: false;
  canReceiveAuthorizationCallback: false;
  canExchangeToken: false;
  sendAllowed: false;
  networkAction: 'NONE';
  externalWritePerformed: false;
  blockingReasons: string[];
}

export interface ShopeeSgSignedAuthorizationRequestPreviewResponse {
  success: true;
  marketplace: 'Shopee';
  marketplaceRegion: 'SG';
  mode: 'SIGNED_AUTHORIZATION_REQUEST_PREVIEW_NO_NETWORK';
  sessionId: string;
  sessionStatus: 'STATE_ISSUED_PREVIEW_ONLY';
  accountId: string;
  shopId: string;
  credentialRef: string;
  authorizationEndpoint: string;
  requestMethod: string;
  redirectUri: string;
  queryFields: Array<{ role: string; fieldName: string }>;
  signatureImplementation: string;
  signatureBaseSerialization: string;
  signatureComponentRoles: string[];
  signatureGenerated: true;
  signatureLength: number;
  correlationStateIssued: true;
  correlationStateLength: number;
  correlationStateEntropyBytes: number;
  correlationStatePlaintextStored: false;
  correlationStateValueReturned: false;
  correlationStateHashReturned: false;
  signatureValueReturned: false;
  signatureBaseReturned: false;
  partnerIdValueReturned: false;
  partnerKeyValueReturned: false;
  secretValuesReturned: false;
  executableAuthorizationUrlReturned: false;
  authorizationRequestFingerprint: string;
  stateIssuedAt: string;
  expiresAt: string;
  canStartAuthorization: false;
  canReceiveAuthorizationCallback: false;
  canExchangeToken: false;
  sendAllowed: false;
  networkAction: 'NONE';
  externalWritePerformed: false;
  blockingReasons: string[];
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function trimTrailingSlash(value: string): string { return value.trim().replace(/\/+$/, ''); }
function requireFetch(fetchImpl?: FetchLike): FetchLike {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (typeof resolved !== 'function') throw <BackendSafeError>{ success: false, errorCode: 'FETCH_UNAVAILABLE', error: 'バックエンド通信を利用できません。' };
  return resolved.bind(globalThis) as FetchLike;
}
function normalizeCredentialRef(value: string): string {
  const ref = value.trim();
  if (!/^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(ref)) throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_CREDENTIAL_REF', error: '認証情報参照名は SHOPEE_SG_MAIN のような形式にしてください。' };
  return ref;
}
function normalizeSessionId(value: string): string {
  const sessionId = value.trim();
  if (!/^shopee_sg_authsess_[A-Za-z0-9_-]{20,80}$/.test(sessionId)) throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_AUTH_SESSION_ID', error: 'Shopee SG認証Session IDが不正です。' };
  return sessionId;
}
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw <BackendSafeError>{ success: false, errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : undefined, error: typeof payload.error === 'string' ? payload.error : `Shopee SG auth session request failed with HTTP ${response.status}.`, httpStatus: response.status, externalWritePerformed: payload.externalWritePerformed === true };
  return payload as T;
}

function safeInventorySchema(r: ShopeeSgApiSchemaVerificationRecord) { return { verificationId: r.verificationId, status: r.status, officialSourceUrl: r.officialSourceUrl, checkedAt: r.checkedAt, externalWriteAllowed: r.externalWriteAllowed }; }
function safeAuthSchema(r: ShopeeSgAuthSchemaVerificationRecord) { return { verificationId: r.verificationId, status: r.status, officialSourceUrl: r.officialSourceUrl, authorizationEndpoint: r.authorizationEndpoint, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretsStored: r.secretsStored }; }
function safeStructured(r: ShopeeSgStructuredAuthMappingRecord) { return { mappingId: r.mappingId, marketplaceRegion: r.marketplaceRegion, status: r.status, authSchemaVerificationId: r.authSchemaVerificationId, officialSourceUrl: r.officialSourceUrl, authorizationEndpoint: r.authorizationEndpoint, authorizationHttpMethod: r.authorizationHttpMethod, authorizationQueryFieldNames: r.authorizationQueryFieldNames, authorizationQueryOrder: r.authorizationQueryOrder, signatureAlgorithm: r.signatureAlgorithm, signatureBaseComponents: r.signatureBaseComponents, callbackFieldNames: r.callbackFieldNames, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretsStored: r.secretsStored }; }
function safeRuntime(r: ShopeeSgAuthorizationSigningRuntimeRecord) { return { runtimeVerificationId: r.runtimeVerificationId, marketplaceRegion: r.marketplaceRegion, status: r.status, authSchemaVerificationId: r.authSchemaVerificationId, structuredMappingId: r.structuredMappingId, officialSourceUrl: r.officialSourceUrl, signatureAlgorithmLabel: r.signatureAlgorithmLabel, signatureImplementation: r.signatureImplementation, signatureBaseSerialization: r.signatureBaseSerialization, redirectUriSource: r.redirectUriSource, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretValuesStored: r.secretValuesStored }; }
function safeCorrelation(r: ShopeeSgCallbackCorrelationMappingRecord) { return { correlationMappingId: r.correlationMappingId, marketplaceRegion: r.marketplaceRegion, status: r.status, authSchemaVerificationId: r.authSchemaVerificationId, structuredMappingId: r.structuredMappingId, officialSourceUrl: r.officialSourceUrl, correlationMode: r.correlationMode, authorizationRequestFieldName: r.authorizationRequestFieldName, callbackFieldName: r.callbackFieldName, signatureParticipation: r.signatureParticipation, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, safeSessionPreparationAllowed: r.safeSessionPreparationAllowed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretsStored: r.secretsStored }; }
function safeSessionInput(input: ShopeeSgAuthorizationSessionPrepareInput) {
  const accountId = input.accountId.trim();
  const shopId = input.shopId.trim();
  const credentialRef = normalizeCredentialRef(input.credentialRef);
  if (!accountId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_SHOPEE_ACCOUNT_ID', error: 'Shopee販売アカウントIDが必要です。' };
  if (!/^[1-9]\d*$/.test(shopId)) throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_SHOP_ID', error: 'Shopee Shop IDは正の整数IDで指定してください。' };
  return { accountId, shopId, credentialRef, schemaVerification: safeInventorySchema(input.schemaVerification), authSchemaVerification: safeAuthSchema(input.authSchemaVerification), structuredAuthorizationMapping: safeStructured(input.structuredAuthorizationMapping), signingRuntimeVerification: safeRuntime(input.signingRuntimeVerification), callbackCorrelationMapping: safeCorrelation(input.callbackCorrelationMapping) };
}

export async function prepareShopeeSgAuthorizationSession(input: ShopeeSgAuthorizationSessionPrepareInput, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<ShopeeSgAuthorizationSessionResponse> {
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/shopee/sg/auth/session/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(safeSessionInput(input))
  });
  return parseJsonResponse<ShopeeSgAuthorizationSessionResponse>(response);
}

export async function fetchShopeeSgAuthorizationSessionStatus(sessionId: string, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<ShopeeSgAuthorizationSessionResponse> {
  const normalized = normalizeSessionId(sessionId);
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/shopee/sg/auth/session/${encodeURIComponent(normalized)}`, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseJsonResponse<ShopeeSgAuthorizationSessionResponse>(response);
}

export async function issueShopeeSgSignedAuthorizationRequestPreview(
  sessionId: string,
  input: ShopeeSgAuthorizationSessionPrepareInput,
  baseUrl = getConfiguredBackendBaseUrl(),
  fetchImpl?: FetchLike
): Promise<ShopeeSgSignedAuthorizationRequestPreviewResponse> {
  const normalized = normalizeSessionId(sessionId);
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/shopee/sg/auth/session/${encodeURIComponent(normalized)}/authorization-request-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(safeSessionInput(input))
  });
  return parseJsonResponse<ShopeeSgSignedAuthorizationRequestPreviewResponse>(response);
}
