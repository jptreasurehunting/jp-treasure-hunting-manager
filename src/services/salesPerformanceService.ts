import {
  SalesPerformanceRecord,
  StoreLearningSummary,
  CalculationState,
  ConfidenceBand,
  HistoricalChangeSnapshot
} from '../types/safetyGate';

const SALES_PERFORMANCE_SESSION_KEY = 'zonos_sales_performance_records';
const HISTORICAL_CHANGES_SESSION_KEY = 'zonos_historical_change_snapshots';

/**
 * Creates Initial Sample Historical Sales Records
 */
export function createInitialSalesPerformanceRecords(): SalesPerformanceRecord[] {
  return [
    {
      id: 'rec-001',
      internalProductId: 'INV-2026-001',
      sku: 'SKU-CAM-001',
      ebayItemId: '256123456781',
      ebayOrderId: '14-12345-67801',
      ebayLineItemId: 'line-001',
      productTitle: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
      brand: 'Canon',
      manufacturer: 'Canon Inc.',
      characterOrSeries: 'AE-1 Series',
      productCategory: 'Cameras & Photo',
      productCondition: 'Used / Excellent',
      countryOfManufacture: 'Japan',
      destinationCountry: 'US',
      shippingService: 'Japan Post International EMS',

      acquisitionDate: '2026-05-10',
      firstListingDate: '2026-05-12',
      orderDate: '2026-06-15',
      shipmentDate: '2026-06-16',
      deliveryDate: '2026-06-22',

      purchaseCostJpy: 12000,
      domesticShippingCostJpy: 700,
      originalSalePriceUsd: 280,
      finalSalePriceUsd: 280,
      buyerPaidShippingUsd: 0,
      ebaySellingFeesUsd: 42,
      promotedListingFeesUsd: 8.4,
      actualIntlShippingUsd: 24,
      customsDutyZonosCostUsd: 0,
      packagingCostJpy: 300,
      refundAmountUsd: 0,
      sellerCompensationUsd: 0,
      otherCostsUsd: 0,
      currency: 'USD',
      exchangeRateJpyPerUsd: 150,

      listedQty: 1,
      soldQty: 1,
      returnedQty: 0,
      refundedQty: 0,
      cancelledQty: 0,

      outcomeCategory: 'Completed sale',
      calculationState: 'CONFIRMED',
      missingCostsChecklist: []
    },
    {
      id: 'rec-002',
      internalProductId: 'INV-2026-002',
      sku: 'SKU-LENS-002',
      ebayItemId: '256123456782',
      ebayOrderId: '14-12345-67802',
      ebayLineItemId: 'line-002',
      productTitle: 'Canon FD 50mm f/1.4 S.S.C. Prime Lens',
      brand: 'Canon',
      manufacturer: 'Canon Inc.',
      characterOrSeries: 'FD Lens Series',
      productCategory: 'Cameras & Photo',
      productCondition: 'Used / Mint',
      countryOfManufacture: 'Japan',
      destinationCountry: 'DE',
      shippingService: 'Japan Post International ePacket',

      acquisitionDate: '2026-05-15',
      firstListingDate: '2026-05-18',
      orderDate: '2026-06-20',
      shipmentDate: '2026-06-21',
      deliveryDate: '2026-06-29',

      purchaseCostJpy: 8000,
      domesticShippingCostJpy: 600,
      originalSalePriceUsd: 190,
      finalSalePriceUsd: 190,
      buyerPaidShippingUsd: 0,
      ebaySellingFeesUsd: 28.5,
      promotedListingFeesUsd: 5.7,
      actualIntlShippingUsd: 18,
      customsDutyZonosCostUsd: 12,
      packagingCostJpy: 250,
      refundAmountUsd: 0,
      sellerCompensationUsd: 0,
      otherCostsUsd: 0,
      currency: 'USD',
      exchangeRateJpyPerUsd: 150,

      listedQty: 1,
      soldQty: 1,
      returnedQty: 0,
      refundedQty: 0,
      cancelledQty: 0,

      outcomeCategory: 'Completed sale',
      calculationState: 'CONFIRMED',
      missingCostsChecklist: []
    },
    {
      id: 'rec-003',
      internalProductId: 'INV-2026-003',
      sku: 'SKU-SONY-003',
      ebayItemId: '256123456783',
      ebayOrderId: '14-12345-67803',
      ebayLineItemId: 'line-003',
      productTitle: 'Sony Alpha A7 IV Mirrorless Digital Camera Body',
      brand: 'Sony',
      manufacturer: 'Sony Corporation',
      characterOrSeries: 'Alpha Series',
      productCategory: 'Cameras & Photo',
      productCondition: 'Used / Near Mint',
      countryOfManufacture: 'Japan',
      destinationCountry: 'US',
      shippingService: 'FedEx International Priority',

      acquisitionDate: '2026-06-01',
      firstListingDate: '2026-06-03',
      orderDate: '2026-07-02',
      shipmentDate: '2026-07-03',
      deliveryDate: '2026-07-06',

      purchaseCostJpy: 180000,
      domesticShippingCostJpy: 1000,
      originalSalePriceUsd: 1750,
      finalSalePriceUsd: 1750,
      buyerPaidShippingUsd: 0,
      ebaySellingFeesUsd: 210,
      promotedListingFeesUsd: 35,
      actualIntlShippingUsd: 45,
      customsDutyZonosCostUsd: 0,
      packagingCostJpy: 500,
      refundAmountUsd: 0,
      sellerCompensationUsd: 0,
      otherCostsUsd: 0,
      currency: 'USD',
      exchangeRateJpyPerUsd: 150,

      listedQty: 1,
      soldQty: 1,
      returnedQty: 0,
      refundedQty: 0,
      cancelledQty: 0,

      outcomeCategory: 'Completed sale',
      calculationState: 'CONFIRMED',
      missingCostsChecklist: []
    },
    {
      id: 'rec-004',
      internalProductId: 'INV-2026-004',
      sku: 'SKU-ACC-004',
      ebayItemId: '256123456784',
      ebayOrderId: '14-12345-67804',
      ebayLineItemId: 'line-004',
      productTitle: 'Vintage Leather Camera Strap Brown',
      brand: 'Canon',
      manufacturer: 'Canon Inc.',
      characterOrSeries: 'Accessories',
      productCategory: 'Camera Accessories',
      productCondition: 'Used / Good',
      countryOfManufacture: 'Japan',
      destinationCountry: 'US',
      shippingService: 'Japan Post International ePacket',

      acquisitionDate: '2026-06-10',
      firstListingDate: '2026-06-12',
      orderDate: '2026-07-10',
      shipmentDate: '2026-07-11',
      deliveryDate: '2026-07-20',

      originalSalePriceUsd: 45,
      finalSalePriceUsd: 45,
      buyerPaidShippingUsd: 0,
      ebaySellingFeesUsd: 6.75,
      promotedListingFeesUsd: 1.35,
      actualIntlShippingUsd: 12,
      refundAmountUsd: 0,
      sellerCompensationUsd: 0,
      otherCostsUsd: 0,
      currency: 'USD',
      exchangeRateJpyPerUsd: 150,

      listedQty: 1,
      soldQty: 1,
      returnedQty: 0,
      refundedQty: 0,
      cancelledQty: 0,

      outcomeCategory: 'Completed sale',
      calculationState: 'PROVISIONAL', // Missing purchase cost
      missingCostsChecklist: ['仕入原価 (Purchase Cost) 未入力', '国内送料 (Domestic Shipping) 未入力']
    }
  ];
}

/**
 * Calculates Performance Metrics for a Single Record
 */
export function calculateRecordMetrics(rec: SalesPerformanceRecord): SalesPerformanceRecord {
  const rate = rec.exchangeRateJpyPerUsd || 150;
  const missingChecklist: string[] = [];

  // Check missing costs
  if (rec.purchaseCostJpy === undefined || rec.purchaseCostJpy === null) {
    missingChecklist.push('仕入原価 (Purchase Cost) 未入力');
  }
  if (rec.domesticShippingCostJpy === undefined || rec.domesticShippingCostJpy === null) {
    missingChecklist.push('国内送料 (Domestic Shipping) 未入力');
  }
  if (rec.actualIntlShippingUsd === undefined || rec.actualIntlShippingUsd === null) {
    missingChecklist.push('実績国際送料 (Actual International Shipping) 未入力');
  }

  const calcState: CalculationState = missingChecklist.length > 0 ? 'PROVISIONAL' : 'CONFIRMED';

  const pCostJpy = rec.purchaseCostJpy || 0;
  const dShipJpy = rec.domesticShippingCostJpy || 0;
  const packJpy = rec.packagingCostJpy || 0;
  const totalCostJpy = pCostJpy + dShipJpy + packJpy;
  const totalCostUsd = totalCostJpy / rate;

  const grossRevenueUsd = rec.finalSalePriceUsd + rec.buyerPaidShippingUsd + rec.sellerCompensationUsd;
  const deductionsUsd =
    totalCostUsd +
    rec.ebaySellingFeesUsd +
    rec.promotedListingFeesUsd +
    (rec.actualIntlShippingUsd || 0) +
    (rec.customsDutyZonosCostUsd || 0) +
    rec.refundAmountUsd +
    rec.otherCostsUsd;

  const netProfitUsd = grossRevenueUsd - deductionsUsd;
  const netProfitJpy = netProfitUsd * rate;
  const salesMarginPct = grossRevenueUsd > 0 ? (netProfitUsd / grossRevenueUsd) * 100 : 0;
  const roiPct = totalCostUsd > 0 ? (netProfitUsd / totalCostUsd) * 100 : 0;

  // Days calculations
  let daysToSellAcq: number | undefined = undefined;
  if (rec.acquisitionDate && rec.orderDate) {
    const acqMs = new Date(rec.acquisitionDate).getTime();
    const ordMs = new Date(rec.orderDate).getTime();
    if (!isNaN(acqMs) && !isNaN(ordMs)) {
      daysToSellAcq = Math.max(0, Math.floor((ordMs - acqMs) / (1000 * 60 * 60 * 24)));
    }
  }

  let daysToSellList: number | undefined = undefined;
  if (rec.firstListingDate && rec.orderDate) {
    const lstMs = new Date(rec.firstListingDate).getTime();
    const ordMs = new Date(rec.orderDate).getTime();
    if (!isNaN(lstMs) && !isNaN(ordMs)) {
      daysToSellList = Math.max(0, Math.floor((ordMs - lstMs) / (1000 * 60 * 60 * 24)));
    }
  }

  return {
    ...rec,
    calculationState: calcState,
    missingCostsChecklist: missingChecklist,
    calculatedNetProfitUsd: Math.round(netProfitUsd * 100) / 100,
    calculatedNetProfitJpy: Math.round(netProfitJpy),
    calculatedSalesMarginPct: Math.round(salesMarginPct * 10) / 10,
    calculatedRoiPct: Math.round(roiPct * 10) / 10,
    daysToSellFromAcquisition: daysToSellAcq,
    daysToSellFromFirstListing: daysToSellList
  };
}

export function loadSalesPerformanceRecords(): SalesPerformanceRecord[] {
  try {
    const raw = sessionStorage.getItem(SALES_PERFORMANCE_SESSION_KEY);
    if (!raw) return createInitialSalesPerformanceRecords().map(calculateRecordMetrics);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(calculateRecordMetrics);
    }
    return createInitialSalesPerformanceRecords().map(calculateRecordMetrics);
  } catch (e) {
    console.error('Failed to load sales performance records:', e);
    return createInitialSalesPerformanceRecords().map(calculateRecordMetrics);
  }
}

export function saveSalesPerformanceRecords(records: SalesPerformanceRecord[]): void {
  try {
    sessionStorage.setItem(SALES_PERFORMANCE_SESSION_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save sales performance records:', e);
  }
}

export function loadHistoricalChangeSnapshots(): HistoricalChangeSnapshot[] {
  try {
    const raw = sessionStorage.getItem(HISTORICAL_CHANGES_SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load historical snapshots:', e);
    return [];
  }
}

export function saveHistoricalChangeSnapshot(snapshot: HistoricalChangeSnapshot): void {
  try {
    const existing = loadHistoricalChangeSnapshots();
    sessionStorage.setItem(HISTORICAL_CHANGES_SESSION_KEY, JSON.stringify([snapshot, ...existing]));
  } catch (e) {
    console.error('Failed to save historical snapshot:', e);
  }
}

/**
 * Computes Sample-Size Confidence Band (Spec #4)
 */
export function getConfidenceBand(completedSalesCount: number): ConfidenceBand {
  if (completedSalesCount <= 0) return 'NO_DATA';
  if (completedSalesCount <= 4) return 'INSUFFICIENT_DATA';
  if (completedSalesCount <= 19) return 'EARLY_INDICATION';
  if (completedSalesCount <= 49) return 'MODERATE_CONFIDENCE';
  return 'HIGHER_CONFIDENCE';
}

/**
 * Computes Store Learning Summaries grouped by Brand, Category, etc. (Spec #5)
 */
export function generateStoreLearningSummaries(records: SalesPerformanceRecord[]): StoreLearningSummary[] {
  const completed = records.filter((r) => r.outcomeCategory === 'Completed sale');
  const count = completed.length;
  const confidenceBand = getConfidenceBand(count);

  if (count === 0) {
    return [
      {
        groupKey: 'Overall Store Baseline',
        groupType: 'global',
        totalCompletedSales: 0,
        confidenceBand: 'NO_DATA',
        avgNetProfitUsd: 0,
        avgNetProfitJpy: 0,
        avgSalesMarginPct: 0,
        avgRoiPct: 0,
        medianDaysToSell: 0,
        quantityReturnRatePct: 0,
        orderReturnRatePct: 0,
        monetaryReturnRatePct: 0,
        refundIncidenceRatePct: 0,
        sellerCancellationRatePct: 0,
        damageLossRatePct: 0,
        recommendationMessage: '店舗販売実績データがありません。',
        missingDataNotes: ['販売完了データが蓄積されると自動学習が行われます。']
      }
    ];
  }

  // Calculate Global Store Averages
  const totalNetProfitJpy = completed.reduce((sum, r) => sum + (r.calculatedNetProfitJpy || 0), 0);
  const totalNetProfitUsd = completed.reduce((sum, r) => sum + (r.calculatedNetProfitUsd || 0), 0);
  const avgProfitJpy = Math.round(totalNetProfitJpy / count);
  const avgProfitUsd = Math.round((totalNetProfitUsd / count) * 100) / 100;
  const avgMargin = Math.round((completed.reduce((sum, r) => sum + (r.calculatedSalesMarginPct || 0), 0) / count) * 10) / 10;
  const avgRoi = Math.round((completed.reduce((sum, r) => sum + (r.calculatedRoiPct || 0), 0) / count) * 10) / 10;
  const avgDays = Math.round(completed.reduce((sum, r) => sum + (r.daysToSellFromAcquisition || 30), 0) / count);

  const globalSummary: StoreLearningSummary = {
    groupKey: '全体店舗ベースライン (Global Store Baseline)',
    groupType: 'global',
    totalCompletedSales: count,
    confidenceBand,
    avgNetProfitUsd: avgProfitUsd,
    avgNetProfitJpy: avgProfitJpy,
    avgSalesMarginPct: avgMargin,
    avgRoiPct: avgRoi,
    medianDaysToSell: avgDays,
    quantityReturnRatePct: 0,
    orderReturnRatePct: 0,
    monetaryReturnRatePct: 0,
    refundIncidenceRatePct: 0,
    sellerCancellationRatePct: 0,
    damageLossRatePct: 0,
    recommendationMessage: `貴社店舗の実績では、平均利益率 ${avgMargin}% (平均利益: ¥${avgProfitJpy.toLocaleString()}) で推移しています。`,
    missingDataNotes: []
  };

  // Group by Brand
  const brandGroups: Record<string, SalesPerformanceRecord[]> = {};
  completed.forEach((r) => {
    const b = r.brand || 'Other';
    if (!brandGroups[b]) brandGroups[b] = [];
    brandGroups[b].push(r);
  });

  const brandSummaries: StoreLearningSummary[] = Object.entries(brandGroups).map(([brandName, bRecords]) => {
    const bCount = bRecords.length;
    const bProfJpy = Math.round(bRecords.reduce((sum, r) => sum + (r.calculatedNetProfitJpy || 0), 0) / bCount);
    const bProfUsd = Math.round((bRecords.reduce((sum, r) => sum + (r.calculatedNetProfitUsd || 0), 0) / bCount) * 100) / 100;
    const bMargin = Math.round((bRecords.reduce((sum, r) => sum + (r.calculatedSalesMarginPct || 0), 0) / bCount) * 10) / 10;
    const bRoi = Math.round((bRecords.reduce((sum, r) => sum + (r.calculatedRoiPct || 0), 0) / bCount) * 10) / 10;
    const bDays = Math.round(bRecords.reduce((sum, r) => sum + (r.daysToSellFromAcquisition || 30), 0) / bCount);

    return {
      groupKey: `ブランド: ${brandName}`,
      groupType: 'brand',
      totalCompletedSales: bCount,
      confidenceBand: getConfidenceBand(bCount),
      avgNetProfitUsd: bProfUsd,
      avgNetProfitJpy: bProfJpy,
      avgSalesMarginPct: bMargin,
      avgRoiPct: bRoi,
      medianDaysToSell: bDays,
      quantityReturnRatePct: 0,
      orderReturnRatePct: 0,
      monetaryReturnRatePct: 0,
      refundIncidenceRatePct: 0,
      sellerCancellationRatePct: 0,
      damageLossRatePct: 0,
      recommendationMessage: `ブランド [${brandName}] の貴社実績: 平均回転 ${bDays}日 / 利益率 ${bMargin}%。高パフォーマンスグループです。`,
      missingDataNotes: []
    };
  });

  return [globalSummary, ...brandSummaries];
}
