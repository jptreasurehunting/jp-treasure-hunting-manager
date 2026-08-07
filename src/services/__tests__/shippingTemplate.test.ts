/**
 * Unit Test Suite for Shipping Template Manager & Generator
 */

import {
  loadShippingTemplates,
  generateFullShippingDescriptionSection,
  generatePostDispatchBuyerMessage,
  validateShippingTemplateGate,
  DDP_VERIFIED_NOTICE_TEXT
} from '../shippingTemplateService';

export function runShippingTemplateTests(): { passed: number; failed: number; log: string[] } {
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

  const templates = loadShippingTemplates();

  // Test 1: Japan Post Surface Mail
  const seaMailTpl = templates.find((t) => t.templateId === 'tpl_jp_sea_mail');
  assert(
    Boolean(
      seaMailTpl &&
        seaMailTpl.serviceTitle.includes('Surface Mail') &&
        seaMailTpl.estimatedDeliveryText.includes('2–3 months') &&
        seaMailTpl.optionalCostSavingNote?.includes('Surface Mail is used to keep the shipping cost as low as possible')
    ),
    'Test 1: Japan Post Surface Mail template details and cost saving note'
  );

  // Test 2: Japan Post EMS
  const emsTpl = templates.find((t) => t.templateId === 'tpl_jp_ems');
  assert(
    Boolean(
      emsTpl &&
        emsTpl.serviceTitle.includes('EMS') &&
        emsTpl.estimatedDeliveryText.includes('5–10 business days')
    ),
    'Test 2: Japan Post EMS template details'
  );

  // Test 3: FedEx
  const fedexTpl = templates.find((t) => t.templateId === 'tpl_fedex_ficp');
  assert(
    Boolean(
      fedexTpl &&
        fedexTpl.serviceTitle.includes('FedEx') &&
        fedexTpl.estimatedDeliveryText.includes('3–7 business days')
    ),
    'Test 3: FedEx template details'
  );

  // Test 4: SpeedPAK
  const speedpakTpl = templates.find((t) => t.templateId === 'tpl_ebay_speedpak');
  assert(
    Boolean(
      speedpakTpl &&
        speedpakTpl.serviceTitle.includes('SpeedPAK') &&
        speedpakTpl.estimatedDeliveryText.includes('7–12 business days')
    ),
    'Test 4: SpeedPAK template details'
  );

  // Test 5: Domestic shipment (Exempt from DDP)
  const gate5 = validateShippingTemplateGate(seaMailTpl, 'DDP', true);
  assert(Boolean(gate5.isValid && gate5.warnings[0]?.includes('日本国内発送のため')), 'Test 5: Domestic shipment exempt from DDP');

  // Test 6: Verified DDP Notice IMMEDIATELY after Estimated Delivery section
  const section6 = generateFullShippingDescriptionSection(seaMailTpl!, 'DDP', true, 'Item description sample.');
  const text6 = section6.fullMarkdownText;
  const idxEstDeliv = text6.indexOf('### Estimated Delivery:');
  const idxDdp = text6.indexOf('This item will be shipped DDP');
  const idxTracking = text6.indexOf('Tracking information will be uploaded');
  const idxDesc = text6.indexOf('## Item Description');

  assert(
    Boolean(
      section6.ddpNoticeText === DDP_VERIFIED_NOTICE_TEXT &&
        idxEstDeliv >= 0 &&
        idxDdp > idxEstDeliv &&
        idxTracking > idxDdp &&
        idxDesc > idxTracking
    ),
    'Test 6: Verified DDP notice appears IMMEDIATELY after Estimated Delivery, followed by Tracking Notice and Item Description'
  );

  // Test 7: DDU (DDP notice omitted, blocked by validation gate)
  const section7 = generateFullShippingDescriptionSection(seaMailTpl!, 'DDU', false, 'Item description sample.');
  const gate7 = validateShippingTemplateGate(seaMailTpl!, 'DDU', false);
  assert(
    Boolean(
      section7.ddpNoticeText === undefined &&
        !gate7.isValid &&
        gate7.errors.some((e) => e.includes('DDUは規約により完全禁止'))
    ),
    'Test 7: DDU shipment omits DDP notice and is blocked by validation gate'
  );

  // Test 8: Unknown shipping service / missing template
  const gate8 = validateShippingTemplateGate(undefined, 'DDP', false);
  assert(
    Boolean(
      !gate8.isValid &&
        !gate8.templateFound &&
        gate8.errors.some((e) => e.includes('発送テンプレートが見つかりません'))
    ),
    'Test 8: Unknown shipping service / missing template error'
  );

  // Test 9: Post-dispatch shipment message generator
  const dispatchMsg = generatePostDispatchBuyerMessage('ORDER-99', 'TRK123', 'Japan Post Surface Mail', '2–3 months', true);
  assert(
    Boolean(
      dispatchMsg.buyerMessage.includes('dispatched') &&
        dispatchMsg.buyerMessage.includes('TRK123') &&
        dispatchMsg.buyerMessage.includes('Delivered Duty Paid')
    ),
    'Test 9: Post-dispatch shipment notification message generation'
  );

  return { passed, failed, log };
}
