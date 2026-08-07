import { DutyTerm } from './shippingRegistry';

export interface ShippingTemplate {
  templateId: string;
  methodId: string; // References ShippingMethod.methodId
  carrier: string;
  serviceTitle: string; // e.g. "Japan Post Sea Mail"
  estimatedDeliveryText: string; // e.g. "Approximately 2–3 months after shipment."
  trackingParagraph: string; // e.g. "Tracking information will be uploaded after shipment."
  delayParagraph: string; // e.g. "Please note that customs inspections or transportation delays may extend the delivery time."
  optionalCostSavingNote?: string; // e.g. "Sea Mail is selected to keep international shipping costs as low as possible."
  isDdpVerified: boolean;
  isActive: boolean;
  isDomestic: boolean;
  lastUpdated: string;
}

export interface GeneratedShippingSection {
  fullMarkdownText: string;
  header: string; // "Shipping Information"
  shippingMethodTitle: string;
  estimatedDeliveryText: string;
  ddpNoticeText?: string;
  trackingNoticeText: string;
  delayNoticeText: string;
  optionalCostSavingNoteText?: string;
  itemDescriptionText: string;
}

export interface PostDispatchMessage {
  buyerMessage: string;
  orderId: string;
  trackingNumber: string;
  carrierName: string;
  estimatedDelivery: string;
  isDdpPrepaid: boolean;
  generatedAt: string;
}

export interface ShippingTemplateValidationResult {
  isValid: boolean;
  templateFound: boolean;
  estimatedDeliveryPresent: boolean;
  trackingParagraphPresent: boolean;
  ddpParagraphCorrect: boolean;
  hasProhibitedDdu: boolean;
  errors: string[];
  warnings: string[];
}
