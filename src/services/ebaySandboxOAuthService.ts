import { EbayOfficialPayloadPreview } from './ebayOfficialPayloadPreviewService';

const EBAY_SANDBOX_OAUTH_STORAGE_KEY = 'jp_ebay_sandbox_oauth_plans_v1';
export const EBAY_SANDBOX_OAUTH_CHANGED_EVENT = 'jp-ebay-sandbox-oauth-plan-changed';

export const EBAY_SANDBOX_AUTHORIZATION_ENDPOINT = 'https://auth.sandbox.ebay.com/oauth2/authorize';
export const EBAY_SANDBOX_TOKEN_ENDPOINT = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
export const EBAY_SANDBOX_API_BASE_URL = 'https://api.sandbox.ebay.com';
export const EBAY_INVENTORY_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.inventory';

export interface EbaySandboxOAuthPlanInput {
  clientId: string;
  ruName: string;
  sandboxUserAlias: string;
  backendCredentialRef: string;
  checkedAt: string;
  checkedBy: string;
  verificationNote: string;
}

export interface EbaySandboxOAuthPlanRecord extends EbaySandboxOAuthPlanInput {
  planId: string;
  sellerAccountId: string;
  environment: 'SANDBOX';
  authorizationFlow: 'AUTHORIZATION_CODE_GRANT';
  authorizationEndpoint: typeof EBAY_SANDBOX_AUTHORIZATION_ENDPOINT;
  tokenEndpoint: typeof EBAY_SANDBOX_TOKEN_ENDPOINT;
  apiBaseUrl: typeof EBAY_SANDBOX_API_BASE_URL;
  requiredScopes: [typeof EBAY_INVENTORY_SCOPE];
  consentUrl: string;
  nonMutatingVerificationEndpoint: string;
  secretStorage: 'BACKEND_ONLY_REQUIRED';
  clientSecretStored: false;
  authorizationCodeStored: false;
  accessTokenStored: false;
  refreshTokenStored: false;
  status: 'SANDBOX_OAUTH_PLAN_READY';
  networkAction: 'NONE';
  sendAllowed: false;
  savedAt: string;
}

export interface EbaySandboxOAuthPlanEvaluation {
  canSavePlan: boolean;
  missingOrInvalidFieldsJa: string[];
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface EbaySandboxExecutionReadiness {
  canStartUserConsent: boolean;
  canExecuteSandboxApi: false;
  blockingReasonsJa: string[];
  nextStepsJa: string[];
}

function normalize(value: string): string {
  return value.trim();
}

function isValidDateTime(value: string): boolean {
  return normalize(value).length > 0 && Number.isFinite(Date.parse(value));
}

export function isValidEbaySandboxBackendCredentialRef(value: string): boolean {
  return /^[A-Z][A-Z0-9_]{2,80}$/.test(normalize(value));
}

function containsLikelySecret(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.includes('client_secret=') || normalized.includes('access_token=') || normalized.includes('refresh_token=');
}

export function loadEbaySandboxOAuthPlans(): EbaySandboxOAuthPlanRecord[] {
  try {
    const raw = localStorage.getItem(EBAY_SANDBOX_OAUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEbaySandboxOAuthPlans(plans: EbaySandboxOAuthPlanRecord[]): void {
  localStorage.setItem(EBAY_SANDBOX_OAUTH_STORAGE_KEY, JSON.stringify(plans));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EBAY_SANDBOX_OAUTH_CHANGED_EVENT));
  }
}

export function buildEbaySandboxConsentUrl(clientId: string, ruName: string): string {
  const url = new URL(EBAY_SANDBOX_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', normalize(clientId));
  url.searchParams.set('redirect_uri', normalize(ruName));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', EBAY_INVENTORY_SCOPE);
  return url.toString();
}

export function evaluateEbaySandboxOAuthPlan(
  sellerAccountId: string,
  input: EbaySandboxOAuthPlanInput
): EbaySandboxOAuthPlanEvaluation {
  const missingOrInvalidFieldsJa: string[] = [];
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  if (!normalize(sellerAccountId)) blockingReasonsJa.push('販売アカウントIDが未指定です。');
  if (!normalize(input.clientId)) missingOrInvalidFieldsJa.push('Sandbox Client IDが未入力です。');
  if (!normalize(input.ruName)) missingOrInvalidFieldsJa.push('Sandbox OAuth RuNameが未入力です。');
  if (!normalize(input.sandboxUserAlias)) missingOrInvalidFieldsJa.push('Sandboxテストユーザー識別名が未入力です。');
  if (!normalize(input.backendCredentialRef)) {
    missingOrInvalidFieldsJa.push('バックエンド認証情報参照名が未入力です。');
  } else if (!isValidEbaySandboxBackendCredentialRef(input.backendCredentialRef)) {
    missingOrInvalidFieldsJa.push('バックエンド認証情報参照名は EBAY_SANDBOX_MAIN のような英大文字・数字・アンダースコア形式にしてください。');
  }
  if (!isValidDateTime(input.checkedAt)) missingOrInvalidFieldsJa.push('確認日時が未入力または不正です。');
  if (!normalize(input.checkedBy)) missingOrInvalidFieldsJa.push('確認者が未入力です。');
  if (!normalize(input.verificationNote)) missingOrInvalidFieldsJa.push('確認メモが未入力です。');

  const userControlledFields = [
    input.clientId,
    input.ruName,
    input.sandboxUserAlias,
    input.backendCredentialRef,
    input.verificationNote
  ];
  if (userControlledFields.some(containsLikelySecret)) {
    blockingReasonsJa.push('Client Secret・Access Token・Refresh Tokenらしき値をこの画面へ保存しないでください。');
  }

  warningsJa.push('eBayのSandboxとProductionは別のOAuth資格情報です。このPlanはSandbox専用です。');
  warningsJa.push('Inventory APIで販売者所有データを操作するため、User Access TokenのAuthorization Code Grantを前提にします。');
  warningsJa.push('Client Secret、認可コード、Access Token、Refresh TokenはブラウザlocalStorageへ保存せず、バックエンドのSecret Storeで扱う必要があります。');
  warningsJa.push('このPlanを保存してもOAuth認可画面を自動で開かず、eBay API通信も行いません。');

  return {
    canSavePlan: missingOrInvalidFieldsJa.length === 0 && blockingReasonsJa.length === 0,
    missingOrInvalidFieldsJa,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function recordEbaySandboxOAuthPlan(
  sellerAccountId: string,
  input: EbaySandboxOAuthPlanInput,
  plans: EbaySandboxOAuthPlanRecord[] = loadEbaySandboxOAuthPlans()
): { success: boolean; plan?: EbaySandboxOAuthPlanRecord; evaluation: EbaySandboxOAuthPlanEvaluation; messageJa: string } {
  const evaluation = evaluateEbaySandboxOAuthPlan(sellerAccountId, input);
  if (!evaluation.canSavePlan) {
    return {
      success: false,
      evaluation,
      messageJa: 'eBay Sandbox OAuth接続計画の必須情報が不足しているため保存していません。'
    };
  }

  const plan: EbaySandboxOAuthPlanRecord = {
    planId: `ebay_sandbox_oauth_${normalize(sellerAccountId)}_${Date.now()}`,
    sellerAccountId: normalize(sellerAccountId),
    environment: 'SANDBOX',
    authorizationFlow: 'AUTHORIZATION_CODE_GRANT',
    authorizationEndpoint: EBAY_SANDBOX_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: EBAY_SANDBOX_TOKEN_ENDPOINT,
    apiBaseUrl: EBAY_SANDBOX_API_BASE_URL,
    requiredScopes: [EBAY_INVENTORY_SCOPE],
    clientId: normalize(input.clientId),
    ruName: normalize(input.ruName),
    sandboxUserAlias: normalize(input.sandboxUserAlias),
    backendCredentialRef: normalize(input.backendCredentialRef),
    checkedAt: new Date(input.checkedAt).toISOString(),
    checkedBy: normalize(input.checkedBy),
    verificationNote: normalize(input.verificationNote),
    consentUrl: buildEbaySandboxConsentUrl(input.clientId, input.ruName),
    nonMutatingVerificationEndpoint: `${EBAY_SANDBOX_API_BASE_URL}/sell/inventory/v1/getVersion`,
    secretStorage: 'BACKEND_ONLY_REQUIRED',
    clientSecretStored: false,
    authorizationCodeStored: false,
    accessTokenStored: false,
    refreshTokenStored: false,
    status: 'SANDBOX_OAUTH_PLAN_READY',
    networkAction: 'NONE',
    sendAllowed: false,
    savedAt: new Date().toISOString()
  };

  const next = plans.filter((existing) => existing.sellerAccountId !== plan.sellerAccountId);
  next.push(plan);
  saveEbaySandboxOAuthPlans(next);

  return {
    success: true,
    plan,
    evaluation,
    messageJa: 'eBay Sandbox OAuth接続計画を保存しました。認証秘密情報・通信・出品は含まれていません。'
  };
}

export function evaluateStoredEbaySandboxOAuthPlan(
  plan: EbaySandboxOAuthPlanRecord,
  sellerAccountId: string
): { valid: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];
  if (plan.environment !== 'SANDBOX') reasonsJa.push('Sandbox用Planではありません。');
  if (plan.authorizationEndpoint !== EBAY_SANDBOX_AUTHORIZATION_ENDPOINT) reasonsJa.push('Sandbox認可Endpointが変更されています。');
  if (plan.tokenEndpoint !== EBAY_SANDBOX_TOKEN_ENDPOINT) reasonsJa.push('Sandbox Token Endpointが変更されています。');
  if (plan.apiBaseUrl !== EBAY_SANDBOX_API_BASE_URL) reasonsJa.push('Sandbox API Base URLが変更されています。');
  if (!plan.requiredScopes.includes(EBAY_INVENTORY_SCOPE)) reasonsJa.push('Inventory API書込Scopeが不足しています。');
  if (plan.sellerAccountId !== normalize(sellerAccountId)) reasonsJa.push('販売アカウントがOAuth接続計画と一致しません。');
  if (!isValidEbaySandboxBackendCredentialRef(plan.backendCredentialRef)) reasonsJa.push('バックエンド認証情報参照名が現在の接続形式と一致しません。');
  if (plan.networkAction !== 'NONE' || plan.sendAllowed !== false) reasonsJa.push('OAuth接続計画が安全な送信禁止状態ではありません。');
  if (plan.clientSecretStored || plan.authorizationCodeStored || plan.accessTokenStored || plan.refreshTokenStored) {
    reasonsJa.push('ブラウザ保存禁止の認証秘密情報がPlanへ含まれています。');
  }
  return { valid: reasonsJa.length === 0, reasonsJa: Array.from(new Set(reasonsJa)) };
}

export function evaluateEbaySandboxExecutionReadiness(
  preview: EbayOfficialPayloadPreview | undefined,
  plan: EbaySandboxOAuthPlanRecord | undefined
): EbaySandboxExecutionReadiness {
  const blockingReasonsJa: string[] = [];

  if (!preview) {
    blockingReasonsJa.push('eBay正式Payload Previewがありません。');
  } else {
    if (preview.mode !== 'PAYLOAD_PREVIEW_ONLY' || preview.networkAction !== 'NONE' || preview.sendAllowed !== false) {
      blockingReasonsJa.push('Payload Previewが安全な送信禁止状態ではありません。');
    }
    if (preview.authenticationStatus !== 'NOT_ATTACHED') {
      blockingReasonsJa.push('Previewへ認証情報を直接付与しないでください。');
    }
  }

  if (!plan) {
    blockingReasonsJa.push('販売アカウント用のSandbox OAuth接続計画がありません。');
  } else if (preview) {
    blockingReasonsJa.push(...evaluateStoredEbaySandboxOAuthPlan(plan, preview.sellerAccountIdExecutionContext).reasonsJa);
  }

  const canStartUserConsent = blockingReasonsJa.length === 0;
  const nextStepsJa = canStartUserConsent
    ? [
        'SandboxのeBayテストユーザーで認可画面を開き、ユーザー同意を完了する。',
        '返された認可コードは保存せず、バックエンドへ一度だけ渡す。',
        'バックエンドでClient Secretを使ってUser Access Token / Refresh Tokenへ交換し、Secret Storeへ保存する。',
        'User Access TokenでSandboxのgetVersionを実行し、認証とInventory API到達性を非破壊で確認する。'
      ]
    : ['不足条件を解消してからSandbox OAuth認可へ進む。'];

  return {
    canStartUserConsent,
    canExecuteSandboxApi: false,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    nextStepsJa
  };
}
