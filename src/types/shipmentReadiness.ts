import { KnowledgeAuthorityLevel } from './operationalKnowledge';
import { RuleFreshnessGrade } from './ruleFreshness';

export type ShipmentReadinessState =
  | 'READY' // 🟢 出荷準備完了: 全要件を満たし、将来の送り状発行に進む準備完了
  | 'NEEDS_REVIEW' // 🟡 要人間レビュー: 規約不一致や専門スタッフの現物確認が必要
  | 'BLOCKED' // 🔴 処理停止 / 禁止: キャリア禁止品目や失効ルールにより進行不能
  | 'WAITING_FOR_DATA'; // ⚪ データ待機中: EVTN番号や実測重量など未到着データの待機

export interface NonReadyStateDetails {
  reasonCode: string; // e.g. 'BLOCKED_SPEEDPAK_WATCH', 'WAITING_EVTN_DATA', 'NEEDS_REVIEW_MATERIAL_CHECK'
  explanationJa: string; // Human-readable Japanese explanation
  sourceKnowledgeOrService: string; // e.g. 'eBay SpeedPAK Terms 2026', 'FedEx Watch Worksheet Ver. 4.1'
  humanActionRequired: boolean;
  resolutionActionJa: string; // What action or missing information can resolve it
  canAutoReevaluate: boolean; // Whether the decision can be automatically re-evaluated later
}

export interface WatchWorksheetBreakdown {
  movementValueUsd: number;
  movementWeightGrams: number;
  movementMaterialJa: string;
  caseValueUsd: number;
  caseWeightGrams: number;
  caseMaterialJa: string;
  bandValueUsd: number;
  bandWeightGrams: number;
  bandMaterialJa: string;
  batteryMaterialJa: string;
  totalValueUsd: number;
  totalWeightGrams: number;
  templateVersion: string;
}

export interface NormalizedEbayOrder {
  orderId: string;
  orderNumber: string;
  itemTitle: string;
  itemCategory: 'Watches' | 'Cameras' | 'Jewelry' | 'Figurines' | 'Other';
  sellingPriceUsd: number;
  shippingFeeUsd: number;
  destinationCountry: string; // e.g. 'US', 'DE', 'GB', 'CA', 'AU'
  buyerName: string;
  buyerAddress: string;
  buyerCity: string;
  buyerPostalCode: string;
  evtnNumber?: string;
  packageWeightGrams?: number;
  packageDimensionsCm?: { length: number; width: number; height: number };
  isAuthenticityGuaranteeEligible: boolean;
  authenticityHubAddress?: string;
  containsLithiumBattery?: boolean;
  batteryCount?: number;
  exactAssetId?: string;
  createdDate: string;
}

export interface GeneratedCustomsDocumentPayload {
  documentId: string;
  documentNameJa: string;
  templateVersion: string;
  isMandatory: boolean;
  status: 'GENERATED_READY' | 'DRAFT' | 'RETIRED';
  watchWorksheetData?: WatchWorksheetBreakdown;
  tscaStatement?: string;
  lithiumDeclaration?: string;
  customsInvoiceSummaryJa: string;
}

export interface ShipmentReadinessProvenance {
  reusedKnowledgeIds: string[];
  primaryRuleSource: string;
  authorityLevel: KnowledgeAuthorityLevel;
  ruleFreshnessGrade: RuleFreshnessGrade;
  customsZonosBasisJa: string;
  shippingCarrierReasonJa: string;
  isSafeAutomationApproved: boolean;
  evaluatedAt: string;
}

export interface ShipmentReadinessEvaluationResult {
  orderId: string;
  state: ShipmentReadinessState;
  stateLabelJa: string;
  canProceedToFutureExecution: boolean;
  nonReadyDetails?: NonReadyStateDetails;
  selectedCarrier: string;
  selectedServiceMethod: string;
  isDdpRecommended: boolean;
  estimatedShippingCostJpy: number;
  declaredPriceUsd: number;
  declaredPrice1ThirdUsd: number;
  bonusItemsDeclaredUsd: number;
  effectiveDeliveryAddress: string;
  isAuthenticityHubRouted: boolean;
  requiredDocuments: GeneratedCustomsDocumentPayload[];
  provenance: ShipmentReadinessProvenance;
  requiresHumanAction: boolean;
  humanActionPromptJa?: string;
}
