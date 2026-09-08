import type { ShopeeSgAuthSchemaVerificationRecord } from './shopeeSgAuthSchemaVerificationService';
import { isShopeeSgAuthSchemaVerificationFresh } from './shopeeSgAuthSchemaVerificationService';

const STORAGE_KEY = 'jp_shopee_sg_structured_auth_mappings_v1';
export const SHOPEE_SG_STRUCTURED_AUTH_MAPPING_CHANGED_EVENT = 'jp-shopee-sg-structured-auth-mapping-changed';
const MAPPING_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

export type ShopeeSgAuthorizationHttpMethod = 'GET' | 'POST';
export type ShopeeSgAuthorizationQueryRole = 'PARTNER_ID' | 'TIMESTAMP' | 'SIGNATURE' | 'REDIRECT_URI';
export const SHOPEE_SG_AUTHORIZATION_QUERY_ROLES: readonly ShopeeSgAuthorizationQueryRole[] = [
  'PARTNER_ID', 'TIMESTAMP', 'SIGNATURE', 'REDIRECT_URI'
] as const;

export type ShopeeSgSignatureComponent =
  | 'PARTNER_ID'
  | 'API_PATH'
  | 'TIMESTAMP'
  | 'ACCESS_TOKEN'
  | 'SHOP_ID'
  | 'MERCHANT_ID'
  | 'REDIRECT_URI'
  | 'AUTHORIZATION_CODE';

export const SHOPEE_SG_SIGNATURE_COMPONENTS: readonly ShopeeSgSignatureComponent[] = [
  'PARTNER_ID',
  'API_PATH',
  'TIMESTAMP',
  'ACCESS_TOKEN',
  'SHOP_ID',
  'MERCHANT_ID',
  'REDIRECT_URI',
  'AUTHORIZATION_CODE'
] as const;

export interface ShopeeSgAuthorizationQueryFieldNames {
  partnerId: string;
  timestamp: string;
  signature: string;
  redirectUri: string;
}

export interface ShopeeSgAuthorizationCallbackFieldNames {
  authorizationCode: string;
  shopId: string;
}

export interface ShopeeSgStructuredAuthMappingInput {
  authSchemaVerificationId: string;
  officialSourceUrl: string;
  authorizationEndpoint: string;
  authorizationHttpMethod: ShopeeSgAuthorizationHttpMethod;
  authorizationQueryFieldNames: ShopeeSgAuthorizationQueryFieldNames;
  authorizationQueryOrder: ShopeeSgAuthorizationQueryRole[];
  signatureAlgorithm: string;
  signatureBaseComponents: ShopeeSgSignatureComponent[];
  callbackFieldNames: ShopeeSgAuthorizationCallbackFieldNames;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
}

export interface ShopeeSgStructuredAuthMappingRecord extends ShopeeSgStructuredAuthMappingInput {
  mappingId: string;
  marketplaceRegion: 'SG';
  status: 'STRUCTURED_AUTH_MAPPING_VERIFIED';
  externalNetworkAllowed: false;
  externalWriteAllowed: false;
  secretsStored: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgStructuredAuthMappingEvaluation {
  canRecord: boolean;
  normalized: ShopeeSgStructuredAuthMappingInput;
  blockingReasons: string[];
  warnings: string[];
}

function normalize(value: string): string {
  return String(value || '').trim();
}

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
  } catch {
    return false;
  }
}

function isShopeeServiceEndpoint(value: string): boolean {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (
      url.hostname === 'shopee.com' ||
      url.hostname.endsWith('.shopee.com') ||
      url.hostname === 'shopeemobile.com' ||
      url.hostname.endsWith('.shopeemobile.com')
    );
  } catch {
    return false;
  }
}

function isSafeWireFieldName(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value);
}

function containsLikelySecretValue(value: string): boolean {
  return /(partner[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret|secret)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i.test(value);
}

function normalizeSignatureComponents(values: ShopeeSgSignatureComponent[]): ShopeeSgSignatureComponent[] {
  return Array.isArray(values)
    ? values.map((value) => normalize(value).toUpperCase() as ShopeeSgSignatureComponent).filter(Boolean)
    : [];
}

function normalizeQueryRoles(values: ShopeeSgAuthorizationQueryRole[]): ShopeeSgAuthorizationQueryRole[] {
  return Array.isArray(values)
    ? values.map((value) => normalize(value).toUpperCase() as ShopeeSgAuthorizationQueryRole).filter(Boolean)
    : [];
}

function hasDuplicate(values: string[]): boolean {
  return new Set(values).size !== values.length;
}

function hasExactAuthorizationQueryRoles(values: ShopeeSgAuthorizationQueryRole[]): boolean {
  if (values.length !== SHOPEE_SG_AUTHORIZATION_QUERY_ROLES.length || hasDuplicate(values)) return false;
  const allowed = new Set(SHOPEE_SG_AUTHORIZATION_QUERY_ROLES);
  return values.every((value) => allowed.has(value));
}

export function loadShopeeSgStructuredAuthMappings(): ShopeeSgStructuredAuthMappingRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSgStructuredAuthMappings(records: ShopeeSgStructuredAuthMappingRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOPEE_SG_STRUCTURED_AUTH_MAPPING_CHANGED_EVENT));
  }
}

export function evaluateShopeeSgStructuredAuthMapping(
  input: ShopeeSgStructuredAuthMappingInput,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): ShopeeSgStructuredAuthMappingEvaluation {
  const normalized: ShopeeSgStructuredAuthMappingInput = {
    authSchemaVerificationId: normalize(input.authSchemaVerificationId),
    officialSourceUrl: normalize(input.officialSourceUrl),
    authorizationEndpoint: normalize(input.authorizationEndpoint),
    authorizationHttpMethod: input.authorizationHttpMethod,
    authorizationQueryFieldNames: {
      partnerId: normalize(input.authorizationQueryFieldNames?.partnerId),
      timestamp: normalize(input.authorizationQueryFieldNames?.timestamp),
      signature: normalize(input.authorizationQueryFieldNames?.signature),
      redirectUri: normalize(input.authorizationQueryFieldNames?.redirectUri)
    },
    authorizationQueryOrder: normalizeQueryRoles(input.authorizationQueryOrder),
    signatureAlgorithm: normalize(input.signatureAlgorithm),
    signatureBaseComponents: normalizeSignatureComponents(input.signatureBaseComponents),
    callbackFieldNames: {
      authorizationCode: normalize(input.callbackFieldNames?.authorizationCode),
      shopId: normalize(input.callbackFieldNames?.shopId)
    },
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
    if (normalized.authSchemaVerificationId !== authSchema.verificationId) {
      blockingReasons.push('Structured Mappingは現在の認証Schema確認記録と同じverificationIdに紐付ける必要があります。');
    }
    if (normalizeEndpoint(normalized.authorizationEndpoint) !== normalizeEndpoint(authSchema.authorizationEndpoint)) {
      blockingReasons.push('Structured Mappingの認証Endpointが認証Schema確認記録と一致しません。');
    }
  }

  if (!isOfficialShopeeDocumentationUrl(normalized.officialSourceUrl)) {
    blockingReasons.push('現在のShopee公式HTTPSドキュメントURLが必要です。');
  }
  if (!isShopeeServiceEndpoint(normalized.authorizationEndpoint)) {
    blockingReasons.push('ShopeeのHTTPS認証Endpointが必要です。');
  }
  if (normalized.authorizationHttpMethod !== 'GET' && normalized.authorizationHttpMethod !== 'POST') {
    blockingReasons.push('認証RequestのHTTP MethodはGETまたはPOSTとして公式本文から確認してください。');
  }

  const queryFields = Object.values(normalized.authorizationQueryFieldNames);
  if (queryFields.some((field) => !isSafeWireFieldName(field))) {
    blockingReasons.push('認証Query項目名は英数字とアンダースコアだけの安全なwire nameで入力してください。');
  }
  if (hasDuplicate(queryFields)) {
    blockingReasons.push('認証Queryの4つの役割に同じwire項目名を重複指定できません。');
  }
  if (!hasExactAuthorizationQueryRoles(normalized.authorizationQueryOrder)) {
    blockingReasons.push('認証Query順序はPARTNER_ID / TIMESTAMP / SIGNATURE / REDIRECT_URIの4役割を各1回ずつ、公式本文で確認した順に指定してください。');
  }

  if (!normalized.signatureAlgorithm || normalized.signatureAlgorithm.length > 80) {
    blockingReasons.push('公式本文で確認した署名アルゴリズム名が必要です。');
  }
  if (normalized.signatureBaseComponents.length < 1 || normalized.signatureBaseComponents.length > 8) {
    blockingReasons.push('署名base stringの構成順を1〜8個の構造化componentで指定してください。');
  }
  if (normalized.signatureBaseComponents.some((component) => !SHOPEE_SG_SIGNATURE_COMPONENTS.includes(component))) {
    blockingReasons.push('未対応の署名componentが含まれています。推測せず対応componentを追加してから記録してください。');
  }
  if (hasDuplicate(normalized.signatureBaseComponents)) {
    blockingReasons.push('署名base stringのcomponentを重複指定できません。');
  }

  const callbackFields = Object.values(normalized.callbackFieldNames);
  if (callbackFields.some((field) => !isSafeWireFieldName(field))) {
    blockingReasons.push('Callback項目名は英数字とアンダースコアだけの安全なwire nameで入力してください。');
  }
  if (hasDuplicate(callbackFields)) {
    blockingReasons.push('Callbackのauthorization codeとshop IDに同じwire項目名を指定できません。');
  }

  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');
  const checkedAtMs = Date.parse(normalized.checkedAt);
  if (!normalized.checkedAt || !Number.isFinite(checkedAtMs)) {
    blockingReasons.push('有効な確認日時が必要です。');
  } else if (checkedAtMs > now + 5 * 60 * 1000) {
    blockingReasons.push('未来時刻の確認記録は保存できません。');
  } else if (now - checkedAtMs > MAPPING_MAX_AGE_MS) {
    blockingReasons.push('Structured Mappingは90日以内に公式仕様を確認した記録だけ保存できます。');
  }

  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) {
    blockingReasons.push('Shopee公式Open Platform本文でwire項目名・順序を確認した明示チェックが必要です。');
  }
  if (!normalized.currentSingaporeApplicabilityConfirmed) {
    blockingReasons.push('現在のSingapore向け認証仕様として適用できることの明示確認が必要です。');
  }

  const secretScanValues = [
    normalized.signatureAlgorithm,
    normalized.verificationNote,
    ...queryFields,
    ...callbackFields
  ];
  if (secretScanValues.some(containsLikelySecretValue)) {
    blockingReasons.push('Partner Key、Access Token、Refresh Token等の秘密値らしき文字列をStructured Mappingへ保存しないでください。');
  }

  warnings.push('このMappingはwire項目名・Query順序・署名componentの構造を固定するだけで、Shopeeへの通信許可にはなりません。');
  warnings.push('Partner ID / Partner Key / Access Token等の実値は保存しません。');
  warnings.push('認証Schemaが更新された場合はverificationId不一致としてこのMappingを再確認対象にします。');

  return { canRecord: blockingReasons.length === 0, normalized, blockingReasons, warnings };
}

export function recordShopeeSgStructuredAuthMapping(
  input: ShopeeSgStructuredAuthMappingInput,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): { success: boolean; record?: ShopeeSgStructuredAuthMappingRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgStructuredAuthMapping(input, authSchema, now);
  if (!evaluation.canRecord) {
    return {
      success: false,
      messageJa: 'Shopee SG Structured Auth Mappingを保存できません。',
      blockingReasons: evaluation.blockingReasons
    };
  }

  const timestamp = new Date(now).toISOString();
  const record: ShopeeSgStructuredAuthMappingRecord = {
    ...evaluation.normalized,
    mappingId: `shopee_sg_auth_mapping_${now}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'STRUCTURED_AUTH_MAPPING_VERIFIED',
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const records = loadShopeeSgStructuredAuthMappings();
  saveShopeeSgStructuredAuthMappings([...records, record]);
  return {
    success: true,
    record,
    messageJa: 'Shopee SGのStructured Auth Mappingを保存しました。署名生成・外部通信・Token取得は引き続き無効です。',
    blockingReasons: []
  };
}

export function getLatestShopeeSgStructuredAuthMapping(
  authSchemaVerificationId?: string,
  records = loadShopeeSgStructuredAuthMappings()
): ShopeeSgStructuredAuthMappingRecord | undefined {
  return [...records]
    .filter((record) => !authSchemaVerificationId || record.authSchemaVerificationId === authSchemaVerificationId)
    .sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgStructuredAuthMappingFresh(
  record: ShopeeSgStructuredAuthMappingRecord | undefined,
  authSchema: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now()
): boolean {
  if (
    !record ||
    !authSchema ||
    record.status !== 'STRUCTURED_AUTH_MAPPING_VERIFIED' ||
    record.marketplaceRegion !== 'SG' ||
    record.externalNetworkAllowed !== false ||
    record.externalWriteAllowed !== false ||
    record.secretsStored !== false ||
    record.currentSingaporeApplicabilityConfirmed !== true ||
    record.authSchemaVerificationId !== authSchema.verificationId ||
    normalizeEndpoint(record.authorizationEndpoint) !== normalizeEndpoint(authSchema.authorizationEndpoint) ||
    !isShopeeSgAuthSchemaVerificationFresh(authSchema, now) ||
    !hasExactAuthorizationQueryRoles(record.authorizationQueryOrder)
  ) return false;

  const checkedAt = Date.parse(record.checkedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now + 5 * 60 * 1000) return false;
  return now - checkedAt <= MAPPING_MAX_AGE_MS;
}
