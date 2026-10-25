/**
 * Automated Test Suite for Windows Isolated Filesystem Persistence & Multi-Process Cold Recovery (JTH-STEP 36)
 *
 * Verifies:
 * 1. Safe isolated directory creation under OS tmpdir with proof marker
 * 2. Separation of raw immutable byte files, derivative working assets, and thumbnails
 * 3. Security: Path traversal rejection (illegal characters, relative paths, null bytes)
 * 4. Atomic staging, rename publication, and read-back integrity verification
 * 5. Out-of-process cold recovery: Spawns a separate Node.js process with zero shared memory
 * 6. Disclaimer verification: Accurately reflects OS process boundary without claiming PC power-cut proof
 * 7. Failure injection: Raw photo tampering, corrupted manifest, missing raw file, missing commit marker
 * 8. Failure injection: Cross-unit mix-up rejection, simulated quota limits, permission denial
 * 9. Boundary-verified safe cleanup: Deletes ONLY the isolated test directory after marker validation
 */

declare const process: any;

import {
  WindowsIsolatedFsEvidencePersistenceAdapter,
  getNodeFsModules,
  isContainedPath,
  verifyNoSymlinkEscaping
} from '../windowsIsolatedFsEvidenceAdapter';
import {
  PhotoEvidenceVaultService,
  computeSha256Hex,
  calculateRecordChecksum
} from '../photoEvidenceVaultService';
import type { PhotoAngle, CapturedPhoto, PhotoCaptureTargetContext } from '../../types/photoCapture';
import type { PhotoEvidenceVaultRecord } from '../../types/photoEvidenceVault';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

/**
 * Generates synthetic small test photos with deterministic contents
 */
function createSyntheticCapturedPhoto(params: {
  id: string;
  angle: PhotoAngle;
  sku: string;
  inventoryUnitId: string;
  pattern: string;
}): CapturedPhoto {
  const { id, angle, sku, inventoryUnitId, pattern } = params;
  const rawSvg = `data:image/svg+xml;utf8,<svg id="raw-${id}-${angle}" data-pattern="${pattern}"><rect width="100" height="100" fill="#2563eb"/></svg>`;
  const correctedSvg = `data:image/svg+xml;utf8,<svg id="fixed-${id}-${angle}" data-pattern="${pattern}"><rect width="100" height="100" fill="#38bdf8"/></svg>`;

  return {
    id,
    angle,
    timestamp: '2026-10-25T13:00:00.000Z',
    dataUrl: correctedSvg,
    originalDataUrl: rawSvg,
    sku,
    inventoryUnitId,
    autoFixCount: 1,
    qaResult: {
      status: 'USE_AS_IS',
      issues: [],
      metrics: { blurScore: 12, brightness: 120, framingCoverage: 98, glareScore: 2 },
      suggestedAction: '合格'
    }
  };
}

function createContextPhotos(ctx: PhotoCaptureTargetContext): Record<PhotoAngle, CapturedPhoto | null> {
  return {
    FRONT: createSyntheticCapturedPhoto({
      id: 'P-01',
      angle: 'FRONT',
      sku: ctx.sku!,
      inventoryUnitId: ctx.inventoryUnitId!,
      pattern: 'FRONT_PATTERN'
    }),
    BACK: createSyntheticCapturedPhoto({
      id: 'P-02',
      angle: 'BACK',
      sku: ctx.sku!,
      inventoryUnitId: ctx.inventoryUnitId!,
      pattern: 'BACK_PATTERN'
    }),
    LEFT: null,
    RIGHT: null,
    TOP: null,
    LABEL_TAG: null,
    DEFECT_DETAIL: null
  };
}

export async function runWindowsFsPersistenceTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      passed++;
      log.push(`✅ ${name}`);
    } catch (err: any) {
      failed++;
      log.push(`❌ ${name}: ${err.message}`);
    }
  };

  const dynamicImport = new Function('mod', 'return import(mod)');
  let adapter: WindowsIsolatedFsEvidencePersistenceAdapter | null = null;
  let testRootDirectory: string | null = null;

  const sampleContext: PhotoCaptureTargetContext = {
    sku: 'SKU-DISC-TEST-001',
    inventoryUnitId: 'UNIT-VLT-9001',
    itemTitle: 'Windows実ディスク検証用 模擬オーディオ機材',
    isConfirmed: true
  };

  const samplePhotos: Record<PhotoAngle, CapturedPhoto | null> = {
    FRONT: createSyntheticCapturedPhoto({
      id: 'P-01',
      angle: 'FRONT',
      sku: sampleContext.sku!,
      inventoryUnitId: sampleContext.inventoryUnitId!,
      pattern: 'FRONT_FACE_PATTERN'
    }),
    BACK: createSyntheticCapturedPhoto({
      id: 'P-02',
      angle: 'BACK',
      sku: sampleContext.sku!,
      inventoryUnitId: sampleContext.inventoryUnitId!,
      pattern: 'BACK_CONNECTOR_PATTERN'
    }),
    LEFT: createSyntheticCapturedPhoto({
      id: 'P-03',
      angle: 'LEFT',
      sku: sampleContext.sku!,
      inventoryUnitId: sampleContext.inventoryUnitId!,
      pattern: 'LEFT_CHASSIS_PATTERN'
    }),
    RIGHT: null,
    TOP: null,
    LABEL_TAG: createSyntheticCapturedPhoto({
      id: 'P-06',
      angle: 'LABEL_TAG',
      sku: sampleContext.sku!,
      inventoryUnitId: sampleContext.inventoryUnitId!,
      pattern: 'SERIAL_LABEL_PATTERN'
    }),
    DEFECT_DETAIL: null
  };

  // Test 1: Isolated Directory Creation & Boundary Verification
  await test('Test 1: Creates non-colliding isolated test directory under OS tmpdir with safety marker', async () => {
    adapter = new WindowsIsolatedFsEvidencePersistenceAdapter({
      runId: `step36_${Date.now()}`
    });

    testRootDirectory = await adapter.initialize();
    assert(Boolean(testRootDirectory), 'Isolated directory path must be resolved');

    const { fs, path, os } = await getNodeFsModules();
    const systemTmp = os.tmpdir();
    assert(
      path.resolve(testRootDirectory!).startsWith(path.resolve(systemTmp)),
      `Directory [${testRootDirectory}] must be safely inside OS tmpdir [${systemTmp}]`
    );

    const markerPath = path.join(testRootDirectory!, 'JTH_VAULT_ISOLATED_TEST_ROOT.marker');
    assert(fs.existsSync(markerPath), 'Safety marker file must be created at root');

    const markerContent = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    assert(markerContent.safeForTestingOnly === true, 'Marker must indicate safe for testing only');
  });

  // Test 2: Storage Separation of Raw, Derivative, and Thumbnail Assets
  await test('Test 2: Raw byte payload and derivatives are saved in distinct files with checksum linking', async () => {
    assert(adapter !== null, 'Adapter must be initialized');

    const service = new PhotoEvidenceVaultService(adapter!);
    const buildRes = service.buildVaultRecord(sampleContext, samplePhotos);
    assert(buildRes.success && buildRes.record !== undefined, 'Record building must succeed');

    const record = buildRes.record!;
    const saveRes = await adapter!.saveRecord(record);
    assert(saveRes.success, `Save must succeed, got: ${saveRes.messageJa}`);
    assert(saveRes.status === 'COMMITTED_PERSISTED', 'Status must be COMMITTED_PERSISTED');

    const { fs, path } = await getNodeFsModules();
    const { safeFolder } = adapter!.validateIdentifiers(sampleContext.sku!, sampleContext.inventoryUnitId!);
    const recordDir = path.join(testRootDirectory!, 'records', safeFolder);

    // Verify subdirectories exist
    assert(fs.existsSync(path.join(recordDir, 'raw')), 'raw/ directory must exist');
    assert(fs.existsSync(path.join(recordDir, 'working')), 'working/ directory must exist');
    assert(fs.existsSync(path.join(recordDir, 'thumbs')), 'thumbs/ directory must exist');

    // Verify raw file and metadata
    const rawFront = path.join(recordDir, 'raw', 'raw_FRONT.dat');
    const rawFrontMeta = path.join(recordDir, 'raw', 'raw_FRONT.meta.json');
    assert(fs.existsSync(rawFront), 'raw_FRONT.dat must exist');
    assert(fs.existsSync(rawFrontMeta), 'raw_FRONT.meta.json must exist');

    const rawData = fs.readFileSync(rawFront, 'utf8');
    const frontEntry = record.photos.FRONT!;
    assert(rawData === frontEntry.originalAsset.dataUrl, 'Raw file content must match captured originalDataUrl');
    assert(computeSha256Hex(rawData) === frontEntry.originalAsset.sha256Checksum, 'Raw file SHA-256 must match recorded checksum');

    // Verify working file and thumbnail
    const wrkFront = path.join(recordDir, 'working', 'wrk_FRONT.dat');
    assert(fs.existsSync(wrkFront), 'wrk_FRONT.dat must exist');

    const thmFront = path.join(recordDir, 'thumbs', 'thm_FRONT.json');
    assert(fs.existsSync(thmFront), 'thm_FRONT.json must exist');

    // Verify commit marker
    assert(fs.existsSync(path.join(recordDir, 'manifest.commit')), 'manifest.commit marker must exist');
  });

  // Test 3: Path Traversal Defense
  await test('Test 3: Enforces strict path traversal rejection against relative paths, colons, and null bytes', () => {
    assert(adapter !== null, 'Adapter must be initialized');

    const dangerousSkus = [
      '../escape_dir',
      '..\\escape_win',
      'C:\\Windows\\System32',
      'COM1:',
      'SKU\0NULLBYTE',
      'folder/sub/sku',
      'folder\\sub\\sku'
    ];

    for (const badSku of dangerousSkus) {
      let caught = false;
      try {
        adapter!.validateIdentifiers(badSku, 'UNIT-VALID');
      } catch (err: any) {
        caught = true;
        assert(
          err.message.includes('SECURITY_PATH_TRAVERSAL_DETECTED') || err.message.includes('IDENTIFIER_EMPTY'),
          `Error must indicate path traversal detection for [${badSku}], got: ${err.message}`
        );
      }
      assert(caught, `Path traversal attempt with SKU [${badSku}] must be strictly rejected`);
    }

    const dangerousUnits = [
      '../../secret',
      '..\\..\\secret',
      'D:/root',
      'UNIT\0ESCAPE',
      'unit:sub'
    ];

    for (const badUnit of dangerousUnits) {
      let caught = false;
      try {
        adapter!.validateIdentifiers('SKU-VALID', badUnit);
      } catch (err: any) {
        caught = true;
        assert(
          err.message.includes('SECURITY_PATH_TRAVERSAL_DETECTED'),
          `Error must indicate path traversal detection for unit [${badUnit}], got: ${err.message}`
        );
      }
      assert(caught, `Path traversal attempt with Unit ID [${badUnit}] must be strictly rejected`);
    }
  });

  // Test 4: Atomic Commit & Immediate Read-Back Integrity
  await test('Test 4: Atomic commit staging and immediate read-back verification guarantees zero partial state', async () => {
    assert(adapter !== null, 'Adapter must be initialized');

    // Load back the record saved in Test 2
    const loadResult = await adapter!.loadRecord(sampleContext.sku!, sampleContext.inventoryUnitId!);
    assert(loadResult.success, `Load must succeed: ${loadResult.messageJa}`);
    assert(loadResult.status === 'COMMITTED_PERSISTED', 'Loaded status must be COMMITTED_PERSISTED');

    const loadedRec = loadResult.record!;
    assert(loadedRec.sku === sampleContext.sku, 'Loaded SKU must match');
    assert(loadedRec.inventoryUnitId === sampleContext.inventoryUnitId, 'Loaded Unit ID must match');
    assert(loadedRec.totalPhotoCount === 4, `Total photos must be 4, got: ${loadedRec.totalPhotoCount}`);

    const integrity = await adapter!.verifyIntegrity(sampleContext.sku!, sampleContext.inventoryUnitId!);
    assert(integrity.isValid, 'Integrity verification must return valid');
    assert(integrity.mismatchedAngles.length === 0, 'No mismatched angles allowed');
  });

  // Test 5: Out-of-Process Cold Recovery (別Node.jsプロセスによる共有メモリ非依存の検証)
  await test('Test 5: Out-of-process cold recovery verifies persistence via independent Node.js OS process', async () => {
    assert(testRootDirectory !== null, 'Test root directory must exist');

    const cp = await dynamicImport('node:child_process');
    const path = await dynamicImport('node:path');

    const cliPath = path.resolve('node_modules/tsx/dist/cli.mjs');
    const scriptPath = path.resolve('src/services/__tests__/standaloneFsReader.ts');

    const proc = (globalThis as any).process;
    const currentPid = proc.pid;

    // Execute standalone reader in a separate OS process
    const stdout = cp.execFileSync(
      proc.execPath,
      [
        cliPath,
        scriptPath,
        '--root',
        testRootDirectory!,
        '--sku',
        sampleContext.sku!,
        '--unit',
        sampleContext.inventoryUnitId!
      ],
      {
        encoding: 'utf8',
        timeout: 15000
      }
    );

    const parsed = JSON.parse(stdout.trim());
    assert(parsed.success === true, `Standalone process load must succeed, output: ${stdout}`);
    assert(parsed.processId !== currentPid, `Child process PID (${parsed.processId}) must differ from current PID (${currentPid})`);
    assert(parsed.sku === sampleContext.sku, 'Child process must recover matching SKU');
    assert(parsed.inventoryUnitId === sampleContext.inventoryUnitId, 'Child process must recover matching Unit ID');
    assert(parsed.totalPhotoCount === 4, 'Child process must verify 4 photo entries');
    assert(parsed.status === 'COMMITTED_PERSISTED', 'Child process must report COMMITTED_PERSISTED');

    // Note: Out-of-process verification validates memory decoupling, but does not claim hardware power-cut proof
    assert(
      !stdout.includes('HARDWARE_POWER_CUT_DURABILITY_PROVEN'),
      'Out-of-process verification must not claim hardware power cut proof'
    );
  });

  // Test 6: Failure Injection - Raw Photo File Tampering (原本改変検知)
  await test('Test 6: Injected raw byte corruption is detected and triggers HOLD_CORRUPTED_CHECKSUM', async () => {
    assert(adapter !== null && testRootDirectory !== null, 'Adapter and root must exist');

    const { fs, path } = await getNodeFsModules();
    const { safeFolder } = adapter!.validateIdentifiers(sampleContext.sku!, sampleContext.inventoryUnitId!);
    const rawFront = path.join(testRootDirectory!, 'records', safeFolder, 'raw', 'raw_FRONT.dat');

    // Tamper with the raw image payload on disk
    const originalBytes = fs.readFileSync(rawFront, 'utf8');
    fs.writeFileSync(rawFront, originalBytes + '<!-- TAMPERED_MALICIOUS_BYTES -->', 'utf8');

    try {
      const loadResult = await adapter!.loadRecord(sampleContext.sku!, sampleContext.inventoryUnitId!);
      assert(!loadResult.success, 'Load must fail when raw file is tampered');
      assert(loadResult.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');
      assert(loadResult.error === 'RAW_HASH_MISMATCH_FRONT', `Error must be RAW_HASH_MISMATCH_FRONT, got: ${loadResult.error}`);
    } finally {
      // Restore original file
      fs.writeFileSync(rawFront, originalBytes, 'utf8');
    }
  });

  // Test 7: Failure Injection - Manifest Corruption (メタデータ破損検知)
  await test('Test 7: Corrupted manifest JSON triggers HOLD_CORRUPTED_CHECKSUM with parse error', async () => {
    assert(adapter !== null && testRootDirectory !== null, 'Adapter and root must exist');

    const { fs, path } = await getNodeFsModules();
    const { safeFolder } = adapter!.validateIdentifiers(sampleContext.sku!, sampleContext.inventoryUnitId!);
    const manifestPath = path.join(testRootDirectory!, 'records', safeFolder, 'manifest.json');

    const validManifest = fs.readFileSync(manifestPath, 'utf8');
    fs.writeFileSync(manifestPath, validManifest.substring(0, 30), 'utf8'); // Incomplete JSON

    try {
      const loadResult = await adapter!.loadRecord(sampleContext.sku!, sampleContext.inventoryUnitId!);
      assert(!loadResult.success, 'Load must fail when manifest JSON is invalid');
      assert(loadResult.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');
      assert(loadResult.error === 'INVALID_JSON_RECORD', `Error must be INVALID_JSON_RECORD, got: ${loadResult.error}`);
    } finally {
      // Restore valid manifest
      fs.writeFileSync(manifestPath, validManifest, 'utf8');
    }
  });

  // Test 8: Failure Injection - Missing Raw File (原本欠落検知)
  await test('Test 8: Deleted raw file is detected upon load and triggers HOLD_CORRUPTED_CHECKSUM', async () => {
    assert(adapter !== null && testRootDirectory !== null, 'Adapter and root must exist');

    const { fs, path } = await getNodeFsModules();
    const { safeFolder } = adapter!.validateIdentifiers(sampleContext.sku!, sampleContext.inventoryUnitId!);
    const rawBack = path.join(testRootDirectory!, 'records', safeFolder, 'raw', 'raw_BACK.dat');

    const originalBack = fs.readFileSync(rawBack, 'utf8');
    fs.unlinkSync(rawBack);

    try {
      const loadResult = await adapter!.loadRecord(sampleContext.sku!, sampleContext.inventoryUnitId!);
      assert(!loadResult.success, 'Load must fail when raw file is missing');
      assert(loadResult.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');
      assert(loadResult.error === 'MISSING_RAW_FILE_BACK', `Error must be MISSING_RAW_FILE_BACK, got: ${loadResult.error}`);
    } finally {
      fs.writeFileSync(rawBack, originalBack, 'utf8');
    }
  });

  // Test 9: Failure Injection - Midway Write Abort & Missing Commit Marker
  await test('Test 9: Midway aborted write leaves no commit marker and prevents COMMITTED_PERSISTED', async () => {
    assert(testRootDirectory !== null, 'Root must exist');

    const abortAdapter = new WindowsIsolatedFsEvidencePersistenceAdapter({
      baseDirectory: testRootDirectory!,
      failureConfig: {
        simulateMidwayAbort: true
      }
    });

    const abortContext: PhotoCaptureTargetContext = {
      sku: 'SKU-MIDWAY-ABORT',
      inventoryUnitId: 'UNIT-ABORT-001',
      isConfirmed: true
    };

    const service = new PhotoEvidenceVaultService(abortAdapter);
    const buildRes = service.buildVaultRecord(abortContext, createContextPhotos(abortContext));
    assert(buildRes.success && buildRes.record !== undefined, 'Build record must succeed');

    const saveResult = await abortAdapter.saveRecord(buildRes.record!);
    assert(!saveResult.success, 'Save must fail when midway abort is simulated');
    assert(saveResult.status === 'FAILED_WRITE_ERROR', 'Status must be FAILED_WRITE_ERROR');
    assert(saveResult.error === 'MIDWAY_PROCESS_ABORT_SIMULATED', 'Error must be MIDWAY_PROCESS_ABORT_SIMULATED');

    // Attempting to load the uncommitted record must fail
    const loadResult = await abortAdapter.loadRecord(abortContext.sku!, abortContext.inventoryUnitId!);
    assert(!loadResult.success, 'Loading uncommitted record must fail');
  });

  // Test 10: Cross-Unit Pollution Prevention
  await test('Test 10: Loading with mismatched SKU or Unit ID returns not found and prevents cross-unit mixup', async () => {
    assert(adapter !== null, 'Adapter must exist');

    // Try to load with a different Unit ID
    const loadResult = await adapter!.loadRecord(sampleContext.sku!, 'UNIT-WRONG-OTHER-UNIT');
    assert(!loadResult.success, 'Load must fail for mismatched unit ID');
    assert(loadResult.status === 'HOLD_UNCONFIRMED_ID', 'Status must be HOLD_UNCONFIRMED_ID');
    assert(loadResult.error === 'RECORD_NOT_FOUND', 'Error must be RECORD_NOT_FOUND');
  });

  // Test 11: Storage Quota Failure Injection (Safe Quota Simulation without Filling OS Disk)
  await test('Test 11: Simulated storage quota limit safely rejects oversized saves with FAILED_DISK_FULL', async () => {
    assert(testRootDirectory !== null, 'Root must exist');

    const quotaAdapter = new WindowsIsolatedFsEvidencePersistenceAdapter({
      baseDirectory: testRootDirectory!,
      failureConfig: {
        maxCapacityBytes: 500 // Very small 500 bytes quota
      }
    });

    const quotaContext: PhotoCaptureTargetContext = {
      sku: 'SKU-QUOTA-TEST',
      inventoryUnitId: 'UNIT-QUOTA-001',
      isConfirmed: true
    };

    const service = new PhotoEvidenceVaultService(quotaAdapter);
    const buildRes = service.buildVaultRecord(quotaContext, createContextPhotos(quotaContext));
    assert(buildRes.success && buildRes.record !== undefined, 'Build record must succeed');

    const saveResult = await quotaAdapter.saveRecord(buildRes.record!);
    assert(!saveResult.success, 'Save must fail when storage quota is exceeded');
    assert(saveResult.status === 'FAILED_DISK_FULL', 'Status must be FAILED_DISK_FULL');
    assert(saveResult.error === 'STORAGE_QUOTA_EXCEEDED', 'Error must be STORAGE_QUOTA_EXCEEDED');
  });

  // Test 12: Permission Denial Failure Injection
  await test('Test 12: Injected filesystem permission error safely returns FAILED_WRITE_ERROR', async () => {
    assert(testRootDirectory !== null, 'Root must exist');

    const permAdapter = new WindowsIsolatedFsEvidencePersistenceAdapter({
      baseDirectory: testRootDirectory!,
      failureConfig: {
        simulatePermissionDenied: true
      }
    });

    const permContext: PhotoCaptureTargetContext = {
      sku: 'SKU-PERM-TEST',
      inventoryUnitId: 'UNIT-PERM-001',
      isConfirmed: true
    };

    const service = new PhotoEvidenceVaultService(permAdapter);
    const buildRes = service.buildVaultRecord(permContext, createContextPhotos(permContext));
    assert(buildRes.success && buildRes.record !== undefined, 'Build record must succeed');

    const saveResult = await permAdapter.saveRecord(buildRes.record!);
    assert(!saveResult.success, 'Save must fail when permission is denied');
    assert(saveResult.status === 'FAILED_WRITE_ERROR', 'Status must be FAILED_WRITE_ERROR');
    assert(saveResult.error === 'EACCES_PERMISSION_DENIED_SIMULATED', 'Error must be EACCES_PERMISSION_DENIED_SIMULATED');
  });

  // Test 13: Storage Metrics & Summaries Listing
  await test('Test 13: Accurate storage metrics calculation and summary listing on Windows filesystem', async () => {
    assert(adapter !== null, 'Adapter must exist');

    const metrics = await adapter!.getStorageMetrics();
    assert(metrics.backendType === 'WINDOWS_LOCAL_FS', 'Backend type must be WINDOWS_LOCAL_FS');
    assert(metrics.recordCount >= 1, `Record count must be at least 1, got: ${metrics.recordCount}`);
    assert(metrics.usedBytes > 0, `Used bytes must be greater than 0, got: ${metrics.usedBytes}`);

    const summaries = await adapter!.listSummaries();
    assert(summaries.length >= 1, 'Summaries list must have at least 1 entry');
    const targetSummary = summaries.find(
      (s) => s.sku === sampleContext.sku && s.inventoryUnitId === sampleContext.inventoryUnitId
    );
    assert(Boolean(targetSummary), 'Target record must be present in summaries');
    assert(targetSummary!.totalPhotoCount === 4, 'Summary photo count must match');
  });

  // Test 14: Windows Reserved Device Names Rejection (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  await test('Test 14: Rejects Windows reserved device names (CON, PRN, AUX, NUL, COM1, LPT1) as SKU or Unit ID', () => {
    assert(adapter !== null, 'Adapter must be initialized');

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM9', 'LPT1', 'lpt3', 'con.txt'];

    for (const resName of reservedNames) {
      let caughtSku = false;
      try {
        adapter!.validateIdentifiers(resName, 'UNIT-NORMAL');
      } catch (err: any) {
        caughtSku = true;
        assert(
          err.message.includes('SECURITY_RESERVED_DEVICE_NAME_DETECTED'),
          `Error must indicate reserved device name for SKU [${resName}], got: ${err.message}`
        );
      }
      assert(caughtSku, `Reserved device name SKU [${resName}] must be rejected`);

      let caughtUnit = false;
      try {
        adapter!.validateIdentifiers('SKU-NORMAL', resName);
      } catch (err: any) {
        caughtUnit = true;
        assert(
          err.message.includes('SECURITY_RESERVED_DEVICE_NAME_DETECTED'),
          `Error must indicate reserved device name for Unit ID [${resName}], got: ${err.message}`
        );
      }
      assert(caughtUnit, `Reserved device name Unit ID [${resName}] must be rejected`);
    }
  });

  // Test 15: Strict Path Containment & Adjacent Directory Prefix Collision Defense
  await test('Test 15: isContainedPath strictly blocks adjacent directory prefix collisions and escaping', async () => {
    const { path } = await getNodeFsModules();
    const baseDir = path.resolve('C:\\SafeVault\\Records');

    // 1. Legitimate subdirectories and files
    assert(isContainedPath(baseDir, path.join(baseDir, 'rec_001'), path) === true, 'Subdirectory must be contained');
    assert(isContainedPath(baseDir, path.join(baseDir, 'rec_001', 'manifest.json'), path) === true, 'Sub-file must be contained');
    assert(isContainedPath(baseDir, baseDir, path) === true, 'Base directory itself must be contained');

    // 2. Adjacent folder with matching prefix (e.g., Records-Evil vs Records)
    const adjacentEvil = path.resolve('C:\\SafeVault\\Records-Evil');
    assert(isContainedPath(baseDir, adjacentEvil, path) === false, 'Adjacent directory with shared prefix must be REJECTED');

    // 3. Parent escape (..)
    const parentEscape = path.resolve(baseDir, '..', 'Other');
    assert(isContainedPath(baseDir, parentEscape, path) === false, 'Parent escape must be REJECTED');

    // 4. Windows different drive letters
    const otherDrive = path.resolve('D:\\SafeVault\\Records');
    assert(isContainedPath(baseDir, otherDrive, path) === false, 'Different drive letter must be REJECTED');
  });

  // Test 16: Symlink & Reparse Point Redirection Defense
  await test('Test 16: verifyNoSymlinkEscaping detects and rejects symlinks resolving outside boundary', async () => {
    const { fs, path } = await getNodeFsModules();
    const baseDir = testRootDirectory!;

    // Normal safe file
    const safeFilePath = path.join(baseDir, 'JTH_VAULT_ISOLATED_TEST_ROOT.marker');
    let normalPassed = false;
    try {
      verifyNoSymlinkEscaping(safeFilePath, baseDir, fs, path);
      normalPassed = true;
    } catch {
      normalPassed = false;
    }
    assert(normalPassed, 'Normal non-symlink file must pass verification');

    // Simulated symlink object check
    const mockFsWithSymlink: any = {
      existsSync: () => true,
      lstatSync: () => ({
        isSymbolicLink: () => true,
        isDirectory: () => false,
        isFile: () => false,
        size: 0
      }),
      realpathSync: () => 'C:\\Windows\\System32\\cmd.exe'
    };

    let symlinkBlocked = false;
    try {
      verifyNoSymlinkEscaping('C:\\FakeSymlink', baseDir, mockFsWithSymlink, path);
    } catch (err: any) {
      symlinkBlocked = err.message.includes('SECURITY_SYMLINK_REDIRECTION_PREVENTED');
    }
    assert(symlinkBlocked, 'Symbolic link must be detected and rejected');
  });

  // Test 17: Rollback Protection on Update (Existing valid record preserved if update fails)
  await test('Test 17: Update failure during read-back preserves previous valid record without data loss', async () => {
    assert(testRootDirectory !== null, 'Root must exist');

    const rollbackAdapter = new WindowsIsolatedFsEvidencePersistenceAdapter({
      baseDirectory: testRootDirectory!
    });

    const rollbackContext: PhotoCaptureTargetContext = {
      sku: 'SKU-ROLLBACK-01',
      inventoryUnitId: 'UNIT-ROLLBACK-01',
      itemTitle: 'ロールバック保護検証用レコード',
      isConfirmed: true
    };

    const initialPhotos = createContextPhotos(rollbackContext);
    const service = new PhotoEvidenceVaultService(rollbackAdapter);

    // 1. Initial valid save
    const buildRes1 = service.buildVaultRecord(rollbackContext, initialPhotos);
    assert(buildRes1.success && buildRes1.record !== undefined, 'Initial build must succeed');
    const saveRes1 = await rollbackAdapter.saveRecord(buildRes1.record!);
    assert(saveRes1.success, 'Initial save must succeed');

    // Verify initial record is loaded
    const load1 = await rollbackAdapter.loadRecord(rollbackContext.sku!, rollbackContext.inventoryUnitId!);
    assert(load1.success && load1.record !== undefined, 'Initial record must be loadable');
    const initialChecksum = load1.record!.recordChecksum;

    // 2. Update with simulated read-back failure
    rollbackAdapter.setConfig({ simulateReadBackFailure: true });
    const saveRes2 = await rollbackAdapter.saveRecord(buildRes1.record!);
    assert(!saveRes2.success, 'Update save must fail due to simulated read-back failure');
    assert(saveRes2.error === 'READ_BACK_VERIFICATION_FAILED_SIMULATED', 'Error must indicate read-back failure');

    // 3. Verify that the previous valid record is STILL INTACT (Rollback succeeded)
    rollbackAdapter.resetConfig();
    const loadAfterFailedUpdate = await rollbackAdapter.loadRecord(rollbackContext.sku!, rollbackContext.inventoryUnitId!);
    assert(loadAfterFailedUpdate.success, 'Previous record must remain intact and loadable after failed update');
    assert(loadAfterFailedUpdate.record!.recordChecksum === initialChecksum, 'Checksum must match initial record exactly');
    assert(loadAfterFailedUpdate.record!.status === 'COMMITTED_PERSISTED', 'Status must remain COMMITTED_PERSISTED');
  });

  // Test 18: Concurrent Write Staging Isolation
  await test('Test 18: Distinct random staging paths prevent collision during concurrent save operations', async () => {
    assert(adapter !== null, 'Adapter must exist');

    const ctxA: PhotoCaptureTargetContext = { sku: 'SKU-CONCURRENT-A', inventoryUnitId: 'UNIT-CONCURRENT-A', isConfirmed: true };
    const ctxB: PhotoCaptureTargetContext = { sku: 'SKU-CONCURRENT-B', inventoryUnitId: 'UNIT-CONCURRENT-B', isConfirmed: true };

    const serviceA = new PhotoEvidenceVaultService(adapter!);
    const recA = serviceA.buildVaultRecord(ctxA, createContextPhotos(ctxA)).record!;
    const recB = serviceA.buildVaultRecord(ctxB, createContextPhotos(ctxB)).record!;

    // Parallel save invocation
    const [resA, resB] = await Promise.all([
      adapter!.saveRecord(recA),
      adapter!.saveRecord(recB)
    ]);

    assert(resA.success === true, 'Parallel save A must succeed');
    assert(resB.success === true, 'Parallel save B must succeed');

    // Load both records back
    const loadA = await adapter!.loadRecord(ctxA.sku!, ctxA.inventoryUnitId!);
    const loadB = await adapter!.loadRecord(ctxB.sku!, ctxB.inventoryUnitId!);

    assert(loadA.success === true && loadA.record?.sku === ctxA.sku, 'Record A must be independently verified');
    assert(loadB.success === true && loadB.record?.sku === ctxB.sku, 'Record B must be independently verified');
  });

  // Test 19: Safe Boundary Cleanup of Temporary Directory
  await test('Test 19: Boundary-verified cleanup removes ONLY the created test directory and refuses outside paths', async () => {
    assert(adapter !== null && testRootDirectory !== null, 'Adapter and test directory must exist');

    const { fs } = await getNodeFsModules();
    assert(fs.existsSync(testRootDirectory!), 'Test directory must exist before cleanup');

    const cleanupRes = await adapter!.cleanupIsolatedDirectory();
    assert(cleanupRes.cleaned === true, `Cleanup must succeed, got: ${cleanupRes.reason}`);
    assert(cleanupRes.path === testRootDirectory, 'Cleaned path must match root directory');
    assert(!fs.existsSync(testRootDirectory!), 'Test directory must be completely removed after cleanup');
  });

  return {
    passed,
    failed,
    log
  };
}
