export const EBAY_REST_REQUEST_HEADERS_SOURCE_URL = 'https://developer.ebay.com/develop/api/sell/request_headers';

export const EBAY_REST_MARKETPLACE_LOCALES: Record<string, readonly string[]> = {
  EBAY_US: ['en-US'],
  EBAY_MOTORS_US: ['en-US'],
  EBAY_AT: ['de-AT'],
  EBAY_AU: ['en-AU'],
  EBAY_BE: ['nl-BE', 'fr-BE'],
  EBAY_CA: ['en-CA', 'fr-CA'],
  EBAY_CH: ['de-CH'],
  EBAY_DE: ['de-DE'],
  EBAY_ES: ['es-ES'],
  EBAY_FR: ['fr-FR'],
  EBAY_GB: ['en-GB'],
  EBAY_HK: ['zh-HK'],
  EBAY_IE: ['en-IE'],
  EBAY_IT: ['it-IT'],
  EBAY_MY: ['en-US'],
  EBAY_NL: ['nl-NL'],
  EBAY_PH: ['en-PH'],
  EBAY_PL: ['pl-PL'],
  EBAY_SG: ['en-US'],
  EBAY_TW: ['zh-TW']
};

export interface EbayMarketplaceLocaleEvaluation {
  marketplaceId: string;
  contentLanguage: string;
  supportedLocales: string[];
  marketplaceKnown: boolean;
  contentLanguageSupported: boolean;
  requiresExplicitLocaleChoice: boolean;
  suggestedContentLanguage?: string;
  sourceUrl: string;
  reasonsJa: string[];
}

function normalize(value: string): string {
  return value.trim();
}

export function getSupportedEbayContentLanguages(marketplaceId: string): string[] {
  const normalizedMarketplaceId = normalize(marketplaceId).toUpperCase();
  return [...(EBAY_REST_MARKETPLACE_LOCALES[normalizedMarketplaceId] ?? [])];
}

export function getSuggestedEbayContentLanguage(marketplaceId: string): string | undefined {
  const supported = getSupportedEbayContentLanguages(marketplaceId);
  return supported.length === 1 ? supported[0] : undefined;
}

export function evaluateEbayMarketplaceContentLanguage(
  marketplaceId: string,
  contentLanguage: string
): EbayMarketplaceLocaleEvaluation {
  const normalizedMarketplaceId = normalize(marketplaceId).toUpperCase();
  const normalizedContentLanguage = normalize(contentLanguage);
  const supportedLocales = getSupportedEbayContentLanguages(normalizedMarketplaceId);
  const marketplaceKnown = supportedLocales.length > 0;
  const contentLanguageSupported = marketplaceKnown && supportedLocales.includes(normalizedContentLanguage);
  const reasonsJa: string[] = [];

  if (!normalizedMarketplaceId) {
    reasonsJa.push('eBay MarketplaceIdが未入力です。');
  } else if (!marketplaceKnown) {
    reasonsJa.push('このMarketplaceIdは現在のeBay REST公式Marketplace/Locale対応表で確認できていません。公式情報を再確認してください。');
  }

  if (!normalizedContentLanguage) {
    reasonsJa.push('Content-Languageが未入力です。');
  } else if (marketplaceKnown && !contentLanguageSupported) {
    reasonsJa.push(`Content-Language「${normalizedContentLanguage}」は${normalizedMarketplaceId}の公式対応Localeではありません。対応値: ${supportedLocales.join(', ')}`);
  }

  return {
    marketplaceId: normalizedMarketplaceId,
    contentLanguage: normalizedContentLanguage,
    supportedLocales,
    marketplaceKnown,
    contentLanguageSupported,
    requiresExplicitLocaleChoice: supportedLocales.length > 1,
    suggestedContentLanguage: supportedLocales.length === 1 ? supportedLocales[0] : undefined,
    sourceUrl: EBAY_REST_REQUEST_HEADERS_SOURCE_URL,
    reasonsJa
  };
}
