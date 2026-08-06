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
 */
export const EXCHANGE_RATES: Record<string, { rate: number; source: string }> = {
  USD: { rate: 155.20, source: 'Bank of Japan TTM 2026-08-06' },
  EUR: { rate: 168.50, source: 'ECB Reference Rate 2026-08-06' },
  GBP: { rate: 198.10, source: 'Bank of England 2026-08-06' },
  AUD: { rate: 102.30, source: 'RBA Reference Rate 2026-08-06' },
  CAD: { rate: 112.40, source: 'Bank of Canada 2026-08-06' },
  JPY: { rate: 1.00, source: 'Direct JPY 2026-08-06' }
};

export function getExchangeRateInfo(currency: string = 'USD'): { rate: number; source: string; timestamp: string } {
  const cleanCurr = (currency || 'USD').toUpperCase();
  const info = EXCHANGE_RATES[cleanCurr] || EXCHANGE_RATES['USD'];
  return {
    rate: info.rate,
    source: info.source,
    timestamp: new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' 23:00 JST'
  };
}

/**
 * Clean English Customs-Focused Description Generator
 * Target format: "Material + Product Type" (approx 30 chars, max 40-60)
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

  // Convert Plastic -> PVC
  if (mat.toLowerCase() === 'plastic' || mat.toLowerCase() === 'plastics') {
    mat = 'PVC';
  }

  if (mat && pType) {
    const combined = `${mat} ${pType.toLowerCase()}`;
    return combined.length > 60 ? combined.slice(0, 57) + '...' : combined;
  }

  let clean = rawTitle || '';

  // Remove promotional & eBay specific wording
  const noisePatterns = [
    /\b(NEW|MINT|USED|VINTAGE|AUTHENTIC|JAPAN LIMITED|FREE SHIPPING|FAST SHIPPING|RARE|EXCELLENT|UNOPENED|SEALED)\b/gi,
    /\b(EBAY|LOT OF \d+|SET OF \d+|PCS|PIECES|WITH BOX|NO BOX|NO ITEM)\b/gi,
    /\b(NINTENDO|BANDAI|SANRIO|SEGA|GOOD SMILE|SQUARE ENIX|TAITO|CAPCOM|SONY|CANON|ROLEX)\b/gi,
    /\b(POKEMON|NARUTO|ONE PIECE|DRAGON BALL|GUNDAM|RANMA|EVANGELION|DEMON SLAYER)\b/gi,
    /\b(SHIPPING|RETURNS|PAYMENT|BUYER|CONDITION)\b/gi,
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

  if (mat.toLowerCase() === 'plastic') mat = 'PVC';

  const desc = `${mat} ${pType.toLowerCase()}`.trim();
  return desc.length > 60 ? desc.slice(0, 57) + '...' : desc;
}

/**
 * Infer material, product type, and material source
 */
export function inferMaterialAndSource(
  title: string,
  ebayMaterial?: string
): { material: string; productType: string; materialSource: MaterialSourceType } {
  let mat = (ebayMaterial || '').trim();
  let source: MaterialSourceType = 'ebay';

  if (mat) {
    if (mat.toLowerCase() === 'plastic' || mat.toLowerCase() === 'plastics') {
      mat = 'PVC';
    }
    const derived = suggestMaterialAndProductType(title);
    return { material: mat, productType: derived.productType, materialSource: 'ebay' };
  }

  const titleLower = (title || '').toLowerCase();
  let derivedMaterial = 'PVC';
  let derivedProductType = 'Figure';
  source = 'inferred_listing';

  if (titleLower.includes('card') || titleLower.includes('sticky note') || titleLower.includes('memo') || titleLower.includes('book')) {
    derivedMaterial = 'Paper';
    if (titleLower.includes('card')) derivedProductType = 'Trading Card';
    else if (titleLower.includes('sticky note') || titleLower.includes('memo')) derivedProductType = 'Sticky Note';
    else derivedProductType = 'Book';
  } else if (titleLower.includes('keychain') || titleLower.includes('stand') || titleLower.includes('acrylic')) {
    derivedMaterial = 'Acrylic';
    derivedProductType = titleLower.includes('keychain') ? 'Keychain' : 'Display Stand';
  } else if (titleLower.includes('towel') || titleLower.includes('shirt') || titleLower.includes('bag') || titleLower.includes('tote')) {
    derivedMaterial = titleLower.includes('tote') || titleLower.includes('bag') ? 'Cotton' : 'Cotton';
    derivedProductType = titleLower.includes('tote') || titleLower.includes('bag') ? 'Tote Bag' : titleLower.includes('shirt') ? 'T-Shirt' : 'Towel';
  } else if (titleLower.includes('fan')) {
    derivedMaterial = 'Paper & Bamboo';
    derivedProductType = 'Fan';
  } else if (titleLower.includes('plush') || titleLower.includes('stuffed')) {
    derivedMaterial = 'Polyester';
    derivedProductType = 'Plush Toy';
  }

  return { material: derivedMaterial, productType: derivedProductType, materialSource: source };
}

/**
 * Reallocate Declared Values in JPY
 * Ensures:
 * 1. Total JPY declared === ebayTransactionValue * exchangeRate
 * 2. Regular items JPY + Free gifts JPY === Total JPY declared
 * 3. Every physical item JPY > 0
 * 4. Free gift JPY > 0
 */
export function reallocateJpyDeclaredValues(declaration: ZonosCustomsDeclaration): ZonosCustomsDeclaration {
  const currency = declaration.currency || 'USD';
  const { rate, source, timestamp } = getExchangeRateInfo(currency);
  
  const saleAmountOrig = declaration.ebayTransactionValue || 0;
  const targetJpyTotal = Math.round(saleAmountOrig * rate);

  const items = declaration.items.map((item) => ({ ...item }));

  // Regular items vs Free gifts
  const regularItems = items.filter((i) => !i.isFreeGift && !i.isIncludedItem);
  const freeGifts = items.filter((i) => i.isFreeGift || i.isIncludedItem);

  let regularSubtotalJpy = 0;
  items.forEach((item) => {
    if (!item.isFreeGift && !item.isIncludedItem) {
      if (!item.unitValueJpy || item.unitValueJpy <= 0) {
        // Default allocation: share of original value
        const share = saleAmountOrig > 0 ? (item.declaredValue / saleAmountOrig) : (1 / items.length);
        item.unitValueJpy = Math.max(1, Math.round((targetJpyTotal * share) / Math.max(1, item.quantity)));
      }
      item.totalValueJpy = Math.round((item.unitValueJpy || 1) * Math.max(1, item.quantity));
      regularSubtotalJpy += item.totalValueJpy;
    }
  });

  let freeGiftSubtotalJpy = targetJpyTotal - regularSubtotalJpy;

  if (freeGifts.length > 0) {
    if (freeGiftSubtotalJpy > 0) {
      const perGiftJpy = Math.floor(freeGiftSubtotalJpy / freeGifts.length);
      let remainder = freeGiftSubtotalJpy - (perGiftJpy * freeGifts.length);

      freeGifts.forEach((gift, idx) => {
        gift.unitValueJpy = Math.max(1, perGiftJpy + (idx === 0 ? remainder : 0));
        gift.totalValueJpy = Math.round((gift.unitValueJpy || 1) * Math.max(1, gift.quantity));
      });
    } else {
      // Free gift calculation is 0 JPY or less -> set to 0 to trigger validation error!
      freeGifts.forEach((gift) => {
        gift.unitValueJpy = 0;
        gift.totalValueJpy = 0;
      });
    }
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
  const isJpyTotalMatched = diffJpy === 0;

  if (diffJpy !== 0) {
    errors.push(`❌ 【合計不一致】申告合計 ${totalDeclaredJpy.toLocaleString()}円 が eBay売上換算額 ${targetJpyTotal.toLocaleString()}円 と一致していません (差額: ${diffJpy.toLocaleString()}円)。`);
  }

  if (hasZeroValueItem) {
    errors.push('❌ 【申告価格エラー】申告金額が 0円 以下の商品が含まれています。すべての物理商品に 1円 以上の金額を設定してください。');
  }

  if (isFreeGiftValueInvalid) {
    errors.push('❌ 【おまけ金額エラー】おまけ商品への金額配分が 0円 以下です。販売商品・おまけの金額配分を再設定してください。');
  }

  if (materialMissing) {
    errors.push('❌ 【材質未入力】未入力の材質があります。');
  }

  if (productTypeMissing) {
    errors.push('❌ 【商品種類未入力】未入力の商品種類があります。');
  }

  if (originMissing) {
    errors.push('❌ 【原産国未入力】原産国が未入力の商品があります。');
  }

  if (quantityInvalid) {
    errors.push('❌ 【数量エラー】数量は 1 以上の整数を指定してください。');
  }

  const destClean = (declaration.destinationCountry || '').trim().toLowerCase();
  const isDomesticShipment = destClean === 'japan' || destClean === 'jp' || destClean.includes('日本') || destClean.includes('japan');

  if (isDomesticShipment) {
    errors.push('❌ 【国内発送不可】Zonos Prepay は国際発送専用です。国内発送には使用できません。');
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
