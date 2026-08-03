import { CountryComplianceRecord, DestinationShippingCost } from '../types/zonosCustoms';

const COMPLIANCE_SESSION_KEY = 'zonos_country_compliance_metadata';
const SHIPPING_RATES_SESSION_KEY = 'zonos_destination_shipping_rates';

/**
 * Creates Initial Default Country Compliance Records (Spec #2)
 */
export function createInitialComplianceRecords(): CountryComplianceRecord[] {
  return [
    {
      countryCode: 'US',
      countryName: 'United States',
      isSalesEnabled: true,
      status: 'Available',
      requiredRegistrations: [],
      evidenceConfirmedByUser: true,
      notes: '主要対象国 (デフォルト販売許可)'
    },
    {
      countryCode: 'CA',
      countryName: 'Canada',
      isSalesEnabled: true,
      status: 'Available',
      requiredRegistrations: [],
      evidenceConfirmedByUser: true,
      notes: '主要対象国 (デフォルト販売許可)'
    },
    {
      countryCode: 'AU',
      countryName: 'Australia',
      isSalesEnabled: true,
      status: 'Available',
      requiredRegistrations: [],
      evidenceConfirmedByUser: true,
      notes: '主要対象国 (デフォルト販売許可)'
    },
    {
      countryCode: 'DE',
      countryName: 'Germany',
      isSalesEnabled: false,
      status: 'Compliance review required',
      requiredRegistrations: [
        'LUCID Packaging Register Registration',
        'Packaging System Participation / Licensing',
        'LUCID Registration Number in eBay'
      ],
      evidenceConfirmedByUser: false,
      notes: '包装法(VerpackG)等の対応確認が必要 (デフォルト不可)'
    },
    {
      countryCode: 'FR',
      countryName: 'France',
      isSalesEnabled: false,
      status: 'Compliance review required',
      requiredRegistrations: ['EPR Packaging Category', 'EPR Unique Identification Number (IDU)'],
      evidenceConfirmedByUser: false,
      notes: 'EPR法等の対応確認が必要 (デフォルト不可)'
    },
    {
      countryCode: 'ES',
      countryName: 'Spain',
      isSalesEnabled: false,
      status: 'Compliance review required',
      requiredRegistrations: ['EPR Packaging Register'],
      evidenceConfirmedByUser: false,
      notes: '包装・EPR等の個別確認が必要 (デフォルト不可)'
    },
    {
      countryCode: 'EU_OTHER',
      countryName: 'Other EU/EEA Countries',
      isSalesEnabled: false,
      status: 'Compliance review required',
      requiredRegistrations: ['EU Product Safety & EPR Review'],
      evidenceConfirmedByUser: false,
      notes: '国ごとに異なる法規制の個別レビューが必要 (デフォルト不可)'
    }
  ];
}

/**
 * Loads compliance records from sessionStorage (MAD compliant, non-volatile storage clean)
 */
export function loadComplianceRecords(): CountryComplianceRecord[] {
  try {
    const raw = sessionStorage.getItem(COMPLIANCE_SESSION_KEY);
    if (!raw) return createInitialComplianceRecords();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return createInitialComplianceRecords();
  } catch (e) {
    console.error('Failed to load compliance records:', e);
    return createInitialComplianceRecords();
  }
}

/**
 * Saves compliance records to sessionStorage
 */
export function saveComplianceRecords(records: CountryComplianceRecord[]): void {
  try {
    sessionStorage.setItem(COMPLIANCE_SESSION_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save compliance records:', e);
  }
}

/**
 * Validates Germany LUCID Packaging Law Requirements (Spec #3 & Spec #14 Test 3, 4, 5)
 */
export function validateGermanyCompliance(record: CountryComplianceRecord): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!record.registrationNumber || !record.registrationNumber.trim()) {
    errors.push('LUCID登録番号 (LUCID Registration Number) が入力されていません。');
  }

  if (!record.packagingProvider || !record.packagingProvider.trim()) {
    errors.push('包装システム事業者名 (Packaging System Provider) が入力されていません。');
  }

  if (!record.contractRefNumber || !record.contractRefNumber.trim()) {
    errors.push('契約/参照番号 (Contract/Reference Number) が入力されていません。');
  }

  if (!record.validFromDate || !record.validFromDate.trim()) {
    errors.push('契約開始日 (Valid From Date) が設定されていません。');
  }

  if (!record.evidenceConfirmedByUser) {
    errors.push('適合証拠確認チェックボックス (Compliance evidence confirmed) にチェックが入っていません。');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculates Expiry Warnings (60 days, 30 days, 7 days prior to validUntilDate) (Spec #11)
 */
export function checkExpiryWarning(validUntilDate?: string): {
  isExpired: boolean;
  warningMessage: string | null;
  daysRemaining: number | null;
} {
  if (!validUntilDate) {
    return { isExpired: false, warningMessage: null, daysRemaining: null };
  }

  const untilMs = new Date(validUntilDate).getTime();
  if (isNaN(untilMs)) {
    return { isExpired: false, warningMessage: null, daysRemaining: null };
  }

  const nowMs = Date.now();
  const diffMs = untilMs - nowMs;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      isExpired: true,
      warningMessage: '⚠️ 登録・契約有効期限が切れています。更新されるまで販売許可が自動停止されます。',
      daysRemaining: diffDays
    };
  } else if (diffDays <= 7) {
    return {
      isExpired: false,
      warningMessage: `⚠️ 【緊急】登録有効期限まであと ${diffDays} 日です。速やかに更新手続きを行ってください。`,
      daysRemaining: diffDays
    };
  } else if (diffDays <= 30) {
    return {
      isExpired: false,
      warningMessage: `⚠️ 【警告】登録有効期限まであと ${diffDays} 日です。`,
      daysRemaining: diffDays
    };
  } else if (diffDays <= 60) {
    return {
      isExpired: false,
      warningMessage: `ℹ️ 【案内】登録有効期限まであと ${diffDays} 日です。事前確認を推奨します。`,
      daysRemaining: diffDays
    };
  }

  return { isExpired: false, warningMessage: null, daysRemaining: diffDays };
}

/**
 * Default Destination Shipping Rates Manager (Spec #7)
 */
export function createInitialDestinationShippingRates(): DestinationShippingCost[] {
  return [
    {
      countryCode: 'US',
      countryName: 'United States',
      shippingService: 'Japan Post EMS',
      shippingCost: 15.0,
      currency: 'USD',
      handlingTimeDays: 2
    },
    {
      countryCode: 'CA',
      countryName: 'Canada',
      shippingService: 'Japan Post International Parcel Air',
      shippingCost: 25.0,
      currency: 'USD',
      handlingTimeDays: 3
    },
    {
      countryCode: 'AU',
      countryName: 'Australia',
      shippingService: 'Japan Post Express Air',
      shippingCost: 30.0,
      currency: 'USD',
      handlingTimeDays: 3
    }
  ];
}

export function loadDestinationShippingRates(): DestinationShippingCost[] {
  try {
    const raw = sessionStorage.getItem(SHIPPING_RATES_SESSION_KEY);
    if (!raw) return createInitialDestinationShippingRates();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return createInitialDestinationShippingRates();
  } catch (e) {
    console.error('Failed to load shipping rates:', e);
    return createInitialDestinationShippingRates();
  }
}

export function saveDestinationShippingRates(rates: DestinationShippingCost[]): void {
  try {
    sessionStorage.setItem(SHIPPING_RATES_SESSION_KEY, JSON.stringify(rates));
  } catch (e) {
    console.error('Failed to save shipping rates:', e);
  }
}
