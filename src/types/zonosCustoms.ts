export type MaterialSourceType = 'ebay' | 'inferred_listing' | 'inferred_photo' | 'manual';

export interface ZonosCustomsItem {
  id: string;
  itemId?: string;           // eBay Item ID
  title?: string;            // eBay 商品タイトル
  imageUrl?: string;         // 商品画像URL
  weightKg?: number;         // 重量 (kg表示用)
  unitWeightGrams: number;   // 単体重量 (g単位)
  subtotalWeightGrams: number; // 重量小計 (g単位)
  weightUnit: 'g' | 'kg' | 'oz' | 'lb'; // 入力/表示単位
  weightSource: 'eBay API' | 'Item Specifics' | '既存商品データ' | '手入力' | '未取得' | '推定';
  isWeightEstimated?: boolean; // 推定重量フラグ
  material: string;          // 材質 (e.g., "PVC", "Paper", "Acrylic")
  productType: string;       // 商品種類 (e.g., "Figure", "Card", "Keychain")
  quantity: number;          // 数量 (integer >= 1)
  countryOfOrigin: string;   // 原産国 (default "Japan")
  declaredValueCents: number; // 申告価格 (セント単位)
  declaredValue: number;      // 申告価格 ($表記)
  
  // Ver 2.0 Zonos Prepay Extensions
  unitValueJpy?: number;      // JPY 単価
  totalValueJpy?: number;     // JPY 小計
  customsDescription?: string; // 英語税関用品名 (e.g., "PVC figure", "Paper sticky note")
  materialSource?: MaterialSourceType; // 材質取得元
  isIncludedItem: boolean;    // 同梱品 / おまけフラグ
  isSoldItem: boolean;        // 販売商品フラグ
  isFreeGift?: boolean;       // おまけ商品フラグ
  originWarning?: boolean;    // 原産国警告フラグ
  isEditedByUser?: boolean;   // 上書き防止用ユーザー編集フラグ
}

export interface ZonosCustomsDeclaration {
  orderId: string;                    // 注文番号
  itemId?: string;                    // 代表 Item ID
  title?: string;                     // 代表 商品タイトル
  imageUrl?: string;                  // 代表 商品画像URL
  weightKg?: number;                  // 代表重量 (kg)
  totalItemsWeightGrams: number;      // 商品重量合計 (g)
  packagingWeightGrams: number;       // 梱包材重量 (g)
  totalPackagedWeightGrams: number;   // 梱包後総重量 (g)
  ebayTransactionValueCents: number;  // eBay取引金額 (セント単位)
  ebayTransactionValue: number;       // eBay取引金額 ($表記)
  currency: string;                   // 通貨 (e.g., "USD")
  
  // Ver 2.0 Currency & JPY Declaration Total
  exchangeRate?: number;              // JPY 為替レート (e.g. 155.20)
  exchangeRateSource?: string;        // 為替レート取得元
  exchangeRateTimestamp?: string;     // 為替レート取得日時
  ebayTransactionValueJpy?: number;   // JPY 換算取引総額
  regularItemsJpySubtotal?: number;   // 販売商品 JPY 小計
  freeGiftsJpySubtotal?: number;      // おまけ JPY 小計
  totalDeclaredJpyValue?: number;     // 最終申告 JPY 総額
  jpyDifference?: number;             // JPY 差額 (必須: 0 JPY)

  carrier: 'JAPAN_POST';              // 配送会社 ("JAPAN_POST" 固定)
  originCountry: 'JP';                // 発送元国 ("JP" 固定)
  destinationCountry: string;         // 発送先国 (e.g., "United States (US)")
  shippingMethod: string;             // 配送方法 (e.g., "国際小包 船便")
  items: ZonosCustomsItem[];
  declarationLocked: boolean;         // 確定状態 (true=確定済み/ロック, false=未確定)
  confirmedAt?: string;               // 確定日時
  orderDate?: string;                 // 注文日時
  paymentStatus?: string;             // 支払状態
  fulfillmentStatus?: string;         // 発送状態
  importedAt?: string;                // eBayデータ取込日時
  importSource?: 'mock' | 'live_api'; // 取込元
  selectedAccountId?: string;
  selectedAccountDisplayName?: string;
}

export interface ShippingSnapshotItem {
  itemId?: string;
  title?: string;
  material: string;
  productType: string;
  quantity: number;
  countryOfOrigin: string;
  declaredValue: number;
  unitValueJpy?: number;
  totalValueJpy?: number;
  customsDescription?: string;
  materialSource?: MaterialSourceType;
  isIncludedItem: boolean;
  weightKg?: number;
  unitWeightGrams?: number;
  subtotalWeightGrams?: number;
}

export interface ShippingSnapshot {
  id: string;
  version: number;
  createdAt: string;
  orderId: string;
  ebayOrderId?: string;
  ebayItemId?: string;
  itemTitle?: string;
  ebayTransactionValue: number;
  currency: string;
  carrier: string;
  shippingMethod: string;
  recommendedShippingMethods?: string[];
  originCountry: string;
  destinationCountry: string;
  weightKg?: number;
  totalItemsWeightGrams: number;
  packagingWeightGrams: number;
  totalPackagedWeightGrams: number;
  weightUnit: string;
  weightSource: string;
  imageUrl?: string;
  customsDescription?: string;
  items: ShippingSnapshotItem[];
  totalDeclaredValue: number;
  totalDeclaredJpyValue?: number;
  trackingNumber: string;
  shippingDate: string;
  confirmedAt: string;
  copiedAt: string;
  importedAt?: string;
  importSource?: string;
  transferStatus?: '未転記' | '転記中' | '転記完了' | '中断';
  transferStartedAt?: string;
  transferCompletedAt?: string;
  transferMode?: 'clipboard' | 'browser_assist';
  transferredItemsCount?: number;
  zonosConfirmationNumber?: string;
  interruptionHistory?: string[];
  ebayAccountId?: string;
  ebayAccountDisplayName?: string;
  ebayUsername?: string;
  fetchSourceAccount?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  beforeState?: string;
  afterState?: string;
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
  
  // Ver 2.0 JPY Validation Flags
  totalDeclaredJpyValue?: number;
  jpyDifference?: number;
  isJpyTotalMatched?: boolean;
  isFreeGiftValueInvalid?: boolean;
  hasZeroValueItem?: boolean;

  materialMissing: boolean;
  productTypeMissing: boolean;
  quantityInvalid: boolean;
  originMissing: boolean;
  valueInvalid: boolean;
  currencyMismatch: boolean;
  isDomesticShipment: boolean;
  carrierInvalid: boolean;
  originInvalid: boolean;
  destinationMissing: boolean;
  shippingMethodMissing: boolean;
  shippingConditionsValid: boolean;
  weightMissing: boolean;
}

export interface EbayOrderItemPayload {
  itemId: string;
  title: string;
  quantity: number;
  actualPrice: number;
  weightKg?: number;
  unitWeightGrams: number;
  weightUnit: 'g' | 'kg' | 'oz' | 'lb';
  weightSource: 'eBay API' | 'Item Specifics' | '既存商品データ' | '手入力' | '未取得' | '推定';
  isWeightEstimated?: boolean;
  imageUrl: string;
  derivedMaterial: string;
  derivedProductType: string;
  materialSource?: MaterialSourceType;
  knownFreeGifts?: Array<{ title: string; material: string; productType: string }>;
}

export interface EbayOrderPayload {
  orderId: string;
  ebayTransactionValue: number;
  currency: string;
  destinationCountry: string;
  orderDate: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  items: EbayOrderItemPayload[];
  importSource: 'mock' | 'live_api';
}

export interface TransferSession {
  sessionId: string;
  orderId: string;
  status: 'in_progress' | 'interrupted' | 'completed';
  startedAt: string;
  completedAt?: string;
  interruptedAt?: string;
  interruptedReason?: string;
  completedItemsCount: number;
  totalItemsCount: number;
  currentItemIndex: number;
  transferMode: 'clipboard' | 'browser_assist';
  zonosConfirmationNumber?: string;
  completedFieldKeys: string[];
}

export interface EbaySellerAccount {
  id: string;
  displayName: string;
  ebayUsername: string;
  connectionStatus: 'unconnected' | 'prep_mode' | 'connected';
  lastAuthDate?: string;
  lastOrderFetchDate?: string;
  environment: 'Production';
  isSelectedForFetch: boolean;
  safeRefId: string;
}

export interface EbayListingTransferItem {
  itemId: string;
  sku: string;
  title: string;
  price: number;
  currency: string;
  quantity: number;
  category: string;
  imageUrl: string;
  isSelected: boolean;
}

export interface ListingTransferSettings {
  sourceAccountId: string;
  destinationAccountId: string;
  transferMode: 'move';
  listingVisibility: 'draft' | 'active';
}

export type ComplianceStatus =
  | 'Available'
  | 'Compliance review required'
  | 'Information incomplete'
  | 'Confirmed by user'
  | 'Expired'
  | 'Disabled';

export interface CountryComplianceRecord {
  countryCode: string;
  countryName: string;
  isSalesEnabled: boolean;
  status: ComplianceStatus;
  requiredRegistrations: string[];
  registrationNumber?: string;
  packagingProvider?: string;
  contractRefNumber?: string;
  validFromDate?: string;
  validUntilDate?: string;
  evidenceConfirmedAt?: string;
  evidenceConfirmedByUser: boolean;
  notes?: string;
}

export interface DestinationShippingCost {
  countryCode: string;
  countryName: string;
  shippingService: string;
  shippingCost: number;
  currency: string;
  handlingTimeDays: number;
}
