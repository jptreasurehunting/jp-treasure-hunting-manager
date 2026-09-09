import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredAuthMappingRecord } from './shopeeSgStructuredAuthMappingService';
import { isShopeeSgStructuredAuthMappingFresh } from './shopeeSgStructuredAuthMappingService';

const STORAGE_KEY = 'jp_shopee_sg_signing_runtime_verifications_v1';
export const SHOPEE_SG_SIGNING_RUNTIME_CHANGED_EVENT = 'jp-shopee-sg-signing-runtime-changed';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type ShopeeSgSignatureImplementation = 'HMAC_SHA256_HEX' | 'HMAC_SHA256_BASE64';
export type ShopeeSgSignatureBaseSerialization = 'CONCAT_NO_SEPARATOR' | 'COLON_SEPARATOR';

export const SHOPEE_SG_SIGNATURE_IMPLEMENTATIONS: readonly ShopeeSgSignatureImplementation[] = [
  'HMAC_SHA256_HEX',
  'HMAC_SHA256_BASE64'
] as const;

export const SHOPEE_SG_SIGNATURE_BASE_SERIALIZATIONS: readonly ShopeeSgSignatureBaseSerialization[] = [
  'CONCAT_NO_SEPARATOR',
  'COLON_SEPARATOR'
] as const;

export interface ShopeeSgAuthorizationSigningRuntimeInput {
  authSchemaVerificationId: string;
  structuredMappingId: string;
  officialSourceUrl: string;
  signatureAlgorithmLabel: string;
  signatureImplementation: ShopeeSgSignatureImplementation;
  signatureBaseSerialization: ShopeeSgSignatureBaseSerialization;
  redirectUriSource: 'BACKEND_ENV';
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
}

export interface ShopeeSgAuthorizationSigningRuntimeRecord extends ShopeeSgAuthorizationSigningRuntimeInput {
  runtimeVerificationId: string;
  marketplaceRegion: 'SG';
  status: 'SIGNING_RUNTIME_VERIFIED';
  externalNetworkAllowed: false;
  externalWriteAllowed: false;
  secretValuesStored: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgAuthorizationSigningRuntimeEvaluation {
  canRecord: boolean;
  normalized: ShopeeSgAuthorizationSigningRuntimeInput;
  blockingReasons: string[];
  warnings: string[];
}

function normalize(value: string): string {
  return String(value || '').trim();
}

function isOfficialShopeeDocumentationUrl(value: string): boolean {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch {
    return false;
  }
}

function containsLikelySecretValue(value: string): boolean {
  return /(partner[ _-]?key|access[ _-]?token|refresh[ _-]?token|authorization[ _-]?code|client[ _-]?secret|secret)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i.test(value);
}

export function loadShopeeSgAuthorizationSigningRuntimeRecords(): ShopeeSgAuthorizationSigningRuntimeRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSgAuthorizationSigningRuntimeRecords(records: ShopeeSgAuthorizationSigningRuntimeRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOPEE_SG_SIGNING_RUNTIME_CHANGED_EVENT));
  }
}

export function evaluateShopeeSgAuthorizationSigningRuntime(
  input: ShopeeSgAuthorizationSigningRuntimeInput,
  structuredMapping: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): ShopeeSgAuthorizationSigningRuntimeEvaluation {
  const normalized: ShopeeSgAuthorizationSigningRuntimeInput = {
    authSchemaVerificationId: normalize(input.authSchemaVerificationId),
    structuredMappingId: normalize(input.structuredMappingId),
    officialSourceUrl: normalize(input.officialSourceUrl),
    signatureAlgorithmLabel: normalize(input.signatureAlgorithmLabel),
    signatureImplementation: input.signatureImplementation,
    signatureBaseSerialization: input.signatureBaseSerialization,
    redirectUriSource: 'BACKEND_ENV',
    checkedBy: normalize(input.checkedBy),
    checkedAt: normalize(input.checkedAt),
    verificationNote: normalize(input.verificationNote),
    officialDocumentationConfirmed: input.officialDocumentationConfirmed === true,
    currentSingaporeApplicabilityConfirmed: input.currentSingaporeApplicabilityConfirmed === true
  };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!structuredMapping || !authSchema || !isShopeeSgStructuredAuthMappingFresh(structuredMapping, authSchema, now)) {
    blockingReasons.push('現在有効なShopee SG Structured Auth Mappingが必要です。');
  } else {
    if (normalized.structuredMappingId !== structuredMapping.mappingId) {
      blockingReasons.push('署名Runtime確認は現在のStructured Mapping IDへ紐付ける必要があります。');
    }
    if (normalized.authSchemaVerificationId !== structuredMapping.authSchemaVerificationId) {
      blockingReasons.push('署名Runtime確認のAuth Schema verificationIdがStructured Mappingと一致しません。');
    }
    if (normalized.signatureAlgorithmLabel !== structuredMapping.signatureAlgorithm) {
      blockingReasons.push('署名アルゴリズム表記はStructured Mappingで確認済みの表記と完全一致させてください。');
    }
  }

  if (!isOfficialShopeeDocumentationUrl(normalized.officialSourceUrl)) {
    blockingReasons.push('現在のShopee公式HTTPSドキュメントURLが必要です。');
  }
  if (!SHOPEE_SG_SIGNATURE_IMPLEMENTATIONS.includes(normalized.signatureImplementation)) {
    blockingReasons.push('署名実装方式はコードで明示対応した方式から選択してください。');
  }
  if (!SHOPEE_SG_SIGNATURE_BASE_SERIALIZATIONS.includes(normalized.signatureBaseSerialization)) {
    blockingReasons.push('base stringの連結方式はコードで明示対応した方式から選択してください。');
  }
  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');

  const checkedAtMs = Date.parse(normalized.checkedAt);
  if (!normalized.checkedAt || !Number.isFinite(checkedAtMs)) {
    blockingReasons.push('有効な確認日時が必要です。');
  } else if (checkedAtMs > now + 5 * 60 * 1000) {
    blockingReasons.push('未来時刻の確認記録は保存できません。');
  } else if (now - checkedAtMs > MAX_AGE_MS) {
    blockingReasons.push('署名Runtime確認は90日以内に公式仕様を確認した記録だけ保存できます。');
  }

  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) {
    blockingReasons.push('Shopee公式本文で署名実装方式・出力形式・base string連結方式を直接確認したチェックが必要です。');
  }
  if (!normalized.currentSingaporeApplicabilityConfirmed) {
    blockingReasons.push('現在のSingapore向け仕様として適用できることの明示確認が必要です。');
  }

  if ([normalized.signatureAlgorithmLabel, normalized.verificationNote].some(containsLikelySecretValue)) {
    blockingReasons.push('Partner Key、Token、Authorization Code等の秘密値らしき文字列を保存しないでください。');
  }

  warnings.push('この記録は署名計算方法を機械的に固定するだけで、Shopeeへの通信や認証開始を許可しません。');
  warnings.push('Redirect URIはBACKEND_ENVから取得し、Partner Key・Token等の秘密値はlocalStorageへ保存しません。');

  return { canRecord: blockingReasons.length === 0, normalized, blockingReasons, warnings };
}

export function recordShopeeSgAuthorizationSigningRuntime(
  input: ShopeeSgAuthorizationSigningRuntimeInput,
  structuredMapping: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): { success: boolean; record?: ShopeeSgAuthorizationSigningRuntimeRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgAuthorizationSigningRuntime(input, structuredMapping, authSchema, now);
  if (!evaluation.canRecord) {
    return {
      success: false,
      messageJa: 'Shopee SG署名Runtime確認を保存できません。',
      blockingReasons: evaluation.blockingReasons
    };
  }

  const timestamp = new Date(now).toISOString();
  const record: ShopeeSgAuthorizationSigningRuntimeRecord = {
    ...evaluation.normalized,
    runtimeVerificationId: `shopee_sg_sign_runtime_${now}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'SIGNING_RUNTIME_VERIFIED',
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretValuesStored: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const records = loadShopeeSgAuthorizationSigningRuntimeRecords();
  saveShopeeSgAuthorizationSigningRuntimeRecords([...records, record]);
  return {
    success: true,
    record,
    messageJa: 'Shopee SGの署名Runtime確認を保存しました。外部通信・認証開始は引き続き無効です。',
    blockingReasons: []
  };
}

export function getLatestShopeeSgAuthorizationSigningRuntime(
  structuredMappingId?: string,
  records = loadShopeeSgAuthorizationSigningRuntimeRecords()
): ShopeeSgAuthorizationSigningRuntimeRecord | undefined {
  return [...records]
    .filter((record) => !structuredMappingId || record.structuredMappingId === structuredMappingId)
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgAuthorizationSigningRuntimeFresh(
  record: ShopeeSgAuthorizationSigningRuntimeRecord | undefined,
  structuredMapping: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): boolean {
  if (
    !record ||
    !structuredMapping ||
    !authSchema ||
    record.status !== 'SIGNING_RUNTIME_VERIFIED' ||
    record.marketplaceRegion !== 'SG' ||
    record.externalNetworkAllowed !== false ||
    record.externalWriteAllowed !== false ||
    record.secretValuesStored !== false ||
    record.currentSingaporeApplicabilityConfirmed !== true ||
    record.structuredMappingId !== structuredMapping.mappingId ||
    record.authSchemaVerificationId !== structuredMapping.authSchemaVerificationId ||
    record.signatureAlgorithmLabel !== structuredMapping.signatureAlgorithm ||
    !isShopeeSgStructuredAuthMappingFresh(structuredMapping, authSchema, now)
  ) return false;

  const checkedAt = Date.parse(record.checkedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now + 5 * 60 * 1000) return false;
  return now - checkedAt <= MAX_AGE_MS;
}
