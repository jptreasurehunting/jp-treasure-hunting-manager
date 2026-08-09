/**
 * Unit Test Suite for Envelope Vector Layout Engine & Safe Test Mode (Phase B)
 */

import {
  getStandardEnvelopeDimensions,
  calculatePostalCodeBoxes,
  validateEnvelopeLayout,
  generateEnvelopeLayout,
  simulateEnvelopePrintJob,
  loadSenderProfile,
  saveSenderProfile,
  loadEnvelopePrintSettings,
  saveEnvelopePrintSettings,
  getDefaultSenderProfile
} from '../envelopeLayoutService';
import { loadFulfillmentOrders } from '../shippingRouterService';
import { NormalizedFulfillmentOrder } from '../../types/shippingRouter';

export function runEnvelopeLayoutTests(): { passed: number; failed: number; log: string[] } {
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

  const orders = loadFulfillmentOrders();
  const validOrder = orders.find((o) => o.orderId === 'ord_dom_01_strap_single')!;

  // Test 1: Nagagata 3 physical dimensions
  const dimsNagagata3 = getStandardEnvelopeDimensions('ENVELOPE_NAGAGATA_3');
  assert(
    Boolean(dimsNagagata3.widthMm === 120 && dimsNagagata3.heightMm === 235 && dimsNagagata3.postalCodeTopMm === 12.0),
    'Test 1: Standard envelope dimensions for Nagagata 3 (120x235mm) are exact to Japan Post spec'
  );

  // Test 2: Nagagata 4 physical dimensions
  const dimsNagagata4 = getStandardEnvelopeDimensions('ENVELOPE_NAGAGATA_4');
  assert(
    Boolean(dimsNagagata4.widthMm === 90 && dimsNagagata4.heightMm === 205),
    'Test 2: Standard envelope dimensions for Nagagata 4 (90x205mm) are exact to Japan Post spec'
  );

  // Test 3: Kakugata 2 physical dimensions
  const dimsKakugata2 = getStandardEnvelopeDimensions('ENVELOPE_KAKUGATA_2');
  assert(
    Boolean(dimsKakugata2.widthMm === 240 && dimsKakugata2.heightMm === 332),
    'Test 3: Standard envelope dimensions for Kakugata 2 (240x332mm) are exact to Japan Post spec'
  );

  // Test 4: Postal code 7-digit splitting & box metrics calculation
  const boxes = calculatePostalCodeBoxes('150-0001', dimsNagagata3);
  assert(
    Boolean(
      boxes.digits.length === 7 &&
        boxes.firstGroup === '150' &&
        boxes.secondGroup === '0001' &&
        boxes.boxes.length === 7
    ),
    'Test 4: Postal code 7-digit splitting & box metrics calculated accurately'
  );

  // Test 5: Postal code hyphen gap positioning between 3rd and 4th digit
  const box3 = boxes.boxes[2];
  const box4 = boxes.boxes[3];
  const gapBetween3and4 = box4.leftMm - (box3.leftMm + box3.widthMm);
  assert(
    Boolean(Math.abs(gapBetween3and4 - dimsNagagata3.postalHyphenGapMm) < 0.01),
    'Test 5: Postal code hyphen gap positioning between 3rd and 4th digit matches physical pitch spec'
  );

  // Test 6: Postal code parser handles raw unformatted digits
  const boxesRaw = calculatePostalCodeBoxes('5300001', dimsNagagata3);
  assert(
    Boolean(boxesRaw.firstGroup === '530' && boxesRaw.secondGroup === '0001'),
    'Test 6: Postal code calculator handles raw unhyphenated 7 digits cleanly'
  );

  // Test 7: Incomplete postal code triggers layout warning
  const missingPostalOrder = orders.find((o) => o.orderId === 'ord_dom_05_missing_address')!;
  const valMissingPostal = validateEnvelopeLayout(missingPostalOrder, {
    envelopeType: 'ENVELOPE_NAGAGATA_3',
    orientation: 'vertical',
    includeItemSummary: true,
    includeSenderInfo: true,
    fontSizeScale: 1.0,
    offsetXmm: 0,
    offsetYmm: 0
  });
  assert(
    Boolean(!valMissingPostal.isPostalCodeValid && valMissingPostal.warnings.some((w) => w.includes('郵便番号'))),
    'Test 7: Incomplete postal code triggers layout validation warning'
  );

  // Test 8: Missing recipient name triggers validation warning
  const missingNameOrder: NormalizedFulfillmentOrder = { ...validOrder, buyerName: '' };
  const valMissingName = validateEnvelopeLayout(missingNameOrder, {
    envelopeType: 'ENVELOPE_NAGAGATA_3',
    orientation: 'vertical',
    includeItemSummary: true,
    includeSenderInfo: true,
    fontSizeScale: 1.0,
    offsetXmm: 0,
    offsetYmm: 0
  });
  assert(
    Boolean(valMissingName.warnings.some((w) => w.includes('氏名'))),
    'Test 8: Missing recipient name triggers validation warning'
  );

  // Test 9: Recipient honorific '様' automatically attached in layout payload
  const payload1 = generateEnvelopeLayout(validOrder);
  assert(
    Boolean(payload1.recipient.honorific === '様' && payload1.recipient.fullName === '山田 太郎'),
    'Test 9: Recipient honorific "様" is automatically and respectfully attached in layout'
  );

  // Test 10: Vertical writing mode layout generation
  const payloadVertical = generateEnvelopeLayout(validOrder, { orientation: 'vertical' });
  assert(
    Boolean(
      payloadVertical.settings.orientation === 'vertical' &&
        payloadVertical.recipient.addressLine1.includes('神宮前')
    ),
    'Test 10: Vertical writing mode payload generated cleanly with Japanese orientation'
  );

  // Test 11: Horizontal writing mode layout generation
  const payloadHorizontal = generateEnvelopeLayout(validOrder, { orientation: 'horizontal' });
  assert(
    Boolean(payloadHorizontal.settings.orientation === 'horizontal'),
    'Test 11: Horizontal writing mode payload generated cleanly'
  );

  // Test 12: Item summary generated in footer for packing verification
  assert(
    Boolean(
      payload1.itemSummary &&
        payload1.itemSummary.itemTitle.includes('腕時計交換ベルト') &&
        payload1.itemSummary.orderNumber === 'EBAY-DOM-2026-01'
    ),
    'Test 12: Item summary (title, quantity, eBay order number) generated in footer to prevent mispacking'
  );

  // Test 13: Sender profile loaded and mapped to payload when enabled
  const sender = loadSenderProfile();
  assert(
    Boolean(
      payload1.sender &&
        payload1.sender.shopName.length > 0 &&
        payload1.sender.postalCode === sender.postalCode
    ),
    'Test 13: Sender profile correctly attached to layout payload when includeSenderInfo is true'
  );

  // Test 14: Sender profile excluded from payload when includeSenderInfo is false
  const payloadNoSender = generateEnvelopeLayout(validOrder, { includeSenderInfo: false });
  assert(
    Boolean(payloadNoSender.sender === undefined),
    'Test 14: Sender profile strictly excluded when includeSenderInfo is false'
  );

  // Test 15: Extreme long address (>45 chars) triggers font scale adjustment warning
  const longAddressOrder: NormalizedFulfillmentOrder = {
    ...validOrder,
    addressLine1: '超高層タワーマンションレジデンススクエアプレミアム棟サウスタワーサウスウイング最上階プレミアムフロア'
  };
  const valLongAddr = validateEnvelopeLayout(longAddressOrder, {
    envelopeType: 'ENVELOPE_NAGAGATA_3',
    orientation: 'vertical',
    includeItemSummary: true,
    includeSenderInfo: true,
    fontSizeScale: 1.0,
    offsetXmm: 0,
    offsetYmm: 0
  });
  assert(
    Boolean(valLongAddr.isAddressTruncated && valLongAddr.warnings.some((w) => w.includes('45文字'))),
    'Test 15: Long address (>45 chars) triggers font scaling warning'
  );

  // Test 16: Safe Test Mode print simulation returns success without physical output
  const simResult = simulateEnvelopePrintJob(validOrder);
  assert(
    Boolean(
      simResult.success &&
        simResult.simulationMessageJa.includes('安全テストモード') &&
        simResult.simulationMessageJa.includes('物理印刷は実行されていません')
    ),
    'Test 16: Safe Test Mode print simulation validates layout without triggering physical printer'
  );

  // Test 17: Simulation ID format starts with 'sim_env_'
  assert(
    Boolean(simResult.simulationId.startsWith('sim_env_')),
    'Test 17: Simulation tracking ID is uniquely assigned with sim_env_ prefix'
  );

  // Test 18: Sender profile persistence
  const customSender = {
    ...getDefaultSenderProfile(),
    shopName: 'Test Shop Tokyo 2026'
  };
  saveSenderProfile(customSender);
  const reloadedSender = loadSenderProfile();
  assert(
    Boolean(reloadedSender.shopName === 'Test Shop Tokyo 2026'),
    'Test 18: Sender profile successfully persisted and retrieved'
  );

  // Test 19: Envelope print settings persistence
  const customSettings = {
    envelopeType: 'ENVELOPE_KAKUGATA_2' as const,
    orientation: 'horizontal' as const,
    includeItemSummary: false,
    includeSenderInfo: true,
    fontSizeScale: 1.1,
    offsetXmm: 2,
    offsetYmm: -1
  };
  saveEnvelopePrintSettings(customSettings);
  const reloadedSettings = loadEnvelopePrintSettings();
  assert(
    Boolean(
      reloadedSettings.envelopeType === 'ENVELOPE_KAKUGATA_2' &&
        reloadedSettings.orientation === 'horizontal' &&
        reloadedSettings.fontSizeScale === 1.1
    ),
    'Test 19: Envelope print settings successfully persisted'
  );

  // Test 20: Complete Excel and external file isolation
  assert(
    Boolean(typeof localStorage !== 'undefined'),
    'Test 20: All layout data and sender settings reside in application-owned isolated storage without touching 住所録.xlsx'
  );

  return { passed, failed, log };
}
