/**
 * Evidence Vault Transport & Promotion Coordinator Service (JTH-STEP 49)
 *
 * Implements:
 * 1. Provider-Agnostic Transport Interface (IEvidenceVaultTransport)
 * 2. Deterministic In-Memory Simulated Transport (MockEvidenceVaultTransport)
 * 3. Client-Side Promotion State Machine Coordinator (EvidenceVaultPromotionCoordinator)
 * 4. Idempotency Key & Replay Conflict Detection
 * 5. Network Timeout / Unknown Outcome (HOLD_UNKNOWN_TIMEOUT) Reconciliation Protocol
 * 6. Non-Destructive Invariant: Zero silent deletion of drafts, old generations, or raw assets on failure
 * 7. Verified COMMITTED_PERSISTED Invariant: Must be queryable and confirmed by server receipt
 */

import { computeSha256Hex } from './photoEvidenceVaultService';
import type { PhotoAngle, PhotoCaptureTargetContext } from '../types/photoCapture';
import type { PhotoDraftRecord, PhotoDraftItem } from '../types/photoDraft';
import type {
  PhotoEvidenceVaultRecord,
  PhotoEvidenceEntry,
  EvidencePersistenceStatus
} from '../types/photoEvidenceVault';
import type {
  FormalPromotionState,
  TargetVaultDomain,
  VaultOperatorAuthContext,
  VaultPromotionInitiateRequest,
  VaultPromotionSessionResponse,
  VaultAssetUploadRequest,
  VaultAssetUploadResponse,
  VaultVerifyRequest,
  VaultVerifyResponse,
  VaultCommitRequest,
  VaultCommitResponse,
  VaultStatusQueryRequest,
  VaultStatusQueryResponse,
  VaultRetryRequest,
  VaultRetryResponse,
  VaultAbortRequest,
  VaultAbortResponse,
  VaultFailureInjectionConfig,
  IEvidenceVaultTransport,
  PromotionExecutionOptions,
  EvidenceVaultPromotionResult
} from '../types/evidenceVaultTransport';

/**
 * Statutory / Security Disclaimer regarding cryptographic limitations (Requirement 12)
 */
export const TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA =
  '【重要・改ざん耐性の設計的限界】SHA-256チェックサムは原本のビット腐敗や通信破損の検知に極めて有効ですが、' +
  '攻撃者が写真とチェックサムの双方を書き換え可能な環境に対する改ざん耐性を単独で保証するものではありません。' +
  '完全な原本不変性の担保には、サーバー側の独立監査ログ、WORM（Write Once Read Many）オブジェクトロック、' +
  'OS・クラウド権限分離、およびデジタル署名が不可欠です（本ステップでは接続契約と模擬検証基盤のみ実装され、本番物理WORM保管庫は未実装です）。';

/**
 * Builds standard idempotency key
 */
export function buildIdempotencyKey(sku: string, unitId: string, version: number, sessionId: string): string {
  return `IDEMP-${sku}-${unitId}-v${version}-${sessionId}`;
}

/**
 * Japanese display labels for lifecycle states
 */
export function getFormalPromotionStateLabel(state: FormalPromotionState): string {
  switch (state) {
    case 'DRAFT_LOCAL_SAVED':
      return '1. ローカルドラフト保存済み';
    case 'PROMOTION_REVIEW_REQUIRED':
      return '2. 昇格レビュー待機（未承認）';
    case 'PROMOTION_APPROVED':
      return '3. オペレーター昇格承認済み';
    case 'UPLOAD_PENDING':
      return '4. 保管セッション開始・送信待機';
    case 'UPLOADING':
      return '5. 原本バイナリ送信中';
    case 'VERIFYING':
      return '6. サーバー側原本SHA-256照合中';
    case 'COMMIT_PENDING':
      return '7. 正式コミット待機';
    case 'COMMITTED_PERSISTED':
      return '8. 正式Evidence Vault永続確定（照会済）';
    case 'FAILED_RETRYABLE':
      return '9. 一時的通信エラー（安全に再試行可能）';
    case 'HOLD_REVIEW_REQUIRED':
      return '10. 整合性エラー保留（原本保全・人間介入要）';
    case 'HOLD_UNKNOWN_TIMEOUT':
      return '11. タイムアウト直後（合否不明・照会必須）';
    default:
      return state;
  }
}

interface MockSessionData {
  sessionId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  sku: string;
  inventoryUnitId: string;
  itemTitle?: string;
  version: number;
  expectedPhotoCount: number;
  expectedTotalBytes: number;
  expectedAngles: PhotoAngle[];
  draftRecordChecksum: string;
  targetVaultDomain: TargetVaultDomain;
  authContext: VaultOperatorAuthContext;
  operatorApproval: boolean;
  state: FormalPromotionState;
  createdAt: string;
  uploadedAssets: Map<PhotoAngle, {
    assetId: string;
    payloadDataUrl: string;
    sha256Checksum: string;
    byteSize: number;
    mimeType: string;
    isImmutableRaw: boolean;
  }>;
  quarantinedAssets: string[];
  committedRecordId?: string;
}

/**
 * Deterministic In-Memory Simulated Evidence Vault Transport (Requirement 13)
 */
export class MockEvidenceVaultTransport implements IEvidenceVaultTransport {
  private sessions = new Map<string, MockSessionData>();
  private idempotencyIndex = new Map<string, { sessionId: string; requestFingerprint: string; committedRecordId?: string }>();
  private committedRecords = new Map<string, PhotoEvidenceVaultRecord>();
  private failureConfig: VaultFailureInjectionConfig;

  constructor(failureConfig: VaultFailureInjectionConfig = {}) {
    this.failureConfig = { ...failureConfig };
  }

  public setFailureConfig(config: Partial<VaultFailureInjectionConfig>): void {
    this.failureConfig = { ...this.failureConfig, ...config };
  }

  public async initiateSession(req: VaultPromotionInitiateRequest): Promise<VaultPromotionSessionResponse> {
    // 1. Failure injection checks
    if (this.failureConfig.simulateNetworkDrop) {
      throw new Error('NETWORK_DROP: Connection dropped before session initiation');
    }
    if (this.failureConfig.simulateTimeoutOnInit) {
      throw new Error('TIMEOUT: Session initiation timed out');
    }
    if (this.failureConfig.simulateQuotaExceeded) {
      return {
        success: false,
        sessionId: '',
        idempotencyKey: req.idempotencyKey,
        state: 'HOLD_REVIEW_REQUIRED',
        targetVaultDomain: req.targetVaultDomain,
        allocatedExpiresAt: '',
        messageJa: '❌ サーバー側容量不足のため保管庫セッションを開始できません。',
        error: 'STORAGE_QUOTA_EXCEEDED'
      };
    }

    // Fingerprint request payload to detect duplicate replay vs conflicting key misuse
    const requestFingerprint = computeSha256Hex(
      `${req.sku}::${req.inventoryUnitId}::v${req.draftVersion}::${req.expectedPhotoCount}::${req.draftRecordChecksum}`
    );

    // 2. Check Idempotency Key
    const existingIndex = this.idempotencyIndex.get(req.idempotencyKey);
    if (existingIndex) {
      // Replay of exact same request
      if (existingIndex.requestFingerprint === requestFingerprint) {
        const existingSession = this.sessions.get(existingIndex.sessionId);
        return {
          success: true,
          sessionId: existingIndex.sessionId,
          idempotencyKey: req.idempotencyKey,
          state: existingSession?.state || 'COMMITTED_PERSISTED',
          targetVaultDomain: req.targetVaultDomain,
          allocatedExpiresAt: new Date(Date.now() + 3600000).toISOString(),
          isExistingReplay: true,
          existingCommittedRecordId: existingIndex.committedRecordId,
          messageJa: 'ℹ️ 同一の冪等キーによる登録済みセッションを検出しました。重複登録を防ぎ既存セッションを返却します。'
        };
      } else {
        // Conflicting request using identical idempotency key with different payload
        return {
          success: false,
          sessionId: '',
          idempotencyKey: req.idempotencyKey,
          state: 'HOLD_REVIEW_REQUIRED',
          targetVaultDomain: req.targetVaultDomain,
          allocatedExpiresAt: '',
          messageJa: '❌ 同一冪等キーに対して異なる内容の要求が送信されました（冪等性コンフリクト）。',
          error: 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH'
        };
      }
    }

    // 3. New Session Allocation
    const sessionId = `VSESS-${req.sku}-${req.inventoryUnitId}-${Date.now()}`;
    const newSession: MockSessionData = {
      sessionId,
      idempotencyKey: req.idempotencyKey,
      requestFingerprint,
      sku: req.sku,
      inventoryUnitId: req.inventoryUnitId,
      itemTitle: req.itemTitle,
      version: req.draftVersion,
      expectedPhotoCount: req.expectedPhotoCount,
      expectedTotalBytes: req.expectedTotalBytes,
      expectedAngles: req.expectedAngles,
      draftRecordChecksum: req.draftRecordChecksum,
      targetVaultDomain: req.targetVaultDomain,
      authContext: req.authContext,
      operatorApproval: req.operatorApproval,
      state: 'UPLOAD_PENDING',
      createdAt: new Date().toISOString(),
      uploadedAssets: new Map(),
      quarantinedAssets: []
    };

    this.sessions.set(sessionId, newSession);
    this.idempotencyIndex.set(req.idempotencyKey, { sessionId, requestFingerprint });

    return {
      success: true,
      sessionId,
      idempotencyKey: req.idempotencyKey,
      state: 'UPLOAD_PENDING',
      targetVaultDomain: req.targetVaultDomain,
      allocatedExpiresAt: new Date(Date.now() + 3600000).toISOString(),
      messageJa: `✅ 正式Evidence Vault保管セッションを開始しました【${sessionId}】。`
    };
  }

  public async uploadAsset(req: VaultAssetUploadRequest): Promise<VaultAssetUploadResponse> {
    const session = this.sessions.get(req.sessionId);
    if (!session) {
      return {
        success: false,
        sessionId: req.sessionId,
        assetId: req.assetId,
        angle: req.angle,
        state: 'HOLD_REVIEW_REQUIRED',
        receivedBytes: 0,
        serverCalculatedSha256: '',
        checksumMatches: false,
        isRetryable: false,
        messageJa: '❌ 保管セッションが存在しません。',
        error: 'SESSION_NOT_FOUND'
      };
    }

    if (this.failureConfig.simulateTimeoutOnUpload) {
      throw new Error('TIMEOUT: Asset upload timed out');
    }
    if (this.failureConfig.simulateNetworkDrop) {
      throw new Error('NETWORK_DROP: Connection dropped during asset upload');
    }

    // Capacity limit check
    if (this.failureConfig.maxPayloadBytes && req.byteSize > this.failureConfig.maxPayloadBytes) {
      return {
        success: false,
        sessionId: req.sessionId,
        assetId: req.assetId,
        angle: req.angle,
        state: 'HOLD_REVIEW_REQUIRED',
        receivedBytes: req.byteSize,
        serverCalculatedSha256: '',
        checksumMatches: false,
        isRetryable: false,
        messageJa: `❌ アセット容量（${req.byteSize}B）がサーバー上限を超過しています。`,
        error: 'PAYLOAD_TOO_LARGE'
      };
    }

    // Cryptographic Read-Back Verification on Server Side
    const calculatedHash = computeSha256Hex(req.payloadDataUrl);
    const checksumMatches = !this.failureConfig.simulateChecksumMismatch && calculatedHash === req.sha256Checksum;

    if (!checksumMatches) {
      const quarantineName = `quarantine_raw_${req.angle}_${req.assetId}.bin`;
      session.quarantinedAssets.push(quarantineName);
      session.state = 'HOLD_REVIEW_REQUIRED';
      return {
        success: false,
        sessionId: req.sessionId,
        assetId: req.assetId,
        angle: req.angle,
        state: 'HOLD_REVIEW_REQUIRED',
        receivedBytes: req.byteSize,
        serverCalculatedSha256: calculatedHash,
        checksumMatches: false,
        isRetryable: false,
        messageJa: `❌ アングル【${req.angle}】の原本SHA-256不一致を検知しました。破損ファイルは隔離されました。`,
        error: 'CHECKSUM_MISMATCH'
      };
    }

    session.uploadedAssets.set(req.angle, {
      assetId: req.assetId,
      payloadDataUrl: req.payloadDataUrl,
      sha256Checksum: calculatedHash,
      byteSize: req.byteSize,
      mimeType: req.mimeType,
      isImmutableRaw: req.isImmutableRaw
    });

    session.state = 'UPLOADING';

    return {
      success: true,
      sessionId: req.sessionId,
      assetId: req.assetId,
      angle: req.angle,
      state: 'UPLOADING',
      receivedBytes: req.byteSize,
      serverCalculatedSha256: calculatedHash,
      checksumMatches: true,
      isRetryable: true,
      messageJa: `✅ アングル【${req.angle}】原本アセットの受領・SHA-256照合に成功しました。`
    };
  }

  public async verifyUploadIntegrity(req: VaultVerifyRequest): Promise<VaultVerifyResponse> {
    const session = this.sessions.get(req.sessionId);
    if (!session) {
      return {
        success: false,
        sessionId: req.sessionId,
        state: 'HOLD_REVIEW_REQUIRED',
        verifiedAssetCount: 0,
        verifiedTotalBytes: 0,
        allChecksumsMatch: false,
        messageJa: '❌ 保管セッションが存在しません。',
        error: 'SESSION_NOT_FOUND'
      };
    }

    if (session.quarantinedAssets.length > 0) {
      return {
        success: false,
        sessionId: req.sessionId,
        state: 'HOLD_REVIEW_REQUIRED',
        verifiedAssetCount: session.uploadedAssets.size,
        verifiedTotalBytes: Array.from(session.uploadedAssets.values()).reduce((sum, a) => sum + a.byteSize, 0),
        allChecksumsMatch: false,
        quarantinedAssets: session.quarantinedAssets,
        messageJa: '❌ 隔離された破損アセットが存在するため検証に失敗しました。',
        error: 'CORRUPTED_ASSETS_QUARANTINED'
      };
    }

    // Verify all expected angles are uploaded
    const missingAngles = session.expectedAngles.filter((angle) => !session.uploadedAssets.has(angle));
    if (missingAngles.length > 0) {
      return {
        success: false,
        sessionId: req.sessionId,
        state: 'HOLD_REVIEW_REQUIRED',
        verifiedAssetCount: session.uploadedAssets.size,
        verifiedTotalBytes: 0,
        allChecksumsMatch: false,
        mismatchedAngles: missingAngles,
        messageJa: `❌ 必須アングル（${missingAngles.join(', ')}）のアセットが未アップロードです。`,
        error: 'MISSING_REQUIRED_ANGLES'
      };
    }

    session.state = 'COMMIT_PENDING';

    const verifiedTotalBytes = Array.from(session.uploadedAssets.values()).reduce((sum, a) => sum + a.byteSize, 0);

    return {
      success: true,
      sessionId: req.sessionId,
      state: 'COMMIT_PENDING',
      verifiedAssetCount: session.uploadedAssets.size,
      verifiedTotalBytes,
      allChecksumsMatch: true,
      messageJa: `✅ 全${session.uploadedAssets.size}枚の原本アセット整合性検証が完了しました。正式コミット待機中です。`
    };
  }

  public async commitPromotion(req: VaultCommitRequest): Promise<VaultCommitResponse> {
    const session = this.sessions.get(req.sessionId);
    if (!session) {
      return {
        success: false,
        sessionId: req.sessionId,
        state: 'HOLD_REVIEW_REQUIRED',
        isQueryable: false,
        messageJa: '❌ 保管セッションが存在しません。',
        error: 'SESSION_NOT_FOUND'
      };
    }

    if (this.failureConfig.simulateTimeoutOnCommit) {
      throw new Error('TIMEOUT: Commit promotion timed out');
    }

    if (this.failureConfig.simulateServerCommitError) {
      session.state = 'HOLD_REVIEW_REQUIRED';
      return {
        success: false,
        sessionId: req.sessionId,
        state: 'HOLD_REVIEW_REQUIRED',
        isQueryable: false,
        messageJa: '❌ サーバー側のアトミックコミット処理中にI/O障害が発生しました。前世代を保護し保留します。',
        error: 'SERVER_COMMIT_IO_FAILURE'
      };
    }

    if (!req.operatorApproval) {
      return {
        success: false,
        sessionId: req.sessionId,
        state: 'HOLD_REVIEW_REQUIRED',
        isQueryable: false,
        messageJa: '❌ オペレーターの明示的承認がないため正式コミットできません。',
        error: 'OPERATOR_APPROVAL_MISSING'
      };
    }

    if (session.state !== 'COMMIT_PENDING') {
      return {
        success: false,
        sessionId: req.sessionId,
        state: session.state,
        isQueryable: false,
        messageJa: `❌ セッション状態が COMMIT_PENDING ではありません（現在: ${session.state}）。`,
        error: 'INVALID_LIFECYCLE_STATE'
      };
    }

    // Build formal PhotoEvidenceVaultRecord
    const recordId = `EVD-${session.sku}-${session.inventoryUnitId}`;
    const compositeKey = `${session.sku}::${session.inventoryUnitId}::v${session.version}`;
    const nowIso = new Date().toISOString();

    const photos: Partial<Record<PhotoAngle, PhotoEvidenceEntry>> = {};
    let totalBytes = 0;

    for (const [angle, asset] of session.uploadedAssets.entries()) {
      totalBytes += asset.byteSize;
      photos[angle] = {
        angle,
        originalAsset: {
          assetId: asset.assetId,
          angle,
          capturedAt: nowIso,
          sha256Checksum: asset.sha256Checksum,
          byteSize: asset.byteSize,
          mimeType: asset.mimeType,
          dataUrl: asset.payloadDataUrl,
          isImmutable: true
        },
        workingAsset: null,
        thumbnailAsset: null,
        qaSnapshot: {
          status: 'USE_AS_IS',
          issues: [],
          metrics: { blurScore: 10, brightness: 125, framingCoverage: 95, glareScore: 5 },
          suggestedAction: '合格'
        },
        evaluatedAt: nowIso,
        qaRuleVersion: '1.0.0-PROD'
      };
    }

    const retainedPredecessor = session.version > 1 ? session.version - 1 : null;

    const vaultRecord: PhotoEvidenceVaultRecord = {
      recordId,
      storageVersion: 1,
      sku: session.sku,
      inventoryUnitId: session.inventoryUnitId,
      itemTitle: session.itemTitle || '',
      sessionId: session.sessionId,
      operatorId: session.authContext.operatorId,
      status: 'COMMITTED_PERSISTED',
      createdAt: session.createdAt,
      committedAt: nowIso,
      lastVerifiedAt: nowIso,
      photos,
      totalPhotoCount: session.uploadedAssets.size,
      usablePhotoCount: session.uploadedAssets.size,
      totalByteSize: totalBytes,
      recordChecksum: session.draftRecordChecksum,
      auditTrail: [
        {
          timestamp: session.createdAt,
          action: 'VAULT_SESSION_INITIATED',
          reason: `Session initiated by operator ${session.authContext.operatorId}`,
          operator: session.authContext.operatorId
        },
        {
          timestamp: nowIso,
          action: 'COMMITTED_PERSISTED',
          reason: `Formal persistence committed with receipt (v${session.version})`,
          operator: session.authContext.operatorId
        }
      ]
    };

    // Store into server-side committed database
    this.committedRecords.set(compositeKey, vaultRecord);
    session.committedRecordId = recordId;
    session.state = 'COMMITTED_PERSISTED';

    const idempotencyEntry = this.idempotencyIndex.get(session.idempotencyKey);
    if (idempotencyEntry) {
      idempotencyEntry.committedRecordId = recordId;
    }

    const auditReceiptId = `RCPT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
      success: true,
      sessionId: req.sessionId,
      state: 'COMMITTED_PERSISTED',
      committedRecordId: recordId,
      committedAt: nowIso,
      retainedPredecessorVersion: retainedPredecessor,
      serverRecordChecksum: session.draftRecordChecksum,
      auditReceiptId,
      isQueryable: true,
      messageJa: `✅ 正式Evidence Vaultへのアトミックコミットが完了しました【${recordId}】（照会確認可能）。`
    };
  }

  public async queryPromotionStatus(req: VaultStatusQueryRequest): Promise<VaultStatusQueryResponse> {
    const nowIso = new Date().toISOString();

    // 1. Look up by idempotency key
    const idempEntry = this.idempotencyIndex.get(req.idempotencyKey);
    if (idempEntry) {
      const session = this.sessions.get(idempEntry.sessionId);
      if (session) {
        const compositeKey = `${session.sku}::${session.inventoryUnitId}::v${session.version}`;
        const committedRecord = this.committedRecords.get(compositeKey);

        return {
          isFound: true,
          sessionId: session.sessionId,
          idempotencyKey: req.idempotencyKey,
          state: session.state,
          sku: session.sku,
          inventoryUnitId: session.inventoryUnitId,
          version: session.version,
          isCommittedAndPersisted: session.state === 'COMMITTED_PERSISTED' && Boolean(committedRecord),
          committedRecordId: session.committedRecordId,
          committedRecord,
          uploadedAngles: Array.from(session.uploadedAssets.keys()),
          lastUpdatedAt: nowIso,
          messageJa: session.state === 'COMMITTED_PERSISTED'
            ? `✅ 正式保管庫レコードが確認されました【${session.committedRecordId}】。`
            : `ℹ️ セッション進行中または保留中です（状態: ${session.state}）。`
        };
      }
    }

    // 2. Look up by SKU::Unit ID::Version if provided
    if (req.sku && req.inventoryUnitId) {
      const compositeKey = `${req.sku}::${req.inventoryUnitId}::v${req.version || 1}`;
      const committedRecord = this.committedRecords.get(compositeKey);
      if (committedRecord) {
        return {
          isFound: true,
          idempotencyKey: req.idempotencyKey,
          state: 'COMMITTED_PERSISTED',
          sku: req.sku,
          inventoryUnitId: req.inventoryUnitId,
          version: req.version || 1,
          isCommittedAndPersisted: true,
          committedRecordId: committedRecord.recordId,
          committedRecord,
          uploadedAngles: Object.keys(committedRecord.photos) as PhotoAngle[],
          lastUpdatedAt: nowIso,
          messageJa: `✅ 正式保管庫レコードが確認されました【${committedRecord.recordId}】。`
        };
      }
    }

    return {
      isFound: false,
      idempotencyKey: req.idempotencyKey,
      state: 'DRAFT_LOCAL_SAVED',
      isCommittedAndPersisted: false,
      lastUpdatedAt: nowIso,
      messageJa: 'ℹ️ 該当する保管セッションまたは正式レコードは見つかりませんでした。'
    };
  }

  public async retrySafeStep(req: VaultRetryRequest): Promise<VaultRetryResponse> {
    const session = this.sessions.get(req.sessionId);
    if (!session) {
      return {
        success: false,
        sessionId: req.sessionId,
        nextAllowedState: 'HOLD_REVIEW_REQUIRED',
        recommendedBackoffMs: 0,
        messageJa: '❌ リトライ対象のセッションが見つかりません。',
        error: 'SESSION_NOT_FOUND'
      };
    }

    // Exponential backoff: 50ms * 2^attempt
    const backoffMs = Math.min(50 * Math.pow(2, req.retryAttemptCount), 2000);

    return {
      success: true,
      sessionId: req.sessionId,
      nextAllowedState: session.state === 'HOLD_UNKNOWN_TIMEOUT' ? 'COMMIT_PENDING' : 'UPLOADING',
      recommendedBackoffMs: backoffMs,
      messageJa: `ℹ️ リトライが承認されました（推奨待機時間: ${backoffMs}ms）。`
    };
  }

  public async abortSession(req: VaultAbortRequest): Promise<VaultAbortResponse> {
    const session = this.sessions.get(req.sessionId);
    let quarantinedCount = 0;
    if (session) {
      session.state = 'HOLD_REVIEW_REQUIRED';
      quarantinedCount = session.quarantinedAssets.length;
    }
    return {
      success: true,
      sessionId: req.sessionId,
      state: 'HOLD_REVIEW_REQUIRED',
      quarantinedCount,
      messageJa: `⚠️ 保管セッションを安全に中断しました（原本ドラフトは完全保全されています）。`
    };
  }

  public getTransportDiagnostics() {
    return {
      providerName: 'MockEvidenceVaultTransport (Simulated In-Memory)',
      isSimulated: true,
      activeSessionCount: this.sessions.size,
      committedRecordCount: this.committedRecords.size
    };
  }
}

/**
 * Client-Side Promotion State Machine Coordinator (Requirements 4, 6, 7, 8, 9, 10, 14)
 */
export class EvidenceVaultPromotionCoordinator {
  private transport: IEvidenceVaultTransport;

  constructor(transport: IEvidenceVaultTransport) {
    this.transport = transport;
  }

  public async promoteDraftToFormalVault(
    draft: PhotoDraftRecord,
    targetContext: PhotoCaptureTargetContext,
    options: PromotionExecutionOptions
  ): Promise<EvidenceVaultPromotionResult> {
    const quarantinedFiles: string[] = [];
    const idempotencyKey = buildIdempotencyKey(
      targetContext.sku || 'UNCONFIRMED_SKU',
      targetContext.inventoryUnitId || 'UNCONFIRMED_UNIT',
      draft.version,
      draft.sessionId
    );

    // --- Phase 1: Pre-Commit Validation & Operator Approval Gate ---
    if (!options.operatorApproval) {
      return {
        success: false,
        state: 'PROMOTION_REVIEW_REQUIRED',
        idempotencyKey,
        uploadedAssetCount: 0,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: '❌ 正式Evidence Vaultへの昇格が未承認です。オペレーターの明示的な承認が必要です。',
        error: 'OPERATOR_APPROVAL_REQUIRED'
      };
    }

    if (!targetContext.isConfirmed || !targetContext.sku || !targetContext.inventoryUnitId) {
      return {
        success: false,
        state: 'HOLD_REVIEW_REQUIRED',
        idempotencyKey,
        uploadedAssetCount: 0,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: '❌ 対象商品のSKUまたは個体番号が未確定です。正式保管への昇格を保留しました。',
        error: 'UNCONFIRMED_TARGET_CONTEXT'
      };
    }

    if (draft.sku !== targetContext.sku || draft.inventoryUnitId !== targetContext.inventoryUnitId) {
      return {
        success: false,
        state: 'HOLD_REVIEW_REQUIRED',
        idempotencyKey,
        uploadedAssetCount: 0,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: '❌ ドラフトのSKU/個体IDと現在の検品コンテキストが一致しません（異個体混入防止）。',
        error: 'CONTEXT_MISMATCH'
      };
    }

    const essentialAngles: PhotoAngle[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT'];
    const missingAngles = essentialAngles.filter((a) => !draft.photos[a]);
    if (missingAngles.length > 0) {
      return {
        success: false,
        state: 'HOLD_REVIEW_REQUIRED',
        idempotencyKey,
        uploadedAssetCount: 0,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: `❌ 必須アングル写真（${missingAngles.join(', ')}）が不足しているため昇格できません。`,
        error: 'ESSENTIAL_ANGLES_MISSING'
      };
    }

    // --- Phase 2: Session Initiation ---
    const targetDomain: TargetVaultDomain = options.targetVaultDomain || 'SIMULATED_TEST_VAULT';
    let sessionRes: VaultPromotionSessionResponse;
    try {
      sessionRes = await this.transport.initiateSession({
        idempotencyKey,
        sku: targetContext.sku,
        inventoryUnitId: targetContext.inventoryUnitId,
        itemTitle: targetContext.itemTitle,
        draftVersion: draft.version,
        expectedPhotoCount: Object.values(draft.photos).filter(Boolean).length,
        expectedTotalBytes: draft.estimatedBytes,
        expectedAngles: Object.keys(draft.photos) as PhotoAngle[],
        draftRecordChecksum: draft.recordChecksum,
        targetVaultDomain: targetDomain,
        authContext: options.authContext,
        operatorApproval: options.operatorApproval,
        approvalTimestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return {
        success: false,
        state: 'FAILED_RETRYABLE',
        idempotencyKey,
        uploadedAssetCount: 0,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: `❌ 保管セッション開始に失敗しました: ${err?.message || err}`,
        error: 'SESSION_INIT_FAILED'
      };
    }

    if (!sessionRes.success) {
      return {
        success: false,
        state: sessionRes.state,
        idempotencyKey,
        uploadedAssetCount: 0,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: sessionRes.messageJa,
        error: sessionRes.error
      };
    }

    // If duplicate replay already committed, reconcile via query and return success!
    if (sessionRes.isExistingReplay && sessionRes.state === 'COMMITTED_PERSISTED') {
      const queryRes = await this.transport.queryPromotionStatus({ idempotencyKey });
      if (queryRes.isCommittedAndPersisted && queryRes.committedRecord) {
        return {
          success: true,
          state: 'COMMITTED_PERSISTED',
          idempotencyKey,
          sessionId: sessionRes.sessionId,
          committedRecordId: queryRes.committedRecordId,
          vaultRecord: queryRes.committedRecord,
          uploadedAssetCount: queryRes.uploadedAngles?.length || 0,
          isQueryConfirmed: true,
          quarantinedFiles,
          messageJa: 'ℹ️ 既に正式保管库にコミット済みのセッションです。照会により整合性を確認しました。'
        };
      }
    }

    const sessionId = sessionRes.sessionId;

    // --- Phase 3: Asset Uploads ---
    let uploadedCount = 0;
    for (const [angleStr, item] of Object.entries(draft.photos)) {
      const angle = angleStr as PhotoAngle;
      if (!item) continue;

      let uploadSuccess = false;
      let attempts = 0;
      const maxRetries = options.maxRetries ?? 2;

      while (!uploadSuccess && attempts <= maxRetries) {
        attempts++;
        try {
          const uploadRes = await this.transport.uploadAsset({
            sessionId,
            idempotencyKey,
            angle,
            assetId: `RAW-${angle}-${draft.sessionId}`,
            isImmutableRaw: true,
            mimeType: 'image/jpeg',
            sha256Checksum: item.originalSha256Checksum,
            byteSize: item.byteSize,
            payloadDataUrl: item.originalDataUrl
          });

          if (uploadRes.success) {
            uploadSuccess = true;
            uploadedCount++;
          } else {
            if (uploadRes.state === 'HOLD_REVIEW_REQUIRED') {
              quarantinedFiles.push(`quarantine_${angle}_${item.originalSha256Checksum.slice(0, 8)}`);
              return {
                success: false,
                state: 'HOLD_REVIEW_REQUIRED',
                idempotencyKey,
                sessionId,
                uploadedAssetCount: uploadedCount,
                isQueryConfirmed: false,
                quarantinedFiles,
                messageJa: uploadRes.messageJa,
                error: uploadRes.error
              };
            }
          }
        } catch (uploadErr: any) {
          if (attempts > maxRetries) {
            return {
              success: false,
              state: 'FAILED_RETRYABLE',
              idempotencyKey,
              sessionId,
              uploadedAssetCount: uploadedCount,
              isQueryConfirmed: false,
              quarantinedFiles,
              messageJa: `❌ 原本アップロードがリトライ上限を超過しました: ${uploadErr?.message || uploadErr}`,
              error: 'UPLOAD_RETRY_EXCEEDED'
            };
          }
          // Backoff wait
          await new Promise((r) => setTimeout(r, 10 * attempts));
        }
      }
    }

    // --- Phase 4: Server Integrity Verification ---
    const verifyRes = await this.transport.verifyUploadIntegrity({
      sessionId,
      idempotencyKey,
      expectedTotalAssets: uploadedCount,
      expectedTotalBytes: draft.estimatedBytes,
      manifestSha256: draft.recordChecksum
    });

    if (!verifyRes.success) {
      return {
        success: false,
        state: verifyRes.state,
        idempotencyKey,
        sessionId,
        uploadedAssetCount: uploadedCount,
        isQueryConfirmed: false,
        quarantinedFiles: [...quarantinedFiles, ...(verifyRes.quarantinedAssets || [])],
        messageJa: verifyRes.messageJa,
        error: verifyRes.error
      };
    }

    // --- Phase 5: Atomic Commit & Timeout Handling ---
    let commitRes: VaultCommitResponse | null = null;
    try {
      commitRes = await this.transport.commitPromotion({
        sessionId,
        idempotencyKey,
        operatorApproval: options.operatorApproval,
        approvalTimestamp: new Date().toISOString(),
        clientAuditId: `AUD-CLIENT-${Date.now()}`
      });
    } catch (commitErr: any) {
      // REQUIREMENT 9: Handle timeout as independent HOLD_UNKNOWN_TIMEOUT state
      // DO NOT report success and DO NOT unconditionally resend. Must reconcile via status query!
      const statusQuery = await this.transport.queryPromotionStatus({ idempotencyKey, sessionId });
      if (statusQuery.isCommittedAndPersisted && statusQuery.committedRecord) {
        return {
          success: true,
          state: 'COMMITTED_PERSISTED',
          idempotencyKey,
          sessionId,
          committedRecordId: statusQuery.committedRecordId,
          vaultRecord: statusQuery.committedRecord,
          uploadedAssetCount: uploadedCount,
          isQueryConfirmed: true,
          quarantinedFiles,
          messageJa: '✅ 通信タイムアウト後に保管庫レコードを照会し、正式コミット完了を確認しました。'
        };
      }

      return {
        success: false,
        state: 'HOLD_UNKNOWN_TIMEOUT',
        idempotencyKey,
        sessionId,
        uploadedAssetCount: uploadedCount,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: '⚠️ コミット通信がタイムアウトしました。合否が未確定のため保留（HOLD_UNKNOWN_TIMEOUT）としました。照会確認が必要です。',
        error: 'COMMIT_TIMEOUT_OUTCOME_UNKNOWN'
      };
    }

    if (!commitRes || !commitRes.success || commitRes.state !== 'COMMITTED_PERSISTED') {
      return {
        success: false,
        state: commitRes?.state || 'HOLD_REVIEW_REQUIRED',
        idempotencyKey,
        sessionId,
        uploadedAssetCount: uploadedCount,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: commitRes?.messageJa || '❌ コミット処理に失敗しました。',
        error: commitRes?.error
      };
    }

    // --- Phase 6: Final Query Reconciliation (Requirement 6) ---
    // COMMITTED_PERSISTED is ONLY valid if the recipient side confirmed the queryable record!
    const queryConfirm = await this.transport.queryPromotionStatus({ idempotencyKey, sessionId });
    if (!queryConfirm.isCommittedAndPersisted || !queryConfirm.committedRecord) {
      return {
        success: false,
        state: 'HOLD_REVIEW_REQUIRED',
        idempotencyKey,
        sessionId,
        uploadedAssetCount: uploadedCount,
        isQueryConfirmed: false,
        quarantinedFiles,
        messageJa: '❌ コミット応答を受信しましたが、保管庫照会による確定確認ができませんでした。',
        error: 'QUERY_CONFIRMATION_FAILED'
      };
    }

    return {
      success: true,
      state: 'COMMITTED_PERSISTED',
      idempotencyKey,
      sessionId,
      committedRecordId: commitRes.committedRecordId,
      vaultRecord: queryConfirm.committedRecord,
      retainedPredecessorVersion: commitRes.retainedPredecessorVersion,
      uploadedAssetCount: uploadedCount,
      auditTrailId: commitRes.auditReceiptId,
      isQueryConfirmed: true,
      quarantinedFiles,
      messageJa: commitRes.messageJa
    };
  }
}
