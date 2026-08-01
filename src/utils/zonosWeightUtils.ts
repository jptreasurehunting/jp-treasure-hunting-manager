/**
 * Zonos Customs Weight Normalization & Conversion Utility (Spec #2 & #3)
 * Normalizes all weights to grams (g) internally for consistent arithmetic.
 */

export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';
export type WeightSource = 'eBay API' | 'Item Specifics' | '既存商品データ' | '手入力' | '未取得' | '推定';

const GRAMS_PER_KG = 1000;
const GRAMS_PER_OZ = 28.3495;
const GRAMS_PER_LB = 453.592;

/**
 * Converts a weight value in any supported unit to integer grams.
 */
export function normalizeToGrams(val: number, unit: WeightUnit | string = 'g'): number {
  if (isNaN(val) || val <= 0) return 0;

  const unitClean = (unit || 'g').toLowerCase().trim();

  switch (unitClean) {
    case 'kg':
      return Math.round(val * GRAMS_PER_KG);
    case 'oz':
      return Math.round(val * GRAMS_PER_OZ);
    case 'lb':
    case 'lbs':
      return Math.round(val * GRAMS_PER_LB);
    case 'g':
    default:
      return Math.round(val);
  }
}

/**
 * Formats weight in grams to a clean user-friendly display string (g and kg)
 * e.g., 850 -> "850 g (0.85 kg)"
 */
export function formatWeightDisplay(grams: number): string {
  if (isNaN(grams) || grams <= 0) return '未設定 (0 g)';
  const kg = (grams / 1000).toFixed(2);
  return `${grams} g (${kg} kg)`;
}

/**
 * Converts grams to kilograms as a float with 2 decimals
 */
export function gramsToKg(grams: number): number {
  if (isNaN(grams) || grams <= 0) return 0;
  return parseFloat((grams / 1000).toFixed(3));
}

/**
 * Calculates Packaged Total Weight in grams:
 * Total Packaged Weight = Total Items Weight + Packaging Material Weight
 */
export function calculatePackagedWeight(
  totalItemsGrams: number,
  packagingMaterialGrams: number
): {
  totalItemsWeightGrams: number;
  packagingWeightGrams: number;
  totalPackagedWeightGrams: number;
} {
  const itemsG = Math.max(0, Math.round(totalItemsGrams || 0));
  const packG = Math.max(0, Math.round(packagingMaterialGrams || 0));
  const totalG = itemsG + packG;

  return {
    totalItemsWeightGrams: itemsG,
    packagingWeightGrams: packG,
    totalPackagedWeightGrams: totalG
  };
}
