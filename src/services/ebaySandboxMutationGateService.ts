import { EbaySandboxConnectionStatus } from './ebaySandboxBackendClient';
import { EbayOfficialPayloadPreview, EbayOfficialPayloadPreviewStep } from './ebayOfficialPayloadPreviewService';
import { EbaySandboxOAuthPlanRecord } from './ebaySandboxOAuthService';
import {
  EbaySandboxVerificationRecord,
  evaluateStoredEbaySandboxVerification
} from './ebaySandboxVerificationService';

const STORAGE_KEY = 'jp_ebay_sandbox_mutation_authorizations_v1';
export const EBAY_SANDBOX_MUTATION_AUTHORIZATION_CHANGED_EVENT = 'jp-ebay-sandbox-mutation-authorization-changed';
export const EBAY_SANDBOX_MUTATION_AUTHORIZATION_TTL_MS = 15 * 60 * 1000;

export type EbaySandboxMutationOperation = EbayOfficialPayloadPreviewStep['operationId'];

export interface EbaySandboxMutationApprovalInput {
  operationId: EbaySandboxMutationOperation;
  approvedBy: string;
  approvalReason: string;
  confirmedSandboxOnly: boolean;
  confirmedSellerAccountAndSku: boolean;
  confirmedPayloadPreview: boolean;
  confirmedMutationRisk: boolean;
}

export interface EbaySandboxMutationAuthorizationRecord {
  authorizationId: string;
  environment: 'SANDBOX';
  sellerAccountId: string;
  sku: string;
  previewId: string;
  requestFingerprint: string;
  planId: string;
  credentialRef: string;
  verificationId: string;
  backendBaseUrl: string;
  operationId: EbaySandboxMutationOperation;
  operationOrder: 1 | 2 | 3;
  method: 'PUT' | 'POST';
  pathTemplate: string;
  stepFingerprint: string;
  approvedBy: string;
  approvalReason: string;
  confirmedSandboxOnly: true;
  confirmedSellerAccountAndSku: true;
  confirmedPayloadPreview: true;
  confirmedMutationRisk: true;
  approvedAt: string;
  expiresAt: string;
  oneTimeUse: true;
  executionTriggered: false;
  networkAction: 'NONE';
  status: 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED';
  backendStagingConsumed?: boolean;
  backendStagedAt?: string;
}

export interface EbaySandboxMutationGateEvaluation {
  canApprove: boolean;
  blockingReasonsJa: string[];
  warningsJa: string[];
  step?: EbayOfficialPayloadPreviewStep;
}

function normalize(value: string): string {
  return value.trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function normalizeBaseUrl(value: string): string {
  return normalize(value).replace(/\/+$/, '');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function shortFingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function fingerprintEbaySandboxMutationStep(step: EbayOfficialPayloadPreviewStep): string {
  return shortFingerprint({
    order: step.order,
    operationId: step.operationId,
    method: step.method,
    pathTemplate: step.pathTemplate,
    pathParameters: step.pathParameters,
    requestBody: step.requestBody,
    responseDependency: step.responseDependency ?? null
  });
}

export function loadEbaySandboxMutationAuthorizations(): EbaySandboxMutationAuthorizationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEbaySandboxMutationAuthorizations(records: EbaySandboxMutationAuthorizationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EBAY_SANDBOX_MUTATION_AUTHORIZATION_CHANGED_EVENT));
  }
}

export function findEbaySandboxMutationAuthorization(
  previewId: string,
  operationId: EbaySandboxMutationOperation,
  records: EbaySandboxMutationAuthorizationRecord[] = loadEbaySandboxMutationAuthorizations()
): EbaySandboxMutationAuthorizationRecord | undefined {
  return records.find((record) => record.previewId === previewId && record.operationId === operationId);
}

function dependencyBlockingReason(operationId: EbaySandboxMutationOperation): string | undefined {
  if (operationId === 'createOffer') {
    return 'createOfferはcreateOrReplaceInventoryItemのSandbox実行成功記録がまだ実装されていないため、現段階では許可できません。';
  }
  if (operationId === 'publishOffer') {
    return 'publishOfferはcreateOffer成功応答のofferIdと前工程成功記録が必要です。現段階では許可できません。';
  }
  return undefined;
}

export function evaluateEbaySandboxMutationApproval(
  preview: EbayOfficialPayloadPreview | undefined,
  plan: EbaySandboxOAuthPlanRecord | undefined,
  verification: EbaySandboxVerificationRecord | undefined,
  connection: EbaySandboxConnectionStatus | undefined,
  backendBaseUrl: string,
  input: EbaySandboxMutationApprovalInput
): EbaySandboxMutationGateEvaluation {
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];
  const step = preview?.steps.find((candidate) => candidate.operationId === input.operationId);

  if (!preview) blockingReasonsJa.push('eBay正式Payload Previewがありません。');
  if (!plan) blockingReasonsJa.push('Sandbox OAuth接続計画がありません。');
  if (!verification) blockingReasonsJa.push('Sandbox接続検証済み記録がありません。');
  if (!connection?.connected || !connection.account) blockingReasonsJa.push('現在のSandbox Token Vault接続を確認できません。');
  if (!normalize(backendBaseUrl)) blockingReasonsJa.push('バックエンドURLが未指定です。');
  if (!step) blockingReasonsJa.push('選択した変更操作がPayload Previewに存在しません。');

  if (preview) {
    if (preview.mode !== 'PAYLOAD_PREVIEW_ONLY' || preview.networkAction !== 'NONE' || preview.sendAllowed !== false) {
      blockingReasonsJa.push('Payload Previewが安全な送信禁止状態ではありません。');
    }
    if (preview.authenticationStatus !== 'NOT_ATTACHED') {
      blockingReasonsJa.push('Payload Previewへ認証情報を直接付与しないでください。');
    }
  }

  if (plan && preview && plan.sellerAccountId !== preview.sellerAccountIdExecutionContext) {
    blockingReasonsJa.push('OAuth接続計画とPayload Previewの販売アカウントが一致しません。');
  }

  if (verification && preview && verification.sellerAccountId !== preview.sellerAccountIdExecutionContext) {
    blockingReasonsJa.push('Sandbox接続検証記録とPayload Previewの販売アカウントが一致しません。');
  }

  if (verification && plan) {
    const verificationEvaluation = evaluateStoredEbaySandboxVerification(
      verification,
      plan,
      connection,
      backendBaseUrl
    );
    blockingReasonsJa.push(...verificationEvaluation.reasonsJa);
  }

  const dependencyReason = dependencyBlockingReason(input.operationId);
  if (dependencyReason) blockingReasonsJa.push(dependencyReason);

  if (!normalize(input.approvedBy)) blockingReasonsJa.push('承認者が未入力です。');
  if (!normalize(input.approvalReason)) blockingReasonsJa.push('実行許可理由が未入力です。');
  if (!input.confirmedSandboxOnly) blockingReasonsJa.push('Sandbox専用であることの確認が必要です。');
  if (!input.confirmedSellerAccountAndSku) blockingReasonsJa.push('販売アカウントとSKUの確認が必要です。');
  if (!input.confirmedPayloadPreview) blockingReasonsJa.push('送信予定Payloadの確認が必要です。');
  if (!input.confirmedMutationRisk) blockingReasonsJa.push('変更系APIであることと影響範囲の確認が必要です。');

  warningsJa.push('このゲートはSandbox変更操作への明示承認記録を作るだけで、API通信は実行しません。');
  warningsJa.push('承認記録は15分で失効し、Payload・OAuth接続計画・Sandbox検証記録・接続先が変われば再承認が必要です。');
  warningsJa.push('現段階で許可対象にできるのは最初のcreateOrReplaceInventoryItemだけです。createOffer / publishOfferは前工程成功記録の実装までBLOCKEDです。');
  warningsJa.push('承認記録は一度限りの実行を前提とし、Productionでは利用できません。');

  return {
    canApprove: blockingReasonsJa.length === 0,
    blockingReasonsJa: unique(blockingReasonsJa),
    warningsJa,
    step
  };
}

export function recordEbaySandboxMutationAuthorization(
  preview: EbayOfficialPayloadPreview | undefined,
  plan: EbaySandboxOAuthPlanRecord | undefined,
  verification: EbaySandboxVerificationRecord | undefined,
  connection: EbaySandboxConnectionStatus | undefined,
  backendBaseUrl: string,
  input: EbaySandboxMutationApprovalInput,
  records: EbaySandboxMutationAuthorizationRecord[] = loadEbaySandboxMutationAuthorizations(),
  now = Date.now()
): { success: boolean; record?: EbaySandboxMutationAuthorizationRecord; evaluation: EbaySandboxMutationGateEvaluation; messageJa: string } {
  const evaluation = evaluateEbaySandboxMutationApproval(preview, plan, verification, connection, backendBaseUrl, input);
  if (!evaluation.canApprove || !preview || !plan || !verification || !evaluation.step) {
    return {
      success: false,
      evaluation,
      messageJa: 'Sandbox変更操作の実行許可条件を満たしていないため、承認記録を作成していません。'
    };
  }

  const approvedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + EBAY_SANDBOX_MUTATION_AUTHORIZATION_TTL_MS).toISOString();
  const step = evaluation.step;
  const record: EbaySandboxMutationAuthorizationRecord = {
    authorizationId: `ebay_sandbox_mutation_auth_${preview.previewId}_${step.operationId}_${now}`,
    environment: 'SANDBOX',
    sellerAccountId: preview.sellerAccountIdExecutionContext,
    sku: preview.sku,
    previewId: preview.previewId,
    requestFingerprint: preview.requestFingerprint,
    planId: plan.planId,
    credentialRef: plan.backendCredentialRef,
    verificationId: verification.verificationId,
    backendBaseUrl: normalizeBaseUrl(backendBaseUrl),
    operationId: step.operationId,
    operationOrder: step.order,
    method: step.method,
    pathTemplate: step.pathTemplate,
    stepFingerprint: fingerprintEbaySandboxMutationStep(step),
    approvedBy: normalize(input.approvedBy),
    approvalReason: normalize(input.approvalReason),
    confirmedSandboxOnly: true,
    confirmedSellerAccountAndSku: true,
    confirmedPayloadPreview: true,
    confirmedMutationRisk: true,
    approvedAt,
    expiresAt,
    oneTimeUse: true,
    executionTriggered: false,
    networkAction: 'NONE',
    status: 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED',
    backendStagingConsumed: false
  };

  const next = records.filter(
    (existing) => !(existing.previewId === record.previewId && existing.operationId === record.operationId)
  );
  next.push(record);
  saveEbaySandboxMutationAuthorizations(next);

  return {
    success: true,
    record,
    evaluation,
    messageJa: 'Sandbox変更操作の実行許可を記録しました。API通信はまだ実行していません。'
  };
}

export function markEbaySandboxMutationAuthorizationBackendStaged(
  authorizationId: string,
  stagedAt: string,
  records: EbaySandboxMutationAuthorizationRecord[] = loadEbaySandboxMutationAuthorizations()
): { success: boolean; record?: EbaySandboxMutationAuthorizationRecord; messageJa: string } {
  const normalizedAuthorizationId = normalize(authorizationId);
  const index = records.findIndex((record) => record.authorizationId === normalizedAuthorizationId);
  if (index < 0) {
    return { success: false, messageJa: '対応するSandbox変更操作の承認記録が見つかりません。' };
  }
  if (!Number.isFinite(Date.parse(stagedAt))) {
    return { success: false, messageJa: 'バックエンド実行予約日時が不正です。' };
  }

  const updated: EbaySandboxMutationAuthorizationRecord = {
    ...records[index],
    backendStagingConsumed: true,
    backendStagedAt: new Date(stagedAt).toISOString()
  };
  const next = [...records];
  next[index] = updated;
  saveEbaySandboxMutationAuthorizations(next);
  return {
    success: true,
    record: updated,
    messageJa: '承認記録をバックエンド実行予約で消費済みとして更新しました。eBay API通信はまだ行っていません。'
  };
}

export function evaluateStoredEbaySandboxMutationAuthorization(
  record: EbaySandboxMutationAuthorizationRecord | undefined,
  preview: EbayOfficialPayloadPreview | undefined,
  plan: EbaySandboxOAuthPlanRecord | undefined,
  verification: EbaySandboxVerificationRecord | undefined,
  connection: EbaySandboxConnectionStatus | undefined,
  backendBaseUrl: string,
  now = Date.now()
): { validForExecution: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];
  if (!record) return { validForExecution: false, reasonsJa: ['Sandbox変更操作の実行許可記録がありません。'] };
  if (!preview) reasonsJa.push('現在のPayload Previewがありません。');
  if (!plan) reasonsJa.push('現在のSandbox OAuth接続計画がありません。');
  if (!verification) reasonsJa.push('現在のSandbox接続検証記録がありません。');
  if (!connection?.connected || !connection.account) reasonsJa.push('現在のSandbox Token Vault接続を確認できません。');

  if (record.environment !== 'SANDBOX') reasonsJa.push('Sandbox専用の実行許可記録ではありません。');
  if (record.status !== 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED') reasonsJa.push('実行待ち状態の承認記録ではありません。');
  if (record.networkAction !== 'NONE' || record.executionTriggered !== false) reasonsJa.push('承認記録が未実行の安全状態ではありません。');
  if (record.oneTimeUse !== true) reasonsJa.push('一度限り実行の承認記録ではありません。');
  if (record.backendStagingConsumed === true) reasonsJa.push('この承認記録はバックエンド実行予約で既に消費済みです。');
  if (!Number.isFinite(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) <= now) reasonsJa.push('Sandbox変更操作の実行許可が失効しています。');
  if (dependencyBlockingReason(record.operationId)) reasonsJa.push(dependencyBlockingReason(record.operationId)!);

  if (preview) {
    const step = preview.steps.find((candidate) => candidate.operationId === record.operationId);
    if (record.previewId !== preview.previewId) reasonsJa.push('Payload Previewが承認時から変更されています。');
    if (record.requestFingerprint !== preview.requestFingerprint) reasonsJa.push('送信予定内容が承認時から変更されています。');
    if (record.sellerAccountId !== preview.sellerAccountIdExecutionContext) reasonsJa.push('販売アカウントが承認時から変更されています。');
    if (record.sku !== preview.sku) reasonsJa.push('SKUが承認時から変更されています。');
    if (!step) reasonsJa.push('承認対象の操作が現在のPayload Previewにありません。');
    else if (record.stepFingerprint !== fingerprintEbaySandboxMutationStep(step)) reasonsJa.push('承認対象のAPI Step内容が承認時から変更されています。');
  }

  if (plan) {
    if (record.planId !== plan.planId) reasonsJa.push('OAuth接続計画が承認時から変更されています。');
    if (record.credentialRef !== plan.backendCredentialRef) reasonsJa.push('認証情報参照名が承認時から変更されています。');
  }

  if (verification) {
    if (record.verificationId !== verification.verificationId) reasonsJa.push('Sandbox接続検証記録が承認時から変更されています。');
    if (record.backendBaseUrl !== normalizeBaseUrl(backendBaseUrl)) reasonsJa.push('バックエンドURLが承認時から変更されています。');
    if (plan) {
      const verificationEvaluation = evaluateStoredEbaySandboxVerification(
        verification,
        plan,
        connection,
        backendBaseUrl
      );
      reasonsJa.push(...verificationEvaluation.reasonsJa);
    }
  }

  return { validForExecution: reasonsJa.length === 0, reasonsJa: unique(reasonsJa) };
}
