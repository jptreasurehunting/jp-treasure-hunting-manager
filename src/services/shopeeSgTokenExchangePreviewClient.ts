import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredTokenMappingRecord } from './shopeeSgStructuredTokenMappingService';
import type { ShopeeSgTokenExchangeRuntimeRecord } from './shopeeSgTokenExchangeRuntimeService';
import { BackendSafeError, getConfiguredBackendBaseUrl } from './ebaySandboxBackendClient';

export interface ShopeeSgTokenExchangePreviewInput {
  accountId: string;
  shopId: string;
  credentialRef: string;
  authSchemaVerification: ShopeeSgAuthSchemaVerificationRecord;
  tokenMapping: ShopeeSgStructuredTokenMappingRecord;
  tokenRuntimeVerification: ShopeeSgTokenExchangeRuntimeRecord;
}

export interface ShopeeSgTokenExchangePreviewResponse {
  success: true;
  marketplace: 'Shopee';
  marketplaceRegion: 'SG';
  mode: 'TOKEN_EXCHANGE_REQUEST_PREVIEW_NO_NETWORK';
  accountId: string;
  shopId: string;
  credentialRef: string;
  authSchemaVerificationId: string;
  tokenMappingId: string;
  runtimeVerificationId: string;
  tokenEndpoint: string;
  requestMethod: 'POST';
  bodyEncoding: 'JSON' | 'FORM_URLENCODED';
  queryFields: Array<{ role: string; fieldName: string }>;
  bodyFields: Array<{ role: string; fieldName: string }>;
  responseFields: { accessToken: string; refreshToken: string; expiresIn: string; expiresInUnit: string };
  signatureComponentRoles: string[];
  signatureImplementation: string;
  signatureBaseSerialization: string;
  signatureGenerated: true;
  signatureLength: number;
  authorizationCodeSource: 'SYNTHETIC_PREVIEW_ONLY';
  authorizationCodeStored: false;
  authorizationCodeReturned: false;
  partnerIdValueReturned: false;
  partnerKeyValueReturned: false;
  signatureValueReturned: false;
  signatureBaseReturned: false;
  tokenValuesReturned: false;
  executableRequestReturned: false;
  secretValuesReturned: false;
  requestFingerprint: string;
  timestampPreview: number;
  canExchangeToken: false;
  canStoreTokens: false;
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
async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw <BackendSafeError>{ success: false, errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : undefined, error: typeof payload.error === 'string' ? payload.error : `Shopee SG token preview failed with HTTP ${response.status}.`, httpStatus: response.status, externalWritePerformed: payload.externalWritePerformed === true };
  return payload as T;
}
function safeAuth(r: ShopeeSgAuthSchemaVerificationRecord) {
  return { verificationId: r.verificationId, status: r.status, officialSourceUrl: r.officialSourceUrl, tokenEndpoint: r.tokenEndpoint, signatureAlgorithm: r.signatureAlgorithm, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretsStored: r.secretsStored };
}
function safeMapping(r: ShopeeSgStructuredTokenMappingRecord) {
  return { tokenMappingId: r.tokenMappingId, marketplaceRegion: r.marketplaceRegion, status: r.status, authSchemaVerificationId: r.authSchemaVerificationId, officialSourceUrl: r.officialSourceUrl, tokenEndpoint: r.tokenEndpoint, tokenHttpMethod: r.tokenHttpMethod, tokenBodyEncoding: r.tokenBodyEncoding, tokenQueryFieldNames: r.tokenQueryFieldNames, tokenQueryOrder: r.tokenQueryOrder, tokenBodyFieldNames: r.tokenBodyFieldNames, tokenBodyRoles: r.tokenBodyRoles, signatureAlgorithm: r.signatureAlgorithm, signatureBaseComponents: r.signatureBaseComponents, tokenResponseFieldNames: r.tokenResponseFieldNames, expiresInUnit: r.expiresInUnit, allRequiredRequestFieldsRepresented: r.allRequiredRequestFieldsRepresented, allRequiredResponseFieldsRepresented: r.allRequiredResponseFieldsRepresented, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, tokenExchangeAllowed: r.tokenExchangeAllowed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretsStored: r.secretsStored };
}
function safeRuntime(r: ShopeeSgTokenExchangeRuntimeRecord) {
  return { runtimeVerificationId: r.runtimeVerificationId, marketplaceRegion: r.marketplaceRegion, status: r.status, authSchemaVerificationId: r.authSchemaVerificationId, tokenMappingId: r.tokenMappingId, officialSourceUrl: r.officialSourceUrl, signatureAlgorithmLabel: r.signatureAlgorithmLabel, signatureImplementation: r.signatureImplementation, signatureBaseSerialization: r.signatureBaseSerialization, checkedAt: r.checkedAt, currentSingaporeApplicabilityConfirmed: r.currentSingaporeApplicabilityConfirmed, previewAllowed: r.previewAllowed, tokenExchangeAllowed: r.tokenExchangeAllowed, externalNetworkAllowed: r.externalNetworkAllowed, externalWriteAllowed: r.externalWriteAllowed, secretValuesStored: r.secretValuesStored };
}

export async function buildShopeeSgTokenExchangePreview(input: ShopeeSgTokenExchangePreviewInput, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<ShopeeSgTokenExchangePreviewResponse> {
  const accountId = input.accountId.trim();
  const shopId = input.shopId.trim();
  const credentialRef = normalizeCredentialRef(input.credentialRef);
  if (!accountId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_SHOPEE_ACCOUNT_ID', error: 'Shopee販売アカウントIDが必要です。' };
  if (!/^[1-9]\d*$/.test(shopId)) throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_SHOP_ID', error: 'Shopee Shop IDは正の整数IDで指定してください。' };
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/shopee/sg/auth/token-exchange/preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ accountId, shopId, credentialRef, authSchemaVerification: safeAuth(input.authSchemaVerification), tokenMapping: safeMapping(input.tokenMapping), tokenRuntimeVerification: safeRuntime(input.tokenRuntimeVerification) })
  });
  return parseJsonResponse<ShopeeSgTokenExchangePreviewResponse>(response);
}
