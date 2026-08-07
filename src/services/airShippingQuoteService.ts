import {
  AirShippingQuote,
  AirShippingOption,
  RevisionStrategy,
  AirUpgradeValidationResult
} from '../types/airShippingQuote';
import { loadShippingRegistry, calculateTotalSellerCost } from './shippingRegistryService';
import { DutyTerm } from '../types/shippingRegistry';

const QUOTES_STORAGE_KEY = 'zonos_air_shipping_quotes_v1';

/**
 * Load saved quotes
 */
export function loadAirShippingQuotes(): AirShippingQuote[] {
  try {
    const raw = localStorage.getItem(QUOTES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load air shipping quotes:', e);
    return [];
  }
}

/**
 * Save quotes
 */
export function saveAirShippingQuotes(quotes: AirShippingQuote[]): void {
  try {
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error('Failed to save air shipping quotes:', e);
  }
}

/**
 * Calculate Cheapest Eligible Air Shipping Option
 */
export function calculateCheapestAirOption(
  weightGrams: number,
  itemValueUsd: number,
  destinationCountry: string = 'United States (US)'
): { surfaceCostUsd: number; cheapestAirOption?: AirShippingOption; allAirOptions: AirShippingOption[] } {
  const registry = loadShippingRegistry();
  const surfaceCostUsd = 18.0; // Japan Post Surface Mail baseline cost

  const allAirOptions: AirShippingOption[] = [];

  for (const method of registry) {
    if (!method.isActive) continue;
    // Exclude surface mail from air options comparison
    if (method.methodId.includes('sea') || method.serviceName.includes('Surface')) continue;

    const isEligible =
      weightGrams <= method.maxWeightGrams &&
      itemValueUsd <= method.maxItemValueUsd &&
      method.dutyTermSupport.includes('DDP');

    const costBreakdown = calculateTotalSellerCost(method, weightGrams, itemValueUsd);
    const additionalCost = Math.max(0, parseFloat((costBreakdown.totalSellerCost - surfaceCostUsd).toFixed(2)));

    let estDelivery = '3–7 business days';
    if (method.serviceName.includes('EMS')) estDelivery = '5–10 business days';
    if (method.serviceName.includes('SpeedPAK')) estDelivery = '7–12 business days';

    allAirOptions.push({
      methodId: method.methodId,
      carrier: method.carrier,
      serviceName: method.serviceName,
      estimatedDeliveryText: estDelivery,
      airShippingCostUsd: costBreakdown.totalSellerCost,
      additionalCostUsd: additionalCost,
      rateSource: method.rateSource,
      comparisonTimestamp: new Date().toISOString(),
      isEligible,
      ineligibleReason: isEligible ? undefined : '重量または価格制限、またはDDP不可'
    });
  }

  const eligibleAir = allAirOptions.filter((o) => o.isEligible);
  let cheapestAirOption: AirShippingOption | undefined;

  if (eligibleAir.length > 0) {
    eligibleAir.sort((a, b) => a.airShippingCostUsd - b.airShippingCostUsd);
    cheapestAirOption = eligibleAir[0];
  }

  return {
    surfaceCostUsd,
    cheapestAirOption,
    allAirOptions
  };
}

/**
 * Generate Buyer-Facing Air Upgrade Note to Append to Listing Description
 */
export function generateBuyerAirUpgradeNote(airOption?: AirShippingOption): string {
  if (!airOption) return '';

  return `Need your order sooner?\n\nThe lowest available air shipping option is:\n${airOption.carrier} (${airOption.serviceName})\n\nEstimated delivery:\n${airOption.estimatedDeliveryText}\n\nAdditional shipping cost:\n+$${airOption.additionalCostUsd.toFixed(2)} USD\n\nPlease contact us before purchasing if you would like this shipping option.`;
}

/**
 * Generate Exact Buyer Response Message for Air Quote
 */
export function generateBuyerAirQuoteResponse(
  carrierName: string,
  estimatedDelivery: string,
  additionalAmountUsd: number
): string {
  return `Hello,\n\nThank you very much for your interest.\n\nThe lowest available air shipping option is:\n${carrierName}\n\nEstimated delivery:\n${estimatedDelivery}\n\nAdditional shipping cost:\n+$${additionalAmountUsd.toFixed(2)} USD\n\nIf you would like faster shipping, please contact me before purchasing.\n\nThank you very much.`;
}

/**
 * Generate Air Shipping Listing Title (Fallback C)
 * Format: "For {BuyerID} Air Shipping" (Max 80 chars)
 */
export function generateAirShippingListingTitle(buyerId: string): string {
  const cleanBuyer = (buyerId || 'Buyer').trim();
  const rawTitle = `For ${cleanBuyer} Air Shipping`;
  return rawTitle.length > 80 ? rawTitle.slice(0, 80) : rawTitle;
}

/**
 * Validate Air Quote Gate Before Creation
 */
export function validateAirQuoteGate(
  buyerId: string,
  originalListingId: string,
  selectedAccountId: string,
  dutyTerm: DutyTerm = 'DDP',
  isDdpVerified: boolean = true,
  airOption?: AirShippingOption
): AirUpgradeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const existingQuotes = loadAirShippingQuotes();

  if (!buyerId || !buyerId.trim()) {
    errors.push('バイヤーID (Buyer ID) が入力されていません。');
  }

  if (!originalListingId || !originalListingId.trim()) {
    errors.push('元出品ID (Original Listing ID) が指定されていません。');
  }

  if (!selectedAccountId) {
    errors.push('eBayアカウントが選択されていません。');
  }

  if (!airOption || !airOption.isEligible) {
    errors.push('利用可能な航空便配送サービスが見つかりません。');
  }

  if (dutyTerm === 'DDU') {
    errors.push('DDUは規約により禁止されています。DDP適合航空便を選択してください。');
  }

  if (!isDdpVerified) {
    errors.push('航空便のDDP検証が完了していません。');
  }

  // Check duplicate active quote
  const duplicate = existingQuotes.find(
    (q) => q.buyerId.toLowerCase() === (buyerId || '').toLowerCase() &&
           q.originalListingId === originalListingId &&
           q.status === 'active' &&
           new Date(q.expirationDate).getTime() > Date.now()
  );

  if (duplicate) {
    errors.push(`同一バイヤー (${buyerId}) 宛の有効な見積もり (${duplicate.quoteId}) が既に存在します。重複見積もりは防止されました。`);
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    buyerIdPresent: !!buyerId?.trim(),
    listingPresent: !!originalListingId?.trim(),
    accountMatched: !!selectedAccountId,
    serviceAvailable: !!airOption?.isEligible,
    rateValid: !!airOption && airOption.airShippingCostUsd > 0,
    isDdpVerified,
    hasProhibitedDdu: dutyTerm === 'DDU',
    errors,
    warnings
  };
}

/**
 * Create Air Shipping Quote (Stores Quote ID, Expiration, Strategy)
 */
export function createAirShippingQuote(
  buyerId: string,
  originalListingId: string,
  originalTitle: string,
  selectedAccountId: string,
  selectedAccountDisplayName: string,
  weightGrams: number,
  itemValueUsd: number,
  preferredStrategy: RevisionStrategy = 'revise_listing_options'
): { success: boolean; quote?: AirShippingQuote; error?: string } {
  const { surfaceCostUsd, cheapestAirOption } = calculateCheapestAirOption(weightGrams, itemValueUsd);

  const validation = validateAirQuoteGate(
    buyerId,
    originalListingId,
    selectedAccountId,
    'DDP',
    true,
    cheapestAirOption
  );

  if (!validation.isValid || !cheapestAirOption) {
    return { success: false, error: validation.errors.join(' ') };
  }

  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const randomSeq = Math.floor(1000 + Math.random() * 9000);
  const quoteId = `AIR-${dateStr}-${randomSeq}`;

  // 7-day expiration date
  const expDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const buyerMessage = generateBuyerAirQuoteResponse(
    `${cheapestAirOption.carrier} (${cheapestAirOption.serviceName})`,
    cheapestAirOption.estimatedDeliveryText,
    cheapestAirOption.additionalCostUsd
  );

  const preparedAirListingTitle = preferredStrategy === 'create_air_listing'
    ? generateAirShippingListingTitle(buyerId)
    : undefined;

  const newQuote: AirShippingQuote = {
    quoteId,
    createdAt: new Date().toISOString(),
    expirationDate: expDate,
    originalListingId,
    originalTitle,
    buyerId: buyerId.trim(),
    selectedAccountId,
    selectedAccountDisplayName,
    surfaceMailCostUsd: surfaceCostUsd,
    selectedAirOption: cheapestAirOption,
    revisionStrategy: preferredStrategy,
    status: 'active',
    buyerMessage,
    preparedAirListingTitle
  };

  const existing = loadAirShippingQuotes();
  saveAirShippingQuotes([newQuote, ...existing]);

  return { success: true, quote: newQuote };
}
