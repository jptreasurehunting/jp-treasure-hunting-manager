import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import { isShopeeSgAuthSchemaVerificationFresh } from './shopeeSgAuthSchemaVerificationService';
import {
  SHOPEE_SG_SIGNATURE_COMPONENTS,
  type ShopeeSgSignatureComponent
} from './shopeeSgStructuredAuthMappingService';

const STORAGE_KEY = 'jp_shopee_sg_structured_token_mappings_v1';
export const SHOPEE_SG_STRUCTURED_TOKEN_MAPPING_CHANGED_EVENT = 'jp-shopee-sg-structured-token-mapping-changed';
const MAPPING_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type ShopeeSgTokenHttpMethod = 'POST';
export type ShopeeSgTokenBodyEncoding = 'JSON' | 'FORM_URLENCODED';
export type ShopeeSgTokenExpiryUnit = 'SECONDS' | 'MILLISECONDS';
export type ShopeeSgTokenQueryRole = 'PARTNER_ID_QUERY' | 'TIMESTAMP_QUERY' | 'SIGNATURE_QUERY';
export type ShopeeSgTokenBodyRole = 'AUTHORIZATION_CODE_BODY' | 'SHOP_ID_BODY' | 'PARTNER_ID_BODY';

export const SHOPEE_SG_TOKEN_QUERY_ROLES: readonly ShopeeSgTokenQueryRole[] = [
  'PARTNER_ID_QUERY', 'TIMESTAMP_QUERY', 'SIGNATURE_QUERY'
] as const;
export const SHOPEE_SG_TOKEN_BODY_ROLES: readonly ShopeeSgTokenBodyRole[] = [
  'AUTHORIZATION_CODE_BODY', 'SHOP_ID_BODY', 'PARTNER_ID_BODY'
] as const;

export interface ShopeeSgTokenQueryFieldNames {
  partnerId: string;
  timestamp: string;
  signature: string;
}

export interface ShopeeSgTokenBodyFieldNames {
  authorizationCode: string;
  shopId: string;
  partnerId: string;
}

export interface ShopeeSgTokenResponseFieldNames {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface ShopeeSgStructuredTokenMappingInput {
  authSchemaVerificationId: string;
  officialSourceUrl: string;
  tokenEndpoint: string;
  tokenHttpMethod: ShopeeSgTokenHttpMethod;
  tokenBodyEncoding: ShopeeSgTokenBodyEncoding;
  tokenQueryFieldNames: ShopeeSgTokenQueryFieldNames;
  tokenQueryOrder: ShopeeSgTokenQueryRole[];
  tokenBodyFieldNames: ShopeeSgTokenBodyFieldNames;
  tokenBodyRoles: ShopeeSgTokenBodyRole[];
  signatureAlgorithm: string;
  signatureBaseComponents: ShopeeSgSignatureComponent[];
  tokenResponseFieldNames: ShopeeSgTokenResponseFieldNames;
  expiresInUnit: ShopeeSgTokenExpiryUnit;
  allRequiredRequestFieldsRepresented: boolean;
  allRequiredResponseFieldsRepresented: boolean;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
}

export interface ShopeeSgStructuredTokenMappingRecord extends ShopeeSgStructuredTokenMappingInput {
  tokenMappingId: string;
  marketplaceRegion: 'SG';
  status: 'STRUCTURED_TOKEN_MAPPING_VERIFIED';
  tokenExchangeAllowed: false;
  externalNetworkAllowed: false;
  externalWriteAllowed: false;
  secretsStored: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgStructuredTokenMappingEvaluation {
  canRecord: boolean;
  normalized: ShopeeSgStructuredTokenMappingInput;
  blockingReasons: string[];
  warnings: string[];
}

function normalize(value: string): string { return String(value || '').trim(); }
function normalizeEndpoint(value: string): string {
  try {
    const url = new URL(normalize(value));
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return normalize(value);
  }
}
function isOfficialShopeeDocumentationUrl(value: string): boolean {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch { return false; }
}
function isShopeeServiceEndpoint(value: string): boolean {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (
      url.hostname === 'shopee.com' || url.hostname.endsWith('.shopee.com') ||
      url.hostname === 'shopeemobile.com' || url.hostname.endsWith('.shopeemobile.com')
    );
  } catch { return false; }
}
function isSafeWireFieldName(value: string): boolean { return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalize(value)); }
function hasDuplicate(values: string[]): boolean { return new Set(values).size !== values.length; }
function containsLikelySecretValue(value: string): boolean {
  return /(partner[ _-]?key|access[ _-]?token|refresh[ _-]?token|authorization[ _-]?code|client[ _-]?secret|secret)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i.test(value);
}
function normalizeSignatureComponents(values: ShopeeSgSignatureComponent[]): ShopeeSgSignatureComponent[] {
  return Array.isArray(values)
    ? values.map((value) => normalize(value).toUpperCase() as ShopeeSgSignatureComponent).filter(Boolean)
    : [];
}
function normalizeQueryRoles(values: ShopeeSgTokenQueryRole[]): ShopeeSgTokenQueryRole[] {
  return Array.isArray(values)
    ? values.map((value) => normalize(value).toUpperCase() as ShopeeSgTokenQueryRole).filter(Boolean)
    : [];
}
function normalizeBodyRoles(values: ShopeeSgTokenBodyRole[]): ShopeeSgTokenBodyRole[] {
  return Array.isArray(values)
    ? values.map((value) => normalize(value).toUpperCase() as ShopeeSgTokenBodyRole).filter(Boolean)
    : [];
}
function hasExactRoles<T extends string>(values: T[], allowedRoles: readonly T[]): boolean {
  if (values.length !== allowedRoles.length || hasDuplicate(values)) return false;
  const allowed = new Set<string>(allowedRoles);
  return values.every((value) => allowed.has(value));
}

export function loadShopeeSgStructuredTokenMappings(): ShopeeSgStructuredTokenMappingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveShopeeSgStructuredTokenMappings(records: ShopeeSgStructuredTokenMappingRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SHOPEE_SG_STRUCTURED_TOKEN_MAPPING_CHANGED_EVENT));
}

export function evaluateShopeeSgStructuredTokenMapping(
  input: ShopeeSgStructuredTokenMappingInput,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): ShopeeSgStructuredTokenMappingEvaluation {
  const normalized: ShopeeSgStructuredTokenMappingInput = {
    authSchemaVerificationId: normalize(input.authSchemaVerificationId),
    officialSourceUrl: normalize(input.officialSourceUrl),
    tokenEndpoint: normalize(input.tokenEndpoint),
    tokenHttpMethod: input.tokenHttpMethod,
    tokenBodyEncoding: input.tokenBodyEncoding,
    tokenQueryFieldNames: {
      partnerId: normalize(input.tokenQueryFieldNames?.partnerId),
      timestamp: normalize(input.tokenQueryFieldNames?.timestamp),
      signature: normalize(input.tokenQueryFieldNames?.signature)
    },
    tokenQueryOrder: normalizeQueryRoles(input.tokenQueryOrder),
    tokenBodyFieldNames: {
      authorizationCode: normalize(input.tokenBodyFieldNames?.authorizationCode),
      shopId: normalize(input.tokenBodyFieldNames?.shopId),
      partnerId: normalize(input.tokenBodyFieldNames?.partnerId)
    },
    tokenBodyRoles: normalizeBodyRoles(input.tokenBodyRoles),
    signatureAlgorithm: normalize(input.signatureAlgorithm),
    signatureBaseComponents: normalizeSignatureComponents(input.signatureBaseComponents),
    tokenResponseFieldNames: {
      accessToken: normalize(input.tokenResponseFieldNames?.accessToken),
      refreshToken: normalize(input.tokenResponseFieldNames?.refreshToken),
      expiresIn: normalize(input.tokenResponseFieldNames?.expiresIn)
    },
    expiresInUnit: input.expiresInUnit,
    allRequiredRequestFieldsRepresented: input.allRequiredRequestFieldsRepresented === true,
    allRequiredResponseFieldsRepresented: input.allRequiredResponseFieldsRepresented === true,
    checkedBy: normalize(input.checkedBy),
    checkedAt: normalize(input.checkedAt),
    verificationNote: normalize(input.verificationNote),
    officialDocumentationConfirmed: input.officialDocumentationConfirmed === true,
    currentSingaporeApplicabilityConfirmed: input.currentSingaporeApplicabilityConfirmed === true
  };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!authSchema || !isShopeeSgAuthSchemaVerificationFresh(authSchema, now)) {
    blockingReasons.push('90日以内の有効なShopee SG認証Schema確認記録が必要です。');
  } else {
    if (normalized.authSchemaVerificationId !== authSchema.verificationId) blockingReasons.push('Token Mappingは現在の認証Schema verificationIdへ紐付ける必要があります。');
    if (normalizeEndpoint(normalized.tokenEndpoint) !== normalizeEndpoint(authSchema.tokenEndpoint)) blockingReasons.push('Token Endpointが認証Schema確認記録と一致しません。');
    if (normalized.signatureAlgorithm !== normalize(authSchema.signatureAlgorithm)) blockingReasons.push('署名アルゴリズム名が認証Schema確認記録と一致しません。');
  }

  if (!isOfficialShopeeDocumentationUrl(normalized.officialSourceUrl)) blockingReasons.push('現在のShopee公式HTTPSドキュメントURLが必要です。');
  if (!isShopeeServiceEndpoint(normalized.tokenEndpoint)) blockingReasons.push('ShopeeのHTTPS Token Endpointが必要です。');
  if (normalized.tokenHttpMethod !== 'POST') blockingReasons.push('現在のToken交換実装契約は、公式本文でPOSTと確認できた場合だけ対応します。');
  if (!['JSON', 'FORM_URLENCODED'].includes(normalized.tokenBodyEncoding)) blockingReasons.push('Token Request body形式を公式本文からJSONまたはFORM_URLENCODEDとして確認してください。');

  const queryFields = Object.values(normalized.tokenQueryFieldNames);
  const bodyFields = Object.values(normalized.tokenBodyFieldNames);
  const responseFields = Object.values(normalized.tokenResponseFieldNames);
  if (queryFields.some((field) => !isSafeWireFieldName(field))) blockingReasons.push('Token Query項目名は安全なwire nameで入力してください。');
  if (bodyFields.some((field) => !isSafeWireFieldName(field))) blockingReasons.push('Token Body項目名は安全なwire nameで入力してください。');
  if (responseFields.some((field) => !isSafeWireFieldName(field))) blockingReasons.push('Token応答項目名は安全なwire nameで入力してください。');
  if (hasDuplicate(queryFields)) blockingReasons.push('Token Query内でwire項目名を重複指定できません。');
  if (hasDuplicate(bodyFields)) blockingReasons.push('Token Body内でwire項目名を重複指定できません。');
  if (hasDuplicate(responseFields)) blockingReasons.push('Token応答内でwire項目名を重複指定できません。');
  if (!hasExactRoles(normalized.tokenQueryOrder, SHOPEE_SG_TOKEN_QUERY_ROLES)) blockingReasons.push('Token Query順序は3役割を各1回ずつ、公式本文で確認した順に指定してください。');
  if (!hasExactRoles(normalized.tokenBodyRoles, SHOPEE_SG_TOKEN_BODY_ROLES)) blockingReasons.push('Token Bodyはauthorization code / shop ID / Partner IDの3役割を各1回ずつ明示してください。');

  if (!normalized.signatureAlgorithm || normalized.signatureAlgorithm.length > 80) blockingReasons.push('公式本文で確認した署名アルゴリズム名が必要です。');
  if (normalized.signatureBaseComponents.length < 1 || normalized.signatureBaseComponents.length > 8) blockingReasons.push('Token署名base stringの構成順を1〜8個で指定してください。');
  if (normalized.signatureBaseComponents.some((component) => !SHOPEE_SG_SIGNATURE_COMPONENTS.includes(component))) blockingReasons.push('未対応のToken署名componentがあります。推測せず対応を追加してください。');
  if (hasDuplicate(normalized.signatureBaseComponents)) blockingReasons.push('Token署名base componentを重複指定できません。');
  if (!['SECONDS', 'MILLISECONDS'].includes(normalized.expiresInUnit)) blockingReasons.push('Token有効期間の単位を公式本文から確認してください。');
  if (!normalized.allRequiredRequestFieldsRepresented) blockingReasons.push('公式Token Requestの必須項目をすべて構造化した明示確認が必要です。');
  if (!normalized.allRequiredResponseFieldsRepresented) blockingReasons.push('Token応答で必要な項目をすべて構造化した明示確認が必要です。');

  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');
  const checkedAtMs = Date.parse(normalized.checkedAt);
  if (!normalized.checkedAt || !Number.isFinite(checkedAtMs)) blockingReasons.push('有効な確認日時が必要です。');
  else if (checkedAtMs > now + 5 * 60 * 1000) blockingReasons.push('未来時刻の確認記録は保存できません。');
  else if (now - checkedAtMs > MAPPING_MAX_AGE_MS) blockingReasons.push('Token Mappingは90日以内に公式仕様を確認した記録だけ保存できます。');

  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) blockingReasons.push('Shopee公式Open Platform本文でToken交換項目を直接確認したチェックが必要です。');
  if (!normalized.currentSingaporeApplicabilityConfirmed) blockingReasons.push('現在のSingapore向け仕様として適用できることの確認が必要です。');

  const scanValues = [normalized.verificationNote, normalized.signatureAlgorithm, ...queryFields, ...bodyFields, ...responseFields];
  if (scanValues.some(containsLikelySecretValue)) blockingReasons.push('Partner Key、Token、Authorization Code等の秘密値らしき実値をToken Mappingへ保存しないでください。');

  warnings.push('このMappingはToken交換のwire構造を固定するだけで、Token取得やShopee通信を許可しません。');
  warnings.push('Authorization Code / Partner Key / Access Token / Refresh Tokenの実値は保存しません。');
  warnings.push('認証Schemaが変わった場合はverificationId不一致として再確認対象になります。');

  return { canRecord: blockingReasons.length === 0, normalized, blockingReasons, warnings };
}

export function recordShopeeSgStructuredTokenMapping(
  input: ShopeeSgStructuredTokenMappingInput,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): { success: boolean; record?: ShopeeSgStructuredTokenMappingRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgStructuredTokenMapping(input, authSchema, now);
  if (!evaluation.canRecord) return { success: false, messageJa: 'Shopee SG Structured Token Mappingを保存できません。', blockingReasons: evaluation.blockingReasons };

  const timestamp = new Date(now).toISOString();
  const record: ShopeeSgStructuredTokenMappingRecord = {
    ...evaluation.normalized,
    tokenMappingId: `shopee_sg_token_mapping_${now}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'STRUCTURED_TOKEN_MAPPING_VERIFIED',
    tokenExchangeAllowed: false,
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveShopeeSgStructuredTokenMappings([...loadShopeeSgStructuredTokenMappings(), record]);
  return { success: true, record, messageJa: 'Shopee SG Structured Token Mappingを保存しました。Token交換・外部通信はまだ無効です。', blockingReasons: [] };
}

export function getLatestShopeeSgStructuredTokenMapping(
  authSchemaVerificationId?: string,
  records = loadShopeeSgStructuredTokenMappings()
): ShopeeSgStructuredTokenMappingRecord | undefined {
  return [...records]
    .filter((record) => !authSchemaVerificationId || record.authSchemaVerificationId === authSchemaVerificationId)
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgStructuredTokenMappingFresh(
  record: ShopeeSgStructuredTokenMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): boolean {
  if (!record || !authSchema || record.status !== 'STRUCTURED_TOKEN_MAPPING_VERIFIED' || record.marketplaceRegion !== 'SG' ||
    record.tokenExchangeAllowed !== false || record.externalNetworkAllowed !== false || record.externalWriteAllowed !== false || record.secretsStored !== false ||
    record.currentSingaporeApplicabilityConfirmed !== true || record.authSchemaVerificationId !== authSchema.verificationId ||
    normalizeEndpoint(record.tokenEndpoint) !== normalizeEndpoint(authSchema.tokenEndpoint) || !isShopeeSgAuthSchemaVerificationFresh(authSchema, now)) return false;
  const checkedAt = Date.parse(record.checkedAt);
  return Number.isFinite(checkedAt) && checkedAt <= now + 5 * 60 * 1000 && now - checkedAt <= MAPPING_MAX_AGE_MS;
}
