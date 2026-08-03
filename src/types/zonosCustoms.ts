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
  isIncludedItem: boolean;    // 同梱品フラグ
  isSoldItem: boolean;        // 販売商品フラグ
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
  carrier: 'JAPAN_POST';              // 配送会社 (Ver.1.1は "JAPAN_POST" で固定)
  originCountry: 'JP';                // 発送元国 ("JP" で固定)
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
  // Ver.1.5 Account reference metadata
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
  carrier: string;            // 配送会社
  shippingMethod: string;     // 配送方法 (最終選択)
  recommendedShippingMethods?: string[]; // 配送方法候補一覧
  originCountry: string;      // 発送元国
  destinationCountry: string; // 発送先国
  weightKg?: number;          // 重量 (kg)
  totalItemsWeightGrams: number;     // 商品重量合計 (g)
  packagingWeightGrams: number;      // 梱包材重量 (g)
  totalPackagedWeightGrams: number;  // 梱包後総重量 (g)
  weightUnit: string;                // 重量単位
  weightSource: string;              // 重量取得元
  imageUrl?: string;                 // 代表画像URL
  customsDescription?: string;       // 代表 Customs Description
  items: ShippingSnapshotItem[];
  totalDeclaredValue: number;
  trackingNumber: string;
  shippingDate: string;
  confirmedAt: string;
  copiedAt: string;
  importedAt?: string;
  importSource?: string;
  // Ver.1.4 Transfer attributes
  transferStatus?: '未転記' | '転記中' | '転記完了' | '中断';
  transferStartedAt?: string;
  transferCompletedAt?: string;
  transferMode?: 'clipboard' | 'browser_assist';
  transferredItemsCount?: number;
  zonosConfirmationNumber?: string;
  interruptionHistory?: string[];
  // Ver.1.5 eBay Account Reference attributes
  ebayAccountId?: string;
  ebayAccountDisplayName?: string;
  ebayUsername?: string;
  fetchSourceAccount?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;      // 操作内容
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
  isDomesticShipment: boolean;
  carrierInvalid: boolean;
  originInvalid: boolean;
  destinationMissing: boolean;
  shippingMethodMissing: boolean;
  shippingConditionsValid: boolean;
  weightMissing: boolean;
}

// Ver.1.2 & Ver.1.3 eBay Import Payload Types
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

// Ver.1.4 Transfer Session & Check Types
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

// Ver.1.5 Multi-eBay Seller Account Types (Zero secrets stored)
export interface EbaySellerAccount {
  id: string;                    // 内部アカウントID (e.g., "acc_01")
  displayName: string;           // 表示名 (e.g., "メインアカウント", "Account 1")
  ebayUsername: string;          // eBayユーザー名 (仮表示 "Account 1" ... "Account 10")
  connectionStatus: 'unconnected' | 'prep_mode' | 'connected'; // 接続状態
  lastAuthDate?: string;         // 最終認証日時
  lastOrderFetchDate?: string;   // 最終注文取得日時
  environment: 'Production';     // 本番環境 (固定)
  isSelectedForFetch: boolean;   // 注文取得対象フラグ
  safeRefId: string;             // トークンを含まない安全な参照ID (e.g., "ref_acc_01")
}

// Ver.1.6 Listing Transfer Types (UI Only)
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

// Ver.1.7 Country Sales & Compliance Types (Spec #2 & #10)
export type ComplianceStatus =
  | 'Available'
  | 'Compliance review required'
  | 'Information incomplete'
  | 'Confirmed by user'
  | 'Expired'
  | 'Disabled';

export interface CountryComplianceRecord {
  countryCode: string;           // ISO Alpha-2 (e.g. "US", "CA", "AU", "DE", "FR", "ES")
  countryName: string;           // 国名 (e.g. "United States", "Germany")
  isSalesEnabled: boolean;       // 販売許可フラグ
  status: ComplianceStatus;      // コンプライアンスステータス
  requiredRegistrations: string[]; // 必要な登録・認証項目 (e.g. ["LUCID Packaging Register"])
  registrationNumber?: string;   // 登録番号 / LUCID番号
  packagingProvider?: string;    // 包装システム事業者名
  contractRefNumber?: string;    // 契約/参照番号
  validFromDate?: string;        // 契約開始日
  validUntilDate?: string;       // 契約終了/更新日
  evidenceConfirmedAt?: string;  // 証拠確認日時
  evidenceConfirmedByUser: boolean; // 証拠確認チェックボックス
  notes?: string;                // ユーザーメモ
}

export interface DestinationShippingCost {
  countryCode: string;
  countryName: string;
  shippingService: string;
  shippingCost: number;
  currency: string;
  handlingTimeDays: number;
}
