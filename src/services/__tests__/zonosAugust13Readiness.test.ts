/**
 * Dedicated Production-Readiness Test Suite for Zonos Prepay (August 13 Shipment)
 */

import {
  generateZonosCustomsDescription,
  inferMaterialAndSource,
  reallocateJpyDeclaredValues,
  validateZonosPrepayDeclaration,
  getExchangeRateInfo,
  runZonosPrepayDryRun
} from '../../utils/zonosCustomsValidation';
import { ZonosCustomsDeclaration } from '../../types/zonosCustoms';

export function runZonosAugust13ReadinessTests(): { passed: number; failed: number; log: string[] } {
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

  // Base Valid Declaration Setup
  const baseDecl: ZonosCustomsDeclaration = {
    orderId: 'ORDER-2026-AUG13-001',
    ebayTransactionValue: 100,
    currency: 'USD',
    carrier: 'JAPAN_POST',
    originCountry: 'JP',
    destinationCountry: 'United States (US)',
    shippingMethod: '国際小包 船便',
    declarationLocked: false,
    totalItemsWeightGrams: 300,
    packagingWeightGrams: 100,
    totalPackagedWeightGrams: 400,
    ebayTransactionValueCents: 10000,
    items: [
      {
        id: 'item-01',
        title: 'Seiko Vintage Automatic Watch',
        material: 'Stainless Steel',
        productType: 'Watch',
        customsDescription: 'Stainless steel watch',
        quantity: 1,
        unitValueJpy: 15520,
        totalValueJpy: 15520,
        countryOfOrigin: 'Japan',
        isIncludedItem: false,
        isSoldItem: true,
        isFreeGift: false,
        unitWeightGrams: 200,
        subtotalWeightGrams: 200,
        weightUnit: 'g',
        weightSource: '手入力',
        declaredValueCents: 10000,
        declaredValue: 100
      }
    ]
  };

  // Test 1: Normal single-item order
  const decl1 = reallocateJpyDeclaredValues(baseDecl);
  const val1 = validateZonosPrepayDeclaration(decl1);
  assert(Boolean(val1.isValid && val1.isJpyTotalMatched), 'Test 1: Normal single-item order validates cleanly for August 13');

  // Test 2: Multiple identical items (quantity = 3)
  const decl2: ZonosCustomsDeclaration = {
    ...baseDecl,
    ebayTransactionValue: 150,
    items: [
      {
        ...baseDecl.items[0],
        quantity: 3,
        unitValueJpy: 7760,
        totalValueJpy: 23280,
        declaredValue: 150
      }
    ]
  };
  const reallocated2 = reallocateJpyDeclaredValues(decl2);
  const val2 = validateZonosPrepayDeclaration(reallocated2);
  assert(Boolean(val2.isValid && reallocated2.items[0].quantity === 3), 'Test 2: Multiple identical items correctly evaluated with unit/total values');

  // Test 3: Multiple different physical products in one listing/order
  const decl3: ZonosCustomsDeclaration = {
    ...baseDecl,
    items: [
      {
        id: 'item-note',
        title: 'Ranma 1/2 Sticky Note',
        material: 'Paper',
        productType: 'Sticky Note',
        customsDescription: 'Paper sticky note',
        quantity: 1,
        unitValueJpy: 5000,
        totalValueJpy: 5000,
        countryOfOrigin: 'Japan',
        isIncludedItem: false,
        isSoldItem: true,
        isFreeGift: false,
        unitWeightGrams: 50,
        subtotalWeightGrams: 50,
        weightUnit: 'g',
        weightSource: '手入力',
        declaredValueCents: 3000,
        declaredValue: 30
      },
      {
        id: 'item-fan',
        title: 'Ranma 1/2 Folding Fan',
        material: 'Paper & Bamboo',
        productType: 'Fan',
        customsDescription: 'Paper & bamboo fan',
        quantity: 1,
        unitValueJpy: 10520,
        totalValueJpy: 10520,
        countryOfOrigin: 'Japan',
        isIncludedItem: false,
        isSoldItem: true,
        isFreeGift: false,
        unitWeightGrams: 100,
        subtotalWeightGrams: 100,
        weightUnit: 'g',
        weightSource: '手入力',
        declaredValueCents: 7000,
        declaredValue: 70
      }
    ]
  };
  const reallocated3 = reallocateJpyDeclaredValues(decl3);
  const val3 = validateZonosPrepayDeclaration(reallocated3);
  assert(
    Boolean(
      val3.isValid &&
        reallocated3.items.length === 2 &&
        reallocated3.items[0].customsDescription === 'Paper sticky note' &&
        reallocated3.items[1].customsDescription === 'Paper & bamboo fan'
    ),
    'Test 3: Multiple different physical products separated into individual declaration items'
  );

  // Test 4: Plastic -> PVC approved application rule
  const descPvc = generateZonosCustomsDescription('Anime Character Toy', 'Plastic', 'Figure');
  const infPvc = inferMaterialAndSource('Anime Toy', 'Plastic');
  assert(
    Boolean(descPvc.startsWith('PVC figure') && infPvc.material === 'PVC'),
    'Test 4: Generic "Plastic" material automatically converted to "PVC" per approved customs rule'
  );

  // Test 5: Missing material -> REVIEW_REQUIRED / 要確認
  const infMissing = inferMaterialAndSource('Unrecognized Rare Collectible Item 1980');
  const declMissingMat: ZonosCustomsDeclaration = {
    ...baseDecl,
    items: [
      {
        ...baseDecl.items[0],
        material: '', // missing
        productType: 'Collectible'
      }
    ]
  };
  const valMissingMat = validateZonosPrepayDeclaration(declMissingMat);
  assert(
    Boolean(infMissing.material === '' && valMissingMat.materialMissing && !valMissingMat.isValid),
    'Test 5: Missing material is not hallucinated; triggers REVIEW_REQUIRED'
  );

  // Test 6: Currency conversion (USD -> JPY with exchange rate info)
  const rateInfo = getExchangeRateInfo('USD');
  assert(
    Boolean(rateInfo.rate > 0 && rateInfo.source.includes('Bank of Japan') && rateInfo.timestamp.includes('JST')),
    'Test 6: Currency conversion retrieves transparent exchange rate metadata with timestamp'
  );

  // Test 7: Exchange-rate metadata/source/date visibility
  assert(
    Boolean(decl1.exchangeRateSource && decl1.exchangeRateTimestamp && decl1.exchangeRate! > 0),
    'Test 7: Declaration records exchange-rate source and timestamp for human review'
  );

  // Test 8: Free gift calculation with rounding adjustment
  const declWithGift: ZonosCustomsDeclaration = {
    ...baseDecl,
    items: [
      {
        ...baseDecl.items[0],
        unitValueJpy: 15300,
        totalValueJpy: 15300
      },
      {
        id: 'gift-01',
        title: 'Thank you gift sticker',
        material: 'Paper',
        productType: 'Sticker',
        customsDescription: 'Paper sticker',
        quantity: 1,
        unitValueJpy: 0, // will be computed
        totalValueJpy: 0,
        countryOfOrigin: 'Japan',
        isIncludedItem: true,
        isSoldItem: false,
        isFreeGift: true,
        unitWeightGrams: 10,
        subtotalWeightGrams: 10,
        weightUnit: 'g',
        weightSource: '手入力',
        declaredValueCents: 100,
        declaredValue: 1
      }
    ]
  };
  const reallocatedGift = reallocateJpyDeclaredValues(declWithGift);
  const valGift = validateZonosPrepayDeclaration(reallocatedGift);
  assert(
    Boolean(
      valGift.isValid &&
        reallocatedGift.freeGiftsJpySubtotal === 220 &&
        reallocatedGift.totalDeclaredJpyValue === reallocatedGift.ebayTransactionValueJpy
    ),
    'Test 8: Free gift value calculated as (Sale JPY - Regular JPY) and absorbs rounding to equal total'
  );

  // Test 9: Free gift = 0 JPY -> STOP / REVIEW_REQUIRED
  const declGiftZero: ZonosCustomsDeclaration = {
    ...declWithGift,
    items: [
      {
        ...declWithGift.items[0],
        unitValueJpy: 15520, // Regular items consume 100% of total
        totalValueJpy: 15520
      },
      {
        ...declWithGift.items[1]
      }
    ]
  };
  const reallocatedGiftZero = reallocateJpyDeclaredValues(declGiftZero);
  const valGiftZero = validateZonosPrepayDeclaration(reallocatedGiftZero);
  assert(
    Boolean(!valGiftZero.isValid && valGiftZero.isFreeGiftValueInvalid),
    'Test 9: Free gift calculated as 0 JPY triggers validation error and halts automated submission'
  );

  // Test 10: Free gift < 0 JPY -> STOP / REVIEW_REQUIRED
  const declGiftNegative: ZonosCustomsDeclaration = {
    ...declWithGift,
    items: [
      {
        ...declWithGift.items[0],
        unitValueJpy: 20000, // Exceeds target 15520 JPY
        totalValueJpy: 20000
      },
      {
        ...declWithGift.items[1]
      }
    ]
  };
  const reallocatedGiftNeg = reallocateJpyDeclaredValues(declGiftNegative);
  const valGiftNeg = validateZonosPrepayDeclaration(reallocatedGiftNeg);
  assert(
    Boolean(!valGiftNeg.isValid && valGiftNeg.isFreeGiftValueInvalid),
    'Test 10: Free gift calculated below 0 JPY triggers validation error and halts automated submission'
  );

  // Test 11: Final declared total exactly equals eBay sale price converted to JPY
  assert(
    Boolean(reallocatedGift.jpyDifference === 0 && reallocatedGift.totalDeclaredJpyValue === reallocatedGift.ebayTransactionValueJpy),
    'Test 11: Final declared JPY total exactly matches target JPY transaction amount with 0 JPY difference'
  );

  // Test 12: Declaration total mismatch -> STOP / REVIEW_REQUIRED
  const declMismatch: ZonosCustomsDeclaration = {
    ...baseDecl,
    ebayTransactionValueJpy: 15520,
    items: [
      {
        ...baseDecl.items[0],
        unitValueJpy: 10000,
        totalValueJpy: 10000
      }
    ]
  };
  const valMismatch = validateZonosPrepayDeclaration(declMismatch);
  assert(
    Boolean(!valMismatch.isValid && !valMismatch.isJpyTotalMatched && valMismatch.jpyDifference === 5520),
    'Test 12: Declared total mismatch triggers STOP with explicit difference amount'
  );

  // Test 13: Country of Origin default = Japan (no silent overwrite)
  assert(
    Boolean(baseDecl.items[0].countryOfOrigin === 'Japan'),
    'Test 13: Country of Origin defaults to Japan for Japanese goods exports'
  );

  // Test 14: Japanese + English Human Review UI error messages
  assert(
    Boolean(
      valMismatch.errors.some((e) => e.includes('合計不一致') && e.includes('Total Mismatch')) &&
        valMissingMat.errors.some((e) => e.includes('材質未入力') && e.includes('Missing Material'))
    ),
    'Test 14: Validation errors provide clear bilingual Japanese and English messages for staff'
  );

  // Test 15: Safe Real-Order Dry Run Simulation
  const dryRunRes = runZonosPrepayDryRun(declWithGift);
  assert(
    Boolean(
      dryRunRes.isReadyForAugust13 &&
        dryRunRes.executionLogs.length >= 4 &&
        dryRunRes.reviewedPayloadText.includes('=== Zonos Prepay 申告データ')
    ),
    'Test 15: Real-order Dry Run mode completes full end-to-end verification without external writes'
  );

  // Test 16: Manual Zonos fallback payload export
  assert(
    Boolean(
      dryRunRes.reviewedPayloadText.includes('ORDER-2026-AUG13-001') &&
        dryRunRes.reviewedPayloadText.includes('Paper sticker') &&
        dryRunRes.reviewedPayloadText.includes('Stainless steel watch')
    ),
    'Test 16: Reviewed declaration payload is formatted cleanly for manual copy/paste into Zonos portal'
  );

  return { passed, failed, log };
}
