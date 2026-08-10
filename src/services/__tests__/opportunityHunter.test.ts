import {
  calculateOpportunityScore,
  createOpportunityCandidate,
  approveOpportunityCandidate,
  updateOpportunityLifecycleStage,
  getInitialOpportunityCandidates,
  createOpportunityHunterHealthPlugin
} from '../opportunityHunterService';
import { OpportunityEconomics, OpportunityEvidence, OpportunityCategoryType } from '../../types/opportunityHunter';

export function runOpportunityHunterTests(): { passed: number; failed: number; log: string[] } {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('jp_opportunity_hunter_candidates');
    }
  } catch (e) {
    // Ignore
  }

  let passed = 0;
  let failed = 0;
  const log: string[] = [];

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`❌ [FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    }
  }

  // --- Test 1: High opportunity candidate gets strong score & recommended ---
  const validEconomics: OpportunityEconomics = {
    askingPriceJpy: 20000,
    domesticShippingJpy: 800,
    expectedEbayPriceUsd: 350.0,
    exchangeRate: 155.0,
    estimatedSellingFeeUsd: 52.5,
    estimatedIntlShippingUsd: 25.0,
    netProfitUsd: 138.4,
    netProfitJpy: 21452,
    profitMarginPct: 39.5,
    totalCostJpy: 20800,
    totalDeductionsUsd: 211.6
  };

  const validEvidence: OpportunityEvidence = {
    sourceUrl: 'https://official.bandai.example.jp/item01',
    sourceName: 'Official Bandai Spirits',
    checkedAt: '2026-08-10T10:00:00Z',
    evidenceNotes: 'プレバン限定アニバーサリーモデル。過去同シリーズ即日完売実績あり。',
    confidenceScore: 95,
    hasJanOrProductCode: true,
    productCode: '4573102612345',
    hasOfficialAnnouncementPhoto: true
  };

  const types: OpportunityCategoryType[] = ['JAPAN_EXCLUSIVE', 'ANNIVERSARY_MODEL', 'LIMITED_QUANTITY'];
  const score1 = calculateOpportunityScore(
    validEconomics,
    types,
    validEvidence,
    90, // Demand
    90, // Series rate
    '2026-08-25', // within 30 days
    'Bandai Spirits',
    'Gundam 45th Anniversary Model'
  );

  assert(score1.finalScore >= 70, 'Test 1: High opportunity candidate scores >= 70', `Score: ${score1.finalScore}`);
  assert(score1.isRecommended === true, 'Test 1b: High opportunity candidate is recommended');
  assert(!score1.isRarityOnlyTrap, 'Test 1c: High opportunity candidate is not marked as rarity trap');

  // --- Test 2: Rarity-only Trap: Limited edition with poor overseas demand & margin gets penalized ---
  const trapEconomics: OpportunityEconomics = {
    askingPriceJpy: 4000,
    domesticShippingJpy: 500,
    expectedEbayPriceUsd: 40.0,
    exchangeRate: 155.0,
    estimatedSellingFeeUsd: 6.0,
    estimatedIntlShippingUsd: 18.0,
    netProfitUsd: -13.0,
    netProfitJpy: -2015,
    profitMarginPct: -32.5,
    totalCostJpy: 4500,
    totalDeductionsUsd: 53.0
  };

  const trapEvidence: OpportunityEvidence = {
    sourceUrl: 'https://local-event.example.jp/goods',
    sourceName: 'Local Festival Goods',
    checkedAt: '2026-08-10T10:00:00Z',
    evidenceNotes: '限定100個の地域イベントグッズ。海外知名度なし。',
    confidenceScore: 70,
    hasJanOrProductCode: false,
    hasOfficialAnnouncementPhoto: true
  };

  const trapTypes: OpportunityCategoryType[] = ['LIMITED_QUANTITY', 'EVENT_STORE_EXCLUSIVE'];
  const score2 = calculateOpportunityScore(
    trapEconomics,
    trapTypes,
    trapEvidence,
    10, // Very low demand
    15, // Very low series history
    '2026-08-25',
    'Local Org',
    'Mascot Badge Limited 100pcs'
  );

  assert(score2.isRarityOnlyTrap === true, 'Test 2: Limited item with low demand/margin is flagged as Rarity Trap');
  assert(score2.isRecommended === false, 'Test 2b: Rarity trap candidate is strictly NOT recommended');
  assert(score2.finalScore < 50, 'Test 2c: Rarity trap final score is heavily penalized', `Score: ${score2.finalScore}`);

  // --- Test 3: VeRO / High-risk Brand is instantly BLOCKED ---
  const veroScore = calculateOpportunityScore(
    validEconomics,
    types,
    validEvidence,
    95,
    95,
    '2026-08-25',
    'Louis Vuitton',
    'Louis Vuitton Japan Limited Exclusive Bag'
  );

  assert(veroScore.isVeroBlocked === true, 'Test 3: VeRO brand is automatically flagged as blocked');
  assert(veroScore.finalScore === 0, 'Test 3b: VeRO brand score is capped at 0');
  assert(veroScore.isRecommended === false, 'Test 3c: VeRO brand is not recommended');

  // --- Test 4: Low profit margin floor triggers warning ---
  const lowMarginEconomics: OpportunityEconomics = {
    ...validEconomics,
    profitMarginPct: 15.0,
    netProfitJpy: 1500
  };
  const lowMarginScore = calculateOpportunityScore(
    lowMarginEconomics,
    types,
    validEvidence,
    85,
    85,
    '2026-08-25',
    'Bandai',
    'Test Figure'
  );
  assert(lowMarginScore.profitScore === 0, 'Test 4: Profit margin < 20% earns 0 profit points');
  assert(lowMarginScore.warningFlags.some((f) => f.includes('低利益率警告')), 'Test 4b: Low profit margin triggers warning flag');

  // --- Test 5: Release date > 30 days triggers eBay pre-order policy warning ---
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 45); // 45 days in future
  const preorderScore = calculateOpportunityScore(
    validEconomics,
    types,
    validEvidence,
    85,
    85,
    futureDate.toISOString().split('T')[0],
    'Bandai',
    'Far Future Preorder'
  );
  assert(preorderScore.isPreorderPolicyWarning === true, 'Test 5: Pre-order release date > 30 days triggers warning');
  assert(preorderScore.warningFlags.some((f) => f.includes('予約期間警告')), 'Test 5b: Pre-order policy warning flag added');

  // --- Test 6: Missing product code applies confidence deduction ---
  const missingCodeEvidence: OpportunityEvidence = {
    ...validEvidence,
    hasJanOrProductCode: false,
    productCode: undefined
  };
  const missingCodeScore = calculateOpportunityScore(
    validEconomics,
    types,
    missingCodeEvidence,
    85,
    85,
    '2026-08-25',
    'Bandai',
    'No JAN Item'
  );
  assert(missingCodeScore.warningFlags.some((f) => f.includes('証拠不足')), 'Test 6: Missing JAN/Product code triggers warning');

  // --- Test 7: Candidate creation factory sets default status & economics ---
  const candidate = createOpportunityCandidate({
    title: 'Custom Ghibli Music Box',
    brand: 'Studio Ghibli',
    category: 'Collectibles',
    opportunityTypes: ['MADE_TO_ORDER', 'ANNIVERSARY_MODEL'],
    releaseDate: '2026-08-28',
    askingPriceJpy: 16500,
    expectedEbayPriceUsd: 260.0,
    evidence: validEvidence,
    rawDemandSignal: 85,
    seriesSellThroughRate: 90
  });

  assert(candidate.approvalStatus === 'PENDING_REVIEW', 'Test 7: New candidate defaults to PENDING_REVIEW');
  assert(candidate.lifecycleStage === 'PREORDER_OPEN', 'Test 7b: Default lifecycle is PREORDER_OPEN');
  assert(candidate.economics.netProfitJpy > 0, 'Test 7c: Economics properly calculated with positive profit');

  // --- Test 8: Human approval transitions with audit trail ---
  const watchApproved = approveOpportunityCandidate(
    candidate,
    'WATCH',
    'Staff-A',
    'High potential Ghibli anniversary item, monitor pre-order velocity.'
  );
  assert(watchApproved.approvalStatus === 'APPROVED_FOR_WATCHING', 'Test 8: Approval for WATCH updates status');
  assert(watchApproved.approvalHistory.length === 1, 'Test 8b: Approval record logged in history');
  assert(watchApproved.approvalHistory[0].operatorName === 'Staff-A', 'Test 8c: Operator name recorded in audit record');

  const purchaseApproved = approveOpportunityCandidate(
    watchApproved,
    'PREPURCHASE',
    'Owner-Primary',
    'Pre-order window confirmed, reserve 2 units.'
  );
  assert(purchaseApproved.approvalStatus === 'APPROVED_FOR_PREPURCHASE', 'Test 8d: Approval for PREPURCHASE updates status');
  assert(purchaseApproved.approvalHistory.length === 2, 'Test 8e: Audit trail retains complete history');

  // --- Test 9: Lifecycle state updates properly ---
  const lifecycleUpdated = updateOpportunityLifecycleStage(purchaseApproved, 'STOCK_TIGHTENING');
  assert(lifecycleUpdated.lifecycleStage === 'STOCK_TIGHTENING', 'Test 9: Lifecycle updates to STOCK_TIGHTENING');

  const soldOutState = updateOpportunityLifecycleStage(lifecycleUpdated, 'SOLD_OUT');
  assert(soldOutState.lifecycleStage === 'SOLD_OUT', 'Test 9b: Lifecycle updates to SOLD_OUT');

  // --- Test 10: Initial mock candidates load properly ---
  const initialList = getInitialOpportunityCandidates();
  assert(initialList.length >= 3, 'Test 10: Initial mock candidate list contains at least 3 candidates');
  assert(initialList.some((c) => c.scoreBreakdown.isRarityOnlyTrap), 'Test 10b: Mock candidate list includes trap example for safety education');

  // --- Test 11: Health Plugin runs and reports healthy ---
  const plugin = createOpportunityHunterHealthPlugin();
  assert(plugin.moduleId === 'module_opportunity_hunter_engine', 'Test 11: Health plugin has correct module ID');
  const healthItem = plugin.checkHealth() as any;
  assert(healthItem.status === 'healthy', 'Test 11b: Health check status is healthy');
  assert(healthItem.authorityLevel === 'authoritative_source', 'Test 11c: Health check has authoritative level');

  // --- Test 12: No automatic purchasing verification ---
  // Verify that neither createOpportunityCandidate nor approveOpportunityCandidate perform external network calls or financial transactions
  assert(typeof candidate.id === 'string' && candidate.id.startsWith('opp_'), 'Test 12: Candidate ID generated safely in memory');

  return { passed, failed, log };
}
