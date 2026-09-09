import { SalesChannel } from './shippingRouter';

export type ChannelSyncStatus =
  | 'SYNCED'
  | 'PENDING'
  | 'FAILED'
  | 'OVERSELLING_RISK'
  | 'PAUSED';

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

/** Supplier-side lifecycle. PURCHASE_ORDERED / INBOUND never count in ATS. */
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

/**
 * Central v2 read model. New logic uses explicit supplier-side and Buyer-side
 * fields. reservedStock remains optional only as an import/migration alias.
 */
export interface CentralInventoryItem {
  sku: string;
  itemTitle: string;
  physicalStock: number;
  sellableStock: number;
  buyerAllocatedStock: number;
  inboundStock: number;
  /** @deprecated v1 migration input only. Do not display or use for new decisions. */
  reservedStock?: number;
  availableToSell: number;
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

export type NormalizedCentralInventoryItem = CentralInventoryItem;

export type BuyerAllocationStatus =
  | 'BUYER_ALLOCATED'
  | 'PICKED'
  | 'PACKED'
  | 'SHIPPED'
  | 'RELEASED_CANCELLED';

/** Buyer-side commitment; never used for supplier procurement. */
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
  syncedChannels: SalesChannel[];
  pendingChannels?: SalesChannel[];
  failedChannels: SalesChannel[];
  blockedChannels?: SalesChannel[];
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
