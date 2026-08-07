import { ShippingMethod, DutyTerm } from './shippingRegistry';

export type AirQuoteStatus = 'active' | 'accepted' | 'expired' | 'revised' | 'cancelled';
export type RevisionStrategy = 'revise_listing_options' | 'revise_shipping_policy' | 'create_air_listing';

export interface AirShippingOption {
  methodId: string;
  carrier: string;
  serviceName: string;
  estimatedDeliveryText: string;
  airShippingCostUsd: number;
  additionalCostUsd: number; // Air Cost - Surface Mail Cost
  rateSource: string;
  comparisonTimestamp: string;
  isEligible: boolean;
  ineligibleReason?: string;
}

export interface AirShippingQuote {
  quoteId: string; // e.g. "AIR-20260807-0001"
  createdAt: string;
  expirationDate: string; // 7 days expiration
  originalListingId: string;
  originalTitle: string;
  buyerId: string;
  selectedAccountId: string;
  selectedAccountDisplayName: string;
  surfaceMailCostUsd: number;
  selectedAirOption: AirShippingOption;
  revisionStrategy: RevisionStrategy;
  status: AirQuoteStatus;
  buyerMessage: string;
  preparedAirListingTitle?: string;
}

export interface AirUpgradeValidationResult {
  isValid: boolean;
  buyerIdPresent: boolean;
  listingPresent: boolean;
  accountMatched: boolean;
  serviceAvailable: boolean;
  rateValid: boolean;
  isDdpVerified: boolean;
  hasProhibitedDdu: boolean;
  errors: string[];
  warnings: string[];
}
