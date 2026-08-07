import {
  ShippingMethod,
  DutyTerm,
  DdpClassification,
  ShippingFeeBreakdown,
  DeliveryEstimateRange,
  ShippingEvaluationResult,
  DdpListingValidationGate,
  ShippingAuditLogEntry
} from '../types/shippingRegistry';

const REGISTRY_STORAGE_KEY = 'zonos_shipping_method_registry_v2';
const AUDIT_STORAGE_KEY = 'zonos_shipping_audit_trail_v2';

/**
 * Initial Default Shipping Methods Registry
 */
export function getInitialShippingRegistry(): ShippingMethod[] {
  return [
    {
      methodId: 'ebay_eIS_std',
      carrier: 'eBay International Shipping (eIS)',
      serviceName: 'eBay International Standard DDP Delivery',
      aliases: ['eIS', 'eBay eIS', 'eBay International Shipping'],
      isEbayIntegrated: true,
      dutyTermSupport: ['DDP'],
      ddpHandler: 'ebay_integrated_ddp',
      zonosRequirement: 'not_required',
      supportedDestinationCountries: ['*'],
      excludedDestinationCountries: [],
      minWeightGrams: 1,
      maxWeightGrams: 20000, // 20kg
      maxDimensionCm: { length: 105, width: 60, height: 60, girth: 200 },
      maxItemValueUsd: 2500,
      restrictedCategories: ['Hazardous Goods', 'Perishables'],
      trackingLevel: 'full_end_to_end',
      insuranceLevel: 'full',
      signatureAvailable: true,
      rateSource: '1_official_ebay_api',
      transitTimeSource: 'eBay eIS Analytics 2026',
      isActive: true,
      effectiveStartDate: '2026-01-01',
      lastSynchronizedTime: new Date().toISOString(),
      notes: 'eBay公式統合DDPサービス。Zonos不要。'
    },
    {
      methodId: 'ebay_eIS_express',
      carrier: 'eBay International Shipping (eIS)',
      serviceName: 'eBay International Express DDP',
      aliases: ['eIS Express', 'eBay Express DDP'],
      isEbayIntegrated: true,
      dutyTermSupport: ['DDP'],
      ddpHandler: 'ebay_integrated_ddp',
      zonosRequirement: 'not_required',
      supportedDestinationCountries: ['*'],
      excludedDestinationCountries: [],
      minWeightGrams: 1,
      maxWeightGrams: 30000, // 30kg
      maxDimensionCm: { length: 120, width: 70, height: 70, girth: 250 },
      maxItemValueUsd: 5000,
      restrictedCategories: ['Hazardous Goods'],
      trackingLevel: 'full_end_to_end',
      insuranceLevel: 'full',
      signatureAvailable: true,
      rateSource: '1_official_ebay_api',
      transitTimeSource: 'eBay eIS Express 2026',
      isActive: true,
      effectiveStartDate: '2026-01-01',
      lastSynchronizedTime: new Date().toISOString(),
      notes: 'eBay公式特急DDPサービス。Zonos不要。'
    },
    {
      methodId: 'japanpost_zonos_prepay',
      carrier: 'Japan Post (日本郵政)',
      serviceName: '国際小包 / EMS + Zonos Prepay DDP',
      aliases: ['Japan Post Zonos', '日本郵政 Zonos', 'JP Post DDP'],
      isEbayIntegrated: false,
      dutyTermSupport: ['DDP'],
      ddpHandler: 'seller_managed_zonos',
      zonosRequirement: 'required',
      supportedDestinationCountries: ['*'],
      excludedDestinationCountries: [],
      minWeightGrams: 1,
      maxWeightGrams: 30000, // 30kg
      maxDimensionCm: { length: 150, width: 80, height: 80, girth: 300 },
      maxItemValueUsd: 10000,
      restrictedCategories: ['Batteries'],
      trackingLevel: 'full_end_to_end',
      insuranceLevel: 'full',
      signatureAvailable: true,
      rateSource: '3_account_contract_data',
      transitTimeSource: 'Japan Post & Zonos Prepay API 2026',
      isActive: true,
      effectiveStartDate: '2026-01-01',
      lastSynchronizedTime: new Date().toISOString(),
      notes: '日本郵政自己手配発送。Zonos Prepayによる事前DDP決済必須。'
    },
    {
      methodId: 'fedex_connect_plus_ddp',
      carrier: 'FedEx',
      serviceName: 'FedEx International Connect Plus (FICP) DDP',
      aliases: ['FedEx DDP', 'FedEx FICP'],
      isEbayIntegrated: false,
      dutyTermSupport: ['DDP'],
      ddpHandler: 'carrier_managed_ddp',
      zonosRequirement: 'not_required',
      supportedDestinationCountries: ['*'],
      excludedDestinationCountries: [],
      minWeightGrams: 1,
      maxWeightGrams: 68000, // 68kg
      maxDimensionCm: { length: 274, width: 100, height: 100, girth: 330 },
      maxItemValueUsd: 50000,
      restrictedCategories: [],
      trackingLevel: 'full_end_to_end',
      insuranceLevel: 'full',
      signatureAvailable: true,
      rateSource: '2_official_carrier_api',
      transitTimeSource: 'FedEx Web API 2026',
      isActive: true,
      effectiveStartDate: '2026-01-01',
      lastSynchronizedTime: new Date().toISOString(),
      notes: 'FedExキャリア直売DDPサービス。'
    },
    {
      methodId: 'japanpost_standard_ddu',
      carrier: 'Japan Post (日本郵政)',
      serviceName: '国際小包 DDU (一般無申告) — 【出品禁止】',
      aliases: ['JP Post DDU', '日本郵政 DDU'],
      isEbayIntegrated: false,
      dutyTermSupport: ['DDU'],
      ddpHandler: 'ddu_prohibited',
      zonosRequirement: 'prohibited',
      supportedDestinationCountries: ['*'],
      excludedDestinationCountries: [],
      minWeightGrams: 1,
      maxWeightGrams: 30000,
      maxDimensionCm: { length: 150, width: 80, height: 80, girth: 300 },
      maxItemValueUsd: 10000,
      restrictedCategories: [],
      trackingLevel: 'basic',
      insuranceLevel: 'optional',
      signatureAvailable: false,
      rateSource: '4_configurable_rate_table',
      transitTimeSource: 'Japan Post',
      isActive: true,
      effectiveStartDate: '2026-01-01',
      lastSynchronizedTime: new Date().toISOString(),
      notes: 'DDU（受取人着払い関税）はポリシーにより完全禁止です。'
    }
  ];
}

/**
 * Load Shipping Method Registry
 */
export function loadShippingRegistry(): ShippingMethod[] {
  try {
    const raw = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (!raw) return getInitialShippingRegistry();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialShippingRegistry();
  } catch (e) {
    console.error('Failed to load shipping registry:', e);
    return getInitialShippingRegistry();
  }
}

/**
 * Save Shipping Method Registry
 */
export function saveShippingRegistry(registry: ShippingMethod[]): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Failed to save shipping registry:', e);
  }
}

/**
 * Calculate Total Seller Cost for a shipping method
 */
export function calculateTotalSellerCost(
  method: ShippingMethod,
  weightGrams: number,
  itemValueUsd: number
): ShippingFeeBreakdown {
  // Base rates estimate based on weight and method
  let base = 15.0;
  let fuelRate = 0.12; // 12%
  let ddpHandling = 0.0;
  let insurance = 0.0;
  let signature = 0.0;

  if (method.methodId.includes('eIS')) {
    base = 18.0 + (weightGrams / 500) * 3.5;
    fuelRate = 0.08;
    ddpHandling = 2.50; // eBay DDP fee included
  } else if (method.methodId.includes('zonos')) {
    base = 14.0 + (weightGrams / 500) * 2.8;
    fuelRate = 0.10;
    ddpHandling = 3.00; // Zonos Prepay fee
  } else if (method.carrier === 'FedEx') {
    base = 25.0 + (weightGrams / 500) * 4.2;
    fuelRate = 0.18;
    ddpHandling = 5.00;
  }

  if (itemValueUsd > 100) {
    insurance = Math.round(itemValueUsd * 0.01 * 100) / 100; // 1%
  }
  if (itemValueUsd >= 750) {
    signature = 5.00; // Signature required for high-value items
  }

  const fuel = base * fuelRate;
  const remote = 0.0;
  const oversize = weightGrams > 10000 ? 15.0 : 0.0;
  const mandatoryOther = 0.0;

  const total = base + fuel + remote + oversize + insurance + signature + ddpHandling + mandatoryOther;

  return {
    baseShippingCharge: parseFloat(base.toFixed(2)),
    fuelSurcharge: parseFloat(fuel.toFixed(2)),
    remoteAreaSurcharge: remote,
    oversizeSurcharge: oversize,
    insuranceFee: insurance,
    signatureFee: signature,
    ddpCustomsHandlingCharge: ddpHandling,
    otherMandatoryFees: mandatoryOther,
    totalSellerCost: parseFloat(total.toFixed(2)),
    currency: 'USD'
  };
}

/**
 * Calculate Delivery Estimate Range with 3 Distinct Models
 */
export function calculateDeliveryEstimateRange(
  method: ShippingMethod,
  destinationCountry: string
): DeliveryEstimateRange {
  let stdMin = 7;
  let stdMax = 14;

  if (method.serviceName.includes('Express') || method.carrier === 'FedEx') {
    stdMin = 3;
    stdMax = 6;
  } else if (method.serviceName.includes('eIS')) {
    stdMin = 6;
    stdMax = 12;
  }

  const normalMin = stdMin + 1;
  const normalMax = stdMax + 2;
  const delayMin = stdMin + 2;
  const delayMax = stdMax + 5;

  return {
    carrierStandardTransitDays: { min: stdMin, max: stdMax },
    normalEstimatedDeliveryDays: { min: normalMin, max: normalMax },
    conservativeDelayAwareDays: { min: delayMin, max: delayMax },
    source: `${method.carrier} Analytics & Delay Buffer (2026)`,
    calculatedTime: new Date().toLocaleString('ja-JP'),
    confidenceScore: 0.92,
    includesCustomsDelay: true
  };
}

/**
 * Find Cheapest Eligible DDP Shipping Method
 */
export function findCheapestEligibleDdpMethod(
  weightGrams: number,
  dimensionsCm: { length: number; width: number; height: number },
  destinationCountry: string,
  itemValueUsd: number,
  categoryName: string = ''
): {
  recommended?: ShippingEvaluationResult;
  allEvaluations: ShippingEvaluationResult[];
  noEligibleEbayIntegrated: boolean;
  japaneseErrorMessage?: string;
} {
  const registry = loadShippingRegistry();
  const allEvaluations: ShippingEvaluationResult[] = [];

  const girthCm = dimensionsCm.length + (dimensionsCm.width + dimensionsCm.height) * 2;

  for (const method of registry) {
    if (!method.isActive) continue;

    const ineligibleReasons: string[] = [];

    // Rule 1: Must support DDP
    if (!method.dutyTermSupport.includes('DDP') || method.ddpHandler === 'ddu_prohibited') {
      ineligibleReasons.push('DDUは規約により禁止されています（DDP必須）。');
    }

    // Rule 2: Weight check
    if (weightGrams < method.minWeightGrams || weightGrams > method.maxWeightGrams) {
      ineligibleReasons.push(`重量 (${weightGrams}g) が許容範囲 (${method.minWeightGrams}g - ${method.maxWeightGrams}g) を超えています。`);
    }

    // Rule 3: Dimension check
    if (
      dimensionsCm.length > method.maxDimensionCm.length ||
      dimensionsCm.width > method.maxDimensionCm.width ||
      dimensionsCm.height > method.maxDimensionCm.height ||
      girthCm > method.maxDimensionCm.girth
    ) {
      ineligibleReasons.push(`サイズ (長辺 ${dimensionsCm.length}cm / 最長胴回り ${girthCm}cm) が制限を超えています。`);
    }

    // Rule 4: Value check
    if (itemValueUsd > method.maxItemValueUsd) {
      ineligibleReasons.push(`商品価格 ($${itemValueUsd}) が上限 ($${method.maxItemValueUsd}) を超えています。`);
    }

    // Rule 5: Category check
    if (categoryName && method.restrictedCategories.some((c) => categoryName.toLowerCase().includes(c.toLowerCase()))) {
      ineligibleReasons.push(`カテゴリー (${categoryName}) は本配送方法で制限されています。`);
    }

    const isEligible = ineligibleReasons.length === 0;
    const costBreakdown = calculateTotalSellerCost(method, weightGrams, itemValueUsd);
    const deliveryRange = calculateDeliveryEstimateRange(method, destinationCountry);

    allEvaluations.push({
      method,
      isEligible,
      ineligibleReasons,
      costBreakdown,
      deliveryRange,
      isRecommended: false,
      requiresZonos: method.zonosRequirement === 'required'
    });
  }

  // Filter eligible eBay-integrated methods
  const eligibleEbayIntegrated = allEvaluations.filter(
    (e) => e.isEligible && e.method.isEbayIntegrated && e.method.ddpHandler === 'ebay_integrated_ddp'
  );

  let recommended: ShippingEvaluationResult | undefined;
  let noEligibleEbayIntegrated = false;
  let japaneseErrorMessage: string | undefined;

  if (eligibleEbayIntegrated.length > 0) {
    // Sort by total seller cost ascending
    eligibleEbayIntegrated.sort((a, b) => a.costBreakdown.totalSellerCost - b.costBreakdown.totalSellerCost);
    recommended = eligibleEbayIntegrated[0];
    recommended.isRecommended = true;
  } else {
    noEligibleEbayIntegrated = true;
    japaneseErrorMessage = 'eBay連携配送では、この荷物のサイズ・重量を取り扱えません。自己手配配送を比較します。';

    // Fallback: Filter all eligible DDP methods (including seller-managed / Zonos / FedEx)
    const eligibleAllDdp = allEvaluations.filter((e) => e.isEligible);
    if (eligibleAllDdp.length > 0) {
      eligibleAllDdp.sort((a, b) => a.costBreakdown.totalSellerCost - b.costBreakdown.totalSellerCost);
      recommended = eligibleAllDdp[0];
      recommended.isRecommended = true;
    }
  }

  return {
    recommended,
    allEvaluations,
    noEligibleEbayIntegrated,
    japaneseErrorMessage
  };
}

/**
 * Validate Listing Publication Gate (Strict DDP & Shipping Verification)
 */
export function validateListingPublicationGate(
  isDomestic: boolean,
  dutyTerm: DutyTerm,
  method?: ShippingMethod,
  weightGrams: number = 0,
  dimensionsCm: { length: number; width: number; height: number } = { length: 0, width: 0, height: 0 },
  zonosValidated: boolean = false
): DdpListingValidationGate {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isDomestic) {
    return {
      isValid: true,
      isDomestic: true,
      dutyTerm: 'DDP',
      ddpClassification: 'ebay_integrated_ddp',
      canPublish: true,
      errors: [],
      warnings: ['日本国内発送のためDDP/関税規定は適用除外です。'],
      zonosValidated: true,
      ddpNoticeInserted: false
    };
  }

  // International Shipment DDP Enforcement
  if (dutyTerm === 'DDU') {
    errors.push('DDUでは出品できません。DDP対応の配送方法を選択してください。');
  } else if (dutyTerm === 'UNKNOWN') {
    errors.push('関税条件が確認できないため、出品を停止しました。');
  }

  if (!method) {
    errors.push('配送方法が選択されていません。');
  } else {
    if (method.dutyTermSupport.includes('DDU') && method.ddpHandler === 'ddu_prohibited') {
      errors.push('DDUでは出品できません。DDP対応の配送方法を選択してください。');
    }

    if (method.zonosRequirement === 'required' && !zonosValidated) {
      errors.push('日本郵政発送（自己手配）には Zonos Prepay の事前申告検証が必要です。');
    }
  }

  if (weightGrams <= 0 || dimensionsCm.length <= 0) {
    warnings.push('梱包後重量・サイズが未入力です。実測値を入力してください。');
  }

  const isValid = errors.length === 0;
  const ddpClassification = method ? method.ddpHandler : 'unknown';

  return {
    isValid,
    isDomestic: false,
    dutyTerm,
    ddpClassification,
    selectedMethod: method,
    canPublish: isValid,
    errors,
    warnings,
    zonosValidated,
    ddpNoticeInserted: isValid
  };
}

/**
 * Generate Buyer-Facing DDP Listing Description Wording
 */
export function generateDdpListingNoticeWording(
  variant: 'preferred' | 'short' | 'shortest' = 'preferred'
): string {
  switch (variant) {
    case 'preferred':
      return 'This item will be shipped DDP (Delivered Duty Paid). Import duties and taxes are prepaid, so you will not be required to pay them upon delivery.';
    case 'short':
      return 'DDP shipping: Import duties and taxes are prepaid. No duty or tax payment is required upon delivery.';
    case 'shortest':
      return 'Shipped DDP. Import duties and taxes are prepaid.';
  }
}

/**
 * Audit Trail Logging for Shipping Decisions
 */
export function recordShippingAuditLog(entry: Omit<ShippingAuditLogEntry, 'id' | 'timestamp'>): void {
  try {
    const newRecord: ShippingAuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    const existing: ShippingAuditLogEntry[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([newRecord, ...existing]));
  } catch (e) {
    console.error('Failed to record shipping audit log:', e);
  }
}
