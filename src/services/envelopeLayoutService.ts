import { PackagingType, NormalizedFulfillmentOrder } from '../types/shippingRouter';
import {
  EnvelopeDimensionsMm,
  EnvelopePrintSettings,
  SenderProfile,
  PostalCodeBoxMetrics,
  EnvelopeLayoutPayload,
  LayoutValidationResult
} from '../types/envelopeLayout';

const SENDER_STORAGE_KEY = 'zonos_sender_profile_v1';
const PRINT_SETTINGS_KEY = 'zonos_envelope_print_settings_v1';

// Japan Post Standard Physical Envelope Dimensions & Postal Box Metric Specs (in Millimeters)
export function getStandardEnvelopeDimensions(envelopeType: PackagingType): EnvelopeDimensionsMm {
  switch (envelopeType) {
    case 'ENVELOPE_NAGAGATA_3':
      // 長形3号 (120 x 235 mm) - A4三つ折りサイズ
      return {
        widthMm: 120,
        heightMm: 235,
        postalCodeTopMm: 12.0,
        postalCodeLeftMm: 43.5,
        postalBoxWidthMm: 5.7,
        postalBoxHeightMm: 8.0,
        postalBoxGapMm: 1.1,
        postalHyphenGapMm: 4.8
      };

    case 'ENVELOPE_NAGAGATA_4':
      // 長形4号 (90 x 205 mm) - B5四つ折りサイズ
      return {
        widthMm: 90,
        heightMm: 205,
        postalCodeTopMm: 12.0,
        postalCodeLeftMm: 28.5,
        postalBoxWidthMm: 5.7,
        postalBoxHeightMm: 8.0,
        postalBoxGapMm: 1.1,
        postalHyphenGapMm: 4.8
      };

    case 'ENVELOPE_KAKUGATA_2':
      // 角形2号 (240 x 332 mm) - A4そのままサイズ
      return {
        widthMm: 240,
        heightMm: 332,
        postalCodeTopMm: 15.0,
        postalCodeLeftMm: 140.0,
        postalBoxWidthMm: 6.8,
        postalBoxHeightMm: 9.5,
        postalBoxGapMm: 1.5,
        postalHyphenGapMm: 6.0
      };

    case 'PADDED_MAILER':
    default:
      // クッション封筒 / スマートレター / 標準サイズ
      return {
        widthMm: 150,
        heightMm: 240,
        postalCodeTopMm: 15.0,
        postalCodeLeftMm: 65.0,
        postalBoxWidthMm: 5.7,
        postalBoxHeightMm: 8.0,
        postalBoxGapMm: 1.1,
        postalHyphenGapMm: 4.8
      };
  }
}

// Default Sender Profile (Shop info)
export function getDefaultSenderProfile(): SenderProfile {
  return {
    shopName: 'JP Treasure Hunting Japan',
    senderName: '発送管理センター',
    postalCode: '104-0061',
    stateOrProvince: '東京都',
    city: '中央区',
    addressLine1: '銀座1-2-3',
    addressLine2: 'トレジャービル 5F',
    phoneNumber: '03-1234-5678',
    printSenderOnFront: true,
    printSenderOnBack: false
  };
}

// Default Envelope Print Settings
export function getDefaultEnvelopePrintSettings(envelopeType: PackagingType = 'ENVELOPE_NAGAGATA_3'): EnvelopePrintSettings {
  return {
    envelopeType,
    orientation: 'vertical',
    includeItemSummary: true,
    includeSenderInfo: true,
    fontSizeScale: 1.0,
    offsetXmm: 0,
    offsetYmm: 0
  };
}

// Storage Operations
export function loadSenderProfile(): SenderProfile {
  try {
    const raw = localStorage.getItem(SENDER_STORAGE_KEY);
    if (!raw) return getDefaultSenderProfile();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultSenderProfile();
  }
}

export function saveSenderProfile(profile: SenderProfile): void {
  try {
    localStorage.setItem(SENDER_STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.error('Failed to save sender profile:', e);
  }
}

export function loadEnvelopePrintSettings(): EnvelopePrintSettings {
  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_KEY);
    if (!raw) return getDefaultEnvelopePrintSettings();
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultEnvelopePrintSettings();
  }
}

export function saveEnvelopePrintSettings(settings: EnvelopePrintSettings): void {
  try {
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save envelope print settings:', e);
  }
}

/**
 * 7-Digit Postal Code Box Coordinate Calculator (Japan Post Standard Pitch)
 */
export function calculatePostalCodeBoxes(postalCodeRaw: string, dims: EnvelopeDimensionsMm, offsetX = 0, offsetY = 0): PostalCodeBoxMetrics {
  const digitsOnly = (postalCodeRaw || '').replace(/[^0-9]/g, '');
  const digits = digitsOnly.padEnd(7, ' ').slice(0, 7).split('');

  const firstGroup = digitsOnly.slice(0, 3);
  const secondGroup = digitsOnly.slice(3, 7);

  const boxes: PostalCodeBoxMetrics['boxes'] = [];
  let currentLeft = dims.postalCodeLeftMm + offsetX;
  const top = dims.postalCodeTopMm + offsetY;

  for (let i = 0; i < 7; i++) {
    boxes.push({
      digit: digits[i] !== ' ' ? digits[i] : '',
      leftMm: currentLeft,
      topMm: top,
      widthMm: dims.postalBoxWidthMm,
      heightMm: dims.postalBoxHeightMm
    });

    if (i === 2) {
      // Hyphen gap between 3rd and 4th digit
      currentLeft += dims.postalBoxWidthMm + dims.postalHyphenGapMm;
    } else {
      currentLeft += dims.postalBoxWidthMm + dims.postalBoxGapMm;
    }
  }

  return {
    digits,
    firstGroup,
    secondGroup,
    boxes
  };
}

/**
 * Validate Envelope Layout Bounds and Address Length
 */
export function validateEnvelopeLayout(order: NormalizedFulfillmentOrder, settings: EnvelopePrintSettings): LayoutValidationResult {
  const warnings: string[] = [];
  const digitsOnly = (order.postalCode || '').replace(/[^0-9]/g, '');
  const isPostalCodeValid = digitsOnly.length === 7;

  if (!isPostalCodeValid) {
    warnings.push('郵便番号が7桁揃っていません。');
  }

  if (!order.buyerName || order.buyerName.trim().length === 0) {
    warnings.push('受取人氏名が未入力です。');
  }

  const fullAddr = `${order.stateOrProvince || ''}${order.city || ''}${order.addressLine1 || ''}${order.addressLine2 || ''}`;
  let isAddressTruncated = false;

  if (settings.orientation === 'vertical' && fullAddr.length > 45) {
    warnings.push('住所が45文字を超えているため、フォントサイズを縮小して印字します。');
    isAddressTruncated = true;
  }

  return {
    isValid: warnings.length === 0 || (isPostalCodeValid && Boolean(order.buyerName)),
    warnings,
    isAddressTruncated,
    isPostalCodeValid
  };
}

/**
 * Generate Complete Vector Envelope Layout Payload (Phase B)
 */
export function generateEnvelopeLayout(
  order: NormalizedFulfillmentOrder,
  customSettings?: Partial<EnvelopePrintSettings>,
  customSender?: SenderProfile
): EnvelopeLayoutPayload {
  const baseSettings = loadEnvelopePrintSettings();
  const settings: EnvelopePrintSettings = {
    ...baseSettings,
    ...customSettings
  };

  const sender = customSender || loadSenderProfile();
  const dims = getStandardEnvelopeDimensions(settings.envelopeType);

  const postalMetrics = calculatePostalCodeBoxes(
    order.postalCode,
    dims,
    settings.offsetXmm,
    settings.offsetYmm
  );

  const validation = validateEnvelopeLayout(order, settings);

  const fullAddressFormatted = `${order.stateOrProvince} ${order.city} ${order.addressLine1}${order.addressLine2 ? ` ${order.addressLine2}` : ''}`;
  const formattedPostal = order.postalCode ? `〒${order.postalCode.replace(/[^0-9]/g, '').replace(/^(\d{3})(\d{4})$/, '$1-$2')}` : '';

  const simulationId = `sim_env_${order.orderId}_${Date.now()}`;

  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    envelopeType: settings.envelopeType,
    dimensionsMm: dims,
    settings,
    recipient: {
      fullName: order.buyerName || '(宛名未入力)',
      honorific: '様',
      postalCodeFormatted: formattedPostal,
      postalMetrics,
      addressLine1: `${order.stateOrProvince} ${order.city} ${order.addressLine1}`,
      addressLine2: order.addressLine2,
      fullAddressFormatted
    },
    sender: settings.includeSenderInfo ? sender : undefined,
    itemSummary: settings.includeItemSummary
      ? {
          itemTitle: order.itemTitle,
          quantity: order.quantity,
          orderNumber: order.orderNumber,
          sku: order.sku
        }
      : undefined,
    isValid: validation.isValid,
    validationWarnings: validation.warnings,
    testModeSimulationId: simulationId,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Safe Test Mode Print Job Simulation (Phase B: No physical print output)
 */
export function simulateEnvelopePrintJob(
  order: NormalizedFulfillmentOrder,
  settings?: Partial<EnvelopePrintSettings>
): {
  success: boolean;
  simulationId: string;
  payload: EnvelopeLayoutPayload;
  simulationMessageJa: string;
} {
  const payload = generateEnvelopeLayout(order, settings);

  const simulationMessageJa = payload.isValid
    ? `✅ [安全テストモード] 封筒ベクターレイアウト (${payload.envelopeType}) のシミュレーションが正常に完了しました。(物理印刷は実行されていません)`
    : `⚠️ [安全テストモード警告] レイアウト警告があります: ${payload.validationWarnings.join(' / ')}`;

  return {
    success: payload.isValid,
    simulationId: payload.testModeSimulationId,
    payload,
    simulationMessageJa
  };
}
