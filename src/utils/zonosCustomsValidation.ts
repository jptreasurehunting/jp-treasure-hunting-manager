import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  CustomsValidationStatus,
  MaterialSourceType
} from '../types/zonosCustoms';

export function dollarsToCents(dollars: number): number {
  if (isNaN(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  if (isNaN(cents) || cents < 0) return 0;
  return cents / 100;
}

/**
 * Exchange Rate Provider (Bank of Japan / Refinitiv Reference Rates)
 * Note: Zonos official real-time exchange-rate sync requirement is UNKNOWN / REQUIRES VERIFICATION.
 * Current implementation provides BOJ TTM reference table with transparent source and operator manual override.
 */
export const EXCHANGE_RATES: Record<string, { rate: number; source: string; isVerified: boolean }> = {
  USD: { rate: 155.20, source: 'Bank of Japan TTM Reference (2026-08-06)', isVerified: false },
  EUR: { rate: 168.50, source: 'ECB Reference Rate (2026-08-06)', isVerified: false },
  GBP: { rate: 198.10, source: 'Bank of England Reference (2026-08-06)', isVerified: false },
  AUD: { rate: 102.30, source: 'RBA Reference Rate (2026-08-06)', isVerified: false },
  CAD: { rate: 112.40, source: 'Bank of Canada Reference (2026-08-06)', isVerified: false },
  SGD: { rate: 115.80, source: 'MAS Reference Rate (2026-08-06)', isVerified: false },
  JPY: { rate: 1.00, source: 'Direct JPY (1:1 Base)', isVerified: true }
};

export function getExchangeRateInfo(currency: string = 'USD'): { rate: number; source: string; timestamp: string; isVerified: boolean } {
  const cleanCurr = (currency || 'USD').toUpperCase();
  const info = EXCHANGE_RATES[cleanCurr] || EXCHANGE_RATES['USD'];
  return {
    rate: info.rate,
    source: info.source,
    timestamp: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' 23:00 JST',
    isVerified: info.isVerified
  };
}

/**
 * Clean English Customs-Focused Description Generator
 * Target format: "Material + product type" (approx 30 chars, max 40-60 chars)
 * Strips brand names, character names, promotional text, condition, shipping, return, payment info.
 * Converts "Plastic" -> "PVC".
 */
export function generateZonosCustomsDescription(
  rawTitle: string,
  rawMaterial: string,
  rawProductType: string
): string {
  let mat = (rawMaterial || '').trim();
  let pType = (rawProductType || '').trim();

  // Convert generic Plastic -> PVC
  if (mat.toLowerCase() === 'plastic' || mat.toLowerCase() === 'plastics') {
    mat = 'PVC';
  }

  if (mat && pType) {
    const combined = `${mat} ${pType.toLowerCase()}`;
    return combined.length > 60 ? combined.slice(0, 57) + '...' : combined;
  }

  let clean = rawTitle || '';

  // Remove promotional & marketplace noise patterns
  const noisePatterns = [
    /\b(NEW|MINT|USED|VINTAGE|AUTHENTIC|JAPAN LIMITED|FREE SHIPPING|FAST SHIPPING|RARE|EXCELLENT|UNOPENED|SEALED)\b/gi,
    /\b(EBAY|LOT OF \d+|SET OF \d+|PCS|PIECES|WITH BOX|NO BOX|NO ITEM)\b/gi,
    /\b(NINTENDO|BANDAI|SANRIO|SEGA|GOOD SMILE|SQUARE ENIX|TAITO|CAPCOM|SONY|CANON|ROLEX|CASIO|SEIKO|NIKON)\b/gi,
    /\b(POKEMON|NARUTO|ONE PIECE|DRAGON BALL|GUNDAM|RANMA|EVANGELION|DEMON SLAYER|JUJUTSU KAISEN|BLEACH)\b/gi,
    /\b(SHIPPING|RETURNS|PAYMENT|BUYER|CONDITION|EXPEDITED|ECONOMY|STANDARD)\b/gi,
    /[【】\[\]\(\)★☆◆◇!！?？]/g
  ];

  for (const pattern of noisePatterns) {
    clean = clean.replace(pattern, ' ');
  }

  clean = clean.replace(/\s+/g, ' ').trim();

  // Infer material & type if missing
  if (!mat || !pType) {
    const inferred = suggestMaterialAndProductType(clean || rawTitle);
    mat = mat || inferred.material;
    pType = pType || inferred.productType;
  }

  if (mat.toLowerCase() === 'plastic' || mat.toLowerCase() === 'plastics') mat = 'PVC';

  if (!mat || !pType) {
    return (clean.slice(0, 45) || 'Customs item').trim();
  }

  const desc = `${mat} ${pType.toLowerCase()}`.trim();
  return desc.length > 60 ? desc.slice(0, 57) + '...' : desc;
}

/**
 * Infer material, product type, and material source without hallucinating missing data
 */
export function inferMaterialAndSource(
  title: string,
  ebayMaterial?: string
): { material: string; productType: string; materialSource: MaterialSourceType } {
  let mat = (ebayMaterial || '').trim();

  if (mat) {
    if (mat.toLowerCase() === 'plastic' || mat.toLowerCase() === 'plastics') {
      mat = 'PVC';
    }
    const derived = suggestMaterialAndProductType(title);
    return { material: mat, productType: derived.productType || 'Goods', materialSource: 'ebay' };
  }

  const titleLower = (title || '').toLowerCase();
  let derivedMaterial = '';
  let derivedProductType = '';
  let source: MaterialSourceType = 'inferred_listing';

  if (titleLower.includes('figure') || titleLower.includes('statue') || titleLower.includes('model figure') || titleLower.includes('nendoroid')) {
    derivedMaterial = 'PVC';
    derivedProductType = 'Figure';
  } else if (titleLower.includes('card') || titleLower.includes('sticky note') || titleLower.includes('memo') || titleLower.includes('book') || titleLower.includes('notebook')) {
    derivedMaterial = 'Paper';
    if (titleLower.includes('card')) derivedProductType = 'Trading Card';
    else if (titleLower.includes('sticky note') || titleLower.includes('memo')) derivedProductType = 'Sticky Note';
    else derivedProductType = 'Book';
  } else if (titleLower.includes('keychain') || titleLower.includes('stand') || titleLower.includes('acrylic')) {
    derivedMaterial = 'Acrylic';
    derivedProductType = titleLower.includes('keychain') ? 'Keychain' : 'Display Stand';
  } else if (titleLower.includes('towel') || titleLower.includes('shirt') || titleLower.includes('bag') || titleLower.includes('tote')) {
    derivedMaterial = titleLower.includes('shirt') || titleLower.includes('towel') ? 'Cotton' : 'Polyester';
    derivedProductType = titleLower.includes('tote') || titleLower.includes('bag') ? 'Tote Bag' : titleLower.includes('shirt') ? 'T-Shirt' : 'Towel';
  } else if (titleLower.includes('fan')) {
    derivedMaterial = 'Paper & Bamboo';
    derivedProductType = 'Fan';
  } else if (titleLower.includes('plush') || titleLower.includes('stuffed')) {
    derivedMaterial = 'Polyester';
    derivedProductType = 'Plush Toy';
  } else if (titleLower.includes('watch strap') || titleLower.includes('leather belt') || titleLower.includes('strap band')) {
    derivedMaterial = titleLower.includes('leather') ? 'Leather' : 'Stainless Steel';
    derivedProductType = 'Watch Strap';
  } else if (titleLower.includes('lens') || titleLower.includes('filter')) {
    derivedMaterial = 'Optical Glass & Metal';
    derivedProductType = 'Camera Lens';
  } else {
    // Missing material: do NOT hallucinate! Force human review.
    derivedMaterial = '';
    derivedProductType = '';
    source = 'manual';
  }

  return { material: derivedMaterial, productType: derivedProductType, materialSource: source };
}

/**
 * Reallocate Declared Values in JPY
 * Rules:
 * 1. Total JPY declared === ebayTransactionValue * exchangeRate
 * 2. Regular items JPY + Free gifts JPY === Total JPY declared
 * 3. Every physical regular item JPY > 0
 * 4. Free gift JPY > 0 (If <= 0 JPY, triggers validation STOP)
 * 5. Uses free-gift side for rounding adjustment
 */
export function reallocateJpyDeclaredValues(declaration: ZonosCustomsDeclaration): ZonosCustomsDeclaration {
  const currency = declaration.currency || 'USD';
  const { rate: defaultRate, source: defaultSource, timestamp: defaultTimestamp } = getExchangeRateInfo(currency);

  // Preserve operator-configured exchange rate if present
  const rate = declaration.exchangeRate && declaration.exchangeRate > 0 ? declaration.exchangeRate : defaultRate;
  const source = declaration.exchangeRateSource || defaultSource;
  const timestamp = declaration.exchangeRateTimestamp || defaultTimestamp;

  const saleAmountOrig = declaration.ebayTransactionValue || 0;
  const targetJpyTotal = Math.round(saleAmountOrig * rate);

  const items = declaration.items.map((item) => ({ ...item }));

  const regularItems = items.filter((i) => !i.isFreeGift && !i.isIncludedItem);
  const freeGifts = items.filter((i) => i.isFreeGift || i.isIncludedItem);

  let regularSubtotalJpy = 0;

  if (freeGifts.length > 0) {
    // If free gifts exist, regular items take their existing unitValueJpy or proportional share
    regularItems.forEach((item) => {
      if (!item.unitValueJpy || item.unitValueJpy <= 0) {
        const share = saleAmountOrig > 0 ? (item.declaredValue / saleAmountOrig) : (1 / Math.max(1, regularItems.length));
        // Allocate ~95% to regular items to leave room for free gift
        item.unitValueJpy = Math.max(1, Math.round((targetJpyTotal * 0.95 * share) / Math.max(1, item.quantity)));
      }
      item.totalValueJpy = Math.round((item.unitValueJpy || 1) * Math.max(1, item.quantity));
      regularSubtotalJpy += item.totalValueJpy;
    });

    const freeGiftSubtotalJpy = targetJpyTotal - regularSubtotalJpy;

    if (freeGiftSubtotalJpy > 0) {
      const perGiftJpy = Math.floor(freeGiftSubtotalJpy / freeGifts.length);
      const remainder = freeGiftSubtotalJpy - (perGiftJpy * freeGifts.length);

      freeGifts.forEach((gift, idx) => {
        gift.unitValueJpy = Math.max(1, perGiftJpy + (idx === 0 ? remainder : 0));
        gift.totalValueJpy = Math.round((gift.unitValueJpy || 1) * Math.max(1, gift.quantity));
      });
    } else {
      // Free gift is 0 JPY or negative -> set to 0 to strictly trigger validation STOP!
      freeGifts.forEach((gift) => {
        gift.unitValueJpy = 0;
        gift.totalValueJpy = 0;
      });
    }
  } else {
    // No free gifts: regular items absorb 100% of targetJpyTotal with end rounding
    let accumulated = 0;
    regularItems.forEach((item, idx) => {
      const isLast = idx === regularItems.length - 1;
      if (isLast) {
        item.totalValueJpy = Math.max(1, targetJpyTotal - accumulated);
        item.unitValueJpy = Math.max(1, Math.round(item.totalValueJpy / Math.max(1, item.quantity)));
      } else {
        const share = saleAmountOrig > 0 ? (item.declaredValue / saleAmountOrig) : (1 / Math.max(1, regularItems.length));
        item.unitValueJpy = Math.max(1, Math.round((targetJpyTotal * share) / Math.max(1, item.quantity)));
        item.totalValueJpy = Math.round(item.unitValueJpy * Math.max(1, item.quantity));
        accumulated += item.totalValueJpy;
      }
      regularSubtotalJpy += item.totalValueJpy;
    });
  }

  const calculatedRegularSubtotal = items
    .filter((i) => !i.isFreeGift && !i.isIncludedItem)
    .reduce((acc, i) => acc + (i.totalValueJpy || 0), 0);

  const calculatedFreeGiftSubtotal = items
    .filter((i) => i.isFreeGift || i.isIncludedItem)
    .reduce((acc, i) => acc + (i.totalValueJpy || 0), 0);

  const totalDeclaredJpy = calculatedRegularSubtotal + calculatedFreeGiftSubtotal;
  const diffJpy = targetJpyTotal - totalDeclaredJpy;

  return {
    ...declaration,
    exchangeRate: rate,
    exchangeRateSource: source,
    exchangeRateTimestamp: timestamp,
    ebayTransactionValueJpy: targetJpyTotal,
    regularItemsJpySubtotal: calculatedRegularSubtotal,
    freeGiftsJpySubtotal: calculatedFreeGiftSubtotal,
    totalDeclaredJpyValue: totalDeclaredJpy,
    jpyDifference: diffJpy,
    items
  };
}

/**
 * Validates Zonos Customs Declaration according to Ver 2.0 Zonos Prepay Specifications
 */
export function validateZonosPrepayDeclaration(declaration: ZonosCustomsDeclaration): CustomsValidationStatus {
  const errors: string[] = [];
  const warnings: string[] = [];

  const items = declaration.items || [];
  const targetJpyTotal = declaration.ebayTransactionValueJpy || Math.round((declaration.ebayTransactionValue || 0) * (declaration.exchangeRate || 155.2));

  let totalDeclaredJpy = 0;
  let materialMissing = false;
  let productTypeMissing = false;
  let quantityInvalid = false;
  let originMissing = false;
  let valueInvalid = false;
  let hasZeroValueItem = false;
  let isFreeGiftValueInvalid = false;

  for (const item of items) {
    const itemTotalJpy = item.totalValueJpy || Math.round((item.unitValueJpy || 0) * Math.max(1, item.quantity));
    totalDeclaredJpy += itemTotalJpy;

    if (!item.material || !item.material.trim()) materialMissing = true;
    if (!item.productType || !item.productType.trim()) productTypeMissing = true;
    if (isNaN(item.quantity) || item.quantity <= 0) quantityInvalid = true;
    if (!item.countryOfOrigin || !item.countryOfOrigin.trim()) originMissing = true;
    if (isNaN(itemTotalJpy) || itemTotalJpy <= 0) {
      valueInvalid = true;
      hasZeroValueItem = true;
    }

    if ((item.isFreeGift || item.isIncludedItem) && (!item.unitValueJpy || item.unitValueJpy <= 0)) {
      isFreeGiftValueInvalid = true;
    }
  }

  const diffJpy = targetJpyTotal - totalDeclaredJpy;
  const isJpyTotalMatched = diffJpy === 0 && !hasZeroValueItem && !isFreeGiftValueInvalid;

  if (diffJpy !== 0) {
    errors.push(`❌ 【合計不一致 / Total Mismatch】申告合計 ${totalDeclaredJpy.toLocaleString()}円 が eBay売上換算額 ${targetJpyTotal.toLocaleString()}円 と一致していません (差額: ${diffJpy.toLocaleString()}円)。`);
  }

  if (hasZeroValueItem) {
    errors.push('❌ 【申告価格エラー / Zero Value Item】申告金額が 0円 以下の商品が含まれています。すべての物理商品に 1円 以上の金額を設定してください。');
  }

  if (isFreeGiftValueInvalid) {
    errors.push('❌ 【おまけ金額エラー / Free Gift Error】おまけ商品への金額配分が 0円 以下です。販売商品・おまけの金額配分を再設定してください。');
  }

  if (materialMissing) {
    errors.push('❌ 【材質未入力 / Missing Material】未入力の材質があります (REVIEW_REQUIRED)。');
  }

  if (productTypeMissing) {
    errors.push('❌ 【商品種類未入力 / Missing Product Type】未入力の商品種類があります。');
  }

  if (originMissing) {
    errors.push('❌ 【原産国未入力 / Missing Country of Origin】原産国が未入力の商品があります。');
  }

  if (quantityInvalid) {
    errors.push('❌ 【数量エラー / Invalid Quantity】数量は 1 以上の整数を指定してください。');
  }

  const destClean = (declaration.destinationCountry || '').trim().toLowerCase();
  const isDomesticShipment = destClean === 'japan' || destClean === 'jp' || destClean.includes('日本') || destClean.includes('japan');

  if (isDomesticShipment) {
    errors.push('❌ 【国内発送不可 / International Only】Zonos Prepay は国際発送専用です。国内発送には使用できません。');
  }

  const isValid = errors.length === 0;
  const canLock = isValid && !declaration.declarationLocked && !isDomesticShipment;
  const canCopyZonos = isValid && !isDomesticShipment;

  return {
    isValid,
    canLock,
    canCopyZonos,
    errors,
    warnings,
    totalDeclaredValueCents: dollarsToCents(declaration.ebayTransactionValue || 0),
    totalDeclaredValue: declaration.ebayTransactionValue || 0,
    differenceCents: dollarsToCents(diffJpy / (declaration.exchangeRate || 155.2)),
    difference: diffJpy / (declaration.exchangeRate || 155.2),
    totalDeclaredJpyValue: totalDeclaredJpy,
    jpyDifference: diffJpy,
    isJpyTotalMatched,
    isFreeGiftValueInvalid,
    hasZeroValueItem,
    materialMissing,
    productTypeMissing,
    quantityInvalid,
    originMissing,
    valueInvalid,
    currencyMismatch: false,
    isDomesticShipment,
    carrierInvalid: false,
    originInvalid: false,
    destinationMissing: !destClean,
    shippingMethodMissing: !declaration.shippingMethod,
    shippingConditionsValid: !isDomesticShipment && !!destClean,
    weightMissing: items.some((i) => !i.unitWeightGrams || i.unitWeightGrams <= 0)
  };
}

export function validateDeclaration(declaration: ZonosCustomsDeclaration): CustomsValidationStatus {
  return validateZonosPrepayDeclaration(declaration);
}

export function suggestMaterialAndProductType(itemTitle: string): { material: string; productType: string } {
  return inferMaterialAndSource(itemTitle);
}

export function formatZonosCustomsDescription(material: string, productType: string): string {
  return generateZonosCustomsDescription('', material, productType);
}

export function reallocateDeclaredValues(declaration: ZonosCustomsDeclaration): ZonosCustomsDeclaration {
  return reallocateJpyDeclaredValues(declaration);
}

/**
 * Executes a Safe Real-Order Dry Run Simulation for August 13 Shipment
 * Verifies the entire pipeline without making any external API calls, payments, or state changes.
 */
export function runZonosPrepayDryRun(declaration: ZonosCustomsDeclaration): {
  isReadyForAugust13: boolean;
  validationStatus: CustomsValidationStatus;
  executionLogs: string[];
  reviewedPayloadText: string;
} {
  const executionLogs: string[] = [];
  executionLogs.push(`[DryRun] ${new Date().toISOString()} Starting August 13 Zonos Prepay Dry-Run validation`);
  executionLogs.push(`[DryRun] Order ID: ${declaration.orderId} | Items: ${declaration.items.length}`);
  executionLogs.push(`[DryRun] Sale Amount: ${declaration.ebayTransactionValue} ${declaration.currency} | Rate: ${declaration.exchangeRate} JPY/${declaration.currency}`);

  // 1. Reallocate JPY
  const reallocated = reallocateJpyDeclaredValues(declaration);
  executionLogs.push(`[DryRun] JPY Allocation: Target ${reallocated.ebayTransactionValueJpy} JPY | Regular ${reallocated.regularItemsJpySubtotal} JPY | Gift ${reallocated.freeGiftsJpySubtotal} JPY`);

  // 2. Validate
  const val = validateZonosPrepayDeclaration(reallocated);
  executionLogs.push(`[DryRun] Validation Status: ${val.isValid ? 'PASS (Ready for August 13)' : 'FAIL (Review Required)'}`);

  if (!val.isValid) {
    val.errors.forEach((err) => executionLogs.push(`[DryRun Error] ${err}`));
  }

  // 3. Format reviewed clipboard payload text for manual Zonos Prepay entry
  const reviewedPayloadText = [
    `=== Zonos Prepay 申告データ (8月13日 本番発送用 / Manual Entry Payload) ===`,
    `注文番号 (Order ID): ${reallocated.orderId}`,
    `発送先 (Destination): ${reallocated.destinationCountry}`,
    `販売金額 (Sale Amount): ${reallocated.ebayTransactionValue} ${reallocated.currency} (${reallocated.exchangeRate} JPY/${reallocated.currency}換算: ${reallocated.ebayTransactionValueJpy?.toLocaleString()} JPY)`,
    `申告総額 (Total Declared): ${reallocated.totalDeclaredJpyValue?.toLocaleString()} JPY (差額: ${reallocated.jpyDifference} JPY)`,
    `----------------------------------------------------`,
    ...reallocated.items.map((item, idx) =>
      `品目 ${idx + 1} [${item.isFreeGift ? 'おまけ / Free Gift' : '販売商品 / Sold Item'}]:\n` +
      `  - 英語税関品名 (Description): ${item.customsDescription || generateZonosCustomsDescription(item.title || '', item.material, item.productType)}\n` +
      `  - 素材 (Material): ${item.material}\n` +
      `  - 商品種類 (Product Type): ${item.productType}\n` +
      `  - 数量 (Quantity): ${item.quantity}\n` +
      `  - 原産国 (Origin): ${item.countryOfOrigin}\n` +
      `  - 申告単価 (Unit JPY): ${item.unitValueJpy?.toLocaleString()} JPY\n` +
      `  - 申告小計 (Total JPY): ${item.totalValueJpy?.toLocaleString()} JPY`
    ),
    `====================================================`
  ].join('\n');

  return {
    isReadyForAugust13: val.isValid,
    validationStatus: val,
    executionLogs,
    reviewedPayloadText
  };
}
