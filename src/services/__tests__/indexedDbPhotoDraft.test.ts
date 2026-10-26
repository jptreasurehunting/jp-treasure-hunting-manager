/**
 * Test Suite: IndexedDB Local Photo Draft Storage Adapter (JTH-STEP 36)
 *
 * Validates resilience against browser crashes and cold reloads, composite key isolation,
 * version conflict locking, checksum tampering detection, transaction abort safety,
 * hard quota limits without auto-eviction, and explicit deletion.
 */

import {
  IndexedDbPhotoDraftAdapter,
  buildPhotoDraftRecord,
  calculateDraftRecordChecksum
} from '../indexedDbPhotoDraftAdapter';
import type {
  PhotoAngle,
  CapturedPhoto,
  PhotoCaptureTargetContext
} from '../../types/photoCapture';
import type { PhotoDraftRecord } from '../../types/photoDraft';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createSyntheticCapturedPhoto(params: {
  id: string;
  angle: PhotoAngle;
  sku: string;
  inventoryUnitId: string;
  dataPattern?: string;
}): CapturedPhoto {
  const pattern = params.dataPattern || `SYNTHETIC_${params.angle}_${params.id}`;
  const toBase64 = (str: string) => {
    if (typeof btoa !== 'undefined') return btoa(str);
    const proc = (globalThis as any).Buffer;
    if (proc) return proc.from(str).toString('base64');
    return str;
  };
  const rawDataUrl = `data:image/jpeg;base64,${toBase64(pattern + '_RAW')}`;
  const workDataUrl = `data:image/jpeg;base64,${toBase64(pattern + '_WORK')}`;

  return {
    id: params.id,
    angle: params.angle,
    timestamp: new Date().toISOString(),
    dataUrl: workDataUrl,
    originalDataUrl: rawDataUrl,
    sku: params.sku,
    inventoryUnitId: params.inventoryUnitId,
    qaResult: {
      status: 'USE_AS_IS',
            issues: [],
      metrics: {
        blurScore: 8,
        brightness: 128,
        framingCoverage: 95,
        glareScore: 10
      },
      suggestedAction: 'KEEP'
    }
  };
}

export async function runIndexedDbPhotoDraftTests(): Promise<{
  passed: number;
  failed: number;
  log: string[];
}> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      log.push(`✅ ${name}`);
    } catch (err: any) {
      failed++;
      log.push(`❌ ${name}: ${err.message}`);
    }
  };

  // Test 1: Draft key generation & unconfirmed context isolation
  await test('Test 1: Confirmed context generates composite key while unconfirmed context is isolated under UNCONFIRMED::', () => {
    const confirmedCtx: PhotoCaptureTargetContext = {
      sku: 'SKU-ROLEX-01',
      inventoryUnitId: 'UNIT-2026-0001',
      isConfirmed: true
    };
    const photo = createSyntheticCapturedPhoto({
      id: 'p-01',
      angle: 'FRONT',
      sku: confirmedCtx.sku!,
      inventoryUnitId: confirmedCtx.inventoryUnitId!
    });

    const resConfirmed = buildPhotoDraftRecord({
      targetContext: confirmedCtx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    assert(resConfirmed.success === true, 'Confirmed build must succeed');
    if (resConfirmed.success) {
      assert(resConfirmed.draft.draftKey === 'SKU-ROLEX-01::UNIT-2026-0001', 'Key must be sku::inventoryUnitId');
      assert(resConfirmed.draft.status === 'DRAFT_LOCAL_SAVED', 'Status must be DRAFT_LOCAL_SAVED');
      assert(resConfirmed.draft.isConfirmed === true, 'isConfirmed must be true');
    }

    const unconfirmedCtx: PhotoCaptureTargetContext = {
      sku: '',
      inventoryUnitId: '',
      isConfirmed: false
    };
    const resUnconfirmed = buildPhotoDraftRecord({
      targetContext: unconfirmedCtx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      sessionId: 'sess_unconf_99'
    });
    assert(resUnconfirmed.success === true, 'Unconfirmed build must succeed');
    if (resUnconfirmed.success) {
      assert(resUnconfirmed.draft.draftKey === 'UNCONFIRMED::sess_unconf_99', 'Key must use UNCONFIRMED:: prefix');
      assert(resUnconfirmed.draft.status === 'HOLD_UNCONFIRMED_ID', 'Status must be HOLD_UNCONFIRMED_ID');
      assert(resUnconfirmed.draft.isConfirmed === false, 'isConfirmed must be false');
    }
  });

  // Test 2: Successful save & full fidelity restoration
  await test('Test 2: Successful save and restoration recovers exact photos, originalDataUrl, and QA evaluation without loss', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-SEIKO-DIVER',
      inventoryUnitId: 'UNIT-2026-7788',
      isConfirmed: true
    };

    const frontPhoto = createSyntheticCapturedPhoto({ id: 'p-front', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });
    const backPhoto = createSyntheticCapturedPhoto({ id: 'p-back', angle: 'BACK', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: frontPhoto, BACK: backPhoto, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      currentAngleIndex: 1
    });
    assert(buildRes.success === true, 'Build must succeed');
    if (!buildRes.success) return;

    const saveRes = await adapter.saveDraft(buildRes.draft);
    assert(saveRes.success === true, 'Save must succeed');
    assert(saveRes.status === 'DRAFT_LOCAL_SAVED', 'Save status must be DRAFT_LOCAL_SAVED');

    const loadRes = await adapter.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(loadRes.success === true, 'Load must succeed');
    assert(loadRes.draft !== undefined, 'Draft record must be returned');

    const loaded = loadRes.draft!;
    assert(loaded.sku === context.sku, 'SKU must match');
    assert(loaded.inventoryUnitId === context.inventoryUnitId, 'Unit ID must match');
    assert(loaded.photoCount === 2, 'Photo count must be 2');
    assert(loaded.usablePhotoCount === 2, 'Usable count must be 2');
    assert(loaded.photos.FRONT?.originalDataUrl === frontPhoto.originalDataUrl, 'Original FRONT payload must match');
    assert(loaded.photos.FRONT?.dataUrl === frontPhoto.dataUrl, 'Working FRONT payload must match');
    assert(loaded.photos.BACK?.originalDataUrl === backPhoto.originalDataUrl, 'Original BACK payload must match');
    assert(loaded.currentAngleIndex === 1, 'Current angle index must be recovered');
  });

  // Test 3: Cold restart simulation (new adapter instance restoration)
  await test('Test 3: Cold restart simulation restores drafts through fresh adapter instance', async () => {
    const adapter1 = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-COLD-01', inventoryUnitId: 'UNIT-COLD-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-cold', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;

    await adapter1.saveDraft(buildRes.draft);

    // Simulate cold restart: create a new adapter instance sharing the underlying store or state
    // In our adapter, we pass the simulatedStore to simulate persistent browser storage
    const internalStore = (adapter1 as any).simulatedStore;
    const adapter2 = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    (adapter2 as any).simulatedStore = internalStore;

    const loadRes = await adapter2.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(loadRes.success === true, 'Fresh adapter instance must load draft');
    assert(loadRes.draft?.sku === 'SKU-COLD-01', 'Restored SKU must match');
  });

  // Test 4: Cross-unit isolation & pollution prevention
  await test('Test 4: Cross-unit isolation prevents requesting or mixing photos between different units', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const contextA: PhotoCaptureTargetContext = { sku: 'SKU-UNIT-A', inventoryUnitId: 'UNIT-A-001', isConfirmed: true };
    const photoA = createSyntheticCapturedPhoto({ id: 'p-a', angle: 'FRONT', sku: contextA.sku!, inventoryUnitId: contextA.inventoryUnitId! });

    const buildA = buildPhotoDraftRecord({
      targetContext: contextA,
      capturedPhotos: { FRONT: photoA, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildA.success) return;
    await adapter.saveDraft(buildA.draft);

    // Requesting with Unit B must return not found
    const loadB = await adapter.loadDraft('SKU-UNIT-B', 'UNIT-B-001');
    assert(loadB.success === false, 'Unit B must not be found');

    // Attempting to build a draft with mixed SKU photos must fail
    const mixedPhoto = createSyntheticCapturedPhoto({ id: 'p-alien', angle: 'FRONT', sku: 'SKU-WRONG-ALIEN', inventoryUnitId: 'UNIT-A-001' });
    const buildMixed = buildPhotoDraftRecord({
      targetContext: contextA,
      capturedPhotos: { FRONT: mixedPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    assert(buildMixed.success === false, 'Cross-SKU photo must be rejected');
    if (!buildMixed.success) {
      assert(buildMixed.status === 'HOLD_CROSS_POLLUTION', 'Status must be HOLD_CROSS_POLLUTION');
    }
  });

  // Test 5: Version locking & stale write conflict rejection (順序逆転上書き防止)
  await test('Test 5: Version locking rejects stale older draft overwriting newer draft', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-RACE-01', inventoryUnitId: 'UNIT-RACE-001', isConfirmed: true };

    const photoV1 = createSyntheticCapturedPhoto({ id: 'p-v1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId!, dataPattern: 'PAT_V1' });
    const buildV1 = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photoV1, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      version: 1
    });
    if (!buildV1.success) return;

    // Save V1
    await adapter.saveDraft(buildV1.draft);

    // Save V2 (newer)
    const photoV2 = createSyntheticCapturedPhoto({ id: 'p-v2', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId!, dataPattern: 'PAT_V2' });
    const buildV2 = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photoV2, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      version: 2,
      existingDraft: buildV1.draft
    });
    if (!buildV2.success) return;
    await adapter.saveDraft(buildV2.draft);

    // Now simulate delayed asynchronous write arriving late with V1
    const lateStaleSave = await adapter.saveDraft(buildV1.draft);
    assert(lateStaleSave.success === false, 'Stale write must be rejected');
    assert(lateStaleSave.status === 'HOLD_VERSION_CONFLICT', 'Status must be HOLD_VERSION_CONFLICT');

    // Verify current stored record is still V2
    const current = await adapter.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(current.draft?.version === 2, 'Stored draft must remain at version 2');
  });

  // Test 6: Checksum tampering & corruption detection
  await test('Test 6: Checksum tampering is detected upon load and triggers HOLD_CORRUPTED_CHECKSUM', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-TAMPER-01', inventoryUnitId: 'UNIT-TAMPER-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-tamper', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;
    await adapter.saveDraft(buildRes.draft);

    // Inject checksum corruption on read
    adapter.setConfig({ simulateChecksumCorruptionOnRead: true });

    const loadRes = await adapter.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(loadRes.success === false, 'Corrupted draft must fail load');
    assert(loadRes.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');

    adapter.resetConfig();
    const loadClean = await adapter.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(loadClean.success === true, 'Clean load must succeed after reset');
  });

  // Test 7: Transaction abort / write failure safety
  await test('Test 7: Transaction abort failure safely returns error without reporting false success', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-ABORT-01', inventoryUnitId: 'UNIT-ABORT-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-abort', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;

    adapter.setConfig({ simulateTransactionAbort: true });
    const saveRes = await adapter.saveDraft(buildRes.draft);
    assert(saveRes.success === false, 'Save must fail on simulated abort');
    assert(saveRes.status === 'FAILED_TRANSACTION_ABORT', 'Status must be FAILED_TRANSACTION_ABORT');

    // Verify nothing was saved
    adapter.resetConfig();
    const loadRes = await adapter.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(loadRes.success === false, 'No draft should be stored after aborted write');
  });

  // Test 8: Database unavailable safety
  await test('Test 8: Database unavailable safely returns FAILED_DB_UNAVAILABLE', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-NODB-01', inventoryUnitId: 'UNIT-NODB-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-nodb', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;

    adapter.setConfig({ simulateDatabaseUnavailable: true });
    const saveRes = await adapter.saveDraft(buildRes.draft);
    assert(saveRes.success === false, 'Save must fail when DB is unavailable');
    assert(saveRes.status === 'FAILED_DB_UNAVAILABLE', 'Status must be FAILED_DB_UNAVAILABLE');
  });

  // Test 9: Hard storage quota & entry limits without auto-eviction (自動削除禁止)
  await test('Test 9: Max entry limit rejects new draft with FAILED_QUOTA_EXCEEDED without auto-eviction', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({
      useSimulatedStore: true,
      failureConfig: { maxEntryCount: 2 }
    });

    const ctx1: PhotoCaptureTargetContext = { sku: 'SKU-LIMIT-1', inventoryUnitId: 'UNIT-L-1', isConfirmed: true };
    const ctx2: PhotoCaptureTargetContext = { sku: 'SKU-LIMIT-2', inventoryUnitId: 'UNIT-L-2', isConfirmed: true };
    const ctx3: PhotoCaptureTargetContext = { sku: 'SKU-LIMIT-3', inventoryUnitId: 'UNIT-L-3', isConfirmed: true };

    const photo1 = createSyntheticCapturedPhoto({ id: 'p-l1', angle: 'FRONT', sku: ctx1.sku!, inventoryUnitId: ctx1.inventoryUnitId! });
    const photo2 = createSyntheticCapturedPhoto({ id: 'p-l2', angle: 'FRONT', sku: ctx2.sku!, inventoryUnitId: ctx2.inventoryUnitId! });
    const photo3 = createSyntheticCapturedPhoto({ id: 'p-l3', angle: 'FRONT', sku: ctx3.sku!, inventoryUnitId: ctx3.inventoryUnitId! });

    const b1 = buildPhotoDraftRecord({ targetContext: ctx1, capturedPhotos: { FRONT: photo1, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    const b2 = buildPhotoDraftRecord({ targetContext: ctx2, capturedPhotos: { FRONT: photo2, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    const b3 = buildPhotoDraftRecord({ targetContext: ctx3, capturedPhotos: { FRONT: photo3, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });

    if (!b1.success || !b2.success || !b3.success) return;

    const s1 = await adapter.saveDraft(b1.draft);
    assert(s1.success === true, 'Draft 1 save must succeed');
    const s2 = await adapter.saveDraft(b2.draft);
    assert(s2.success === true, 'Draft 2 save must succeed');

    // Draft 3 must be blocked!
    const s3 = await adapter.saveDraft(b3.draft);
    assert(s3.success === false, 'Draft 3 save must fail on quota limit');
    assert(s3.status === 'FAILED_QUOTA_EXCEEDED', 'Status must be FAILED_QUOTA_EXCEEDED');

    // Crucial check: Draft 1 and 2 must NOT be silently evicted!
    const check1 = await adapter.loadDraft(ctx1.sku!, ctx1.inventoryUnitId!);
    const check2 = await adapter.loadDraft(ctx2.sku!, ctx2.inventoryUnitId!);
    assert(check1.success === true, 'Draft 1 must NOT be auto-evicted');
    assert(check2.success === true, 'Draft 2 must NOT be auto-evicted');
  });

  // Test 10: Byte size capacity limit rejects oversized saves
  await test('Test 10: Max byte capacity limit rejects oversized draft', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({
      useSimulatedStore: true,
      failureConfig: { maxCapacityBytes: 100 } // Very tiny 100 bytes limit
    });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-BYTE-01', inventoryUnitId: 'UNIT-BYTE-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-byte', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;

    const saveRes = await adapter.saveDraft(buildRes.draft);
    assert(saveRes.success === false, 'Save must fail when byte quota is exceeded');
    assert(saveRes.status === 'FAILED_QUOTA_EXCEEDED', 'Status must be FAILED_QUOTA_EXCEEDED');
  });

  // Test 11: Draft summaries listing & sorting
  await test('Test 11: Draft summaries list returns entries sorted descending by lastModifiedAt', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctxA: PhotoCaptureTargetContext = { sku: 'SKU-LIST-A', inventoryUnitId: 'UNIT-LA', isConfirmed: true };
    const ctxB: PhotoCaptureTargetContext = { sku: 'SKU-LIST-B', inventoryUnitId: 'UNIT-LB', isConfirmed: true };

    const pA = createSyntheticCapturedPhoto({ id: 'p-la', angle: 'FRONT', sku: ctxA.sku!, inventoryUnitId: ctxA.inventoryUnitId! });
    const pB = createSyntheticCapturedPhoto({ id: 'p-lb', angle: 'FRONT', sku: ctxB.sku!, inventoryUnitId: ctxB.inventoryUnitId! });

    const bA = buildPhotoDraftRecord({ targetContext: ctxA, capturedPhotos: { FRONT: pA, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    const bB = buildPhotoDraftRecord({ targetContext: ctxB, capturedPhotos: { FRONT: pB, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    if (!bA.success || !bB.success) return;

    // Set bB to be slightly newer
    bB.draft.lastModifiedAt = new Date(Date.now() + 5000).toISOString();

    await adapter.saveDraft(bA.draft);
    await adapter.saveDraft(bB.draft);

    const summaries = await adapter.listDraftSummaries();
    assert(summaries.length === 2, 'Must return 2 summaries');
    assert(summaries[0].sku === 'SKU-LIST-B', 'Newer draft B must be listed first');
    assert(summaries[1].sku === 'SKU-LIST-A', 'Older draft A must be listed second');
  });

  // Test 12: Explicit deletion removes draft without touching other units
  await test('Test 12: Explicit deletion removes target draft while keeping other units intact', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx1: PhotoCaptureTargetContext = { sku: 'SKU-DEL-1', inventoryUnitId: 'UNIT-DEL-1', isConfirmed: true };
    const ctx2: PhotoCaptureTargetContext = { sku: 'SKU-DEL-2', inventoryUnitId: 'UNIT-DEL-2', isConfirmed: true };

    const p1 = createSyntheticCapturedPhoto({ id: 'p-d1', angle: 'FRONT', sku: ctx1.sku!, inventoryUnitId: ctx1.inventoryUnitId! });
    const p2 = createSyntheticCapturedPhoto({ id: 'p-d2', angle: 'FRONT', sku: ctx2.sku!, inventoryUnitId: ctx2.inventoryUnitId! });

    const b1 = buildPhotoDraftRecord({ targetContext: ctx1, capturedPhotos: { FRONT: p1, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    const b2 = buildPhotoDraftRecord({ targetContext: ctx2, capturedPhotos: { FRONT: p2, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    if (!b1.success || !b2.success) return;

    await adapter.saveDraft(b1.draft);
    await adapter.saveDraft(b2.draft);

    const deleted = await adapter.deleteDraft(ctx1.sku!, ctx1.inventoryUnitId!);
    assert(deleted === true, 'Delete must return true');

    const check1 = await adapter.loadDraft(ctx1.sku!, ctx1.inventoryUnitId!);
    assert(check1.success === false, 'Unit 1 must no longer exist');

    const check2 = await adapter.loadDraft(ctx2.sku!, ctx2.inventoryUnitId!);
    assert(check2.success === true, 'Unit 2 must remain completely intact');
  });

  // Test 13: Storage metrics reporting
  await test('Test 13: Accurate storage metrics calculation', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-METRICS', inventoryUnitId: 'UNIT-METRICS', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-m', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;
    await adapter.saveDraft(buildRes.draft);

    const metrics = await adapter.getStorageMetrics();
    assert(metrics.draftCount === 1, 'Draft count must be 1');
    assert(metrics.usedBytes > 0, 'Used bytes must be positive');
    assert(metrics.backendType === 'INDEXED_DB_SIMULATED', 'Backend type must match');
  });

  // Test 14: Clear all drafts
  await test('Test 14: clearAllDrafts cleans all stored records', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-CLR', inventoryUnitId: 'UNIT-CLR', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-clr', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;
    await adapter.saveDraft(buildRes.draft);

    await adapter.clearAllDrafts();
    const metrics = await adapter.getStorageMetrics();
    assert(metrics.draftCount === 0, 'Draft count must be 0 after clearAll');
  });

  // Test 15: Storage safety notice disclosure
  await test('Test 15: Storage safety notice accurately warns about temporary buffer, history clearing, and private mode', () => {
    const notice = IndexedDbPhotoDraftAdapter.getStorageNoticeJa();
    assert(notice.includes('IndexedDB'), 'Notice must state IndexedDB');
    assert(notice.includes('セーフティネット'), 'Notice must state safety net');
    assert(notice.includes('Evidence Vault'), 'Notice must state not an Evidence Vault');
    assert(notice.includes('閲覧履歴'), 'Notice must state history clearing risk');
    assert(notice.includes('シークレットモード'), 'Notice must state private mode risk');
  });

  // Test 16: Cross-unitId contamination check
  await test('Test 16: Photo containing different inventoryUnitId is rejected with HOLD_CROSS_POLLUTION', () => {
    const context: PhotoCaptureTargetContext = { sku: 'SKU-SAME', inventoryUnitId: 'UNIT-TARGET-001', isConfirmed: true };
    const wrongUnitPhoto = createSyntheticCapturedPhoto({
      id: 'p-wrong-unit',
      angle: 'FRONT',
      sku: 'SKU-SAME',
      inventoryUnitId: 'UNIT-ALIEN-999'
    });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: wrongUnitPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    assert(buildRes.success === false, 'Photo with mismatched unit ID must fail build');
    if (!buildRes.success) {
      assert(buildRes.status === 'HOLD_CROSS_POLLUTION', 'Status must be HOLD_CROSS_POLLUTION');
      assert(buildRes.messageJa.includes('UNIT-ALIEN-999'), 'Message must identify alien unit');
    }
  });

  // Test 17: Injected simulateQuotaExceeded failure
  await test('Test 17: Injected simulateQuotaExceeded flag safely rejects save with FAILED_QUOTA_EXCEEDED', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-Q-01', inventoryUnitId: 'UNIT-Q-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-q', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;

    adapter.setConfig({ simulateQuotaExceeded: true });
    const saveRes = await adapter.saveDraft(buildRes.draft);
    assert(saveRes.success === false, 'Save must fail on simulated quota');
    assert(saveRes.status === 'FAILED_QUOTA_EXCEEDED', 'Status must be FAILED_QUOTA_EXCEEDED');
    assert(saveRes.error === 'STORAGE_QUOTA_EXCEEDED_SIMULATED', 'Error code must match');
  });

  // Test 18: verifyDraftIntegrity validates intact draft and detects corruptions
  await test('Test 18: verifyDraftIntegrity validates intact draft and flags corrupted or missing drafts', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-VERIFY-01', inventoryUnitId: 'UNIT-VERIFY-001', isConfirmed: true };
    const photo = createSyntheticCapturedPhoto({ id: 'p-v', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;
    await adapter.saveDraft(buildRes.draft);

    // Verify intact
    const intact = await adapter.verifyDraftIntegrity(context.sku!, context.inventoryUnitId!);
    assert(intact.isValid === true, 'Intact draft must be valid');
    assert(intact.mismatchedAngles.length === 0, 'No mismatched angles');

    // Non-existent unit
    const missing = await adapter.verifyDraftIntegrity('SKU-NONEXIST', 'UNIT-NONE');
    assert(missing.isValid === false, 'Missing draft must be invalid');

    // Corrupted checksum
    adapter.setConfig({ simulateChecksumCorruptionOnRead: true });
    const corrupted = await adapter.verifyDraftIntegrity(context.sku!, context.inventoryUnitId!);
    assert(corrupted.isValid === false, 'Corrupted draft must fail integrity check');
  });

  // Test 19: Progressive multi-angle capture increments version and preserves prior photos
  await test('Test 19: Progressive multi-angle capture increments version and preserves previously captured angles', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const context: PhotoCaptureTargetContext = { sku: 'SKU-MULTI-01', inventoryUnitId: 'UNIT-MULTI-001', isConfirmed: true };

    // Step 1: Capture FRONT (v1)
    const frontPhoto = createSyntheticCapturedPhoto({ id: 'p-m-front', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });
    const b1 = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: frontPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      version: 1
    });
    if (!b1.success) return;
    await adapter.saveDraft(b1.draft);

    // Step 2: Next angle BACK captured, incrementing to v2
    const backPhoto = createSyntheticCapturedPhoto({ id: 'p-m-back', angle: 'BACK', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });
    const b2 = buildPhotoDraftRecord({
      targetContext: context,
      capturedPhotos: { FRONT: frontPhoto, BACK: backPhoto, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      existingDraft: b1.draft
    });
    if (!b2.success) return;
    assert(b2.draft.version === 2, 'Version must increment to 2');

    const s2 = await adapter.saveDraft(b2.draft);
    assert(s2.success === true, 'Save v2 must succeed');

    // Step 3: Load and verify both angles present
    const load2 = await adapter.loadDraft(context.sku!, context.inventoryUnitId!);
    assert(load2.success === true, 'Load v2 must succeed');
    assert(load2.draft?.version === 2, 'Loaded draft must be v2');
    assert(load2.draft?.photoCount === 2, 'Photo count must be 2');
    assert(load2.draft?.photos.FRONT !== undefined, 'FRONT must be preserved');
    assert(load2.draft?.photos.BACK !== undefined, 'BACK must be present');
  });

  return { passed, failed, log };
}
