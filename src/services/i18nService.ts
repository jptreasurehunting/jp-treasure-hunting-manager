import { SupportedLanguage, SupportedLocale, UserLocaleContext, TranslationKey } from '../types/i18n';

const LOCALE_STORAGE_KEY = 'zonos_user_locale_context_v1';

export const DEFAULT_LOCALE_CONTEXT: UserLocaleContext = {
  language: 'ja',
  locale: 'ja-JP',
  measurementSystem: 'metric'
};

// Approved, Human-Reviewed Bilingual Dictionary
export const DICTIONARY: Record<SupportedLanguage, Record<string, string>> = {
  ja: {
    // Navigation & Tabs
    'nav.shipping_router': 'Shipping Router (汎用配送ルーター)',
    'nav.orders': '📋 受注ルーティング判定',
    'nav.consolidation': '📦 同梱・おまとめ発送管理',
    'nav.shopee': '🛒 Shopee 自動出品 ＆ 在庫最適化',
    'nav.printers': '🖨️ Windows プリンタ設定',
    'nav.knowledge': '📚 登録済み梱包ナレッジ',
    'nav.sender': '📭 差出人情報設定',

    // Consolidation Status
    'consolidation.status.consolidate': '🟢 同梱発送可能',
    'consolidation.status.keep_separate': '⚪ 別々に発送 (個別発送)',
    'consolidation.status.review_required': '🟡 要確認',
    'consolidation.status.blocked': '🔴 同梱禁止 (ブロック)',

    // Consolidation Reasons
    'consolidation.reason.same_buyer_identical_address': '同一バイヤー・同一配送先住所を確認',
    'consolidation.reason.marketplace_policy_conditional_met': 'モール公式の合算ワークフロー条件を満たしています',
    'consolidation.reason.marketplace_rule_unknown': 'モール規約が未検証のため個別発送を維持します',
    'consolidation.reason.cross_marketplace_prohibited': '異なるモール間の注文は同梱できません (規約違反)',
    'consolidation.reason.room_number_mismatch': '建物名・部屋番号の不一致または欠落を検知しました (別世帯リスク)',
    'consolidation.reason.different_seller_account': '異なる自社セラーアカウント間の注文のため同梱禁止',
    'consolidation.reason.order_cancelled_or_disputed': '注文がキャンセルまたは係争中のため同梱対象外',
    'consolidation.reason.capacity_exceeded_upgraded': '合算によりサイズ/重量が上限を超えたため配送便を再計算しました',
    'consolidation.reason.address_changed_after_purchase': '購入後の住所変更を検知したため個別発送へ隔離',

    // Consolidation Actions
    'consolidation.action.preview_envelope': '✉️ おまとめ封筒/ラベル プレビュー',
    'consolidation.action.finalize': '⚡ おまとめ発送を確定する',
    'consolidation.action.disband': '✕ 同梱を解除する',
    'consolidation.action.print_locked': '🔒 おまとめ発送グループに含まれています (個別印刷ロック中)',

    // Central Inventory
    'inventory.sync.title': '中央在庫同期 (Single Source of Truth)',
    'inventory.status.synced': '🟢 同期済み',
    'inventory.status.pending': '🔄 同期待ち',
    'inventory.status.failed': '❌ 同期失敗',
    'inventory.status.overselling_risk': '⛔ 二重販売リスク',
    'inventory.status.review_required': '🟡 要確認',
    'inventory.metric.physical_stock': '実在庫数',
    'inventory.metric.available_to_sell': '販売可能数 (ATS)',
    'inventory.metric.reserved': '引当予約数',

    // Shopee Capacity & Policy
    'shopee.capacity.free_listing_capacity': '無料出品可能数',
    'shopee.capacity.used_capacity': '使用中',
    'shopee.capacity.remaining_free_capacity': '無料枠残数',
    'shopee.capacity.paid_listing_required': '⚠️ 有料出品が必要',
    'shopee.capacity.capacity_source': '上限情報の取得元',
    'shopee.capacity.verified_at': '上限確認日時',
    'shopee.policy.auto_listing_enabled': '自動出品 有効',
    'shopee.policy.auto_listing_disabled': '自動出品 無効',
    'shopee.policy.auto_replacement_enabled': '自動入替 有効',
    'shopee.policy.auto_replacement_disabled': '自動入替 無効',
    'shopee.policy.max_free_capacity': '無料出品上限数',
    'shopee.policy.min_expected_profit': '最低期待利益',
    'shopee.policy.min_opportunity_score': '最低販売期待スコア',
    'shopee.policy.max_replacements_per_day': '1日の最大入替件数',
    'shopee.optimization.replacement_candidate': '💡 入替候補',
    'shopee.status.automatically_listed': '🟢 自動出品済み',
    'shopee.status.automatically_replaced': '🔄 自動入替済み',
    'shopee.status.stock_paused': '⏸️ 在庫切れ休止',
    'shopee.action.approve_policy': '🛡️ 自動出品ポリシーを承認・有効化する',
    'shopee.action.pause_policy': '⏸️ 自動出品を一時停止する'
  },
  en: {
    // Navigation & Tabs
    'nav.shipping_router': 'Shipping Router (Universal Routing Engine)',
    'nav.orders': '📋 Order Routing List',
    'nav.consolidation': '📦 Consolidation & Fulfillment Grouping',
    'nav.shopee': '🛒 Shopee Auto-Listing & Inventory Sync',
    'nav.printers': '🖨️ Windows Printer Profiles',
    'nav.knowledge': '📚 Packaging Knowledge Profiles',
    'nav.sender': '📭 Sender Profile Settings',

    // Consolidation Status
    'consolidation.status.consolidate': '🟢 Consolidation Allowed',
    'consolidation.status.keep_separate': '⚪ Keep Separate',
    'consolidation.status.review_required': '🟡 Review Required',
    'consolidation.status.blocked': '🔴 Blocked Violation',

    // Consolidation Reasons
    'consolidation.reason.same_buyer_identical_address': 'Identical buyer and shipping address confirmed',
    'consolidation.reason.marketplace_policy_conditional_met': 'Marketplace conditional consolidation workflow satisfied',
    'consolidation.reason.marketplace_rule_unknown': 'Marketplace policy is unverified; keeping separate safely',
    'consolidation.reason.cross_marketplace_prohibited': 'Cross-marketplace consolidation is strictly prohibited',
    'consolidation.reason.room_number_mismatch': 'Building name or room number mismatch/missing detected',
    'consolidation.reason.different_seller_account': 'Orders belong to different seller accounts; cannot consolidate',
    'consolidation.reason.order_cancelled_or_disputed': 'Order is cancelled or disputed; excluded from consolidation',
    'consolidation.reason.capacity_exceeded_upgraded': 'Combined size/weight exceeded envelope limit; upgraded service',
    'consolidation.reason.address_changed_after_purchase': 'Post-purchase address change detected; isolated for safety',

    // Consolidation Actions
    'consolidation.action.preview_envelope': '✉️ Preview Consolidated Envelope / Label',
    'consolidation.action.finalize': '⚡ Finalize Fulfillment Group',
    'consolidation.action.disband': '✕ Disband Group',
    'consolidation.action.print_locked': '🔒 Included in Consolidation Group (Individual print locked)',

    // Central Inventory
    'inventory.sync.title': 'Central Inventory Sync (Single Source of Truth)',
    'inventory.status.synced': '🟢 Synced',
    'inventory.status.pending': '🔄 Sync Pending',
    'inventory.status.failed': '❌ Sync Failed',
    'inventory.status.overselling_risk': '⛔ Overselling Risk',
    'inventory.status.review_required': '🟡 Review Required',
    'inventory.metric.physical_stock': 'Physical Stock',
    'inventory.metric.available_to_sell': 'Available to Sell (ATS)',
    'inventory.metric.reserved': 'Reserved Count',

    // Shopee Capacity & Policy
    'shopee.capacity.free_listing_capacity': 'Free Listing Capacity',
    'shopee.capacity.used_capacity': 'Used Listing Capacity',
    'shopee.capacity.remaining_free_capacity': 'Remaining Free Capacity',
    'shopee.capacity.paid_listing_required': '⚠️ Paid Listing Required',
    'shopee.capacity.capacity_source': 'Capacity Source',
    'shopee.capacity.verified_at': 'Capacity Verified At',
    'shopee.policy.auto_listing_enabled': 'Auto Listing Enabled',
    'shopee.policy.auto_listing_disabled': 'Auto Listing Disabled',
    'shopee.policy.auto_replacement_enabled': 'Auto Replacement Enabled',
    'shopee.policy.auto_replacement_disabled': 'Auto Replacement Disabled',
    'shopee.policy.max_free_capacity': 'Maximum Free Listing Capacity',
    'shopee.policy.min_expected_profit': 'Minimum Expected Profit',
    'shopee.policy.min_opportunity_score': 'Minimum Opportunity Score',
    'shopee.policy.max_replacements_per_day': 'Maximum Replacements Per Day',
    'shopee.optimization.replacement_candidate': '💡 Replacement Candidate',
    'shopee.status.automatically_listed': '🟢 Automatically Listed',
    'shopee.status.automatically_replaced': '🔄 Automatically Replaced',
    'shopee.status.stock_paused': '⏸️ Stock Paused',
    'shopee.action.approve_policy': '🛡️ Approve & Enable Auto-Listing Policy',
    'shopee.action.pause_policy': '⏸️ Pause Auto-Listing'
  },
  fr: {},
  de: {},
  zh: {},
  ko: {}
};

export function loadUserLocaleContext(): UserLocaleContext {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!raw) return DEFAULT_LOCALE_CONTEXT;
    return JSON.parse(raw);
  } catch (e) {
    return DEFAULT_LOCALE_CONTEXT;
  }
}

export function saveUserLocaleContext(ctx: UserLocaleContext): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(ctx));
  } catch (e) {
    console.error('Failed to save locale context:', e);
  }
}

/**
 * Universal Translation Helper (t)
 */
export function t(key: TranslationKey, params?: Record<string, string | number>, lang?: SupportedLanguage): string {
  const currentLang = lang || loadUserLocaleContext().language || 'ja';
  const dict = DICTIONARY[currentLang] || DICTIONARY.ja;
  let text = dict[key] || DICTIONARY.ja[key] || key;

  if (params) {
    Object.keys(params).forEach((paramKey) => {
      text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(params[paramKey]));
    });
  }

  return text;
}

/**
 * Bilingual Label Formatter: e.g. "要確認 / Review Required"
 */
export function tBilingual(key: TranslationKey, params?: Record<string, string | number>): string {
  const jaText = t(key, params, 'ja');
  const enText = t(key, params, 'en');
  if (jaText === enText) return jaText;
  return `${jaText} / ${enText}`;
}

/**
 * Locale-Aware Date & Time Formatter
 */
export function formatLocaleDateTime(isoString: string, locale: SupportedLocale = 'ja-JP'): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch (e) {
    return isoString;
  }
}

/**
 * Locale-Aware Currency Formatter
 */
export function formatLocaleCurrency(amount: number, currency = 'JPY', locale: SupportedLocale = 'ja-JP'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2
    }).format(amount);
  } catch (e) {
    return `${amount} ${currency}`;
  }
}

/**
 * Locale-Aware Weight Formatter
 */
export function formatLocaleWeight(weightGrams: number, measurementSystem: 'metric' | 'imperial' = 'metric'): string {
  if (measurementSystem === 'imperial') {
    const ounces = (weightGrams / 28.3495).toFixed(1);
    return `${ounces} oz`;
  }
  return weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(2)} kg` : `${Math.round(weightGrams)} g`;
}

/**
 * Locale-Aware Dimensions Formatter
 */
export function formatLocaleDimensions(lengthCm: number, widthCm: number, heightCm: number, measurementSystem: 'metric' | 'imperial' = 'metric'): string {
  if (measurementSystem === 'imperial') {
    const toInch = (cm: number) => (cm / 2.54).toFixed(1);
    return `${toInch(lengthCm)} × ${toInch(widthCm)} × ${toInch(heightCm)} in`;
  }
  return `${lengthCm.toFixed(1)} × ${widthCm.toFixed(1)} × ${heightCm.toFixed(1)} cm`;
}

/**
 * Locale-Aware Address Formatter
 */
export function formatLocaleAddress(
  order: { postalCode: string; stateOrProvince: string; city: string; addressLine1: string; addressLine2?: string; countryCode?: string },
  locale: SupportedLocale = 'ja-JP'
): string {
  if (locale === 'ja-JP' || order.countryCode === 'JP') {
    const postal = order.postalCode ? `〒${order.postalCode.replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{4})$/, '$1-$2')} ` : '';
    return `${postal}${order.stateOrProvince} ${order.city} ${order.addressLine1}${order.addressLine2 ? ` ${order.addressLine2}` : ''}`;
  } else {
    const parts = [
      order.addressLine2,
      order.addressLine1,
      order.city,
      order.stateOrProvince,
      order.postalCode,
      order.countryCode
    ].filter(Boolean);
    return parts.join(', ');
  }
}
