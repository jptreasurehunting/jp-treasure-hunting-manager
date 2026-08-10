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
  | 'STOCK_TIGHTENING'       // 3. 在庫逼迫・予約終了間近 (Stock Tightening)
  | 'SOLD_OUT'               // 4. 公式完売・定価終了 (Sold Out)
  | 'SECONDARY_MARKET';      // 5. 発売後・二次流通相場推移 (Secondary Market)

export type OpportunityApprovalStatus =
  | 'PENDING_REVIEW'         // 人間レビュー待ち (デフォルト)
  | 'APPROVED_FOR_WATCHING'  // 監視リスト登録承認 (Watchlist Approved)
  | 'APPROVED_FOR_PREPURCHASE' // 仕入・予約コミット承認 (Purchase Approved)
  | 'REJECTED';              // 見送り・対象外 (Rejected)

export interface OpportunityEvidence {
  sourceUrl: string;
  sourceName: string;
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
  createdAt: string;
  updatedAt: string;
}
