export type DutyTerm = 'DDP' | 'DDU' | 'UNKNOWN';

export type DdpClassification =
  | 'ebay_integrated_ddp'
  | 'carrier_managed_ddp'
  | 'seller_managed_zonos'
  | 'ddu_prohibited'
  | 'unknown';

export type ZonosRequirement = 'not_required' | 'required' | 'prohibited';

export type RateSourceLevel =
  | '1_official_ebay_api'
  | '2_official_carrier_api'
  | '3_account_contract_data'
  | '4_configurable_rate_table'
  | '5_browser_automation'
  | '6_manual_confirmation';

export interface ShippingMethod {
  methodId: string;
  carrier: string;
  serviceName: string;
  aliases: string[];
  isEbayIntegrated: boolean;
  dutyTermSupport: DutyTerm[];
  ddpHandler: DdpClassification;
  zonosRequirement: ZonosRequirement;
  supportedDestinationCountries: string[]; // ['*'] for all
  excludedDestinationCountries: string[];
  minWeightGrams: number;
  maxWeightGrams: number;
  maxDimensionCm: { length: number; width: number; height: number; girth: number };
  maxItemValueUsd: number;
  restrictedCategories: string[];
  trackingLevel: 'full_end_to_end' | 'basic' | 'none';
  insuranceLevel: 'full' | 'partial' | 'optional' | 'none';
  signatureAvailable: boolean;
  rateSource: RateSourceLevel;
  transitTimeSource: string;
  isActive: boolean;
  effectiveStartDate: string;
  effectiveEndDate?: string;
  lastSynchronizedTime: string;
  notes?: string;
}

export interface ShippingFeeBreakdown {
  baseShippingCharge: number;
  fuelSurcharge: number;
  remoteAreaSurcharge: number;
  oversizeSurcharge: number;
  insuranceFee: number;
  signatureFee: number;
  ddpCustomsHandlingCharge: number;
  otherMandatoryFees: number;
  totalSellerCost: number;
  currency: string;
}

export interface DeliveryEstimateRange {
  carrierStandardTransitDays: { min: number; max: number };
  normalEstimatedDeliveryDays: { min: number; max: number };
  conservativeDelayAwareDays: { min: number; max: number };
  source: string;
  calculatedTime: string;
  confidenceScore: number; // 0.0 - 1.0
  includesCustomsDelay: boolean;
}

export interface ShippingEvaluationResult {
  method: ShippingMethod;
  isEligible: boolean;
  ineligibleReasons: string[];
  costBreakdown: ShippingFeeBreakdown;
  deliveryRange: DeliveryEstimateRange;
  isRecommended: boolean;
  requiresZonos: boolean;
}

export interface DdpListingValidationGate {
  isValid: boolean;
  isDomestic: boolean;
  dutyTerm: DutyTerm;
  ddpClassification: DdpClassification;
  selectedMethod?: ShippingMethod;
  canPublish: boolean;
  errors: string[];
  warnings: string[];
  zonosValidated: boolean;
  ddpNoticeWording?: string;
  ddpNoticeInserted: boolean;
}

export interface ShippingAuditLogEntry {
  id: string;
  timestamp: string;
  listingId?: string;
  orderId?: string;
  destinationCountry: string;
  weightGrams: number;
  consideredMethodsCount: number;
  excludedMethods: Array<{ methodId: string; reason: string }>;
  selectedMethodId: string;
  totalSellerCost: number;
  dutyTermDecision: DutyTerm;
  zonosDecision: ZonosRequirement;
  ddpNoticeWordingSelected?: string;
  ddpNoticeEdited: boolean;
  userConfirmed: boolean;
  approvedBy: string;
}
