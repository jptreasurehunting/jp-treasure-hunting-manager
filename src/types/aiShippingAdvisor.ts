import { ShippingMethod, ShippingFeeBreakdown, DeliveryEstimateRange } from './shippingRegistry';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface AuthenticityValidationResult {
  isAuthenticityEligible: boolean;
  shipToCenterVerified: boolean;
  shipToAddressText: string;
  trackingEndToEndVerified: boolean;
  carrierVerified: boolean;
  evtnVerified: boolean;
  isBlocked: boolean;
  blockingReasons: string[];
}

export interface WatchWorkflowDetails {
  isWatchItem: boolean;
  isFedExWatchWorksheetRequired: boolean;
  isAuthenticityWorkflowRequired: boolean;
  prohibitedServicesExcluded: string[];
}

export interface AiShippingComplianceStatus {
  isFullyCompliant: boolean;
  isAuthenticityEligible: boolean;
  isEvtnRequired: boolean;
  isFedExWorksheetRequired: boolean;
  isZonosRequired: boolean;
  requiredDocuments: string[];
  complianceErrors: string[];
  complianceWarnings: string[];
  authenticityValidation: AuthenticityValidationResult;
  watchWorkflow: WatchWorkflowDetails;
}

export interface ExcludedMethodDetail {
  methodName: string;
  carrier: string;
  exclusionReason: string;
}

export interface AiShippingEvaluationItem {
  method: ShippingMethod;
  isEligible: boolean;
  ineligibleReasons: string[];
  costBreakdown: ShippingFeeBreakdown;
  deliveryRange: DeliveryEstimateRange;
  estimatedSellerProfitUsd: number;
  estimatedProfitMarginPercent: number;
  starRating: '★★★★★' | '★★★★☆' | '★★★☆☆' | '★★☆☆☆' | '★☆☆☆☆';
  score: number;
  shortOneLineReason: string; // Compact 1-line reason
  detailedReasoning: {
    whyRecommended: string;
    excludedMethods: ExcludedMethodDetail[];
    categoryRestrictions: string;
    ebayPolicyChecks: string;
    carrierRestrictions: string;
    ddpZonosDecision: string;
    trackingInsuranceDetails: string;
    differenceFromCheapest?: string; // Disadvantages of Cheapest vs Recommended
    riskAssessment: string;
    ruleSources: string[];
    lastVerificationTimestamp: string;
  };
  complianceStatus: AiShippingComplianceStatus;
  riskOfReturn: RiskLevel;
  riskOfDefect: RiskLevel;
  estimatedBuyerSatisfactionPercent: number;
  criticalWarnings: string[]; // ALWAYS VISIBLE (never hidden behind collapse button!)
  riskWarnings: string[];
  isCheapest: boolean;
  isRecommended: boolean;
  requiresZonos: boolean;
}

export interface AiShippingAdvisorAnalysis {
  recommendedOption?: AiShippingEvaluationItem;
  cheapestOption?: AiShippingEvaluationItem;
  allEvaluatedItems: AiShippingEvaluationItem[];
  evaluatedAt: string;
  itemValueUsd: number;
  purchaseCostUsd: number;
  packedWeightGrams: number;
  destinationCountry: string;
  categoryName: string;
  brandName: string;
  notes: string;
}
