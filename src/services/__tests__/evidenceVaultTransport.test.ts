/**
 * Automated Test Suite: Evidence Vault Transport & Promotion Safety Gates (JTH-STEP 49)
 *
 * Verifies:
 * 1. Normal End-to-End Promotion to COMMITTED_PERSISTED (Init -> Upload -> Verify -> Commit -> Query Confirm)
 * 2. Operator Approval Gate (Halts at PROMOTION_REVIEW_REQUIRED if unapproved)
 * 3. Unconfirmed SKU / Inventory Unit ID Guard (Halts at HOLD_REVIEW_REQUIRED)
 * 4. Cross-Context Contamination Guard (SKU/Unit mismatch rejection)
 * 5. Essential 4-Angle Completeness Guard
 * 6. Raw Photo Tampering / Cryptographic Checksum Mismatch & Quarantine
 * 7. Non-Destructive Invariant: Zero silent deletion of drafts, old generations, or raw assets
 * 8. Idempotency Key Replay Protection (No duplicate formal persistence records)
 * 9. Conflicting Idempotency Key Payload Misuse Detection
 * 10. Generation Retention: v2 links predecessor v1 without overwriting
 * 11. Network Timeout during Commit -> HOLD_UNKNOWN_TIMEOUT (Outcome Unknown state)
 * 12. Timeout Reconciliation via Server Status Query
 * 13. Server-Side Commit I/O Failure Handling & Session Rollback
 * 14. Safe Idempotent Retry with Exponential Backoff
 * 15. Security & Tamper-Proofing Limitation Disclosure Verification
 * 16. Invariant Check: COMMITTED_PERSISTED requires server query confirmation, never raw upload alone
 */

import {
  MockEvidenceVaultTransport,
  EvidenceVaultPromotionCoordinator,
  buildIdempotencyKey,
  getFormalPromotionStateLabel,
  TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA
} from '../evidenceVaultTransportService';
import { computeSha256Hex } from '../photoEvidenceVaultService';
import type { PhotoAngle, PhotoCaptureTargetContext } from '../../types/photoCapture';
import type { PhotoDraftRecord, PhotoDraftItem } from '../../types/photoDraft';
import type {
  VaultOperatorAuthContext,
  FormalPromotionState
} from '../../types/evidenceVaultTransport';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function createSyntheticDraftPhoto(angle: PhotoAngle, id: string): PhotoDraftItem {
  const rawSvg = `data:image/svg+xml;utf8,<svg id="raw_${angle}_${id}"><rect width="120" height="120" fill="#1e293b"/><text>RAW_${angle}</text></svg>`;
  const workSvg = `data:image/svg+xml;utf8,<svg id="work_${angle}_${id}"><rect width="120" height="120" fill="#0284c7"/><text>WORK_${angle}</text></svg>`;

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

function buildValidTestDraft(sku: string, unitId: string, version = 1): PhotoDraftRecord {
  const photos: Partial<Record<PhotoAngle, PhotoDraftItem>> = {
    FRONT: createSyntheticDraftPhoto('FRONT', '1'),
    BACK: createSyntheticDraftPhoto('BACK', '2'),
    LEFT: createSyntheticDraftPhoto('LEFT', '3'),
    RIGHT: createSyntheticDraftPhoto('RIGHT', '4')
  };

  const draftKey = `${sku}::${unitId}`;
  return {
    draftKey,
    sku,
    inventoryUnitId: unitId,
    itemTitle: '【架空テスト】Nikon F3 HP Vintage Body',
    sessionId: `sess_transport_${Date.now()}`,
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
    recordChecksum: computeSha256Hex(`DRAFT_TRANSPORT_${draftKey}_v${version}`)
  };
}

const mockAuthContext: VaultOperatorAuthContext = {
  operatorId: 'OP-CHIEF-99',
  operatorRole: 'SENIOR_INSPECTOR',
  workstationMachineId: 'WS-TOKYO-01',
  inspectionLocation: 'TOKYO_CENTRAL_DEPOT'
};

export async function runEvidenceVaultTransportTests(): Promise<{
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

  // Test 1: Normal End-to-End Promotion
  await test('Test 1: Normal promotion executes full pipeline and commits query-confirmed vault record', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-01',
      inventoryUnitId: 'UNIT-VAULT-001',
      itemTitle: 'Nikon F3 HP',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext,
      targetVaultDomain: 'SIMULATED_TEST_VAULT'
    });

    assert(res.success === true, 'Promotion must succeed');
    assert(res.state === 'COMMITTED_PERSISTED', 'State must be COMMITTED_PERSISTED');
    assert(res.isQueryConfirmed === true, 'Record must be verified by server query');
    assert(Boolean(res.committedRecordId), 'Committed record ID must exist');
    assert(res.uploadedAssetCount === 4, 'All 4 photos must be uploaded');
    assert(res.quarantinedFiles.length === 0, 'No files should be quarantined');

    const diag = transport.getTransportDiagnostics();
    assert(diag.committedRecordCount === 1, 'Server vault must contain 1 committed record');
  });

  // Test 2: Operator Approval Gate
  await test('Test 2: Promotion halts at PROMOTION_REVIEW_REQUIRED when operator approval is missing', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-01',
      inventoryUnitId: 'UNIT-VAULT-001',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: false, // NOT approved
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Must fail without operator approval');
    assert(res.state === 'PROMOTION_REVIEW_REQUIRED', 'Must stop at PROMOTION_REVIEW_REQUIRED');
    assert(res.error === 'OPERATOR_APPROVAL_REQUIRED', 'Error must indicate approval required');
  });

  // Test 3: Unconfirmed Target Context Guard
  await test('Test 3: Promotion halts when target SKU or Unit ID is unconfirmed', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    const unconfirmedContext: PhotoCaptureTargetContext = {
      sku: '',
      inventoryUnitId: '',
      isConfirmed: false
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, unconfirmedContext, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Must fail on unconfirmed context');
    assert(res.state === 'HOLD_REVIEW_REQUIRED', 'Must hold at HOLD_REVIEW_REQUIRED');
    assert(res.error === 'UNCONFIRMED_TARGET_CONTEXT', 'Error must indicate unconfirmed context');
  });

  // Test 4: Cross-Context Pollution Rejection
  await test('Test 4: Promotion rejects draft with SKU/Unit mismatching active inspection target', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-TARGET-A', 'UNIT-ALPHA', 1);
    const alienContext: PhotoCaptureTargetContext = {
      sku: 'SKU-TARGET-B',
      inventoryUnitId: 'UNIT-BETA',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, alienContext, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Must reject mismatched context');
    assert(res.state === 'HOLD_REVIEW_REQUIRED', 'Must enter HOLD_REVIEW_REQUIRED');
    assert(res.error === 'CONTEXT_MISMATCH', 'Error must be CONTEXT_MISMATCH');
  });

  // Test 5: Essential Angle Completeness Guard
  await test('Test 5: Promotion rejects draft missing essential photo angles', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    delete draft.photos.RIGHT; // Remove essential angle

    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-01',
      inventoryUnitId: 'UNIT-VAULT-001',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Must reject missing angle');
    assert(res.state === 'HOLD_REVIEW_REQUIRED', 'Must enter HOLD_REVIEW_REQUIRED');
    assert(res.error === 'ESSENTIAL_ANGLES_MISSING', 'Error must be ESSENTIAL_ANGLES_MISSING');
  });

  // Test 6: Raw Photo Tampering / Cryptographic Checksum Mismatch & Quarantine
  await test('Test 6: Raw photo checksum mismatch halts promotion and quarantines corrupted asset', async () => {
    const transport = new MockEvidenceVaultTransport({ simulateChecksumMismatch: true });
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-01',
      inventoryUnitId: 'UNIT-VAULT-001',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Checksum mismatch must fail promotion');
    assert(res.state === 'HOLD_REVIEW_REQUIRED', 'Must enter HOLD_REVIEW_REQUIRED');
    assert(res.quarantinedFiles.length > 0, 'Corrupted file must be quarantined');
    assert(res.isQueryConfirmed === false, 'Must not be query confirmed');

    const diag = transport.getTransportDiagnostics();
    assert(diag.committedRecordCount === 0, 'No record must be committed to server vault');
  });

  // Test 7: Non-Destructive Invariant
  await test('Test 7: In all error conditions, draft photos and raw assets are preserved without deletion', async () => {
    const transport = new MockEvidenceVaultTransport({ simulateChecksumMismatch: true });
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-01',
      inventoryUnitId: 'UNIT-VAULT-001',
      isConfirmed: true
    };

    const originalFrontRaw = draft.photos.FRONT?.originalDataUrl;

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Operation must fail');
    // Verify draft is intact
    assert(draft.photos.FRONT?.originalDataUrl === originalFrontRaw, 'Original raw dataUrl must remain unchanged');
    assert(Object.keys(draft.photos).length === 4, 'All 4 photos must still exist in draft');
  });

  // Test 8: Idempotency Key Replay Protection
  await test('Test 8: Replay with identical idempotency key returns existing committed record without duplication', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-01', 'UNIT-VAULT-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-01',
      inventoryUnitId: 'UNIT-VAULT-001',
      isConfirmed: true
    };

    // First attempt
    const firstRes = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });
    assert(firstRes.success === true, 'First promotion must succeed');

    // Second replay attempt with identical draft and idempotency key
    const replayRes = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(replayRes.success === true, 'Replay must succeed');
    assert(replayRes.committedRecordId === firstRes.committedRecordId, 'Must return same committed record ID');

    const diag = transport.getTransportDiagnostics();
    assert(diag.committedRecordCount === 1, 'Server vault must still contain only 1 record (no duplicate)');
  });

  // Test 9: Conflicting Idempotency Key Payload Misuse
  await test('Test 9: Conflicting payload with identical idempotency key triggers IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', async () => {
    const transport = new MockEvidenceVaultTransport();

    const req1 = {
      idempotencyKey: 'IDEMP-TEST-SHARED-KEY',
      sku: 'SKU-01',
      inventoryUnitId: 'UNIT-01',
      draftVersion: 1,
      expectedPhotoCount: 4,
      expectedTotalBytes: 4000,
      expectedAngles: ['FRONT', 'BACK', 'LEFT', 'RIGHT'] as PhotoAngle[],
      draftRecordChecksum: 'CHECKSUM_AAA',
      targetVaultDomain: 'SIMULATED_TEST_VAULT' as const,
      authContext: mockAuthContext,
      operatorApproval: true,
      approvalTimestamp: new Date().toISOString()
    };

    const res1 = await transport.initiateSession(req1);
    assert(res1.success === true, 'First session must succeed');

    // Conflicting request with same idempotency key but different checksum/photo count
    const req2 = {
      ...req1,
      expectedPhotoCount: 7,
      draftRecordChecksum: 'CONFLICTING_CHECKSUM_BBB'
    };

    const res2 = await transport.initiateSession(req2);
    assert(res2.success === false, 'Conflicting request must be rejected');
    assert(res2.error === 'IDEMPOTENCY_KEY_PAYLOAD_MISMATCH', 'Must detect payload mismatch');
    assert(res2.state === 'HOLD_REVIEW_REQUIRED', 'Must enter HOLD_REVIEW_REQUIRED');
  });

  // Test 10: Generation Retention (v1 retained when promoting v2)
  await test('Test 10: Promoting v2 preserves predecessor v1 in server vault without destructive overwrite', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-GEN',
      inventoryUnitId: 'UNIT-GEN-001',
      isConfirmed: true
    };

    // Promote v1
    const v1Draft = buildValidTestDraft('SKU-VAULT-GEN', 'UNIT-GEN-001', 1);
    const v1Res = await coordinator.promoteDraftToFormalVault(v1Draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });
    assert(v1Res.success === true, 'v1 promotion must succeed');

    // Promote v2
    const v2Draft = buildValidTestDraft('SKU-VAULT-GEN', 'UNIT-GEN-001', 2);
    const v2Res = await coordinator.promoteDraftToFormalVault(v2Draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });
    assert(v2Res.success === true, 'v2 promotion must succeed');
    assert(v2Res.retainedPredecessorVersion === 1, 'Must retain predecessor v1');

    // Query v1 and v2 independently
    const qV1 = await transport.queryPromotionStatus({
      idempotencyKey: '',
      sku: 'SKU-VAULT-GEN',
      inventoryUnitId: 'UNIT-GEN-001',
      version: 1
    });
    assert(qV1.isCommittedAndPersisted === true, 'v1 record must still exist');

    const qV2 = await transport.queryPromotionStatus({
      idempotencyKey: '',
      sku: 'SKU-VAULT-GEN',
      inventoryUnitId: 'UNIT-GEN-001',
      version: 2
    });
    assert(qV2.isCommittedAndPersisted === true, 'v2 record must exist');
  });

  // Test 11: Network Timeout during Commit -> HOLD_UNKNOWN_TIMEOUT
  await test('Test 11: Timeout on commit triggers HOLD_UNKNOWN_TIMEOUT and avoids false success/failure assumption', async () => {
    const transport = new MockEvidenceVaultTransport({ simulateTimeoutOnCommit: true });
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-TIMEOUT', 'UNIT-TO-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-TIMEOUT',
      inventoryUnitId: 'UNIT-TO-001',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Timeout must not report success');
    assert(res.state === 'HOLD_UNKNOWN_TIMEOUT', 'State must be HOLD_UNKNOWN_TIMEOUT');
    assert(res.error === 'COMMIT_TIMEOUT_OUTCOME_UNKNOWN', 'Must report outcome unknown');
  });

  // Test 12: Timeout Reconciliation via Server Query
  await test('Test 12: If server actually committed before timeout, query status reconciles to COMMITTED_PERSISTED', async () => {
    const transport = new MockEvidenceVaultTransport();
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-RECON', 'UNIT-REC-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-RECON',
      inventoryUnitId: 'UNIT-REC-001',
      isConfirmed: true
    };

    // First commit completes successfully on server
    const initRes = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });
    assert(initRes.success === true, 'Initial commit succeeds');

    // Simulate client losing connection and reconciling via query
    const idempKey = buildIdempotencyKey(draft.sku, draft.inventoryUnitId, draft.version, draft.sessionId);
    const queryRes = await transport.queryPromotionStatus({ idempotencyKey: idempKey });

    assert(queryRes.isCommittedAndPersisted === true, 'Server confirms record was persisted');
    assert(Boolean(queryRes.committedRecord), 'Committed record is returned');
  });

  // Test 13: Server-Side Commit Failure & Session Rollback
  await test('Test 13: Server commit I/O error transitions to HOLD_REVIEW_REQUIRED and protects assets', async () => {
    const transport = new MockEvidenceVaultTransport({ simulateServerCommitError: true });
    const coordinator = new EvidenceVaultPromotionCoordinator(transport);

    const draft = buildValidTestDraft('SKU-VAULT-ERR', 'UNIT-ERR-001', 1);
    const context: PhotoCaptureTargetContext = {
      sku: 'SKU-VAULT-ERR',
      inventoryUnitId: 'UNIT-ERR-001',
      isConfirmed: true
    };

    const res = await coordinator.promoteDraftToFormalVault(draft, context, {
      operatorApproval: true,
      authContext: mockAuthContext
    });

    assert(res.success === false, 'Commit failure must be reported');
    assert(res.state === 'HOLD_REVIEW_REQUIRED', 'Must enter HOLD_REVIEW_REQUIRED');
    assert(res.error === 'SERVER_COMMIT_IO_FAILURE', 'Must report SERVER_COMMIT_IO_FAILURE');
  });

  // Test 14: Safe Retry with Backoff
  await test('Test 14: Transport retrySafeStep calculates exponential backoff based on attempt count', async () => {
    const transport = new MockEvidenceVaultTransport();
    const req1 = {
      idempotencyKey: 'IDEMP-RETRY-01',
      sku: 'SKU-RETRY',
      inventoryUnitId: 'UNIT-RETRY-01',
      draftVersion: 1,
      expectedPhotoCount: 4,
      expectedTotalBytes: 4000,
      expectedAngles: ['FRONT', 'BACK', 'LEFT', 'RIGHT'] as PhotoAngle[],
      draftRecordChecksum: 'CHECKSUM_RETRY',
      targetVaultDomain: 'SIMULATED_TEST_VAULT' as const,
      authContext: mockAuthContext,
      operatorApproval: true,
      approvalTimestamp: new Date().toISOString()
    };

    const sessionRes = await transport.initiateSession(req1);
    assert(sessionRes.success === true, 'Session created');

    const retry1 = await transport.retrySafeStep({
      sessionId: sessionRes.sessionId,
      idempotencyKey: 'IDEMP-RETRY-01',
      targetFailedState: 'FAILED_RETRYABLE',
      retryAttemptCount: 1
    });

    assert(retry1.success === true, 'Retry 1 accepted');
    assert(retry1.recommendedBackoffMs === 100, 'Attempt 1 backoff should be 100ms');

    const retry2 = await transport.retrySafeStep({
      sessionId: sessionRes.sessionId,
      idempotencyKey: 'IDEMP-RETRY-01',
      targetFailedState: 'FAILED_RETRYABLE',
      retryAttemptCount: 2
    });

    assert(retry2.recommendedBackoffMs === 200, 'Attempt 2 backoff should be 200ms');
  });

  // Test 15: Security & Tamper-Proofing Limitation Disclosure Verification
  await test('Test 15: Statutory disclaimer articulates SHA-256 limits vs independent server audit logs', () => {
    assert(Boolean(TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA), 'Disclaimer must not be empty');
    assert(TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA.includes('改ざん耐性'), 'Must mention tampering resistance');
    assert(TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA.includes('独立監査ログ'), 'Must mention independent audit log');
    assert(TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA.includes('WORM'), 'Must mention WORM');
    assert(TAMPER_PROOFING_LIMITATION_DISCLAIMER_JA.includes('未実装'), 'Must clarify that physical WORM vault is unimplemented');
  });

  // Test 16: COMMITTED_PERSISTED Invariant
  await test('Test 16: COMMITTED_PERSISTED requires server query confirmation, never raw upload alone', async () => {
    const transport = new MockEvidenceVaultTransport();

    // 1. Check state labels
    assert(getFormalPromotionStateLabel('DRAFT_LOCAL_SAVED').includes('1.'), 'Label 1');
    assert(getFormalPromotionStateLabel('HOLD_UNKNOWN_TIMEOUT').includes('11.'), 'Label 11');

    // 2. An asset upload returns UPLOADING, never COMMITTED_PERSISTED
    const initRes = await transport.initiateSession({
      idempotencyKey: 'IDEMP-INV-TEST',
      sku: 'SKU-INV',
      inventoryUnitId: 'UNIT-INV',
      draftVersion: 1,
      expectedPhotoCount: 1,
      expectedTotalBytes: 500,
      expectedAngles: ['FRONT'],
      draftRecordChecksum: 'CHECKSUM_INV',
      targetVaultDomain: 'SIMULATED_TEST_VAULT',
      authContext: mockAuthContext,
      operatorApproval: true,
      approvalTimestamp: new Date().toISOString()
    });

    const rawSvg = '<svg><rect/></svg>';
    const uploadRes = await transport.uploadAsset({
      sessionId: initRes.sessionId,
      idempotencyKey: 'IDEMP-INV-TEST',
      angle: 'FRONT',
      assetId: 'RAW-FRONT-01',
      isImmutableRaw: true,
      mimeType: 'image/svg+xml',
      sha256Checksum: computeSha256Hex(rawSvg),
      byteSize: rawSvg.length,
      payloadDataUrl: rawSvg
    });

    assert(uploadRes.state === 'UPLOADING', 'Upload alone must only yield UPLOADING');
    assert(uploadRes.state !== 'COMMITTED_PERSISTED', 'Upload alone must NEVER yield COMMITTED_PERSISTED');
  });

  return { passed, failed, log };
}
