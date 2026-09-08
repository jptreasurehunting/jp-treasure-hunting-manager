import type { ShopeeSgApiSchemaVerificationRecord } from './shopeeSgApiSchemaVerificationService';
import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import {
  BackendSafeError,
  getConfiguredBackendBaseUrl
} from './ebaySandboxBackendClient';

export interface ShopeeSgAuthReadinessInput {
  accountId: string;
  credentialRef: string;
  shopId: string;
  schemaVerification: ShopeeSgApiSchemaVerificationRecord;
  authSchemaVerification?: ShopeeSgAuthSchemaVerificationRecord;
}

export interface ShopeeSgAuthReadinessResponse {
  success: true;
  marketplace: 'Shopee';
  marketplaceRegion: 'SG';
  accountId: string;
  shopId: string;
  credentialRef: string;
  credentialState: {
    partnerIdConfigured: boolean;
    partnerKeyConfigured: boolean;
    credentialConfigured: boolean;
  };
  inventorySchemaVerificationId: string;
  inventorySchemaStatus: 'OFFICIAL_SCHEMA_VERIFIED';
  inventorySchemaCheckedAt: string;
  authSchemaVerificationId: string | null;
  authSchemaStatus: 'OFFICIAL_AUTH_SCHEMA_VERIFIED' | 'OFFICIAL_AUTH_SCHEMA_REVIEW_REQUIRED';
  authSchemaCheckedAt: string | null;
  networkFlagConfigured: boolean;
  canStartAuthorization: false;
  canExecuteApi: false;
  canWriteInventory: false;
  networkAction: 'NONE';
  externalWritePerformed: false;
  secretValuesReturned: false;
  blockingReasons: string[];
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function trimTrailingSlash(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function requireFetch(fetchImpl?: FetchLike): FetchLike {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (typeof resolved !== 'function') {
    throw <BackendSafeError>{
      success: false,
      errorCode: 'FETCH_UNAVAILABLE',
      error: 'バックエンド通信を利用できません。'
    };
  }
  return resolved.bind(globalThis) as FetchLike;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw <BackendSafeError>{
      success: false,
      errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : undefined,
      error: typeof payload.error === 'string'
        ? payload.error
        : `Shopee SG backend request failed with HTTP ${response.status}.`,
      httpStatus: response.status,
      externalWritePerformed: payload.externalWritePerformed === true
    };
  }
  return payload as T;
}

export function isValidShopeeSgCredentialRef(value: string): boolean {
  return /^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(value.trim());
}

function safeSchemaSnapshot(record: ShopeeSgApiSchemaVerificationRecord) {
  return {
    verificationId: record.verificationId,
    status: record.status,
    officialSourceUrl: record.officialSourceUrl,
    checkedAt: record.checkedAt,
    externalWriteAllowed: record.externalWriteAllowed
  };
}

function safeAuthSchemaSnapshot(record: ShopeeSgAuthSchemaVerificationRecord) {
  return {
    verificationId: record.verificationId,
    status: record.status,
    officialSourceUrl: record.officialSourceUrl,
    checkedAt: record.checkedAt,
    currentSingaporeApplicabilityConfirmed: record.currentSingaporeApplicabilityConfirmed,
    externalNetworkAllowed: record.externalNetworkAllowed,
    externalWriteAllowed: record.externalWriteAllowed,
    secretsStored: record.secretsStored
  };
}

export async function fetchShopeeSgAuthReadiness(
  input: ShopeeSgAuthReadinessInput,
  baseUrl = getConfiguredBackendBaseUrl(),
  fetchImpl?: FetchLike
): Promise<ShopeeSgAuthReadinessResponse> {
  const accountId = input.accountId.trim();
  const credentialRef = input.credentialRef.trim();
  const shopId = input.shopId.trim();

  if (!accountId) {
    throw <BackendSafeError>{ success: false, errorCode: 'MISSING_SHOPEE_ACCOUNT_ID', error: 'Shopee販売アカウントIDが未指定です。' };
  }
  if (!isValidShopeeSgCredentialRef(credentialRef)) {
    throw <BackendSafeError>{
      success: false,
      errorCode: 'INVALID_SHOPEE_CREDENTIAL_REF',
      error: '認証情報参照名は SHOPEE_SG_MAIN のような英大文字・数字・アンダースコア形式にしてください。'
    };
  }
  if (!/^[1-9]\d*$/.test(shopId)) {
    throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_SHOP_ID', error: 'Shopee Shop IDは正の整数IDで指定してください。' };
  }
  if (!input.schemaVerification) {
    throw <BackendSafeError>{ success: false, errorCode: 'INVALID_SHOPEE_SCHEMA_VERIFICATION', error: 'Shopee SG公式API Schema確認記録が必要です。' };
  }

  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/shopee/sg/auth/readiness`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      accountId,
      credentialRef,
      shopId,
      schemaVerification: safeSchemaSnapshot(input.schemaVerification),
      authSchemaVerification: input.authSchemaVerification
        ? safeAuthSchemaSnapshot(input.authSchemaVerification)
        : undefined
    })
  });

  return parseJsonResponse<ShopeeSgAuthReadinessResponse>(response);
}
