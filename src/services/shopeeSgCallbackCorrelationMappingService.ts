import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import type { ShopeeSgStructuredAuthMappingRecord } from './shopeeSgStructuredAuthMappingService';
import { isShopeeSgStructuredAuthMappingFresh } from './shopeeSgStructuredAuthMappingService';

const STORAGE_KEY = 'jp_shopee_sg_callback_correlation_mappings_v1';
export const SHOPEE_SG_CALLBACK_CORRELATION_CHANGED_EVENT = 'jp-shopee-sg-callback-correlation-changed';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type ShopeeSgCorrelationMode = 'OFFICIAL_ROUND_TRIP_FIELD' | 'NO_OFFICIAL_ROUND_TRIP_FIELD';
export type ShopeeSgCorrelationSignatureParticipation = 'NOT_INCLUDED' | 'INCLUDED_REQUIRES_MAPPING_UPDATE';

export interface ShopeeSgCallbackCorrelationMappingInput {
  authSchemaVerificationId: string;
  structuredMappingId: string;
  officialSourceUrl: string;
  correlationMode: ShopeeSgCorrelationMode;
  authorizationRequestFieldName: string;
  callbackFieldName: string;
  signatureParticipation: ShopeeSgCorrelationSignatureParticipation;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
}

export interface ShopeeSgCallbackCorrelationMappingRecord extends ShopeeSgCallbackCorrelationMappingInput {
  correlationMappingId: string;
  marketplaceRegion: 'SG';
  status: 'CALLBACK_CORRELATION_VERIFIED';
  safeSessionPreparationAllowed: boolean;
  externalNetworkAllowed: false;
  externalWriteAllowed: false;
  secretsStored: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgCallbackCorrelationMappingEvaluation {
  canRecord: boolean;
  safeSessionPreparationAllowed: boolean;
  normalized: ShopeeSgCallbackCorrelationMappingInput;
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

function isSafeWireFieldName(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalize(value));
}

function containsLikelySecretValue(value: string): boolean {
  return /(partner[ _-]?key|access[ _-]?token|refresh[ _-]?token|authorization[ _-]?code|client[ _-]?secret|secret)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i.test(value);
}

export function loadShopeeSgCallbackCorrelationMappings(): ShopeeSgCallbackCorrelationMappingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSgCallbackCorrelationMappings(records: ShopeeSgCallbackCorrelationMappingRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOPEE_SG_CALLBACK_CORRELATION_CHANGED_EVENT));
}

export function evaluateShopeeSgCallbackCorrelationMapping(
  input: ShopeeSgCallbackCorrelationMappingInput,
  structuredMapping: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): ShopeeSgCallbackCorrelationMappingEvaluation {
  const normalized: ShopeeSgCallbackCorrelationMappingInput = {
    authSchemaVerificationId: normalize(input.authSchemaVerificationId),
    structuredMappingId: normalize(input.structuredMappingId),
    officialSourceUrl: normalize(input.officialSourceUrl),
    correlationMode: input.correlationMode,
    authorizationRequestFieldName: normalize(input.authorizationRequestFieldName),
    callbackFieldName: normalize(input.callbackFieldName),
    signatureParticipation: input.signatureParticipation,
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
    if (normalized.structuredMappingId !== structuredMapping.mappingId) blockingReasons.push('現在のStructured Mapping IDへ紐付ける必要があります。');
    if (normalized.authSchemaVerificationId !== structuredMapping.authSchemaVerificationId) blockingReasons.push('Auth Schema verificationIdがStructured Mappingと一致しません。');
  }

  if (!isOfficialShopeeDocumentationUrl(normalized.officialSourceUrl)) blockingReasons.push('現在のShopee公式HTTPSドキュメントURLが必要です。');
  if (!['OFFICIAL_ROUND_TRIP_FIELD', 'NO_OFFICIAL_ROUND_TRIP_FIELD'].includes(normalized.correlationMode)) blockingReasons.push('Callback相関方式を公式本文から選択してください。');
  if (!['NOT_INCLUDED', 'INCLUDED_REQUIRES_MAPPING_UPDATE'].includes(normalized.signatureParticipation)) blockingReasons.push('相関値が署名baseに含まれるかを公式本文から確認してください。');

  if (normalized.correlationMode === 'OFFICIAL_ROUND_TRIP_FIELD') {
    if (!isSafeWireFieldName(normalized.authorizationRequestFieldName)) blockingReasons.push('認証Request側の相関wire field名が必要です。');
    if (!isSafeWireFieldName(normalized.callbackFieldName)) blockingReasons.push('Callback側の相関wire field名が必要です。');
  } else {
    if (normalized.authorizationRequestFieldName || normalized.callbackFieldName) blockingReasons.push('公式round-trip fieldなしの場合は相関wire field名を入力しないでください。');
  }

  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');
  const checkedAtMs = Date.parse(normalized.checkedAt);
  if (!normalized.checkedAt || !Number.isFinite(checkedAtMs)) blockingReasons.push('有効な確認日時が必要です。');
  else if (checkedAtMs > now + 5 * 60 * 1000) blockingReasons.push('未来時刻の確認記録は保存できません。');
  else if (now - checkedAtMs > MAX_AGE_MS) blockingReasons.push('90日以内の公式仕様確認記録が必要です。');

  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) blockingReasons.push('Shopee公式本文でCallback相関仕様を直接確認したチェックが必要です。');
  if (!normalized.currentSingaporeApplicabilityConfirmed) blockingReasons.push('現在のSingapore向け仕様として適用できることの明示確認が必要です。');
  if ([normalized.verificationNote, normalized.authorizationRequestFieldName, normalized.callbackFieldName].some(containsLikelySecretValue)) {
    blockingReasons.push('秘密値らしき文字列をCallback相関Mappingへ保存しないでください。');
  }

  const safeSessionPreparationAllowed =
    blockingReasons.length === 0 &&
    normalized.correlationMode === 'OFFICIAL_ROUND_TRIP_FIELD' &&
    normalized.signatureParticipation === 'NOT_INCLUDED';

  if (normalized.correlationMode === 'NO_OFFICIAL_ROUND_TRIP_FIELD') {
    warnings.push('公式round-trip相関fieldがない場合、この実装ではCSRF相関を推測せず認証Session準備をBLOCKします。');
  }
  if (normalized.signatureParticipation === 'INCLUDED_REQUIRES_MAPPING_UPDATE') {
    warnings.push('相関値が署名baseに含まれる場合、Structured Auth Mappingへ明示componentを追加するまで認証Session準備をBLOCKします。');
  }
  warnings.push('この記録だけではShopee認証画面への遷移・Callback受信・Token交換を許可しません。');

  return { canRecord: blockingReasons.length === 0, safeSessionPreparationAllowed, normalized, blockingReasons, warnings };
}

export function recordShopeeSgCallbackCorrelationMapping(
  input: ShopeeSgCallbackCorrelationMappingInput,
  structuredMapping: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): { success: boolean; record?: ShopeeSgCallbackCorrelationMappingRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgCallbackCorrelationMapping(input, structuredMapping, authSchema, now);
  if (!evaluation.canRecord) return { success: false, messageJa: 'Shopee SG Callback相関Mappingを保存できません。', blockingReasons: evaluation.blockingReasons };

  const timestamp = new Date(now).toISOString();
  const record: ShopeeSgCallbackCorrelationMappingRecord = {
    ...evaluation.normalized,
    correlationMappingId: `shopee_sg_callback_corr_${now}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'CALLBACK_CORRELATION_VERIFIED',
    safeSessionPreparationAllowed: evaluation.safeSessionPreparationAllowed,
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveShopeeSgCallbackCorrelationMappings([...loadShopeeSgCallbackCorrelationMappings(), record]);
  return {
    success: true,
    record,
    messageJa: evaluation.safeSessionPreparationAllowed
      ? 'Shopee SG Callback相関Mappingを保存しました。安全なSession準備条件を満たしていますが外部通信はまだ禁止です。'
      : 'Shopee SG Callback相関Mappingを保存しました。相関条件が不足するためSession準備はBLOCKのままです。',
    blockingReasons: []
  };
}

export function getLatestShopeeSgCallbackCorrelationMapping(
  structuredMappingId?: string,
  records = loadShopeeSgCallbackCorrelationMappings()
): ShopeeSgCallbackCorrelationMappingRecord | undefined {
  return [...records]
    .filter((record) => !structuredMappingId || record.structuredMappingId === structuredMappingId)
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgCallbackCorrelationMappingFresh(
  record: ShopeeSgCallbackCorrelationMappingRecord | undefined,
  structuredMapping: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): boolean {
  if (!record || !structuredMapping || !authSchema || record.status !== 'CALLBACK_CORRELATION_VERIFIED' ||
    record.marketplaceRegion !== 'SG' || record.externalNetworkAllowed !== false || record.externalWriteAllowed !== false ||
    record.secretsStored !== false || record.currentSingaporeApplicabilityConfirmed !== true ||
    record.structuredMappingId !== structuredMapping.mappingId || record.authSchemaVerificationId !== structuredMapping.authSchemaVerificationId ||
    !isShopeeSgStructuredAuthMappingFresh(structuredMapping, authSchema, now)) return false;
  const checkedAt = Date.parse(record.checkedAt);
  return Number.isFinite(checkedAt) && checkedAt <= now + 5 * 60 * 1000 && now - checkedAt <= MAX_AGE_MS;
}
