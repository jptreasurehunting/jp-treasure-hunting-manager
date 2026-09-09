import { SalesChannel } from './shippingRouter';

export type ChannelSyncStatus =
  | 'SYNCED'            // 外部販売先まで反映確認済み
  | 'PENDING'           // 外部販売先への同期待ち
  | 'FAILED'            // 外部販売先への同期失敗
  | 'OVERSELLING_RISK'  // 二重販売リスク (要確認)
  | 'PAUSED';           // 在庫切れ/手動による休止

export interface ChannelInventoryBinding {
  channel: SalesChannel;
  sellerAccountId: string;
  channelListingId: string;
  syncedStock: number;
  syncStatus: ChannelSyncStatus;
  lastSyncedAt: string;
  lastErrorMessage?: string;
  isAutoSyncEnabled: boolean;
}

export type OversellingRiskReason =
  | 'INSUFFICIENT_ATS'
  | 'EXTERNAL_SYNC_FAILURE'
  | 'AUTO_SYNC_DISABLED'
  | 'SELLABLE_GATE_INCOMPLETE';

/**
 * Supplier-side lifecycle. A procurement order is never Buyer inventory and
 * PURCHASE_ORDERED / INBOUND quantities are never counted in marketplace ATS.
 */
export type ProcurementStatus =
  | 'PURCHASE_ORDERED'
  | 'INBOUND'
  | 'RECEIVED'
  | 'CANCELLED';

export interface ProcurementOrder {
  procurementOrderId: string;
  sku: string;
  quantity: number;
  supplierName: string;
  supplierOrderReference?: string;
  status: ProcurementStatus;
  orderedAt: string;
  inboundAt?: string;
  receivedAt?: string;
  cancelledAt?: string;
  trackingNumber?: string;
  expectedArrivalAt?: string;
  notes?: string;
}

/**
 * Physical-unit lifecycle after the item is under company control.
 * PURCHASE_ORDERED belongs to ProcurementOrder, not to a physical InventoryUnit.
 */
export type InventoryUnitStatus =
  | 'ON_HAND'
  | 'AVAILABLE'
  | 'BUYER_ALLOCATED'
  | 'PICKED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DAMAGED'
  | 'LOST';

export interface SellableInventoryGate {
  identityVerified: boolean;
  quantityVerified: boolean;
  conditionVerified: boolean;
  photoCaptureComplete: boolean;
  photoQaComplete: boolean;
  storageLocationRegistered: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface InventoryUnit {
  inventoryUnitId: string;
  sku: string;
  procurementOrderId?: string;
  status: InventoryUnitStatus;
  storageLocation?: string;
  receivedAt: string;
  sellableGate: SellableInventoryGate;
  buyerAllocationId?: string;
  updatedAt: string;
  notes?: string;
}

export interface CentralInventoryItem {
  sku: string;
  itemTitle: string;
  physicalStock: number;         // 現在、自社管理下にある実物総数。INBOUNDは含めない。
  sellableStock: number;         // Sellable Inventory Gateを通過し、販売対象にできる実物数。
  buyerAllocatedStock: number;   // Buyer Orderへ割当済みで、まだ自社にある実物数。
  inboundStock: number;          // 仕入先から入荷予定/輸送中。ATSには絶対に含めない。
  availableToSell: number;       // max(0, sellableStock - buyerAllocatedStock - safetyBuffer)
  safetyBuffer: number;
  unitCostJpy: number;
  weightGrams: number;
  dimensionsCm: { length: number; width: number; height: number };
  category: string;
  channelBindings: ChannelInventoryBinding[];
  lastReconciledAt: string;
  isLockedForOversellingRisk: boolean;
  oversellingRiskReason?: OversellingRiskReason;
}

export type BuyerAllocationStatus =
  | 'BUYER_ALLOCATED'
  | 'PICKED'
  | 'PACKED'
  | 'SHIPPED'
  | 'RELEASED_CANCELLED';

/**
 * Buyer-side commitment. This is deliberately not named "Reserved" because it
 * must be clear that the commitment came from a Buyer Order, not a supplier PO.
 */
export interface BuyerInventoryAllocation {
  allocationId: string;
  sku: string;
  quantity: number;
  marketplace: SalesChannel;
  sellerAccountId: string;
  orderId: string;
  buyerId: string;
  inventoryUnitIds: string[];
  status: BuyerAllocationStatus;
  allocatedAt: string;
  pickedAt?: string;
  packedAt?: string;
  shippedAt?: string;
  releasedAt?: string;
}

export type InventorySyncEventType =
  | 'BUYER_ALLOCATION_CREATED'
  | 'BUYER_ALLOCATION_RELEASED'
  | 'SALE_DEDUCTION'
  | 'RESTOCK'
  | 'PROCUREMENT_ORDERED'
  | 'PROCUREMENT_INBOUND'
  | 'PROCUREMENT_RECEIVED'
  | 'SELLABLE_GATE_PASSED'
  | 'RECONCILIATION_SYNC';

export interface InventorySyncEvent {
  eventId: string;
  sku: string;
  eventType: InventorySyncEventType;
  triggerChannel: SalesChannel;
  triggerOrderId?: string;
  quantityDelta: number;
  beforePhysicalStock: number;
  afterPhysicalStock: number;
  beforeAvailableToSell: number;
  afterAvailableToSell: number;
  syncedChannels: SalesChannel[];       // 外部販売先まで反映確認済み
  pendingChannels?: SalesChannel[];     // 同期要求を発行済みだが外部反映未確認
  failedChannels: SalesChannel[];
  blockedChannels?: SalesChannel[];     // 自動同期無効等で同期要求を実行できない
  isIdempotentReplay: boolean;
  timestamp: string;
}

export interface ReconciliationSummary {
  reconciliationId: string;
  timestamp: string;
  totalSkusChecked: number;
  syncedSkusCount: number;
  discrepancyCount: number;
  discrepancies: {
    sku: string;
    channel: SalesChannel;
    centralStock: number;
    channelStock: number;
    actionTakenJa: string;
  }[];
}
