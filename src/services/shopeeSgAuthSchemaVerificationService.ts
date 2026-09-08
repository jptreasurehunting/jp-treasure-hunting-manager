const STORAGE_KEY = 'jp_shopee_sg_auth_schema_verifications_v1';
export const SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT = 'jp-shopee-sg-auth-schema-verification-changed';

export interface ShopeeSgAuthSchemaVerificationInput {
  officialSourceUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  refreshTokenEndpoint: string;
  signatureAlgorithm: string;
  authorizationSignBaseRule: string;
  authenticatedApiSignBaseRule: string;
  callbackFields: string;
  tokenRequestFields: string;
  authenticatedRequestFields: string;
  timestampValidityRule: string;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
}

export interface ShopeeSgAuthSchemaVerificationRecord extends ShopeeSgAuthSchemaVerificationInput {
  verificationId: string;
  marketplaceRegion: 'SG';
  status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED';
  externalNetworkAllowed: false;
  externalWriteAllowed: false;
  secretsStored: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgAuthSchemaVerificationEvaluation {
  canRecord: boolean;
  normalized: ShopeeSgAuthSchemaVerificationInput;
  blockingReasons: string[];
  warnings: string[];
}

function normalize(value: string): string {
  return value.trim();
}

function isOfficialShopeeDocumentationUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch {
    return false;
  }
}

function isShopeeServiceEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (
      url.hostname.endsWith('.shopee.com') ||
      url.hostname === 'shopee.com' ||
      url.hostname.endsWith('.shopeemobile.com') ||
      url.hostname === 'shopeemobile.com'
    );
  } catch {
    return false;
  }
}

function containsLikelySecretValue(value: string): boolean {
  return /(partner[ _-]?key|access[ _-]?token|refresh[ _-]?token|client[ _-]?secret|secret)\s*[:=]\s*[A-Za-z0-9._~+\/-]{12,}/i.test(value);
}

export function loadShopeeSgAuthSchemaVerifications(): ShopeeSgAuthSchemaVerificationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSgAuthSchemaVerifications(records: ShopeeSgAuthSchemaVerificationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT));
  }
}

export function evaluateShopeeSgAuthSchemaVerification(
  input: ShopeeSgAuthSchemaVerificationInput
): ShopeeSgAuthSchemaVerificationEvaluation {
  const normalized: ShopeeSgAuthSchemaVerificationInput = {
    officialSourceUrl: normalize(input.officialSourceUrl),
    authorizationEndpoint: normalize(input.authorizationEndpoint),
    tokenEndpoint: normalize(input.tokenEndpoint),
    refreshTokenEndpoint: normalize(input.refreshTokenEndpoint),
    signatureAlgorithm: normalize(input.signatureAlgorithm),
    authorizationSignBaseRule: normalize(input.authorizationSignBaseRule),
    authenticatedApiSignBaseRule: normalize(input.authenticatedApiSignBaseRule),
    callbackFields: normalize(input.callbackFields),
    tokenRequestFields: normalize(input.tokenRequestFields),
    authenticatedRequestFields: normalize(input.authenticatedRequestFields),
    timestampValidityRule: normalize(input.timestampValidityRule),
    checkedBy: normalize(input.checkedBy),
    checkedAt: normalize(input.checkedAt),
    verificationNote: normalize(input.verificationNote),
    officialDocumentationConfirmed: input.officialDocumentationConfirmed === true,
    currentSingaporeApplicabilityConfirmed: input.currentSingaporeApplicabilityConfirmed === true
  };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!isOfficialShopeeDocumentationUrl(normalized.officialSourceUrl)) {
    blockingReasons.push('現在のShopee公式HTTPSドキュメントURLが必要です。');
  }
  if (!isShopeeServiceEndpoint(normalized.authorizationEndpoint)) {
    blockingReasons.push('公式本文で確認したShopee認証エンドポイントのHTTPS URLが必要です。');
  }
  if (!isShopeeServiceEndpoint(normalized.tokenEndpoint)) {
    blockingReasons.push('公式本文で確認したShopee Token取得エンドポイントのHTTPS URLが必要です。');
  }
  if (!isShopeeServiceEndpoint(normalized.refreshTokenEndpoint)) {
    blockingReasons.push('公式本文で確認したShopee Token更新エンドポイントのHTTPS URLが必要です。');
  }
  if (!normalized.signatureAlgorithm) blockingReasons.push('署名アルゴリズムの確認が必要です。');
  if (!normalized.authorizationSignBaseRule) blockingReasons.push('認証URL用署名のbase string構成ルールが必要です。');
  if (!normalized.authenticatedApiSignBaseRule) blockingReasons.push('認証済みAPI用署名のbase string構成ルールが必要です。');
  if (!normalized.callbackFields) blockingReasons.push('認証完了後にShopeeから返る項目名の確認が必要です。');
  if (!normalized.tokenRequestFields) blockingReasons.push('Token取得Requestの項目名の確認が必要です。');
  if (!normalized.authenticatedRequestFields) blockingReasons.push('認証済みAPI Requestの認証・署名項目名の確認が必要です。');
  if (!normalized.timestampValidityRule) blockingReasons.push('timestampの有効時間・同期要件の確認が必要です。');
  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');

  const checkedAtMs = Date.parse(normalized.checkedAt);
  if (!normalized.checkedAt || !Number.isFinite(checkedAtMs)) {
    blockingReasons.push('有効な確認日時が必要です。');
  } else if (checkedAtMs > Date.now() + 5 * 60 * 1000) {
    blockingReasons.push('未来時刻の確認記録は保存できません。');
  }

  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) {
    blockingReasons.push('Shopee公式Open Platform本文を直接確認した明示チェックが必要です。');
  }
  if (!normalized.currentSingaporeApplicabilityConfirmed) {
    blockingReasons.push('現在のSingapore向け仕様として適用できることの明示確認が必要です。');
  }

  const secretScanValues = [
    normalized.authorizationSignBaseRule,
    normalized.authenticatedApiSignBaseRule,
    normalized.callbackFields,
    normalized.tokenRequestFields,
    normalized.authenticatedRequestFields,
    normalized.timestampValidityRule,
    normalized.verificationNote
  ];
  if (secretScanValues.some(containsLikelySecretValue)) {
    blockingReasons.push('Partner Key、Access Token、Refresh Token等の秘密値らしき文字列を記録へ保存しないでください。');
  }

  warnings.push('認証Schema確認済み記録は、Shopeeへの通信許可・Token取得許可・在庫書込許可ではありません。');
  warnings.push('古い国別資料や第三者SDKだけでは現在のSingapore向け認証仕様の根拠にしません。');
  warnings.push('秘密値はバックエンドSecret Storeだけで管理し、この確認記録へ保存しません。');

  return { canRecord: blockingReasons.length === 0, normalized, blockingReasons, warnings };
}

export function recordShopeeSgAuthSchemaVerification(
  input: ShopeeSgAuthSchemaVerificationInput,
  now = new Date().toISOString()
): { success: boolean; record?: ShopeeSgAuthSchemaVerificationRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgAuthSchemaVerification(input);
  if (!evaluation.canRecord) {
    return {
      success: false,
      messageJa: 'Shopee SG認証Schema確認記録を保存できません。',
      blockingReasons: evaluation.blockingReasons
    };
  }

  const records = loadShopeeSgAuthSchemaVerifications();
  const timestamp = Number.isFinite(Date.parse(now)) ? new Date(now).toISOString() : new Date().toISOString();
  const record: ShopeeSgAuthSchemaVerificationRecord = {
    ...evaluation.normalized,
    verificationId: `shopee_sg_auth_schema_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    externalNetworkAllowed: false,
    externalWriteAllowed: false,
    secretsStored: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveShopeeSgAuthSchemaVerifications([...records, record]);

  return {
    success: true,
    record,
    messageJa: 'Shopee SGの公式認証Schema確認記録を保存しました。外部通信・Token取得・在庫書込は引き続き禁止です。',
    blockingReasons: []
  };
}

export function getLatestShopeeSgAuthSchemaVerification(
  records = loadShopeeSgAuthSchemaVerifications()
): ShopeeSgAuthSchemaVerificationRecord | undefined {
  return [...records].sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgAuthSchemaVerificationFresh(
  record: ShopeeSgAuthSchemaVerificationRecord | undefined,
  now = Date.now(),
  maxAgeDays = 90
): boolean {
  if (
    !record ||
    record.status !== 'OFFICIAL_AUTH_SCHEMA_VERIFIED' ||
    record.externalNetworkAllowed !== false ||
    record.externalWriteAllowed !== false ||
    record.secretsStored !== false ||
    record.currentSingaporeApplicabilityConfirmed !== true
  ) return false;

  const checkedAt = Date.parse(record.checkedAt);
  if (!Number.isFinite(checkedAt) || checkedAt > now + 5 * 60 * 1000) return false;
  return now - checkedAt <= maxAgeDays * 24 * 60 * 60 * 1000;
}
