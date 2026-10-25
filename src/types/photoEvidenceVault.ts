/**
 * Data Models & Interfaces for Photo Evidence Vault & Permanent Storage (JTH-STEP 34)
 *
 * Designed to ensure full traceability, immutability of raw captured evidence,
 * and fail-safe recovery across browser sessions and cold PC restarts.
 *
 * Core Principles:
 * 1. Raw captured photos (originalAsset) are STRICTLY IMMUTABLE.
 * 2. Derivatives (corrected, thumbnails) are explicitly decoupled from originals.
 * 3. Every asset and record carries a cryptographic checksum (SHA-256).
 * 4. Composite key (${sku}::${inventoryUnitId}) isolates individual unit records.
 * 5. Strict boundary: In-memory stash is NOT considered "COMMITTED_PERSISTED".
 */

import type { PhotoAngle, PhotoQaResult } from './photoCapture';

/**
 * Immutable Raw Photo Asset (原本画像)
 * Once captured, this asset must never be mutated, cropped, or overwritten.
 */
export interface ImmutableRawPhotoAsset {
  assetId: string;
  angle: PhotoAngle;
  capturedAt: string;         // ISO-8601 timestamp
  sha256Checksum: string;     // Cryptographic hash of the raw image dataUrl
  byteSize: number;           // Estimated payload size in bytes
  mimeType: string;           // e.g. 'image/jpeg', 'image/png', 'image/svg+xml'
  widthPx?: number;
  heightPx?: number;
  dataUrl: string;            // Raw image payload
  isImmutable: true;          // Compile-time immutability flag
}

/**
 * Derivative Working Asset (補正後画像・出品候補)
 */
export interface DerivativeWorkingAsset {
  assetId: string;
  sourceOriginalAssetId: string;
  angle: PhotoAngle;
  generatedAt: string;
  sha256Checksum: string;
  byteSize: number;
  autoFixAppliedCount: number;
  dataUrl: string;
}

/**
 * Lightweight Thumbnail Asset (高速一覧表示用)
 */
export interface ThumbnailAsset {
  dataUrl: string;
  byteSize: number;
  widthPx: number;
  heightPx: number;
}

/**
 * Per-Angle Photo Evidence Entry
 */
export interface PhotoEvidenceEntry {
  angle: PhotoAngle;
  originalAsset: ImmutableRawPhotoAsset;
  workingAsset: DerivativeWorkingAsset | null;
  thumbnailAsset: ThumbnailAsset | null;
  qaSnapshot: PhotoQaResult;
  evaluatedAt: string;
  qaRuleVersion: string;
}

/**
 * Evidence Record Persistence Status
 */
export type EvidencePersistenceStatus =
  | 'DRAFT_STAGED'            // 一時退避（メモリStash）中。ディスク未書き込み
  | 'COMMITTED_PERSISTED'     // 永続化ストレージへの書き込み完了・検証済み
  | 'HOLD_UNCONFIRMED_ID'     // SKU/Unit IDが未確定のため永続化保留
  | 'HOLD_CORRUPTED_CHECKSUM' // チェックサム不一致・データ破損検知による保留
  | 'HOLD_CROSS_POLLUTION'    // 異なる個体の写真混入検知による保留
  | 'HOLD_VERSION_MISMATCH'   // スキーマ/ストレージバージョン非互換による保留
  | 'FAILED_DISK_FULL'        // 容量不足エラー
  | 'FAILED_WRITE_ERROR';     // I/O書込失敗エラー

/**
 * Complete Photo Evidence Vault Record (1出品個体分の永続保存レコード)
 */
export interface PhotoEvidenceVaultRecord {
  recordId: string;           // EVD-${sku}-${inventoryUnitId}
  storageVersion: number;     // e.g. 1
  sku: string;
  inventoryUnitId: string;
  itemTitle?: string;
  sessionId: string;
  operatorId?: string;
  status: EvidencePersistenceStatus;
  createdAt: string;
  committedAt?: string;
  lastVerifiedAt?: string;
  photos: Partial<Record<PhotoAngle, PhotoEvidenceEntry>>;
  totalPhotoCount: number;
  usablePhotoCount: number;
  totalByteSize: number;
  recordChecksum: string;     // SHA-256 over all asset hashes + metadata
  auditTrail: Array<{
    timestamp: string;
    action: string;
    reason: string;
    operator?: string;
  }>;
}

/**
 * Summary representation for list views and fast search
 */
export interface PhotoEvidenceVaultSummary {
  recordId: string;
  sku: string;
  inventoryUnitId: string;
  itemTitle?: string;
  status: EvidencePersistenceStatus;
  totalPhotoCount: number;
  usablePhotoCount: number;
  totalByteSize: number;
  committedAt?: string;
  recordChecksum: string;
}

/**
 * Persistence Operation Result
 */
export interface PersistenceSaveResult {
  success: boolean;
  status: EvidencePersistenceStatus;
  recordId?: string;
  recordChecksum?: string;
  committedBytes?: number;
  messageJa: string;
  error?: string;
}

export interface PersistenceLoadResult {
  success: boolean;
  status: EvidencePersistenceStatus;
  record?: PhotoEvidenceVaultRecord;
  messageJa: string;
  error?: string;
}

export interface IntegrityCheckResult {
  isValid: boolean;
  checkedRecordId: string;
  expectedChecksum: string;
  computedChecksum: string;
  mismatchedAngles: PhotoAngle[];
  messageJa: string;
}

/**
 * Abstract Persistence Adapter Interface
 * Enables interchangeable backends (IndexedDB, Windows Local FS, Simulated In-Memory)
 */
export interface IPhotoEvidencePersistenceAdapter {
  saveRecord(record: PhotoEvidenceVaultRecord): Promise<PersistenceSaveResult>;
  loadRecord(sku: string, inventoryUnitId: string): Promise<PersistenceLoadResult>;
  listSummaries(): Promise<PhotoEvidenceVaultSummary[]>;
  deleteRecord(sku: string, inventoryUnitId: string): Promise<boolean>;
  verifyIntegrity(sku: string, inventoryUnitId: string): Promise<IntegrityCheckResult>;
  getStorageMetrics(): Promise<{
    usedBytes: number;
    recordCount: number;
    backendType: 'MOCK_IN_MEMORY' | 'INDEXED_DB' | 'WINDOWS_LOCAL_FS';
  }>;
}

/**
 * Failure Injection Configuration for testing reliability
 */
export interface FailureInjectionConfig {
  simulateDiskFull?: boolean;
  simulateWriteError?: boolean;
  simulateCorruptionOnRead?: boolean;
  simulateCorruptedChecksum?: boolean;
  simulateMidwayAbort?: boolean;
  maxCapacityBytes?: number;
}
