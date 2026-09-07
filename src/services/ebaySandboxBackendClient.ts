import type { CrossChannelInventorySyncRequest } from './crossChannelInventorySyncService';
import type { EbayOfficialPayloadPreviewStep } from './ebayOfficialPayloadPreviewService';
import type { EbaySandboxMutationAuthorizationRecord } from './ebaySandboxMutationGateService';

export const DEFAULT_BACKEND_BASE_URL = 'http://localhost:3001';

export interface BackendHealthStatus { status: string; database: string; timestamp: string; }
export interface BackendAccountMetadata { accountId: string; environment: string; connectionStatus: string; lastAuthDate: string | null; }

export interface EbaySandboxOAuthStartResponse {
  success: true; environment: 'Sandbox'; accountId: string; credentialRef: string;
  authorizationUrl: string; expiresAt: string; scope: string; networkAction: 'NONE'; secretValuesReturned: false;
}

export interface EbaySandboxVersionResponse {
  success: true; environment: 'Sandbox'; accountId: string; endpoint: '/sell/inventory/v1/getVersion';
  version: string | null; checkedAt: string; mutatingOperation: false; tokenReturnedToBrowser: false;
}

export interface EbaySandboxInventorySyncResponse {
  success: true;
  environment: 'Sandbox';
  requestId: string;
  sellerAccountId: string;
  sku: string;
  targetStock: number;
  updatedOfferIds: string[];
  operation: 'bulkUpdatePriceQuantity';
  endpoint: '/sell/inventory/v1/bulk_update_price_quantity';
  externalWritePerformed: true;
  verifiedByEbayResponse: true;
  tokenReturnedToBrowser: false;
  completedAt: string;
  message: string;
}

export interface EbaySandboxMutationStageResponse {
  success: true;
  environment: 'Sandbox';
  authorizationId: string;
  sellerAccountId: string;
  sku: string;
  marketplaceId: string;
  contentLanguage: string;
  operationId: 'createOrReplaceInventoryItem';
  stagedAt: string;
  expiresAt: string;
  status: 'STAGED_NOT_SENT';
  networkAction: 'NONE';
  externalWritePerformed: false;
  tokenReturnedToBrowser: false;
  message: string;
}

export interface EbaySandboxMutationStageStatusResponse {
  success: true;
  environment: 'Sandbox';
  authorizationId: string;
  sellerAccountId: string;
  sku: string;
  previewId: string;
  marketplaceId: string;
  contentLanguage: string;
  operationId: 'createOrReplaceInventoryItem';
  method: 'PUT';
  pathTemplate: '/sell/inventory/v1/inventory_item/{sku}';
  stagedAt: string;
  expiresAt: string;
  status: 'STAGED_NOT_SENT';
  networkAction: 'NONE';
  externalWritePerformed: false;
  tokenReturnedToBrowser: false;
}

export interface EbaySandboxMutationExecutionPreviewResponse {
  success: true;
  environment: 'Sandbox';
  authorizationId: string;
  sellerAccountId: string;
  sku: string;
  marketplaceId: string;
  contentLanguage: string;
  operationId: 'createOrReplaceInventoryItem';
  stageStatus: 'STAGED_NOT_SENT';
  stagedAt: string;
  stageExpiresAt: string;
  generatedAt: string;
  httpRequest: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
  };
  accessTokenState: { presentInBackendVault: true; expiresAt: string; };
  readyForExternalNetwork: boolean;
  blockingReasons: string[];
  networkAction: 'NONE';
  externalWritePerformed: false;
  tokenReturnedToBrowser: false;
  message: string;
}

export interface BackendSafeError {
  success: false;
  errorCode?: string;
  error: string;
  httpStatus?: number;
  externalWritePerformed?: boolean;
}
export interface EbaySandboxConnectionStatus { connected: boolean; account?: BackendAccountMetadata; }

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function trimTrailingSlash(value: string): string { return value.trim().replace(/\/+$/, ''); }

export function getConfiguredBackendBaseUrl(): string {
  const configured = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_BACKEND_BASE_URL;
  return trimTrailingSlash(configured || DEFAULT_BACKEND_BASE_URL);
}

export function isValidEbaySandboxCredentialRef(value: string): boolean { return /^[A-Z][A-Z0-9_]{2,80}$/.test(value.trim()); }

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error: BackendSafeError = {
      success: false,
      errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : undefined,
      error: typeof payload.error === 'string' ? payload.error : `Backend request failed with HTTP ${response.status}.`,
      httpStatus: response.status,
      externalWritePerformed: payload.externalWritePerformed === true
    };
    throw error;
  }
  return payload as T;
}

function requireFetch(fetchImpl?: FetchLike): FetchLike {
  const resolved = fetchImpl ?? globalThis.fetch;
  if (typeof resolved !== 'function') throw <BackendSafeError>{ success: false, errorCode: 'FETCH_UNAVAILABLE', error: 'Backend communication is unavailable in this runtime.' };
  return resolved.bind(globalThis) as FetchLike;
}

export async function fetchBackendHealth(baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<BackendHealthStatus> {
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/health`, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseJsonResponse<BackendHealthStatus>(response);
}

export async function fetchEbaySandboxConnectionStatus(accountId: string, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<EbaySandboxConnectionStatus> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_ACCOUNT_ID', error: '販売アカウントIDが未指定です。' };
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/accounts/status`, { method: 'GET', headers: { Accept: 'application/json' } });
  const payload = await parseJsonResponse<{ success: true; accounts: BackendAccountMetadata[] }>(response);
  const account = (payload.accounts || []).find((candidate) => candidate.accountId === normalizedAccountId && candidate.environment === 'Sandbox');
  return { connected: Boolean(account), account };
}

export async function startEbaySandboxOAuth(accountId: string, credentialRef: string, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<EbaySandboxOAuthStartResponse> {
  const normalizedAccountId = accountId.trim();
  const normalizedCredentialRef = credentialRef.trim();
  if (!normalizedAccountId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_ACCOUNT_ID', error: '販売アカウントIDが未指定です。' };
  if (!isValidEbaySandboxCredentialRef(normalizedCredentialRef)) throw <BackendSafeError>{ success: false, errorCode: 'INVALID_CREDENTIAL_REF', error: '認証情報参照名は EBAY_SANDBOX_MAIN のような英大文字・数字・アンダースコア形式にしてください。' };
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/ebay/sandbox/oauth/start`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ accountId: normalizedAccountId, credentialRef: normalizedCredentialRef })
  });
  return parseJsonResponse<EbaySandboxOAuthStartResponse>(response);
}

export async function verifyEbaySandboxInventoryVersion(accountId: string, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<EbaySandboxVersionResponse> {
  const normalizedAccountId = accountId.trim();
  if (!normalizedAccountId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_ACCOUNT_ID', error: '販売アカウントIDが未指定です。' };
  const url = new URL(`${trimTrailingSlash(baseUrl)}/api/ebay/sandbox/inventory/version`);
  url.searchParams.set('accountId', normalizedAccountId);
  const response = await requireFetch(fetchImpl)(url, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseJsonResponse<EbaySandboxVersionResponse>(response);
}

export async function executeEbaySandboxInventorySync(
  request: CrossChannelInventorySyncRequest,
  baseUrl = getConfiguredBackendBaseUrl(),
  fetchImpl?: FetchLike
): Promise<EbaySandboxInventorySyncResponse> {
  if (request.targetChannel !== 'eBay') {
    throw <BackendSafeError>{ success: false, errorCode: 'UNSUPPORTED_SYNC_CHANNEL', error: 'eBay Sandbox在庫同期ではeBay向け要求だけを実行できます。' };
  }
  if (!Number.isInteger(request.targetStock) || request.targetStock < 0) {
    throw <BackendSafeError>{ success: false, errorCode: 'INVALID_TARGET_STOCK', error: '反映予定在庫は0以上の整数である必要があります。' };
  }
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/ebay/sandbox/inventory/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ request })
  });
  return parseJsonResponse<EbaySandboxInventorySyncResponse>(response);
}

export async function stageEbaySandboxMutationAuthorization(
  authorization: EbaySandboxMutationAuthorizationRecord,
  step: EbayOfficialPayloadPreviewStep,
  baseUrl = getConfiguredBackendBaseUrl(),
  fetchImpl?: FetchLike
): Promise<EbaySandboxMutationStageResponse> {
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/ebay/sandbox/mutation/stage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ authorization, step })
  });
  return parseJsonResponse<EbaySandboxMutationStageResponse>(response);
}

export async function fetchEbaySandboxMutationStageStatus(authorizationId: string, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<EbaySandboxMutationStageStatusResponse> {
  const normalizedAuthorizationId = authorizationId.trim();
  if (!normalizedAuthorizationId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_AUTHORIZATION_ID', error: 'Sandbox変更操作のAuthorization IDが未指定です。' };
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/ebay/sandbox/mutation/stage/${encodeURIComponent(normalizedAuthorizationId)}`, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseJsonResponse<EbaySandboxMutationStageStatusResponse>(response);
}

export async function fetchEbaySandboxMutationExecutionPreview(authorizationId: string, baseUrl = getConfiguredBackendBaseUrl(), fetchImpl?: FetchLike): Promise<EbaySandboxMutationExecutionPreviewResponse> {
  const normalizedAuthorizationId = authorizationId.trim();
  if (!normalizedAuthorizationId) throw <BackendSafeError>{ success: false, errorCode: 'MISSING_AUTHORIZATION_ID', error: 'Sandbox変更操作のAuthorization IDが未指定です。' };
  const response = await requireFetch(fetchImpl)(`${trimTrailingSlash(baseUrl)}/api/ebay/sandbox/mutation/stage/${encodeURIComponent(normalizedAuthorizationId)}/execution-preview`, { method: 'GET', headers: { Accept: 'application/json' } });
  return parseJsonResponse<EbaySandboxMutationExecutionPreviewResponse>(response);
}

export function describeBackendError(error: unknown): string {
  if (error && typeof error === 'object' && 'error' in error && typeof (error as BackendSafeError).error === 'string') {
    const safe = error as BackendSafeError;
    return safe.errorCode ? `${safe.errorCode}: ${safe.error}` : safe.error;
  }
  if (error instanceof Error) return error.message;
  return 'バックエンド処理で不明なエラーが発生しました。';
}
