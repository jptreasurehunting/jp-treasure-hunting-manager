export type KnowledgeDomain =
  | 'shipping'
  | 'customs'
  | 'marketplace'
  | 'authenticity'
  | 'marketing_rights'
  | 'automation_policy'
  | 'carrier_compliance'
  | 'general_ec'
  | string;

export type KnowledgeAuthorityLevel =
  | 'A_OFFICIAL_API' // A. 公式API / 公式システムレスポンス
  | 'B_OFFICIAL_DOCUMENT' // B. 公式発行文書 / キャリア公式約款 / eBay公式ポリシー
  | 'C_ADMIN_APPROVED' // C. 管理者・専門スタッフ承認の解釈ポリシー
  | 'D_TRUSTED_INTERNAL_FACT' // D. 信頼できる社内業務事実 (自社撮影写真・実測重量等)
  | 'E_CACHED_KNOWLEDGE' // E. ローカルキャッシュされた過去の検証済みナレッジ
  | 'F_UNVERIFIED'; // F. 未検証情報 / AI単独推論

export type KnowledgeLifecycleStatus =
  | 'ACTIVE' // 🟢 有効
  | 'RECHECK_REQUIRED' // 🟡 要再確認 (鮮度切れ・ソース改定疑い)
  | 'PENDING_APPROVAL' // 🟠 承認待ち (管理者承認待ち)
  | 'INVALID' // 🔴 無効 (禁止事項・失効ルール)
  | 'UNVERIFIED' // ⚪ 未確認
  | 'ARCHIVED' // 📦 アーカイブ (過去履歴)
  | 'SUPERSEDED'; // 🔁 置換済み (新バージョンあり)

export interface OperationalKnowledgeEntry {
  knowledgeId: string;
  domain: KnowledgeDomain;
  topic: string; // e.g. "FedEx Watch Worksheet Requirement", "SpeedPAK Jewelry & Watch Restriction"
  statement: string; // Concise human rule
  source: string; // e.g. "FedEx International Service Guide 2026", "eBay VeRO Guideline"
  sourceType: 'official_api' | 'official_document' | 'admin_policy' | 'internal_fact' | 'cached' | 'unverified';
  authorityLevel: KnowledgeAuthorityLevel;
  originalLanguage: string; // e.g. 'en', 'ja', 'de'
  originalLanguageText?: string; // Full decisive clause, never truncated
  japaneseTranslation: string; // Full Japanese translation
  countryOrRegion: string; // e.g. 'US', 'DE', 'Global', 'JP'
  marketplaceOrCarrierOrPlatform: string; // e.g. 'eBay', 'FedEx', 'DHL', 'Zonos', 'Instagram'
  productCategoryScope: string; // e.g. 'Watches', 'Cameras', 'Jewelry', 'All'
  usageScope: string; // e.g. 'shipping_decision', 'customs_declaration', 'listing', 'ad_marketing'
  evidence: string;
  interpretation: string;
  confidence: number; // 0.0 - 1.0
  verifiedBy: string;
  verifiedDate: string;
  sourceUpdateDate?: string;
  version: string;
  validFrom: string;
  expiryDate: string;
  currentStatus: KnowledgeLifecycleStatus;
  supersededBy?: string;
  affectedModuleIds: string[]; // Dependency Graph (e.g. ['ai_shipping_advisor', 'project_health', 'zonos_customs'])
  notes?: string;
  reusableWithoutRecheck: boolean;
  isContradicted?: boolean;
  contradictionDetails?: string;
}

export interface ContradictionReport {
  isConflictDetected: boolean;
  topic: string;
  scope: string;
  higherAuthorityEntry: OperationalKnowledgeEntry;
  lowerAuthorityEntry: OperationalKnowledgeEntry;
  conflictReasonJa: string;
  recommendedResolutionJa: string;
  requiresHumanReview: boolean;
}

export interface ExactAssetHumanConfirmation {
  assetOrItemSignature: string; // e.g. "img_canon_ae1_photo_01", "order_2026_8801_weight"
  itemTitle: string;
  factQuestionJa: string;
  confirmedAnswer: 'yes' | 'no' | 'unknown';
  confirmedBy: string;
  confirmedAt: string;
  scopeKey: string;
  isReusableForSameAsset: boolean;
}

export interface KnowledgeEfficiencyMetrics {
  repeatedQuestionsAvoided: number;
  verifiedRulesReused: number;
  researchOperationsAvoided: number;
  safeFallbackCount: number;
  staleRuleInterceptions: number;
  estimatedMinutesSaved: number;
}

export interface KnowledgeReuseResult {
  reused: boolean;
  entry?: OperationalKnowledgeEntry;
  verificationBadge: string;
  originalVerificationDate?: string;
  authorityBadge: string;
  scopeMatched: boolean;
  mismatchReasonJa?: string;
  whyExplanationJa: string;
  requiresRecheck: boolean;
  safeFallbackSuggested?: boolean;
}

export interface KnowledgeSearchFilter {
  keyword?: string;
  domain?: KnowledgeDomain;
  carrierOrPlatform?: string;
  country?: string;
  category?: string;
  status?: KnowledgeLifecycleStatus;
}
