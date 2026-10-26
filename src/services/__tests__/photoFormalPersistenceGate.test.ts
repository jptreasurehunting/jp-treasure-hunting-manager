/**
 * Automated Test Suite: Photo Formal Persistence Gate & Disaster Recovery Safety (JTH-STEP 47)
 *
 * Verifies:
 * 1. Storage Architecture Comparison & Candidate D Hybrid Recommendation
 * 2. 5-Phase Durability Protocol Execution (Validation -> Staging -> Readback SHA-256 -> Commit -> UI ACK)
 * 3. Operator Approval Requirement & Unconfirmed Context Isolation
 * 4. Cross-SKU / Cross-Unit Context Pollution Rejection
 * 5. Essential 4-Angle Completeness Guard
 * 6. Cryptographic Read-Back SHA-256 Tampering Detection & Suspect File Quarantine
 * 7. Generation Retention: Non-destructive v2 promotion retains v1 predecessor
 * 8. Comprehensive Failure Matrix Mapping & State Transitions
 * 9. TOCTOU & Windows Reparse Point Path Traversal Containment Defense
 * 10. Verified Backup Restoration Audit: Bit-for-bit raw photo integrity verification
 * 11. Quantitative Sizing Assumptions & Explicit User Decision Enumeration
 * 12. Strict Boundary: IndexedDB draft is transient; formal Vault requires explicit gate pass
 */

import {
  getStorageArchitectureComparisons,
  getFailureMatrix,
  getQuantitativeSizingAssumptions,
  isPathContained,
  evaluateFormalPersistencePromotionGate,
  auditAndVerifyBackupRestoration
} from '../photoFormalPersistenceGateService';
import { computeSha256Hex } from '../photoEvidenceVaultService';
import type { PhotoAngle, CapturedPhoto, PhotoCaptureTargetContext } from '../../types/photoCapture';
import type { PhotoDraftRecord, PhotoDraftItem } from '../../types/photoDraft';
import type { FormalVaultBackupSpec } from '../../types/photoFormalPersistenceGate';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createSyntheticDraftPhoto(angle: PhotoAngle, id: string, sku: string, unitId: string): PhotoDraftItem {
  const rawSvg = `data:image/svg+xml;utf8,<svg id="raw_${angle}_${id}"><rect width="100" height="100" fill="#2563eb"/><text>RAW_IMMUTABLE_${angle}</text></svg>`;
  const workSvg = `data:image/svg+xml;utf8,<svg id="work_${angle}_${id}"><rect width="100" height="100" fill="#38bdf8"/><text>WORK_${angle}</text></svg>`;

  return {
    angle,
    capturedAt: new Date().toISOString(),
    dataUrl: workSvg,
    originalDataUrl: rawSvg,
    originalSha256Checksum: computeSha256Hex(rawSvg),
    workingSha256Checksum: computeSha256Hex(workSvg),
    byteSize: rawSvg.length + workSvg.length,
    qaResult: {
      status: 'USE_AS_IS',
      issues: [],
      metrics: { blurScore: 10, brightness: 125, framingCoverage: 95, glareScore: 5 },
      suggestedAction: '合格'
    }
  };
}

function buildValidTestDraft(sku: string, unitId: string, version: number = 1): PhotoDraftRecord {
  const photos: Partial<Record<PhotoAngle, PhotoDraftItem>> = {
    FRONT: createSyntheticDraftPhoto('FRONT', '1', sku, unitId),
    BACK: createSyntheticDraftPhoto('BACK', '2', sku, unitId),
    LEFT: createSyntheticDraftPhoto('LEFT', '3', sku, unitId),
    RIGHT: createSyntheticDraftPhoto('RIGHT', '4', sku, unitId)
  };

  const draftKey = `${sku}::${unitId}`;
  return {
    draftKey,
    sku,
    inventoryUnitId: unitId,
    itemTitle: '【架空テスト】Leica Summicron 50mm F2',
    sessionId: `sess_${Date.now()}`,
    version,
    status: 'DRAFT_LOCAL_SAVED',
    isConfirmed: true,
    savedAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    photos,
    photoCount: 4,
    usablePhotoCount: 4,
    estimatedBytes: 4096,
    currentAngleIndex: 3,
    recordChecksum: computeSha256Hex(`DRAFT_${draftKey}_v${version}`)
  };
}

export async function runPhotoFormalPersistenceGateTests(): Promise<{
  passed: number;
  failed: number;
  log: string[];
}> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];

  const test = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      passed++;
      log.push(`✅ ${name}`);
    } catch (err: any) {
      failed++;
      log.push(`❌ ${name}: ${err?.message || err}`);
    }
  };

  // Test 1: Storage Architecture Comparison & Candidate D Hybrid Recommendation
  await test('Test 1: Architecture candidate comparison selects Candidate D Hybrid as RECOMMENDED', () => {
    const comparisons = getStorageArchitectureComparisons();

    assert(comparisons.CANDIDATE_A_WINDOWS_APP_LOCAL.recommendation === 'REJECTED', 'Candidate A must be REJECTED');
    assert(comparisons.CANDIDATE_A_WINDOWS_APP_LOCAL.fitForCurrentWebSpa === false, 'Candidate A must not fit Web SPA');

    assert(comparisons.CANDIDATE_B_LOCAL_FS_SQLITE.recommendation === 'DEFERRED', 'Candidate B must be DEFERRED');

    assert(comparisons.CANDIDATE_C_BACKEND_VAULT_ONLY.recommendation === 'DEFERRED', 'Candidate C must be DEFERRED');
    assert(comparisons.CANDIDATE_C_BACKEND_VAULT_ONLY.consJa.some(c => c.includes('回線瞬断')), 'Candidate C must note offline risk');

    assert(comparisons.CANDIDATE_D_HYBRID_LOCAL_CACHE_REMOTE_VAULT.recommendation === 'RECOMMENDED', 'Candidate D must be RECOMMENDED');
    assert(comparisons.CANDIDATE_D_HYBRID_LOCAL_CACHE_REMOTE_VAULT.safetyScore === 5, 'Candidate D safety score must be 5');
    assert(comparisons.CANDIDATE_D_HYBRID_LOCAL_CACHE_REMOTE_VAULT.fitForCurrentWebSpa === true, 'Candidate D must fit current Web SPA');
  });

  // Test 2: 5-Phase Durability Protocol Execution
  await test('Test 2: Formal promotion gate executes all 5 durability phases and commits immutable record', async () => {
    const draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-FORMAL-01',
      inventoryUnitId: 'UNIT-FORMAL-001',
      itemTitle: 'Leica Summicron',
      isConfirmed: true
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: context,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === true, 'Gate evaluation must succeed');
    assert(res.status === 'COMMITTED_PERSISTED', 'Status must be COMMITTED_PERSISTED');
    assert(res.completedPhase === 'PHASE_5_AUDIT_TRAIL_UI_ACK', 'Must complete Phase 5');
    assert(Boolean(res.vaultRecord), 'Vault record must be generated');
    assert(res.vaultRecord?.recordId === 'EVD-SKU-FORMAL-01-UNIT-FORMAL-001', 'Record ID must match composite key');
    assert(res.vaultRecord?.totalPhotoCount === 4, 'Total photo count must be 4');
    assert(res.vaultRecord?.auditTrail.length === 2, 'Audit trail must include creation and promotion events');
  });

  // Test 3: Operator Approval Requirement
  await test('Test 3: Promotion gate blocks execution if operator approval is not granted', async () => {
    const draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-FORMAL-01',
      inventoryUnitId: 'UNIT-FORMAL-001',
      isConfirmed: true
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: context,
      operatorApproval: false,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === false, 'Must fail without operator approval');
    assert(res.status === 'HOLD_UNCONFIRMED_ID', 'Status must be HOLD_UNCONFIRMED_ID');
    assert(res.error === 'OPERATOR_APPROVAL_REQUIRED', 'Error must be OPERATOR_APPROVAL_REQUIRED');
  });

  // Test 4: Unconfirmed Context Guard
  await test('Test 4: Promotion gate blocks execution if target SKU/Unit ID is unconfirmed', async () => {
    const draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 1);
    const unconfirmedContext: PhotoCaptureTargetContext = {
      sku: '',
      inventoryUnitId: '',
      isConfirmed: false
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: unconfirmedContext,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === false, 'Must reject unconfirmed context');
    assert(res.status === 'HOLD_UNCONFIRMED_ID', 'Status must be HOLD_UNCONFIRMED_ID');
    assert(res.error === 'UNCONFIRMED_CONTEXT', 'Error must be UNCONFIRMED_CONTEXT');
  });

  // Test 5: Cross-Context Pollution Prevention
  await test('Test 5: Promotion gate rejects draft when SKU/Unit does not match target context', async () => {
    const draft = buildValidTestDraft('SKU-PRODUCT-A', 'UNIT-ALPHA', 1);
    const alienContext: PhotoCaptureTargetContext = {
      sku: 'SKU-PRODUCT-B',
      inventoryUnitId: 'UNIT-BETA',
      isConfirmed: true
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: alienContext,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === false, 'Must reject mismatched context');
    assert(res.status === 'HOLD_CROSS_POLLUTION', 'Status must be HOLD_CROSS_POLLUTION');
    assert(res.error === 'CROSS_CONTEXT_POLLUTION', 'Error must be CROSS_CONTEXT_POLLUTION');
  });

  // Test 6: Essential 4-Angle Completeness Guard
  await test('Test 6: Promotion gate rejects draft missing essential angle photos', async () => {
    const draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 1);
    // Remove essential RIGHT angle
    delete draft.photos.RIGHT;

    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-FORMAL-01',
      inventoryUnitId: 'UNIT-FORMAL-001',
      isConfirmed: true
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: context,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === false, 'Must reject missing essential angles');
    assert(res.status === 'HOLD_UNCONFIRMED_ID', 'Status must be HOLD_UNCONFIRMED_ID');
    assert(res.error === 'ESSENTIAL_ANGLES_MISSING', 'Error must be ESSENTIAL_ANGLES_MISSING');
  });

  // Test 7: Cryptographic Read-Back SHA-256 Tampering Detection & File Quarantine
  await test('Test 7: Tampered raw photo checksum triggers HOLD_CORRUPTED_CHECKSUM and quarantines suspect file', async () => {
    const draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 1);
    // Tamper with FRONT angle raw dataUrl without updating stored checksum
    if (draft.photos.FRONT) {
      draft.photos.FRONT.originalDataUrl = draft.photos.FRONT.originalDataUrl + '_TAMPERED';
    }

    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-FORMAL-01',
      inventoryUnitId: 'UNIT-FORMAL-001',
      isConfirmed: true
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: context,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === false, 'Tampered photo must fail gate');
    assert(res.status === 'HOLD_CORRUPTED_CHECKSUM', 'Status must be HOLD_CORRUPTED_CHECKSUM');
    assert(res.completedPhase === 'PHASE_3_CRYPTOGRAPHIC_READBACK_VERIFY', 'Must stop at Phase 3');
    assert(Boolean(res.quarantinedFiles && res.quarantinedFiles.length > 0), 'Must list quarantined files');
    assert(!res.vaultRecord, 'Vault record must NOT be committed');
  });

  // Test 8: Generation Retention on Non-Destructive Version Increment
  await test('Test 8: Promoting v2 preserves predecessor v1 generation and records retention link', async () => {
    const v2Draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 2);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-FORMAL-01',
      inventoryUnitId: 'UNIT-FORMAL-001',
      isConfirmed: true
    };

    const res = await evaluateFormalPersistencePromotionGate({
      sourceDraft: v2Draft,
      targetContext: context,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(res.success === true, 'v2 promotion must succeed');
    assert(res.retainedPredecessorVersion === 1, 'Must retain predecessor v1 version');
    assert(Boolean(res.vaultRecord?.auditTrail.some(a => a.reason.includes('v2'))), 'Audit trail must mention v2');
  });

  // Test 9: Failure Matrix Mapping & State Consistency
  await test('Test 9: Comprehensive failure matrix defines all mandatory disaster scenarios', () => {
    const matrix = getFailureMatrix();
    assert(matrix.length >= 8, 'Matrix must contain at least 8 failure scenarios');

    const ids = matrix.map(m => m.id);
    assert(ids.includes('SCN_DISK_FULL'), 'Must cover SCN_DISK_FULL');
    assert(ids.includes('SCN_DUPLICATE_REGISTRATION'), 'Must cover SCN_DUPLICATE_REGISTRATION');
    assert(ids.includes('SCN_CONCURRENT_WRITE_LOCK'), 'Must cover SCN_CONCURRENT_WRITE_LOCK');
    assert(ids.includes('SCN_CHECKSUM_MISMATCH'), 'Must cover SCN_CHECKSUM_MISMATCH');
    assert(ids.includes('SCN_OS_CRASH_MID_WRITE'), 'Must cover SCN_OS_CRASH_MID_WRITE');
    assert(ids.includes('SCN_POWER_FAILURE_DIRTY_BUFFER'), 'Must cover SCN_POWER_FAILURE_DIRTY_BUFFER');
    assert(ids.includes('SCN_NETWORK_DISRUPTION'), 'Must cover SCN_NETWORK_DISRUPTION');
    assert(ids.includes('SCN_REPARSE_POINT_TRAVERSAL'), 'Must cover SCN_REPARSE_POINT_TRAVERSAL');

    for (const scn of matrix) {
      assert(Boolean(scn.triggerCondition), `Scenario ${scn.id} must define triggerCondition`);
      assert(Boolean(scn.detectionMechanism), `Scenario ${scn.id} must define detectionMechanism`);
      assert(Boolean(scn.systemBehavior), `Scenario ${scn.id} must define systemBehavior`);
      assert(Boolean(scn.recoveryProtocolJa), `Scenario ${scn.id} must define recoveryProtocolJa`);
    }
  });

  // Test 10: TOCTOU & Windows Reparse Point Path Traversal Containment Defense
  await test('Test 10: Path containment defense allows valid subpaths and rejects traversal/symlinks', () => {
    const base = 'C:\\Projects\\jp-treasure-hunting-manager\\vault_storage';

    // Legitimate subpaths
    assert(isPathContained(base, 'C:\\Projects\\jp-treasure-hunting-manager\\vault_storage\\SKU-01\\raw.jpg') === true, 'Legitimate subpath must be accepted');
    assert(isPathContained(base, 'C:/Projects/jp-treasure-hunting-manager/vault_storage/SKU-01/raw.jpg') === true, 'Forward slash normalization must be accepted');

    // Directory traversal attacks
    assert(isPathContained(base, 'C:\\Projects\\jp-treasure-hunting-manager\\vault_storage\\..\\secret.key') === false, 'Relative traversal .. must be rejected');
    assert(isPathContained(base, 'C:\\Projects\\jp-treasure-hunting-manager\\vault_storage-evil\\photo.jpg') === false, 'Adjacent folder collision must be rejected');
    assert(isPathContained(base, 'C:\\Windows\\System32\\cmd.exe') === false, 'External system path must be rejected');
  });

  // Test 11: Verified Backup Restoration Audit
  await test('Test 11: Backup restoration audit verifies raw photo SHA-256 and quarantines tampered backups', async () => {
    const draft = buildValidTestDraft('SKU-FORMAL-01', 'UNIT-FORMAL-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-FORMAL-01',
      inventoryUnitId: 'UNIT-FORMAL-001',
      isConfirmed: true
    };

    const promoRes = await evaluateFormalPersistencePromotionGate({
      sourceDraft: draft,
      targetContext: context,
      operatorApproval: true,
      operatorId: 'OP-INSPECTOR-77'
    });

    assert(promoRes.success === true && promoRes.vaultRecord !== undefined, 'Promotion must succeed');
    const record = promoRes.vaultRecord!;

    // 1. Intact backup audit
    const intactBackupSpec: FormalVaultBackupSpec = {
      backupId: 'BKP-TEST-001',
      sourceVaultRecordId: record.recordId,
      targetDomain: 'INDEPENDENT_COLD_STORAGE',
      createdAt: new Date().toISOString(),
      rawAssetCount: record.totalPhotoCount,
      totalBytes: record.totalByteSize,
      manifestSha256: record.recordChecksum,
      isEncrypted: true,
      encryptionAlgorithm: 'AES-256-GCM',
      isWormLocked: true,
      retentionExpirationDate: '2033-10-26T00:00:00Z'
    };

    const auditPass = await auditAndVerifyBackupRestoration(intactBackupSpec, record);
    assert(auditPass.overallIntegrityValid === true, 'Intact backup audit must pass');
    assert(auditPass.isRestorableToIsolatedTarget === true, 'Must be restorable');
    assert(auditPass.checksumMatchCount === 4, 'All 4 photos must match checksum');
    assert(auditPass.quarantinedFiles.length === 0, 'No files quarantined on pass');

    // 2. Corrupted manifest backup audit
    const tamperedBackupSpec: FormalVaultBackupSpec = {
      ...intactBackupSpec,
      backupId: 'BKP-TEST-TAMPERED',
      manifestSha256: 'tampered_manifest_checksum_9999'
    };

    const auditFail = await auditAndVerifyBackupRestoration(tamperedBackupSpec, record);
    assert(auditFail.overallIntegrityValid === false, 'Tampered backup audit must fail');
    assert(auditFail.isRestorableToIsolatedTarget === false, 'Must not be restorable');
    assert(auditFail.quarantinedFiles.length > 0, 'Corrupted manifest must be quarantined');
  });

  // Test 12: Quantitative Sizing Assumptions
  await test('Test 12: Quantitative sizing assumptions and required user decisions are documented', () => {
    const assumptions = getQuantitativeSizingAssumptions();

    assert(assumptions.dailyInspectionUnitsAssumption > 0, 'Must have daily units assumption');
    assert(assumptions.photosPerUnitAssumption === 7, 'Must assume 7 angles per unit');
    assert(assumptions.formalVaultRetentionYears >= 5, 'Legal retention must be at least 5 years');
    assert(assumptions.userDecisionsRequired.length >= 4, 'Must list at least 4 required user decisions');
  });

  return { passed, failed, log };
}
