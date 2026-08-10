import { PrePurchaseReviewResult } from './safetyGate';

export type OpportunityCategoryType =
  | 'JAPAN_EXCLUSIVE'        // 日本国内限定発売
  | 'LIMITED_QUANTITY'        // 数量限定生産
  | 'PREORDER_EXCLUSIVE'     // 予約限定特典・受注生産
  | 'LOTTERY_SALE'           // 抽選販売
  | 'MADE_TO_ORDER'          // 完全受注生産
  | 'EVENT_STORE_EXCLUSIVE'   // イベント・ポップアップ・特定店舗限定
  | 'COLLABORATION'          // コラボレーション限定モデル
  | 'ANNIVERSARY_MODEL'      // 周年記念・限定復刻
  | 'OVERSEAS_UNRELEASED'    // 海外未発売・グローバル流通なし
  | 'HIGH_SELLOUT_RISK';     // 発売前即完売リスク高

export type OpportunityLifecycleStage =
  | 'ANNOUNCEMENT'           // 1. 情報告知段階 (Announcement)
  | 'PREORDER_OPEN'          // 2. 予約受付中 (Pre-order Open)
  | 'STOCK_TIGHTENING'       // 3. 在庫逼迫・予約終了間近 (Stock Tightening / Availability Declining)
  | 'SOLD_OUT'               // 4. 公式完売・定価終了 (Sold Out)
  | 'SECONDARY_MARKET';      // 5. 発売後・二次流通相場推移 (Secondary Market Tracking)

export type ExtendedLifecycleStage = OpportunityLifecycleStage;

export type OpportunityApprovalStatus =
  | 'PENDING_REVIEW'         // 人間レビュー待ち (デフォルト)
  | 'APPROVED_FOR_WATCHING'  // 監視リスト登録承認 (Watchlist Approved)
  | 'APPROVED_FOR_PREPURCHASE' // 仕入・予約コミット承認 (Purchase Approved)
  | 'REJECTED';              // 見送り・対象外 (Rejected)

/**
 * Phase 2: 6-Tier Source Authority Hierarchy
 */
export type SourceAuthorityLevel =
  | 'OFFICIAL_MANUFACTURER'    // 公式メーカー (Bandai, GoodSmile, Nintendo 等) - Base Trust 100%
  | 'OFFICIAL_RETAILER_OR_EVENT' // 公式直営店・限定イベント主催者 - Base Trust 95%
  | 'AUTHORIZED_DISTRIBUTOR'   // 公認販売店・正規問屋 (あみあみ, ビックカメラ等) - Base Trust 85%
  | 'REPUTABLE_NEWS_MEDIA'     // 大手ホビーメディア (電撃ホビー等) - Base Trust 70%
  | 'SECONDARY_AGGREGATOR'     // 二次流通集約・非公式まとめ速報 - Base Trust 40% (要確認)
  | 'UNKNOWN_SOURCE';          // 未知・未検証ソース - Base Trust 0% (信頼度減衰)

/**
 * Phase 2: 日本限定・海外未発売の根拠モデル
 */
export interface GeographicExclusivityEvidence {
  isJapanExclusive: boolean;
  japanExclusivityProof: string;       // 例: "国内向けJAN・国内イベント会場限定販売明記"
  hasOverseasReleasePlan: boolean;     // 海外版の発売予定有無
  overseasReleaseEvidence?: string;    // 例: "北米ディストリビューターでの取扱予定なし確認"
  restrictedDestinations?: string[];   // 発送不可国 (ライセンス・規制)
}

/**
 * Phase 2: 在庫・供給状況シグナル
 */
export interface SupplyAvailabilitySignal {
  allocationType: 'OPEN_PREORDER' | 'QUANTITY_CAPPED' | 'LOTTERY' | 'MADE_TO_ORDER' | 'UNKNOWN';
  totalProductionQuantity?: number;    // 限定生産数 (例: 500体)
  purchaseLimitPerUser?: number;       // 1人あたりの購入制限数 (例: 1限, 2限)
  currentStockStatus: 'IN_STOCK' | 'TIGHT' | 'WAITLIST' | 'OUT_OF_STOCK';
  preorderStartDate?: string;
  preorderEndDate?: string;
  expectedDeliveryDate?: string;
}

/**
 * Phase 2: 相場推移データポイント
 */
export interface HistoricalPricePoint {
  timestamp: string;
  priceJpy: number;
  expectedPriceUsd?: number;
  recordedBy: string;
  sourceNote: string;
}

export interface OpportunityEvidence {
  sourceUrl: string;
  sourceName: string;
  sourceAuthority?: SourceAuthorityLevel;
  checkedAt: string;
  evidenceNotes: string;
  confidenceScore: number; // 0 - 100
  hasJanOrProductCode: boolean;
  productCode?: string;
  hasOfficialAnnouncementPhoto: boolean;
}

export interface OpportunityEconomics {
  askingPriceJpy: number;          // 仕入予定価格 (JPY)
  domesticShippingJpy: number;     // 国内送料 (JPY)
  expectedEbayPriceUsd: number;    // 想定eBay販売価格 (USD)
  exchangeRate: number;            // 適用為替レート (JPY/USD)
  estimatedSellingFeeUsd: number;  // 想定モール手数料 (USD)
  estimatedIntlShippingUsd: number;// 想定国際送料 (USD)
  netProfitUsd: number;            // 想定純利益 (USD)
  netProfitJpy: number;            // 想定純利益 (JPY)
  profitMarginPct: number;         // 想定利益率 (%)
  totalCostJpy: number;            // 仕入総原価 (JPY)
  totalDeductionsUsd: number;      // 総控除額 (USD)
}

export interface OpportunityScoreBreakdown {
  demandScore: number;             // 海外需要スコア (0 - 30)
  profitScore: number;             // 利益率・粗利スコア (0 - 30)
  rarityScore: number;             // 希少性スコア (0 - 20)
  seriesHistoryScore: number;      // 過去シリーズ実績スコア (0 - 20)
  penaltyDeductions: number;       // リスク・送料減点 (0 - 50)
  finalScore: number;              // 総合評価スコア (0 - 100)
  isRecommended: boolean;          // 総合推薦フラグ (スコア >= 70 かつ リスククリア)
  recommendationRationale: string; // 推薦/非推薦の具体的理由
  isRarityOnlyTrap: boolean;       // 「限定というだけで需要・利益が低い」罠判定フラグ
  isVeroBlocked: boolean;          // VeRO・知財ブロックフラグ
  isPreorderPolicyWarning: boolean;// eBay 30日予約規約警告
  warningFlags: string[];          // リスク警告リスト
}

export interface OpportunityApprovalRecord {
  approvalId: string;
  action: 'WATCH' | 'PREPURCHASE' | 'REJECT';
  operatorName: string;
  approvedAt: string;
  rationale: string;
  previousStatus: OpportunityApprovalStatus;
  newStatus: OpportunityApprovalStatus;
}

export interface OpportunityCandidate {
  id: string;
  canonicalHash?: string;          // Phase 2: 重複排除用一意ハッシュ
  title: string;
  brand: string;
  characterOrSeries?: string;
  category: string;
  opportunityTypes: OpportunityCategoryType[];
  releaseDate: string;             // 発売予定日 (YYYY-MM-DD)
  preOrderDeadline?: string;       // 予約締切日時
  economics: OpportunityEconomics;
  evidence: OpportunityEvidence;
  scoreBreakdown: OpportunityScoreBreakdown;
  lifecycleStage: OpportunityLifecycleStage;
  approvalStatus: OpportunityApprovalStatus;
  approvalHistory: OpportunityApprovalRecord[];
  rightsRiskReview?: PrePurchaseReviewResult;
  geographicExclusivity?: GeographicExclusivityEvidence; // Phase 2
  supplyAvailability?: SupplyAvailabilitySignal;       // Phase 2
  historicalPricePoints?: HistoricalPricePoint[];       // Phase 2
  isDataStale?: boolean;                               // Phase 2: 鮮度減衰フラグ
  staleReason?: string;                                // Phase 2: 鮮度警告理由
  createdAt: string;
  updatedAt: string;
}

/**
 * Phase 2: 情報取得アダプター向け入力シグナル構造体
 */
export interface RawOpportunitySignal {
  sourceUrl: string;
  sourceName: string;
  sourceAuthority: SourceAuthorityLevel;
  title: string;
  brand: string;
  characterOrSeries?: string;
  category: string;
  editionVariant?: string;         // 例: "あみあみ限定特典付き", "DX豪華版"
  opportunityTypes: OpportunityCategoryType[];
  askingPriceJpy: number;
  expectedEbayPriceUsd: number;
  releaseDate: string;
  preOrderDeadline?: string;
  productCode?: string;            // JAN / UPC
  hasOfficialPhoto: boolean;
  evidenceNotes: string;
  rawDemandSignal?: number;
  seriesSellThroughRate?: number;
  japanExclusivityProof?: string;
  hasOverseasReleasePlan?: boolean;
}
