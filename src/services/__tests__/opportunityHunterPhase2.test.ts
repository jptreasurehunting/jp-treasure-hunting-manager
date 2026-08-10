import {
  generateCanonicalKey,
  getAuthorityTrustMultiplier,
  mergeConflictingSignals,
  ingestOpportunitySignals,
  getPhase2SeedOpportunitySignals,
  normalizeTitleForDeduplication
} from '../opportunityDiscoveryService';
import {
  evaluateCandidateFreshness,
  transitionLifecycleStage,
  recordCandidatePricePoint,
  refreshOpportunityPoolFreshness
} from '../opportunityMonitoringService';
import {
  createOpportunityCandidate,
  getInitialOpportunityCandidates
} from '../opportunityHunterService';
import {
  RawOpportunitySignal,
  OpportunityCandidate,
  SourceAuthorityLevel
} from '../../types/opportunityHunter';

export function runOpportunityHunterPhase2Tests(): { passed: number; failed: number; log: string[] } {
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

  // --- Test 1: Canonical Key Generation differentiates variants ---
  const keyStandard = generateCanonicalKey('Good Smile', 'Fate Saber 1/7 Scale Figure');
  const keyDxBonus = generateCanonicalKey('Good Smile', 'Fate Saber 1/7 Scale Figure', undefined, 'AmiAmi Exclusive Tapestry Bonus');
  assert(keyStandard !== keyDxBonus, 'Test 1: Canonical Key differentiates standard item from exclusive bonus variant');
  assert(keyDxBonus.includes('amiamiexclusivetapestrybonus'), 'Test 1b: Canonical Key includes variant discriminator');

  // --- Test 2: Canonical Key uses JAN code when available ---
  const keyJan = generateCanonicalKey('Bandai', 'Gundam Model Kit', '4573102612345');
  assert(keyJan === 'jan_4573102612345', 'Test 2: Canonical Key uses normalized JAN code');

  // --- Test 3: Authority Trust Multiplier maps 6 tiers ---
  assert(getAuthorityTrustMultiplier('OFFICIAL_MANUFACTURER') === 1.0, 'Test 3a: Official Manufacturer has 100% trust');
  assert(getAuthorityTrustMultiplier('OFFICIAL_RETAILER_OR_EVENT') === 0.95, 'Test 3b: Official Retailer has 95% trust');
  assert(getAuthorityTrustMultiplier('AUTHORIZED_DISTRIBUTOR') === 0.85, 'Test 3c: Authorized Distributor has 85% trust');
  assert(getAuthorityTrustMultiplier('REPUTABLE_NEWS_MEDIA') === 0.70, 'Test 3d: Reputable Media has 70% trust');
  assert(getAuthorityTrustMultiplier('SECONDARY_AGGREGATOR') === 0.40, 'Test 3e: Secondary Aggregator has 40% trust');
  assert(getAuthorityTrustMultiplier('UNKNOWN_SOURCE') === 0.20, 'Test 3f: Unknown Source has 20% trust');

  // --- Test 4: Ingestion & Deduplication merges duplicate signal ---
  const basePool = getInitialOpportunityCandidates();
  const duplicateSignal: RawOpportunitySignal = {
    sourceUrl: 'https://official-update.example.jp/item',
    sourceName: 'Official Distributor Update',
    sourceAuthority: 'OFFICIAL_MANUFACTURER',
    title: basePool[0].title,
    brand: basePool[0].brand,
    category: basePool[0].category,
    opportunityTypes: ['JAPAN_EXCLUSIVE', 'ANNIVERSARY_MODEL'],
    askingPriceJpy: basePool[0].economics.askingPriceJpy + 1000, // higher asking price
    expectedEbayPriceUsd: basePool[0].economics.expectedEbayPriceUsd - 10, // lower selling price
    releaseDate: basePool[0].releaseDate,
    hasOfficialPhoto: true,
    evidenceNotes: '公式追加告知による情報更新'
  };

  const mergedPool = ingestOpportunitySignals(basePool, [duplicateSignal]);
  assert(mergedPool.length === basePool.length, 'Test 4: Merging duplicate signal does not increase pool count');

  const updatedCandidate = mergedPool.find((c) => c.title === basePool[0].title);
  assert(
    Boolean(updatedCandidate && updatedCandidate.economics.askingPriceJpy === basePool[0].economics.askingPriceJpy + 1000),
    'Test 4b: Conservative price resolution selected higher asking price'
  );
  assert(
    Boolean(updatedCandidate && updatedCandidate.economics.expectedEbayPriceUsd === basePool[0].economics.expectedEbayPriceUsd - 10),
    'Test 4c: Conservative price resolution selected lower selling price'
  );

  // --- Test 5: Ingestion creates distinct candidates for different edition variants ---
  const variantSignal: RawOpportunitySignal = {
    sourceUrl: 'https://shop-exclusive.example.jp/item-dx',
    sourceName: 'Store Exclusive Edition Shop',
    sourceAuthority: 'OFFICIAL_RETAILER_OR_EVENT',
    title: basePool[0].title,
    editionVariant: 'Store Exclusive Acrylic Stand Bonus',
    brand: basePool[0].brand,
    category: basePool[0].category,
    opportunityTypes: ['EVENT_STORE_EXCLUSIVE', 'PREORDER_EXCLUSIVE'],
    askingPriceJpy: 28000,
    expectedEbayPriceUsd: 420.0,
    releaseDate: basePool[0].releaseDate,
    hasOfficialPhoto: true,
    evidenceNotes: '店舗限定アクリルスタンド付き豪華版'
  };

  const expandedPool = ingestOpportunitySignals(basePool, [variantSignal]);
  assert(expandedPool.length === basePool.length + 1, 'Test 5: Variant signal creates distinct candidate in pool');
  assert(expandedPool.some((c) => c.title.includes('Store Exclusive Acrylic Stand Bonus')), 'Test 5b: Title reflects variant name');

  // --- Test 6: Stale Evidence (>14 days) reduces score & adds warning ---
  const freshCandidate = basePool[0];
  const oldCheckedDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(); // 20 days ago
  const staleCandidate: OpportunityCandidate = {
    ...freshCandidate,
    evidence: {
      ...freshCandidate.evidence,
      checkedAt: oldCheckedDate
    },
    updatedAt: oldCheckedDate
  };

  const evaluatedStale = evaluateCandidateFreshness(staleCandidate);
  assert(evaluatedStale.isDataStale === true, 'Test 6: Candidate older than 14 days is flagged as stale');
  assert(
    evaluatedStale.scoreBreakdown.warningFlags.some((w) => w.includes('情報陳腐化警告')),
    'Test 6b: Stale warning flag added'
  );
  assert(
    evaluatedStale.scoreBreakdown.penaltyDeductions > freshCandidate.scoreBreakdown.penaltyDeductions,
    'Test 6c: Penalty deductions increased for stale candidate'
  );

  // --- Test 7: Fresh candidate retains full score ---
  const evaluatedFresh = evaluateCandidateFreshness(freshCandidate);
  assert(evaluatedFresh.isDataStale === false, 'Test 7: Fresh candidate is not flagged as stale');

  // --- Test 8: Lifecycle transition to SOLD_OUT refused on network error ---
  const transitionRefused = transitionLifecycleStage(
    freshCandidate,
    'SOLD_OUT',
    'Page returned 404',
    true // isNetworkError
  );
  assert(transitionRefused.transitionSuccess === false, 'Test 8: SOLD_OUT transition refused when caused by network error');
  assert(
    transitionRefused.refusalReason?.includes('通信エラー') || false,
    'Test 8b: Refusal reason clearly logged'
  );
  assert(
    transitionRefused.updatedCandidate.lifecycleStage !== 'SOLD_OUT',
    'Test 8c: Candidate lifecycle stage remains unchanged'
  );

  // --- Test 9: Lifecycle transition succeeds with explicit confirmation ---
  const transitionSuccess = transitionLifecycleStage(
    freshCandidate,
    'SOLD_OUT',
    '公式ショップにて【完売 / 受付終了】の明示的表示を確認',
    false
  );
  assert(transitionSuccess.transitionSuccess === true, 'Test 9: SOLD_OUT transition succeeds with explicit evidence');
  assert(transitionSuccess.updatedCandidate.lifecycleStage === 'SOLD_OUT', 'Test 9b: Lifecycle stage updated to SOLD_OUT');

  // --- Test 10: Historical Price Point Recording ---
  const withPrice = recordCandidatePricePoint(
    freshCandidate,
    25000,
    390.0,
    'Staff-A',
    '公式予約開始時の定価記録'
  );
  assert(withPrice.historicalPricePoints?.length === 1, 'Test 10: Price point recorded');
  assert(withPrice.historicalPricePoints?.[0].priceJpy === 25000, 'Test 10b: Correct JPY price stored');

  // --- Test 11: Phase 2 Seed Signals Ingest cleanly ---
  const seedSignals = getPhase2SeedOpportunitySignals();
  assert(seedSignals.length >= 4, 'Test 11: Seed signals contain at least 4 scenarios');
  const seededPool = ingestOpportunitySignals([], seedSignals);
  assert(seededPool.length === seedSignals.length, 'Test 11b: All seed signals ingested cleanly');

  // --- Test 12: Normalization utility test ---
  const normTitle = normalizeTitleForDeduplication('【限定】 ガンダム （超合金） 「公式」');
  assert(normTitle === '限定 ガンダム 超合金 公式', 'Test 12: Title normalized and brackets stripped cleanly');

  return { passed, failed, log };
}
