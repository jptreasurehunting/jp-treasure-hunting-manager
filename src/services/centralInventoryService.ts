import {
  CentralInventoryItem,
  InventoryReservation,
  InventorySyncEvent,
  ReconciliationSummary
} from '../types/centralInventory';
import { SalesChannel } from '../types/shippingRouter';
import { registerHealthCheckModule } from './projectHealthService';
import { HealthCheckModulePlugin } from '../types/projectHealth';
import {
  loadCrossChannelInventorySyncRequests,
  queueCrossChannelInventorySync,
  recordCrossChannelInventorySyncAttempt
} from './crossChannelInventorySyncService';

const INVENTORY_STORAGE_KEY = 'zonos_central_inventory_ssot_v1';
const RESERVATIONS_STORAGE_KEY = 'zonos_inventory_reservations_v1';
const SYNC_EVENTS_STORAGE_KEY = 'zonos_inventory_sync_events_v1';
const PROCESSED_EVENT_IDS_KEY = 'zonos_processed_inventory_event_ids_v1';

function uniqueChannels(channels: SalesChannel[]): SalesChannel[] {
  return Array.from(new Set(channels));
}

export function getDefaultCentralInventory(): CentralInventoryItem[] {
  return [
    {
      sku: 'SKU-WATCH-STRAP-01',
      itemTitle: 'イタリアンレザー 交換用時計ベルト 20mm (ブラウン)',
      physicalStock: 8,
      reservedStock: 2,
      availableToSell: 6,
      safetyBuffer: 0,
      unitCostJpy: 1200,
      weightGrams: 45,
      dimensionsCm: { length: 15.0, width: 8.0, height: 1.0 },
      category: 'Watch Accessories',
      channelBindings: [
        {
          channel: 'eBay',
          sellerAccountId: 'jp_treasure_main',
          channelListingId: 'ebay_item_1101',
          syncedStock: 6,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
          isAutoSyncEnabled: true
        },
        {
          channel: 'Shopee',
          sellerAccountId: 'shopee_sg_01',
          channelListingId: 'shopee_item_sg_2201',
          syncedStock: 6,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
          isAutoSyncEnabled: true
        },
        {
          channel: 'Shopify',
          sellerAccountId: 'shopify_primary',
          channelListingId: 'shopify_prod_3301',
          syncedStock: 6,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
          isAutoSyncEnabled: true
        }
      ],
      lastReconciledAt: new Date().toISOString(),
      isLockedForOversellingRisk: false
    },
    {
      sku: 'SKU-VINTAGE-SEIKO-01',
      itemTitle: 'セイコー 5 自動巻き ヴィンテージ 腕時計 7S26',
      physicalStock: 1,
      reservedStock: 0,
      availableToSell: 1,
      safetyBuffer: 0,
      unitCostJpy: 8500,
      weightGrams: 140,
      dimensionsCm: { length: 12.0, width: 10.0, height: 6.0 },
      category: 'Watches',
      channelBindings: [
        {
          channel: 'eBay',
          sellerAccountId: 'jp_treasure_main',
          channelListingId: 'ebay_item_1102',
          syncedStock: 1,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
          isAutoSyncEnabled: true
        },
        {
          channel: 'Shopee',
          sellerAccountId: 'shopee_sg_01',
          channelListingId: 'shopee_item_sg_2202',
          syncedStock: 1,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
          isAutoSyncEnabled: true
        }
      ],
      lastReconciledAt: new Date().toISOString(),
      isLockedForOversellingRisk: false
    },
    {
      sku: 'SKU-CAMERA-LENS-01',
      itemTitle: 'キヤノン EF 50mm F1.8 STM 単焦点レンズ',
      physicalStock: 3,
      reservedStock: 1,
      availableToSell: 2,
      safetyBuffer: 0,
      unitCostJpy: 9800,
      weightGrams: 280,
      dimensionsCm: { length: 14.0, width: 14.0, height: 10.0 },
      category: 'Camera Lenses',
      channelBindings: [
        {
          channel: 'eBay',
          sellerAccountId: 'jp_treasure_main',
          channelListingId: 'ebay_item_1103',
          syncedStock: 2,
          syncStatus: 'SYNCED',
          lastSyncedAt: new Date().toISOString(),
          isAutoSyncEnabled: true
        }
      ],
      lastReconciledAt: new Date().toISOString(),
      isLockedForOversellingRisk: false
    }
  ];
}

export function loadCentralInventory(): CentralInventoryItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!raw) {
      const def = getDefaultCentralInventory();
      saveCentralInventory(def);
      return def;
    }
    return JSON.parse(raw);
  } catch {
    return getDefaultCentralInventory();
  }
}

export function saveCentralInventory(items: CentralInventoryItem[]): void {
  try {
    localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to save central inventory:', e);
  }
}

export function loadInventoryReservations(): InventoryReservation[] {
  try {
    const raw = localStorage.getItem(RESERVATIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveInventoryReservations(reservations: InventoryReservation[]): void {
  try {
    localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
  } catch (e) {
    console.error('Failed to save inventory reservations:', e);
  }
}

export function loadSyncEvents(): InventorySyncEvent[] {
  try {
    const raw = localStorage.getItem(SYNC_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveSyncEvents(events: InventorySyncEvent[]): void {
  try {
    localStorage.setItem(SYNC_EVENTS_STORAGE_KEY, JSON.stringify(events.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save sync events:', e);
  }
}

function isEventAlreadyProcessed(eventId: string): boolean {
  try {
    const raw = localStorage.getItem(PROCESSED_EVENT_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    return ids.includes(eventId);
  } catch {
    return false;
  }
}

function markEventProcessed(eventId: string): void {
  try {
    const raw = localStorage.getItem(PROCESSED_EVENT_IDS_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    ids.push(eventId);
    localStorage.setItem(PROCESSED_EVENT_IDS_KEY, JSON.stringify(ids.slice(-200)));
  } catch (e) {
    console.error('Failed to mark event processed:', e);
  }
}

/**
 * Reserve inventory immediately when an order is detected.
 * Central ATS changes first; external marketplaces are then queued for absolute-stock synchronization.
 * A channel is NOT marked SYNCED until its external write is explicitly confirmed.
 */
export function reserveInventory(
  sku: string,
  quantity: number,
  channel: SalesChannel,
  orderId: string,
  sellerAccountId = 'default',
  eventId?: string
): {
  success: boolean;
  reservationId?: string;
  isOversellingRisk: boolean;
  updatedAvailableToSell: number;
  messageJa: string;
} {
  const currentEventId = eventId || `evt_res_${sku}_${orderId}_${Date.now()}`;
  if (isEventAlreadyProcessed(currentEventId)) {
    const current = loadCentralInventory().find((item) => item.sku === sku);
    return {
      success: true,
      isOversellingRisk: Boolean(current?.isLockedForOversellingRisk),
      updatedAvailableToSell: current?.availableToSell ?? 0,
      messageJa: '🔄 重複イベントを検知し、安全にスキップしました (Idempotent Replay Protected)'
    };
  }

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return {
      success: false,
      isOversellingRisk: true,
      updatedAvailableToSell: 0,
      messageJa: '❌ 在庫引当数量は1以上の整数で指定してください。'
    };
  }

  const items = loadCentralInventory();
  const itemIndex = items.findIndex((item) => item.sku === sku);
  if (itemIndex === -1) {
    return {
      success: false,
      isOversellingRisk: true,
      updatedAvailableToSell: 0,
      messageJa: `❌ SKU [${sku}] が中央在庫データベースに存在しません。`
    };
  }

  const item = items[itemIndex];
  const beforeATS = item.availableToSell;
  const beforePhysical = item.physicalStock;

  if (item.availableToSell < quantity) {
    item.isLockedForOversellingRisk = true;
    item.oversellingRiskReason = 'INSUFFICIENT_ATS';
    items[itemIndex] = item;
    saveCentralInventory(items);
    return {
      success: false,
      isOversellingRisk: true,
      updatedAvailableToSell: item.availableToSell,
      messageJa: `⛔ [二重販売リスク検知] SKU [${sku}] の販売可能数 (${item.availableToSell}) が要求数量 (${quantity}) 未満です。自動処理を停止し要確認へ隔離しました。`
    };
  }

  item.reservedStock += quantity;
  item.availableToSell = Math.max(0, item.physicalStock - item.reservedStock - item.safetyBuffer);

  const reservationId = `res_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reservation: InventoryReservation = {
    reservationId,
    sku,
    quantity,
    channel,
    sellerAccountId,
    orderId,
    status: 'ACTIVE',
    reservedAt: new Date().toISOString()
  };
  const reservations = loadInventoryReservations();
  reservations.push(reservation);
  saveInventoryReservations(reservations);

  const syncPlan = queueCrossChannelInventorySync({
    sourceEventId: currentEventId,
    sku,
    targetStock: item.availableToSell,
    triggerChannel: channel,
    triggerOrderId: orderId,
    reason: 'SALE_RESERVATION',
    bindings: item.channelBindings
  });
  item.channelBindings = syncPlan.bindings;

  if (syncPlan.blockedChannels.length > 0) {
    item.isLockedForOversellingRisk = true;
    item.oversellingRiskReason = 'AUTO_SYNC_DISABLED';
  }

  items[itemIndex] = item;
  saveCentralInventory(items);
  markEventProcessed(currentEventId);

  const syncEvent: InventorySyncEvent = {
    eventId: currentEventId,
    sku,
    eventType: 'RESERVATION_CREATED',
    triggerChannel: channel,
    triggerOrderId: orderId,
    quantityDelta: -quantity,
    beforePhysicalStock: beforePhysical,
    afterPhysicalStock: item.physicalStock,
    beforeAvailableToSell: beforeATS,
    afterAvailableToSell: item.availableToSell,
    syncedChannels: [],
    pendingChannels: syncPlan.queuedChannels,
    failedChannels: [],
    blockedChannels: syncPlan.blockedChannels,
    isIdempotentReplay: false,
    timestamp: new Date().toISOString()
  };
  const events = loadSyncEvents();
  events.unshift(syncEvent);
  saveSyncEvents(events);

  const queueMessage = syncPlan.queuedChannels.length > 0
    ? `外部在庫同期要求: ${syncPlan.queuedChannels.join(' / ')} は同期待ち`
    : '外部在庫同期対象なし';
  const blockedMessage = syncPlan.blockedChannels.length > 0
    ? ` / 自動同期無効: ${syncPlan.blockedChannels.join(' / ')} は要手動確認`
    : '';

  return {
    success: true,
    reservationId,
    isOversellingRisk: syncPlan.blockedChannels.length > 0,
    updatedAvailableToSell: item.availableToSell,
    messageJa: `✅ [在庫引当成功] SKU [${sku}] を${quantity}点引当。残り販売可能数: ${item.availableToSell}点。${queueMessage}${blockedMessage}。外部反映成功までは同期完了扱いにしません。`
  };
}

/** Commit sold physical stock when shipment is finalized. */
export function commitSoldInventory(reservationId: string): { success: boolean; messageJa: string } {
  const reservations = loadInventoryReservations();
  const res = reservations.find((reservation) => reservation.reservationId === reservationId);
  if (!res || res.status !== 'ACTIVE') {
    return { success: false, messageJa: '有効な引当予約が見つかりません。' };
  }

  const items = loadCentralInventory();
  const item = items.find((candidate) => candidate.sku === res.sku);
  if (!item) return { success: false, messageJa: `SKU [${res.sku}] が見つかりません。` };

  item.physicalStock = Math.max(0, item.physicalStock - res.quantity);
  item.reservedStock = Math.max(0, item.reservedStock - res.quantity);
  item.availableToSell = Math.max(0, item.physicalStock - item.reservedStock - item.safetyBuffer);
  res.status = 'COMMITTED_SOLD';
  res.committedAt = new Date().toISOString();

  saveCentralInventory(items);
  saveInventoryReservations(reservations);
  return {
    success: true,
    messageJa: `✅ 実在庫を${res.quantity}点減算し、販売確定を完了しました。(実在庫: ${item.physicalStock})`
  };
}

/** Release reservation after cancellation/refund and queue external restock if saleable again. */
export function releaseReservation(reservationId: string, isRestockable = true): { success: boolean; messageJa: string } {
  const reservations = loadInventoryReservations();
  const res = reservations.find((reservation) => reservation.reservationId === reservationId);
  if (!res || res.status !== 'ACTIVE') {
    return { success: false, messageJa: '有効な引当予約が見つかりません。' };
  }

  const items = loadCentralInventory();
  const itemIndex = items.findIndex((candidate) => candidate.sku === res.sku);
  if (itemIndex < 0) return { success: false, messageJa: `SKU [${res.sku}] が見つかりません。` };

  const item = items[itemIndex];
  const beforeATS = item.availableToSell;
  const beforePhysical = item.physicalStock;
  item.reservedStock = Math.max(0, item.reservedStock - res.quantity);

  let queuedChannels: SalesChannel[] = [];
  let blockedChannels: SalesChannel[] = [];
  if (isRestockable) {
    item.availableToSell = Math.max(0, item.physicalStock - item.reservedStock - item.safetyBuffer);
    const sourceEventId = `evt_release_${reservationId}_${Date.now()}`;
    const syncPlan = queueCrossChannelInventorySync({
      sourceEventId,
      sku: item.sku,
      targetStock: item.availableToSell,
      triggerChannel: res.channel,
      triggerOrderId: res.orderId,
      reason: 'CANCELLATION_RESTOCK',
      bindings: item.channelBindings
    });
    item.channelBindings = syncPlan.bindings;
    queuedChannels = syncPlan.queuedChannels;
    blockedChannels = syncPlan.blockedChannels;
    if (blockedChannels.length > 0) {
      item.isLockedForOversellingRisk = true;
      item.oversellingRiskReason = 'AUTO_SYNC_DISABLED';
    }

    const event: InventorySyncEvent = {
      eventId: sourceEventId,
      sku: item.sku,
      eventType: 'RESERVATION_RELEASED',
      triggerChannel: res.channel,
      triggerOrderId: res.orderId,
      quantityDelta: res.quantity,
      beforePhysicalStock: beforePhysical,
      afterPhysicalStock: item.physicalStock,
      beforeAvailableToSell: beforeATS,
      afterAvailableToSell: item.availableToSell,
      syncedChannels: [],
      pendingChannels: queuedChannels,
      failedChannels: [],
      blockedChannels,
      isIdempotentReplay: false,
      timestamp: new Date().toISOString()
    };
    const events = loadSyncEvents();
    events.unshift(event);
    saveSyncEvents(events);
  }

  res.status = 'RELEASED_CANCELLED';
  res.releasedAt = new Date().toISOString();
  items[itemIndex] = item;
  saveCentralInventory(items);
  saveInventoryReservations(reservations);

  const syncMessage = isRestockable
    ? ` 外部販売先への在庫復元は${queuedChannels.length > 0 ? '同期待ち' : '対象なし'}${blockedChannels.length > 0 ? '（自動同期無効チャネルあり）' : ''}です。`
    : '';
  return {
    success: true,
    messageJa: `✅ 注文キャンセルに伴い、${res.quantity}点の在庫引当を解除しました。(ATS: ${item.availableToSell})${syncMessage}`
  };
}

/**
 * Record the result from a real marketplace inventory adapter.
 * Only a confirmed external write updates syncedStock/lastSyncedAt.
 */
export function recordExternalChannelInventorySyncResult(
  requestId: string,
  result: { success: boolean; externalWritePerformed: boolean; errorMessage?: string; completedAt?: string }
): { success: boolean; messageJa: string } {
  const existingRequest = loadCrossChannelInventorySyncRequests().find((request) => request.requestId === requestId);
  if (!existingRequest) return { success: false, messageJa: '対象の外部在庫同期要求が見つかりません。' };

  const recorded = recordCrossChannelInventorySyncAttempt(requestId, result);
  if (!recorded.request) return { success: false, messageJa: recorded.messageJa };

  const request = recorded.request;
  const items = loadCentralInventory();
  const itemIndex = items.findIndex((item) => item.sku === request.sku);
  if (itemIndex < 0) return { success: false, messageJa: `SKU [${request.sku}] が中央在庫に見つかりません。` };

  const item = items[itemIndex];
  const binding = item.channelBindings.find((candidate) =>
    candidate.channel === request.targetChannel &&
    candidate.sellerAccountId === request.sellerAccountId &&
    candidate.channelListingId === request.channelListingId
  );
  if (!binding) return { success: false, messageJa: '対象の販売先在庫Bindingが見つかりません。' };

  if (recorded.success && request.externalWritePerformed) {
    binding.syncedStock = request.targetStock;
    binding.syncStatus = request.targetStock === 0 ? 'PAUSED' : 'SYNCED';
    binding.lastSyncedAt = request.completedAt || new Date().toISOString();
    delete binding.lastErrorMessage;

    const remainingRisk = item.channelBindings.some((candidate) =>
      candidate.syncStatus === 'FAILED' || candidate.syncStatus === 'OVERSELLING_RISK'
    );
    if (!remainingRisk && (
      item.oversellingRiskReason === 'EXTERNAL_SYNC_FAILURE' ||
      item.oversellingRiskReason === 'AUTO_SYNC_DISABLED'
    )) {
      item.isLockedForOversellingRisk = false;
      delete item.oversellingRiskReason;
    }
  } else {
    binding.syncStatus = 'FAILED';
    binding.lastErrorMessage = request.errorMessage || '外部Marketplaceへの在庫反映を確認できませんでした。';
    item.isLockedForOversellingRisk = true;
    item.oversellingRiskReason = 'EXTERNAL_SYNC_FAILURE';
  }

  items[itemIndex] = item;
  saveCentralInventory(items);

  const events = loadSyncEvents();
  const event = events.find((candidate) => candidate.eventId === request.sourceEventId);
  if (event) {
    event.pendingChannels = (event.pendingChannels || []).filter((channel) => channel !== request.targetChannel);
    if (recorded.success) {
      event.syncedChannels = uniqueChannels([...event.syncedChannels, request.targetChannel]);
    } else {
      event.failedChannels = uniqueChannels([...event.failedChannels, request.targetChannel]);
    }
    saveSyncEvents(events);
  }

  return { success: recorded.success, messageJa: recorded.messageJa };
}

/** Detect discrepancies and queue external correction instead of pretending the site was changed. */
export function reconcileCentralInventory(): ReconciliationSummary {
  const items = loadCentralInventory();
  const discrepancies: ReconciliationSummary['discrepancies'] = [];
  let syncedCount = 0;
  const reconciliationId = `rec_${Date.now()}`;
  const now = new Date().toISOString();

  items.forEach((item) => {
    item.channelBindings = item.channelBindings.map((binding) => {
      const externallyConfirmed =
        binding.syncedStock === item.availableToSell &&
        (binding.syncStatus === 'SYNCED' || binding.syncStatus === 'PAUSED');
      if (externallyConfirmed) {
        syncedCount += 1;
        return binding;
      }

      const sourceEventId = `${reconciliationId}_${item.sku}_${binding.channel}_${binding.sellerAccountId}`;
      const syncPlan = queueCrossChannelInventorySync({
        sourceEventId,
        sku: item.sku,
        targetStock: item.availableToSell,
        triggerChannel: binding.channel,
        reason: 'RECONCILIATION',
        bindings: [binding],
        now
      });
      const updatedBinding = syncPlan.bindings[0];
      discrepancies.push({
        sku: item.sku,
        channel: binding.channel,
        centralStock: item.availableToSell,
        channelStock: binding.syncedStock,
        actionTakenJa: syncPlan.blockedChannels.length > 0
          ? `中央在庫 ${item.availableToSell} 点との差異を検知。自動同期無効のため要手動確認`
          : `中央在庫 ${item.availableToSell} 点への外部同期要求を作成（反映確認待ち）`
      });
      if (syncPlan.blockedChannels.length > 0) {
        item.isLockedForOversellingRisk = true;
        item.oversellingRiskReason = 'AUTO_SYNC_DISABLED';
      }
      return updatedBinding;
    });
    item.lastReconciledAt = now;
  });

  saveCentralInventory(items);
  return {
    reconciliationId,
    timestamp: now,
    totalSkusChecked: items.length,
    syncedSkusCount: syncedCount,
    discrepancyCount: discrepancies.length,
    discrepancies
  };
}

/** Project Health Plugin */
export function initCentralInventoryHealthModule(): void {
  registerHealthCheckModule({
    moduleId: 'module_central_inventory_sync',
    moduleName: '中央在庫同期 ＆ 二重販売防止エンジン (Single Source of Truth)',
    category: 'future_module',
    defaultAuthorityLevel: 'admin_approved',
    defaultVerificationMethod: 'unsupported_live',
    checkHealth: () => {
      const items = loadCentralInventory();
      const lockedItems = items.filter((item) => item.isLockedForOversellingRisk);
      const pendingBindings = items.flatMap((item) => item.channelBindings).filter((binding) => binding.syncStatus === 'PENDING');
      const failedBindings = items.flatMap((item) => item.channelBindings).filter((binding) => binding.syncStatus === 'FAILED' || binding.syncStatus === 'OVERSELLING_RISK');
      const isWarning = lockedItems.length > 0 || pendingBindings.length > 0 || failedBindings.length > 0;

      return {
        id: 'module_central_inventory_sync',
        name: 'Central Multi-Channel Inventory Sync',
        category: 'future_module',
        status: isWarning ? 'needs_check' : 'healthy',
        statusLabel: isWarning ? '🟡 要確認' : '✅ 中央在庫正常',
        isLiveVerified: false,
        liveVerificationNote: '中央在庫・同期キューは稼働中。外部Marketplace反映は各APIアダプターの成功確認が必要です。',
        lastVerifiedAt: new Date().toISOString(),
        authorityLevel: 'admin_approved',
        authorityLevelLabel: 'B. 管理者承認済み在庫運用ルール',
        verificationMethod: 'unsupported_live',
        verificationMethodLabel: '外部販売先のライブ反映はアダプター接続待ち',
        sourceName: 'Central Inventory Engine v1.1',
        freshness: '中央在庫は即時 / 外部反映は成功確認まで保留',
        isCriticalWarning: lockedItems.length > 0 || failedBindings.length > 0,
        shortOneLineReason: isWarning
          ? `中央在庫リスク: ロック ${lockedItems.length}件 / 同期待ち ${pendingBindings.length}件 / 失敗・要確認 ${failedBindings.length}件`
          : `中央在庫は整合。外部販売先は最後に確認済みの在庫値を保持しています。`,
        details: {
          exactRestriction: '販売発生時は中央ATSを即時引当し、eBay / Shopee等へ絶対在庫数の同期要求を発行。外部成功確認前はSYNCEDにしない。',
          source: 'Central SSOT Inventory Service + Cross-Channel Sync Queue',
          ruleVersion: 'Ver. 1.1',
          recommendedCorrectiveAction: isWarning ? 'PENDING/FAILEDの販売先同期要求を確認してください。' : '特になし'
        }
      };
    }
  });
}
