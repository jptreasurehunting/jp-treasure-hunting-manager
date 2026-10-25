/**
 * Photo Evidence Vault & Permanent Storage Service (JTH-STEP 34)
 *
 * Implements immutable evidence preservation, cryptographic checksums,
 * composite key isolation, and failure-injectable mock persistence testing.
 *
 * Safety Guarantees:
 * 1. NEVER writes to production inventory DB or existing localStorage.
 * 2. Operates in an isolated persistence boundary with explicit cold restart simulation.
 * 3. Enforces raw photo immutability; derivatives and thumbnails are explicitly separated.
 * 4. SHA-256 cryptographic verification prevents undetectable silent corruption.
 * 5. Strictly requires persistence layer acknowledgment before reporting "COMMITTED_PERSISTED".
 */

import type { PhotoAngle, CapturedPhoto, PhotoCaptureTargetContext } from '../types/photoCapture';
import type {
  ImmutableRawPhotoAsset,
  DerivativeWorkingAsset,
  ThumbnailAsset,
  PhotoEvidenceEntry,
  PhotoEvidenceVaultRecord,
  PhotoEvidenceVaultSummary,
  PersistenceSaveResult,
  PersistenceLoadResult,
  IntegrityCheckResult,
  IPhotoEvidencePersistenceAdapter,
  FailureInjectionConfig,
  EvidencePersistenceStatus
} from '../types/photoEvidenceVault';

/**
 * Standard deterministic SHA-256 hash generator (Platform-agnostic, dependency-free).
 */
export function computeSha256Hex(input: string): string {
  // Pure TypeScript implementation of standard SHA-256
  function rightRotate(value: number, amount: number): number {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const words: number[] = [];
  const asciiBitLength = input.length * 8;

  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  let H: number[] = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    words[i >> 2] |= (charCode & 0xff) << (24 - (i % 4) * 8);
  }

  // Padding
  words[input.length >> 2] |= 0x80 << (24 - (input.length % 4) * 8);
  words[(((input.length + 8) >> 6) << 4) + 15] = asciiBitLength;

  const W = new Array(64);
  for (let i = 0; i < words.length; i += 16) {
    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];

    for (let t = 0; t < 64; t++) {
      if (t < 16) {
        W[t] = words[i + t] | 0;
      } else {
        const gamma0 = rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const gamma1 = rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (((W[t - 16] + gamma0) | 0) + ((W[t - 7] + gamma1) | 0)) | 0;
      }

      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (((((h + S1) | 0) + ch) | 0) + ((K[t] + W[t]) | 0)) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    H[0] = (H[0] + a) | 0;
    H[1] = (H[1] + b) | 0;
    H[2] = (H[2] + c) | 0;
    H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0;
    H[5] = (H[5] + f) | 0;
    H[6] = (H[6] + g) | 0;
    H[7] = (H[7] + h) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    const word = H[i] >>> 0;
    let hex = word.toString(16);
    while (hex.length < 8) hex = '0' + hex;
    result += hex;
  }
  return result;
}

/**
 * Calculates evidence record checksum for integrity validation
 */
export function calculateRecordChecksum(
  sku: string,
  inventoryUnitId: string,
  photos: Partial<Record<PhotoAngle, PhotoEvidenceEntry>>
): string {
  const sortedAngles = Object.keys(photos).sort() as PhotoAngle[];
  const parts: string[] = [`sku:${sku}`, `unit:${inventoryUnitId}`];

  for (const angle of sortedAngles) {
    const entry = photos[angle];
    if (entry) {
      parts.push(`${angle}:raw=${entry.originalAsset.sha256Checksum}:working=${entry.workingAsset?.sha256Checksum || 'none'}:qa=${entry.qaSnapshot.status}`);
    }
  }

  return computeSha256Hex(parts.join('||'));
}

/**
 * Safe In-Memory Failure-Injectable Persistence Adapter
 * Used for rigorous automated testing without touching physical disks or browser localStorage.
 */
export class MockFailureInjectablePersistenceAdapter implements IPhotoEvidencePersistenceAdapter {
  private persistentStore = new Map<string, string>(); // Serialized JSON representation
  private config: FailureInjectionConfig = {};

  constructor(initialConfig: FailureInjectionConfig = {}) {
    this.config = { ...initialConfig };
  }

  public setConfig(update: Partial<FailureInjectionConfig>): void {
    this.config = { ...this.config, ...update };
  }

  public resetConfig(): void {
    this.config = {};
  }

  private makeKey(sku: string, inventoryUnitId: string): string {
    return `${sku.trim()}::${inventoryUnitId.trim()}`;
  }

  public async getStorageMetrics(): Promise<{
    usedBytes: number;
    recordCount: number;
    backendType: 'MOCK_IN_MEMORY' | 'INDEXED_DB' | 'WINDOWS_LOCAL_FS';
  }> {
    let usedBytes = 0;
    for (const val of this.persistentStore.values()) {
      usedBytes += val.length * 2;
    }
    return {
      usedBytes,
      recordCount: this.persistentStore.size,
      backendType: 'MOCK_IN_MEMORY'
    };
  }

  public async saveRecord(record: PhotoEvidenceVaultRecord): Promise<PersistenceSaveResult> {
    // 1. Failure Injection: Disk Full Simulation
    if (this.config.simulateDiskFull) {
      return {
        success: false,
        status: 'FAILED_DISK_FULL',
        messageJa: '【模擬障害】ディスク空き容量不足のため永続保存が拒否されました。',
        error: 'DISK_FULL_SIMULATED'
      };
    }

    // 2. Failure Injection: I/O Write Error Simulation
    if (this.config.simulateWriteError) {
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: '【模擬障害】ファイルシステムへの書き込み中にI/Oエラーが発生しました。',
        error: 'WRITE_IO_ERROR_SIMULATED'
      };
    }

    // 3. Capacity limit check
    const serialized = JSON.stringify(record);
    const metrics = await this.getStorageMetrics();
    const projectedBytes = metrics.usedBytes + serialized.length * 2;

    if (this.config.maxCapacityBytes && projectedBytes > this.config.maxCapacityBytes) {
      return {
        success: false,
        status: 'FAILED_DISK_FULL',
        messageJa: `【容量超過】設定された模擬ストレージ上限（${Math.round(this.config.maxCapacityBytes / (1024 * 1024))}MB）を超過しました。`,
        error: 'STORAGE_QUOTA_EXCEEDED'
      };
    }

    // 4. Failure Injection: Midway Abort (saves corrupted incomplete JSON)
    if (this.config.simulateMidwayAbort) {
      const truncated = serialized.substring(0, Math.floor(serialized.length / 2));
      const key = this.makeKey(record.sku, record.inventoryUnitId);
      this.persistentStore.set(key, truncated);
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: '【模擬障害】保存処理の途中で電源断またはプロセス終了が発生しました。',
        error: 'MIDWAY_PROCESS_ABORT'
      };
    }

    // 5. Successful Save
    const key = this.makeKey(record.sku, record.inventoryUnitId);
    this.persistentStore.set(key, serialized);

    return {
      success: true,
      status: 'COMMITTED_PERSISTED',
      recordId: record.recordId,
      recordChecksum: record.recordChecksum,
      committedBytes: serialized.length * 2,
      messageJa: `💾 【${record.sku} (${record.inventoryUnitId})】の原本写真証拠（${record.totalPhotoCount}枚）を正式保存ストレージにコミットしました。`
    };
  }

  public async loadRecord(sku: string, inventoryUnitId: string): Promise<PersistenceLoadResult> {
    const key = this.makeKey(sku, inventoryUnitId);
    const serialized = this.persistentStore.get(key);

    if (!serialized) {
      return {
        success: false,
        status: 'HOLD_UNCONFIRMED_ID',
        messageJa: `該当個体（${key}）の正式保存レコードは存在しません。`,
        error: 'RECORD_NOT_FOUND'
      };
    }

    let record: PhotoEvidenceVaultRecord;
    try {
      record = JSON.parse(serialized);
    } catch (err: any) {
      return {
        success: false,
        status: 'HOLD_CORRUPTED_CHECKSUM',
        messageJa: '【破損検知】保存レコードのJSONパースに失敗しました（保存データ破損）。',
        error: 'INVALID_JSON_RECORD'
      };
    }

    // Failure Injection: Read Corruption Simulation
    if (this.config.simulateCorruptionOnRead) {
      // Modify raw image payload without updating checksum
      const firstAngle = Object.keys(record.photos)[0] as PhotoAngle;
      if (firstAngle && record.photos[firstAngle]) {
        record.photos[firstAngle]!.originalAsset.dataUrl += '_TAMPERED';
        record.photos[firstAngle]!.originalAsset.sha256Checksum = 'tampered_sha256_corrupted';
      }
    }

    // Failure Injection: Corrupted Record Checksum
    if (this.config.simulateCorruptedChecksum) {
      record.recordChecksum = 'invalid_checksum_hash_value';
    }

    // Verify Checksum on Load
    const expectedChecksum = calculateRecordChecksum(record.sku, record.inventoryUnitId, record.photos);
    if (record.recordChecksum !== expectedChecksum) {
      return {
        success: false,
        status: 'HOLD_CORRUPTED_CHECKSUM',
        record,
        messageJa: `【改ざん・破損検知】記録チェックサム（${record.recordChecksum.substring(0, 10)}...）と再計算値（${expectedChecksum.substring(0, 10)}...）が不一致です。安全のため復元をHOLDしました。`,
        error: 'CHECKSUM_INTEGRITY_MISMATCH'
      };
    }

    return {
      success: true,
      status: 'COMMITTED_PERSISTED',
      record,
      messageJa: `✅ 【${record.sku} (${record.inventoryUnitId})】の原本写真証拠（${record.totalPhotoCount}枚）を整合性検証の上、正常にロードしました。`
    };
  }

  public async listSummaries(): Promise<PhotoEvidenceVaultSummary[]> {
    const summaries: PhotoEvidenceVaultSummary[] = [];
    for (const serialized of this.persistentStore.values()) {
      try {
        const r: PhotoEvidenceVaultRecord = JSON.parse(serialized);
        summaries.push({
          recordId: r.recordId,
          sku: r.sku,
          inventoryUnitId: r.inventoryUnitId,
          itemTitle: r.itemTitle,
          status: r.status,
          totalPhotoCount: r.totalPhotoCount,
          usablePhotoCount: r.usablePhotoCount,
          totalByteSize: r.totalByteSize,
          committedAt: r.committedAt,
          recordChecksum: r.recordChecksum
        });
      } catch {
        // Skip malformed records
      }
    }
    return summaries;
  }

  public async deleteRecord(sku: string, inventoryUnitId: string): Promise<boolean> {
    const key = this.makeKey(sku, inventoryUnitId);
    return this.persistentStore.delete(key);
  }

  public async verifyIntegrity(sku: string, inventoryUnitId: string): Promise<IntegrityCheckResult> {
    const loadRes = await this.loadRecord(sku, inventoryUnitId);
    if (!loadRes.success || !loadRes.record) {
      return {
        isValid: false,
        checkedRecordId: `EVD-${sku}-${inventoryUnitId}`,
        expectedChecksum: 'UNKNOWN',
        computedChecksum: 'UNKNOWN',
        mismatchedAngles: [],
        messageJa: `レコードが存在しないか読み取りに失敗しました: ${loadRes.messageJa}`
      };
    }

    const rec = loadRes.record;
    const computedChecksum = calculateRecordChecksum(rec.sku, rec.inventoryUnitId, rec.photos);
    const mismatchedAngles: PhotoAngle[] = [];

    for (const [angle, entry] of Object.entries(rec.photos) as [PhotoAngle, PhotoEvidenceEntry][]) {
      const rawHash = computeSha256Hex(entry.originalAsset.dataUrl);
      if (rawHash !== entry.originalAsset.sha256Checksum) {
        mismatchedAngles.push(angle);
      }
    }

    const isValid = computedChecksum === rec.recordChecksum && mismatchedAngles.length === 0;

    return {
      isValid,
      checkedRecordId: rec.recordId,
      expectedChecksum: rec.recordChecksum,
      computedChecksum,
      mismatchedAngles,
      messageJa: isValid
        ? '✅ 原本写真ハッシュおよびレコードチェックサムの整合性検証に合格しました。'
        : `❌ 整合性検査に失敗しました（不一致アングル: ${mismatchedAngles.join(', ') || '全体チェックサム'}）。`
    };
  }

  /**
   * Simulates a Cold Process Restart / PC Reboot
   * Deep-copies the serialized store, severing all in-memory references.
   * NOTE: This is a same-process simulation to test serialization and checksum recovery;
   * it does not substitute for real OS power-loss testing.
   */
  public simulateColdRestart(): MockFailureInjectablePersistenceAdapter {
    const freshAdapter = new MockFailureInjectablePersistenceAdapter(this.config);
    for (const [key, val] of this.persistentStore.entries()) {
      freshAdapter.persistentStore.set(key, String(val));
    }
    return freshAdapter;
  }

  public clearAll(): void {
    this.persistentStore.clear();
  }
}

/**
 * Domain Service: Photo Evidence Vault Service
 * Coordinates building immutable records, hashing, and persisting via adapter.
 */
export class PhotoEvidenceVaultService {
  private adapter: IPhotoEvidencePersistenceAdapter;

  constructor(adapter?: IPhotoEvidencePersistenceAdapter) {
    this.adapter = adapter || new MockFailureInjectablePersistenceAdapter();
  }

  public getAdapter(): IPhotoEvidencePersistenceAdapter {
    return this.adapter;
  }

  public setAdapter(adapter: IPhotoEvidencePersistenceAdapter): void {
    this.adapter = adapter;
  }

  /**
   * Creates an immutable evidence vault record from active target context and captured photos.
   */
  public buildVaultRecord(
    targetContext: PhotoCaptureTargetContext,
    capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>,
    options: { sessionId?: string; operatorId?: string } = {}
  ): { success: boolean; record?: PhotoEvidenceVaultRecord; errorReasonCode?: string; messageJa: string } {
    if (!targetContext || !targetContext.isConfirmed) {
      return {
        success: false,
        errorReasonCode: 'HOLD_UNCONFIRMED_ID',
        messageJa: '撮影対象の商品カタログ番号（SKU）または実物個体ID（Unit ID）が未確定（UNLINKED_HOLD）のため正式保存レコードを作成できません。'
      };
    }

    const sku = targetContext.sku?.trim();
    const unitId = targetContext.inventoryUnitId?.trim();
    if (!sku || !unitId) {
      return {
        success: false,
        errorReasonCode: 'HOLD_UNCONFIRMED_ID',
        messageJa: 'SKUまたはUnit IDが空文字欄です。正式保存には明確な個体識別子が必要です。'
      };
    }

    const nonNullPhotos = Object.values(capturedPhotos).filter((p): p is CapturedPhoto => p !== null);
    if (nonNullPhotos.length === 0) {
      return {
        success: false,
        errorReasonCode: 'HOLD_NO_PHOTOS',
        messageJa: '保存対象の撮影写真が1枚も存在しません。'
      };
    }

    const recordPhotos: Partial<Record<PhotoAngle, PhotoEvidenceEntry>> = {};
    let totalBytes = 0;
    let usableCount = 0;

    for (const p of nonNullPhotos) {
      // Cross-SKU / Cross-Unit pollution protection
      if (p.sku && p.sku !== sku) {
        return {
          success: false,
          errorReasonCode: 'HOLD_CROSS_POLLUTION',
          messageJa: `アングル【${p.angle}】の写真に別SKU【${p.sku}】が検出されました（対象: ${sku}）。混入防止のため保存を拒否しました。`
        };
      }
      if (p.inventoryUnitId && p.inventoryUnitId !== unitId) {
        return {
          success: false,
          errorReasonCode: 'HOLD_CROSS_POLLUTION',
          messageJa: `アングル【${p.angle}】の写真に別個体ID【${p.inventoryUnitId}】が検出されました（対象: ${unitId}）。混入防止のため保存を拒否しました。`
        };
      }

      // Immutability: Determine raw payload & working payload
      const rawPayload = p.originalDataUrl || p.dataUrl;
      const rawChecksum = computeSha256Hex(rawPayload);
      const rawBytes = rawPayload.length * 2;

      const rawAsset: ImmutableRawPhotoAsset = {
        assetId: `RAW-${p.id}`,
        angle: p.angle,
        capturedAt: p.timestamp,
        sha256Checksum: rawChecksum,
        byteSize: rawBytes,
        mimeType: rawPayload.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/svg+xml',
        dataUrl: rawPayload,
        isImmutable: true
      };

      let workingAsset: DerivativeWorkingAsset | null = null;
      if (p.originalDataUrl && p.originalDataUrl !== p.dataUrl) {
        // Auto-fix was applied; preserve working derivative decoupled from raw
        workingAsset = {
          assetId: `WRK-${p.id}`,
          sourceOriginalAssetId: rawAsset.assetId,
          angle: p.angle,
          generatedAt: new Date().toISOString(),
          sha256Checksum: computeSha256Hex(p.dataUrl),
          byteSize: p.dataUrl.length * 2,
          autoFixAppliedCount: p.autoFixCount || 1,
          dataUrl: p.dataUrl
        };
      }

      // Lightweight thumbnail representation
      const thumbnailAsset: ThumbnailAsset = {
        dataUrl: p.dataUrl,
        byteSize: Math.min(p.dataUrl.length, 2048),
        widthPx: 160,
        heightPx: 120
      };

      const entry: PhotoEvidenceEntry = {
        angle: p.angle,
        originalAsset: rawAsset,
        workingAsset,
        thumbnailAsset,
        qaSnapshot: {
          ...p.qaResult,
          issues: [...p.qaResult.issues],
          metrics: { ...p.qaResult.metrics }
        },
        evaluatedAt: p.timestamp,
        qaRuleVersion: '2026.1-PHOTO-GATE'
      };

      recordPhotos[p.angle] = entry;
      totalBytes += rawBytes + (workingAsset?.byteSize || 0) + thumbnailAsset.byteSize;
      if (p.qaResult.status === 'USE_AS_IS') {
        usableCount++;
      }
    }

    const recordId = `EVD-${sku}-${unitId}`;
    const recordChecksum = calculateRecordChecksum(sku, unitId, recordPhotos);

    const record: PhotoEvidenceVaultRecord = {
      recordId,
      storageVersion: 1,
      sku,
      inventoryUnitId: unitId,
      itemTitle: targetContext.itemTitle,
      sessionId: options.sessionId || `SES-${Date.now()}`,
      operatorId: options.operatorId || 'LOCAL_OPERATOR',
      status: 'DRAFT_STAGED',
      createdAt: new Date().toISOString(),
      photos: recordPhotos,
      totalPhotoCount: nonNullPhotos.length,
      usablePhotoCount: usableCount,
      totalByteSize: totalBytes,
      recordChecksum,
      auditTrail: [
        {
          timestamp: new Date().toISOString(),
          action: 'BUILD_EVIDENCE_RECORD',
          reason: 'Initial construction of immutable evidence snapshot from capture session.'
        }
      ]
    };

    return {
      success: true,
      record,
      messageJa: `原本写真証拠レコード【${recordId}】（${record.totalPhotoCount}枚 / チェックサム: ${recordChecksum.substring(0, 10)}...）を作成しました。`
    };
  }

  /**
   * Commits the record to the persistent adapter with strict acknowledgment.
   */
  public async commitToVault(
    targetContext: PhotoCaptureTargetContext,
    capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>,
    options: { sessionId?: string; operatorId?: string } = {}
  ): Promise<PersistenceSaveResult> {
    const buildRes = this.buildVaultRecord(targetContext, capturedPhotos, options);
    if (!buildRes.success || !buildRes.record) {
      return {
        success: false,
        status: (buildRes.errorReasonCode as EvidencePersistenceStatus) || 'HOLD_UNCONFIRMED_ID',
        messageJa: buildRes.messageJa,
        error: buildRes.errorReasonCode
      };
    }

    const recordToSave: PhotoEvidenceVaultRecord = {
      ...buildRes.record,
      status: 'COMMITTED_PERSISTED',
      committedAt: new Date().toISOString(),
      auditTrail: [
        ...buildRes.record.auditTrail,
        {
          timestamp: new Date().toISOString(),
          action: 'COMMIT_TO_VAULT',
          reason: 'Committed to persistent storage with integrity checksum.'
        }
      ]
    };

    const saveResult = await this.adapter.saveRecord(recordToSave);
    return saveResult;
  }

  /**
   * Loads and restores a verified record from the persistent adapter.
   */
  public async loadFromVault(sku: string, inventoryUnitId: string): Promise<PersistenceLoadResult> {
    return this.adapter.loadRecord(sku, inventoryUnitId);
  }
}

/**
 * Capacity and Storage Volume Estimation Calculator (JTH-STEP 34 作業項目10)
 */
export interface EvidenceCapacityEstimate {
  skuCount: number;
  photosPerItem: number;
  rawPhotoAvgBytes: number;
  workingPhotoAvgBytes: number;
  thumbnailAvgBytes: number;
  bytesPerItem: number;
  totalEstimateMB: number;
  totalEstimateGB: number;
  recommendedDiskSpaceGB: number; // Includes 3x margin for backups and snapshots
  monthlyEstimateGB: number;      // Based on 200 items/month
  annualEstimateGB: number;       // Based on 2,400 items/year
}

export function calculateEvidenceCapacityEstimate(params: {
  skuCount: number;
  photosPerItem?: number;
  resolutionTier?: 'FHD_STANDARD' | '4K_HIGH_RES';
}): EvidenceCapacityEstimate {
  const { skuCount, photosPerItem = 6, resolutionTier = 'FHD_STANDARD' } = params;

  // FHD: ~1.8 MB raw JPEG (2.4 MB base64), ~1.2 MB working, ~30 KB thumb
  // 4K:  ~3.5 MB raw JPEG (4.7 MB base64), ~2.2 MB working, ~40 KB thumb
  const is4K = resolutionTier === '4K_HIGH_RES';
  const rawBytes = is4K ? 3.5 * 1024 * 1024 : 1.8 * 1024 * 1024;
  const workingBytes = is4K ? 2.2 * 1024 * 1024 : 1.2 * 1024 * 1024;
  const thumbBytes = 35 * 1024;

  const bytesPerPhoto = rawBytes + workingBytes + thumbBytes;
  const bytesPerItem = bytesPerPhoto * photosPerItem;
  const totalEstimateBytes = bytesPerItem * skuCount;

  const totalEstimateMB = Number((totalEstimateBytes / (1024 * 1024)).toFixed(1));
  const totalEstimateGB = Number((totalEstimateBytes / (1024 * 1024 * 1024)).toFixed(2));
  const recommendedDiskSpaceGB = Number((totalEstimateGB * 3).toFixed(2));

  // Monthly estimate (200 units/mo) & Annual (2,400 units/yr)
  const monthlyEstimateGB = Number(((bytesPerItem * 200) / (1024 * 1024 * 1024)).toFixed(2));
  const annualEstimateGB = Number(((bytesPerItem * 2400) / (1024 * 1024 * 1024)).toFixed(2));

  return {
    skuCount,
    photosPerItem,
    rawPhotoAvgBytes: rawBytes,
    workingPhotoAvgBytes: workingBytes,
    thumbnailAvgBytes: thumbBytes,
    bytesPerItem,
    totalEstimateMB,
    totalEstimateGB,
    recommendedDiskSpaceGB,
    monthlyEstimateGB,
    annualEstimateGB
  };
}
