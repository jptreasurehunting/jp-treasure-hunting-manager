import {
  ShippingTemplate,
  GeneratedShippingSection,
  PostDispatchMessage,
  ShippingTemplateValidationResult
} from '../types/shippingTemplate';
import { DutyTerm } from '../types/shippingRegistry';

const TEMPLATES_STORAGE_KEY = 'zonos_shipping_templates_registry_v2';

export const DDP_VERIFIED_NOTICE_TEXT = `This item will be shipped DDP (Delivered Duty Paid).\nImport duties and taxes are prepaid, so you will not be required to pay them upon delivery.`;

/**
 * Initial Default Shipping Templates List
 */
export function getInitialShippingTemplates(): ShippingTemplate[] {
  return [
    {
      templateId: 'tpl_jp_sea_mail',
      methodId: 'jp_sea_mail',
      carrier: 'Japan Post (日本郵政)',
      serviceTitle: 'Japan Post Surface Mail',
      estimatedDeliveryText: 'Approximately 2–3 months after shipment.',
      trackingParagraph: 'Tracking information will be uploaded after shipment.',
      delayParagraph: 'Customs inspections, transportation congestion, or international disruptions may cause additional delays.',
      optionalCostSavingNote: 'Surface Mail is used to keep the shipping cost as low as possible.\n\nFaster air shipping may be available for an additional charge. Please contact us before purchasing.',
      isDdpVerified: true,
      isActive: true,
      isDomestic: false,
      lastUpdated: new Date().toISOString()
    },
    {
      templateId: 'tpl_jp_ems',
      methodId: 'jp_ems',
      carrier: 'Japan Post (日本郵政)',
      serviceTitle: 'Japan Post EMS (Express Mail Service)',
      estimatedDeliveryText: 'Approximately 5–10 business days after shipment.',
      trackingParagraph: 'End-to-end tracking information will be provided immediately upon shipment.',
      delayParagraph: 'Customs inspections, transportation congestion, or international disruptions may cause additional delays.',
      optionalCostSavingNote: '',
      isDdpVerified: true,
      isActive: true,
      isDomestic: false,
      lastUpdated: new Date().toISOString()
    },
    {
      templateId: 'tpl_fedex_ficp',
      methodId: 'fedex_connect_plus_ddp',
      carrier: 'FedEx',
      serviceTitle: 'FedEx International Connect Plus',
      estimatedDeliveryText: 'Approximately 3–7 business days after shipment.',
      trackingParagraph: 'Live FedEx tracking number will be updated upon dispatch.',
      delayParagraph: 'Customs inspection or remote area delivery may add 1–2 business days.',
      optionalCostSavingNote: '',
      isDdpVerified: true,
      isActive: true,
      isDomestic: false,
      lastUpdated: new Date().toISOString()
    },
    {
      templateId: 'tpl_ebay_speedpak',
      methodId: 'ebay_speedpak',
      carrier: 'SpeedPAK',
      serviceTitle: 'eBay SpeedPAK Standard Service',
      estimatedDeliveryText: 'Approximately 7–12 business days after shipment.',
      trackingParagraph: 'SpeedPAK tracking details will be uploaded to eBay after dispatch.',
      delayParagraph: 'Customs processing or seasonal volume may extend delivery time.',
      optionalCostSavingNote: '',
      isDdpVerified: true,
      isActive: true,
      isDomestic: false,
      lastUpdated: new Date().toISOString()
    }
  ];
}

/**
 * Load Shipping Templates List
 */
export function loadShippingTemplates(): ShippingTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return getInitialShippingTemplates();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialShippingTemplates();
  } catch (e) {
    console.error('Failed to load shipping templates:', e);
    return getInitialShippingTemplates();
  }
}

/**
 * Save Shipping Templates List
 */
export function saveShippingTemplates(templates: ShippingTemplate[]): void {
  try {
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.error('Failed to save shipping templates:', e);
  }
}

/**
 * Automatically Generate Full Shipping Section (Placed BEFORE Item Description)
 */
export function generateFullShippingDescriptionSection(
  template: ShippingTemplate,
  dutyTerm: DutyTerm,
  isDdpConfirmed: boolean,
  rawItemDescription: string = 'Vintage Japanese collectible in excellent condition.'
): GeneratedShippingSection {
  const isVerifiedDdp = !template.isDomestic && dutyTerm === 'DDP' && isDdpConfirmed && template.isDdpVerified;

  const header = 'IMPORTANT SHIPPING INFORMATION';
  const shippingMethodTitle = template.serviceTitle;
  const estimatedDeliveryText = template.estimatedDeliveryText;
  const ddpNoticeText = isVerifiedDdp ? DDP_VERIFIED_NOTICE_TEXT : undefined;
  const trackingNoticeText = template.trackingParagraph || 'Tracking information will be uploaded after shipment.';
  const delayNoticeText = template.delayParagraph || 'Customs inspections, transportation congestion, or international disruptions may cause additional delays.';
  const optionalCostSavingNoteText = template.optionalCostSavingNote?.trim() || undefined;

  const blocks: string[] = [];

  blocks.push(`## ${header}`);
  blocks.push(`### Standard Shipping:\n${shippingMethodTitle}`);
  blocks.push(`### Estimated Delivery:\n${estimatedDeliveryText}`);

  // DDP Notice MUST appear immediately after Estimated Delivery section!
  if (ddpNoticeText) {
    blocks.push(ddpNoticeText);
  }

  // Tracking Notice MUST always be included!
  blocks.push(trackingNoticeText);
  blocks.push(delayNoticeText);

  if (optionalCostSavingNoteText) {
    blocks.push(optionalCostSavingNoteText);
  }

  blocks.push(`\n---\n\n## Item Description\n${rawItemDescription}`);

  const fullMarkdownText = blocks.join('\n\n');

  return {
    fullMarkdownText,
    header,
    shippingMethodTitle,
    estimatedDeliveryText,
    ddpNoticeText,
    trackingNoticeText,
    delayNoticeText,
    optionalCostSavingNoteText,
    itemDescriptionText: rawItemDescription
  };
}

/**
 * Generate Automated Post-Dispatch Buyer Notification Message
 */
export function generatePostDispatchBuyerMessage(
  orderId: string,
  trackingNumber: string,
  carrierName: string,
  estimatedDeliveryText: string,
  isDdpPrepaid: boolean
): PostDispatchMessage {
  const ddpNote = isDdpPrepaid
    ? '\nNote: This shipment is sent DDP (Delivered Duty Paid). All import duties and taxes have been prepaid.'
    : '';

  const buyerMessage = `Dear Buyer,\n\nThank you for your purchase! Your order (${orderId}) has been dispatched.\n\nShipping Details:\n- Carrier: ${carrierName}\n- Tracking Number: ${trackingNumber}\n- Estimated Delivery: ${estimatedDeliveryText}${ddpNote}\n\nWe appreciate your business!`;

  return {
    buyerMessage,
    orderId,
    trackingNumber,
    carrierName,
    estimatedDelivery: estimatedDeliveryText,
    isDdpPrepaid,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Validate Shipping Template Gate Before Publishing (Enforce Strict DDP Only)
 */
export function validateShippingTemplateGate(
  template?: ShippingTemplate,
  dutyTerm: DutyTerm = 'DDP',
  isDomestic: boolean = false
): ShippingTemplateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (isDomestic) {
    return {
      isValid: true,
      templateFound: true,
      estimatedDeliveryPresent: true,
      trackingParagraphPresent: true,
      ddpParagraphCorrect: true,
      hasProhibitedDdu: false,
      errors: [],
      warnings: ['日本国内発送のため発送テンプレートのDDP規制は免除されます。']
    };
  }

  if (dutyTerm === 'DDU') {
    errors.push('DDUは規約により完全禁止されています。DDP適合サービスを選択してください。');
  }

  if (!template) {
    errors.push('選択された配送サービス用の発送テンプレートが見つかりません。');
    return {
      isValid: false,
      templateFound: false,
      estimatedDeliveryPresent: false,
      trackingParagraphPresent: false,
      ddpParagraphCorrect: false,
      hasProhibitedDdu: dutyTerm === 'DDU',
      errors,
      warnings
    };
  }

  if (!template.isActive) {
    errors.push(`発送テンプレート (${template.serviceTitle}) は現在無効化されています。`);
  }

  if (!template.estimatedDeliveryText || !template.estimatedDeliveryText.trim()) {
    errors.push('お届け予定日数の記述 (Estimated Delivery) が未入力です。');
  }

  if (!template.trackingParagraph || !template.trackingParagraph.trim()) {
    errors.push('追跡情報の記述 (Tracking Paragraph) が未入力です。');
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    templateFound: true,
    estimatedDeliveryPresent: !!template.estimatedDeliveryText?.trim(),
    trackingParagraphPresent: !!template.trackingParagraph?.trim(),
    ddpParagraphCorrect: dutyTerm === 'DDP' && template.isDdpVerified,
    hasProhibitedDdu: dutyTerm === 'DDU',
    errors,
    warnings
  };
}
