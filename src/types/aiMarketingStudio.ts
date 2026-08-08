export type MarketingChannelId =
  | 'ebay'
  | 'own_ec'
  | 'instagram'
  | 'facebook'
  | 'x_twitter'
  | 'threads'
  | 'pinterest'
  | 'tiktok'
  | 'youtube_shorts'
  | 'shopee'
  | string;

export interface MarketingChannelDefinition {
  channelId: MarketingChannelId;
  name: string;
  category: 'sns' | 'ec_store' | 'marketplace' | 'video_platform';
  icon: string;
  maxTextLength: number;
  supportsHashtags: boolean;
  supportsRichStory: boolean;
  supportsDdpInfo: boolean;
  requiresStrictNoOffPlatformLinks: boolean;
  recommendedAspectRatios: string[];
  isCustomChannel?: boolean;
}

export type RightsGateStatus =
  | 'STANDARDS_MET' // 🟢 基準適合 (現在設定されている確認基準と確認済み根拠を満たしています)
  | 'NEEDS_CHECK' // 🟡 要確認
  | 'PENDING_APPROVAL' // 🟠 承認待ち
  | 'PROHIBITED'; // 🔴 使用禁止

export type RightsCategory =
  | 'copyright' // 著作権
  | 'trademark' // 商標権 / 商品識別・ブランド名
  | 'character_franchise_ip' // キャラクター・版権・作品IP
  | 'image_license' // 画像利用ライセンス
  | 'video_license' // 動画素材利用ライセンス
  | 'music_license' // 音源・BGM商用利用ライセンス
  | 'commercial_use_permission' // 商用利用許諾
  | 'advertising_use_permission' // 広告・プロモーション利用許諾
  | 'derivative_work_restrictions' // 二次創作・改変制限
  | 'attribution_requirements' // クレジット・著作者表示義務
  | 'geographic_restrictions' // 地域・配信国制限
  | 'platform_restrictions' // プラットフォーム規約・制限
  | 'publicity_personality_rights' // 肖像権・パブリシティ権
  | 'patent_marketing_risk' // 特許・商標表示リスク
  | 'official_wording_risk'; // 「公式/公認/ライセンス品」等の表現リスク

export type ReviewEffortTier =
  | 'standard_automated' // 標準自動レビュー
  | 'short_guided' // 簡易ガイド確認
  | 'enhanced' // 詳細確認
  | 'specialist_recommended'; // 専門家・管理者レビュー推奨

export type UserRole = 'operator' | 'reviewer' | 'administrator';

export interface EvidenceRecord {
  assetId: string;
  assetType: 'image' | 'video' | 'music' | 'text' | 'logo' | 'claim';
  proposedUse: 'sns_post' | 'ec_landing' | 'ebay_listing' | 'paid_ad' | 'short_video';
  country: string;
  channel: string;
  source: string;
  sourceType: 'official_api' | 'contract_terms' | 'platform_policy' | 'license_agreement' | 'seller_confirmation';
  originalLanguage: string; // e.g. 'en', 'ja', 'de'
  originalLanguageText: string; // Full decisive clause, NEVER truncated
  japaneseTranslation: string; // Full Japanese translation
  relevantClause: string;
  fullClauseText?: string; // For 「条項全体を見る」 / 「規約全文を見る」
  retrievedDate: string;
  sourcePublicationDate?: string;
  licenseVersion: string;
  aiInterpretation: string;
  confidence: number; // 0.0 - 1.0
  reviewer?: string;
  approvalDate?: string;
  expirationDate: string;
  status: 'active' | 'recheck_required' | 'superseded' | 'revoked' | 'archived';
  translationVerificationPassed: boolean;
  reusableForAssetIds?: string[];
}

export interface GuidedHumanCheck {
  checkId: string;
  assetId: string;
  targetSubject: string; // e.g. "商品動画のBGM", "商品写真", "公式ロゴ"
  aiFindings: string; // e.g. "広告利用の追加ライセンスが必要です。"
  simpleFactualQuestion: string; // e.g. 「この写真は自社で撮影しましたか？」
  answerOptions: ('yes' | 'no' | 'unknown')[];
  currentAnswer?: 'yes' | 'no' | 'unknown';
  safeFallbackAvailable: boolean;
  safeFallbackDescription?: string; // e.g. "安全な商用フリーBGM (Acoustic Folk Library) へ自動変更"
  safeFallbackActionName?: string;
  isResolved: boolean;
  answeredAt?: string;
  answeredBy?: string;
}

export interface SafeFallbackOption {
  assetId: string;
  originalAsset: string;
  safeReplacement: string;
  replacementType: 'seller_photo' | 'licensed_stock' | 'approved_bgm' | 'safe_text';
  reason: string;
  isApplied: boolean;
}

export interface RightsGateEvaluationResult {
  status: RightsGateStatus;
  statusLabel: string;
  statusExplanation: string; // Meaning: 「現在設定されている確認基準と確認済み根拠を満たしています」
  canPublish: boolean;
  blockingReasons: string[];
  warnings: string[];
  requiredGuidedChecks: GuidedHumanCheck[];
  evidenceList: EvidenceRecord[];
  safeFallbacks: SafeFallbackOption[];
  reviewEffortTier: ReviewEffortTier;
  reviewEffortReason: string;
  evaluatedAt: string;
  auditSummary: string;
}

export interface KnowledgeBaseEntry {
  knowledgeId: string;
  title: string;
  category:
    | 'approved_music_library'
    | 'approved_image_source'
    | 'known_license_rule'
    | 'platform_requirement'
    | 'reviewed_rights_decision'
    | 'brand_caution_rule'
    | 'approved_wording'
    | 'rejected_wording'
    | 'safe_alternative_asset'
    | 'country_specific_finding';
  scope: string; // e.g. "YouTube Shorts / TikTok / Instagram", "Global", "US only"
  evidence: string;
  source: string;
  version: string;
  lastVerifiedDate: string;
  reviewer: string;
  expiryRecheckRule: string;
  lifecycleStatus: 'active' | 'recheck_required' | 'superseded' | 'revoked' | 'archived';
  affectedCampaignIds?: string[];
  isStale: boolean;
}

export interface MarketingContentGeneration {
  productId: string;
  productTitle: string;
  channelId: MarketingChannelId;
  campaignVersion: string;
  creativeVariant: 'Variant A' | 'Variant B';
  marketingAngle: string;
  shortProductHook: string;
  collectorAppeal: string;
  rarityAppeal?: string; // Only factually grounded, never fabricated
  channelSpecificDescription: string;
  cta: string;
  recommendedImageOrder: string[];
  shortVideoConcept: string;
  backgroundMusicConcept: string; // Muted preview by default
  backgroundMusicAudioMutedByDefault: boolean;
  landingPageConcept: string;
  hashtags?: string[];
  rightsEvaluation: RightsGateEvaluationResult;
  generatedAt: string;
}

export interface MarketingPerformanceRecord {
  id: string;
  productId: string;
  productTitle: string;
  channelId: MarketingChannelId;
  campaignVersion: string;
  creativeVersion: string; // 'Variant A' | 'Variant B'
  impressions: number;
  clicks: number;
  ctr: number;
  productPageVisits: number;
  conversionCount: number;
  revenueUsd: number;
  profitUsd: number;
  timestamp: string;
  isMeasuredData: boolean;
}

export interface MarketingStudioAuditTrailEntry {
  id: string;
  timestamp: string;
  action: string;
  channelId: string;
  assetId?: string;
  decision: RightsGateStatus | 'SAFE_FALLBACK_APPLIED' | 'PUBLICATION_ATTEMPTED';
  performedBy: string;
  ruleVersion: string;
  details: string;
}
