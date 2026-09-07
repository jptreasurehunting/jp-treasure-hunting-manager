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
  | 'AUTO_SYNC_DISABLED';

export interface CentralInventoryItem {
  sku: string;
  itemTitle: string;
  physicalStock: number;       // 実在庫数
  reservedStock: number;       // 引当予約数 (未発送注文分)
  availableToSell: number;     // 販売可能数 (physicalStock - reservedStock - safetyBuffer)
  safetyBuffer: number;        // 安全在庫バッファ
  unitCostJpy: number;
  weightGrams: number;
  dimensionsCm: { length: number; width: number; height: number };
  category: string;
  channelBindings: ChannelInventoryBinding[];
  lastReconciledAt: string;
  isLockedForOversellingRisk: boolean;
  oversellingRiskReason?: OversellingRiskReason;
}

export interface InventoryReservation {
  reservationId: string;
  sku: string;
  quantity: number;
  channel: SalesChannel;
  sellerAccountId: string;
  orderId: string;
  status: 'ACTIVE' | 'COMMITTED_SOLD' | 'RELEASED_CANCELLED';
  reservedAt: string;
  committedAt?: string;
  releasedAt?: string;
}

export interface InventorySyncEvent {
  eventId: string;
  sku: string;
  eventType: 'SALE_DEDUCTION' | 'RESTOCK' | 'RESERVATION_CREATED' | 'RESERVATION_RELEASED' | 'RECONCILIATION_SYNC';
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
