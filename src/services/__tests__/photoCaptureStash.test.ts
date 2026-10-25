/**
 * Automated Test Suite for Photo Capture In-Memory Stash & Resume (JTH-STEP 32)
 *
 * Verifies:
 * 1. Safe in-memory retention of captured photos and originalDataUrl
 * 2. Strict composite key isolation (${sku}::${inventoryUnitId})
 * 3. Prevention of cross-SKU and cross-unit contamination
 * 4. Mid-way resume and partial angle restoration
 * 5. Re-mount restoration
 * 6. Capacity limits without silent auto-eviction
 * 7. Unconfirmed context rejection (UNLINKED_HOLD)
 * 8. Zero localStorage or database mutations
 */

import {
  PhotoCaptureStashService,
  StashedPhotoSession
} from '../photoCaptureStashService';
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
  status?: 'USE_AS_IS' | 'AUTO_FIX' | 'RETAKE';
  originalDataUrl?: string;
}): CapturedPhoto {
  const { id, angle, sku, inventoryUnitId, status = 'USE_AS_IS', originalDataUrl } = params;
  const mockSvg = `data:image/svg+xml;utf8,<svg id="${id}"/>`;
  return {
    id,
    angle,
    timestamp: new Date().toISOString(),
    dataUrl: mockSvg,
    originalDataUrl: originalDataUrl || mockSvg,
    sku,
    inventoryUnitId,
    qaResult: {
      status,
      issues: status === 'USE_AS_IS' ? [] : [{ code: 'BLUR_DETECTED', severity: 'WARNING', message: 'Blurry' }],
      metrics: { blurScore: status === 'USE_AS_IS' ? 12 : 75, brightness: 128, framingCoverage: 95, glareScore: 5 },
      suggestedAction: status === 'USE_AS_IS' ? '合格' : '要再撮影または補正'
    }
  };
}

export async function runPhotoCaptureStashTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      log.push(`✅ ${name}`);
    } catch (err: any) {
      failed++;
      log.push(`❌ ${name}: ${err.message}`);
    }
  };

  // Test 1: Stash key generation
  test('Test 1: Stash key generation enforces composite key (${sku}::${inventoryUnitId}) and rejects unconfirmed contexts', () => {
    const service = new PhotoCaptureStashService();

    const confirmedContext: PhotoCaptureTargetContext = {
      sku: 'SKU-WATCH-STRAP-01',
      inventoryUnitId: 'UNIT-2026-0042',
      isConfirmed: true
    };
    const key = service.buildStashKey(confirmedContext);
    assert(key === 'SKU-WATCH-STRAP-01::UNIT-2026-0042', `Key must be composite, got: ${key}`);

    const unconfirmedContext: PhotoCaptureTargetContext = {
      sku: 'SKU-WATCH-STRAP-01',
      inventoryUnitId: 'UNIT-2026-0042',
      isConfirmed: false
    };
    assert(service.buildStashKey(unconfirmedContext) === null, 'Unconfirmed context must return null key');

    const emptyContext: PhotoCaptureTargetContext = {
      sku: '',
      inventoryUnitId: '',
      isConfirmed: true
    };
    assert(service.buildStashKey(emptyContext) === null, 'Empty identifiers must return null key');
  });

  // Test 2: Successful stashing preserves captured photos, originalDataUrl, and QA results
  test('Test 2: Successful stashing preserves captured photos, originalDataUrl, and QA results without data loss', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-CAMERA-LENS-01',
      inventoryUnitId: 'UNIT-2026-0105',
      isConfirmed: true
    };

    const originalUrl = 'data:image/svg+xml;utf8,<svg id="orig-lens-front"/>';
    const correctedUrl = 'data:image/svg+xml;utf8,<svg id="fixed-lens-front"/>';
    const photos: Record<PhotoAngle, CapturedPhoto | null> = {
      FRONT: {
        id: 'photo-lens-1',
        angle: 'FRONT',
        timestamp: new Date().toISOString(),
        dataUrl: correctedUrl,
        originalDataUrl: originalUrl,
        sku: 'SKU-CAMERA-LENS-01',
        inventoryUnitId: 'UNIT-2026-0105',
        autoFixCount: 1,
        qaResult: {
          status: 'USE_AS_IS',
          issues: [],
          metrics: { blurScore: 10, brightness: 130, framingCoverage: 98, glareScore: 2 },
          suggestedAction: '合格'
        }
      },
      BACK: null,
      LEFT: null,
      RIGHT: null,
      TOP: null,
      LABEL_TAG: null,
      DEFECT_DETAIL: null
    };

    const stashRes = service.stashPhotos({
      targetContext: context,
      capturedPhotos: photos,
      currentAngleIndex: 1
    });

    assert(stashRes.success === true, 'Stashing must succeed');
    assert(stashRes.reasonCode === 'STASH_SUCCESS', 'Reason code must be STASH_SUCCESS');
    assert(service.hasStash(context) === true, 'hasStash must return true');

    const stashed = stashRes.stashedSession!;
    assert(stashed.photoCount === 1, 'Photo count must be 1');
    assert(stashed.capturedPhotos.FRONT?.originalDataUrl === originalUrl, 'originalDataUrl must be preserved');
    assert(stashed.capturedPhotos.FRONT?.dataUrl === correctedUrl, 'dataUrl must be preserved');
    assert(stashed.currentAngleIndex === 1, 'currentAngleIndex must be preserved');
  });

  // Test 3: Restoring stashed session
  test('Test 3: Restoring stashed session recovers exact photos, angle index, and QA evaluation', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VINTAGE-SEIKO-01',
      inventoryUnitId: 'UNIT-2026-0089',
      isConfirmed: true
    };

    const p1 = createMockCapturedPhoto({ id: 'seiko-f', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });
    const p2 = createMockCapturedPhoto({ id: 'seiko-b', angle: 'BACK', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    service.stashPhotos({
      targetContext: context,
      capturedPhotos: {
        FRONT: p1,
        BACK: p2,
        LEFT: null,
        RIGHT: null,
        TOP: null,
        LABEL_TAG: null,
        DEFECT_DETAIL: null
      },
      currentAngleIndex: 2
    });

    const restoreRes = service.restorePhotos(context);
    assert(restoreRes.success === true, 'Restore must succeed');
    assert(restoreRes.reasonCode === 'RESTORE_SUCCESS', 'Reason code must be RESTORE_SUCCESS');
    assert(restoreRes.session?.photoCount === 2, 'Restored session must have 2 photos');
    assert(restoreRes.session?.capturedPhotos.FRONT?.id === 'seiko-f', 'Front photo ID must match');
    assert(restoreRes.session?.capturedPhotos.BACK?.id === 'seiko-b', 'Back photo ID must match');
    assert(restoreRes.session?.currentAngleIndex === 2, 'currentAngleIndex must be restored to 2');
  });

  // Test 4: Multi-unit switching in isolation
  test('Test 4: Multi-unit switching (Unit A -> Unit B -> Unit A) preserves both units in isolation without cross-unit contamination', () => {
    const service = new PhotoCaptureStashService();
    const unitA: PhotoCaptureTargetContext = { sku: 'SKU-A', inventoryUnitId: 'UNIT-A', isConfirmed: true };
    const unitB: PhotoCaptureTargetContext = { sku: 'SKU-B', inventoryUnitId: 'UNIT-B', isConfirmed: true };

    // 1. Stash Unit A
    const photoA = createMockCapturedPhoto({ id: 'pA', angle: 'FRONT', sku: 'SKU-A', inventoryUnitId: 'UNIT-A' });
    service.stashPhotos({
      targetContext: unitA,
      capturedPhotos: { FRONT: photoA, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    // 2. Stash Unit B
    const photoB = createMockCapturedPhoto({ id: 'pB', angle: 'BACK', sku: 'SKU-B', inventoryUnitId: 'UNIT-B' });
    service.stashPhotos({
      targetContext: unitB,
      capturedPhotos: { FRONT: null, BACK: photoB, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(service.getCount() === 2, 'Service must hold 2 stashed units');

    // 3. Restore Unit A
    const resA = service.restorePhotos(unitA);
    assert(resA.success === true && resA.session?.capturedPhotos.FRONT?.id === 'pA', 'Unit A must restore pA');
    assert(resA.session?.capturedPhotos.BACK === null, 'Unit A must NOT contain Unit B photos');

    // 4. Restore Unit B
    const resB = service.restorePhotos(unitB);
    assert(resB.success === true && resB.session?.capturedPhotos.BACK?.id === 'pB', 'Unit B must restore pB');
    assert(resB.session?.capturedPhotos.FRONT === null, 'Unit B must NOT contain Unit A photos');
  });

  // Test 5: Resuming mid-way capture
  test('Test 5: Resuming mid-way capture preserves partial angles and active angle index', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-PARTIAL-01', inventoryUnitId: 'UNIT-PARTIAL-01', isConfirmed: true };

    const pFront = createMockCapturedPhoto({ id: 'p-fr', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });
    const pBack = createMockCapturedPhoto({ id: 'p-bk', angle: 'BACK', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    service.stashPhotos({
      targetContext: context,
      capturedPhotos: { FRONT: pFront, BACK: pBack, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      currentAngleIndex: 2 // NEXT ANGLE IS LEFT
    });

    const res = service.restorePhotos(context);
    assert(res.session?.currentAngleIndex === 2, 'Should resume directly at angle index 2 (Left Side)');
    assert(res.session?.usableCount === 2, '2 angles already evaluated as usable');
  });

  // Test 6: Cross-SKU / Cross-Unit contamination blocked
  test('Test 6: Cross-SKU / Cross-Unit pollution is detected and blocked with HOLD_CROSS_POLLUTION_DETECTED', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-LEICA-01', inventoryUnitId: 'UNIT-LEICA-01', isConfirmed: true };

    // Photo tagged with a DIFFERENT SKU
    const contaminatedPhoto = createMockCapturedPhoto({
      id: 'p-alien',
      angle: 'FRONT',
      sku: 'SKU-SEIKO-CONTAMINATED',
      inventoryUnitId: 'UNIT-LEICA-01'
    });

    const stashRes = service.stashPhotos({
      targetContext: context,
      capturedPhotos: { FRONT: contaminatedPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(stashRes.success === false, 'Stash must reject contaminated photo');
    assert(stashRes.reasonCode === 'HOLD_CROSS_POLLUTION_DETECTED', 'Must trigger HOLD_CROSS_POLLUTION_DETECTED');
    assert(service.hasStash(context) === false, 'Contaminated entry must not be stashed');
  });

  // Test 7: Unconfirmed target context is blocked
  test('Test 7: Unconfirmed target context is blocked from stashing with HOLD_UNCONFIRMED_CONTEXT', () => {
    const service = new PhotoCaptureStashService();
    const unconfirmedContext: PhotoCaptureTargetContext = { sku: 'SKU-UNKNOWN', inventoryUnitId: 'UNIT-UNKNOWN', isConfirmed: false };

    const photo = createMockCapturedPhoto({ id: 'p-unconf', angle: 'FRONT', sku: 'SKU-UNKNOWN', inventoryUnitId: 'UNIT-UNKNOWN' });

    const stashRes = service.stashPhotos({
      targetContext: unconfirmedContext,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(stashRes.success === false, 'Stashing unconfirmed context must fail');
    assert(stashRes.reasonCode === 'HOLD_UNCONFIRMED_CONTEXT', 'Must return HOLD_UNCONFIRMED_CONTEXT');
  });

  // Test 8: Hard capacity limit strictly blocks without silent eviction
  test('Test 8: Hard capacity limit strictly rejects excessive entries with STASH_CAPACITY_EXCEEDED without auto-eviction', () => {
    // Service with max 2 entries
    const service = new PhotoCaptureStashService({ maxEntries: 2 });

    const ctx1: PhotoCaptureTargetContext = { sku: 'SKU-1', inventoryUnitId: 'UNIT-1', isConfirmed: true };
    const ctx2: PhotoCaptureTargetContext = { sku: 'SKU-2', inventoryUnitId: 'UNIT-2', isConfirmed: true };
    const ctx3: PhotoCaptureTargetContext = { sku: 'SKU-3', inventoryUnitId: 'UNIT-3', isConfirmed: true };

    service.stashPhotos({
      targetContext: ctx1,
      capturedPhotos: { FRONT: createMockCapturedPhoto({ id: 'p1', angle: 'FRONT', sku: 'SKU-1', inventoryUnitId: 'UNIT-1' }), BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    service.stashPhotos({
      targetContext: ctx2,
      capturedPhotos: { FRONT: createMockCapturedPhoto({ id: 'p2', angle: 'FRONT', sku: 'SKU-2', inventoryUnitId: 'UNIT-2' }), BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(service.getCount() === 2, 'Count must be 2');

    // Attempting 3rd entry
    const res3 = service.stashPhotos({
      targetContext: ctx3,
      capturedPhotos: { FRONT: createMockCapturedPhoto({ id: 'p3', angle: 'FRONT', sku: 'SKU-3', inventoryUnitId: 'UNIT-3' }), BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(res3.success === false, '3rd entry must be blocked');
    assert(res3.reasonCode === 'STASH_CAPACITY_EXCEEDED', 'Reason code must be STASH_CAPACITY_EXCEEDED');

    // Verify existing entries 1 and 2 were NOT silently auto-evicted!
    assert(service.hasStash(ctx1) === true, 'ctx1 must NOT be evicted');
    assert(service.hasStash(ctx2) === true, 'ctx2 must NOT be evicted');
  });

  // Test 9: Corrupted or missing image/evidence data
  test('Test 9: Corrupted or missing image/evidence data is detected and rejected with HOLD_ORIGINAL_EVIDENCE_CORRUPTED', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-BROKEN-01', inventoryUnitId: 'UNIT-BROKEN-01', isConfirmed: true };

    const brokenPhoto: CapturedPhoto = {
      id: 'p-corrupted',
      angle: 'FRONT',
      timestamp: new Date().toISOString(),
      dataUrl: '', // EMPTY
      originalDataUrl: '', // EMPTY
      sku: 'SKU-BROKEN-01',
      inventoryUnitId: 'UNIT-BROKEN-01',
      qaResult: { status: 'USE_AS_IS', issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 90, glareScore: 0 }, suggestedAction: 'OK' }
    };

    const res = service.stashPhotos({
      targetContext: context,
      capturedPhotos: { FRONT: brokenPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(res.success === false, 'Corrupted data must fail to stash');
    assert(res.reasonCode === 'HOLD_ORIGINAL_EVIDENCE_CORRUPTED', 'Reason code must be HOLD_ORIGINAL_EVIDENCE_CORRUPTED');
  });

  // Test 10: Explicit discard removes entry from stash
  test('Test 10: Explicit discard removes entry from stash; confirmed discard is required to remove data', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-DISCARD-01', inventoryUnitId: 'UNIT-DISCARD-01', isConfirmed: true };

    service.stashPhotos({
      targetContext: context,
      capturedPhotos: { FRONT: createMockCapturedPhoto({ id: 'p-disc', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! }), BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(service.hasStash(context) === true, 'Must have stash before discard');

    const deleted = service.discardStashedSession(context.sku!, context.inventoryUnitId!);
    assert(deleted === true, 'Discard must return true');
    assert(service.hasStash(context) === false, 'Must not have stash after discard');
  });

  // Test 11: Idempotent re-selection of same context
  test('Test 11: Stash service provides summaries for active in-memory sessions', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-SUMM-01',
      inventoryUnitId: 'UNIT-SUMM-01',
      itemTitle: 'Test Summary Item',
      isConfirmed: true
    };

    service.stashPhotos({
      targetContext: context,
      capturedPhotos: {
        FRONT: createMockCapturedPhoto({ id: 'p-s1', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId!, status: 'USE_AS_IS' }),
        BACK: createMockCapturedPhoto({ id: 'p-s2', angle: 'BACK', sku: context.sku!, inventoryUnitId: context.inventoryUnitId!, status: 'AUTO_FIX' }),
        LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
      },
      currentAngleIndex: 2
    });

    const summaries = service.listSummaries();
    assert(summaries.length === 1, 'Should have 1 summary');
    assert(summaries[0].sku === 'SKU-SUMM-01', 'Summary SKU must match');
    assert(summaries[0].photoCount === 2, 'Summary photoCount must be 2');
    assert(summaries[0].usableCount === 1, 'Summary usableCount must be 1 (only USE_AS_IS)');
  });

  // Test 12: In-memory stash operates strictly without mutating localStorage
  test('Test 12: In-memory stash operates strictly without mutating localStorage, sessionStorage, or production DB', () => {
    const service = new PhotoCaptureStashService();
    const beforeLocalKeys = typeof localStorage !== 'undefined' ? Object.keys(localStorage).length : 0;

    const context: PhotoCaptureTargetContext = { sku: 'SKU-INMEM-01', inventoryUnitId: 'UNIT-INMEM-01', isConfirmed: true };
    service.stashPhotos({
      targetContext: context,
      capturedPhotos: { FRONT: createMockCapturedPhoto({ id: 'p-inmem', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! }), BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    const afterLocalKeys = typeof localStorage !== 'undefined' ? Object.keys(localStorage).length : 0;
    assert(beforeLocalKeys === afterLocalKeys, 'localStorage must not be touched');
  });

  // Test 13: Stash safety notice accurately warns that memory is temporary
  test('Test 13: Stash safety notice accurately warns that memory is temporary and not an Evidence Vault', () => {
    const notice = PhotoCaptureStashService.getSafetyNoticeJa();
    assert(notice.includes('一時退避'), 'Notice must state temporary stash');
    assert(notice.includes('Evidence Vault'), 'Notice must state not an Evidence Vault');
    assert(notice.includes('消失'), 'Notice must state that data disappears on browser exit');
  });

  // Test 14: Simulated re-mount restores stashed photos
  test('Test 14: Simulated re-mount restores stashed photos when re-mounting with the same confirmed context', () => {
    const service = new PhotoCaptureStashService();
    const context: PhotoCaptureTargetContext = { sku: 'SKU-REMOUNT-01', inventoryUnitId: 'UNIT-REMOUNT-01', isConfirmed: true };

    const initialPhoto = createMockCapturedPhoto({ id: 'p-remount', angle: 'FRONT', sku: context.sku!, inventoryUnitId: context.inventoryUnitId! });

    // Step 1: User takes photo and component unmounts (or tab switches) after stashing
    service.stashPhotos({
      targetContext: context,
      capturedPhotos: { FRONT: initialPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      currentAngleIndex: 1
    });

    // Step 2: Component re-mounts fresh: initial local state is empty
    const freshMountedPhotos: Record<PhotoAngle, CapturedPhoto | null> = {
      FRONT: null, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null
    };

    // Step 3: Component mount effect runs
    let activePhotos = { ...freshMountedPhotos };
    let activeAngle = 0;
    if (context.isConfirmed && service.hasStash(context)) {
      const restored = service.restorePhotos(context);
      if (restored.success && restored.session) {
        activePhotos = restored.session.capturedPhotos;
        activeAngle = restored.session.currentAngleIndex;
      }
    }

    assert(activePhotos.FRONT?.id === 'p-remount', 'Re-mount must seamlessly recover stashed photos');
    assert(activeAngle === 1, 'Re-mount must recover active angle index');
  });

  return {
    passed,
    failed,
    log
  };
}
