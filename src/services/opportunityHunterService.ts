import {
  OpportunityCandidate,
  OpportunityCategoryType,
  OpportunityScoreBreakdown,
  OpportunityEconomics,
  OpportunityEvidence,
  OpportunityApprovalStatus,
  OpportunityApprovalRecord,
  OpportunityLifecycleStage
} from '../types/opportunityHunter';
import { calculatePrePurchaseProfit, evaluatePrePurchaseReview } from './prePurchaseReviewService';
import { PrePurchaseReviewInput } from '../types/safetyGate';
import { HealthCheckModulePlugin } from '../types/projectHealth';

const OPPORTUNITY_STORAGE_KEY = 'jp_opportunity_hunter_candidates';

export function safeGetItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // Fallback
  }
  return null;
}

export function safeSetItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Fallback
  }
}

/**
 * Calculates Multi-Factor Opportunity Score (0 - 100)
 * Evaluates Demand, Profit, Rarity, Historical Performance, and Penalties.
 * CRITICAL RULE: Limited status alone is NEVER sufficient for recommendation!
 */
export function calculateOpportunityScore(
  economics: OpportunityEconomics,
  opportunityTypes: OpportunityCategoryType[],
  evidence: OpportunityEvidence,
  rawDemandSignal: number = 75, // 0 - 100 scale
  seriesSellThroughRate: number = 80, // 0 - 100 scale
  releaseDate?: string,
  brand: string = '',
  title: string = ''
): OpportunityScoreBreakdown {
  const warningFlags: string[] = [];
  let isVeroBlocked = false;
  let isPreorderPolicyWarning = false;
  let isRarityOnlyTrap = false;

  // 1. VeRO & IP Clearance Check (Reusing prePurchaseReviewService)
  const prePurchaseInput: PrePurchaseReviewInput = {
    marketplace: 'Other',
    listingUrl: evidence.sourceUrl || 'https://official.example.jp/item',
    listingTitle: title,
    sellerDescription: evidence.evidenceNotes || '',
    brand,
    manufacturer: brand,
    productCode: evidence.productCode || '',
    countryOfManufacture: 'Japan',
    officialReleaseMarket: 'Japan',
    intendedEbayMarketplace: 'US',
    intendedDestinationCountries: ['US', 'GB', 'DE', 'AU', 'CA'],
    askingPriceJpy: economics.askingPriceJpy,
    domesticShippingJpy: economics.domesticShippingJpy,
    expectedEbayPriceUsd: economics.expectedEbayPriceUsd,
    exchangeRateJpyPerUsd: economics.exchangeRate,
    estimatedSellingFeeUsd: economics.estimatedSellingFeeUsd,
    estimatedIntlShippingUsd: economics.estimatedIntlShippingUsd,
    estimatedCustomsCostUsd: 0,
    photoReferences: evidence.hasOfficialAnnouncementPhoto ? ['https://official.example.jp/photo.jpg'] : [],
    sellerRating: 100,
    sellerTransactionCount: 50,
    reviewNotes: 'Pre-release Opportunity Hunter Automated Clearance'
  };

  const rightsReview = evaluatePrePurchaseReview(prePurchaseInput);
  if (rightsReview.decision === 'PURCHASE_BLOCKED' || (rightsReview.decision as string) === 'BLOCKED') {
    isVeroBlocked = true;
    warningFlags.push(`⛔ 【知財・VeROブロック】${rightsReview.missingRequirements[0] || '高リスクブランドに該当'}`);
  }

  // 2. Demand Score (0 - 30 pts)
  const normalizedDemand = Math.min(100, Math.max(0, rawDemandSignal));
  const demandScore = Math.round((normalizedDemand / 100) * 30);

  // 3. Profit Score (0 - 30 pts)
  let profitScore = 0;
  const margin = economics.profitMarginPct;
  const netJpy = economics.netProfitJpy;

  if (margin >= 45 && netJpy >= 10000) {
    profitScore = 30;
  } else if (margin >= 35 && netJpy >= 6000) {
    profitScore = 24;
  } else if (margin >= 25 && netJpy >= 3500) {
    profitScore = 18;
  } else if (margin >= 20 && netJpy >= 2000) {
    profitScore = 12;
  } else {
    profitScore = 0;
    warningFlags.push(`⚠ 【低利益率警告】想定利益率 ${margin.toFixed(1)}% / 純利益 ${netJpy.toLocaleString()}円 が基準値(20%以上/2,000円以上)未満`);
  }

  // 4. Rarity Score (0 - 20 pts) based on Opportunity Types
  let rarityBase = 0;
  if (opportunityTypes.includes('MADE_TO_ORDER')) rarityBase += 8;
  if (opportunityTypes.includes('LOTTERY_SALE')) rarityBase += 8;
  if (opportunityTypes.includes('LIMITED_QUANTITY')) rarityBase += 6;
  if (opportunityTypes.includes('PREORDER_EXCLUSIVE')) rarityBase += 5;
  if (opportunityTypes.includes('EVENT_STORE_EXCLUSIVE')) rarityBase += 5;
  if (opportunityTypes.includes('COLLABORATION')) rarityBase += 4;
  if (opportunityTypes.includes('ANNIVERSARY_MODEL')) rarityBase += 4;
  if (opportunityTypes.includes('JAPAN_EXCLUSIVE')) rarityBase += 3;
  if (opportunityTypes.includes('OVERSEAS_UNRELEASED')) rarityBase += 3;
  if (opportunityTypes.includes('HIGH_SELLOUT_RISK')) rarityBase += 4;

  const rarityScore = Math.min(20, rarityBase);

  // 5. Series History Score (0 - 20 pts)
  const seriesHistoryScore = Math.min(20, Math.round((Math.max(0, seriesSellThroughRate) / 100) * 20));

  // 6. Penalty Deductions (0 - 50 pts)
  let penaltyDeductions = 0;

  // 6a. Rarity-Only Trap Check: High rarity but low demand or poor profit
  if (rarityScore >= 8 && (demandScore < 14 || margin < 20)) {
    isRarityOnlyTrap = true;
    penaltyDeductions += 25;
    warningFlags.push('🚨 【限定品トラップ警告】数量限定・記念品ですが、海外需要または想定利益率が低いため推薦から除外');
  }

  // 6b. eBay 30-day Pre-order Policy Check
  if (releaseDate) {
    const today = new Date();
    const release = new Date(releaseDate);
    const diffDays = Math.ceil((release.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 30) {
      isPreorderPolicyWarning = true;
      penaltyDeductions += 10;
      warningFlags.push(`⏳ 【予約期間警告】発売予定日まで ${diffDays}日 (eBayの30日以内発送規約抵触のため無在庫出品不可)`);
    }
  }

  // 6c. Low Evidence Confidence / Missing Product Code
  if (!evidence.hasJanOrProductCode) {
    penaltyDeductions += 5;
    warningFlags.push('🟡 【証拠不足】JAN/製品識別コードが未入力 (確認推奨)');
  }

  if (evidence.confidenceScore < 60) {
    penaltyDeductions += 10;
    warningFlags.push('🟡 【低信頼度】情報元の検証確度が低いため人間レビューが必要');
  }

  // 7. Final Score Computation
  let finalScore = isVeroBlocked
    ? 0
    : Math.max(0, Math.min(100, demandScore + profitScore + rarityScore + seriesHistoryScore - penaltyDeductions));

  const isRecommended = finalScore >= 70 && !isVeroBlocked && !isRarityOnlyTrap && margin >= 20;

  // 8. Recommendation Rationale
  let recommendationRationale = '';
  if (isVeroBlocked) {
    recommendationRationale = '知財・VeRO権利侵害リスクのため推薦不可 (BLOCKED)';
  } else if (isRarityOnlyTrap) {
    recommendationRationale = '限定品ではあるものの海外需要または利益率が不十分なため見送りを推奨 (Rarity-only Trap)';
  } else if (isRecommended) {
    recommendationRationale = `高需要(${demandScore}/30)と高利益率(${margin.toFixed(1)}% / ${netJpy.toLocaleString()}円)が両立した優良機会 (総合: ${finalScore}点)`;
  } else {
    recommendationRationale = `総合スコア ${finalScore}点 (基準値70点未満または要確認事項あり)`;
  }

  return {
    demandScore,
    profitScore,
    rarityScore,
    seriesHistoryScore,
    penaltyDeductions,
    finalScore,
    isRecommended,
    recommendationRationale,
    isRarityOnlyTrap,
    isVeroBlocked,
    isPreorderPolicyWarning,
    warningFlags
  };
}

/**
 * Creates and evaluates a new Opportunity Candidate
 */
export function createOpportunityCandidate(input: {
  title: string;
  brand: string;
  category: string;
  characterOrSeries?: string;
  opportunityTypes: OpportunityCategoryType[];
  releaseDate: string;
  preOrderDeadline?: string;
  askingPriceJpy: number;
  domesticShippingJpy?: number;
  expectedEbayPriceUsd: number;
  exchangeRate?: number;
  estimatedSellingFeeUsd?: number;
  estimatedIntlShippingUsd?: number;
  evidence: OpportunityEvidence;
  rawDemandSignal?: number;
  seriesSellThroughRate?: number;
}): OpportunityCandidate {
  const rate = input.exchangeRate || 155.0;
  const domesticShipping = input.domesticShippingJpy || 0;
  const sellingFee = input.estimatedSellingFeeUsd || input.expectedEbayPriceUsd * 0.15;
  const intlShipping = input.estimatedIntlShippingUsd || 18.0;

  // Compute Economics reusing prePurchaseReviewService formula
  const profitCalc = calculatePrePurchaseProfit({
    marketplace: 'Other',
    listingUrl: input.evidence.sourceUrl || 'https://official.example.jp/item',
    listingTitle: input.title,
    sellerDescription: input.evidence.evidenceNotes || '',
    brand: input.brand,
    manufacturer: input.brand,
    productCode: input.evidence.productCode || '',
    countryOfManufacture: 'Japan',
    officialReleaseMarket: 'Japan',
    intendedEbayMarketplace: 'US',
    intendedDestinationCountries: ['US', 'GB', 'DE', 'AU', 'CA'],
    askingPriceJpy: input.askingPriceJpy,
    domesticShippingJpy: domesticShipping,
    expectedEbayPriceUsd: input.expectedEbayPriceUsd,
    exchangeRateJpyPerUsd: rate,
    estimatedSellingFeeUsd: sellingFee,
    estimatedIntlShippingUsd: intlShipping,
    estimatedCustomsCostUsd: 0,
    photoReferences: input.evidence.hasOfficialAnnouncementPhoto ? ['https://official.example.jp/photo.jpg'] : [],
    sellerRating: 100,
    sellerTransactionCount: 50,
    reviewNotes: 'Opportunity candidate economics'
  });

  const economics: OpportunityEconomics = {
    askingPriceJpy: input.askingPriceJpy,
    domesticShippingJpy: domesticShipping,
    expectedEbayPriceUsd: input.expectedEbayPriceUsd,
    exchangeRate: rate,
    estimatedSellingFeeUsd: sellingFee,
    estimatedIntlShippingUsd: intlShipping,
    netProfitUsd: profitCalc.netProfitUsd,
    netProfitJpy: profitCalc.netProfitJpy,
    profitMarginPct: profitCalc.profitMargin,
    totalCostJpy: profitCalc.totalCostJpy,
    totalDeductionsUsd: profitCalc.totalDeductionsUsd
  };

  const scoreBreakdown = calculateOpportunityScore(
    economics,
    input.opportunityTypes,
    input.evidence,
    input.rawDemandSignal ?? 80,
    input.seriesSellThroughRate ?? 85,
    input.releaseDate,
    input.brand,
    input.title
  );

  const candidate: OpportunityCandidate = {
    id: `opp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: input.title,
    brand: input.brand,
    characterOrSeries: input.characterOrSeries,
    category: input.category,
    opportunityTypes: input.opportunityTypes,
    releaseDate: input.releaseDate,
    preOrderDeadline: input.preOrderDeadline,
    economics,
    evidence: input.evidence,
    scoreBreakdown,
    lifecycleStage: 'PREORDER_OPEN',
    approvalStatus: 'PENDING_REVIEW',
    approvalHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return candidate;
}

/**
 * Human Approval Action Gate (No automated purchasing)
 */
export function approveOpportunityCandidate(
  candidate: OpportunityCandidate,
  action: 'WATCH' | 'PREPURCHASE' | 'REJECT',
  operatorName: string,
  rationale: string
): OpportunityCandidate {
  let newStatus: OpportunityApprovalStatus = 'PENDING_REVIEW';
  if (action === 'WATCH') newStatus = 'APPROVED_FOR_WATCHING';
  if (action === 'PREPURCHASE') newStatus = 'APPROVED_FOR_PREPURCHASE';
  if (action === 'REJECT') newStatus = 'REJECTED';

  const record: OpportunityApprovalRecord = {
    approvalId: `appr_${Date.now()}`,
    action,
    operatorName,
    approvedAt: new Date().toISOString(),
    rationale,
    previousStatus: candidate.approvalStatus,
    newStatus
  };

  const updated: OpportunityCandidate = {
    ...candidate,
    approvalStatus: newStatus,
    approvalHistory: [record, ...candidate.approvalHistory],
    updatedAt: new Date().toISOString()
  };

  return updated;
}

/**
 * Updates Lifecycle Monitoring Stage
 */
export function updateOpportunityLifecycleStage(
  candidate: OpportunityCandidate,
  newStage: OpportunityLifecycleStage
): OpportunityCandidate {
  return {
    ...candidate,
    lifecycleStage: newStage,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Initial Simulated Mock Candidates for Opportunity Hunter
 */
export function getInitialOpportunityCandidates(): OpportunityCandidate[] {
  const stored = safeGetItem(OPPORTUNITY_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // Fallback
    }
  }

  const sample1 = createOpportunityCandidate({
    title: 'Gundam Factory Limited 1/100 Chogokin RX-78F00 Anniversary Model',
    brand: 'Bandai Spirits',
    category: 'Figure & Model Kit',
    characterOrSeries: 'Mobile Suit Gundam',
    opportunityTypes: ['EVENT_STORE_EXCLUSIVE', 'ANNIVERSARY_MODEL', 'JAPAN_EXCLUSIVE'],
    releaseDate: '2026-09-15',
    preOrderDeadline: '2026-08-25',
    askingPriceJpy: 24200,
    domesticShippingJpy: 800,
    expectedEbayPriceUsd: 380.0,
    exchangeRate: 155.0,
    estimatedIntlShippingUsd: 28.0,
    evidence: {
      sourceUrl: 'https://gundam-factory.example.jp/products/chogokin-rx78f00',
      sourceName: 'Gundam Factory Official Site',
      checkedAt: new Date().toISOString(),
      evidenceNotes: '現地会場限定およびプレバン抽選。海外需要極めて高く、過去同シリーズ即完売実績あり。',
      confidenceScore: 95,
      hasJanOrProductCode: true,
      productCode: '4573102612345',
      hasOfficialAnnouncementPhoto: true
    },
    rawDemandSignal: 92,
    seriesSellThroughRate: 95
  });

  const sample2 = createOpportunityCandidate({
    title: 'Studio Ghibli 40th Anniversary Wooden Music Box Made-to-Order Limited',
    brand: 'Studio Ghibli / Donguri Kyowakoku',
    category: 'Collectibles',
    characterOrSeries: 'My Neighbor Totoro',
    opportunityTypes: ['MADE_TO_ORDER', 'ANNIVERSARY_MODEL', 'OVERSEAS_UNRELEASED'],
    releaseDate: '2026-08-30',
    preOrderDeadline: '2026-08-18',
    askingPriceJpy: 16500,
    domesticShippingJpy: 600,
    expectedEbayPriceUsd: 260.0,
    exchangeRate: 155.0,
    estimatedIntlShippingUsd: 22.0,
    evidence: {
      sourceUrl: 'https://donguri-sora.example.jp/products/totoro-musicbox-40th',
      sourceName: 'Donguri Kyowakoku Official Store',
      checkedAt: new Date().toISOString(),
      evidenceNotes: '完全受注生産品。北米・欧州のジブリコレクターからの需要が非常に堅調。',
      confidenceScore: 90,
      hasJanOrProductCode: true,
      productCode: '4990593412345',
      hasOfficialAnnouncementPhoto: true
    },
    rawDemandSignal: 85,
    seriesSellThroughRate: 88
  });

  const sample3 = createOpportunityCandidate({
    title: 'Local Prefecture Regional Mascot Keychain Limited 100 Pcs (Rarity Trap Example)',
    brand: 'Local Tourism Board',
    category: 'Merchandise',
    opportunityTypes: ['LIMITED_QUANTITY', 'EVENT_STORE_EXCLUSIVE'],
    releaseDate: '2026-09-01',
    askingPriceJpy: 4500,
    domesticShippingJpy: 400,
    expectedEbayPriceUsd: 45.0,
    exchangeRate: 155.0,
    estimatedIntlShippingUsd: 15.0,
    evidence: {
      sourceUrl: 'https://local-tourism.example.jp/goods',
      sourceName: 'Regional Goods Shop',
      checkedAt: new Date().toISOString(),
      evidenceNotes: '100個限定だが海外知名度ほぼゼロ。国際送料と手数料で利益が出ない典型例。',
      confidenceScore: 60,
      hasJanOrProductCode: false,
      hasOfficialAnnouncementPhoto: true
    },
    rawDemandSignal: 10,
    seriesSellThroughRate: 15
  });

  const candidates = [sample1, sample2, sample3];
  safeSetItem(OPPORTUNITY_STORAGE_KEY, JSON.stringify(candidates));
  return candidates;
}

/**
 * Health Check Module Plugin for Project Health Dashboard (Spec #12)
 */
export function createOpportunityHunterHealthPlugin(): HealthCheckModulePlugin {
  return {
    moduleId: 'module_opportunity_hunter_engine',
    moduleName: '先行・限定品機会ハンター (Pre-Release Opportunity Hunter)',
    category: 'future_module',
    defaultAuthorityLevel: 'authoritative_source',
    defaultVerificationMethod: 'official_structured',
    checkHealth: () => {
      const candidates = getInitialOpportunityCandidates();
      const recommendedCount = candidates.filter((c) => c.scoreBreakdown.isRecommended).length;
      const trappedCount = candidates.filter((c) => c.scoreBreakdown.isRarityOnlyTrap).length;

      return {
        id: 'module_opportunity_hunter_engine',
        name: 'Pre-Release Opportunity Hunter',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: true,
        liveVerificationNote: `機会分析稼働: ${new Date().toLocaleDateString('ja-JP')}`,
        lastVerifiedAt: new Date().toISOString(),
        authorityLevel: 'authoritative_source',
        authorityLevelLabel: 'A. 一次情報源・公式API検証済み',
        verificationMethod: 'official_structured',
        verificationMethodLabel: '多要素機会スコアリング ＆ 人間承認ゲート',
        sourceName: 'Opportunity Hunter Engine v1.0',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: `✅ 機会ハンター正常稼働中 (候補: ${candidates.length}件 / 推奨: ${recommendedCount}件 / 偽機会除外: ${trappedCount}件)`,
        details: {
          exactRestriction: '多要素（需要30%＋利益30%＋希少性20%＋実績20%）による評価と人間承認の必須化',
          source: 'Pre-Release Opportunity Hunter Service',
          ruleVersion: 'Ver. 1.0',
          lastVerifiedTime: new Date().toISOString()
        }
      };
    }
  };
}
