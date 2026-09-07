import { EbaySandboxConnectionStatus, EbaySandboxVersionResponse } from './ebaySandboxBackendClient';
import { EbaySandboxOAuthPlanRecord } from './ebaySandboxOAuthService';

const STORAGE_KEY = 'jp_ebay_sandbox_verifications_v1';
export const EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT = 'jp-ebay-sandbox-verification-changed';

export interface EbaySandboxVerificationRecord {
  verificationId: string;
  sellerAccountId: string;
  environment: 'SANDBOX';
  planId: string;
  credentialRef: string;
  backendBaseUrl: string;
  connectionLastAuthDate: string | null;
  inventoryApiVersion: string | null;
  verificationEndpoint: '/sell/inventory/v1/getVersion';
  verifiedAt: string;
  mutatingOperation: false;
  tokenReturnedToBrowser: false;
  status: 'SANDBOX_CONNECTION_VERIFIED';
}

export interface EbaySandboxVerificationEvaluation {
  valid: boolean;
  reasonsJa: string[];
}

function normalize(value: string): string {
  return value.trim();
}

function normalizeBaseUrl(value: string): string {
  return normalize(value).replace(/\/+$/, '');
}

function isValidDateTime(value: string | null | undefined): boolean {
  return Boolean(value) && Number.isFinite(Date.parse(String(value)));
}

export function loadEbaySandboxVerificationRecords(): EbaySandboxVerificationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEbaySandboxVerificationRecords(records: EbaySandboxVerificationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT));
  }
}

export function findEbaySandboxVerificationForAccount(
  sellerAccountId: string,
  records: EbaySandboxVerificationRecord[] = loadEbaySandboxVerificationRecords()
): EbaySandboxVerificationRecord | undefined {
  const normalizedAccountId = normalize(sellerAccountId);
  return records.find((record) => record.sellerAccountId === normalizedAccountId);
}

export function recordEbaySandboxVerification(
  plan: EbaySandboxOAuthPlanRecord,
  connection: EbaySandboxConnectionStatus,
  version: EbaySandboxVersionResponse,
  backendBaseUrl: string,
  records: EbaySandboxVerificationRecord[] = loadEbaySandboxVerificationRecords()
): { success: boolean; record?: EbaySandboxVerificationRecord; reasonsJa: string[] } {
  const reasonsJa: string[] = [];
  const account = connection.account;
  const normalizedBackendBaseUrl = normalizeBaseUrl(backendBaseUrl);

  if (!connection.connected || !account) reasonsJa.push('Sandbox Token Vault接続が確認できません。');
  if (plan.environment !== 'SANDBOX') reasonsJa.push('Sandbox用OAuth接続計画ではありません。');
  if (account && account.environment !== 'Sandbox') reasonsJa.push('接続状態がSandboxではありません。');
  if (account && account.accountId !== plan.sellerAccountId) reasonsJa.push('OAuth接続計画とToken Vaultの販売アカウントが一致しません。');
  if (version.environment !== 'Sandbox') reasonsJa.push('getVersion応答がSandboxではありません。');
  if (version.accountId !== plan.sellerAccountId) reasonsJa.push('getVersion応答の販売アカウントがOAuth接続計画と一致しません。');
  if (version.endpoint !== '/sell/inventory/v1/getVersion') reasonsJa.push('検証EndpointがgetVersionではありません。');
  if (version.mutatingOperation !== false) reasonsJa.push('非破壊確認ではない応答は検証済みとして保存できません。');
  if (version.tokenReturnedToBrowser !== false) reasonsJa.push('Tokenがブラウザへ返された応答は検証済みとして保存できません。');
  if (!isValidDateTime(version.checkedAt)) reasonsJa.push('getVersion確認日時が不正です。');
  if (!normalizedBackendBaseUrl) reasonsJa.push('バックエンドURLが未指定です。');

  if (reasonsJa.length > 0) {
    return { success: false, reasonsJa: Array.from(new Set(reasonsJa)) };
  }

  const record: EbaySandboxVerificationRecord = {
    verificationId: `ebay_sandbox_verified_${plan.sellerAccountId}_${Date.now()}`,
    sellerAccountId: plan.sellerAccountId,
    environment: 'SANDBOX',
    planId: plan.planId,
    credentialRef: plan.backendCredentialRef,
    backendBaseUrl: normalizedBackendBaseUrl,
    connectionLastAuthDate: account?.lastAuthDate ?? null,
    inventoryApiVersion: version.version,
    verificationEndpoint: '/sell/inventory/v1/getVersion',
    verifiedAt: new Date(version.checkedAt).toISOString(),
    mutatingOperation: false,
    tokenReturnedToBrowser: false,
    status: 'SANDBOX_CONNECTION_VERIFIED'
  };

  const next = records.filter((existing) => existing.sellerAccountId !== record.sellerAccountId);
  next.push(record);
  saveEbaySandboxVerificationRecords(next);
  return { success: true, record, reasonsJa: [] };
}

export function evaluateStoredEbaySandboxVerification(
  record: EbaySandboxVerificationRecord | undefined,
  plan: EbaySandboxOAuthPlanRecord | undefined,
  connection: EbaySandboxConnectionStatus | undefined,
  backendBaseUrl: string
): EbaySandboxVerificationEvaluation {
  const reasonsJa: string[] = [];
  if (!record) return { valid: false, reasonsJa: ['Sandbox接続検証記録がありません。'] };
  if (!plan) reasonsJa.push('現在のSandbox OAuth接続計画がありません。');
  if (!connection?.connected || !connection.account) reasonsJa.push('現在のSandbox Token Vault接続を確認できません。');

  if (record.environment !== 'SANDBOX' || record.status !== 'SANDBOX_CONNECTION_VERIFIED') {
    reasonsJa.push('保存済み記録がSandbox接続検証済み状態ではありません。');
  }
  if (record.verificationEndpoint !== '/sell/inventory/v1/getVersion' || record.mutatingOperation !== false) {
    reasonsJa.push('保存済み記録が非破壊getVersion確認ではありません。');
  }
  if (record.tokenReturnedToBrowser !== false) reasonsJa.push('保存済み記録がToken非返却条件を満たしていません。');
  if (!isValidDateTime(record.verifiedAt)) reasonsJa.push('保存済み検証日時が不正です。');
  if (record.backendBaseUrl !== normalizeBaseUrl(backendBaseUrl)) reasonsJa.push('バックエンドURLが検証時から変更されています。');

  if (plan) {
    if (record.sellerAccountId !== plan.sellerAccountId) reasonsJa.push('販売アカウントが検証時から変更されています。');
    if (record.planId !== plan.planId) reasonsJa.push('OAuth接続計画が検証時から変更されています。');
    if (record.credentialRef !== plan.backendCredentialRef) reasonsJa.push('認証情報参照名が検証時から変更されています。');
  }

  if (connection?.account) {
    if (connection.account.environment !== 'Sandbox') reasonsJa.push('現在の接続環境がSandboxではありません。');
    if (connection.account.accountId !== record.sellerAccountId) reasonsJa.push('現在のToken Vault接続先が検証済み販売アカウントと一致しません。');
    if ((connection.account.lastAuthDate ?? null) !== record.connectionLastAuthDate) {
      reasonsJa.push('OAuth認証記録が検証時から更新されています。getVersionを再確認してください。');
    }
  }

  return { valid: reasonsJa.length === 0, reasonsJa: Array.from(new Set(reasonsJa)) };
}
