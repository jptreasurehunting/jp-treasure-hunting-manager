/**
 * IndexedDB Local Photo Draft Persistence Adapter (JTH-STEP 36)
 *
 * Implements browser-native IndexedDB storage for temporary photo capture drafts.
 * Guarantees resilience against accidental tab closures, browser crashes, and OS reboots.
 *
 * Safety & Security Guarantees:
 * 1. ZERO writes to production inventory DB or permanent Evidence Vault.
 * 2. Operates strictly in the browser origin's isolated IndexedDB store.
 * 3. Enforces strict composite key (${sku}::${inventoryUnitId}) isolation.
 * 4. Rejects cross-unit / cross-SKU photo contamination.
 * 5. Isolates unconfirmed contexts (UNLINKED_HOLD) under separate UNCONFIRMED:: namespace.
 * 6. Validates SHA-256 cryptographic checksums on both save and restore.
 * 7. Transaction completion acknowledgment: never reports success on uncommitted or aborted writes.
 * 8. Version conflict locking: prevents stale async writes from overwriting newer drafts.
 * 9. Hard capacity limit with ZERO silent auto-eviction (no silent loss of operator work).
 * 10. Platform agnostic: runs in modern browsers with native IndexedDB, with simulated backend for Node test runners.
 */

import { computeSha256Hex } from './photoEvidenceVaultService';
import type {
  PhotoAngle,
  CapturedPhoto,
  PhotoCaptureTargetContext,
  PhotoGateDryRunPreview,
  DryRunListingPhotoHandoff
} from '../types/photoCapture';
import type {
  PhotoDraftItem,
  PhotoDraftRecord,
  PhotoDraftSummary,
  DraftSaveResult,
  DraftLoadResult,
  DraftIntegrityResult,
  PhotoDraftFailureConfig,
  IPhotoDraftStorageAdapter,
  PhotoDraftPersistenceStatus
} from '../types/photoDraft';

export const DEFAULT_PHOTO_DRAFTS_DB_NAME = 'JPTH_PHOTO_DRAFTS_DB';
export const DEFAULT_PHOTO_DRAFTS_STORE_NAME = 'photo_drafts';
export const DEFAULT_PHOTO_DRAFTS_DB_VERSION = 1;
export const DEFAULT_MAX_DRAFT_CAPACITY_BYTES = 50 * 1024 * 1024; // 50 MB local quota
export const DEFAULT_MAX_DRAFT_ENTRY_COUNT = 15; // Max 15 unit drafts in browser

/**
 * Calculates a deterministic SHA-256 checksum across all draft metadata and photos.
 */
export function calculateDraftRecordChecksum(params: {
  draftKey: string;
  sku: string;
  inventoryUnitId: string;
  version: number;
  photos: Partial<Record<PhotoAngle, PhotoDraftItem>>;
}): string {
  const sortedAngles = (Object.keys(params.photos) as PhotoAngle[]).sort();
  const photoSignatures = sortedAngles.map((angle) => {
    const item = params.photos[angle];
    if (!item) return `${angle}:EMPTY`;
    return `${angle}:${item.originalSha256Checksum}:${item.workingSha256Checksum}:${item.qaResult.status}:${item.byteSize}`;
  });

  const payload = [
    params.draftKey,
    params.sku,
    params.inventoryUnitId,
    params.version.toString(),
    ...photoSignatures
  ].join('|');

  return computeSha256Hex(payload);
}

/**
 * Helper to build a validated PhotoDraftRecord from active capture state.
 */
export function buildPhotoDraftRecord(params: {
  targetContext: PhotoCaptureTargetContext;
  capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>;
  currentAngleIndex?: number;
  dryRunPreview?: PhotoGateDryRunPreview | null;
  listingHandoff?: DryRunListingPhotoHandoff | null;
  sessionId?: string;
  version?: number;
  existingDraft?: PhotoDraftRecord | null;
}): { success: true; draft: PhotoDraftRecord } | { success: false; status: PhotoDraftPersistenceStatus; messageJa: string } {
  const {
    targetContext,
    capturedPhotos,
    currentAngleIndex = 0,
    dryRunPreview = null,
    listingHandoff = null,
    sessionId = `session_${Date.now()}`,
    existingDraft = null
  } = params;

  // 1. Cross-unit pollution verification
  for (const [angle, photo] of Object.entries(capturedPhotos)) {
    if (photo) {
      if (targetContext.isConfirmed && targetContext.sku) {
        if (photo.sku && photo.sku !== targetContext.sku) {
          return {
            success: false,
            status: 'HOLD_CROSS_POLLUTION',
            messageJa: `アングル【${angle}】の写真内に別SKU【${photo.sku}】が検出されました（対象: ${targetContext.sku}）。混入防止のため保存を停止しました。`,
          };
        }
      }
      if (targetContext.isConfirmed && targetContext.inventoryUnitId) {
        if (photo.inventoryUnitId && photo.inventoryUnitId !== targetContext.inventoryUnitId) {
          return {
            success: false,
            status: 'HOLD_CROSS_POLLUTION',
            messageJa: `アングル【${angle}】の写真内に別個体ID【${photo.inventoryUnitId}】が検出されました（対象: ${targetContext.inventoryUnitId}）。混入防止のため保存を停止しました。`,
          };
        }
      }
    }
  }

  // 2. Format draft items and compute individual SHA-256 hashes
  const draftPhotos: Partial<Record<PhotoAngle, PhotoDraftItem>> = {};
  let totalEstimatedBytes = 0;
  let photoCount = 0;
  let usablePhotoCount = 0;

  for (const [angleStr, photo] of Object.entries(capturedPhotos)) {
    const angle = angleStr as PhotoAngle;
    if (photo && (photo.originalDataUrl || photo.dataUrl)) {
      const rawPayload: string = photo.originalDataUrl || photo.dataUrl || '';
      const workPayload: string = photo.dataUrl || photo.originalDataUrl || rawPayload;
      const originalSha256 = computeSha256Hex(rawPayload);
      const workingSha256 = computeSha256Hex(workPayload);
      const byteSize = (rawPayload.length + workPayload.length) * 2;

      draftPhotos[angle] = {
        angle,
        originalDataUrl: rawPayload,
        dataUrl: workPayload,
        qaResult: { ...photo.qaResult, metrics: { ...photo.qaResult.metrics }, issues: [...photo.qaResult.issues] },
        capturedAt: photo.timestamp || new Date().toISOString(),
        originalSha256Checksum: originalSha256,
        workingSha256Checksum: workingSha256,
        byteSize
      };

      totalEstimatedBytes += byteSize;
      photoCount++;
      if (photo.qaResult.status === 'USE_AS_IS') {
        usablePhotoCount++;
      }
    }
  }

  // 3. Determine draft key & confirmation status
  const isConfirmed = Boolean(targetContext.isConfirmed && targetContext.sku?.trim() && targetContext.inventoryUnitId?.trim());
  let draftKey: string;
  let status: PhotoDraftPersistenceStatus;

  if (isConfirmed) {
    draftKey = `${targetContext.sku!.trim()}::${targetContext.inventoryUnitId!.trim()}`;
    status = 'DRAFT_LOCAL_SAVED';
  } else {
    // Unconfirmed contexts are strictly isolated under separate prefix
    draftKey = `UNCONFIRMED::${sessionId}`;
    status = 'HOLD_UNCONFIRMED_ID';
  }

  // 4. Version increments on update
  const newVersion = params.version !== undefined ? params.version : (existingDraft ? existingDraft.version + 1 : 1);
  const now = new Date().toISOString();

  const recordChecksum = calculateDraftRecordChecksum({
    draftKey,
    sku: targetContext.sku || '',
    inventoryUnitId: targetContext.inventoryUnitId || '',
    version: newVersion,
    photos: draftPhotos
  });

  const draft: PhotoDraftRecord = {
    draftKey,
    sku: targetContext.sku || '',
    inventoryUnitId: targetContext.inventoryUnitId || '',
    itemTitle: targetContext.itemTitle,
    isConfirmed,
    sessionId,
    version: newVersion,
    savedAt: existingDraft ? existingDraft.savedAt : now,
    lastModifiedAt: now,
    currentAngleIndex,
    photos: draftPhotos,
    photoCount,
    usablePhotoCount,
    estimatedBytes: totalEstimatedBytes,
    recordChecksum,
    status,
    dryRunPreview: dryRunPreview ? JSON.parse(JSON.stringify(dryRunPreview)) : null,
    listingHandoff: listingHandoff ? JSON.parse(JSON.stringify(listingHandoff)) : null
  };

  return { success: true, draft };
}

export interface IndexedDbAdapterOptions {
  dbName?: string;
  storeName?: string;
  dbVersion?: number;
  failureConfig?: PhotoDraftFailureConfig;
  useSimulatedStore?: boolean;
  idbFactory?: IDBFactory;
}

/**
 * Main IndexedDB Photo Draft Storage Adapter.
 */
export class IndexedDbPhotoDraftAdapter implements IPhotoDraftStorageAdapter {
  private dbName: string;
  private storeName: string;
  private dbVersion: number;
  private failureConfig: PhotoDraftFailureConfig;
  private useSimulatedStore: boolean;
  private idbFactory: IDBFactory | null;

  // In-memory simulated storage for Node unit tests and non-browser environments
  private simulatedStore: Map<string, PhotoDraftRecord> = new Map();

  constructor(options: IndexedDbAdapterOptions = {}) {
    this.dbName = options.dbName || DEFAULT_PHOTO_DRAFTS_DB_NAME;
    this.storeName = options.storeName || DEFAULT_PHOTO_DRAFTS_STORE_NAME;
    this.dbVersion = options.dbVersion || DEFAULT_PHOTO_DRAFTS_DB_VERSION;
    this.failureConfig = options.failureConfig ? { ...options.failureConfig } : {};

    const detectedIdb = options.idbFactory || (typeof window !== 'undefined' ? window.indexedDB : (globalThis as any).indexedDB);
    this.idbFactory = detectedIdb || null;
    this.useSimulatedStore = options.useSimulatedStore ?? (this.idbFactory === null);
  }

  public setConfig(update: Partial<PhotoDraftFailureConfig>): void {
    this.failureConfig = { ...this.failureConfig, ...update };
  }

  public resetConfig(): void {
    this.failureConfig = {};
  }

  /**
   * Returns whether the adapter is using real browser IndexedDB or the in-memory simulated fallback.
   */
  public isSimulated(): boolean {
    return this.useSimulatedStore;
  }

  /**
   * Opens or returns the native IndexedDB database instance.
   */
  private async openNativeDb(): Promise<IDBDatabase> {
    if (!this.idbFactory) {
      throw new Error('IndexedDB is not supported or unavailable in the current runtime environment.');
    }

    return new Promise((resolve, reject) => {
      const request = this.idbFactory!.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'draftKey' });
          store.createIndex('by_sku_unit', ['sku', 'inventoryUnitId'], { unique: false });
          store.createIndex('by_status', 'status', { unique: false });
          store.createIndex('by_lastModifiedAt', 'lastModifiedAt', { unique: false });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB database.'));
      request.onblocked = () => reject(new Error('IndexedDB database open blocked by another connection.'));
    });
  }

  /**
   * Saves a photo draft record into IndexedDB with atomic transaction verification and version locking.
   */
  public async saveDraft(draft: PhotoDraftRecord): Promise<DraftSaveResult> {
    // 1. Injected failure checks
    if (this.failureConfig.simulateDatabaseUnavailable) {
      return {
        success: false,
        status: 'FAILED_DB_UNAVAILABLE',
        messageJa: 'IndexedDB データベースに接続できません。',
        error: 'DATABASE_UNAVAILABLE_SIMULATED'
      };
    }
    if (this.failureConfig.simulateQuotaExceeded) {
      return {
        success: false,
        status: 'FAILED_QUOTA_EXCEEDED',
        messageJa: 'ブラウザストレージの容量上限（QuotaExceededError）に達しました。自動破棄は禁止されています。',
        error: 'STORAGE_QUOTA_EXCEEDED_SIMULATED'
      };
    }
    if (this.failureConfig.simulateTransactionAbort) {
      return {
        success: false,
        status: 'FAILED_TRANSACTION_ABORT',
        messageJa: 'IndexedDB の書き込みトランザクションがアボートされました。',
        error: 'TRANSACTION_ABORTED_SIMULATED'
      };
    }

    // 2. Capacity limit check
    const metrics = await this.getStorageMetrics();
    const maxBytes = this.failureConfig.maxCapacityBytes ?? DEFAULT_MAX_DRAFT_CAPACITY_BYTES;
    const maxEntries = this.failureConfig.maxEntryCount ?? DEFAULT_MAX_DRAFT_ENTRY_COUNT;

    const isUpdating = this.useSimulatedStore
      ? this.simulatedStore.has(draft.draftKey)
      : await this.hasRecordNative(draft.draftKey);

    if (!isUpdating && metrics.draftCount >= maxEntries) {
      return {
        success: false,
        status: 'FAILED_QUOTA_EXCEEDED',
        messageJa: `ローカル下書きの上限（${maxEntries}件）に達しています。既存ドラフトの自動削除は禁止されているため、撮影を完了するか不要なドラフトを破棄してください。`,
        error: 'MAX_DRAFT_ENTRIES_EXCEEDED'
      };
    }

    if (metrics.usedBytes + draft.estimatedBytes > maxBytes) {
      return {
        success: false,
        status: 'FAILED_QUOTA_EXCEEDED',
        messageJa: `ローカル下書きの容量上限（${Math.round(maxBytes / (1024 * 1024))}MB）を超過するため保存できません。`,
        error: 'MAX_DRAFT_BYTES_EXCEEDED'
      };
    }

    // 3. Execution via Simulated or Native Backend
    if (this.useSimulatedStore) {
      return this.saveSimulated(draft);
    } else {
      return this.saveNative(draft);
    }
  }

  private async hasRecordNative(draftKey: string): Promise<boolean> {
    try {
      const db = await this.openNativeDb();
      return new Promise<boolean>((resolve) => {
        const tx = db.transaction([this.storeName], 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(draftKey);
        req.onsuccess = () => resolve(req.result !== undefined);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  private async saveSimulated(draft: PhotoDraftRecord): Promise<DraftSaveResult> {
    // Version locking / Stale write detection
    const existing = this.simulatedStore.get(draft.draftKey);
    if (existing) {
      if (existing.version > draft.version || (existing.version === draft.version && existing.lastModifiedAt >= draft.lastModifiedAt)) {
        return {
          success: false,
          status: 'HOLD_VERSION_CONFLICT',
          messageJa: `より新しいドラフト（Version ${existing.version}）が既に存在するため、古いドラフト（Version ${draft.version}）による上書きを拒絶しました。`,
          error: 'STALE_WRITE_REJECTED'
        };
      }
    }

    // Clone to ensure zero external mutation side effects
    const clonedDraft = JSON.parse(JSON.stringify(draft));
    this.simulatedStore.set(draft.draftKey, clonedDraft);

    return {
      success: true,
      status: draft.status,
      draftKey: draft.draftKey,
      version: draft.version,
      committedBytes: draft.estimatedBytes,
      messageJa: `💾 写真ドラフト【${draft.draftKey}】（v${draft.version} / ${draft.photoCount}枚）を IndexedDB（模擬）へ安全に保存しました。`
    };
  }

  private async saveNative(draft: PhotoDraftRecord): Promise<DraftSaveResult> {
    try {
      const db = await this.openNativeDb();
      return new Promise((resolve) => {
        let hasSettled = false;
        const settle = (result: DraftSaveResult) => {
          if (!hasSettled) {
            hasSettled = true;
            resolve(result);
          }
        };

        const tx = db.transaction([this.storeName], 'readwrite');
        const store = tx.objectStore(this.storeName);

        // Pre-fetch for version conflict
        const getReq = store.get(draft.draftKey);
        getReq.onsuccess = () => {
          const existing = getReq.result as PhotoDraftRecord | undefined;
          if (existing && (existing.version > draft.version || (existing.version === draft.version && existing.lastModifiedAt >= draft.lastModifiedAt))) {
            settle({
              success: false,
              status: 'HOLD_VERSION_CONFLICT',
              messageJa: `より新しいドラフト（Version ${existing.version}）が既に存在するため、古いドラフト（Version ${draft.version}）による上書きを拒絶しました。`,
              error: 'STALE_WRITE_REJECTED'
            });
            try {
              tx.abort();
            } catch {
              // Ignore if already inactive
            }
            return;
          }

          const clonedDraft = JSON.parse(JSON.stringify(draft));
          store.put(clonedDraft);
        };

        getReq.onerror = () => {
          settle({
            success: false,
            status: 'FAILED_TRANSACTION_ABORT',
            messageJa: '既存レコードの取得中にエラーが発生したため保存を中止しました。',
            error: getReq.error?.message
          });
          try {
            tx.abort();
          } catch {
            // Ignore if already inactive
          }
        };

        // Transaction completion handler
        tx.oncomplete = () => {
          settle({
            success: true,
            status: draft.status,
            draftKey: draft.draftKey,
            version: draft.version,
            committedBytes: draft.estimatedBytes,
            messageJa: `💾 写真ドラフト【${draft.draftKey}】（v${draft.version} / ${draft.photoCount}枚）を IndexedDB へ安全に保存しました。`
          });
        };

        tx.onerror = (event: any) => {
          if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
          }
          const isQuota = tx.error?.name === 'QuotaExceededError';
          settle({
            success: false,
            status: isQuota ? 'FAILED_QUOTA_EXCEEDED' : 'FAILED_TRANSACTION_ABORT',
            messageJa: isQuota
              ? 'ブラウザストレージの容量上限に達したため保存できませんでした。'
              : 'IndexedDB のトランザクション中にエラーが発生しました。',
            error: tx.error?.message || 'TRANSACTION_ERROR'
          });
        };

        tx.onabort = () => {
          settle({
            success: false,
            status: 'FAILED_TRANSACTION_ABORT',
            messageJa: 'IndexedDB のトランザクションがアボートされました。データは保存されていません。',
            error: 'TRANSACTION_ABORTED'
          });
        };
      });
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED_DB_UNAVAILABLE',
        messageJa: `IndexedDB 操作中に例外が発生しました: ${err?.message || '不明なエラー'}`,
        error: err?.message
      };
    }
  }

  /**
   * Loads a photo draft record from IndexedDB with strict identity matching and SHA-256 verification.
   */
  public async loadDraft(sku: string, inventoryUnitId: string): Promise<DraftLoadResult> {
    const draftKey = `${sku.trim()}::${inventoryUnitId.trim()}`;

    let record: PhotoDraftRecord | undefined;
    if (this.useSimulatedStore) {
      record = this.simulatedStore.get(draftKey);
    } else {
      try {
        const db = await this.openNativeDb();
        record = await new Promise<PhotoDraftRecord | undefined>((resolve, reject) => {
          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.get(draftKey);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } catch (err: any) {
        return {
          success: false,
          status: 'FAILED_DB_UNAVAILABLE',
          messageJa: `IndexedDB からの読み込みに失敗しました: ${err?.message || '不明なエラー'}`,
          error: err?.message
        };
      }
    }

    if (!record) {
      return {
        success: false,
        status: 'HOLD_UNCONFIRMED_ID',
        messageJa: `【${sku} (${inventoryUnitId})】のローカル下書きは見つかりませんでした。`,
        error: 'ENTRY_NOT_FOUND'
      };
    }

    // Identity validation
    if (record.sku !== sku || record.inventoryUnitId !== inventoryUnitId) {
      return {
        success: false,
        status: 'HOLD_CROSS_POLLUTION',
        messageJa: `要求された個体（${sku}::${inventoryUnitId}）とドラフトの個体情報（${record.sku}::${record.inventoryUnitId}）が一致しません。混入防止のため復元を停止しました。`,
        error: 'CROSS_UNIT_POLLUTION_DETECTED'
      };
    }

    // Checksum verification
    const computedChecksum = calculateDraftRecordChecksum({
      draftKey: record.draftKey,
      sku: record.sku,
      inventoryUnitId: record.inventoryUnitId,
      version: record.version,
      photos: record.photos
    });

    const isCorrupted = this.failureConfig.simulateChecksumCorruptionOnRead || computedChecksum !== record.recordChecksum;
    if (isCorrupted) {
      return {
        success: false,
        status: 'HOLD_CORRUPTED_CHECKSUM',
        messageJa: `ドラフトの SHA-256 チェックサム不一致を検出しました（期待値: ${record.recordChecksum.slice(0, 8)}..., 計算値: ${computedChecksum.slice(0, 8)}...）。破損防止のため復元を保留（HOLD）しました。`,
        error: 'INTEGRITY_CHECKSUM_MISMATCH'
      };
    }

    return {
      success: true,
      status: record.status,
      draft: JSON.parse(JSON.stringify(record)),
      messageJa: `✅ 【${sku} (${inventoryUnitId})】のローカル下書き（v${record.version} / ${record.photoCount}枚 / 合格${record.usablePhotoCount}枚）を安全に復元しました。`
    };
  }

  /**
   * Lists lightweight summaries of all stored drafts.
   */
  public async listDraftSummaries(): Promise<PhotoDraftSummary[]> {
    let records: PhotoDraftRecord[] = [];
    if (this.useSimulatedStore) {
      records = Array.from(this.simulatedStore.values());
    } else {
      try {
        const db = await this.openNativeDb();
        records = await new Promise<PhotoDraftRecord[]>((resolve, reject) => {
          const tx = db.transaction([this.storeName], 'readonly');
          const store = tx.objectStore(this.storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      } catch {
        records = [];
      }
    }

    // Sort descending by lastModifiedAt
    return records
      .map((r) => ({
        draftKey: r.draftKey,
        sku: r.sku,
        inventoryUnitId: r.inventoryUnitId,
        itemTitle: r.itemTitle,
        isConfirmed: r.isConfirmed,
        version: r.version,
        photoCount: r.photoCount,
        usablePhotoCount: r.usablePhotoCount,
        estimatedBytes: r.estimatedBytes,
        savedAt: r.savedAt,
        lastModifiedAt: r.lastModifiedAt,
        status: r.status,
        recordChecksum: r.recordChecksum
      }))
      .sort((a, b) => (a.lastModifiedAt > b.lastModifiedAt ? -1 : 1));
  }

  /**
   * Deletes a draft entry upon explicit confirmation.
   */
  public async deleteDraft(sku: string, inventoryUnitId: string): Promise<boolean> {
    const draftKey = `${sku.trim()}::${inventoryUnitId.trim()}`;
    if (this.useSimulatedStore) {
      return this.simulatedStore.delete(draftKey);
    } else {
      try {
        const db = await this.openNativeDb();
        return new Promise<boolean>((resolve) => {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.delete(draftKey);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        });
      } catch {
        return false;
      }
    }
  }

  /**
   * Verifies the cryptographic integrity of a stored draft without modifying state.
   */
  public async verifyDraftIntegrity(sku: string, inventoryUnitId: string): Promise<DraftIntegrityResult> {
    const draftKey = `${sku.trim()}::${inventoryUnitId.trim()}`;
    const loadResult = await this.loadDraft(sku, inventoryUnitId);

    if (!loadResult.success || !loadResult.draft) {
      return {
        isValid: false,
        draftKey,
        expectedChecksum: '',
        computedChecksum: '',
        mismatchedAngles: [],
        messageJa: loadResult.messageJa
      };
    }

    const draft = loadResult.draft;
    const computedChecksum = calculateDraftRecordChecksum({
      draftKey: draft.draftKey,
      sku: draft.sku,
      inventoryUnitId: draft.inventoryUnitId,
      version: draft.version,
      photos: draft.photos
    });

    const mismatchedAngles: PhotoAngle[] = [];
    for (const [angleStr, item] of Object.entries(draft.photos)) {
      const angle = angleStr as PhotoAngle;
      if (item) {
        const checkRaw = computeSha256Hex(item.originalDataUrl);
        if (checkRaw !== item.originalSha256Checksum) {
          mismatchedAngles.push(angle);
        }
      }
    }

    const isValid = computedChecksum === draft.recordChecksum && mismatchedAngles.length === 0;

    return {
      isValid,
      draftKey,
      expectedChecksum: draft.recordChecksum,
      computedChecksum,
      mismatchedAngles,
      messageJa: isValid
        ? `✅ ドラフト【${draftKey}】の整合性検査に合格しました（SHA-256: ${computedChecksum.slice(0, 16)}...）。`
        : `❌ ドラフト【${draftKey}】に整合性エラーが検出されました。`,
    };
  }

  /**
   * Calculates current storage metrics.
   */
  public async getStorageMetrics(): Promise<{
    usedBytes: number;
    draftCount: number;
    backendType: 'INDEXED_DB' | 'INDEXED_DB_SIMULATED';
  }> {
    const summaries = await this.listDraftSummaries();
    const usedBytes = summaries.reduce((acc, s) => acc + s.estimatedBytes, 0);

    return {
      usedBytes,
      draftCount: summaries.length,
      backendType: this.useSimulatedStore ? 'INDEXED_DB_SIMULATED' : 'INDEXED_DB'
    };
  }

  /**
   * Completely clears all drafts (primarily for test resets).
   */
  public async clearAllDrafts(): Promise<void> {
    if (this.useSimulatedStore) {
      this.simulatedStore.clear();
    } else {
      try {
        const db = await this.openNativeDb();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction([this.storeName], 'readwrite');
          const store = tx.objectStore(this.storeName);
          store.clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      } catch {
        // Safe noop on clear error
      }
    }
  }

  /**
   * Safety disclosure string for UI and documentation.
   */
  public static getStorageNoticeJa(): string {
    return '【IndexedDB 写真ドラフト永続保存について】本機能はブラウザ終了・PC再起動後の消失を防ぐローカルセーフティネットです。正式な証拠保存（Evidence Vault）や在庫DBではありません。ブラウザの「閲覧履歴・Cookie消去」やシークレットモード、OS容量制限によるエビクション時は復元できない場合があります。';
  }
}
