/**
 * Types & Contracts for Formal Evidence Vault Transport & Promotion Lifecycle (JTH-STEP 49)
 *
 * Defines:
 * 1. Provider-agnostic Evidence Vault Transport interface (IEvidenceVaultTransport)
 * 2. Strict 11-State Promotion Lifecycle State Machine
 * 3. Idempotency, Session Management, and Replay Protection Contracts
 * 4. Timeout / Unknown Outcome Safety State and Reconciliation Protocol
 * 5. Non-Destructive Invariant Specifications (Zero silent eviction / deletion on failure)
 * 6. Explicit Security & Tamper-Proofing Disclosure (Limits of SHA-256 vs Independent Server Audit Logs)
 */

import type { PhotoAngle, PhotoCaptureTargetContext, PhotoQaResult } from './photoCapture';
import type { PhotoDraftRecord, PhotoDraftItem } from './photoDraft';
import type { PhotoEvidenceVaultRecord, EvidencePersistenceStatus } from './photoEvidenceVault';

/**
 * Strict Promotion Lifecycle States (Requirement 5 & 9)
 */
export type FormalPromotionState =
  | 'DRAFT_LOCAL_SAVED'           // 1. ローカルIndexedDB/模擬ドラフト保存済み
  | 'PROMOTION_REVIEW_REQUIRED'   // 2. 昇格レビュー待機（未承認・コンテキスト未確認）
  | 'PROMOTION_APPROVED'          // 3. 人間オペレーターによる明示的な昇格承認済み
  | 'UPLOAD_PENDING'              // 4. セッション初期化完了・アセットアップロード待機
  | 'UPLOADING'                   // 5. 個別写真バイナリ送信中
  | 'VERIFYING'                   // 6. サーバー側原本全件SHA-256・メタデータ照合中
  | 'COMMIT_PENDING'              // 7. アトミックコミット前待機
  | 'COMMITTED_PERSISTED'         // 8. 正式Evidence Vault永続確定（照会確認済み）
  | 'FAILED_RETRYABLE'            // 9. 一時的ネットワーク/I/O失敗（安全なリトライ可能）
  | 'HOLD_REVIEW_REQUIRED'        // 10. 致命的エラー/不整合（人間介入保留・原本保全）
  | 'HOLD_UNKNOWN_TIMEOUT';       // 11. タイムアウト直後（合否不明・照会確認必須）

/**
 * Vault Destination Storage Domain
 */
export type TargetVaultDomain =
  | 'SIMULATED_TEST_VAULT'        // テスト専用インメモリ模擬保管庫
  | 'LOCAL_SECONDARY_VAULT'       // ローカル別ボリューム隔離保管庫（設計用）
  | 'CENTRAL_IMMUTABLE_WORM_VAULT';// 中央集約型WORM保管庫（本番将来設計）

/**
 * Authentication and Operator Context
 * Note: Contains interface definitions only. No hardcoded production credentials.
 */
export interface VaultOperatorAuthContext {
  operatorId: string;
  operatorRole?: string;
  authTokenPreview?: string;      // 模擬/プレビュー用トークン（本番秘密鍵は含めない）
  workstationMachineId?: string;
  inspectionLocation?: string;
}

/**
 * Session Initiation Request (Phase 1)
 */
export interface VaultPromotionInitiateRequest {
  idempotencyKey: string;         // 冪等キー: `IDEMP-${sku}-${inventoryUnitId}-v${version}-${sessionId}`
  sku: string;
  inventoryUnitId: string;
  itemTitle?: string;
  draftVersion: number;
  expectedPhotoCount: number;
  expectedTotalBytes: number;
  expectedAngles: PhotoAngle[];
  draftRecordChecksum: string;
  targetVaultDomain: TargetVaultDomain;
  authContext: VaultOperatorAuthContext;
  operatorApproval: boolean;
  approvalTimestamp: string;
}

export interface VaultPromotionSessionResponse {
  success: boolean;
  sessionId: string;
  idempotencyKey: string;
  state: FormalPromotionState;
  targetVaultDomain: TargetVaultDomain;
  allocatedExpiresAt: string;
  messageJa: string;
  isExistingReplay?: boolean;     // 既存の同一キー要求に対する再応答かどうか
  existingCommittedRecordId?: string;
  error?: string;
}

/**
 * Individual Asset Upload Request (Phase 2)
 */
export interface VaultAssetUploadRequest {
  sessionId: string;
  idempotencyKey: string;
  angle: PhotoAngle;
  assetId: string;
  isImmutableRaw: boolean;
  mimeType: string;
  sha256Checksum: string;
  byteSize: number;
  payloadDataUrl: string;
}

export interface VaultAssetUploadResponse {
  success: boolean;
  sessionId: string;
  assetId: string;
  angle: PhotoAngle;
  state: FormalPromotionState;
  receivedBytes: number;
  serverCalculatedSha256: string;
  checksumMatches: boolean;
  isRetryable: boolean;
  messageJa: string;
  error?: string;
}

/**
 * Server-side Verification Request (Phase 3)
 */
export interface VaultVerifyRequest {
  sessionId: string;
  idempotencyKey: string;
  expectedTotalAssets: number;
  expectedTotalBytes: number;
  manifestSha256: string;
}

export interface VaultVerifyResponse {
  success: boolean;
  sessionId: string;
  state: FormalPromotionState;
  verifiedAssetCount: number;
  verifiedTotalBytes: number;
  allChecksumsMatch: boolean;
  mismatchedAngles?: PhotoAngle[];
  quarantinedAssets?: string[];
  messageJa: string;
  error?: string;
}

/**
 * Atomic Commit Request (Phase 4)
 */
export interface VaultCommitRequest {
  sessionId: string;
  idempotencyKey: string;
  operatorApproval: boolean;
  approvalTimestamp: string;
  clientAuditId: string;
  commitSignatureNote?: string;
}

export interface VaultCommitResponse {
  success: boolean;
  sessionId: string;
  state: FormalPromotionState;
  committedRecordId?: string;
  committedAt?: string;
  retainedPredecessorVersion?: number | null;
  serverRecordChecksum?: string;
  auditReceiptId?: string;
  isQueryable: boolean;           // 照会APIで確認可能な状態になったかどうか
  messageJa: string;
  error?: string;
}

/**
 * Status Query Request (Phase 5 & Timeout Reconciliation)
 */
export interface VaultStatusQueryRequest {
  idempotencyKey: string;
  sessionId?: string;
  sku?: string;
  inventoryUnitId?: string;
  version?: number;
}

export interface VaultStatusQueryResponse {
  isFound: boolean;
  sessionId?: string;
  idempotencyKey: string;
  state: FormalPromotionState;
  sku?: string;
  inventoryUnitId?: string;
  version?: number;
  isCommittedAndPersisted: boolean;
  committedRecordId?: string;
  committedRecord?: PhotoEvidenceVaultRecord;
  uploadedAngles?: PhotoAngle[];
  lastError?: string;
  lastUpdatedAt: string;
  messageJa: string;
}

/**
 * Safe Retry Request
 */
export interface VaultRetryRequest {
  sessionId: string;
  idempotencyKey: string;
  targetFailedState: FormalPromotionState;
  retryAttemptCount: number;
}

export interface VaultRetryResponse {
  success: boolean;
  sessionId: string;
  nextAllowedState: FormalPromotionState;
  recommendedBackoffMs: number;
  messageJa: string;
  error?: string;
}

/**
 * Explicit Abort Request
 */
export interface VaultAbortRequest {
  sessionId: string;
  idempotencyKey: string;
  reasonJa: string;
  preserveQuarantineFiles: boolean; // 原本や不整合ファイルは破棄せず隔離保持
}

export interface VaultAbortResponse {
  success: boolean;
  sessionId: string;
  state: 'HOLD_REVIEW_REQUIRED';
  quarantinedCount: number;
  messageJa: string;
}

/**
 * Failure Injection Configuration for Mock Transport Testing
 */
export interface VaultFailureInjectionConfig {
  simulateTimeoutOnInit?: boolean;
  simulateTimeoutOnUpload?: boolean;
  simulateTimeoutOnCommit?: boolean;
  simulateChecksumMismatch?: boolean;
  simulateServerCommitError?: boolean;
  simulateNetworkDrop?: boolean;
  simulateIdempotencyConflict?: boolean;
  simulateQuotaExceeded?: boolean;
  timeoutDurationMs?: number;
  maxPayloadBytes?: number;
}

/**
 * Provider-Agnostic Evidence Vault Transport Interface (Requirement 4)
 */
export interface IEvidenceVaultTransport {
  initiateSession(req: VaultPromotionInitiateRequest): Promise<VaultPromotionSessionResponse>;
  uploadAsset(req: VaultAssetUploadRequest): Promise<VaultAssetUploadResponse>;
  verifyUploadIntegrity(req: VaultVerifyRequest): Promise<VaultVerifyResponse>;
  commitPromotion(req: VaultCommitRequest): Promise<VaultCommitResponse>;
  queryPromotionStatus(req: VaultStatusQueryRequest): Promise<VaultStatusQueryResponse>;
  retrySafeStep(req: VaultRetryRequest): Promise<VaultRetryResponse>;
  abortSession(req: VaultAbortRequest): Promise<VaultAbortResponse>;
  getTransportDiagnostics(): {
    providerName: string;
    isSimulated: boolean;
    activeSessionCount: number;
    committedRecordCount: number;
  };
}

/**
 * Promotion Execution Options for Coordinator
 */
export interface PromotionExecutionOptions {
  operatorApproval: boolean;
  authContext: VaultOperatorAuthContext;
  targetVaultDomain?: TargetVaultDomain;
  maxRetries?: number;
  baseBackoffMs?: number;
  abortOnFirstError?: boolean;
}

/**
 * High-Level Promotion Result returned by Coordinator
 */
export interface EvidenceVaultPromotionResult {
  success: boolean;
  state: FormalPromotionState;
  committedRecordId?: string;
  vaultRecord?: PhotoEvidenceVaultRecord;
  idempotencyKey: string;
  sessionId?: string;
  retainedPredecessorVersion?: number | null;
  uploadedAssetCount: number;
  auditTrailId?: string;
  isQueryConfirmed: boolean;
  quarantinedFiles: string[];
  messageJa: string;
  error?: string;
}
