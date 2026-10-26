/**
 * Data Models & Interfaces for Local Photo Draft Persistence (JTH-STEP 36)
 *
 * Dedicated to client-side local draft persistence in IndexedDB.
 * Completely decoupled from formal permanent Evidence Vault records.
 *
 * Safety Principles:
 * 1. Operates strictly within browser-local storage (IndexedDB).
 * 2. Immutable raw photos: originalDataUrl is stored bit-for-bit without generative mutation.
 * 3. Composite key (${sku}::${inventoryUnitId}) isolates distinct product units.
 * 4. Version locking prevents race-condition overwriting by stale asynchronous writes.
 * 5. Explicit SHA-256 checksum verification on both save and restore.
 * 6. Zero auto-purge: Storage limits reject saves rather than silently evicting older drafts.
 * 7. Clear disclosure: Local draft is a crash-resilience buffer, NOT an Evidence Vault.
 */

import type {
  PhotoAngle,
  PhotoQaResult,
  PhotoCaptureTargetContext,
  PhotoGateDryRunPreview,
  DryRunListingPhotoHandoff
} from './photoCapture';

export interface PhotoDraftItem {
  angle: PhotoAngle;
  originalDataUrl: string;        // 原本画像（不可逆・不変 Base64）
  dataUrl: string;                // 補正後画像 Base64
  qaResult: PhotoQaResult;        // QA検査結果
  capturedAt: string;             // 撮影日時 ISO-8601
  originalSha256Checksum: string; // 原本画像の SHA-256 チェックサム
  workingSha256Checksum: string;  // 補正画像の SHA-256 チェックサム
  byteSize: number;               // 推定バイト数
}

export type PhotoDraftPersistenceStatus =
  | 'DRAFT_LOCAL_SAVED'           // IndexedDB への正常保存完了
  | 'HOLD_UNCONFIRMED_ID'         // SKU/Unit ID 未確定のため隔離領域に保持
  | 'HOLD_CORRUPTED_CHECKSUM'     // チェックサム不一致・データ破損検知
  | 'HOLD_CROSS_POLLUTION'        // 異なる個体の写真混入検知による拒絶
  | 'HOLD_VERSION_CONFLICT'       // 古いドラフトによる順序逆転上書きの防止
  | 'FAILED_QUOTA_EXCEEDED'       // ブラウザストレージ容量不足
  | 'FAILED_TRANSACTION_ABORT'    // トランザクション中断・I/O失敗
  | 'FAILED_DB_UNAVAILABLE';      // IndexedDB が利用不可

export interface PhotoDraftRecord {
  draftKey: string;               // 複合キー: `${sku}::${inventoryUnitId}` または未確定用 `UNCONFIRMED::${sessionId}`
  sku: string;
  inventoryUnitId: string;
  itemTitle?: string;
  isConfirmed: boolean;           // 確定済み個体かどうか
  sessionId: string;              // 作業セッションID
  version: number;                // 世代番号（順序逆転上書き防止・楽観ロック）
  savedAt: string;                // 初回作成日時 ISO-8601
  lastModifiedAt: string;         // 最終更新日時 ISO-8601
  currentAngleIndex: number;      // 撮影再開用のアングルインデックス
  photos: Partial<Record<PhotoAngle, PhotoDraftItem>>;
  photoCount: number;             // 撮影済み枚数
  usablePhotoCount: number;       // 合格（USE_AS_IS）枚数
  estimatedBytes: number;         // 推定総バイト数
  recordChecksum: string;         // メタデータ＋全写真ハッシュの統合 SHA-256 チェックサム
  status: PhotoDraftPersistenceStatus;
  dryRunPreview?: PhotoGateDryRunPreview | null;
  listingHandoff?: DryRunListingPhotoHandoff | null;
}

export interface PhotoDraftSummary {
  draftKey: string;
  sku: string;
  inventoryUnitId: string;
  itemTitle?: string;
  isConfirmed: boolean;
  version: number;
  photoCount: number;
  usablePhotoCount: number;
  estimatedBytes: number;
  savedAt: string;
  lastModifiedAt: string;
  status: PhotoDraftPersistenceStatus;
  recordChecksum: string;
}

export interface DraftSaveResult {
  success: boolean;
  status: PhotoDraftPersistenceStatus;
  draftKey?: string;
  version?: number;
  committedBytes?: number;
  messageJa: string;
  error?: string;
}

export interface DraftLoadResult {
  success: boolean;
  status: PhotoDraftPersistenceStatus;
  draft?: PhotoDraftRecord;
  messageJa: string;
  error?: string;
}

export interface DraftIntegrityResult {
  isValid: boolean;
  draftKey: string;
  expectedChecksum: string;
  computedChecksum: string;
  mismatchedAngles: PhotoAngle[];
  messageJa: string;
}

export interface PhotoDraftFailureConfig {
  simulateQuotaExceeded?: boolean;
  simulateTransactionAbort?: boolean;
  simulateDatabaseUnavailable?: boolean;
  simulateChecksumCorruptionOnRead?: boolean;
  maxCapacityBytes?: number;
  maxEntryCount?: number;
}

export interface IPhotoDraftStorageAdapter {
  saveDraft(draft: PhotoDraftRecord): Promise<DraftSaveResult>;
  loadDraft(sku: string, inventoryUnitId: string): Promise<DraftLoadResult>;
  listDraftSummaries(): Promise<PhotoDraftSummary[]>;
  deleteDraft(sku: string, inventoryUnitId: string): Promise<boolean>;
  verifyDraftIntegrity(sku: string, inventoryUnitId: string): Promise<DraftIntegrityResult>;
  getStorageMetrics(): Promise<{
    usedBytes: number;
    draftCount: number;
    backendType: 'INDEXED_DB' | 'INDEXED_DB_SIMULATED';
  }>;
  clearAllDrafts(): Promise<void>;
}
