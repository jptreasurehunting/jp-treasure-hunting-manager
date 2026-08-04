export type GateDecision = 'ALLOWED' | 'ALLOWED_WITH_WARNING' | 'BLOCKED';

export type ProtectedAction =
  | 'CREATE_LISTING'
  | 'REVISE_LISTING'
  | 'INCREASE_QUANTITY'
  | 'ENABLE_DESTINATION_COUNTRY'
  | 'ADD_DESTINATION_SHIPPING'
  | 'MOVE_LISTING'
  | 'CONFIRM_IMPORTED_ORDER'
  | 'CREATE_SHIPPING_RECORD'
  | 'START_ZONOS_TRANSFER'
  | 'CONFIRM_SHIPMENT_PREP'
  | 'MARK_ORDER_SHIPPED';

export type PhysicalStockStatus =
  | 'Verified'
  | 'Recheck Required'
  | 'Unknown'
  | 'Inventory Mismatch'
  | 'Out of Stock';

export type InventoryAdjustmentType =
  | 'Initial stock entry'
  | 'Stocktake correction'
  | 'New stock received'
  | 'Sale'
  | 'Order cancellation returned to stock'
  | 'Damaged'
  | 'Lost'
  | 'Disposed'
  | 'Reserved'
  | 'Reservation released'
  | 'Manual correction'
  | 'Other';

export interface InventoryItemRecord {
  inventoryId: string;           // 内部在庫ID (e.g., "INV-2026-001")
  sku: string;                   // SKU
  productName: string;           // 商品名
  physicalStockQuantity: number; // 手元実在庫数 (自動推測不可)
  reservedQuantity: number;      // 予約・引当数
  soldUnshippedQuantity: number; // 受注未発送数
  damagedQuantity: number;       // 破損数
  lostQuantity: number;          // 紛失数
  availableQuantity: number;     // 発送可能在庫数 (Physical - Reserved - SoldUnshipped - Damaged - Lost)
  accountAllocations: Record<string, number>; // アカウント別出品割当数
  lastStocktakeDate: string;     // 最終棚卸し・現物確認日時
  lastVerifiedBy: string;        // 確認担当者
  verificationStatus: PhysicalStockStatus; // 検証ステータス
  notes?: string;
}

export interface InventoryAdjustmentLog {
  id: string;
  timestamp: string;
  inventoryId: string;
  sku: string;
  adjustmentType: InventoryAdjustmentType;
  quantityBefore: number;
  adjustmentQuantity: number;
  quantityAfter: number;
  reason: string;
  userConfirmed: boolean;
  relatedOrderId?: string;
  relatedEbayAccountId?: string;
}

export interface ProductComplianceProfile {
  inventoryId: string;
  productCategory: string; // e.g. "Packaging only", "Battery", "Electronics", "Toy", "Used product", "Other"
  materials: string;
  containsBattery: boolean;
  batteryType?: string;
  isElectrical: boolean;
  isChildDirectedToy: boolean;
  isLiquid: boolean;
  isDangerousGoods: boolean;
  isRestrictedCarrierItem: boolean;
  lastReviewedDate: string;
  notes?: string;
}

export interface AccountHealthRecord {
  accountId: string;
  displayName: string;
  connectionStatus: 'connected' | 'disconnected';
  authStatus: 'valid' | 'expired';
  authExpiryDate: string;
  environment: 'Production' | 'Sandbox';
  canList: boolean;
  sellingRestrictionStatus: 'Active' | 'Restricted' | 'Suspended';
  unshippedOrdersCount: number;
  overdueHandlingCount: number;
  missingTrackingCount: number;
  sellerCancelledCount: number;
  unresolvedCasesCount: number;
  accountHealthWarnings: string[];
}

export interface SafetyGateResult {
  decision: GateDecision;
  action: ProtectedAction;
  actionNameJa: string;
  reasons: string[];
  missingRequirements: string[];
  requiredUserSteps: string[];
  resolutionLink?: string;
  isBypassBlocked: boolean;
}

/* ==========================================================================
   Phase 1: Pre-Purchase Compliance & Economics Review Types (仕入れ前審査)
   ========================================================================== */

export type PrePurchaseDecision =
  | 'PURCHASE_RECOMMENDED'
  | 'REVIEW_REQUIRED'
  | 'ECONOMICALLY_NOT_RECOMMENDED'
  | 'PURCHASE_BLOCKED';

export type PrePurchaseMarketplace =
  | 'Mercari'
  | 'Yahoo Auctions'
  | 'Rakuma'
  | 'HardOff'
  | 'Other';

export interface PrePurchaseReviewInput {
  marketplace: PrePurchaseMarketplace;
  listingUrl: string;
  listingTitle: string;
  sellerDescription: string;
  askingPriceJpy: number;            // 仕入希望価格 (円)
  domesticShippingJpy: number;       // 国内送料 (円)
  expectedEbayPriceUsd: number;      // 予想eBay販売価格 ($)
  estimatedSellingFeeUsd: number;    // 予想eBay手数料 ($)
  estimatedIntlShippingUsd: number;  // 予想国際送料 ($)
  estimatedCustomsCostUsd: number;   // 予想関税コスト ($)
  exchangeRateJpyPerUsd: number;     // 為替レート (円/ドル, default 150)
  brand: string;
  manufacturer: string;
  productCode: string;               // JAN / UPC / EAN / Serial
  countryOfManufacture: string;      // 製造国 (e.g., China, Japan)
  officialReleaseMarket: string;     // 公式発売国 (e.g., Japan)
  intendedEbayMarketplace: string;   // 販売対象eBayサイト (e.g., US)
  intendedDestinationCountries: string[]; // 配送対象国
  sellerRating: number;              // 出品者評価 (%)
  sellerTransactionCount: number;    // 出品者取引数
  photoReferences: string[];         // 写真参照URL/有無
  reviewNotes: string;
}

export interface PrePurchaseReviewResult {
  decision: PrePurchaseDecision;
  decisionTitleJa: string;
  estimatedProfitJpy: number;
  estimatedProfitUsd: number;
  estimatedProfitMargin: number; // 利益率 (%)
  reviewCategories: {
    authenticityRisk: string;
    veroIpRisk: string;
    importDestinationRisk: string;
    shippingEligibility: string;
    ebayPolicyRisk: string;
    profitability: string;
    demandTurnoverRisk: string;
    missingEvidence: string[];
  };
  requiredNextActions: string[];
  missingRequirements: string[];
  isOverrideAllowed: boolean;
  overrideReason?: string;
  disclaimerNotice: string;
}

/* ==========================================================================
   Phase 2: Automatic Sales Performance Collection & Store Learning Types
   ========================================================================== */

export type CalculationState =
  | 'CONFIRMED'
  | 'PROVISIONAL'
  | 'INCOMPLETE'
  | 'NOT_APPLICABLE';

export type ConfidenceBand =
  | 'NO_DATA'
  | 'INSUFFICIENT_DATA'
  | 'EARLY_INDICATION'
  | 'MODERATE_CONFIDENCE'
  | 'HIGHER_CONFIDENCE';

export type SalesOutcomeCategory =
  | 'Completed sale'
  | 'Full return'
  | 'Partial quantity return'
  | 'Full refund without return'
  | 'Partial refund without return'
  | 'Buyer cancellation'
  | 'Seller cancellation'
  | 'Lost shipment'
  | 'Damaged shipment'
  | 'Customs return'
  | 'Delivery refusal'
  | 'Authenticity or counterfeit complaint'
  | 'Item-not-as-described complaint'
  | 'Buyer-remorse return'
  | 'Size-related return'
  | 'Other outcome';

export interface SalesPerformanceRecord {
  id: string;
  internalProductId: string;
  sku: string;
  ebayItemId: string;
  ebayOrderId: string;
  ebayLineItemId: string;
  productTitle: string;
  brand: string;
  manufacturer: string;
  characterOrSeries: string;
  productCategory: string;
  productCondition: string;
  countryOfManufacture: string;
  destinationCountry: string;
  shippingService: string;

  // Dates
  acquisitionDate: string;
  firstListingDate: string;
  relistingDate?: string;
  orderDate: string;
  paymentDate?: string;
  shipmentDate?: string;
  deliveryDate?: string;
  returnRequestDate?: string;
  returnCompletionDate?: string;
  refundDate?: string;

  // Amounts
  purchaseCostJpy?: number;
  domesticShippingCostJpy?: number;
  originalSalePriceUsd: number;
  finalSalePriceUsd: number;
  buyerPaidShippingUsd: number;
  ebaySellingFeesUsd: number;
  promotedListingFeesUsd: number;
  actualIntlShippingUsd?: number;
  customsDutyZonosCostUsd?: number;
  packagingCostJpy?: number;
  refundAmountUsd: number;
  sellerCompensationUsd: number;
  otherCostsUsd: number;
  currency: string;
  exchangeRateJpyPerUsd: number;

  // Quantities
  listedQty: number;
  soldQty: number;
  returnedQty: number;
  refundedQty: number;
  cancelledQty: number;

  // Outcome & State
  outcomeCategory: SalesOutcomeCategory;
  calculationState: CalculationState;
  missingCostsChecklist: string[];

  // Calculated Results
  calculatedNetProfitUsd?: number;
  calculatedNetProfitJpy?: number;
  calculatedSalesMarginPct?: number;
  calculatedRoiPct?: number;
  daysToSellFromAcquisition?: number;
  daysToSellFromFirstListing?: number;
  daysToShipFromOrder?: number;
}

export interface StoreLearningSummary {
  groupKey: string;
  groupType: 'brand' | 'category' | 'country' | 'shippingMethod' | 'global';
  totalCompletedSales: number;
  confidenceBand: ConfidenceBand;
  avgNetProfitUsd: number;
  avgNetProfitJpy: number;
  avgSalesMarginPct: number;
  avgRoiPct: number;
  medianDaysToSell: number;
  quantityReturnRatePct: number;
  orderReturnRatePct: number;
  monetaryReturnRatePct: number;
  refundIncidenceRatePct: number;
  sellerCancellationRatePct: number;
  damageLossRatePct: number;
  mostCommonReturnReason?: string;
  recommendationMessage: string;
  missingDataNotes: string[];
}

export interface HistoricalChangeSnapshot {
  id: string;
  timestamp: string;
  metricName: string;
  previousValue: string;
  currentValue: string;
  changeAmount: string;
  changePercentage: string;
  effectiveDate: string;
  reason: string;
  source: string;
  affectedRecommendations: string;
}

/* ==========================================================================
   Phase 2.5: Rule Change Intelligence, Remediation, Replay & Simulation Types
   ========================================================================== */

export type ChangeCategory =
  | 'EBAY_POLICY'
  | 'VERO_OR_IP_RISK'
  | 'AUTHENTICITY_REQUIREMENT'
  | 'PARALLEL_IMPORT_RULE'
  | 'COUNTRY_IMPORT_RULE'
  | 'COUNTRY_EXPORT_RULE'
  | 'CUSTOMS_RULE'
  | 'COUNTRY_OF_ORIGIN_RULE'
  | 'EPR_OR_PACKAGING_RULE'
  | 'GPSR_OR_PRODUCT_SAFETY_RULE'
  | 'CARRIER_RESTRICTION'
  | 'SHIPPING_RATE'
  | 'EBAY_FEE'
  | 'ZONOS_REQUIREMENT'
  | 'DUTY_OR_TAX'
  | 'EXCHANGE_RATE'
  | 'MARKET_PRICE'
  | 'DEMAND'
  | 'RETURN_RATE'
  | 'DAMAGE_OR_LOSS_RATE'
  | 'ACCOUNT_HEALTH_RULE'
  | 'OTHER';

export type RuleSeverity =
  | 'INFORMATIONAL'
  | 'WARNING'
  | 'HIGH'
  | 'CRITICAL';

export type RuleActionStatus =
  | 'NO_ACTION_REQUIRED'
  | 'RECOMMENDATION_AVAILABLE'
  | 'USER_REVIEW_REQUIRED'
  | 'ACTION_REQUIRED'
  | 'AUTOMATIC_HOLD_APPLIED'
  | 'RESOLVED'
  | 'SUPERSEDED';

export type AutomationSafetyClass =
  | 'SAFE_LOCAL_AUTOMATION'
  | 'USER_APPROVAL_REQUIRED'
  | 'FORBIDDEN_AUTOMATION';

export type SourceFreshnessStatus =
  | 'CURRENT'
  | 'REVIEW_DUE'
  | 'STALE'
  | 'UNKNOWN';

export type ProposalClassification =
  | 'REQUIRED'
  | 'RECOMMENDED'
  | 'FUTURE_CANDIDATE';

export interface CauseAnalysisResult {
  primaryCause: string;
  contributingCauses: string[];
  supportingData: string[];
  conflictingData: string[];
  confidenceLevel: string;
  whyPreviousDifferent: string;
  whyCurrentChanged: string;
  missingInformation: string[];
  isCauseConfirmed: boolean; // false -> CAUSE_UNCONFIRMED
}

export interface RuleChangeIntelligenceRecord {
  id: string;
  category: ChangeCategory;
  title: string;
  description: string;
  previousValue: string;
  currentValue: string;
  effectiveDate: string;
  detectionDate: string;
  sourceName: string;
  sourceFreshness: SourceFreshnessStatus;
  severity: RuleSeverity;
  actionStatus: RuleActionStatus;
  causeAnalysis: CauseAnalysisResult;

  // Impact Analysis
  affectedActiveListingsCount: number;
  affectedDraftListingsCount: number;
  affectedOrdersAwaitingShipmentCount: number;
  affectedDestinationCountries: string[];
  affectedEbayAccounts: string[];
  estimatedRevenueImpactUsd: number;
  estimatedProfitImpactUsd: number;

  oldApprovalExpired: boolean;
  isBlockRequired: boolean;
}

export interface RemediationActionItem {
  id: string;
  actionName: string;
  whyRequired: string;
  isMandatory: boolean;
  safetyClass: AutomationSafetyClass;
  estimatedTimeMinutes: number;
  expectedResult: string;
  affectedRecords: string;
  isReversible: boolean;
  requiresApproval: boolean;
  isCompleted: boolean;
}

export interface DecisionReplaySnapshot {
  id: string;
  timestamp: string;
  decisionType: string;
  originalResult: string;
  currentRuleResult: string;
  actualOutcome?: string;
  ruleVersion: string;
  exchangeRate: number;
  shippingRatesInfo: string;
  ebayFeeAssumptions: string;
  zonosAssumptions: string;
  customsAssumptions: string;
  veroIpStatus: string;
  authenticityState: string;
  inventoryState: string;
  accountHealthState: string;
  profitInputSummary: string;
  confidenceBand: ConfidenceBand;
  explanation: string;
  overrideReason?: string;
  actor: string;
}

export interface ProfitSimulationScenario {
  id: string;
  scenarioName: string;
  proposedAction: string;
  revenueChangeUsd: number;
  profitChangeUsd: number;
  marginChangePct: number;
  roiChangePct: number;
  shippingCostChangeUsd: number;
  dutyTaxChangeUsd: number;
  handlingTimeDaysDelta: number;
  salesSpeedChangeText: string;
  cashFlowEffectText: string;
  returnRiskEffectText: string;
  accountRiskEffectText: string;
  isSafetyBlockActive: boolean; // Favorable profit cannot override safety block!
}

/* ==========================================================================
   Phase 3: Assisted Automated Listing & Multi-Account Business Policy Types
   ========================================================================== */

export type EbayDraftState =
  | 'PHOTO_REQUIRED'
  | 'IDENTIFICATION_REQUIRED'
  | 'MANUAL_DATA_REQUIRED'
  | 'COMPLIANCE_REVIEW_REQUIRED'
  | 'PRICE_APPROVAL_REQUIRED'
  | 'POLICY_REQUIRED'
  | 'READY_FOR_FINAL_REVIEW'
  | 'READY_TO_PUBLISH'
  | 'PUBLISHED'
  | 'PUBLISH_FAILED'
  | 'BLOCKED';

export type PhotoTagType =
  | 'Front'
  | 'Back'
  | 'Sides'
  | 'LabelTag'
  | 'Packaging'
  | 'Damage'
  | 'Accessories'
  | 'Other';

export interface EbayPhotoRecord {
  id: string;
  url: string;
  tagType: PhotoTagType;
  isActualItemConfirmed: boolean;
  orderIndex: number;
}

export interface EbayFulfillmentPolicy {
  id: string;
  name: string;
  description: string;
  marketplaceId: string;
  shippingCarrier: string;
  shippingService: string;
  isDdp: boolean;
  estimatedDeliveryDays: string;
  rateUsd: number;
}

export interface EbayReturnPolicy {
  id: string;
  name: string;
  description: string;
  marketplaceId: string;
  returnsAccepted: boolean;
  returnPeriodDays: number;
  returnShippingCostPayer: 'Buyer' | 'Seller';
}

export interface EbayPaymentPolicy {
  id: string;
  name: string;
  description: string;
  marketplaceId: string;
  paymentMethods: string[];
}

export interface EbayDraftItem {
  id: string;
  internalProductId: string;
  sku: string;
  accountId: string;
  marketplaceId: string;
  title: string; // 80 char max
  categoryId: string;
  categoryName: string;
  itemAspects: Record<string, string>; // Item Specifics
  conditionDescription: string;
  priceUsd: number;
  priceApproved: boolean; // Explicit price approval
  quantity: number;
  physicalStockConfirmed: boolean;
  weightGrams?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  fulfillmentPolicyId?: string;
  returnPolicyId?: string;
  paymentPolicyId?: string;
  isDdp: boolean;
  photoRecords: EbayPhotoRecord[];
  descriptionHtml: string;
  draftState: EbayDraftState;
  complianceResult: string;
  estimatedFeesUsd: number;
}

/* ==========================================================================
   Phase 4: Order Fulfillment, Shipping Record & Post-Sale Tracking Types
   ========================================================================== */

export type OrderFulfillmentStatus =
  | 'Unshipped'
  | 'Pre-Shipment'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export interface ImportedEbayOrderRecord {
  id: string;
  ebayOrderId: string;
  ebayLineItemId: string;
  sku: string;
  productTitle: string;
  buyerUsername: string;
  destinationCountry: string;
  salePriceUsd: number;
  paidDate: string;
  fulfillmentStatus: OrderFulfillmentStatus;
  physicalItemConfirmed: boolean; // Mandatory physical item check: 「発送する現物を手元で確認しました。」
  packageWeightGrams: number;
  packageLengthCm?: number;
  packageWidthCm?: number;
  packageHeightCm?: number;
  carrierName: string;
  trackingNumber: string;
  zonosPrepayReference?: string;
  declaredValueUsd: number;
}

/* ==========================================================================
   Google Drive Integration Types (Phase 4 Extension)
   ========================================================================== */

export type GoogleDriveAuthStatus =
  | 'UNAUTHENTICATED'
  | 'MOCK_CONNECTED'
  | 'AUTHENTICATED';

export interface GoogleDriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  folderId: string;
  uploadTimestamp: string;
  skuRef?: string;
}
