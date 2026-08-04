import {
  PrePurchaseReviewInput,
  PrePurchaseReviewResult,
  PrePurchaseDecision
} from '../types/safetyGate';

const PRE_PURCHASE_REVIEWS_SESSION_KEY = 'zonos_pre_purchase_reviews';

const KNOWN_VERO_HIGH_RISK_BRANDS = [
  'LOUIS VUITTON',
  'CHANEL',
  'GUCCI',
  'HERMES',
  'ROLEX',
  'TIFFANY & CO',
  'APPLE',
  'SONY (RESTRICTED REGION)'
];

/**
 * Calculates Preliminary Profit Economics (Phase 1)
 */
export function calculatePrePurchaseProfit(input: PrePurchaseReviewInput) {
  const exchangeRate = input.exchangeRateJpyPerUsd || 150;
  const totalCostJpy = (input.askingPriceJpy || 0) + (input.domesticShippingJpy || 0);
  const totalCostUsd = totalCostJpy / exchangeRate;

  const grossSalesUsd = input.expectedEbayPriceUsd || 0;
  const sellingFeeUsd = input.estimatedSellingFeeUsd || grossSalesUsd * 0.15; // default ~15% fee
  const intlShippingUsd = input.estimatedIntlShippingUsd || 20; // default $20
  const customsCostUsd = input.estimatedCustomsCostUsd || 0;

  const totalDeductionsUsd = totalCostUsd + sellingFeeUsd + intlShippingUsd + customsCostUsd;
  const netProfitUsd = grossSalesUsd - totalDeductionsUsd;
  const netProfitJpy = netProfitUsd * exchangeRate;
  const profitMargin = grossSalesUsd > 0 ? (netProfitUsd / grossSalesUsd) * 100 : 0;

  return {
    netProfitUsd: Math.round(netProfitUsd * 100) / 100,
    netProfitJpy: Math.round(netProfitJpy),
    profitMargin: Math.round(profitMargin * 10) / 10,
    totalCostJpy,
    totalDeductionsUsd: Math.round(totalDeductionsUsd * 100) / 100
  };
}

/**
 * Main Evaluator for Pre-Purchase Review (Phase 1)
 */
export function evaluatePrePurchaseReview(input: PrePurchaseReviewInput): PrePurchaseReviewResult {
  const economics = calculatePrePurchaseProfit(input);
  const missingEvidence: string[] = [];
  const missingRequirements: string[] = [];
  const requiredNextActions: string[] = [];

  const brandUpper = (input.brand || '').trim().toUpperCase();
  const titleUpper = (input.listingTitle || '').trim().toUpperCase();

  // 1. VeRO & IP Risk Check
  const isVeroBrand = KNOWN_VERO_HIGH_RISK_BRANDS.some((b) => brandUpper.includes(b) || titleUpper.includes(b));

  // 2. Misleading Origin Check (e.g. "Made in Japan" when manufacture country is China/Other)
  const isMisleadingOriginClaim =
    (titleUpper.includes('MADE IN JAPAN') || titleUpper.includes('日本製')) &&
    input.countryOfManufacture.toUpperCase() !== 'JAPAN';

  // 3. Evidence Completeness Check
  if (!input.productCode || input.productCode.trim() === '') {
    missingEvidence.push('JAN/UPC/EANなどの識別製品コードが未入力');
    requiredNextActions.push('出品者への質問または公式検索でJAN/UPCコードを確認してください。');
  }
  if (!input.countryOfManufacture || input.countryOfManufacture.trim() === '') {
    missingEvidence.push('製造国 (Country of Manufacture) 情報が未入力');
    requiredNextActions.push('タグ写真または製品仕様で実際の製造国を確認してください。');
  }
  if (!input.photoReferences || input.photoReferences.length === 0) {
    missingEvidence.push('実物写真・製品タグ写真の参照URL/添付が未確認');
    requiredNextActions.push('製品タグ・ロゴ・印字が鮮明に写った写真を確認してください。');
  }

  // Determine Category Reviews
  const authenticityRisk = isVeroBrand
    ? '🔴 模倣品・知財侵害リスク高 (VeRO監視対象ブランド)'
    : missingEvidence.length > 0
    ? '🟡 証拠不足による真贋未確認'
    : '🟢 事前判定低リスク';

  const veroIpRisk = isVeroBrand
    ? '🔴 VeRO権利者からの削除・アカウント警告リスクあり'
    : '🟢 通常知財クリアランス範囲内';

  const importDestinationRisk = isMisleadingOriginClaim
    ? '🔴 原産国偽装表示リスク (Made in Japan誤表記)'
    : '🟢 現行規制適合範囲内';

  const shippingEligibility = input.estimatedIntlShippingUsd > 0
    ? '🟢 国際配送見積もり設定済み'
    : '🟡 国際送料の事前確認を推奨';

  const ebayPolicyRisk = input.sellerRating < 90 && input.sellerTransactionCount < 5
    ? '🟡 低評価・新規フリマ出品者リスク'
    : '🟢 出品者取引評価基準を満たしています';

  const profitability = economics.profitMargin >= 20
    ? `🟢 良好 (予想利益率: ${economics.profitMargin}% / 利益: ¥${economics.netProfitJpy.toLocaleString()})`
    : economics.profitMargin >= 10
    ? `🟡 低め (予想利益率: ${economics.profitMargin}% / 利益: ¥${economics.netProfitJpy.toLocaleString()})`
    : `🔴 赤字または低利益率 (予想利益率: ${economics.profitMargin}% / 利益: ¥${economics.netProfitJpy.toLocaleString()})`;

  const demandTurnoverRisk = input.sellerTransactionCount < 3
    ? '🟡 需要・流動性の慎重な確認を推奨'
    : '🟢 標準的回転率';

  // Decision Logic
  let decision: PrePurchaseDecision = 'PURCHASE_RECOMMENDED';
  let decisionTitleJa = '仕入れ推奨 (Purchase Recommended)';
  let isOverrideAllowed = false;

  // Block Condition (Mandatory Non-Overridable)
  if (isVeroBrand || isMisleadingOriginClaim || economics.netProfitJpy < -5000) {
    decision = 'PURCHASE_BLOCKED';
    decisionTitleJa = '仕入れ絶対禁止 (Purchase Blocked)';
    isOverrideAllowed = false;
    if (isVeroBrand) missingRequirements.push('VeRO高リスクブランドのため仕入れできません。');
    if (isMisleadingOriginClaim) missingRequirements.push('製造国が日本でないにもかかわらず「Made in Japan」表示を行うことは不当表示違反です。');
    if (economics.netProfitJpy < -5000) missingRequirements.push('大幅な予想赤字のため仕入れがブロックされました。');
  }
  // Review Required Condition
  else if (missingEvidence.length > 0) {
    decision = 'REVIEW_REQUIRED';
    decisionTitleJa = '要確認・要証拠追加 (Review Required)';
    isOverrideAllowed = false; // Cannot approve until requirements met
    missingRequirements.push(...missingEvidence);
  }
  // Economically Not Recommended Condition
  else if (economics.profitMargin < 15 || economics.netProfitJpy < 1500) {
    decision = 'ECONOMICALLY_NOT_RECOMMENDED';
    decisionTitleJa = '経済的非推奨 (Economically Not Recommended)';
    isOverrideAllowed = true; // May be overridden with written reason & audit log
    missingRequirements.push('予想利益率が設定基準(15%)未満、または利益額が小額です。');
    requiredNextActions.push('仕入価格の交渉を行うか、オーバーライド理由を記録して続行してください。');
  }

  return {
    decision,
    decisionTitleJa,
    estimatedProfitJpy: economics.netProfitJpy,
    estimatedProfitUsd: economics.netProfitUsd,
    estimatedProfitMargin: economics.profitMargin,
    reviewCategories: {
      authenticityRisk,
      veroIpRisk,
      importDestinationRisk,
      shippingEligibility,
      ebayPolicyRisk,
      profitability,
      demandTurnoverRisk,
      missingEvidence
    },
    requiredNextActions,
    missingRequirements,
    isOverrideAllowed,
    disclaimerNotice: '「本判定は真贋、将来の利益、通関完了、またはeBayポリシー適合を絶対保証するものではありません。」'
  };
}

export function loadSavedPrePurchaseReviews(): any[] {
  try {
    const raw = sessionStorage.getItem(PRE_PURCHASE_REVIEWS_SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load saved pre-purchase reviews:', e);
    return [];
  }
}

export function savePrePurchaseReview(entry: any): void {
  try {
    const existing = loadSavedPrePurchaseReviews();
    sessionStorage.setItem(PRE_PURCHASE_REVIEWS_SESSION_KEY, JSON.stringify([entry, ...existing]));
  } catch (e) {
    console.error('Failed to save pre-purchase review:', e);
  }
}
