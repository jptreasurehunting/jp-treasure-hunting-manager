import { SalesChannel, NormalizedFulfillmentOrder, PackagingType, FulfillmentAction, ShippingRouteDecision } from './shippingRouter';

export type MarketplacePolicyType =
  | 'ALLOWED'           // 同梱・同一追跡番号の共有を公式サポート
  | 'CONDITIONAL'       // 特定条件（同一アカウント、特定公式ワークフロー等）を満たす場合のみ許可
  | 'PROHIBITED'        // 同梱・追跡番号共有を完全禁止 (メルカリ便、クロスモール等)
  | 'UNKNOWN';          // 未知・未検証のモール規約 (デフォルト)

export interface MarketplaceConsolidationRule {
  marketplace: SalesChannel;
  sellerAccountId?: string;
  policyType: MarketplacePolicyType;
  allowSameTrackingMultiOrders: boolean;
  allowCrossAccountConsolidation: boolean;
  requiresBuyerConsent: boolean;
  verificationStatus: 'VERIFIED' | 'UNKNOWN';
  failSafeAction: 'KEEP_SEPARATE' | 'REVIEW_REQUIRED' | 'BLOCKED';
  policyVersion: string;
  officialDocumentationReference: string;
}

export type ConsolidationDecisionStatus =
  | 'CONSOLIDATE'       // 同梱発送を承認
  | 'KEEP_SEPARATE'     // 個別発送を維持
  | 'REVIEW_REQUIRED'   // 人間確認要求 (Action Required)
  | 'BLOCKED';          // 規約・安全違反により同梱禁止

export interface ConsolidationCheckResult {
  checkNameKey: string;
  passed: boolean;
  reasonCodeKey: string;
}

export interface ConsolidationDecision {
  decisionId: string;
  status: ConsolidationDecisionStatus;
  primaryOrderId: string;
  groupedOrderIds: string[];
  salesChannel: SalesChannel;
  sellerAccountId: string;
  isCrossMarketplace: boolean;
  appliedPolicyVersion: string;
  checks: ConsolidationCheckResult[];
  reasonCodeKeys: string[];
  combinedWeightGrams: number;
  combinedDimensionsCm: { length: number; width: number; height: number };
  recommendedPackaging: PackagingType;
  recommendedAction: FulfillmentAction;
  earliestShippingDeadline: string;
  requiresHumanReview: boolean;
  evaluatedAt: string;
}

export type GroupLifecycleState =
  | 'DETECTED'
  | 'EVALUATING'
  | 'PENDING_CONFIRMATION'
  | 'FINALIZED'
  | 'PRINTED'
  | 'SHIPPED'
  | 'SEPARATED'
  | 'BLOCKED';

export interface FulfillmentGroup {
  groupId: string;
  groupName: string;
  state: GroupLifecycleState;
  salesChannel: SalesChannel;
  sellerAccountId: string;
  orders: NormalizedFulfillmentOrder[];
  recipient: {
    buyerName: string;
    postalCode: string;
    normalizedAddress: string;
  };
  totalQuantity: number;
  totalPrice: number;
  currency: 'JPY' | 'USD' | 'EUR';
  combinedWeightGrams: number;
  combinedDimensionsCm: { length: number; width: number; height: number };
  routingDecision: ShippingRouteDecision;
  earliestShippingDeadline: string;
  trackingNumber?: string;
  boundOrderCount: number;
  isPrintLocked: boolean; // 個別注文の誤印刷を防ぐ排他ロック
  createdAt: string;
  finalizedAt?: string;
}

export interface ConsolidationAuditRecord {
  auditId: string;
  timestamp: string;
  decisionId: string;
  groupId: string;
  evaluatedOrderIds: string[];
  salesChannel: SalesChannel;
  sellerAccountId: string;
  appliedPolicyVersion: string;
  decisionStatusKey: string;
  reasonCodeKeys: string[];
  combinedWeightGrams: number;
  combinedDimensionsCm: { length: number; width: number; height: number };
  earliestShippingDeadline: string;
  humanOverride: boolean;
  operatorId: string;
}
