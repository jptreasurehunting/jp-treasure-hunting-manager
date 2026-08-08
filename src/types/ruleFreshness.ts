import {
  KnowledgeAuthorityLevel,
  KnowledgeDomain,
  OperationalKnowledgeEntry
} from './operationalKnowledge';

export type RuleFreshnessGrade =
  | 'CURRENT' // 🟢 最新確認済み (Fresh & fully valid)
  | 'RECHECK_RECOMMENDED' // 🟡 再確認推奨 (Near expiration / non-critical stale)
  | 'REVALIDATION_REQUIRED' // 🟠 再確認が必要 (Stale critical rule / source modified)
  | 'INVALID_SUPERSEDED' // 🔴 旧ルール使用停止 (Revoked / superseded by official update)
  | 'UNREACHABLE_FALLBACK'; // ⚪ 公式情報を取得できません (Network / endpoint unreachable)

export type SourceProviderType =
  | 'official_api' // 公式API (eBay API, Zonos API)
  | 'official_structured_endpoint' // 公式構造化エンドポイント
  | 'official_policy_page' // 公式Web規約ページ
  | 'official_manual_pdf' // 公式サービスガイド / PDFマニュアル
  | 'admin_manual_verification'; // 管理者手動検証

export type SourceLiveStatus =
  | 'LIVE_VERIFIED' // リアル公式システムから直接ライブ検証
  | 'CACHED_OFFICIAL' // キャッシュされた公式文書
  | 'ADMIN_VERIFIED' // 管理者・専門スタッフ検証済み
  | 'SIMULATED' // シミュレーション検証
  | 'UNKNOWN'; // 未知 / 未取得

export type PolicyVolatility = 'volatile' | 'moderate' | 'stable';

export interface SourceProviderAdapter {
  providerId: string;
  providerName: string;
  providerType: SourceProviderType;
  carrierOrPlatform: string;
  officialDocUrl: string;
  liveStatus: SourceLiveStatus;
  volatility: PolicyVolatility;
  recheckIntervalDays: number; // e.g. 7, 30, 90, 180
  currentVersionHash: string;
  lastCheckedAt: string;
  isAvailable: boolean;
}

export interface SourceCheckResult {
  providerId: string;
  sourceUrlOrId: string;
  retrievalTimestamp: string;
  sourceVersionHash: string;
  detectedChangeStatus: 'UNCHANGED' | 'MODIFIED' | 'REVOKED' | 'UNREACHABLE';
  confidence: number;
  parseStatus: 'SUCCESS' | 'FAILED' | 'FALLBACK_CACHED';
  isLiveVerified: boolean;
  verificationBadge: string;
  rawExcerpt?: string;
  notesJa: string;
}

export interface RuleFreshnessEvaluation {
  knowledgeId: string;
  topic: string;
  domain: KnowledgeDomain;
  authorityLevel: KnowledgeAuthorityLevel;
  freshnessGrade: RuleFreshnessGrade;
  freshnessGradeLabelJa: string;
  isCriticalRule: boolean;
  policyVolatility: PolicyVolatility;
  lastVerifiedAt: string;
  daysSinceLastVerification: number;
  allowedFreshnessWindowDays: number;
  isActionBlocked: boolean;
  blockingReasonJa?: string;
  recommendedActionJa: string;
  sourceLiveStatus: SourceLiveStatus;
  sourceProvider?: SourceProviderAdapter;
  latestCheckResult?: SourceCheckResult;
  affectedModules: string[];
}

export interface ShippingDocumentFreshness {
  documentId: string; // e.g. 'doc_fedex_watch_worksheet', 'doc_tsca_neg_cert', 'doc_japanpost_lithium'
  documentNameJa: string;
  carrier: string;
  targetCategory: string;
  currentTemplateVersion: string;
  officialPublishedVersion: string;
  isTemplateCurrent: boolean;
  freshnessGrade: RuleFreshnessGrade;
  lastVerifiedDate: string;
  retirementDate?: string;
  affectedWorkflows: string[];
}

export interface PreActionFreshnessReport {
  actionName: string; // e.g. 'shipping_label_purchase', 'listing_publication', 'zonos_declaration'
  canProceed: boolean;
  isBlockedByStaleCriticalRule: boolean;
  criticalRulesChecked: number;
  staleRulesCount: number;
  freshRulesCount: number;
  evaluations: RuleFreshnessEvaluation[];
  blockingReasons: string[];
  safeAlternativeJa?: string;
}

export interface FreshnessAuditTrailEntry {
  id: string;
  timestamp: string;
  sourceId: string;
  providerName: string;
  previousVersionHash: string;
  newVersionHash: string;
  changeDetected: boolean;
  impactedKnowledgeIds: string[];
  impactedModules: string[];
  actionTakenJa: string;
}

export interface FreshnessDashboardMetrics {
  currentRulesCount: number;
  recheckRecommendedCount: number;
  revalidationRequiredCount: number;
  invalidBlockedCount: number;
  sourceProvidersActive: number;
  failedRetrievalsCount: number;
  staleShipmentInterceptions: number;
  liveVerifiedCount: number;
}
