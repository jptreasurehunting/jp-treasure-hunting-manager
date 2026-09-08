import type { SalesChannel } from '../types/shippingRouter';
import {
  loadCentralInventory,
  reserveInventory
} from './centralInventoryService';

const SALE_EVENT_STORAGE_KEY = 'jp_marketplace_sale_events_v1';
export const MARKETPLACE_SALE_EVENTS_CHANGED_EVENT = 'jp-marketplace-sale-events-changed';

const TRANSACTION_STORAGE_KEYS = [
  'zonos_central_inventory_ssot_v1',
  'zonos_inventory_reservations_v1',
  'zonos_inventory_sync_events_v1',
  'zonos_processed_inventory_event_ids_v1',
  'jp_cross_channel_inventory_sync_queue_v1'
] as const;

export type MarketplaceSaleEventStatus =
  | 'PROCESSED'
  | 'BLOCKED'
  | 'REPLAY_SKIPPED'
  | 'ROLLED_BACK';

export interface MarketplaceSaleEventLine {
  sku: string;
  quantity: number;
}

export interface MarketplaceSaleEventInput {
  eventId: string;
  channel: SalesChannel;
  sellerAccountId: string;
  orderId: string;
  occurredAt: string;
  lines: MarketplaceSaleEventLine[];
  source: 'MANUAL_SIMULATION' | 'MARKETPLACE_ADAPTER';
}

export interface MarketplaceSaleEventRecord extends MarketplaceSaleEventInput {
  status: MarketplaceSaleEventStatus;
  receivedAt: string;
  processedAt?: string;
  reservationIds: string[];
  blockingReasons: string[];
  warnings: string[];
  replayOfEventId?: string;
  replayCount?: number;
  lastReplayAt?: string;
}

export interface MarketplaceSaleEventPreflight {
  normalized: MarketplaceSaleEventInput;
  aggregatedLines: MarketplaceSaleEventLine[];
  blockingReasons: string[];
  warnings: string[];
  isReplay: boolean;
  canProcess: boolean;
}

export interface ProcessMarketplaceSaleEventResult {
  success: boolean;
  replaySkipped: boolean;
  record: MarketplaceSaleEventRecord;
  messageJa: string;
}

type ReserveInventoryFn = typeof reserveInventory;

function normalize(value: string): string {
  return String(value || '').trim();
}

function normalizeOccurredAt(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : normalize(value);
}

function normalizeSaleEvent(input: MarketplaceSaleEventInput): MarketplaceSaleEventInput {
  return {
    eventId: normalize(input.eventId),
    channel: input.channel,
    sellerAccountId: normalize(input.sellerAccountId),
    orderId: normalize(input.orderId),
    occurredAt: normalizeOccurredAt(input.occurredAt),
    lines: Array.isArray(input.lines)
      ? input.lines.map((line) => ({ sku: normalize(line.sku), quantity: line.quantity }))
      : [],
    source: input.source
  };
}

function aggregateLines(lines: MarketplaceSaleEventLine[]): MarketplaceSaleEventLine[] {
  const quantities = new Map<string, number>();
  lines.forEach((line) => {
    if (!line.sku) return;
    quantities.set(line.sku, (quantities.get(line.sku) || 0) + line.quantity);
  });
  return Array.from(quantities.entries()).map(([sku, quantity]) => ({ sku, quantity }));
}

function deterministicReservationEventId(eventId: string, sku: string): string {
  return `marketplace_sale__${encodeURIComponent(eventId)}__${encodeURIComponent(sku)}`;
}

export function loadMarketplaceSaleEvents(): MarketplaceSaleEventRecord[] {
  try {
    const raw = localStorage.getItem(SALE_EVENT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMarketplaceSaleEvents(records: MarketplaceSaleEventRecord[]): void {
  localStorage.setItem(SALE_EVENT_STORAGE_KEY, JSON.stringify(records.slice(-1000)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(MARKETPLACE_SALE_EVENTS_CHANGED_EVENT));
  }
}

export function preflightMarketplaceSaleEvent(
  input: MarketplaceSaleEventInput,
  inventory = loadCentralInventory(),
  existingRecords = loadMarketplaceSaleEvents()
): MarketplaceSaleEventPreflight {
  const normalized = normalizeSaleEvent(input);
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  const alreadyProcessed = existingRecords.find((record) =>
    record.eventId === normalized.eventId && record.status === 'PROCESSED'
  );
  const isReplay = Boolean(alreadyProcessed);

  if (!normalized.eventId) blockingReasons.push('販売イベントIDが必要です。');
  if (!normalized.sellerAccountId) blockingReasons.push('販売アカウントIDが必要です。');
  if (!normalized.orderId) blockingReasons.push('注文IDが必要です。');
  if (!normalized.occurredAt || !Number.isFinite(Date.parse(normalized.occurredAt))) blockingReasons.push('販売発生日時が不正です。');
  if (!Array.isArray(normalized.lines) || normalized.lines.length === 0) blockingReasons.push('販売商品が1件以上必要です。');

  normalized.lines.forEach((line, index) => {
    if (!line.sku) blockingReasons.push(`明細${index + 1}: SKUが必要です。`);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) blockingReasons.push(`明細${index + 1}: 数量は1以上の整数で指定してください。`);
  });

  const aggregatedLines = aggregateLines(normalized.lines);
  aggregatedLines.forEach((line) => {
    const item = inventory.find((candidate) => candidate.sku === line.sku);
    if (!item) {
      blockingReasons.push(`SKU [${line.sku}] が中央在庫に存在しません。`);
      return;
    }

    const sourceBinding = item.channelBindings.find((binding) =>
      binding.channel === normalized.channel &&
      binding.sellerAccountId === normalized.sellerAccountId
    );
    if (!sourceBinding) {
      blockingReasons.push(`SKU [${line.sku}] に ${normalized.channel} / ${normalized.sellerAccountId} の販売先Bindingがありません。誤SKU引当防止のため停止します。`);
    }

    if (item.availableToSell < line.quantity) {
      blockingReasons.push(`SKU [${line.sku}] の販売可能数 ${item.availableToSell} 点が販売数量 ${line.quantity} 点未満です。二重販売リスクとして要確認です。`);
    }

    if (item.isLockedForOversellingRisk) {
      warnings.push(`SKU [${line.sku}] は既に二重販売リスクでロックされています。今回の実売分は在庫確保対象ですが、追加販売は停止状態を維持してください。`);
    }
  });

  if (isReplay) {
    warnings.push(`販売イベント [${normalized.eventId}] は処理済みです。在庫を二重に減らさずReplayとしてスキップします。`);
  }

  return {
    normalized,
    aggregatedLines,
    blockingReasons,
    warnings,
    isReplay,
    canProcess: isReplay || blockingReasons.length === 0
  };
}

function takeTransactionSnapshot(): Map<string, string | null> {
  const snapshot = new Map<string, string | null>();
  TRANSACTION_STORAGE_KEYS.forEach((key) => snapshot.set(key, localStorage.getItem(key)));
  return snapshot;
}

function restoreTransactionSnapshot(snapshot: Map<string, string | null>): void {
  snapshot.forEach((value, key) => {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  });
}

function upsertEventRecord(record: MarketplaceSaleEventRecord): void {
  const records = loadMarketplaceSaleEvents();
  const index = records.findIndex((candidate) => candidate.eventId === record.eventId);
  const next = [...records];
  if (index >= 0) next[index] = record;
  else next.push(record);
  saveMarketplaceSaleEvents(next);
}

export function processMarketplaceSaleEvent(
  input: MarketplaceSaleEventInput,
  now = new Date().toISOString(),
  reserveFn: ReserveInventoryFn = reserveInventory
): ProcessMarketplaceSaleEventResult {
  const inventoryBefore = loadCentralInventory();
  const recordsBefore = loadMarketplaceSaleEvents();
  const preflight = preflightMarketplaceSaleEvent(input, inventoryBefore, recordsBefore);
  const receivedAt = Number.isFinite(Date.parse(now)) ? new Date(now).toISOString() : new Date().toISOString();

  if (preflight.isReplay) {
    const previous = recordsBefore.find((record) => record.eventId === preflight.normalized.eventId && record.status === 'PROCESSED')!;
    const updatedPrevious: MarketplaceSaleEventRecord = {
      ...previous,
      replayCount: (previous.replayCount || 0) + 1,
      lastReplayAt: receivedAt,
      warnings: Array.from(new Set([...previous.warnings, ...preflight.warnings]))
    };
    upsertEventRecord(updatedPrevious);

    const replayRecord: MarketplaceSaleEventRecord = {
      ...preflight.normalized,
      lines: preflight.aggregatedLines,
      status: 'REPLAY_SKIPPED',
      receivedAt,
      processedAt: receivedAt,
      reservationIds: [],
      blockingReasons: [],
      warnings: preflight.warnings,
      replayOfEventId: previous.eventId,
      replayCount: updatedPrevious.replayCount,
      lastReplayAt: receivedAt
    };
    return {
      success: true,
      replaySkipped: true,
      record: replayRecord,
      messageJa: `🔄 販売イベント [${preflight.normalized.eventId}] は処理済みのため、中央在庫を二重に減らさずスキップしました。`
    };
  }

  if (!preflight.canProcess) {
    const blockedRecord: MarketplaceSaleEventRecord = {
      ...preflight.normalized,
      lines: preflight.aggregatedLines,
      status: 'BLOCKED',
      receivedAt,
      reservationIds: [],
      blockingReasons: preflight.blockingReasons,
      warnings: preflight.warnings
    };
    upsertEventRecord(blockedRecord);
    return {
      success: false,
      replaySkipped: false,
      record: blockedRecord,
      messageJa: `⛔ 販売イベントを処理できません。${preflight.blockingReasons.join(' / ')}`
    };
  }

  const snapshot = takeTransactionSnapshot();
  const reservationIds: string[] = [];
  try {
    for (const line of preflight.aggregatedLines) {
      const result = reserveFn(
        line.sku,
        line.quantity,
        preflight.normalized.channel,
        preflight.normalized.orderId,
        preflight.normalized.sellerAccountId,
        deterministicReservationEventId(preflight.normalized.eventId, line.sku)
      );
      if (!result.success || !result.reservationId) {
        throw new Error(result.messageJa || `SKU [${line.sku}] の在庫引当に失敗しました。`);
      }
      reservationIds.push(result.reservationId);
    }
  } catch (error) {
    restoreTransactionSnapshot(snapshot);
    const reason = error instanceof Error ? error.message : '販売イベント処理中に不明なエラーが発生しました。';
    const rolledBackRecord: MarketplaceSaleEventRecord = {
      ...preflight.normalized,
      lines: preflight.aggregatedLines,
      status: 'ROLLED_BACK',
      receivedAt,
      processedAt: receivedAt,
      reservationIds: [],
      blockingReasons: [reason],
      warnings: [...preflight.warnings, '複数明細の途中失敗を検知したため、中央在庫・予約・同期キューを処理前状態へ戻しました。']
    };
    upsertEventRecord(rolledBackRecord);
    return {
      success: false,
      replaySkipped: false,
      record: rolledBackRecord,
      messageJa: `⛔ 販売イベント処理をロールバックしました。${reason}`
    };
  }

  const processedRecord: MarketplaceSaleEventRecord = {
    ...preflight.normalized,
    lines: preflight.aggregatedLines,
    status: 'PROCESSED',
    receivedAt,
    processedAt: receivedAt,
    reservationIds,
    blockingReasons: [],
    warnings: preflight.warnings,
    replayCount: 0
  };
  upsertEventRecord(processedRecord);

  return {
    success: true,
    replaySkipped: false,
    record: processedRecord,
    messageJa: `✅ ${preflight.normalized.channel} 注文 [${preflight.normalized.orderId}] を中央在庫へ反映しました。${preflight.aggregatedLines.length} SKUを引当し、各販売先への在庫同期要求を作成しました。`
  };
}
