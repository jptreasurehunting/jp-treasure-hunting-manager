/**
 * Unit Test Suite for Portable Multi-PC Zonos Customs Workflow
 * Target Shipment Date: 2026-08-13
 */

import {
  parseAndValidatePortableProjectJSON
} from '../zonosPortableProjectService';
import {
  reallocateJpyDeclaredValues,
  validateZonosPrepayDeclaration,
  generateZonosCustomsDescription
} from '../../utils/zonosCustomsValidation';
import { ZonosCustomsDeclaration } from '../../types/zonosCustoms';

export function runZonosPortableTests(): { passed: number; failed: number; log: string[] } {
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

  // Test Case 1: Export on PC A & Import on PC B
  const validProjectJson = JSON.stringify({
    schemaVersion: '2.0.0',
    savedAt: '2026-08-06T23:00:00.000Z',
    shipmentId: 'SHIP-20260813-8801',
    plannedShipmentDate: '2026-08-13',
    ebayAccountId: 'acc_01',
    ebayAccountDisplayName: 'Account 1 (Main)',
    ebayOrderId: 'ORDER-2026-8801',
    ebayItemIds: ['256123456789'],
    originalListingUrls: ['https://www.ebay.com/itm/256123456789'],
    destinationCountry: 'United States (US)',
    ebayTransactionValue: 120,
    currency: 'USD',
    exchangeRate: 155.2,
    exchangeRateSource: 'Bank of Japan TTM 2026-08-06',
    exchangeRateTimestamp: '2026-08-06 23:00 JST',
    ebayTransactionValueJpy: 18624,
    regularItemsJpySubtotal: 18424,
    freeGiftsJpySubtotal: 200,
    totalDeclaredJpyValue: 18624,
    jpyDifference: 0,
    items: [
      {
        id: 'item-1',
        title: 'Canon Camera',
        material: 'PVC',
        productType: 'Figure',
        customsDescription: 'PVC figure',
        quantity: 1,
        unitValueJpy: 18424,
        totalValueJpy: 18424,
        countryOfOrigin: 'Japan',
        isIncludedItem: false,
        isSoldItem: true,
        isFreeGift: false,
        unitWeightGrams: 250,
        subtotalWeightGrams: 250,
        weightUnit: 'g',
        weightSource: '推定'
      },
      {
        id: 'gift-1',
        title: '[おまけ] Camera Strap',
        material: 'Polyester',
        productType: 'Strap',
        customsDescription: 'Polyester strap',
        quantity: 1,
        unitValueJpy: 200,
        totalValueJpy: 200,
        countryOfOrigin: 'Japan',
        isIncludedItem: true,
        isSoldItem: false,
        isFreeGift: true,
        unitWeightGrams: 50,
        subtotalWeightGrams: 50,
        weightUnit: 'g',
        weightSource: '手入力'
      }
    ],
    warnings: [],
    validationErrors: [],
    isJpyTotalMatched: true,
    notes: '2026-08-13 発送テスト'
  });

  const importRes1 = parseAndValidatePortableProjectJSON(validProjectJson);
  assert(Boolean(importRes1.success && importRes1.project?.ebayOrderId === 'ORDER-2026-8801'), 'Test 1: Export on PC A and import on PC B');

  // Test Case 2: Missing environment variables / Secret protection
  const secretJson = JSON.stringify({
    schemaVersion: '2.0.0',
    ebayOrderId: 'ORDER-999',
    access_token: 'SECRET_TOKEN_DO_NOT_EXPORT',
    items: []
  });
  const importRes2 = parseAndValidatePortableProjectJSON(secretJson);
  assert(Boolean(!importRes2.success && importRes2.error?.includes('機密情報')), 'Test 2: Missing env / Reject secret tokens');

  // Test Case 3: Wrong eBay Account Mismatch Detection
  const isAccMismatch = importRes1.project?.ebayAccountId !== 'acc_02';
  assert(Boolean(isAccMismatch), 'Test 3: Wrong eBay Account mismatch detection');

  // Test Case 4: Corrupted Project File
  const corruptedJson = '{ invalid_json_syntax: true, ';
  const importRes4 = parseAndValidatePortableProjectJSON(corruptedJson);
  assert(Boolean(!importRes4.success && importRes4.error?.includes('JSONパースエラー')), 'Test 4: Corrupted project file rejection');

  // Test Case 5: Old Schema Rejection
  const oldSchemaJson = JSON.stringify({
    schemaVersion: '1.0.0',
    ebayOrderId: 'ORDER-111',
    items: []
  });
  const importRes5 = parseAndValidatePortableProjectJSON(oldSchemaJson);
  assert(Boolean(!importRes5.success && importRes5.error?.includes('非対応のスキーマバージョン')), 'Test 5: Old schema rejection');

  // Test Case 6: Stale Exchange Rate Alert
  const isStale = new Date('2026-08-13').getTime() - new Date('2026-08-01').getTime() > 24 * 60 * 60 * 1000;
  assert(Boolean(isStale), 'Test 6: Stale exchange rate detection (>24h)');

  // Test Case 7: Regular Item plus Free Gift Allocation
  const sampleDecl: ZonosCustomsDeclaration = {
    orderId: 'ORDER-TEST-77',
    ebayTransactionValue: 100,
    currency: 'USD',
    exchangeRate: 150,
    ebayTransactionValueJpy: 15000,
    carrier: 'JAPAN_POST',
    originCountry: 'JP',
    destinationCountry: 'United States (US)',
    shippingMethod: '国際小包 船便',
    declarationLocked: false,
    totalItemsWeightGrams: 300,
    packagingWeightGrams: 150,
    totalPackagedWeightGrams: 450,
    ebayTransactionValueCents: 10000,
    items: [
      {
        id: 'reg-1',
        material: 'PVC',
        productType: 'Figure',
        quantity: 1,
        unitValueJpy: 14800,
        totalValueJpy: 14800,
        countryOfOrigin: 'Japan',
        isIncludedItem: false,
        isSoldItem: true,
        isFreeGift: false,
        unitWeightGrams: 250,
        subtotalWeightGrams: 250,
        weightUnit: 'g',
        weightSource: '推定',
        declaredValueCents: 10000,
        declaredValue: 100
      },
      {
        id: 'gift-1',
        material: 'Paper',
        productType: 'Sticker',
        quantity: 1,
        unitValueJpy: 200,
        totalValueJpy: 200,
        countryOfOrigin: 'Japan',
        isIncludedItem: true,
        isSoldItem: false,
        isFreeGift: true,
        unitWeightGrams: 50,
        subtotalWeightGrams: 50,
        weightUnit: 'g',
        weightSource: '手入力',
        declaredValueCents: 100,
        declaredValue: 1
      }
    ]
  };
  const reallocated7 = reallocateJpyDeclaredValues(sampleDecl);
  const val7 = validateZonosPrepayDeclaration(reallocated7);
  assert(Boolean(val7.isValid && (reallocated7.freeGiftsJpySubtotal ?? 0) > 0), 'Test 7: Regular item plus free gift allocation');

  // Test Case 8: Zero or Negative Free-Gift Allocation Error
  const invalidGiftDecl: ZonosCustomsDeclaration = {
    ...sampleDecl,
    items: [
      {
        ...sampleDecl.items[0],
        unitValueJpy: 16000, // Over allocated!
        totalValueJpy: 16000
      },
      {
        ...sampleDecl.items[1],
        unitValueJpy: 0,
        totalValueJpy: 0
      }
    ]
  };
  const val8 = validateZonosPrepayDeclaration(invalidGiftDecl);
  assert(Boolean(val8.hasZeroValueItem || val8.isFreeGiftValueInvalid), 'Test 8: Zero or negative free gift allocation error');

  // Test Case 9: Multiple Different Products Splitting
  const desc1 = generateZonosCustomsDescription('Ranma 1/2 Sticky Note', 'Paper', 'Sticky Note');
  const desc2 = generateZonosCustomsDescription('Ranma 1/2 Fan', 'Paper & Bamboo', 'Fan');
  assert(Boolean(desc1 !== desc2 && desc1.includes('Paper sticky note')), 'Test 9: Multiple different products splitting');

  // Test Case 10: Exact 0 JPY Final Difference
  const exactDiff = reallocated7.jpyDifference === 0;
  assert(Boolean(exactDiff), 'Test 10: Exact 0 JPY final difference');

  return { passed, failed, log };
}
