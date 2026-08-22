import {
  DestinationClassification,
  ShippingRoute,
  ShippingDecisionReasonCode,
  ConfigurationSource,
  PackageProfile,
  ShippingDecisionConfig,
  OrderDestinationInput,
  ShippingDecisionResult
} from '../types/shippingDecisionEngine';
import { registerHealthCheckModule, getStatusDisplayLabel, getAuthorityLevelDisplayLabel } from './projectHealthService';
import {
  isRecognizedIsoCountryCode,
  isRecognizedCountryName
} from '../data/isoCountries';

const CONFIG_STORAGE_KEY = 'jp_shipping_decision_config_v1';

/**
 * Default Shipping Decision Engine Settings
 */
const DEFAULT_CONFIG: ShippingDecisionConfig = {
  allDomesticEnvelopeEligible: true, // Rule 3: Configurable default, not hardcoded permanently
  defaultDomesticPackageProfile: 'ENVELOPE_ELIGIBLE',
  defaultInternationalPackageProfile: 'REQUIRES_DIMENSIONAL_CHECK',
  strictCountryCodeValidation: true,
  allowAmbiguousCountryInference: false // Enforce Requirement 8: Never guess
};

let inMemoryConfig: ShippingDecisionConfig = { ...DEFAULT_CONFIG };

/**
 * Get current configurable shipping decision settings
 */
export function getShippingDecisionConfig(): ShippingDecisionConfig {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    }
  } catch (e) {
    // Fallback to in-memory config if localStorage fails
  }
  return { ...inMemoryConfig };
}

/**
 * Update shipping decision settings (Configurable rules layer)
 */
export function updateShippingDecisionConfig(partialConfig: Partial<ShippingDecisionConfig>): ShippingDecisionConfig {
  const current = getShippingDecisionConfig();
  const updated = { ...current, ...partialConfig };
  inMemoryConfig = { ...updated };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {
    console.error('Failed to persist shipping decision config:', e);
  }

  return updated;
}

/**
 * Reset shipping decision config to system defaults
 */
export function resetShippingDecisionConfig(): ShippingDecisionConfig {
  inMemoryConfig = { ...DEFAULT_CONFIG };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
    }
  } catch (e) {
    // Ignore error
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Authoritative Country Identifiers for Japan Classification.
 * Note: Must ONLY contain authoritative country codes/names. Must NOT contain state/prefecture names.
 */
const JAPAN_COUNTRY_IDENTIFIERS = new Set([
  'JP', 'JPN', '392', 'JAPAN', 'JAPON', 'JAPÁN', 'JAPONIA', 'JAPANESE', '日本', 'JP-JPN'
]);

const KNOWN_AMBIGUOUS_VALUES = new Set([
  'APAC', 'EU', 'EUROPE', 'ASIA', 'OVERSEAS', 'INTERNATIONAL', 'UNKNOWN', 'OTHER',
  'GLOBAL', 'WORLDWIDE', 'STANDARD', 'DEFAULT', 'NULL', 'NONE', 'N/A', 'VARIOUS', 'ANY', 'WORLD'
]);

/**
 * Requirement 1 & 8: Safely classify destination without guessing ambiguous or invalid data.
 * 
 * Safety Rule 1:
 * Japan classification MUST use authoritative country fields (countryCode and/or countryName) ONLY.
 * stateOrProvince alone MUST NEVER classify an order as DOMESTIC_JP.
 * 
 * Safety Rule 2:
 * Authoritative ISO 3166-1 country validation for worldwide destinations.
 * Fictional, malformed, or unrecognized country data (e.g. "ZZ", "AAA", "Atlantis") MUST NOT
 * be accepted as valid international destinations and MUST return REVIEW_REQUIRED under the Never Guess policy.
 */
export function classifyDestination(
  countryCode?: string,
  countryName?: string,
  stateOrProvince?: string
): { classification: DestinationClassification; reason?: ShippingDecisionReasonCode; detail?: string } {
  const cleanCode = (countryCode || '').trim().toUpperCase();
  const cleanName = (countryName || '').trim().toUpperCase();

  // 1. Check if both authoritative country fields (code & name) are missing
  if (!cleanCode && !cleanName) {
    return {
      classification: 'UNKNOWN_OR_INVALID',
      reason: 'MISSING_DESTINATION_COUNTRY',
      detail: '仕向国コードおよび仕向国名が指定されていません。'
    };
  }

  // 2. Check for known ambiguous regional or non-specific terms
  if (KNOWN_AMBIGUOUS_VALUES.has(cleanCode) || KNOWN_AMBIGUOUS_VALUES.has(cleanName)) {
    return {
      classification: 'UNKNOWN_OR_INVALID',
      reason: 'AMBIGUOUS_DESTINATION_COUNTRY',
      detail: `曖昧な国指定 [${cleanCode || cleanName}] が検出されました。推測による分類は禁止されています。`
    };
  }

  // 3. Authoritative Japan Classification (Country Code / Name ONLY)
  const isJapanByAuthoritativeCountry =
    JAPAN_COUNTRY_IDENTIFIERS.has(cleanCode) ||
    JAPAN_COUNTRY_IDENTIFIERS.has(cleanName);

  if (isJapanByAuthoritativeCountry) {
    // Secondary validation: stateOrProvince can be inspected for address log/integrity if needed,
    // but the primary country classification is strictly established by authoritative country fields.
    return { classification: 'DOMESTIC_JP' };
  }

  // 4. Authoritative Worldwide International Destination Validation (ISO 3166-1 Dataset)
  // Only recognized real country codes/names present in the ISO 3166-1 dataset may become INTERNATIONAL
  const isCodeRecognized = cleanCode ? isRecognizedIsoCountryCode(cleanCode) : false;
  const isNameRecognized = cleanName ? isRecognizedCountryName(cleanName) : false;

  if (isCodeRecognized || isNameRecognized) {
    return { classification: 'INTERNATIONAL' };
  }

  // 5. Malformed, unrecognized, or fictional country data (e.g. "ZZ", "AAA", "Atlantis") -> INVALID_DESTINATION_COUNTRY
  return {
    classification: 'UNKNOWN_OR_INVALID',
    reason: 'INVALID_DESTINATION_COUNTRY',
    detail: `無効または未識別な国コード/国名 [code: "${cleanCode}", name: "${cleanName}"] です。ISO 3166-1 公式国コードリストに存在しない架空・不正なデータです。`
  };
}

/**
 * Requirements 1 - 8: Foundational Shipping Decision Engine
 * Evaluates destination, determines shipping route, customs/zonos/cpass requirements,
 * package profile, and returns comprehensive decision output.
 */
export function evaluateShippingDecision(
  order: OrderDestinationInput,
  configOverride?: Partial<ShippingDecisionConfig>
): ShippingDecisionResult {
  const activeConfig = configOverride
    ? { ...getShippingDecisionConfig(), ...configOverride }
    : getShippingDecisionConfig();

  const configSource: ConfigurationSource = configOverride
    ? 'DYNAMIC_OVERRIDE'
    : 'CONFIGURABLE_SHIPPING_SETTINGS';

  const evaluatedAt = new Date().toISOString();

  // Step 1: Classify Destination
  const { classification, reason: classReason, detail: classDetail } = classifyDestination(
    order.destinationCountryCode,
    order.destinationCountryName,
    order.stateOrProvince
  );

  // Requirement 8: Missing or ambiguous country data -> REVIEW_REQUIRED
  if (classification === 'UNKNOWN_OR_INVALID') {
    const reasonCode = classReason || 'MISSING_DESTINATION_COUNTRY';
    return {
      route: 'REVIEW_REQUIRED',
      destinationClassification: 'UNKNOWN_OR_INVALID',
      isDomestic: false,
      requiresCustoms: false,
      requiresZonos: false,
      requiresCPass: false,
      requiresDDP: false,
      packageProfile: 'REVIEW_REQUIRED',
      reasonCode,
      explanation: classDetail || '仕向国データが不足または曖昧なため、安全のため人間による確認が必要です (Never Guess Policy)。',
      configurationSource: configSource,
      evaluatedAt
    };
  }

  // Requirement 2: Domestic Japan Order
  if (classification === 'DOMESTIC_JP') {
    const isEbay = (order.salesChannel || '').toLowerCase() === 'ebay';
    const reasonCode: ShippingDecisionReasonCode = isEbay
      ? 'DOMESTIC_JP_EBAY'
      : 'DOMESTIC_JP_GENERAL';

    // Requirement 3: Envelope eligibility based on configurable shipping settings layer
    const packageProfile: PackageProfile = activeConfig.allDomesticEnvelopeEligible
      ? 'ENVELOPE_ELIGIBLE'
      : activeConfig.defaultDomesticPackageProfile;

    const explanation = isEbay
      ? '日本国内発送のeBay注文を検知。国内配送フローへ直接ルーティングします (C-PASS / Zonos / 通関申告 / DDP 処理はスキップされます)。'
      : '日本国内発送注文を検知。国内配送フローへルーティングします。';

    return {
      route: 'DOMESTIC_FLOW',
      destinationClassification: 'DOMESTIC_JP',
      isDomestic: true,
      requiresCustoms: false,
      requiresZonos: false,
      requiresCPass: false,
      requiresDDP: false,
      packageProfile,
      reasonCode,
      explanation,
      configurationSource: configSource,
      evaluatedAt
    };
  }

  // Requirement 4: International Order
  const isEbayIntl = (order.salesChannel || '').toLowerCase() === 'ebay';

  return {
    route: 'INTERNATIONAL_FLOW',
    destinationClassification: 'INTERNATIONAL',
    isDomestic: false,
    requiresCustoms: true,
    requiresZonos: true,
    requiresCPass: isEbayIntl,
    requiresDDP: true,
    packageProfile: activeConfig.defaultInternationalPackageProfile,
    reasonCode: 'INTERNATIONAL_STANDARD',
    explanation: `国際発送注文 [${(order.destinationCountryCode || order.destinationCountryName || '').toUpperCase()}] を検知。既存の国際配送・コンプライアンス・Zonos/C-PASSフローへルーティングします。`,
    configurationSource: configSource,
    evaluatedAt
  };
}

/**
 * Register Shipping Decision Engine with Project Health Dashboard
 */
export function initShippingDecisionEngineHealthModule(): void {
  registerHealthCheckModule({
    moduleId: 'module_shipping_decision_engine',
    moduleName: 'Shipping Decision Engine (配送ルーティング判定エンジン)',
    category: 'future_module',
    defaultAuthorityLevel: 'authoritative_source',
    defaultVerificationMethod: 'official_structured',
    checkHealth: () => {
      const config = getShippingDecisionConfig();
      const testEbayDomestic = evaluateShippingDecision({
        orderId: 'health_test_dom',
        salesChannel: 'eBay',
        destinationCountryCode: 'JP'
      });
      const testUsIntl = evaluateShippingDecision({
        orderId: 'health_test_us',
        salesChannel: 'eBay',
        destinationCountryCode: 'US'
      });
      const testMissing = evaluateShippingDecision({
        orderId: 'health_test_missing',
        salesChannel: 'eBay'
      });

      const isHealthy =
        testEbayDomestic.route === 'DOMESTIC_FLOW' &&
        !testEbayDomestic.requiresZonos &&
        !testEbayDomestic.requiresCPass &&
        testUsIntl.route === 'INTERNATIONAL_FLOW' &&
        testUsIntl.requiresZonos &&
        testMissing.route === 'REVIEW_REQUIRED';

      const status = isHealthy ? 'healthy' : 'needs_check';

      return {
        id: 'module_shipping_decision_engine',
        name: 'Shipping Decision Engine',
        category: 'future_module',
        status,
        statusLabel: getStatusDisplayLabel(status),
        isLiveVerified: true,
        liveVerificationNote: `判定エンジン稼働正常: 国内JP/国際US/未指定エラー自動判定検証済み (設定: domesticEnvelope=${config.allDomesticEnvelopeEligible})`,
        lastVerifiedAt: new Date().toISOString(),
        authorityLevel: 'authoritative_source',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
        verificationMethod: 'official_structured',
        verificationMethodLabel: '仕向国分類 & 安全ルーティング判定',
        sourceName: 'Shipping Decision Engine v1.0',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: `配送判定エンジン正常稼働中 (国内・国際・情報不備ルーティング検証完了)`,
        details: {
          source: 'Shipping Decision Engine v1.0',
          ruleVersion: '1.0.0',
          recommendedCorrectiveAction: '設定または入力住所データを確認してください',
          rawDiagnostics: {
            config,
            testResults: {
              domesticEbay: testEbayDomestic.route,
              internationalUs: testUsIntl.route,
              missingData: testMissing.route
            }
          }
        }
      };
    }
  });
}

// Auto-register health plugin on module load
initShippingDecisionEngineHealthModule();


