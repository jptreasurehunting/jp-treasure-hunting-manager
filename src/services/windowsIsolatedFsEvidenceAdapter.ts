/**
 * Windows Isolated Filesystem Persistence Adapter for Photo Evidence Vault (JTH-STEP 36)
 *
 * Dedicated strictly to automated verification and failure-injection testing in
 * an isolated temporary directory under OS tmpdir.
 *
 * Safety Principles:
 * 1. NEVER writes to production directories, inventory databases, or browser storage.
 * 2. Strict path traversal defense: Rejects illegal characters, relative segments (`..`),
 *    and absolute paths that resolve outside the isolated test root.
 * 3. Atomic commit pattern: Writes files to a staging area, flushes, and atomically
 *    publishes with a commit marker. Partial writes are never marked COMMITTED_PERSISTED.
 * 4. Read-back verification: Automatically verifies SHA-256 checksums and re-reads from disk
 *    before acknowledging successful persistence.
 * 5. Boundary-verified safe cleanup: Verifies isolated root marker before removal.
 * 6. Browser-safe & Typecheck-clean: Dynamically binds Node.js builtins at runtime,
 *    allowing `tsc --noEmit` and Vite bundling to succeed without `@types/node`.
 */

import { computeSha256Hex, calculateRecordChecksum } from './photoEvidenceVaultService';
import type { PhotoAngle } from '../types/photoCapture';
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

export interface WindowsIsolatedFsAdapterOptions {
  /** Optional custom base directory; defaults to a unique directory in os.tmpdir() */
  baseDirectory?: string;
  /** Unique test run identifier */
  runId?: string;
  /** Injected failure scenarios */
  failureConfig?: FailureInjectionConfig & {
    simulatePermissionDenied?: boolean;
    simulateMissingCommitMarker?: boolean;
    simulateCorruptedRawFile?: boolean;
    simulateCorruptedManifest?: boolean;
    simulateMissingRawFile?: boolean;
    simulatePreExistingConflict?: boolean;
    simulateReadBackFailure?: boolean;
  };
}

export interface NodeFsModule {
  existsSync(p: string): boolean;
  mkdirSync(p: string, opts?: any): void;
  writeFileSync(p: string, data: string | Uint8Array, opts?: any): void;
  readFileSync(p: string, opts?: any): any;
  renameSync(oldP: string, newP: string): void;
  rmSync(p: string, opts?: any): void;
  readdirSync(p: string, opts?: any): any[];
  statSync(p: string): { size: number; isDirectory(): boolean; isFile(): boolean };
  lstatSync(p: string): { size: number; isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean };
  realpathSync(p: string): string;
  unlinkSync(p: string): void;
}

export interface NodePathModule {
  sep: string;
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
  isAbsolute(p: string): boolean;
  relative(from: string, to: string): string;
  dirname(p: string): string;
  basename(p: string): string;
}

/**
 * Rigorously checks whether targetPath is strictly inside (or equal to) basePath.
 * Defends against:
 * 1. Adjacent folder prefix collisions (e.g. /base vs /base-evil)
 * 2. Relative escaping (..)
 * 3. Windows drive letter / case discrepancies
 */
export function isContainedPath(basePath: string, targetPath: string, pathModule: NodePathModule): boolean {
  const resolvedBase = pathModule.resolve(basePath);
  const resolvedTarget = pathModule.resolve(targetPath);

  const proc = (globalThis as any).process;
  const isWindows = proc && proc.platform ? proc.platform === 'win32' : true;

  const normBase = isWindows ? resolvedBase.toLowerCase() : resolvedBase;
  const normTarget = isWindows ? resolvedTarget.toLowerCase() : resolvedTarget;

  const rel = pathModule.relative(normBase, normTarget);

  if (rel.startsWith('..') || pathModule.isAbsolute(rel)) {
    return false;
  }

  const normBaseWithSep = normBase.endsWith(pathModule.sep) ? normBase : normBase + pathModule.sep;
  if (normTarget !== normBase && !normTarget.startsWith(normBaseWithSep)) {
    return false;
  }

  return true;
}

/**
 * Verifies that the path is not a symbolic link or junction pointing outside the base.
 */
export function verifyNoSymlinkEscaping(
  targetPath: string,
  baseDir: string,
  fs: NodeFsModule,
  pathModule: NodePathModule
): void {
  if (fs.existsSync(targetPath)) {
    try {
      const lstat = fs.lstatSync(targetPath);
      if (lstat && typeof lstat.isSymbolicLink === 'function' && lstat.isSymbolicLink()) {
        throw new Error(`SECURITY_SYMLINK_REDIRECTION_PREVENTED: Symbolic link detected at [${targetPath}]. Symlinks are strictly prohibited.`);
      }
      if (typeof fs.realpathSync === 'function') {
        const real = fs.realpathSync(targetPath);
        if (!isContainedPath(baseDir, real, pathModule)) {
          throw new Error(`SECURITY_SYMLINK_REDIRECTION_PREVENTED: Real path [${real}] resolves outside isolated base [${baseDir}].`);
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('SECURITY_SYMLINK_REDIRECTION_PREVENTED')) {
        throw err;
      }
    }
  }
}

export interface NodeOsModule {
  tmpdir(): string;
}

let cachedNodeModules: {
  fs: NodeFsModule;
  path: NodePathModule;
  os: NodeOsModule;
} | null = null;

export async function getNodeFsModules(): Promise<{
  fs: NodeFsModule;
  path: NodePathModule;
  os: NodeOsModule;
}> {
  if (cachedNodeModules) return cachedNodeModules;

  const proc = (globalThis as any).process;
  if (!proc || !proc.versions || !proc.versions.node) {
    throw new Error('WindowsIsolatedFsEvidencePersistenceAdapter requires a Node.js runtime environment.');
  }

  // Dynamic import via function constructor avoids compile-time TS2307
  const loadModule = new Function('mod', 'return import(mod)');
  const [fs, path, os] = await Promise.all([
    loadModule('node:fs'),
    loadModule('node:path'),
    loadModule('node:os')
  ]);

  cachedNodeModules = {
    fs: fs.default || fs,
    path: path.default || path,
    os: os.default || os
  };
  return cachedNodeModules;
}

const MARKER_FILENAME = 'JTH_VAULT_ISOLATED_TEST_ROOT.marker';

/**
 * Windows Isolated Filesystem Persistence Adapter
 */
export class WindowsIsolatedFsEvidencePersistenceAdapter implements IPhotoEvidencePersistenceAdapter {
  private options: WindowsIsolatedFsAdapterOptions;
  private config: WindowsIsolatedFsAdapterOptions['failureConfig'] = {};
  private rootDirectory: string | null = null;
  private recordsDirectory: string | null = null;
  private isInitialized = false;

  constructor(options: WindowsIsolatedFsAdapterOptions = {}) {
    this.options = { ...options };
    this.config = { ...options.failureConfig };
  }

  public setConfig(update: Partial<WindowsIsolatedFsAdapterOptions['failureConfig']>): void {
    this.config = { ...this.config, ...update };
  }

  public resetConfig(): void {
    this.config = {};
  }

  public getRootDirectory(): string | null {
    return this.rootDirectory;
  }

  /**
   * Initializes the isolated directory and verifies safe test boundary
   */
  public async initialize(): Promise<string> {
    if (this.isInitialized && this.rootDirectory) {
      return this.rootDirectory;
    }

    const { fs, path, os } = await getNodeFsModules();
    const systemTmp = os.tmpdir();
    const runId = this.options.runId || `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const root = this.options.baseDirectory
      ? path.resolve(this.options.baseDirectory)
      : path.join(systemTmp, `jth-evidence-vault-tests-${runId}`);

    // Verify root is within safe tmp or explicitly provided isolated path
    const resolvedRoot = path.resolve(root);
    const resolvedTmp = path.resolve(systemTmp);

    if (!this.options.baseDirectory && !isContainedPath(resolvedTmp, resolvedRoot, path)) {
      throw new Error(`SECURITY_BOUNDARY_VIOLATION: Root path [${resolvedRoot}] is outside OS tmpdir [${resolvedTmp}].`);
    }

    if (!fs.existsSync(resolvedRoot)) {
      fs.mkdirSync(resolvedRoot, { recursive: true });
    }

    // Write safety boundary proof marker
    const markerPath = path.join(resolvedRoot, MARKER_FILENAME);
    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          description: 'JP Treasure Hunting Isolated Test Directory',
          safeForTestingOnly: true
        },
        null,
        2
      ),
      'utf8'
    );

    const recordsDir = path.join(resolvedRoot, 'records');
    if (!fs.existsSync(recordsDir)) {
      fs.mkdirSync(recordsDir, { recursive: true });
    }

    this.rootDirectory = resolvedRoot;
    this.recordsDirectory = recordsDir;
    this.isInitialized = true;

    return this.rootDirectory;
  }

  /**
   * Validates and sanitizes SKU and inventoryUnitId against path traversal attacks.
   * Throws on directory traversal characters (`..`, `/`, `\`, `:`, null bytes).
   */
  public validateIdentifiers(sku: string, inventoryUnitId: string): { safeFolder: string; key: string } {
    if (!sku || !sku.trim()) {
      throw new Error('IDENTIFIER_EMPTY: SKU cannot be empty.');
    }
    if (!inventoryUnitId || !inventoryUnitId.trim()) {
      throw new Error('IDENTIFIER_EMPTY: inventoryUnitId cannot be empty.');
    }

    // Windows reserved device names rejection
    const WINDOWS_RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
    if (WINDOWS_RESERVED_NAMES.test(sku.trim())) {
      throw new Error(`SECURITY_RESERVED_DEVICE_NAME_DETECTED: SKU cannot be a Windows reserved device name: [${sku}]`);
    }
    if (WINDOWS_RESERVED_NAMES.test(inventoryUnitId.trim())) {
      throw new Error(`SECURITY_RESERVED_DEVICE_NAME_DETECTED: inventoryUnitId cannot be a Windows reserved device name: [${inventoryUnitId}]`);
    }

    // Path traversal rejection
    const forbiddenPatterns = [/\.\./, /[\\/]/, /:/, /\0/];
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(sku)) {
        throw new Error(`SECURITY_PATH_TRAVERSAL_DETECTED: SKU contains prohibited characters: [${sku}]`);
      }
      if (pattern.test(inventoryUnitId)) {
        throw new Error(`SECURITY_PATH_TRAVERSAL_DETECTED: inventoryUnitId contains prohibited characters: [${inventoryUnitId}]`);
      }
    }

    const key = `${sku.trim()}::${inventoryUnitId.trim()}`;
    const sanitizedSku = sku.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const sanitizedUnit = inventoryUnitId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    const keyHash = computeSha256Hex(key).substring(0, 12);
    const safeFolder = `rec_${sanitizedSku}__${sanitizedUnit}__${keyHash}`;

    return { safeFolder, key };
  }

  /**
   * Resolves a path and enforces that it stays strictly within the records directory
   */
  private async resolveContainedPath(...segments: string[]): Promise<string> {
    await this.initialize();
    const { fs, path } = await getNodeFsModules();
    const resolved = path.resolve(this.recordsDirectory!, ...segments);
    const resolvedRecords = path.resolve(this.recordsDirectory!);

    if (!isContainedPath(resolvedRecords, resolved, path)) {
      throw new Error(`SECURITY_PATH_TRAVERSAL_PREVENTED: Path [${resolved}] escapes isolated records root.`);
    }

    verifyNoSymlinkEscaping(resolved, resolvedRecords, fs, path);
    return resolved;
  }

  /**
   * Calculates total disk usage within the isolated root directory
   */
  private async calculateDirectoryBytes(dirPath: string): Promise<number> {
    const { fs, path } = await getNodeFsModules();
    let totalBytes = 0;

    if (!fs.existsSync(dirPath)) return 0;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalBytes += await this.calculateDirectoryBytes(fullPath);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;
      }
    }
    return totalBytes;
  }

  public async getStorageMetrics(): Promise<{
    usedBytes: number;
    recordCount: number;
    backendType: 'WINDOWS_LOCAL_FS';
  }> {
    await this.initialize();
    const { fs } = await getNodeFsModules();

    const usedBytes = await this.calculateDirectoryBytes(this.recordsDirectory!);
    let recordCount = 0;

    if (fs.existsSync(this.recordsDirectory!)) {
      const entries = fs.readdirSync(this.recordsDirectory!, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('rec_')) {
          recordCount++;
        }
      }
    }

    return {
      usedBytes,
      recordCount,
      backendType: 'WINDOWS_LOCAL_FS'
    };
  }

  /**
   * Saves record to isolated filesystem using atomic staging and read-back verification.
   */
  public async saveRecord(record: PhotoEvidenceVaultRecord): Promise<PersistenceSaveResult> {
    await this.initialize();
    const { fs, path } = await getNodeFsModules();

    // 1. Failure Injections: Simulated conditions
    if (this.config?.simulatePermissionDenied) {
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: '【模擬障害】ファイルシステムへの書き込み権限がありません（EACCES_SIMULATED）。',
        error: 'EACCES_PERMISSION_DENIED_SIMULATED'
      };
    }

    if (this.config?.simulateDiskFull) {
      return {
        success: false,
        status: 'FAILED_DISK_FULL',
        messageJa: '【模擬障害】ディスク空き容量不足のため永続保存が拒否されました。',
        error: 'DISK_FULL_SIMULATED'
      };
    }

    if (this.config?.simulateWriteError) {
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: '【模擬障害】ファイルシステム書き込み中にI/Oエラーが発生しました。',
        error: 'WRITE_IO_ERROR_SIMULATED'
      };
    }

    // 2. Validate Identifiers & Traversal
    let safeFolder: string;
    try {
      const validated = this.validateIdentifiers(record.sku, record.inventoryUnitId);
      safeFolder = validated.safeFolder;
    } catch (err: any) {
      return {
        success: false,
        status: 'HOLD_UNCONFIRMED_ID',
        messageJa: `安全検査エラー: ${err.message}`,
        error: err.message
      };
    }

    const finalRecordDir = await this.resolveContainedPath(safeFolder);
    const stagingDir = await this.resolveContainedPath(
      `${safeFolder}.staging_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    );

    // Check quota if configured
    if (this.config?.maxCapacityBytes) {
      const currentBytes = await this.calculateDirectoryBytes(this.recordsDirectory!);
      const recordJson = JSON.stringify(record);
      if (currentBytes + recordJson.length > this.config.maxCapacityBytes) {
        return {
          success: false,
          status: 'FAILED_DISK_FULL',
          messageJa: `【容量超過】設定された模擬ストレージ上限（${Math.round(this.config.maxCapacityBytes / 1024)}KB）を超過しました。`,
          error: 'STORAGE_QUOTA_EXCEEDED'
        };
      }
    }

    try {
      // 3. Create Staging Area
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
      fs.mkdirSync(stagingDir, { recursive: true });

      const rawDir = path.join(stagingDir, 'raw');
      const workingDir = path.join(stagingDir, 'working');
      const thumbsDir = path.join(stagingDir, 'thumbs');
      fs.mkdirSync(rawDir, { recursive: true });
      fs.mkdirSync(workingDir, { recursive: true });
      fs.mkdirSync(thumbsDir, { recursive: true });

      // 4. Save Raw, Derivative, and Thumbnail Assets Separately
      const photosDict = record.photos as Record<PhotoAngle, PhotoEvidenceEntry | undefined>;
      const angles = Object.keys(photosDict) as PhotoAngle[];
      for (const angle of angles) {
        const entry = photosDict[angle];
        if (!entry) continue;

        // Raw Image Payload & Metadata
        const rawPayloadPath = path.join(rawDir, `raw_${angle}.dat`);
        const rawMetaPath = path.join(rawDir, `raw_${angle}.meta.json`);

        let rawPayload = entry.originalAsset.dataUrl;
        if (this.config?.simulateCorruptedRawFile) {
          rawPayload += '_CORRUPTED_TAMPERED_BYTES';
        }

        if (!this.config?.simulateMissingRawFile) {
          fs.writeFileSync(rawPayloadPath, rawPayload, 'utf8');
        }

        fs.writeFileSync(
          rawMetaPath,
          JSON.stringify(
            {
              assetId: entry.originalAsset.assetId,
              angle,
              capturedAt: entry.originalAsset.capturedAt,
              sha256Checksum: entry.originalAsset.sha256Checksum,
              byteSize: entry.originalAsset.byteSize,
              mimeType: entry.originalAsset.mimeType,
              isImmutable: true
            },
            null,
            2
          ),
          'utf8'
        );

        // Derivative Working Image
        if (entry.workingAsset) {
          const wrkPayloadPath = path.join(workingDir, `wrk_${angle}.dat`);
          const wrkMetaPath = path.join(workingDir, `wrk_${angle}.meta.json`);
          fs.writeFileSync(wrkPayloadPath, entry.workingAsset.dataUrl, 'utf8');
          fs.writeFileSync(
            wrkMetaPath,
            JSON.stringify(
              {
                assetId: entry.workingAsset.assetId,
                angle,
                sourceOriginalAssetId: entry.workingAsset.sourceOriginalAssetId,
                sha256Checksum: entry.workingAsset.sha256Checksum,
                autoFixAppliedCount: entry.workingAsset.autoFixAppliedCount
              },
              null,
              2
            ),
            'utf8'
          );
        }

        // Thumbnail
        if (entry.thumbnailAsset) {
          const thmPath = path.join(thumbsDir, `thm_${angle}.json`);
          fs.writeFileSync(thmPath, JSON.stringify(entry.thumbnailAsset, null, 2), 'utf8');
        }
      }

      // 5. Write Manifest to Temporary File First with COMMITTED_PERSISTED status
      const manifestPath = path.join(stagingDir, 'manifest.json');
      const manifestTmpPath = path.join(stagingDir, 'manifest.json.tmp');

      const committedRecord: PhotoEvidenceVaultRecord = {
        ...record,
        status: 'COMMITTED_PERSISTED',
        committedAt: record.committedAt || new Date().toISOString()
      };

      let manifestContent = JSON.stringify(committedRecord, null, 2);
      if (this.config?.simulateCorruptedManifest) {
        manifestContent = manifestContent.substring(0, Math.floor(manifestContent.length / 2)); // Corrupt JSON
      }

      fs.writeFileSync(manifestTmpPath, manifestContent, 'utf8');

      // Failure Injection: Midway Abort (Interrupt before atomic rename/commit marker)
      if (this.config?.simulateMidwayAbort) {
        return {
          success: false,
          status: 'FAILED_WRITE_ERROR',
          messageJa: '【模擬障害】書き込み途中の中断（電源断・プロセス強制終了）が発生しました。',
          error: 'MIDWAY_PROCESS_ABORT_SIMULATED'
        };
      }

      // Rename tmp to manifest.json
      fs.renameSync(manifestTmpPath, manifestPath);

      // Write Commit Marker
      if (!this.config?.simulateMissingCommitMarker) {
        const commitMarkerPath = path.join(stagingDir, 'manifest.commit');
        fs.writeFileSync(
          commitMarkerPath,
          JSON.stringify(
            {
              recordId: record.recordId,
              recordChecksum: record.recordChecksum,
              committedAt: new Date().toISOString(),
              storageVersion: record.storageVersion,
              totalPhotos: record.totalPhotoCount
            },
            null,
            2
          ),
          'utf8'
        );
      }

      // 6. Atomic Publication to Final Record Directory
      const backupDir = `${finalRecordDir}.prev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      let hadPrevious = false;
      if (fs.existsSync(finalRecordDir)) {
        fs.renameSync(finalRecordDir, backupDir);
        hadPrevious = true;
      }

      try {
        fs.renameSync(stagingDir, finalRecordDir);
      } catch (publishErr) {
        // Rollback from backup if rename failed
        if (hadPrevious && fs.existsSync(backupDir)) {
          fs.renameSync(backupDir, finalRecordDir);
        }
        throw publishErr;
      }

      // Failure Injection: Simulated Read-Back Failure
      if (this.config?.simulateReadBackFailure) {
        if (fs.existsSync(finalRecordDir)) {
          fs.rmSync(finalRecordDir, { recursive: true, force: true });
        }
        if (hadPrevious && fs.existsSync(backupDir)) {
          fs.renameSync(backupDir, finalRecordDir);
        }
        return {
          success: false,
          status: 'FAILED_WRITE_ERROR',
          messageJa: '【模擬障害】読み戻し検証時の不一致を検出し、元の正常レコードへロールバックしました。',
          error: 'READ_BACK_VERIFICATION_FAILED_SIMULATED'
        };
      }

      // 7. Immediate Read-Back and Integrity Verification (Requirement 9)
      const readBackResult = await this.loadRecord(record.sku, record.inventoryUnitId);
      if (!readBackResult.success || !readBackResult.record) {
        // Rollback from backup to protect existing good data
        if (fs.existsSync(finalRecordDir)) {
          fs.rmSync(finalRecordDir, { recursive: true, force: true });
        }
        if (hadPrevious && fs.existsSync(backupDir)) {
          fs.renameSync(backupDir, finalRecordDir);
        }
        return {
          success: false,
          status: readBackResult.status,
          messageJa: `ディスク書き込み後の読み戻し整合性検証に失敗したためロールバックしました: ${readBackResult.messageJa}`,
          error: readBackResult.error || 'READ_BACK_VERIFICATION_FAILED'
        };
      }

      // Cleanup backup only after read-back verification passes
      if (hadPrevious && fs.existsSync(backupDir)) {
        fs.rmSync(backupDir, { recursive: true, force: true });
      }

      const committedBytes = await this.calculateDirectoryBytes(finalRecordDir);

      return {
        success: true,
        status: 'COMMITTED_PERSISTED',
        recordId: record.recordId,
        recordChecksum: record.recordChecksum,
        committedBytes,
        messageJa: `💾 【${record.sku} (${record.inventoryUnitId})】の原本写真証拠（${record.totalPhotoCount}枚）をWindows隔離テスト領域にアトミック保存・検証しました。`
      };
    } catch (err: any) {
      // Clean up incomplete staging
      if (fs.existsSync(stagingDir)) {
        try {
          fs.rmSync(stagingDir, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: `ディスク書き込み中に例外が発生しました: ${err.message}`,
        error: err.message
      };
    }
  }

  /**
   * Loads a record from the isolated filesystem, enforcing commit marker and cryptographic checks.
   */
  public async loadRecord(sku: string, inventoryUnitId: string): Promise<PersistenceLoadResult> {
    await this.initialize();
    const { fs, path } = await getNodeFsModules();

    // 1. Validate Identifiers
    let safeFolder: string;
    try {
      const validated = this.validateIdentifiers(sku, inventoryUnitId);
      safeFolder = validated.safeFolder;
    } catch (err: any) {
      return {
        success: false,
        status: 'HOLD_UNCONFIRMED_ID',
        messageJa: `安全検査エラー: ${err.message}`,
        error: err.message
      };
    }

    const recordDir = await this.resolveContainedPath(safeFolder);
    if (!fs.existsSync(recordDir)) {
      return {
        success: false,
        status: 'HOLD_UNCONFIRMED_ID',
        messageJa: `該当個体（${sku}::${inventoryUnitId}）の正式保存レコードは存在しません。`,
        error: 'RECORD_NOT_FOUND'
      };
    }

    // 2. Verify Commit Marker
    const commitMarkerPath = path.join(recordDir, 'manifest.commit');
    if (!fs.existsSync(commitMarkerPath)) {
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: '【未完了書込検知】コミットマーカーが存在しません。書き込み途中で中断されたレコードです。',
        error: 'MISSING_COMMIT_MARKER'
      };
    }

    // 3. Read and Parse Manifest
    const manifestPath = path.join(recordDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        success: false,
        status: 'FAILED_WRITE_ERROR',
        messageJa: '【破損検知】マニフェストファイル（manifest.json）が見つかりません。',
        error: 'MISSING_MANIFEST'
      };
    }

    let record: PhotoEvidenceVaultRecord;
    try {
      const manifestStr = fs.readFileSync(manifestPath, 'utf8');
      record = JSON.parse(manifestStr);
    } catch (err: any) {
      return {
        success: false,
        status: 'HOLD_CORRUPTED_CHECKSUM',
        messageJa: `【破損検知】保存レコードのJSONパースに失敗しました: ${err.message}`,
        error: 'INVALID_JSON_RECORD'
      };
    }

    // 4. Strict SKU and InventoryUnitId Cross-Pollution Check
    if (record.sku !== sku || record.inventoryUnitId !== inventoryUnitId) {
      return {
        success: false,
        status: 'HOLD_CROSS_POLLUTION',
        record,
        messageJa: `【個体不一致検知】要求された個体（${sku}::${inventoryUnitId}）と保存レコード（${record.sku}::${record.inventoryUnitId}）が異なります。`,
        error: 'CROSS_UNIT_POLLUTION_DETECTED'
      };
    }

    // 5. Read Back and Verify Raw Files & Individual Hashes
    const rawDir = path.join(recordDir, 'raw');
    const photosDict = record.photos as Record<PhotoAngle, PhotoEvidenceEntry | undefined>;
    const angles = Object.keys(photosDict) as PhotoAngle[];

    for (const angle of angles) {
      const entry = photosDict[angle];
      if (!entry) continue;

      const rawPayloadPath = path.join(rawDir, `raw_${angle}.dat`);
      if (!fs.existsSync(rawPayloadPath)) {
        return {
          success: false,
          status: 'HOLD_CORRUPTED_CHECKSUM',
          record,
          messageJa: `【原本欠落検知】アングル [${angle}] の原本画像ファイルが見つかりません。`,
          error: `MISSING_RAW_FILE_${angle}`
        };
      }

      const fileData = fs.readFileSync(rawPayloadPath, 'utf8');
      const computedRawHash = computeSha256Hex(fileData);

      if (computedRawHash !== entry.originalAsset.sha256Checksum) {
        return {
          success: false,
          status: 'HOLD_CORRUPTED_CHECKSUM',
          record,
          messageJa: `【原本改変検知】アングル [${angle}] の原本画像ハッシュ（${computedRawHash.substring(0, 10)}...）がメタデータ記録（${entry.originalAsset.sha256Checksum.substring(0, 10)}...）と不一致です。`,
          error: `RAW_HASH_MISMATCH_${angle}`
        };
      }

      // Keep payload restored in record
      entry.originalAsset.dataUrl = fileData;
    }

    // 6. Verify Overall Record Checksum
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

    record.status = 'COMMITTED_PERSISTED';

    return {
      success: true,
      status: 'COMMITTED_PERSISTED',
      record,
      messageJa: `✅ 【${record.sku} (${record.inventoryUnitId})】の原本写真証拠（${record.totalPhotoCount}枚）をWindows隔離テスト領域から整合性検証の上、正常にロードしました。`
    };
  }

  public async listSummaries(): Promise<PhotoEvidenceVaultSummary[]> {
    await this.initialize();
    const { fs, path } = await getNodeFsModules();
    const summaries: PhotoEvidenceVaultSummary[] = [];

    if (!fs.existsSync(this.recordsDirectory!)) return summaries;

    const entries = fs.readdirSync(this.recordsDirectory!, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.startsWith('rec_')) continue;

      const manifestPath = path.join(this.recordsDirectory!, entry.name, 'manifest.json');
      const commitPath = path.join(this.recordsDirectory!, entry.name, 'manifest.commit');

      if (!fs.existsSync(manifestPath) || !fs.existsSync(commitPath)) continue;

      try {
        const r: PhotoEvidenceVaultRecord = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
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
        // Skip malformed
      }
    }

    return summaries;
  }

  public async deleteRecord(sku: string, inventoryUnitId: string): Promise<boolean> {
    await this.initialize();
    const { fs } = await getNodeFsModules();

    const { safeFolder } = this.validateIdentifiers(sku, inventoryUnitId);
    const recordDir = await this.resolveContainedPath(safeFolder);

    if (fs.existsSync(recordDir)) {
      fs.rmSync(recordDir, { recursive: true, force: true });
      return true;
    }
    return false;
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
   * Safe boundary cleanup: Strictly deletes ONLY the directory created by this adapter,
   * after validating the marker file.
   */
  public async cleanupIsolatedDirectory(): Promise<{ cleaned: boolean; path: string | null; reason?: string }> {
    if (!this.rootDirectory) {
      return { cleaned: false, path: null, reason: 'NOT_INITIALIZED' };
    }

    const { fs, path, os } = await getNodeFsModules();
    const resolvedRoot = path.resolve(this.rootDirectory);
    const resolvedTmp = path.resolve(os.tmpdir());

    // Boundary check 1: Must be strictly within os.tmpdir() unless explicit baseDirectory
    if (!this.options.baseDirectory && !isContainedPath(resolvedTmp, resolvedRoot, path)) {
      return { cleaned: false, path: resolvedRoot, reason: 'SECURITY_REFUSED_OUTSIDE_TMP' };
    }

    // Boundary check 2: Must contain marker file
    const markerPath = path.join(resolvedRoot, MARKER_FILENAME);
    if (!fs.existsSync(markerPath)) {
      return { cleaned: false, path: resolvedRoot, reason: 'SECURITY_REFUSED_MISSING_MARKER' };
    }

    // Boundary check 3: Must match naming convention
    const baseName = path.basename(resolvedRoot);
    if (!baseName.startsWith('jth-evidence-vault-tests')) {
      return { cleaned: false, path: resolvedRoot, reason: 'SECURITY_REFUSED_UNRECOGNIZED_PREFIX' };
    }

    // Boundary check 4: Verify no symlink escaping
    try {
      verifyNoSymlinkEscaping(resolvedRoot, resolvedTmp, fs, path);
    } catch {
      return { cleaned: false, path: resolvedRoot, reason: 'SECURITY_REFUSED_SYMLINK_DETECTED' };
    }

    // Safe deletion
    fs.rmSync(resolvedRoot, { recursive: true, force: true });
    const cleanedPath = this.rootDirectory;
    this.rootDirectory = null;
    this.recordsDirectory = null;
    this.isInitialized = false;

    return { cleaned: true, path: cleanedPath };
  }
}
