import type { ShopeeSgApiSchemaVerificationRecord } from './shopeeSgApiSchemaVerificationService';
import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredAuthMappingRecord } from './shopeeSgStructuredAuthMappingService';
import type { ShopeeSgAuthorizationSigningRuntimeRecord } from './shopeeSgAuthorizationSigningRuntimeService';
import { BackendSafeError, getConfiguredBackendBaseUrl } from './ebaySandboxBackendClient';

export interface ShopeeSgAuthorizationSigningPreviewInput {
  accountId: string;
  shopId: string;
  credentialRef: string;
  schemaVerification: ShopeeSgApiSchemaVerificationRecord;
  authSchemaVerification: ShopeeSgAuthSchemaVerificationRecord;
  structuredAuthorizationMapping: ShopeeSgStructuredAuthMappingRecord;
  signingRuntimeVerification: ShopeeSgAuthorizationSigningRuntimeRecord;
}

export interface ShopeeSgAuthorizationSigningPreviewResponse {
  success: true;
  marketplace: 'Shopee';
  marketplaceRegion: 'SG';
  mode: 'AUTHORIZATION_SIGNING_PREVIEW_ONLY';
  accountId: string;
  shopId: string;
  credentialRef: string;
  authSchemaVerificationId: string;
  structuredMappingId: string;
  runtimeVerificationId: string;
  authorizationEndpoint: string;
  requestMethod: 'GET' | 'POST';
  redirectUriPreview: string | null;
  redirectUriSource: 'BACKEND_ENV';
  timestampPreview: number;
  signatureImplementation: 'HMAC_SHA256_HEX' | 'HMAC_SHA256_BASE64';
  signatureBaseSerialization: 'CONCAT_NO_SEPARATOR' | 'COLON_SEPARATOR';
  signatureComponentRoles: string[];
  signatureGenerated: boolean;
  signatureLength: number | null;
  signatureValueReturned: false;
  signatureBaseReturned: false;
  partnerIdValueReturned: false;
  partnerKeyValueReturned: false;
  secretValuesReturned: false;
  authorizationUrlReturned: false;
  runtimeConfigState: {
    partnerIdConfigured: boolean;
    partnerKeyConfigured: boolean;
    redirectUriConfigured: boolean;
    complete: boolean;
  };
  unresolvedComponents: string[];
  queryTemplate: Array<{ role: string; fieldName: string; valueSource: string }>;
  callbackTemplate: { authorizationCodeField: string; shopIdField: string };
  canPrepareSignedAuthorizationRequest: boolean;
  canStartAuthorization: false;
  canReceiveAuthorizationCallback: false;
  canExchangeToken: false;
  sendAllowed: false;
  networkAction: 'NONE';
  externalWritePerformed: false;
  requiresSeparateExecutionApproval: true;
  blockingReasons: string[];
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function requireFetch(fetchImpl?: FetchLike): FetchLike {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (typeof resolved !== 'function') {
    throw <BackendSafeError>{ success: false, errorCode: 'FETCH_UNAVAILABLE', error: 'バックエンド通信を利用できません。' };
  }
  return resolved.bind(globalThis) as FetchLike;
}

function normalizeCredentialRef(value: string): string {
  const credentialRef = value.trim();
  if (!/^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(credentialRef)) {
    throw <BackendSafeError>{
      success: false,
      errorCode: 'INVALID_SHOPEE_CREDENTIAL_REF',
      error: '認証情報参照名は SHOPEE_SG_MAIN のような形式にしてください。'
    };
  }
  return credentialRef;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw <BackendSafeError>{
      success: false,
      errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : undefined,
      error: typeof payload.error === 'string' ? payload.error : `Shopee SG signing preview failed with HTTP ${response.status}.`,
      httpStatus: response.status,
      externalWritePerformed: payload.externalWritePerformed === true
    };
  }
  return payload as T;
}

function safeInventorySchema(record: ShopeeSgApiSchemaVerificationRecord) {
  return {
    verificationId: record.verificationId,
    status: record.status,
    officialSourceUrl: record.officialSourceUrl,
    checkedAt: record.checkedAt,
    externalWriteAllowed: record.externalWriteAllowed
  };
}

function safeAuthSchema(record: ShopeeSgAuthSchemaVerificationRecord) {
  return {
    verificationId: record.verificationId,
    status: record.status,
    officialSourceUrl: record.officialSourceUrl,
    authorizationEndpoint: record.authorizationEndpoint,
    checkedAt: record.checkedAt,
    currentSingaporeApplicabilityConfirmed: record.currentSingaporeApplicabilityConfirmed,
    externalNetworkAllowed: record.externalNetworkAllowed,
    externalWriteAllowed: record.externalWriteAllowed,
    secretsStored: record.secretsStored
  };
}

function safeStructuredMapping(record: ShopeeSgStructuredAuthMappingRecord) {
  return {
    mappingId: record.mappingId,
    marketplaceRegion: record.marketplaceRegion,
    status: record.status,
    authSchemaVerificationId: record.authSchemaVerificationId,
    officialSourceUrl: record.officialSourceUrl,
    authorizationEndpoint: record.authorizationEndpoint,
    authorizationHttpMethod: record.authorizationHttpMethod,
    authorizationQueryFieldNames: record.authorizationQueryFieldNames,
    authorizationQueryOrder: record.authorizationQueryOrder,
    signatureAlgorithm: record.signatureAlgorithm,
    signatureBaseComponents: record.signatureBaseComponents,
    callbackFieldNames: record.callbackFieldNames,
    checkedAt: record.checkedAt,
    currentSingaporeApplicabilityConfirmed: record.currentSingaporeApplicabilityConfirmed,
    externalNetworkAllowed: record.externalNetworkAllowed,
    externalWriteAllowed: record.externalWriteAllowed,
    secretsStored: record.secretsStored
  };
}

function safeRuntime(record: ShopeeSgAuthorizationSigningRuntimeRecord) {
  return {
    runtimeVerificationId: record.runtimeVerificationId,
    marketplaceRegion: record.marketplaceRegion,
    status: record.status,
    authSchemaVerificationId: record.authSchemaVerificationId,
    structuredMappingId: record.structuredMappingId,
    officialSourceUrl: record.officialSourceUrl,
    signatureAlgorithmLabel: record.signatureAlgorithmLabel,
    signatureImplementation: record.signatureImplementation,
    signatureBaseSerialization: record.signatureBaseSerialization,
    redirectUriSource: record.redirectUriSource,
    checkedAt: record.checkedAt,
    currentSingaporeApplicabilityConfirmed: record.currentSingaporeApplicabilityConfirmed,
    externalNetworkAllowed: record.externalNetworkAllowed,
    externalWriteAllowed: record.externalWriteAllowed,
    secretValuesStored: record.secretValuesStored
  };
}

export async function fetchShopeeSgAuthorizationSigningPreview(
  input: ShopeeSgAuthorizationSigningPreviewInput,
  baseUrl = getConfiguredBackendBaseUrl(),
  fetchImpl?: FetchLike
): Promise<ShopeeSgAuthorizationSigningPreviewResponse> {
  const accountId = input.accountId.trim();
  const shopId = input.shopId.trim();
  const credentialRef = normalizeCredentialRef(input.credentialRef);
  if (!accountId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_SHOPEE_ACCOUNT_ID', error: 'Shopee販売アカウントIDが必要です。' };
  if (!/^[1-9]\d*$/.test(shopId)) throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_SHOP_ID', error: 'Shopee Shop IDは正の整数IDで指定してください。' };

  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/shopee/sg/auth/authorization-request/signing-preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      accountId,
      shopId,
      credentialRef,
      schemaVerification: safeInventorySchema(input.schemaVerification),
      authSchemaVerification: safeAuthSchema(input.authSchemaVerification),
      structuredAuthorizationMapping: safeStructuredMapping(input.structuredAuthorizationMapping),
      signingRuntimeVerification: safeRuntime(input.signingRuntimeVerification)
    })
  });

  return parseJsonResponse<ShopeeSgAuthorizationSigningPreviewResponse>(response);
}
