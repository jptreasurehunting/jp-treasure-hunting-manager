import {
  RawOpportunitySignal,
  OpportunityCandidate,
  SourceAuthorityLevel,
  OpportunityEvidence,
  GeographicExclusivityEvidence,
  SupplyAvailabilitySignal
} from '../types/opportunityHunter';
import {
  createOpportunityCandidate,
  calculateOpportunityScore
} from './opportunityHunterService';

/**
 * Normalizes title string for canonical hash generation
 */
export function normalizeTitleForDeduplication(title: string): string {
  return title
    .toLowerCase()
    .replace(/[【】\[\]（）\(\)「」『』]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates deterministic canonical key for product deduplication (Decision A)
 * Distinguishes store-bonuses, DX editions, and regional variants.
 */
export function generateCanonicalKey(
  brand: string,
  title: string,
  productCode?: string,
  editionVariant?: string
): string {
  if (productCode && productCode.trim().length >= 8) {
    const cleanJan = productCode.trim().replace(/[^0-9A-Za-z]/g, '');
    const variantSuffix = editionVariant ? `_${editionVariant.trim().toLowerCase()}` : '';
    return `jan_${cleanJan}${variantSuffix}`;
  }

  const normBrand = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTitle = normalizeTitleForDeduplication(title).replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '');
  const variantSuffix = editionVariant ? `_${editionVariant.trim().toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9faf]/g, '')}` : '';

  return `key_${normBrand}_${normTitle.substring(0, 40)}${variantSuffix}`;
}

/**
 * Maps source authority to confidence base multiplier (Decision B)
 */
export function getAuthorityTrustMultiplier(authority: SourceAuthorityLevel): number {
  switch (authority) {
    case 'OFFICIAL_MANUFACTURER':
      return 1.0; // 100%
    case 'OFFICIAL_RETAILER_OR_EVENT':
      return 0.95; // 95%
    case 'AUTHORIZED_DISTRIBUTOR':
      return 0.85; // 85%
    case 'REPUTABLE_NEWS_MEDIA':
      return 0.70; // 70%
    case 'SECONDARY_AGGREGATOR':
      return 0.40; // 40%
    case 'UNKNOWN_SOURCE':
    default:
      return 0.20; // 20%
  }
}

/**
 * Resolves conflicting signals deterministically using conservative rules (Decision D)
 */
export function mergeConflictingSignals(
  existing: OpportunityCandidate,
  incoming: RawOpportunitySignal
): OpportunityCandidate {
  const existingAuthority = existing.evidence.sourceAuthority || 'UNKNOWN_SOURCE';
  const incomingAuthority = incoming.sourceAuthority;

  const existingWeight = getAuthorityTrustMultiplier(existingAuthority);
  const incomingWeight = getAuthorityTrustMultiplier(incomingAuthority);

  // If incoming has higher authority, update key fields
  const isIncomingHigherAuthority = incomingWeight > existingWeight;

  // Conservative price resolution: Higher cost, lower selling price when conflicting
  const resolvedAskingPriceJpy = Math.max(existing.economics.askingPriceJpy, incoming.askingPriceJpy);
  const resolvedExpectedEbayUsd = Math.min(existing.economics.expectedEbayPriceUsd, incoming.expectedEbayPriceUsd);

  const updatedEvidence: OpportunityEvidence = {
    ...existing.evidence,
    sourceUrl: isIncomingHigherAuthority ? incoming.sourceUrl : existing.evidence.sourceUrl,
    sourceName: isIncomingHigherAuthority ? incoming.sourceName : existing.evidence.sourceName,
    sourceAuthority: isIncomingHigherAuthority ? incomingAuthority : existingAuthority,
    checkedAt: new Date().toISOString(),
    confidenceScore: Math.round(Math.max(existing.evidence.confidenceScore, 90 * incomingWeight)),
    evidenceNotes: `${existing.evidence.evidenceNotes} | 更新 (${incoming.sourceName}): ${incoming.evidenceNotes}`
  };

  const updatedGeo: GeographicExclusivityEvidence = {
    isJapanExclusive: existing.geographicExclusivity?.isJapanExclusive || incoming.opportunityTypes.includes('JAPAN_EXCLUSIVE'),
    japanExclusivityProof: incoming.japanExclusivityProof || existing.geographicExclusivity?.japanExclusivityProof || '国内公式販売確認',
    hasOverseasReleasePlan: incoming.hasOverseasReleasePlan ?? existing.geographicExclusivity?.hasOverseasReleasePlan ?? false
  };

  const updated = createOpportunityCandidate({
    title: isIncomingHigherAuthority ? incoming.title : existing.title,
    brand: isIncomingHigherAuthority ? incoming.brand : existing.brand,
    category: isIncomingHigherAuthority ? incoming.category : existing.category,
    characterOrSeries: incoming.characterOrSeries || existing.characterOrSeries,
    opportunityTypes: Array.from(new Set([...existing.opportunityTypes, ...incoming.opportunityTypes])),
    releaseDate: incoming.releaseDate || existing.releaseDate,
    preOrderDeadline: incoming.preOrderDeadline || existing.preOrderDeadline,
    askingPriceJpy: resolvedAskingPriceJpy,
    domesticShippingJpy: existing.economics.domesticShippingJpy,
    expectedEbayPriceUsd: resolvedExpectedEbayUsd,
    exchangeRate: existing.economics.exchangeRate,
    estimatedIntlShippingUsd: existing.economics.estimatedIntlShippingUsd,
    evidence: updatedEvidence,
    rawDemandSignal: incoming.rawDemandSignal,
    seriesSellThroughRate: incoming.seriesSellThroughRate
  });

  return {
    ...updated,
    id: existing.id,
    canonicalHash: existing.canonicalHash,
    approvalStatus: existing.approvalStatus,
    approvalHistory: existing.approvalHistory,
    lifecycleStage: existing.lifecycleStage,
    geographicExclusivity: updatedGeo,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Finds matching existing candidate by JAN/Product code or normalized brand + title
 */
export function findMatchingExistingCandidate(
  pool: OpportunityCandidate[],
  brand: string,
  title: string,
  productCode?: string,
  editionVariant?: string
): OpportunityCandidate | undefined {
  if (productCode && productCode.trim().length >= 8) {
    const cleanJan = productCode.trim().replace(/[^0-9A-Za-z]/g, '');
    const matchByJan = pool.find((c) => {
      const cJan = c.evidence.productCode?.trim().replace(/[^0-9A-Za-z]/g, '');
      return cJan === cleanJan;
    });
    if (matchByJan) return matchByJan;
  }

  const searchKey = generateCanonicalKey(brand, title, undefined, editionVariant);
  return pool.find((c) => {
    const cKey = generateCanonicalKey(c.brand, c.title, undefined, undefined);
    return cKey === searchKey || c.canonicalHash === searchKey;
  });
}

/**
 * Ingests and deduplicates raw opportunity signals into candidate pool
 */
export function ingestOpportunitySignals(
  existingPool: OpportunityCandidate[],
  newSignals: RawOpportunitySignal[]
): OpportunityCandidate[] {
  let pool = [...existingPool];

  newSignals.forEach((sig) => {
    const existing = findMatchingExistingCandidate(
      pool,
      sig.brand,
      sig.title,
      sig.productCode,
      sig.editionVariant
    );

    if (existing) {
      // Merge with conservative resolution
      const merged = mergeConflictingSignals(existing, sig);
      pool = pool.map((c) => (c.id === existing.id ? merged : c));
    } else {
      // Create new candidate
      const canonicalKey = generateCanonicalKey(sig.brand, sig.title, sig.productCode, sig.editionVariant);
      const authorityMultiplier = getAuthorityTrustMultiplier(sig.sourceAuthority);
      const initialConfidence = Math.round(85 * authorityMultiplier);

      const evidence: OpportunityEvidence = {
        sourceUrl: sig.sourceUrl,
        sourceName: sig.sourceName,
        sourceAuthority: sig.sourceAuthority,
        checkedAt: new Date().toISOString(),
        evidenceNotes: sig.evidenceNotes,
        confidenceScore: initialConfidence,
        hasJanOrProductCode: Boolean(sig.productCode && sig.productCode.length > 5),
        productCode: sig.productCode,
        hasOfficialAnnouncementPhoto: sig.hasOfficialPhoto
      };

      const geo: GeographicExclusivityEvidence = {
        isJapanExclusive: sig.opportunityTypes.includes('JAPAN_EXCLUSIVE'),
        japanExclusivityProof: sig.japanExclusivityProof || '国内公式発表確認',
        hasOverseasReleasePlan: sig.hasOverseasReleasePlan || false
      };

      const supply: SupplyAvailabilitySignal = {
        allocationType: sig.opportunityTypes.includes('MADE_TO_ORDER')
          ? 'MADE_TO_ORDER'
          : sig.opportunityTypes.includes('LOTTERY_SALE')
          ? 'LOTTERY'
          : sig.opportunityTypes.includes('LIMITED_QUANTITY')
          ? 'QUANTITY_CAPPED'
          : 'OPEN_PREORDER',
        currentStockStatus: 'IN_STOCK',
        preorderStartDate: sig.releaseDate ? '2026-08-01' : undefined,
        preorderEndDate: sig.preOrderDeadline
      };

      const cand = createOpportunityCandidate({
        title: sig.editionVariant ? `${sig.title} 【${sig.editionVariant}】` : sig.title,
        brand: sig.brand,
        category: sig.category,
        characterOrSeries: sig.characterOrSeries,
        opportunityTypes: sig.opportunityTypes,
        releaseDate: sig.releaseDate,
        preOrderDeadline: sig.preOrderDeadline,
        askingPriceJpy: sig.askingPriceJpy,
        domesticShippingJpy: 800,
        expectedEbayPriceUsd: sig.expectedEbayPriceUsd,
        exchangeRate: 155.0,
        estimatedIntlShippingUsd: 24.0,
        evidence,
        rawDemandSignal: sig.rawDemandSignal ?? 80,
        seriesSellThroughRate: sig.seriesSellThroughRate ?? 85
      });

      cand.geographicExclusivity = geo;
      cand.supplyAvailability = supply;
      pool.push(cand);
    }
  });

  return pool;
}

/**
 * Phase 2 Seed Signals for Simulated Ingestion
 */
export function getPhase2SeedOpportunitySignals(): RawOpportunitySignal[] {
  return [
    {
      sourceUrl: 'https://p-bandai.example.jp/item/item-1000192834',
      sourceName: 'Premium Bandai Official',
      sourceAuthority: 'OFFICIAL_RETAILER_OR_EVENT',
      title: 'Metal Build Gundam Astraea Type-X Finsternis Limited Edition',
      brand: 'Bandai Spirits',
      characterOrSeries: 'Gundam 00',
      category: 'Figure',
      opportunityTypes: ['LIMITED_QUANTITY', 'PREORDER_EXCLUSIVE', 'JAPAN_EXCLUSIVE'],
      askingPriceJpy: 26400,
      expectedEbayPriceUsd: 410.0,
      releaseDate: '2026-09-25',
      preOrderDeadline: '2026-08-20',
      productCode: '4573102619999',
      hasOfficialPhoto: true,
      evidenceNotes: 'プレバン限定受注。過去メタルビルドシリーズ完売率98%。',
      rawDemandSignal: 94,
      seriesSellThroughRate: 96,
      japanExclusivityProof: 'プレミアムバンダイ日本国内専用受注',
      hasOverseasReleasePlan: false
    },
    {
      sourceUrl: 'https://goodsmile.example.jp/products/fate-saber-kimono-dx',
      sourceName: 'Good Smile Company Official',
      sourceAuthority: 'OFFICIAL_MANUFACTURER',
      title: 'Fate/stay night Saber Kimono Ver. 1/7 Scale Figure',
      editionVariant: 'GoodSmile Online Exclusive B2 Tapestry Bonus',
      brand: 'Good Smile Company',
      characterOrSeries: 'Fate Series',
      category: 'Figure',
      opportunityTypes: ['PREORDER_EXCLUSIVE', 'MADE_TO_ORDER', 'JAPAN_EXCLUSIVE'],
      askingPriceJpy: 24000,
      expectedEbayPriceUsd: 370.0,
      releaseDate: '2026-09-10',
      preOrderDeadline: '2026-08-28',
      productCode: '4580416941234',
      hasOfficialPhoto: true,
      evidenceNotes: '公式オンライン限定特典付き。北米Fateコレクターからの需要大。',
      rawDemandSignal: 90,
      seriesSellThroughRate: 92,
      japanExclusivityProof: 'GSC公式ショップ限定タペストリー特典付き',
      hasOverseasReleasePlan: false
    },
    {
      sourceUrl: 'https://hobby-watch.example.jp/news/20260805_1234.html',
      sourceName: 'Hobby Watch Media',
      sourceAuthority: 'REPUTABLE_NEWS_MEDIA',
      title: 'Studio Ghibli My Neighbor Totoro 40th Anniversary Wooden Clock',
      brand: 'Studio Ghibli / Donguri Kyowakoku',
      characterOrSeries: 'My Neighbor Totoro',
      category: 'Collectibles',
      opportunityTypes: ['ANNIVERSARY_MODEL', 'MADE_TO_ORDER', 'OVERSEAS_UNRELEASED'],
      askingPriceJpy: 18700,
      expectedEbayPriceUsd: 295.0,
      releaseDate: '2026-08-30',
      preOrderDeadline: '2026-08-18',
      productCode: '4990593418888',
      hasOfficialPhoto: true,
      evidenceNotes: 'どんぐり共和国40周年受注生産品。海外ジブリファン需要高。',
      rawDemandSignal: 86,
      seriesSellThroughRate: 90,
      japanExclusivityProof: 'どんぐり共和国店頭および公式通販限定',
      hasOverseasReleasePlan: false
    },
    {
      sourceUrl: 'https://sns-rumors.example.jp/post/999888',
      sourceName: 'Hobby Leaks Blog',
      sourceAuthority: 'SECONDARY_AGGREGATOR', // Low authority
      title: 'Unannounced Anime Collaboration Acrylic Stand Set',
      brand: 'Unknown Maker',
      category: 'Merchandise',
      opportunityTypes: ['COLLABORATION'],
      askingPriceJpy: 6000,
      expectedEbayPriceUsd: 55.0,
      releaseDate: '2026-10-01',
      hasOfficialPhoto: false,
      evidenceNotes: 'SNS上の噂情報。公式発表未確認。',
      rawDemandSignal: 30,
      seriesSellThroughRate: 40
    }
  ];
}
