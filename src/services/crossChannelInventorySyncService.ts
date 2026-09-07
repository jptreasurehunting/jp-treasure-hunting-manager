import { ChannelInventoryBinding } from '../types/centralInventory';
import { SalesChannel } from '../types/shippingRouter';

const STORAGE_KEY = 'jp_cross_channel_inventory_sync_queue_v1';
export const CROSS_CHANNEL_INVENTORY_SYNC_CHANGED_EVENT = 'jp-cross-channel-inventory-sync-changed';

export type CrossChannelInventorySyncReason =
  | 'SALE_RESERVATION'
  | 'CANCELLATION_RESTOCK'
  | 'RECONCILIATION';

export type CrossChannelInventorySyncStatus =
  | 'QUEUED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'BLOCKED';

export interface CrossChannelInventorySyncRequest {
  requestId: string;
  sourceEventId: string;
  sku: string;
  targetChannel: SalesChannel;
  sellerAccountId: string;
  channelListingId: string;
  targetStock: number;
  triggerChannel: SalesChannel;
  triggerOrderId?: string;
  reason: CrossChannelInventorySyncReason;
  status: CrossChannelInventorySyncStatus;
  createdAt: string;
  attemptedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  externalWritePerformed: boolean;
}

export interface QueueCrossChannelInventorySyncResult {
  bindings: ChannelInventoryBinding[];
  requests: CrossChannelInventorySyncRequest[];
  queuedChannels: SalesChannel[];
  blockedChannels: SalesChannel[];
}

function normalize(value: string): string {
  return value.trim();
}

function uniqueChannels(channels: SalesChannel[]): SalesChannel[] {
  return Array.from(new Set(channels));
}

function requestIdFor(
  sourceEventId: string,
  binding: ChannelInventoryBinding,
  targetStock: number
): string {
  const safe = [
    sourceEventId,
    binding.channel,
    binding.sellerAccountId,
    binding.channelListingId,
    String(targetStock)
  ].map((value) => encodeURIComponent(String(value))).join('__');
  return `inventory_sync__${safe}`;
}

export function loadCrossChannelInventorySyncRequests(): CrossChannelInventorySyncRequest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCrossChannelInventorySyncRequests(requests: CrossChannelInventorySyncRequest[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests.slice(-1000)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CROSS_CHANNEL_INVENTORY_SYNC_CHANGED_EVENT));
  }
}

export function queueCrossChannelInventorySync(
  params: {
    sourceEventId: string;
    sku: string;
    targetStock: number;
    triggerChannel: SalesChannel;
    triggerOrderId?: string;
    reason: CrossChannelInventorySyncReason;
    bindings: ChannelInventoryBinding[];
    now?: string;
  },
  existingRequests: CrossChannelInventorySyncRequest[] = loadCrossChannelInventorySyncRequests()
): QueueCrossChannelInventorySyncResult {
  const now = params.now && Number.isFinite(Date.parse(params.now))
    ? new Date(params.now).toISOString()
    : new Date().toISOString();
  const targetStock = Math.max(0, Math.floor(params.targetStock));
  const nextRequests = [...existingRequests];
  const queuedChannels: SalesChannel[] = [];
  const blockedChannels: SalesChannel[] = [];

  const bindings = params.bindings.map((binding) => {
    const requestId = requestIdFor(params.sourceEventId, binding, targetStock);
    const existingIndex = nextRequests.findIndex((request) => request.requestId === requestId);
    const autoSyncEnabled = binding.isAutoSyncEnabled === true;

    const request: CrossChannelInventorySyncRequest = {
      requestId,
      sourceEventId: normalize(params.sourceEventId),
      sku: normalize(params.sku),
      targetChannel: binding.channel,
      sellerAccountId: normalize(binding.sellerAccountId),
      channelListingId: normalize(binding.channelListingId),
      targetStock,
      triggerChannel: params.triggerChannel,
      triggerOrderId: params.triggerOrderId ? normalize(params.triggerOrderId) : undefined,
      reason: params.reason,
      status: autoSyncEnabled ? 'QUEUED' : 'BLOCKED',
      createdAt: now,
      errorMessage: autoSyncEnabled
        ? undefined
        : 'この販売先は自動在庫同期が無効です。手動更新が完了するまで二重販売リスクとして扱います。',
      externalWritePerformed: false
    };

    if (existingIndex >= 0) nextRequests[existingIndex] = request;
    else nextRequests.push(request);

    if (autoSyncEnabled) queuedChannels.push(binding.channel);
    else blockedChannels.push(binding.channel);

    return {
      ...binding,
      // syncedStock and lastSyncedAt deliberately remain unchanged until the external marketplace confirms the write.
      syncStatus: autoSyncEnabled ? 'PENDING' as const : 'OVERSELLING_RISK' as const,
      lastErrorMessage: autoSyncEnabled ? undefined : request.errorMessage
    };
  });

  saveCrossChannelInventorySyncRequests(nextRequests);

  return {
    bindings,
    requests: nextRequests,
    queuedChannels: uniqueChannels(queuedChannels),
    blockedChannels: uniqueChannels(blockedChannels)
  };
}

export function recordCrossChannelInventorySyncAttempt(
  requestId: string,
  result: { success: boolean; externalWritePerformed: boolean; errorMessage?: string; completedAt?: string },
  requests: CrossChannelInventorySyncRequest[] = loadCrossChannelInventorySyncRequests()
): { success: boolean; request?: CrossChannelInventorySyncRequest; messageJa: string } {
  const index = requests.findIndex((request) => request.requestId === requestId);
  if (index < 0) {
    return { success: false, messageJa: '対象の在庫同期要求が見つかりません。' };
  }

  const current = requests[index];
  if (current.status === 'BLOCKED') {
    return { success: false, request: current, messageJa: '自動同期無効のため、この同期要求は実行できません。' };
  }

  const completedAt = result.completedAt && Number.isFinite(Date.parse(result.completedAt))
    ? new Date(result.completedAt).toISOString()
    : new Date().toISOString();

  const updated: CrossChannelInventorySyncRequest = {
    ...current,
    attemptedAt: completedAt,
    completedAt,
    status: result.success && result.externalWritePerformed ? 'SUCCEEDED' : 'FAILED',
    externalWritePerformed: result.externalWritePerformed,
    errorMessage: result.success && result.externalWritePerformed
      ? undefined
      : normalize(result.errorMessage || '外部Marketplaceへの在庫反映を確認できませんでした。')
  };

  const next = [...requests];
  next[index] = updated;
  saveCrossChannelInventorySyncRequests(next);

  return {
    success: updated.status === 'SUCCEEDED',
    request: updated,
    messageJa: updated.status === 'SUCCEEDED'
      ? `${updated.targetChannel} の在庫 ${updated.targetStock} 点への反映成功を記録しました。`
      : `${updated.targetChannel} の外部在庫反映を確認できないため、同期失敗として記録しました。`
  };
}
