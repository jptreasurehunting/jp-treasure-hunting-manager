export type GateDecision = 'ALLOWED' | 'ALLOWED_WITH_WARNING' | 'BLOCKED';

export type ProtectedAction =
  | 'CREATE_LISTING'
  | 'REVISE_LISTING'
  | 'INCREASE_QUANTITY'
  | 'ENABLE_DESTINATION_COUNTRY'
  | 'ADD_DESTINATION_SHIPPING'
  | 'MOVE_LISTING'
  | 'CONFIRM_IMPORTED_ORDER'
  | 'CREATE_SHIPPING_RECORD'
  | 'START_ZONOS_TRANSFER'
  | 'CONFIRM_SHIPMENT_PREP'
  | 'MARK_ORDER_SHIPPED';

export type PhysicalStockStatus =
  | 'Verified'
  | 'Recheck Required'
  | 'Unknown'
  | 'Inventory Mismatch'
  | 'Out of Stock';

export type InventoryAdjustmentType =
  | 'Initial stock entry'
  | 'Stocktake correction'
  | 'New stock received'
  | 'Sale'
  | 'Order cancellation returned to stock'
  | 'Damaged'
  | 'Lost'
  | 'Disposed'
  | 'Reserved'
  | 'Reservation released'
  | 'Manual correction'
  | 'Other';

export interface InventoryItemRecord {
  inventoryId: string;           // 内部在庫ID (e.g., "INV-2026-001")
  sku: string;                   // SKU
  productName: string;           // 商品名
  physicalStockQuantity: number; // 手元実在庫数 (自動推測不可)
  reservedQuantity: number;      // 予約・引当数
  soldUnshippedQuantity: number; // 受注未発送数
  damagedQuantity: number;       // 破損数
  lostQuantity: number;          // 紛失数
  availableQuantity: number;     // 発送可能在庫数 (Physical - Reserved - SoldUnshipped - Damaged - Lost)
  accountAllocations: Record<string, number>; // アカウント別出品割当数
  lastStocktakeDate: string;     // 最終棚卸し・現物確認日時
  lastVerifiedBy: string;        // 確認担当者
  verificationStatus: PhysicalStockStatus; // 検証ステータス
  notes?: string;
}

export interface InventoryAdjustmentLog {
  id: string;
  timestamp: string;
  inventoryId: string;
  sku: string;
  adjustmentType: InventoryAdjustmentType;
  quantityBefore: number;
  adjustmentQuantity: number;
  quantityAfter: number;
  reason: string;
  userConfirmed: boolean;
  relatedOrderId?: string;
  relatedEbayAccountId?: string;
}

export interface ProductComplianceProfile {
  inventoryId: string;
  productCategory: string; // e.g. "Packaging only", "Battery", "Electronics", "Toy", "Used product", "Other"
  materials: string;
  containsBattery: boolean;
  batteryType?: string;
  isElectrical: boolean;
  isChildDirectedToy: boolean;
  isLiquid: boolean;
  isDangerousGoods: boolean;
  isRestrictedCarrierItem: boolean;
  lastReviewedDate: string;
  notes?: string;
}

export interface AccountHealthRecord {
  accountId: string;
  displayName: string;
  connectionStatus: 'connected' | 'disconnected';
  authStatus: 'valid' | 'expired';
  authExpiryDate: string;
  environment: 'Production' | 'Sandbox';
  canList: boolean;
  sellingRestrictionStatus: 'Active' | 'Restricted' | 'Suspended';
  unshippedOrdersCount: number;
  overdueHandlingCount: number;
  missingTrackingCount: number;
  sellerCancelledCount: number;
  unresolvedCasesCount: number;
  accountHealthWarnings: string[];
}

export interface SafetyGateResult {
  decision: GateDecision;
  action: ProtectedAction;
  actionNameJa: string;
  reasons: string[];
  missingRequirements: string[];
  requiredUserSteps: string[];
  resolutionLink?: string;
  isBypassBlocked: boolean;
}
