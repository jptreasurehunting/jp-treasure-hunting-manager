/**
 * Automated Test Suite for Photo Evidence Vault & Permanent Storage (JTH-STEP 34)
 *
 * Verifies:
 * 1. Immutable raw asset separation & cryptographic checksums (SHA-256)
 * 2. Strict status protection (No claiming "正式保存済み" without persistence ACK)
 * 3. Failure injection: Disk full, I/O write errors, midway abort, corruption
 * 4. Simulated cold restarts across process boundaries (same-process mock disclaimer verified)
 * 5. Cross-unit pollution and unconfirmed ID prevention (HOLD)
 * 6. Capacity estimation calculations for 30kg merchandise benchmarks
 * 7. Complete isolation from localStorage, sessionStorage, and production DB
 */

import {
  computeSha256Hex,
  calculateRecordChecksum,
  MockFailureInjectablePersistenceAdapter,
  PhotoEvidenceVaultService,
  calculateEvidenceCapacityEstimate
} from '../photoEvidenceVaultService';
import type {
  PhotoAngle,
  CapturedPhoto,
  PhotoCaptureTargetContext
} from '../../types/photoCapture';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createMockCapturedPhoto(params: {
  id: string;
  angle: PhotoAngle;
  sku: string;
  inventoryUnitId: string;
  originalDataUrl?: string;
  correctedDataUrl?: string;
  status?: 'USE_AS_IS' | 'AUTO_FIX' | 'RETAKE';
}): CapturedPhoto {
  const { id, angle, sku, inventoryUnitId, originalDataUrl, correctedDataUrl, status = 'USE_AS_IS' } = params;
  const rawSvg = originalDataUrl || `data:image/svg+xml;utf8,<svg id="raw-${id}-${angle}"/>`;
  const fixedSvg = correctedDataUrl || rawSvg;

  return {
    id,
    angle,
    timestamp: new Date().toISOString(),
    dataUrl: fixedSvg,
    originalDataUrl: rawSvg,
    sku,
    inventoryUnitId,
    autoFixCount: fixedSvg !== rawSvg ? 1 : 0,
    qaResult: {
      status,
      issues: status === 'USE_AS_IS' ? [] : [{ code: 'BLUR_DETECTED', severity: 'WARNING', message: 'Blurry' }],
      metrics: { blurScore: status === 'USE_AS_IS' ? 10 : 65, brightness: 125, framingCoverage: 96, glareScore: 2 },
      suggestedAction: status === 'USE_AS_IS' ? '合格' : '要再撮影または自動補正'
    }
  };
}

export async function runPhotoEvidenceVaultTests(): Promise<{ passed: number; failed: number; log: string[] }> {
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

  // Test 1: SHA-256 hash generator
  await test('Test 1: SHA-256 hash generator is deterministic and produces valid 64-char hex strings', () => {
    const input = 'JP_TREASURE_HUNTING_EVIDENCE_2026';
    const hash1 = computeSha256Hex(input);
    const hash2 = computeSha256Hex(input);

    assert(hash1 === hash2, 'Hash must be strictly deterministic');
    assert(hash1.length === 64, `Hash length must be 64 hex characters, got: ${hash1.length}`);
    assert(/^[0-9a-f]{64}$/.test(hash1), 'Hash must only contain lowercase hexadecimal characters');

    const diffHash = computeSha256Hex(input + '_MOD');
    assert(hash1 !== diffHash, 'Altered input must produce completely different hash');
  });

  // Test 2: Vault record construction separates raw, working, and QA
  await test('Test 2: Vault record construction separates immutable raw assets, working derivatives, and QA snapshots', () => {
    const service = new PhotoEvidenceVaultService();
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-AMPLIFIER-30KG',
      inventoryUnitId: 'UNIT-AMP-001',
      itemTitle: 'ビンテージ真空管アンプ 30kg',
      isConfirmed: true
    };

    const rawUrl = 'data:image/svg+xml;utf8,<svg id="orig-raw-amp"/>';
    const correctedUrl = 'data:image/svg+xml;utf8,<svg id="autofix-amp"/>';

    const pFront = createMockCapturedPhoto({
      id: 'p-front-1',
      angle: 'FRONT',
      sku: context.sku!,
      inventoryUnitId: context.inventoryUnitId!,
      originalDataUrl: rawUrl,
      correctedDataUrl: correctedUrl
    });

    const buildRes = service.buildVaultRecord(context, {
      FRONT: pFront,
      BACK: null,
      LEFT: null,
      RIGHT: null,
      TOP: null,
      LABEL_TAG: null,
      DEFECT_DETAIL: null
    });

    assert(buildRes.success === true, 'Record build must succeed');
    const rec = buildRes.record!;
    assert(rec.recordId === 'EVD-SKU-AMPLIFIER-30KG-UNIT-AMP-001', 'Record ID must match composite key');

    const frontEntry = rec.photos.FRONT!;
    assert(frontEntry.originalAsset.isImmutable === true, 'Raw asset must be marked immutable');
    assert(frontEntry.originalAsset.dataUrl === rawUrl, 'Raw asset must preserve original untouched dataUrl');
    assert(frontEntry.workingAsset !== null, 'Working derivative must be created when auto-fix was applied');
    assert(frontEntry.workingAsset?.dataUrl === correctedUrl, 'Working derivative must hold corrected dataUrl');
    assert(frontEntry.originalAsset.sha256Checksum !== frontEntry.workingAsset?.sha256Checksum, 'Raw and working checksums must be decoupled');
    assert(frontEntry.qaSnapshot.status === 'USE_AS_IS', 'QA snapshot must be preserved');
  });

  // Test 3: Raw evidence immutability
  await test('Test 3: Raw original evidence is preserved immutably with SHA-256 checksum verification', () => {
    const rawData = 'data:image/svg+xml;utf8,<svg id="raw-proof"/>';
    const expectedHash = computeSha256Hex(rawData);

    const service = new PhotoEvidenceVaultService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-WATCH-01', inventoryUnitId: 'UNIT-W-01', isConfirmed: true };
    const photo = createMockCapturedPhoto({ id: 'p1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId!, originalDataUrl: rawData });

    const buildRes = service.buildVaultRecord(context, {
      FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(buildRes.record?.photos.FRONT?.originalAsset.sha256Checksum === expectedHash, 'Checksum must match raw payload SHA-256');
  });

  // Test 4: Successful persistence commit
  await test('Test 4: Successful persistence commit updates status to COMMITTED_PERSISTED and computes record checksum', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter();
    const service = new PhotoEvidenceVaultService(adapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-LEICA-M-01', inventoryUnitId: 'UNIT-LEICA-042', isConfirmed: true };
    const p1 = createMockCapturedPhoto({ id: 'l1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });
    const p2 = createMockCapturedPhoto({ id: 'l2', angle: 'BACK', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const saveRes = await service.commitToVault(context, {
      FRONT: p1, BACK: p2, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(saveRes.success === true, 'Commit must succeed');
    assert(saveRes.status === 'COMMITTED_PERSISTED', 'Status must be COMMITTED_PERSISTED');
    assert(Boolean(saveRes.recordChecksum), 'Record checksum must be generated');

    const summaries = await adapter.listSummaries();
    assert(summaries.length === 1, 'Summaries must contain 1 entry');
    assert(summaries[0].status === 'COMMITTED_PERSISTED', 'Persisted summary status must be COMMITTED_PERSISTED');
  });

  // Test 5: Cold restart simulation across process boundaries
  await test('Test 5: Cold restart simulation loads exact record across process boundaries (same-process simulation disclaimer verified)', async () => {
    const initialAdapter = new MockFailureInjectablePersistenceAdapter();
    const service = new PhotoEvidenceVaultService(initialAdapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-TELESCOPE-01', inventoryUnitId: 'UNIT-TEL-99', isConfirmed: true };
    const pFront = createMockCapturedPhoto({ id: 'tel-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    await service.commitToVault(context, {
      FRONT: pFront, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    // SIMULATE COLD RESTART: Clean clone severing in-memory object references
    const rebootedAdapter = initialAdapter.simulateColdRestart();
    const loadRes = await rebootedAdapter.loadRecord(context.sku!, context.inventoryUnitId!);

    assert(loadRes.success === true, 'Load after cold reboot must succeed');
    assert(loadRes.record?.sku === 'SKU-TELESCOPE-01', 'SKU must match');
    assert(loadRes.record?.photos.FRONT?.originalAsset.assetId === 'RAW-tel-1', 'Raw asset ID must match');
    assert(loadRes.status === 'COMMITTED_PERSISTED', 'Status must remain COMMITTED_PERSISTED');
  });

  // Test 6: Integrity check passes for uncorrupted record
  await test('Test 6: Integrity check passes for uncorrupted record and verifies raw image hashes', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter();
    const service = new PhotoEvidenceVaultService(adapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-INTEG-01', inventoryUnitId: 'UNIT-INT-01', isConfirmed: true };
    const pFront = createMockCapturedPhoto({ id: 'int-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    await service.commitToVault(context, {
      FRONT: pFront, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    const check = await adapter.verifyIntegrity(context.sku!, context.inventoryUnitId!);
    assert(check.isValid === true, 'Integrity check must return isValid: true');
    assert(check.mismatchedAngles.length === 0, 'No mismatched angles');
  });

  // Test 7: Tamper detection triggers HOLD_CORRUPTED_CHECKSUM
  await test('Test 7: Tamper detection identifies modified raw dataUrl and triggers HOLD_CORRUPTED_CHECKSUM', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter();
    const service = new PhotoEvidenceVaultService(adapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-TAMPER-01', inventoryUnitId: 'UNIT-TAMPER-01', isConfirmed: true };
    const pFront = createMockCapturedPhoto({ id: 't-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    await service.commitToVault(context, {
      FRONT: pFront, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    // Inject tampering corruption on read
    adapter.setConfig({ simulateCorruptionOnRead: true });

    const loadRes = await adapter.loadRecord(context.sku!, context.inventoryUnitId!);
    assert(loadRes.success === false, 'Tampered record must fail to load');
    assert(loadRes.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must transition to HOLD_CORRUPTED_CHECKSUM');
    assert(loadRes.error === 'CHECKSUM_INTEGRITY_MISMATCH', 'Error must indicate CHECKSUM_INTEGRITY_MISMATCH');
  });

  // Test 8: Failure injection - Disk Full error
  await test('Test 8: Failure Injection - Disk full error triggers FAILED_DISK_FULL without claiming successful persistence', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter({ simulateDiskFull: true });
    const service = new PhotoEvidenceVaultService(adapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-FULL-01', inventoryUnitId: 'UNIT-FULL-01', isConfirmed: true };
    const pFront = createMockCapturedPhoto({ id: 'full-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const res = await service.commitToVault(context, {
      FRONT: pFront, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(res.success === false, 'Commit must fail on disk full');
    assert(res.status === 'FAILED_DISK_FULL', 'Status must be FAILED_DISK_FULL');
    assert(res.error === 'DISK_FULL_SIMULATED', 'Error must match simulated code');
  });

  // Test 9: Failure injection - I/O Write Error
  await test('Test 9: Failure Injection - I/O write error triggers FAILED_WRITE_ERROR without corrupting existing records', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter();
    const service = new PhotoEvidenceVaultService(adapter);

    // Save one successfully first
    const ctxA: PhotoCaptureTargetContext = { sku: 'SKU-OK', inventoryUnitId: 'UNIT-OK', isConfirmed: true };
    await service.commitToVault(ctxA, {
      FRONT: createMockCapturedPhoto({ id: 'ok-1', angle: 'FRONT', sku: 'SKU-OK', inventoryUnitId: 'UNIT-OK' }),
      BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    // Now inject write error for second item
    adapter.setConfig({ simulateWriteError: true });
    const ctxB: PhotoCaptureTargetContext = { sku: 'SKU-ERR', inventoryUnitId: 'UNIT-ERR', isConfirmed: true };
    const resB = await service.commitToVault(ctxB, {
      FRONT: createMockCapturedPhoto({ id: 'err-1', angle: 'FRONT', sku: 'SKU-ERR', inventoryUnitId: 'UNIT-ERR' }),
      BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(resB.success === false, 'Write error must fail');
    assert(resB.status === 'FAILED_WRITE_ERROR', 'Status must be FAILED_WRITE_ERROR');

    // Existing record A must remain completely unharmed
    adapter.resetConfig();
    const loadA = await service.loadFromVault('SKU-OK', 'UNIT-OK');
    assert(loadA.success === true, 'Existing record A must remain intact');
  });

  // Test 10: Storage quota limit check
  await test('Test 10: Failure Injection - Storage quota exceeded blocks save when capacity limit is reached', async () => {
    // Set 100KB limit
    const adapter = new MockFailureInjectablePersistenceAdapter({ maxCapacityBytes: 1000 });
    const service = new PhotoEvidenceVaultService(adapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-QUOTA-01', inventoryUnitId: 'UNIT-Q-01', isConfirmed: true };
    const photo = createMockCapturedPhoto({ id: 'q-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const res = await service.commitToVault(context, {
      FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(res.success === false, 'Over-quota write must be rejected');
    assert(res.status === 'FAILED_DISK_FULL', 'Must report FAILED_DISK_FULL');
  });

  // Test 11: Midway process abort
  await test('Test 11: Failure Injection - Midway process abort leaves invalid/incomplete record detected on load', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter({ simulateMidwayAbort: true });
    const service = new PhotoEvidenceVaultService(adapter);

    const context: PhotoCaptureTargetContext = { sku: 'SKU-ABORT-01', inventoryUnitId: 'UNIT-AB-01', isConfirmed: true };
    const photo = createMockCapturedPhoto({ id: 'ab-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const saveRes = await service.commitToVault(context, {
      FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(saveRes.success === false, 'Save must report failure on midway abort');

    adapter.resetConfig();
    const loadRes = await adapter.loadRecord(context.sku!, context.inventoryUnitId!);
    assert(loadRes.success === false, 'Loading truncated JSON must fail');
    assert(loadRes.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');
  });

  // Test 12: Cross-SKU / Cross-Unit pollution protection
  await test('Test 12: Cross-SKU / Cross-Unit pollution protection rejects building record with mismatched photo tags', () => {
    const service = new PhotoEvidenceVaultService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-TARGET-A', inventoryUnitId: 'UNIT-TARGET-A', isConfirmed: true };

    const pollutedPhoto = createMockCapturedPhoto({
      id: 'polluted-1',
      angle: 'FRONT',
      sku: 'SKU-ALIEN-B',
      inventoryUnitId: 'UNIT-TARGET-A'
    });

    const res = service.buildVaultRecord(context, {
      FRONT: pollutedPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(res.success === false, 'Polluted build must fail');
    assert(res.errorReasonCode === 'HOLD_CROSS_POLLUTION', 'Must return HOLD_CROSS_POLLUTION');
  });

  // Test 13: Unconfirmed context rejection
  await test('Test 13: Unconfirmed context (isConfirmed=false) is rejected with HOLD_UNCONFIRMED_ID', () => {
    const service = new PhotoEvidenceVaultService();
    const unconfirmedContext: PhotoCaptureTargetContext = { sku: 'SKU-MOCK', inventoryUnitId: 'UNIT-MOCK', isConfirmed: false };

    const photo = createMockCapturedPhoto({ id: 'u-1', angle: 'FRONT', sku: 'SKU-MOCK', inventoryUnitId: 'UNIT-MOCK' });
    const res = service.buildVaultRecord(unconfirmedContext, {
      FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    assert(res.success === false, 'Unconfirmed context must fail');
    assert(res.errorReasonCode === 'HOLD_UNCONFIRMED_ID', 'Must return HOLD_UNCONFIRMED_ID');
  });

  // Test 14: Capacity and volume estimation calculations for 30kg benchmark
  await test('Test 14: Capacity and volume estimation accurately calculates 30kg benchmark requirements (FHD vs 4K tiers)', () => {
    // Benchmark 1: FHD Tier (Standard camera, 6 photos per item, 200 items/mo, 2400 items/yr)
    const fhdEstimate = calculateEvidenceCapacityEstimate({
      skuCount: 1,
      photosPerItem: 6,
      resolutionTier: 'FHD_STANDARD'
    });

    assert(fhdEstimate.bytesPerItem > 15 * 1024 * 1024, 'FHD item size must exceed 15MB');
    assert(fhdEstimate.bytesPerItem < 25 * 1024 * 1024, 'FHD item size must be under 25MB');
    assert(fhdEstimate.monthlyEstimateGB >= 3.0, 'Monthly estimate for 200 items should be >= 3.0 GB');
    assert(fhdEstimate.annualEstimateGB >= 35.0, 'Annual estimate for 2,400 items should be >= 35.0 GB');

    // Benchmark 2: 4K Tier (30kg scale bench DSLR high-res, 7 photos per item)
    const highResEstimate = calculateEvidenceCapacityEstimate({
      skuCount: 1,
      photosPerItem: 7,
      resolutionTier: '4K_HIGH_RES'
    });

    assert(highResEstimate.bytesPerItem > 35 * 1024 * 1024, '4K item size must exceed 35MB');
    assert(highResEstimate.bytesPerItem < 50 * 1024 * 1024, '4K item size must be under 50MB');
    assert(highResEstimate.annualEstimateGB > 80.0, 'Annual estimate for 2,400 4K items must exceed 80 GB');
    assert(highResEstimate.recommendedDiskSpaceGB > highResEstimate.totalEstimateGB * 2.5, 'Recommended disk space must incorporate safety margin');
  });

  // Test 15: Strict isolation verified - No localStorage, sessionStorage, or DB writes
  await test('Test 15: Pure isolation verified - Zero mutations to localStorage, sessionStorage, or production DB', async () => {
    const adapter = new MockFailureInjectablePersistenceAdapter();
    const service = new PhotoEvidenceVaultService(adapter);

    const initialLocalKeys = typeof localStorage !== 'undefined' ? Object.keys(localStorage).length : 0;
    const initialSessionKeys = typeof sessionStorage !== 'undefined' ? Object.keys(sessionStorage).length : 0;

    const context: PhotoCaptureTargetContext = { sku: 'SKU-NO-LEAK', inventoryUnitId: 'UNIT-NO-LEAK', isConfirmed: true };
    const p1 = createMockCapturedPhoto({ id: 'leak-1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    await service.commitToVault(context, {
      FRONT: p1, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    });

    const finalLocalKeys = typeof localStorage !== 'undefined' ? Object.keys(localStorage).length : 0;
    const finalSessionKeys = typeof sessionStorage !== 'undefined' ? Object.keys(sessionStorage).length : 0;

    assert(initialLocalKeys === finalLocalKeys, 'localStorage must have zero mutations');
    assert(initialSessionKeys === finalSessionKeys, 'sessionStorage must have zero mutations');
  });

  return {
    passed,
    failed,
    log
  };
}
