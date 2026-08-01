import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  CustomsValidationStatus
} from '../types/zonosCustoms';

/**
 * Converts USD dollar amount to integer cents (e.g. 10.50 -> 1050)
 * Prevents floating-point rounding errors
 */
export function dollarsToCents(dollars: number): number {
  if (isNaN(dollars) || dollars < 0) return 0;
  return Math.round(dollars * 100);
}

/**
 * Converts integer cents to USD dollar amount (e.g. 1050 -> 10.50)
 */
export function centsToDollars(cents: number): number {
  if (isNaN(cents) || cents < 0) return 0;
  return cents / 100;
}

/**
 * Automatic Declared Value Reallocation Engine
 * Reallocates sold item declared value based on eBay Transaction Value and Included Items declared values:
 * soldItemDeclaredValue = ebayTransactionValue - sum(includedItems.declaredValue)
 */
export function reallocateDeclaredValues(declaration: ZonosCustomsDeclaration): ZonosCustomsDeclaration {
  const items = [...declaration.items];
  const ebayCents = declaration.ebayTransactionValueCents;

  const soldItemIndex = items.findIndex((i) => i.isSoldItem);
  if (soldItemIndex === -1) return declaration;

  // Calculate sum of all included items in cents
  let sumIncludedCents = 0;
  for (let i = 0; i < items.length; i++) {
    if (items[i].isIncludedItem) {
      sumIncludedCents += items[i].declaredValueCents;
    }
  }

  // Sold item receives remaining value
  const reallocatedSoldCents = ebayCents - sumIncludedCents;

  items[soldItemIndex] = {
    ...items[soldItemIndex],
    declaredValueCents: reallocatedSoldCents,
    declaredValue: centsToDollars(reallocatedSoldCents)
  };

  return {
    ...declaration,
    items
  };
}

/**
 * Validates Zonos Customs Declaration according to Ver 1.1 specifications
 */
export function validateDeclaration(declaration: ZonosCustomsDeclaration): CustomsValidationStatus {
  const errors: string[] = [];
  const warnings: string[] = [];

  const ebayCents = declaration.ebayTransactionValueCents;
  const items = declaration.items;

  let totalCents = 0;
  let materialMissing = false;
  let productTypeMissing = false;
  let quantityInvalid = false;
  let originMissing = false;
  let valueInvalid = false;
  let currencyMismatch = false;

  let sumIncludedCents = 0;
  let soldItemCents = 0;

  for (const item of items) {
    totalCents += item.declaredValueCents;

    // Check material
    if (!item.material || !item.material.trim()) {
      materialMissing = true;
    }

    // Check productType
    if (!item.productType || !item.productType.trim()) {
      productTypeMissing = true;
    }

    // Check quantity
    if (isNaN(item.quantity) || item.quantity <= 0) {
      quantityInvalid = true;
    }

    // Check countryOfOrigin
    if (!item.countryOfOrigin || !item.countryOfOrigin.trim()) {
      originMissing = true;
    }

    // Check declaredValue
    if (isNaN(item.declaredValue) || item.declaredValueCents <= 0) {
      valueInvalid = true;
    }

    if (item.isIncludedItem) {
      sumIncludedCents += item.declaredValueCents;
    }

    if (item.isSoldItem) {
      soldItemCents = item.declaredValueCents;
    }
  }

  // Ver.1.1 Shipping Conditions Checks
  const carrierInvalid = declaration.carrier !== 'JAPAN_POST';
  const originInvalid = declaration.originCountry !== 'JP';
  
  const destClean = (declaration.destinationCountry || '').trim().toLowerCase();
  const isDomesticShipment = destClean === 'japan' || destClean === 'jp' || destClean.includes('日本') || destClean.includes('japan');
  const destinationMissing = !destClean;

  const shippingMethodMissing = !declaration.shippingMethod || !declaration.shippingMethod.trim();

  // 1. Domestic shipment check (Spec #7)
  if (isDomesticShipment) {
    errors.push('国内発送にはZonos Prepayを使用できません。発送先国を確認してください。');
  }

  // 2. Carrier check (Spec #8)
  if (carrierInvalid) {
    errors.push('配送会社を日本郵便にしてください。');
  }

  // 3. Origin check
  if (originInvalid) {
    errors.push('発送元国は日本である必要があります。');
  }

  // 4. Destination missing check
  if (destinationMissing) {
    errors.push('発送先国を選択・入力してください。');
  }

  // 5. Shipping method missing check (Spec #4 & #5)
  if (shippingMethodMissing) {
    errors.push('配送方法を選択してください。');
  }

  // 6. Included item value <= 0
  for (const item of items) {
    if (item.isIncludedItem && item.declaredValueCents <= 0) {
      errors.push('同梱品の申告価格は0より大きい金額を入力してください。');
      break;
    }
  }

  // 7. Quantity <= 0
  if (quantityInvalid) {
    errors.push('数量が正しくありません。1以上の数値を入力してください。');
  }

  // 8. Sum of included items >= eBay Transaction Value
  if (sumIncludedCents >= ebayCents) {
    errors.push('同梱品の申告価格合計がeBay取引金額以上になっています。');
  }

  // 9. Reallocated sold item value <= 0
  if (soldItemCents <= 0) {
    errors.push('販売商品の申告価格を0以下にすることはできません。');
  }

  // 10. Total declared value != eBay Transaction Value
  const diffCents = ebayCents - totalCents;
  if (diffCents !== 0) {
    errors.push('申告価格合計がeBay取引金額と一致していません。');
  }

  // 11. Missing materials
  if (materialMissing) {
    errors.push('未入力の材質があります。');
  }

  // 12. Missing product types
  if (productTypeMissing) {
    errors.push('未入力の商品種類があります。');
  }

  // 13. Missing country of origin
  if (originMissing) {
    errors.push('原産国が未入力です。');
  }

  const shippingConditionsValid = !carrierInvalid && !originInvalid && !isDomesticShipment && !destinationMissing && !shippingMethodMissing;
  const isValid = errors.length === 0;
  const canLock = isValid && !declaration.declarationLocked && !isDomesticShipment;
  const canCopyZonos = declaration.declarationLocked && isValid && shippingConditionsValid;

  return {
    isValid,
    canLock,
    canCopyZonos,
    errors,
    warnings,
    totalDeclaredValueCents: totalCents,
    totalDeclaredValue: centsToDollars(totalCents),
    differenceCents: diffCents,
    difference: centsToDollars(diffCents),
    materialMissing,
    productTypeMissing,
    quantityInvalid,
    originMissing,
    valueInvalid,
    currencyMismatch,
    isDomesticShipment,
    carrierInvalid,
    originInvalid,
    destinationMissing,
    shippingMethodMissing,
    shippingConditionsValid,
    weightMissing: items.some(i => !i.unitWeightGrams || i.unitWeightGrams <= 0)
  };
}

/**
 * AI Assistance Helper ONLY for Material and Product Type (Spec #6)
 * Strictly does NOT touch or suggest prices, origins, or quantities.
 */
export function suggestMaterialAndProductType(itemTitle: string): { material: string; productType: string } {
  const titleLower = itemTitle.toLowerCase();

  let derivedMaterial = 'PVC';
  let derivedProductType = 'Figure';

  if (titleLower.includes('card') || titleLower.includes('book') || titleLower.includes('note')) {
    derivedMaterial = 'Paper';
    derivedProductType = titleLower.includes('card') ? 'Trading Card' : 'Book';
  } else if (titleLower.includes('keychain') || titleLower.includes('stand') || titleLower.includes('acrylic')) {
    derivedMaterial = 'Acrylic';
    derivedProductType = titleLower.includes('keychain') ? 'Keychain' : 'Display Stand';
  } else if (titleLower.includes('towel') || titleLower.includes('shirt') || titleLower.includes('cloth')) {
    derivedMaterial = 'Cotton';
    derivedProductType = titleLower.includes('shirt') ? 'T-Shirt' : 'Towel';
  } else if (titleLower.includes('fan')) {
    derivedMaterial = 'Paper & Bamboo';
    derivedProductType = 'Fan';
  }

  return { material: derivedMaterial, productType: derivedProductType };
}

/**
 * Format description for Zonos copy payload: "Material + Product Type"
 * Strictly avoids adding "Gift", "Free Gift", or "Present".
 */
export function formatZonosCustomsDescription(material: string, productType: string): string {
  const cleanMaterial = (material || '').trim();
  const cleanType = (productType || '').trim();
  if (!cleanMaterial && !cleanType) return 'Merchandise Item';
  if (!cleanMaterial) return cleanType;
  if (!cleanType) return cleanMaterial;
  return `${cleanMaterial} ${cleanType}`;
}
