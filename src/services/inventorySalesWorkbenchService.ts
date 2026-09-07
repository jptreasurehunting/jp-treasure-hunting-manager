import { CentralInventoryItem } from '../types/centralInventory';

export type InventorySalesState =
  | 'READY'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED'
  | 'OUT_OF_STOCK';

export interface InventorySalesWorkbenchRow {
  sku: string;
  itemTitle: string;
  state: InventorySalesState;
  physicalStock: number;
  reservedStock: number;
  availableToSell: number;
  unitCostJpy: number;
  sellableCostBasisJpy: number;
  syncedChannelCount: number;
  totalChannelCount: number;
  syncIssueCount: number;
  reasonsJa: string[];
}

export interface InventorySalesWorkbenchSummary {
  totalSkus: number;
  readySkus: number;
  reviewRequiredSkus: number;
  blockedSkus: number;
  outOfStockSkus: number;
  totalSellableUnits: number;
  totalSellableCostBasisJpy: number;
}

export interface InventorySalesWorkbenchSnapshot {
  summary: InventorySalesWorkbenchSummary;
  rows: InventorySalesWorkbenchRow[];
}

const STATE_ORDER: Record<InventorySalesState, number> = {
  READY: 0,
  REVIEW_REQUIRED: 1,
  BLOCKED: 2,
  OUT_OF_STOCK: 3
};

function classifyItem(item: CentralInventoryItem): {
  state: InventorySalesState;
  reasonsJa: string[];
  syncIssueCount: number;
} {
  const reasonsJa: string[] = [];
  const syncIssues = item.channelBindings.filter(
    (binding) => binding.syncStatus === 'PENDING' || binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK'
  );
  const pendingCount = syncIssues.filter((binding) => binding.syncStatus === 'PENDING').length;
  const failedCount = syncIssues.length - pendingCount;

  if (item.isLockedForOversellingRisk) {
    reasonsJa.push('二重販売リスクで中央在庫がロックされています。');
    if (failedCount > 0) reasonsJa.push(`外部販売先の同期失敗・要手動確認が${failedCount}件あります。`);
    return { state: 'BLOCKED', reasonsJa, syncIssueCount: syncIssues.length };
  }

  // Pending external writes must be visible even when Central ATS has already reached zero.
  if (syncIssues.length > 0) {
    if (pendingCount > 0) reasonsJa.push(`外部販売先への在庫反映待ちが${pendingCount}件あります。成功確認までは同期済み扱いにしません。`);
    if (failedCount > 0) reasonsJa.push(`販売チャネル同期に${failedCount}件の失敗・要確認があります。`);
    return { state: 'REVIEW_REQUIRED', reasonsJa, syncIssueCount: syncIssues.length };
  }

  if (item.availableToSell <= 0) {
    reasonsJa.push('現在の販売可能在庫が0です。');
    return { state: 'OUT_OF_STOCK', reasonsJa, syncIssueCount: 0 };
  }

  if (item.channelBindings.length === 0) {
    reasonsJa.push('販売可能在庫はありますが、販売チャネルへの紐付けがありません。');
    return { state: 'REVIEW_REQUIRED', reasonsJa, syncIssueCount: 0 };
  }

  reasonsJa.push('販売可能在庫があり、外部販売先まで確認済みの重大な在庫同期異常はありません。');
  return { state: 'READY', reasonsJa, syncIssueCount: 0 };
}

export function buildInventorySalesWorkbench(
  items: CentralInventoryItem[]
): InventorySalesWorkbenchSnapshot {
  const rows = items.map<InventorySalesWorkbenchRow>((item) => {
    const classification = classifyItem(item);
    const syncedChannelCount = item.channelBindings.filter(
      (binding) => binding.syncStatus === 'SYNCED' || binding.syncStatus === 'PAUSED'
    ).length;

    return {
      sku: item.sku,
      itemTitle: item.itemTitle,
      state: classification.state,
      physicalStock: item.physicalStock,
      reservedStock: item.reservedStock,
      availableToSell: item.availableToSell,
      unitCostJpy: item.unitCostJpy,
      sellableCostBasisJpy: item.unitCostJpy * item.availableToSell,
      syncedChannelCount,
      totalChannelCount: item.channelBindings.length,
      syncIssueCount: classification.syncIssueCount,
      reasonsJa: classification.reasonsJa
    };
  });

  rows.sort((a, b) => {
    const stateDifference = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (stateDifference !== 0) return stateDifference;
    return b.sellableCostBasisJpy - a.sellableCostBasisJpy;
  });

  const summary: InventorySalesWorkbenchSummary = {
    totalSkus: rows.length,
    readySkus: rows.filter((row) => row.state === 'READY').length,
    reviewRequiredSkus: rows.filter((row) => row.state === 'REVIEW_REQUIRED').length,
    blockedSkus: rows.filter((row) => row.state === 'BLOCKED').length,
    outOfStockSkus: rows.filter((row) => row.state === 'OUT_OF_STOCK').length,
    totalSellableUnits: rows.reduce((sum, row) => sum + row.availableToSell, 0),
    totalSellableCostBasisJpy: rows.reduce((sum, row) => sum + row.sellableCostBasisJpy, 0)
  };

  return { summary, rows };
}
