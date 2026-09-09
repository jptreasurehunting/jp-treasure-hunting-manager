import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredTokenMappingRecord } from './shopeeSgStructuredTokenMappingService';
import { isShopeeSgStructuredTokenMappingFresh } from './shopeeSgStructuredTokenMappingService';
import {
  SHOPEE_SG_SIGNATURE_BASE_SERIALIZATIONS,
  SHOPEE_SG_SIGNATURE_IMPLEMENTATIONS,
  type ShopeeSgSignatureBaseSerialization,
  type ShopeeSgSignatureImplementation
} from './shopeeSgAuthorizationSigningRuntimeService';

const STORAGE_KEY = 'jp_shopee_sg_token_exchange_runtime_verifications_v1';
export const SHOPEE_SG_TOKEN_EXCHANGE_RUNTIME_CHANGED_EVENT = 'jp-shopee-sg-token-exchange-runtime-changed';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export interface ShopeeSgTokenExchangeRuntimeInput {
  authSchemaVerificationId: string;
  tokenMappingId: string;
  officialSourceUrl: string;
  signatureAlgorithmLabel: string;
  signatureImplementation: ShopeeSgSignatureImplementation;
  signatureBaseSerialization: ShopeeSgSignatureBaseSerialization;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
}

export interface ShopeeSgTokenExchangeRuntimeRecord extends ShopeeSgTokenExchangeRuntimeInput {
  runtimeVerificationId: string;
  marketplaceRegion: 'SG';
  status: 'TOKEN_EXCHANGE_RUNTIME_VERIFIED';
  previewAllowed: true;
  tokenExchangeAllowed: false;
  externalNetworkAllowed: false;
  externalWriteAllowed: false;
  secretValuesStored: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgTokenExchangeRuntimeEvaluation {
  canRecord: boolean;
  normalized: ShopeeSgTokenExchangeRuntimeInput;
  blockingReasons: string[];
  warnings: string[];
}

function normalize(value: string): string { return String(value || '').trim(); }
function isOfficialShopeeDocumentationUrl(value: string): boolean {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch { return false; }
}
function containsLikelySecretValue(value: string): boolean {
  return /(partner[ _-]?key|access[ _-]?token|refresh[ _-]?token|authorization[ _-]?code|client[ _-]?secret|secret)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i.test(value);
}

export function loadShopeeSgTokenExchangeRuntimeRecords(): ShopeeSgTokenExchangeRuntimeRecord[] {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}
export function saveShopeeSgTokenExchangeRuntimeRecords(records: ShopeeSgTokenExchangeRuntimeRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOPEE_SG_TOKEN_EXCHANGE_RUNTIME_CHANGED_EVENT));
}

export function evaluateShopeeSgTokenExchangeRuntime(
  input: ShopeeSgTokenExchangeRuntimeInput,
  tokenMapping: ShopeeSgStructuredTokenMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): ShopeeSgTokenExchangeRuntimeEvaluation {
  const normalized: ShopeeSgTokenExchangeRuntimeInput = {
    authSchemaVerificationId: normalize(input.authSchemaVerificationId),
    tokenMappingId: normalize(input.tokenMappingId),
    officialSourceUrl: normalize(input.officialSourceUrl),
    signatureAlgorithmLabel: normalize(input.signatureAlgorithmLabel),
    signatureImplementation: input.signatureImplementation,
    signatureBaseSerialization: input.signatureBaseSerialization,
    checkedBy: normalize(input.checkedBy),
    checkedAt: normalize(input.checkedAt),
    verificationNote: normalize(input.verificationNote),
    officialDocumentationConfirmed: input.officialDocumentationConfirmed === true,
    currentSingaporeApplicabilityConfirmed: input.currentSingaporeApplicabilityConfirmed === true
  };
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!tokenMapping || !authSchema || !isShopeeSgStructuredTokenMappingFresh(tokenMapping, authSchema, now)) {
    blockingReasons.push('現在有効なShopee SG Structured Token Mappingが必要です。');
  } else {
    if (normalized.tokenMappingId !== tokenMapping.tokenMappingId) blockingReasons.push('Token Runtime確認は現在のToken Mapping IDへ紐付ける必要があります。');
    if (normalized.authSchemaVerificationId !== tokenMapping.authSchemaVerificationId) blockingReasons.push('Auth Schema verificationIdがToken Mappingと一致しません。');
    if (normalized.signatureAlgorithmLabel !== tokenMapping.signatureAlgorithm) blockingReasons.push('署名アルゴリズム表記はToken Mappingと完全一致させてください。');
  }
  if (!isOfficialShopeeDocumentationUrl(normalized.officialSourceUrl)) blockingReasons.push('現在のShopee公式HTTPSドキュメントURLが必要です。');
  if (!SHOPEE_SG_SIGNATURE_IMPLEMENTATIONS.includes(normalized.signatureImplementation)) blockingReasons.push('コードで明示対応した署名実装方式を選択してください。');
  if (!SHOPEE_SG_SIGNATURE_BASE_SERIALIZATIONS.includes(normalized.signatureBaseSerialization)) blockingReasons.push('コードで明示対応したbase string連結方式を選択してください。');
  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');
  const checkedAtMs = Date.parse(normalized.checkedAt);
  if (!normalized.checkedAt || !Number.isFinite(checkedAtMs)) blockingReasons.push('有効な確認日時が必要です。');
  else if (checkedAtMs > now + 5 * 60 * 1000) blockingReasons.push('未来時刻の確認記録は保存できません。');
  else if (now - checkedAtMs > MAX_AGE_MS) blockingReasons.push('Token Runtime確認は90日以内の公式確認記録が必要です。');
  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) blockingReasons.push('Shopee公式本文で署名実装方式・出力形式・連結方式を確認したチェックが必要です。');
  if (!normalized.currentSingaporeApplicabilityConfirmed) blockingReasons.push('現在のSingapore向け仕様として適用できることの確認が必要です。');
  if ([normalized.signatureAlgorithmLabel, normalized.verificationNote].some(containsLikelySecretValue)) blockingReasons.push('Partner Key、Token、Authorization Code等の秘密値らしき文字列を保存しないでください。');

  warnings.push('このRuntime確認は通信なしToken Request Previewだけを許可し、実Token交換やShopee通信は許可しません。');
  warnings.push('Partner Key・Authorization Code・Tokenの実値はlocalStorageへ保存しません。');
  return { canRecord: blockingReasons.length === 0, normalized, blockingReasons, warnings };
}

export function recordShopeeSgTokenExchangeRuntime(
  input: ShopeeSgTokenExchangeRuntimeInput,
  tokenMapping: ShopeeSgStructuredTokenMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): { success: boolean; record?: ShopeeSgTokenExchangeRuntimeRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgTokenExchangeRuntime(input, tokenMapping, authSchema, now);
  if (!evaluation.canRecord) return { success: false, messageJa: 'Shopee SG Token Exchange Runtime確認を保存できません。', blockingReasons: evaluation.blockingReasons };
  const timestamp = new Date(now).toISOString();
  const record: ShopeeSgTokenExchangeRuntimeRecord = {
    ...evaluation.normalized,
    runtimeVerificationId: `shopee_sg_token_runtime_${now}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'TOKEN_EXCHANGE_RUNTIME_VERIFIED',
    previewAllowed: true,
    tokenExchangeAllowed: false,
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretValuesStored: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveShopeeSgTokenExchangeRuntimeRecords([...loadShopeeSgTokenExchangeRuntimeRecords(), record]);
  return { success: true, record, messageJa: 'Shopee SG Token Exchange Runtime確認を保存しました。Previewのみ可能で、実Token交換はまだ無効です。', blockingReasons: [] };
}

export function getLatestShopeeSgTokenExchangeRuntime(tokenMappingId?: string, records = loadShopeeSgTokenExchangeRuntimeRecords()): ShopeeSgTokenExchangeRuntimeRecord | undefined {
  return [...records].filter((record) => !tokenMappingId || record.tokenMappingId === tokenMappingId).sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgTokenExchangeRuntimeFresh(
  record: ShopeeSgTokenExchangeRuntimeRecord | undefined,
  tokenMapping: ShopeeSgStructuredTokenMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): boolean {
  if (!record || !tokenMapping || !authSchema || record.status !== 'TOKEN_EXCHANGE_RUNTIME_VERIFIED' || record.marketplaceRegion !== 'SG' ||
    record.previewAllowed !== true || record.tokenExchangeAllowed !== false || record.externalNetworkAllowed !== false || record.externalWriteAllowed !== false || record.secretValuesStored !== false ||
    record.currentSingaporeApplicabilityConfirmed !== true || record.tokenMappingId !== tokenMapping.tokenMappingId || record.authSchemaVerificationId !== tokenMapping.authSchemaVerificationId ||
    record.signatureAlgorithmLabel !== tokenMapping.signatureAlgorithm || !isShopeeSgStructuredTokenMappingFresh(tokenMapping, authSchema, now)) return false;
  const checkedAt = Date.parse(record.checkedAt);
  return Number.isFinite(checkedAt) && checkedAt <= now + 5 * 60 * 1000 && now - checkedAt <= MAX_AGE_MS;
}
