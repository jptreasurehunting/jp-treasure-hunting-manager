const STORAGE_KEY = 'jp_shopee_sg_api_schema_verifications_v1';
export const SHOPEE_SG_SCHEMA_VERIFICATION_CHANGED_EVENT = 'jp-shopee-sg-schema-verification-changed';

export interface ShopeeSgApiSchemaVerificationInput {
  officialSourceUrl: string;
  endpointName: string;
  requestFields: string;
  authenticationFields: string;
  stockFieldSemantics: string;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
}

export interface ShopeeSgApiSchemaVerificationRecord extends ShopeeSgApiSchemaVerificationInput {
  verificationId: string;
  marketplaceRegion: 'SG';
  status: 'OFFICIAL_SCHEMA_VERIFIED';
  externalWriteAllowed: false;
  createdAt: string;
  updatedAt: string;
}

export interface ShopeeSgApiSchemaVerificationEvaluation {
  canRecord: boolean;
  normalized: ShopeeSgApiSchemaVerificationInput;
  blockingReasons: string[];
  warnings: string[];
}

function normalize(value: string): string {
  return value.trim();
}

function isOfficialShopeeUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch {
    return false;
  }
}

export function loadShopeeSgApiSchemaVerifications(): ShopeeSgApiSchemaVerificationRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveShopeeSgApiSchemaVerifications(records: ShopeeSgApiSchemaVerificationRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-100)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SHOPEE_SG_SCHEMA_VERIFICATION_CHANGED_EVENT));
  }
}

export function evaluateShopeeSgApiSchemaVerification(
  input: ShopeeSgApiSchemaVerificationInput
): ShopeeSgApiSchemaVerificationEvaluation {
  const normalized: ShopeeSgApiSchemaVerificationInput = {
    officialSourceUrl: normalize(input.officialSourceUrl),
    endpointName: normalize(input.endpointName),
    requestFields: normalize(input.requestFields),
    authenticationFields: normalize(input.authenticationFields),
    stockFieldSemantics: normalize(input.stockFieldSemantics),
    checkedBy: normalize(input.checkedBy),
    checkedAt: normalize(input.checkedAt),
    verificationNote: normalize(input.verificationNote),
    officialDocumentationConfirmed: input.officialDocumentationConfirmed === true
  };

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  if (!isOfficialShopeeUrl(normalized.officialSourceUrl)) blockingReasons.push('Shopee公式HTTPSドキュメントURLが必要です。');
  if (!normalized.endpointName) blockingReasons.push('在庫更新エンドポイント名が必要です。');
  if (!normalized.requestFields) blockingReasons.push('在庫更新Requestの必須項目一覧が必要です。');
  if (!normalized.authenticationFields) blockingReasons.push('認証・署名に必要な項目の確認が必要です。');
  if (!normalized.stockFieldSemantics) blockingReasons.push('在庫数フィールドが絶対値か差分値か、Model/Location単位かを確認してください。');
  if (!normalized.checkedBy) blockingReasons.push('確認者が必要です。');
  if (!normalized.checkedAt || !Number.isFinite(Date.parse(normalized.checkedAt))) blockingReasons.push('有効な確認日時が必要です。');
  if (!normalized.verificationNote) blockingReasons.push('確認メモが必要です。');
  if (!normalized.officialDocumentationConfirmed) blockingReasons.push('Shopee公式ドキュメント本文を確認した明示チェックが必要です。');

  warnings.push('Schema確認済み記録は外部書き込み許可ではありません。実送信には別の認証・権限・実行承認ゲートが必要です。');
  warnings.push('Partner Key、Secret、Access Tokenなどの秘密値はこの記録へ入力しないでください。');

  return { canRecord: blockingReasons.length === 0, normalized, blockingReasons, warnings };
}

export function recordShopeeSgApiSchemaVerification(
  input: ShopeeSgApiSchemaVerificationInput,
  now = new Date().toISOString()
): { success: boolean; record?: ShopeeSgApiSchemaVerificationRecord; messageJa: string; blockingReasons: string[] } {
  const evaluation = evaluateShopeeSgApiSchemaVerification(input);
  if (!evaluation.canRecord) {
    return {
      success: false,
      messageJa: 'Shopee SG API Schema確認記録を保存できません。',
      blockingReasons: evaluation.blockingReasons
    };
  }

  const records = loadShopeeSgApiSchemaVerifications();
  const timestamp = Number.isFinite(Date.parse(now)) ? new Date(now).toISOString() : new Date().toISOString();
  const record: ShopeeSgApiSchemaVerificationRecord = {
    ...evaluation.normalized,
    verificationId: `shopee_sg_schema_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    marketplaceRegion: 'SG',
    status: 'OFFICIAL_SCHEMA_VERIFIED',
    externalWriteAllowed: false,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  saveShopeeSgApiSchemaVerifications([...records, record]);

  return {
    success: true,
    record,
    messageJa: 'Shopee SGの公式API Schema確認記録を保存しました。外部在庫書き込みは引き続き禁止です。',
    blockingReasons: []
  };
}

export function getLatestShopeeSgApiSchemaVerification(
  records = loadShopeeSgApiSchemaVerifications()
): ShopeeSgApiSchemaVerificationRecord | undefined {
  return [...records].sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt))[0];
}

export function isShopeeSgSchemaVerificationFresh(
  record: ShopeeSgApiSchemaVerificationRecord | undefined,
  now = Date.now(),
  maxAgeDays = 90
): boolean {
  if (!record || record.status !== 'OFFICIAL_SCHEMA_VERIFIED' || record.externalWriteAllowed !== false) return false;
  const checkedAt = Date.parse(record.checkedAt);
  if (!Number.isFinite(checkedAt)) return false;
  return now - checkedAt <= maxAgeDays * 24 * 60 * 60 * 1000;
}
