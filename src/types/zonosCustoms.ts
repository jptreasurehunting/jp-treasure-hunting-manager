export interface ZonosCustomsItem {
  id: string;
  material: string;        // 材質 (e.g., "PVC", "Paper", "Acrylic")
  productType: string;     // 商品種類 (e.g., "Figure", "Card", "Keychain")
  quantity: number;        // 数量 (integer >= 1)
  countryOfOrigin: string; // 原産国 (default "Japan")
  declaredValueCents: number; // 申告価格 (セント単位)
  declaredValue: number;      // 申告価格 ($表記)
  isIncludedItem: boolean;    // 同梱品フラグ
  isSoldItem: boolean;        // 販売商品フラグ
}

export interface ZonosCustomsDeclaration {
  orderId: string;                    // 注文番号
  ebayTransactionValueCents: number;  // eBay取引金額 (セント単位)
  ebayTransactionValue: number;       // eBay取引金額 ($表記)
  currency: string;                   // 通貨 (e.g., "USD")
  carrier: 'JAPAN_POST';              // 配送会社 (Ver.1.1は "JAPAN_POST" で固定)
  originCountry: 'JP';                // 発送元国 ("JP" で固定)
  destinationCountry: string;         // 発送先国 (e.g., "United States (US)")
  shippingMethod: string;             // 配送方法 (e.g., "国際小包 船便")
  items: ZonosCustomsItem[];
  declarationLocked: boolean;         // 確定状態 (true=確定済み/ロック, false=未確定)
  confirmedAt?: string;               // 確定日時
}

export interface ShippingSnapshotItem {
  material: string;
  productType: string;
  quantity: number;
  countryOfOrigin: string;
  declaredValue: number;
  isIncludedItem: boolean;
}

export interface ShippingSnapshot {
  id: string;
  version: number;
  createdAt: string;
  orderId: string;
  ebayTransactionValue: number;
  currency: string;
  carrier: string;            // 配送会社
  shippingMethod: string;     // 配送方法
  originCountry: string;      // 発送元国
  destinationCountry: string; // 発送先国
  items: ShippingSnapshotItem[];
  totalDeclaredValue: number;
  trackingNumber: string;
  shippingDate: string;
  confirmedAt: string;
  copiedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;      // 操作内容 (e.g., "同梱品を追加", "申告価格を確定")
  beforeState?: string; // 変更前
  afterState?: string;  // 変更後
}

export interface CustomsValidationStatus {
  isValid: boolean;
  canLock: boolean;
  canCopyZonos: boolean;
  errors: string[];
  warnings: string[];
  totalDeclaredValueCents: number;
  totalDeclaredValue: number;
  differenceCents: number;
  difference: number;
  materialMissing: boolean;
  productTypeMissing: boolean;
  quantityInvalid: boolean;
  originMissing: boolean;
  valueInvalid: boolean;
  currencyMismatch: boolean;
  // Ver.1.1 Shipping Condition fields
  isDomesticShipment: boolean;
  carrierInvalid: boolean;
  originInvalid: boolean;
  destinationMissing: boolean;
  shippingMethodMissing: boolean;
  shippingConditionsValid: boolean;
}
