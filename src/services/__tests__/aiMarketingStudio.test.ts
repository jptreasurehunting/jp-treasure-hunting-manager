/**
 * Unit Test Suite for AI Marketing Studio & Rights & Risk Gate (Specs #1 - #22)
 */

import {
  evaluateRightsAndRiskGate,
  generateChannelMarketingContent,
  getAvailableMarketingChannels,
  registerCustomMarketingChannel,
  loadMarketingKnowledgeBase,
  saveMarketingKnowledgeBase,
  saveHumanConfirmedFact,
  recordMarketingPerformance,
  loadMarketingPerformance,
  calculateReviewEffortTier,
  initMarketingStudioHealthModule
} from '../aiMarketingStudioService';
import { evaluateProjectHealth } from '../projectHealthService';

export function runAiMarketingStudioTests(): { passed: number; failed: number; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`❌ [FAIL] ${testName}`);
    }
  };

  // Test 1: Seller-owned image -> evaluates to 🟢 基準適合
  const eval1 = evaluateRightsAndRiskGate({
    assetId: 'img_seller_shot_01',
    assetType: 'image',
    productTitle: 'Canon AE-1 Program Vintage Camera',
    brandName: 'Canon',
    channelId: 'instagram',
    intendedUse: 'sns_post',
    isSellerShotPhoto: true
  });
  assert(
    Boolean(eval1.status === 'STANDARDS_MET' && eval1.canPublish && eval1.statusLabel.includes('基準適合')),
    'Test 1: Seller-owned original image evaluates to 🟢 基準適合'
  );

  // Test 2: Unknown image source -> triggers 🟡 要確認 and offers Guided Human Check
  const eval2 = evaluateRightsAndRiskGate({
    assetId: 'img_unknown_source_02',
    assetType: 'image',
    productTitle: 'Vintage Watch',
    brandName: 'Seiko',
    channelId: 'instagram',
    intendedUse: 'sns_post',
    isSellerShotPhoto: false
  });
  assert(
    Boolean(
      eval2.status === 'NEEDS_CHECK' &&
        !eval2.canPublish &&
        eval2.requiredGuidedChecks.some((c) => c.simpleFactualQuestion.includes('この写真は自社で撮影しましたか？'))
    ),
    'Test 2: Unknown image source triggers 🟡 要確認 with Guided Human Check'
  );

  // Test 3: Commercially licensed music -> verified with license ID
  const eval3 = evaluateRightsAndRiskGate({
    assetId: 'bgm_licensed_03',
    assetType: 'music',
    productTitle: 'Japanese Vintage Watch Reel',
    brandName: 'Omega',
    channelId: 'tiktok',
    intendedUse: 'short_video',
    hasLicensedBgm: true,
    bgmLicenseId: 'kb_music_01'
  });
  assert(
    Boolean(eval3.status === 'STANDARDS_MET' && eval3.canPublish && eval3.evidenceList.some((e) => e.assetType === 'music')),
    'Test 3: Commercially licensed BGM passes Rights Gate'
  );

  // Test 4: Commercial use allowed but advertising license missing -> triggers 🟡 要確認 + Guided Check
  const eval4 = evaluateRightsAndRiskGate({
    assetId: 'bgm_unverified_ad_04',
    assetType: 'music',
    productTitle: 'Promo Reel',
    brandName: 'Casio',
    channelId: 'instagram',
    intendedUse: 'short_video',
    hasLicensedBgm: false
  });
  assert(
    Boolean(
      eval4.status === 'NEEDS_CHECK' &&
        !eval4.canPublish &&
        eval4.requiredGuidedChecks.some((c) => c.simpleFactualQuestion.includes('広告ライセンスを購入済みですか？'))
    ),
    'Test 4: Missing advertising license triggers Guided Check'
  );

  // Test 5: Foreign-language license -> preserves full original decisive clause without truncation
  assert(
    Boolean(
      eval3.evidenceList.some(
        (e) => e.originalLanguage === 'en' && e.originalLanguageText.includes('Grant of Synchronization License')
      )
    ),
    'Test 5: Foreign-language license preserves full original decisive clause'
  );

  // Test 6: Truncated decisive clause prevention -> full clause text and Japanese translation available
  assert(
    Boolean(
      eval3.evidenceList.every(
        (e) => e.originalLanguageText.length > 50 && e.japaneseTranslation.includes('シンクロナイゼーション許諾')
      )
    ),
    'Test 6: Full decisive clause and complete Japanese translation present without truncation'
  );

  // Test 7: Translation disagreement -> stays 🟡 要確認, blocks publication, offers safe alternative
  const eval7 = evaluateRightsAndRiskGate({
    assetId: 'foreign_doc_07',
    assetType: 'text',
    productTitle: 'Imported Collectible',
    brandName: 'Bandai',
    channelId: 'own_ec',
    intendedUse: 'ec_landing',
    hasTranslationDisagreement: true
  });
  assert(
    Boolean(
      eval7.status === 'NEEDS_CHECK' &&
        !eval7.canPublish &&
        eval7.safeFallbacks.length > 0 &&
        eval7.warnings.some((w) => w.includes('翻訳解釈の重大な相違'))
    ),
    'Test 7: Translation disagreement stays 🟡 要確認 and offers safe alternative'
  );

  // Test 8: Safe fallback -> provides safe replacement asset description with one-click readiness
  assert(
    Boolean(eval4.safeFallbacks.length > 0 && eval4.safeFallbacks[0].safeReplacement.includes('Acoustic Folk')),
    'Test 8: Safe fallback offers approved royalty-free music replacement'
  );

  // Test 9: Human confirms self-shot photo -> records fact and passes
  saveHumanConfirmedFact('img_tested_human_09', 'yes');
  const eval9 = evaluateRightsAndRiskGate({
    assetId: 'img_tested_human_09',
    assetType: 'image',
    productTitle: 'Handmade Craft',
    brandName: 'Japanese Artisan',
    channelId: 'instagram',
    intendedUse: 'sns_post',
    isSellerShotPhoto: false
  });
  assert(
    Boolean(eval9.status === 'STANDARDS_MET' && eval9.canPublish),
    'Test 9: Human confirmation of self-shot photo successfully passes Rights Gate'
  );

  // Test 10: Human selects “分からない” -> stays in safe fallback mode
  saveHumanConfirmedFact('img_tested_unknown_10', 'unknown');
  const eval10 = evaluateRightsAndRiskGate({
    assetId: 'img_tested_unknown_10',
    assetType: 'image',
    productTitle: 'Unknown Source Item',
    brandName: 'Generic Brand',
    channelId: 'instagram',
    intendedUse: 'sns_post',
    isSellerShotPhoto: false
  });
  assert(
    Boolean(eval10.status === 'NEEDS_CHECK' && eval10.safeFallbacks.length > 0),
    'Test 10: Human selecting "分からない" switches to safe alternative'
  );

  // Test 11: Reuse of previously confirmed asset -> reuses evidence without re-asking human
  const eval11 = evaluateRightsAndRiskGate({
    assetId: 'img_tested_human_09', // same asset ID confirmed earlier
    assetType: 'image',
    productTitle: 'Handmade Craft Re-listing',
    brandName: 'Japanese Artisan',
    channelId: 'x_twitter',
    intendedUse: 'sns_post'
  });
  assert(
    Boolean(eval11.status === 'STANDARDS_MET' && eval11.requiredGuidedChecks.length === 0),
    'Test 11: Reuses previously approved fact without re-prompting human'
  );

  // Test 12: Stale knowledge detection
  const kb = loadMarketingKnowledgeBase();
  kb.push({
    knowledgeId: 'kb_stale_test_12',
    title: 'Old Sound Library License',
    category: 'approved_music_library',
    scope: 'Global',
    evidence: 'Old License',
    source: 'Expired Provider',
    version: '1.0',
    lastVerifiedDate: '2024-01-01',
    reviewer: 'Old Reviewer',
    expiryRecheckRule: 'Expired',
    lifecycleStatus: 'recheck_required',
    isStale: true
  });
  saveMarketingKnowledgeBase(kb);
  const eval12 = evaluateRightsAndRiskGate({
    assetId: 'asset_stale_12',
    assetType: 'text',
    productTitle: 'Test Item',
    brandName: 'Brand',
    channelId: 'instagram',
    intendedUse: 'sns_post'
  });
  assert(
    Boolean(eval12.warnings.some((w) => w.includes('要再確認のルール'))),
    'Test 12: Stale knowledge triggers warnings in evaluation'
  );

  // Test 13: Revoked knowledge blocks campaigns
  kb.push({
    knowledgeId: 'kb_revoked_test_13',
    title: 'Revoked Image Provider',
    category: 'approved_image_source',
    scope: 'Global',
    evidence: 'License Revoked by Licensor',
    source: 'Revoked Source',
    version: '1.0',
    lastVerifiedDate: '2026-08-01',
    reviewer: 'Legal Officer',
    expiryRecheckRule: 'Immediately Revoked',
    lifecycleStatus: 'revoked',
    isStale: false
  });
  saveMarketingKnowledgeBase(kb);
  initMarketingStudioHealthModule();
  const health13 = evaluateProjectHealth();
  assert(
    Boolean(
      health13.itemsByCategory.future_module.some(
        (m) => m.id === 'module_marketing_studio' && m.status === 'error' && m.isCriticalWarning
      )
    ),
    'Test 13: Revoked knowledge triggers critical warning and error in health dashboard'
  );

  // Clean up test knowledge entries
  saveMarketingKnowledgeBase(kb.filter((k) => k.knowledgeId !== 'kb_stale_test_12' && k.knowledgeId !== 'kb_revoked_test_13'));

  // Test 14: Country scope mismatch detection
  const eval14 = evaluateRightsAndRiskGate({
    assetId: 'asset_geo_14',
    assetType: 'text',
    productTitle: 'Geo Restricted Promo',
    brandName: 'Brand',
    channelId: 'shopee',
    intendedUse: 'sns_post',
    countryScope: 'US only'
  });
  assert(
    Boolean(eval14.warnings.some((w) => w.includes('利用許諾地域'))),
    'Test 14: Country scope mismatch flagged in warnings'
  );

  // Test 15: Channel scope mismatch and official footage prohibition
  const eval15 = evaluateRightsAndRiskGate({
    assetId: 'video_official_anime_15',
    assetType: 'video',
    productTitle: 'Anime Figure Commercial',
    brandName: 'Anime Studio',
    channelId: 'tiktok',
    intendedUse: 'short_video',
    hasOfficialVideoFootage: true
  });
  assert(
    Boolean(eval15.status === 'PROHIBITED' && !eval15.canPublish && eval15.blockingReasons.some((r) => r.includes('公式アニメ'))),
    'Test 15: Unverified official anime footage prohibited by default'
  );

  // Test 16: Required attribution missing -> blocks publication
  const eval16 = evaluateRightsAndRiskGate({
    assetId: 'asset_attr_16',
    assetType: 'text',
    productTitle: 'CC-BY Content Item',
    brandName: 'Brand',
    channelId: 'instagram',
    intendedUse: 'sns_post',
    isAttributionRequired: true,
    isAttributionIncluded: false
  });
  assert(
    Boolean(eval16.status === 'NEEDS_CHECK' && !eval16.canPublish && eval16.blockingReasons.some((r) => r.includes('クレジット'))),
    'Test 16: Missing required attribution blocks publication'
  );

  // Test 17: Factual channel-specific marketing generation (No fabricated rarity)
  const content17 = generateChannelMarketingContent({
    productId: 'item_camera_17',
    productTitle: 'Canon AE-1 Program Vintage Camera',
    categoryName: 'Cameras & Photo',
    brandName: 'Canon',
    sellingPriceUsd: 300,
    conditionDescription: 'Excellent optical condition with original leather case',
    channelId: 'instagram',
    creativeVariant: 'Variant A'
  });
  assert(
    Boolean(
      content17.shortProductHook.includes('Canon AE-1') &&
        content17.collectorAppeal.includes('実物写真に基づく状態') &&
        content17.backgroundMusicAudioMutedByDefault === true &&
        content17.hashtags &&
        content17.hashtags.length > 0
    ),
    'Test 17: Factual channel-specific content generation with muted audio default and verified appeals'
  );

  // Test 18: Performance recording and A/B variant metrics tracking
  recordMarketingPerformance({
    productId: 'item_camera_17',
    productTitle: 'Canon AE-1',
    channelId: 'instagram',
    campaignVersion: '2026.Q3',
    creativeVersion: 'Variant A',
    impressions: 1200,
    clicks: 65,
    ctr: 5.4,
    productPageVisits: 45,
    conversionCount: 2,
    revenueUsd: 600,
    profitUsd: 140,
    isMeasuredData: true
  });
  const perfList = loadMarketingPerformance();
  assert(
    Boolean(perfList.some((p) => p.productId === 'item_camera_17' && p.creativeVersion === 'Variant A' && p.clicks === 65)),
    'Test 18: Actual measured marketing performance and A/B metrics recorded successfully'
  );

  // Test 19: Review effort tier calculation
  const effort19 = calculateReviewEffortTier({
    productValueUsd: 3500,
    expectedProfitUsd: 600,
    hasUnverifiedExternalMedia: false,
    isHighSensitivityBrand: true
  });
  assert(
    Boolean(effort19.tier === 'specialist_recommended'),
    'Test 19: High-value luxury item assigns specialist_recommended review tier'
  );

  // Test 20: Dynamic custom channel registration
  registerCustomMarketingChannel({
    channelId: 'custom_line_shopping',
    name: 'LINE公式アカウント & ショップ',
    category: 'sns',
    icon: '💬',
    maxTextLength: 1000,
    supportsHashtags: false,
    supportsRichStory: true,
    supportsDdpInfo: false,
    requiresStrictNoOffPlatformLinks: false,
    recommendedAspectRatios: ['1:1']
  });
  const channels = getAvailableMarketingChannels();
  assert(
    Boolean(channels.some((c) => c.channelId === 'custom_line_shopping')),
    'Test 20: Custom marketing channel dynamically registered without modifying core'
  );

  return { passed, failed, log };
}
