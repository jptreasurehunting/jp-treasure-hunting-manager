import { PackagingType } from './shippingRouter';

export interface EnvelopeDimensionsMm {
  widthMm: number;
  heightMm: number;
  postalCodeTopMm: number;
  postalCodeLeftMm: number;
  postalBoxWidthMm: number;
  postalBoxHeightMm: number;
  postalBoxGapMm: number;
  postalHyphenGapMm: number;
}

export interface SenderProfile {
  shopName: string;
  senderName: string;
  postalCode: string; // e.g. '104-0061'
  stateOrProvince: string; // e.g. '東京都'
  city: string; // e.g. '中央区'
  addressLine1: string; // e.g. '銀座1-2-3'
  addressLine2?: string; // e.g. 'トレジャービル 5F'
  phoneNumber?: string; // e.g. '03-1234-5678'
  printSenderOnFront: boolean; // 表面左下に差出人を印字するか
  printSenderOnBack: boolean; // 裏面に印字するか
}

export interface EnvelopePrintSettings {
  envelopeType: PackagingType;
  orientation: 'vertical' | 'horizontal'; // 縦書き | 横書き
  includeItemSummary: boolean; // 品名・eBay注文番号の注記印字
  includeSenderInfo: boolean; // 差出人情報の印字
  fontSizeScale: number; // 0.8〜1.2 (文字サイズ微調整)
  offsetXmm: number; // 左右印字位置微調整 (-10〜+10mm)
  offsetYmm: number; // 上下印字位置微調整 (-10〜+10mm)
}

export interface PostalCodeBoxMetrics {
  digits: string[]; // 7 digits array: ['1', '5', '0', '0', '0', '0', '1']
  firstGroup: string; // '150'
  secondGroup: string; // '0001'
  boxes: {
    digit: string;
    leftMm: number;
    topMm: number;
    widthMm: number;
    heightMm: number;
  }[];
}

export interface EnvelopeLayoutPayload {
  orderId: string;
  orderNumber: string;
  envelopeType: PackagingType;
  dimensionsMm: EnvelopeDimensionsMm;
  settings: EnvelopePrintSettings;
  recipient: {
    fullName: string;
    honorific: string; // '様'
    postalCodeFormatted: string; // '〒150-0001'
    postalMetrics: PostalCodeBoxMetrics;
    addressLine1: string;
    addressLine2?: string;
    fullAddressFormatted: string;
  };
  sender?: SenderProfile;
  itemSummary?: {
    itemTitle: string;
    quantity: number;
    orderNumber: string;
    sku?: string;
  };
  isValid: boolean;
  validationWarnings: string[];
  testModeSimulationId: string;
  generatedAt: string;
}

export interface LayoutValidationResult {
  isValid: boolean;
  warnings: string[];
  isAddressTruncated: boolean;
  isPostalCodeValid: boolean;
}
