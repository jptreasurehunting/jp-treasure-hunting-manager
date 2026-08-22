/**
 * Shipping Decision Engine Core Types
 * Configurable, safe foundation for order shipping route decisions
 */

export type DestinationClassification =
  | 'DOMESTIC_JP'
  | 'INTERNATIONAL'
  | 'UNKNOWN_OR_INVALID';

export type ShippingRoute =
  | 'DOMESTIC_FLOW'
  | 'INTERNATIONAL_FLOW'
  | 'REVIEW_REQUIRED';

export type ShippingDecisionReasonCode =
  | 'DOMESTIC_JP_EBAY'
  | 'DOMESTIC_JP_GENERAL'
  | 'INTERNATIONAL_STANDARD'
  | 'MISSING_DESTINATION_COUNTRY'
  | 'INVALID_DESTINATION_COUNTRY'
  | 'AMBIGUOUS_DESTINATION_COUNTRY';

export type ConfigurationSource =
  | 'DEFAULT_RULE_ENGINE'
  | 'CONFIGURABLE_SHIPPING_SETTINGS'
  | 'DYNAMIC_OVERRIDE';

export type PackageProfile =
  | 'ENVELOPE_ELIGIBLE'
  | 'STANDARD_PACKAGE'
  | 'REQUIRES_DIMENSIONAL_CHECK'
  | 'REVIEW_REQUIRED';

/**
 * Configurable Shipping Decision Engine Settings Layer
 * Allows business rules (e.g. envelope eligibility for domestic orders) to be modified
 * without code changes.
 */
export interface ShippingDecisionConfig {
  /**
   * Rule 3: Controls whether domestic Japan orders are treated as envelope-size eligible by default.
   * Configurable and not hard-coded permanently.
   */
  allDomesticEnvelopeEligible: boolean;
  defaultDomesticPackageProfile: PackageProfile;
  defaultInternationalPackageProfile: PackageProfile;
  strictCountryCodeValidation: boolean;
  allowAmbiguousCountryInference: boolean; // Must be false to enforce "never guess" policy
}

/**
 * Input representation of order destination data.
 * Compatible with NormalizedFulfillmentOrder, NormalizedEbayOrder, or raw order payloads.
 */
export interface OrderDestinationInput {
  orderId: string;
  salesChannel?: string; // 'eBay', 'Mercari', etc.
  destinationCountryCode?: string; // e.g. 'JP', 'US', 'DE'
  destinationCountryName?: string; // e.g. 'Japan', 'United States', 'Germany'
  postalCode?: string;
  stateOrProvince?: string;
  city?: string;
  addressLine1?: string;
  addressLine2?: string;
  buyerName?: string;
}

/**
 * Comprehensive Decision Result from the Shipping Decision Engine
 */
export interface ShippingDecisionResult {
  route: ShippingRoute;
  destinationClassification: DestinationClassification;
  isDomestic: boolean;
  requiresCustoms: boolean;
  requiresZonos: boolean;
  requiresCPass: boolean;
  requiresDDP: boolean;
  packageProfile: PackageProfile;
  reasonCode: ShippingDecisionReasonCode;
  explanation: string;
  configurationSource: ConfigurationSource;
  evaluatedAt: string;
}
