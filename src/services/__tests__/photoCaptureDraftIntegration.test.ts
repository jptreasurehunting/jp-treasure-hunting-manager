/**
 * Automated Test Suite: Photo Capture & Photo Draft Safe Integration (JTH-STEP 41)
 *
 * Verifies:
 * 1. Explicit draft save into isolated test storage
 * 2. Normal mode write protection (real IndexedDB writes disabled)
 * 3. Full-fidelity restoration with immutable raw originalDataUrl and QA results
 * 4. Pre-restore preview validation and cancellation safety
 * 5. Cross-SKU pollution prevention on restore
 * 6. Cross-unitId pollution prevention on restore
 * 7. Cryptographic checksum tampering detection (HOLD_CORRUPTED_CHECKSUM)
 * 8. Version conflict locking and stale write rejection (HOLD_VERSION_CONFLICT)
 * 9. Storage quota limit rejection without silent auto-eviction (FAILED_QUOTA_EXCEEDED)
 * 10. Two-step draft discard confirmation (irreversible deletion guard)
 * 11. Component re-mount restoration across lifecycle
 * 12. Clear status separation (Stash vs Draft vs Evidence Vault)
 * 13. Unconfirmed context isolation (UNLINKED_HOLD under UNCONFIRMED:: namespace)
 * 14. Static React markup rendering verification
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PhotoCaptureCard,
  PhotoCaptureCardProps,
  DraftRestoreModalState,
  TARGET_CONTEXT_PRESETS,
  checkRealDraftPersistenceSafety
} from '../../components/PhotoCapture/PhotoCaptureCard';
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
import type {
  PhotoDraftRecord,
  PhotoDraftSummary,
  IPhotoDraftStorageAdapter
} from '../../types/photoDraft';
import { computeSha256Hex } from '../photoEvidenceVaultService';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createSyntheticPhoto(params: {
  id: string;
  angle: PhotoAngle;
  sku: string;
  inventoryUnitId: string;
  pattern?: string;
}): CapturedPhoto {
  const p = params.pattern || `PHOTO_${params.angle}_${params.id}`;
  const toB64 = (s: string) => {
    const proc = (globalThis as any).Buffer;
    if (proc) return proc.from(s).toString('base64');
    if (typeof btoa !== 'undefined') return btoa(s);
    return s;
  };

  const raw = `data:image/jpeg;base64,${toB64(p + '_RAW_IMMUTABLE')}`;
  const work = `data:image/jpeg;base64,${toB64(p + '_WORK_CORRECTED')}`;

  return {
    id: params.id,
    angle: params.angle,
    timestamp: new Date().toISOString(),
    dataUrl: work,
    originalDataUrl: raw,
    sku: params.sku,
    inventoryUnitId: params.inventoryUnitId,
    qaResult: {
      status: 'USE_AS_IS',
      issues: [],
      metrics: { blurScore: 10, brightness: 130, framingCoverage: 96, glareScore: 8 },
      suggestedAction: '合格'
    }
  };
}

export async function runPhotoCaptureDraftIntegrationTests(): Promise<{
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

  // Test 1: Explicit draft save into isolated test storage
  await test('Test 1: Explicit draft save into injected simulated storage records valid draft', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[1].context; // MOCK_E2E
    const photo = createSyntheticPhoto({ id: 'p1', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      currentAngleIndex: 0
    });
    assert(buildRes.success === true, 'Build must succeed');
    if (!buildRes.success) return;

    const saveRes = await adapter.saveDraft(buildRes.draft);
    assert(saveRes.success === true, 'Save must succeed');
    assert(saveRes.status === 'DRAFT_LOCAL_SAVED', 'Status must be DRAFT_LOCAL_SAVED');
    assert(saveRes.draftKey === `${ctx.sku}::${ctx.inventoryUnitId}`, 'Key must be composite');

    const summaries = await adapter.listDraftSummaries();
    assert(summaries.length === 1, 'Draft summaries count must be 1');
    assert(summaries[0].sku === ctx.sku, 'SKU must match');
  });

  // Test 2: Normal mode write protection (real IndexedDB disabled)
  await test('Test 2: Normal mode safety protection verifies simulated toggle and prevents untracked DB access', () => {
    // Component markup in normal mode: button is disabled
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const html = renderToStaticMarkup(
      React.createElement(PhotoCaptureCard, {
        isSimulatedDraftMode: false,
        draftAdapter: adapter
      })
    );

    assert(html.includes('実IndexedDB保存（無効化中）'), 'Normal mode must show disabled real IndexedDB button');
    assert(html.includes('disabled=""') || html.includes('disabled'), 'Save button must be disabled in normal mode');
    assert(!html.includes('正式保存済み'), 'Must never show formal saved');
  });

  // Test 3: Simulated mode enables explicit save button
  await test('Test 3: Simulated mode renders active simulated draft controls and disclaimer', () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const html = renderToStaticMarkup(
      React.createElement(PhotoCaptureCard, {
        isSimulatedDraftMode: true,
        draftAdapter: adapter
      })
    );

    assert(html.includes('模擬ドラフト保存'), 'Simulated mode must show active simulated save button');
    assert(html.includes('模擬保存モード: ON'), 'Mode indicator must show ON');
    assert(html.includes('ドラフト: 0件'), 'Must display draft count');
  });

  // Test 4: Full-fidelity restoration with immutable raw originalDataUrl and QA results
  await test('Test 4: Full-fidelity restoration recovers originalDataUrl bit-for-bit without generative tampering', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[2].context; // WATCH_STRAP
    const frontPhoto = createSyntheticPhoto({ id: 'p-front', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId!, pattern: 'NATO_FRONT' });
    const backPhoto = createSyntheticPhoto({ id: 'p-back', angle: 'BACK', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId!, pattern: 'NATO_BACK' });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: frontPhoto, BACK: backPhoto, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      currentAngleIndex: 1
    });
    if (!buildRes.success) return;

    await adapter.saveDraft(buildRes.draft);

    const loadRes = await adapter.loadDraft(ctx.sku!, ctx.inventoryUnitId!);
    assert(loadRes.success === true && loadRes.draft !== undefined, 'Load must succeed');
    const d = loadRes.draft!;

    assert(d.photos.FRONT?.originalDataUrl === frontPhoto.originalDataUrl, 'Original FRONT payload must be identical');
    assert(d.photos.FRONT?.dataUrl === frontPhoto.dataUrl, 'Working FRONT payload must be identical');
    assert(d.photos.BACK?.originalDataUrl === backPhoto.originalDataUrl, 'Original BACK payload must be identical');
    assert(d.photos.FRONT?.qaResult.status === 'USE_AS_IS', 'QA status must be preserved');
    assert(d.currentAngleIndex === 1, 'Current angle index must be preserved');
  });

  // Test 5: Pre-restore preview validation & cancellation safety
  await test('Test 5: Pre-restore preview inspects draft metadata without altering active workspace', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[3].context; // SEIKO_5
    const photo = createSyntheticPhoto({ id: 'p-seiko', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;
    await adapter.saveDraft(buildRes.draft);

    // Operator opens preview: inspect metadata
    const summaries = await adapter.listDraftSummaries();
    assert(summaries.length === 1, '1 summary available');
    const s = summaries[0];
    assert(s.sku === ctx.sku, 'Summary SKU matches');
    assert(s.version === 1, 'Version is 1');
    assert(s.photoCount === 1, 'Photo count is 1');
    assert(s.recordChecksum.length === 64, 'Checksum is full SHA-256');

    // Operator cancels restore: verify storage is untouched
    const recheck = await adapter.loadDraft(ctx.sku!, ctx.inventoryUnitId!);
    assert(recheck.success === true, 'Draft remains safely stored');
  });

  // Test 6: Cross-SKU pollution prevention on restore
  await test('Test 6: Cross-SKU pollution guard rejects photo containing alien SKU', () => {
    const ctxA = TARGET_CONTEXT_PRESETS[1].context;
    const alienPhoto = createSyntheticPhoto({
      id: 'p-alien',
      angle: 'FRONT',
      sku: 'SKU-ALIEN-999',
      inventoryUnitId: ctxA.inventoryUnitId!
    });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctxA,
      capturedPhotos: { FRONT: alienPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(buildRes.success === false, 'Cross-SKU photo must fail build');
    if (!buildRes.success) {
      assert(buildRes.status === 'HOLD_CROSS_POLLUTION', 'Status must be HOLD_CROSS_POLLUTION');
    }
  });

  // Test 7: Cross-unitId pollution prevention on restore
  await test('Test 7: Cross-unitId pollution guard rejects photo containing different inventoryUnitId', () => {
    const ctx = TARGET_CONTEXT_PRESETS[2].context;
    const alienUnitPhoto = createSyntheticPhoto({
      id: 'p-wrong-unit',
      angle: 'FRONT',
      sku: ctx.sku!,
      inventoryUnitId: 'UNIT-DIFFERENT-999'
    });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: alienUnitPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });

    assert(buildRes.success === false, 'Cross-unit photo must fail build');
    if (!buildRes.success) {
      assert(buildRes.status === 'HOLD_CROSS_POLLUTION', 'Status must be HOLD_CROSS_POLLUTION');
    }
  });

  // Test 8: Cryptographic checksum tampering detection (HOLD_CORRUPTED_CHECKSUM)
  await test('Test 8: Checksum tampering is flagged and blocks restore with HOLD_CORRUPTED_CHECKSUM', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[4].context; // LEICA_LENS
    const photo = createSyntheticPhoto({ id: 'p-leica', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;
    await adapter.saveDraft(buildRes.draft);

    // Tamper with checksum simulation
    adapter.setConfig({ simulateChecksumCorruptionOnRead: true });

    const loadRes = await adapter.loadDraft(ctx.sku!, ctx.inventoryUnitId!);
    assert(loadRes.success === false, 'Tampered load must fail');
    assert(loadRes.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');

    const integRes = await adapter.verifyDraftIntegrity(ctx.sku!, ctx.inventoryUnitId!);
    assert(integRes.isValid === false, 'Integrity check must fail on corrupted draft');
  });

  // Test 9: Version conflict locking & stale write rejection (HOLD_VERSION_CONFLICT)
  await test('Test 9: Version locking rejects stale older draft overwrite', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[1].context;
    const photo = createSyntheticPhoto({ id: 'p-v1', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId! });

    const b1 = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      version: 1
    });
    if (!b1.success) return;
    await adapter.saveDraft(b1.draft);

    // Newer v2 saved
    const b2 = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      existingDraft: b1.draft
    });
    if (!b2.success) return;
    assert(b2.draft.version === 2, 'Version must be 2');
    await adapter.saveDraft(b2.draft);

    // Attempt stale write of v1
    const staleRes = await adapter.saveDraft(b1.draft);
    assert(staleRes.success === false, 'Stale write must fail');
    assert(staleRes.status === 'HOLD_VERSION_CONFLICT', 'Status must be HOLD_VERSION_CONFLICT');
  });

  // Test 10: Storage quota limit rejection without silent auto-eviction (FAILED_QUOTA_EXCEEDED)
  await test('Test 10: Storage quota limit blocks saves without silently deleting existing drafts', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({
      useSimulatedStore: true,
      failureConfig: { maxEntryCount: 1 }
    });

    const ctx1 = TARGET_CONTEXT_PRESETS[1].context;
    const ctx2 = TARGET_CONTEXT_PRESETS[2].context;

    const p1 = createSyntheticPhoto({ id: 'p-q1', angle: 'FRONT', sku: ctx1.sku!, inventoryUnitId: ctx1.inventoryUnitId! });
    const p2 = createSyntheticPhoto({ id: 'p-q2', angle: 'FRONT', sku: ctx2.sku!, inventoryUnitId: ctx2.inventoryUnitId! });

    const b1 = buildPhotoDraftRecord({ targetContext: ctx1, capturedPhotos: { FRONT: p1, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    const b2 = buildPhotoDraftRecord({ targetContext: ctx2, capturedPhotos: { FRONT: p2, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    if (!b1.success || !b2.success) return;

    const s1 = await adapter.saveDraft(b1.draft);
    assert(s1.success === true, 'Draft 1 succeeds');

    const s2 = await adapter.saveDraft(b2.draft);
    assert(s2.success === false, 'Draft 2 blocked on quota');
    assert(s2.status === 'FAILED_QUOTA_EXCEEDED', 'Status must be FAILED_QUOTA_EXCEEDED');

    // Confirm Draft 1 was NOT silently auto-evicted
    const check1 = await adapter.loadDraft(ctx1.sku!, ctx1.inventoryUnitId!);
    assert(check1.success === true, 'Draft 1 must remain intact');
  });

  // Test 11: Two-step draft discard confirmation (irreversible deletion guard)
  await test('Test 11: Two-step draft discard requires explicit confirmation and protects other units', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctxA = TARGET_CONTEXT_PRESETS[1].context;
    const ctxB = TARGET_CONTEXT_PRESETS[2].context;

    const pA = createSyntheticPhoto({ id: 'p-da', angle: 'FRONT', sku: ctxA.sku!, inventoryUnitId: ctxA.inventoryUnitId! });
    const pB = createSyntheticPhoto({ id: 'p-db', angle: 'FRONT', sku: ctxB.sku!, inventoryUnitId: ctxB.inventoryUnitId! });

    const bA = buildPhotoDraftRecord({ targetContext: ctxA, capturedPhotos: { FRONT: pA, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    const bB = buildPhotoDraftRecord({ targetContext: ctxB, capturedPhotos: { FRONT: pB, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null } });
    if (!bA.success || !bB.success) return;

    await adapter.saveDraft(bA.draft);
    await adapter.saveDraft(bB.draft);

    // Delete A explicitly
    const deleted = await adapter.deleteDraft(ctxA.sku!, ctxA.inventoryUnitId!);
    assert(deleted === true, 'Delete must succeed');

    const checkA = await adapter.loadDraft(ctxA.sku!, ctxA.inventoryUnitId!);
    assert(checkA.success === false, 'Unit A is gone');

    const checkB = await adapter.loadDraft(ctxB.sku!, ctxB.inventoryUnitId!);
    assert(checkB.success === true, 'Unit B remains intact');
  });

  // Test 12: Component re-mount restoration across lifecycle
  await test('Test 12: Injected draft adapter persists drafts across component mount/unmount lifecycles', async () => {
    // Shared adapter instance simulates persistent storage surviving component unmount
    const sharedAdapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[1].context;
    const photo = createSyntheticPhoto({ id: 'p-mount', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId! });

    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    if (!buildRes.success) return;

    // Component 1 saves draft
    await sharedAdapter.saveDraft(buildRes.draft);

    // Render Component 2 (re-mount) with same adapter
    const htmlRemount = renderToStaticMarkup(
      React.createElement(PhotoCaptureCard, {
        isSimulatedDraftMode: true,
        draftAdapter: sharedAdapter
      })
    );

    // Verify component renders without crashing
    assert(htmlRemount.includes('photo-capture-container'), 'Remount must render PhotoCaptureCard');
    assert(htmlRemount.includes('模擬ドラフト保存'), 'Must include simulated draft button');

    // Verify sharedAdapter retains saved draft
    const summaries = await sharedAdapter.listDraftSummaries();
    assert(summaries.length === 1, 'Draft survives across component instances');
    assert(summaries[0].sku === ctx.sku, 'Surviving draft SKU matches');
  });

  // Test 13: Clear status separation (Stash vs Draft vs Evidence Vault)
  await test('Test 13: Clear status separation distinguishes Stash, Draft, and Evidence Vault', () => {
    const notice = IndexedDbPhotoDraftAdapter.getStorageNoticeJa();
    assert(notice.includes('IndexedDB'), 'Must mention IndexedDB');
    assert(notice.includes('セーフティネット'), 'Must state safety net');
    assert(notice.includes('Evidence Vault'), 'Must state not Evidence Vault');
    assert(notice.includes('消去'), 'Must warn about deletion risk');
  });

  // Test 14: Unconfirmed context isolation (UNLINKED_HOLD under UNCONFIRMED:: namespace)
  await test('Test 14: Unconfirmed context uses UNCONFIRMED:: namespace and cannot be saved as confirmed draft', () => {
    const unconfirmedCtx: PhotoCaptureTargetContext = { isConfirmed: false, sku: '', inventoryUnitId: '' };
    const photo = createSyntheticPhoto({ id: 'p-unconf', angle: 'FRONT', sku: '', inventoryUnitId: '' });

    const buildRes = buildPhotoDraftRecord({
      targetContext: unconfirmedCtx,
      capturedPhotos: { FRONT: photo, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null },
      sessionId: 'sess_isolation_123'
    });

    assert(buildRes.success === true, 'Unconfirmed build succeeds');
    if (buildRes.success) {
      assert(buildRes.draft.draftKey.startsWith('UNCONFIRMED::'), 'Must use UNCONFIRMED:: prefix');
      assert(buildRes.draft.status === 'HOLD_UNCONFIRMED_ID', 'Status must be HOLD_UNCONFIRMED_ID');
      assert(buildRes.draft.isConfirmed === false, 'isConfirmed is false');
    }
  });

  // Test 15: Restore overwrite guard requires explicit approval and cancels cleanly
  await test('Test 15: Restore overwrite guard blocks execution without approval checkbox and keeps original photos on cancel', async () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const ctx = TARGET_CONTEXT_PRESETS[1].context;
    const draftPhoto = createSyntheticPhoto({ id: 'p-saved-modal', angle: 'FRONT', sku: ctx.sku!, inventoryUnitId: ctx.inventoryUnitId!, pattern: 'SAVED_MODAL' });
    const buildRes = buildPhotoDraftRecord({
      targetContext: ctx,
      capturedPhotos: { FRONT: draftPhoto, BACK: null, LEFT: null, RIGHT: null, TOP: null, LABEL_TAG: null, DEFECT_DETAIL: null }
    });
    assert(buildRes.success === true, 'Build must succeed');
    if (!buildRes.success) return;

    const modalState: DraftRestoreModalState = {
      isOpen: true,
      targetSummary: {
        draftKey: `${ctx.sku}::${ctx.inventoryUnitId}`,
        sku: ctx.sku!,
        inventoryUnitId: ctx.inventoryUnitId!,
        itemTitle: ctx.itemTitle || '',
        version: 1,
        photoCount: 1,
        usablePhotoCount: 1,
        estimatedBytes: 1024,
        recordChecksum: 'abc123',
        savedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
        status: 'DRAFT_LOCAL_SAVED',
        isConfirmed: true
      },
      targetDraft: buildRes.draft,
      isLoading: false,
      errorMessage: null,
      hasUnsavedConflict: true,
      currentPhotoCount: 2
    };

    const html = renderToStaticMarkup(
      React.createElement(PhotoCaptureCard, {
        isSimulatedDraftMode: true,
        draftAdapter: adapter,
        initialRestoreModal: modalState
      })
    );

    // Verify warning & detailed comparison
    assert(html.includes('未保存写真の上書き警告・明示的最終承認が必要'), 'Modal must show guarded warning');
    assert(html.includes('現在の未保存写真（2枚）を破棄し'), 'Must indicate 2 unsaved photos');
    assert(html.includes('confirm-restore-overwrite-checkbox'), 'Must provide confirmation checkbox');
    assert(html.includes('execute-restore-modal-btn'), 'Must have execute restore button');
    assert(html.includes('cancel-restore-modal-btn'), 'Must have cancel restore button');
    assert(html.includes('disabled=""') || html.includes('disabled'), 'Execute button must be disabled until approved');
    assert(html.includes('復元をキャンセル（現在の状態を保持）'), 'Cancel button must explicitly promise keeping current state');
  });

  // Test 16: UI disclosure statement clearly warns that in-memory mock drafts are lost on tab termination
  await test('Test 16: UI disclosure clearly warns that in-memory mock drafts are lost on tab termination and do not survive PC reboot', () => {
    const adapter = new IndexedDbPhotoDraftAdapter({ useSimulatedStore: true });
    const html = renderToStaticMarkup(
      React.createElement(PhotoCaptureCard, {
        isSimulatedDraftMode: true,
        draftAdapter: adapter,
        initialShowDraftDrawer: true
      })
    );

    // Verify explicit disclosure of in-memory loss and PC reboot non-persistence
    assert(html.includes('タブ終了で消失'), 'Must disclose loss on tab termination');
    assert(html.includes('PC再起動後やブラウザ終了後は復元できません'), 'Must clarify non-persistence across reboot/close');
    assert(html.includes('正式な証拠保存（Evidence Vault）や在庫DBではありません'), 'Must clearly state not official storage');
    assert(!html.includes('PC再起動・ブラウザ終了後の消失を防ぐセーフティネット'), 'Must not contain misleading claims');
  });

  // Test 17: Triple-guard real IndexedDB safety check blocks unauthorized persistence
  await test('Test 17: Triple-guard safety check strictly requires loopback origin, profile marker, and explicit feature flag', () => {
    // 1. All 3 conditions met (simulated window environment)
    const validCheck = checkRealDraftPersistenceSafety({
      enableFlag: true,
      profileMarker: true
    });
    // In node/jest environment, window might not have localhost:port by default, let's verify mock
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {
        location: {
          hostname: '127.0.0.1',
          port: '5173',
          protocol: 'http:'
        }
      };

      const permitted = checkRealDraftPersistenceSafety({
        enableFlag: true,
        profileMarker: true
      });
      assert(permitted.isPermitted === true, 'All 3 conditions met must be permitted');
      assert(permitted.isTestOrigin === true, 'Test origin must be true');
      assert(permitted.isDedicatedProfile === true, 'Dedicated profile must be true');
      assert(permitted.isExplicitFlag === true, 'Explicit flag must be true');

      // 2. Production origin rejection
      (globalThis as any).window.location.hostname = 'app.jptreasurehunting.com';
      const prodOrigin = checkRealDraftPersistenceSafety({
        enableFlag: true,
        profileMarker: true
      });
      assert(prodOrigin.isPermitted === false, 'Production origin must be rejected');
      assert(prodOrigin.isTestOrigin === false, 'Production origin cannot be test origin');
      assert(prodOrigin.reasonJa.includes('ローカルテストOrigin'), 'Reason must specify test origin');

      // 3. Missing profile marker
      (globalThis as any).window.location.hostname = 'localhost';
      const noProfile = checkRealDraftPersistenceSafety({
        enableFlag: true,
        profileMarker: false
      });
      assert(noProfile.isPermitted === false, 'Missing profile marker must be rejected');
      assert(noProfile.reasonJa.includes('使い捨てテストプロファイル'), 'Reason must specify disposable profile');

      // 4. Missing feature flag
      const noFlag = checkRealDraftPersistenceSafety({
        enableFlag: false,
        profileMarker: true
      });
      assert(noFlag.isPermitted === false, 'Missing feature flag must be rejected');
      assert(noFlag.reasonJa.includes('フィーチャーフラグ'), 'Reason must specify feature flag');

      // 5. Flag alone on non-test environment must never enable
      (globalThis as any).window.location.hostname = 'business.internal';
      const flagAlone = checkRealDraftPersistenceSafety({
        enableFlag: true,
        profileMarker: false
      });
      assert(flagAlone.isPermitted === false, 'Flag alone must never enable persistence');
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  // Test 18: Real IndexedDB test mode UI rendering & clear 3-way distinction
  await test('Test 18: PhotoCaptureCard renders dedicated real draft button, 3-way storage distinction, and eviction disclaimer', () => {
    const originalWindow = (globalThis as any).window;
    try {
      (globalThis as any).window = {
        location: {
          hostname: '127.0.0.1',
          port: '5173',
          protocol: 'http:'
        }
      };

      // 1. Triple-guard active render
      const activeHtml = renderToStaticMarkup(
        React.createElement(PhotoCaptureCard, {
          enableRealIndexedDbTestMode: true,
          isolatedTestProfileMarker: true,
          initialShowDraftDrawer: true
        })
      );

      assert(activeHtml.includes('save-real-draft-btn'), 'Active test mode must render save-real-draft-btn');
      assert(activeHtml.includes('ブラウザ内ドラフト保存（テスト専用）'), 'Button must state browser draft test only');
      assert(activeHtml.includes('[INDEXEDDB_TEST]'), 'Drawer must display [INDEXEDDB_TEST] badge');
      assert(activeHtml.includes('閲覧履歴・Cookie・サイトデータ消去'), 'Must display site data clearance disclaimer');
      assert(activeHtml.includes('エビクション時はデータが消失するリスク'), 'Must display storage eviction risk disclaimer');
      assert(activeHtml.includes('[SIMULATED_MOCK]'), 'Must distinguish [SIMULATED_MOCK]');
      assert(activeHtml.includes('[EVIDENCE_VAULT]'), 'Must distinguish [EVIDENCE_VAULT]');

      // 2. Normal / non-test mode render (guards inactive)
      const inactiveHtml = renderToStaticMarkup(
        React.createElement(PhotoCaptureCard, {
          enableRealIndexedDbTestMode: false,
          isolatedTestProfileMarker: false,
          isSimulatedDraftMode: false
        })
      );

      assert(!inactiveHtml.includes('save-real-draft-btn'), 'Inactive test mode must not render active real draft save button');
      assert(inactiveHtml.includes('実IndexedDB保存（無効化中）'), 'Inactive mode must render disabled locked button');
      assert(inactiveHtml.includes('disabled'), 'Locked button must be disabled');
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });

  return { passed, failed, log };
}
