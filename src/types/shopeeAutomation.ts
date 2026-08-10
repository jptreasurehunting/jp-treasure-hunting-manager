export interface ShopeeListingCapacity {
  sellerAccountId: string;
  marketplaceRegion: 'SG' | 'MY' | 'TW' | 'TH' | 'PH' | 'VN';
  freeListingCapacity: number;         // 無料出品上限数 (Configurable: default 100)
  usedListingCapacity: number;         // 現在の出品中商品数
  remainingFreeCapacity: number;       // 残り無料出品可能数 (freeListingCapacity - usedListingCapacity)
  paidListingRequired: boolean;        // 有料出品枠が必要か (残数0以下でtrue)
  capacitySource: 'CONFIGURED_ASSUMPTION' | 'SHOPEE_SELLER_CENTRE' | 'SHOPEE_OPEN_API_V2';
  capacityVerifiedAt: string;
  isVerifiedByOfficialDoc: boolean;    // 公式ドキュメント/APIで検証済みか (未検証時はfalse)
  warningThreshold: number;            // 警告を発報する残数閾値 (例: 5)
}

export interface ShopeeAutoListingPolicy {
  policyVersion: string;
  autoListingEnabled: boolean;         // Shopee自動出品 有効/無効
  autoReplacementEnabled: boolean;     // 自動入替 有効/無効
  maxFreeListingCapacity: number;      // 無料出品上限数 (例: 100)
  minExpectedProfitJpy: number;        // 最低期待利益 (例: ¥1,500)
  minOpportunityScore: number;         // 最低販売期待スコア (例: 70 / 100点)
  minEvaluationPeriodDays: number;     // 最低評価期間 (例: 30日間)
  minImpressionThreshold: number;      // 最低表示回数 (例: 100回)
  minClickThreshold: number;           // 最低クリック数 (例: 5回)
  replacementCooldownDays: number;     // 入替後の再評価待機期間 (例: 14日間)
  maxReplacementsPerDay: number;       // 1日の最大自動入替件数 (例: 5件/日)
  approvedBy: string;                  // ポリシー承認者
  approvedAt: string;                  // 承認日時
  isPolicyApproved: boolean;           // 管理者による承認が完了しているか
}

export interface ShopeeListingItem {
  shopeeItemId: string;
  sku: string;
  title: string;
  priceSgd: number;
  priceJpyEquivalent: number;
  stock: number;
  viewsCount: number;
  clicksCount: number;
  salesCount: number;
  listedAt: string;
  lastEvaluatedAt: string;
  opportunityScore: number;
  status: 'ACTIVE' | 'PAUSED_OUT_OF_STOCK' | 'REPLACEMENT_CANDIDATE' | 'DELISTED';
  isReplacementCandidate: boolean;
  replacementReasonKey?: string;
}

export interface ShopeeOptimizationScore {
  sku: string;
  title: string;
  ebaySalesVelocity: number; // 0-100
  profitScore: number;       // 0-100
  weightPenalty: number;     // 減点
  overallOpportunityScore: number; // 0-100
  recommendationAction: 'LIST_TO_SHOPEE' | 'KEEP_LISTED' | 'REPLACE_CANDIDATE' | 'DO_NOT_LIST';
  reasonCodeKeys: string[];
}

export interface ShopeeAutomationAuditRecord {
  auditId: string;
  timestamp: string;
  policyVersion: string;
  actionType:
    | 'AUTO_LISTING_CREATED'
    | 'AUTO_LISTING_UPDATED'
    | 'AUTO_STOCK_PAUSED'
    | 'AUTO_STOCK_RESTORED'
    | 'AUTO_REPLACEMENT_EXECUTED'
    | 'REVIEW_REQUIRED_TRIGGERED'
    | 'BLOCKED_TRIGGERED';
  sku: string;
  replacedSku?: string;
  opportunityScore: number;
  reasonCodeKeys: string[];
  capacityState: {
    usedCapacity: number;
    maxFreeCapacity: number;
    remainingFreeCapacity: number;
  };
  isAutomated: boolean;
  operatorId: string;
  marketplaceApiResult: {
    success: boolean;
    shopeeItemId?: string;
    errorCode?: string;
    errorMessage?: string;
  };
}
