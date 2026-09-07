import { CentralInventoryItem } from '../types/centralInventory';

export type InventorySalesActionKind =
  | 'CLEAR_BLOCK'
  | 'FIX_SYNC'
  | 'LIST_UNLISTED'
  | 'SELL_READY'
  | 'NO_SALE_ACTION';

export type InventorySalesPriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface InventorySalesPriorityRow {
  sku: string;
  itemTitle: string;
  actionKind: InventorySalesActionKind;
  priority: InventorySalesPriority;
  availableToSell: number;
  unitCostJpy: number;
  tiedCostJpy: number;
  channelCount: number;
  syncIssueCount: number;
  nextActionJa: string;
  reasonsJa: string[];
}

export interface InventorySalesPrioritySummary {
  activeActionCount: number;
  blockedCount: number;
  syncReviewCount: number;
  unlistedCount: number;
  readyToSellCount: number;
  actionableTiedCostJpy: number;
}

export interface InventorySalesPriorityQueue {
  summary: InventorySalesPrioritySummary;
  rows: InventorySalesPriorityRow[];
}

const ACTION_ORDER: Record<InventorySalesActionKind, number> = {
  CLEAR_BLOCK: 0,
  FIX_SYNC: 1,
  LIST_UNLISTED: 2,
  SELL_READY: 3,
  NO_SALE_ACTION: 4
};

function classifyAction(item: CentralInventoryItem): Omit<InventorySalesPriorityRow, 'sku' | 'itemTitle' | 'availableToSell' | 'unitCostJpy' | 'tiedCostJpy' | 'channelCount' | 'syncIssueCount'> {
  const syncIssueCount = item.channelBindings.filter(
    (binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK'
  ).length;

  if (item.isLockedForOversellingRisk) {
    return {
      actionKind: 'CLEAR_BLOCK',
      priority: 'P1',
      nextActionJa: '二重販売リスクの原因を確認し、在庫ロック解除可否を判断する。',
      reasonsJa: ['安全上の在庫ロックがあるため、販売作業より先に原因確認が必要です。']
    };
  }

  if (item.availableToSell <= 0) {
    return {
      actionKind: 'NO_SALE_ACTION',
      priority: 'P4',
      nextActionJa: '現在は販売対象外。入荷・引当解除など在庫変化後に再評価する。',
      reasonsJa: ['販売可能在庫が0のため、現時点では現金化対象にしません。']
    };
  }

  if (syncIssueCount > 0) {
    return {
      actionKind: 'FIX_SYNC',
      priority: 'P1',
      nextActionJa: '販売チャネルの在庫同期異常を確認し、安全に再同期する。',
      reasonsJa: [`販売可能在庫はありますが、チャネル同期に${syncIssueCount}件の要確認があります。`]
    };
  }

  if (item.channelBindings.length === 0) {
    return {
      actionKind: 'LIST_UNLISTED',
      priority: 'P1',
      nextActionJa: '販売先を決め、出品候補として登録する。',
      reasonsJa: ['販売可能在庫がある一方、販売チャネルへの紐付けがありません。']
    };
  }

  return {
    actionKind: 'SELL_READY',
    priority: 'P2',
    nextActionJa: '既存出品・販売条件を確認し、販売を優先して進める。',
    reasonsJa: ['重大な在庫同期異常がなく、販売可能在庫があります。']
  };
}

export function buildInventorySalesPriorityQueue(
  items: CentralInventoryItem[]
): InventorySalesPriorityQueue {
  const rows: InventorySalesPriorityRow[] = items.map((item) => {
    const classification = classifyAction(item);
    const syncIssueCount = item.channelBindings.filter(
      (binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK'
    ).length;
    const tiedCostJpy = Math.max(0, item.availableToSell) * Math.max(0, item.unitCostJpy);

    return {
      sku: item.sku,
      itemTitle: item.itemTitle,
      ...classification,
      availableToSell: item.availableToSell,
      unitCostJpy: item.unitCostJpy,
      tiedCostJpy,
      channelCount: item.channelBindings.length,
      syncIssueCount
    };
  });

  rows.sort((a, b) => {
    const actionDifference = ACTION_ORDER[a.actionKind] - ACTION_ORDER[b.actionKind];
    if (actionDifference !== 0) return actionDifference;
    const tiedCostDifference = b.tiedCostJpy - a.tiedCostJpy;
    if (tiedCostDifference !== 0) return tiedCostDifference;
    return a.sku.localeCompare(b.sku);
  });

  const activeRows = rows.filter((row) => row.actionKind !== 'NO_SALE_ACTION');

  return {
    summary: {
      activeActionCount: activeRows.length,
      blockedCount: rows.filter((row) => row.actionKind === 'CLEAR_BLOCK').length,
      syncReviewCount: rows.filter((row) => row.actionKind === 'FIX_SYNC').length,
      unlistedCount: rows.filter((row) => row.actionKind === 'LIST_UNLISTED').length,
      readyToSellCount: rows.filter((row) => row.actionKind === 'SELL_READY').length,
      actionableTiedCostJpy: activeRows.reduce((sum, row) => sum + row.tiedCostJpy, 0)
    },
    rows
  };
}
