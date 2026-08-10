export type SupportedLanguage = 'ja' | 'en' | 'fr' | 'de' | 'zh' | 'ko';

export type SupportedLocale =
  | 'ja-JP' // 日本 (JPY, YYYY/MM/DD, 〒住所, g/cm)
  | 'en-US' // 米国 (USD, MM/DD/YYYY, Street Address, oz/in)
  | 'en-GB' // 英国 (GBP, DD/MM/YYYY, UK Postcode, g/cm)
  | 'fr-FR' // フランス (EUR, DD/MM/YYYY, Code Postal, g/cm)
  | 'de-DE' // ドイツ (EUR, DD.MM.YYYY, PLZ, g/cm)
  | 'zh-TW' // 台湾 (TWD, YYYY/MM/DD, 郵遞區號, g/cm)
  | 'ko-KR'; // 韓国 (KRW, YYYY. MM. DD., 우편番号, g/cm)

export interface UserLocaleContext {
  language: SupportedLanguage;
  locale: SupportedLocale;
  measurementSystem: 'metric' | 'imperial';
}

export type TranslationKey = string;
