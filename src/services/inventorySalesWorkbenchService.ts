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
    (binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK'
  );

  if (item.isLockedForOversellingRisk) {
    reasonsJa.push('二重販売リスクで中央在庫がロックされています。');
    return { state: 'BLOCKED', reasonsJa, syncIssueCount: syncIssues.length };
  }

  if (item.availableToSell <= 0) {
    reasonsJa.push('現在の販売可能在庫が0です。');
    return { state: 'OUT_OF_STOCK', reasonsJa, syncIssueCount: syncIssues.length };
  }

  if (syncIssues.length > 0) {
    reasonsJa.push(`販売チャネル同期に${syncIssues.length}件の要確認があります。`);
    return { state: 'REVIEW_REQUIRED', reasonsJa, syncIssueCount: syncIssues.length };
  }

  if (item.channelBindings.length === 0) {
    reasonsJa.push('販売可能在庫はありますが、販売チャネルへの紐付けがありません。');
    return { state: 'REVIEW_REQUIRED', reasonsJa, syncIssueCount: 0 };
  }

  reasonsJa.push('販売可能在庫があり、重大な在庫同期異常は検出されていません。');
  return { state: 'READY', reasonsJa, syncIssueCount: 0 };
}

export function buildInventorySalesWorkbench(
  items: CentralInventoryItem[]
): InventorySalesWorkbenchSnapshot {
  const rows = items.map<InventorySalesWorkbenchRow>((item) => {
    const classification = classifyItem(item);
    const syncedChannelCount = item.channelBindings.filter(
      (binding) => binding.syncStatus === 'SYNCED'
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
