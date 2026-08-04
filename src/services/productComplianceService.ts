import { ProductComplianceProfile } from '../types/safetyGate';

const PRODUCT_COMPLIANCE_SESSION_KEY = 'zonos_product_compliance_profiles';

export function createInitialProductProfiles(): ProductComplianceProfile[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return [
    {
      inventoryId: 'INV-2026-001',
      productCategory: 'Packaging only',
      materials: 'Metal, Glass, Plastic',
      containsBattery: false,
      isElectrical: false,
      isChildDirectedToy: false,
      isLiquid: false,
      isDangerousGoods: false,
      isRestrictedCarrierItem: false,
      lastReviewedDate: todayStr,
      notes: '一般中古カメラ (危険物該当なし)'
    },
    {
      inventoryId: 'INV-2026-002',
      productCategory: 'Packaging only',
      materials: 'Glass, Metal',
      containsBattery: false,
      isElectrical: false,
      isChildDirectedToy: false,
      isLiquid: false,
      isDangerousGoods: false,
      isRestrictedCarrierItem: false,
      lastReviewedDate: todayStr,
      notes: 'カメラレンズ (危険物該当なし)'
    },
    {
      inventoryId: 'INV-2026-003',
      productCategory: 'Battery',
      materials: 'Lithium-ion Battery, Plastic, Metal',
      containsBattery: true,
      batteryType: 'Lithium-ion (Contained in equipment)',
      isElectrical: true,
      isChildDirectedToy: false,
      isLiquid: false,
      isDangerousGoods: true,
      isRestrictedCarrierItem: true,
      lastReviewedDate: todayStr,
      notes: 'リチウムイオン電池内蔵 (国際郵便配送制限確認が必要)'
    }
  ];
}

export function loadProductProfiles(): ProductComplianceProfile[] {
  try {
    const raw = sessionStorage.getItem(PRODUCT_COMPLIANCE_SESSION_KEY);
    if (!raw) return createInitialProductProfiles();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return createInitialProductProfiles();
  } catch (e) {
    console.error('Failed to load product profiles:', e);
    return createInitialProductProfiles();
  }
}

export function saveProductProfiles(profiles: ProductComplianceProfile[]): void {
  try {
    sessionStorage.setItem(PRODUCT_COMPLIANCE_SESSION_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save product profiles:', e);
  }
}
