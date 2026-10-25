/**
 * Listing Pipeline End-to-End Simulation Tests (JTH-STEP 28)
 * Verifies the complete 6-stage mock flow from Photo Capture QA to Listing Publish Gate.
 */

import {
  createMockPipelineScenario,
  executeListingPipelineSimulation
} from '../listingPipelineSimulationService';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runListingPipelineE2ETests(): Promise<{ passed: number; failed: number; log: string[] }> {
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

  // Test 1: Full Pass E2E simulation (All 6 stages pass cleanly)
  test('Test 1: Full Pass E2E simulation succeeds across all 6 stages with overall listing eligibility', () => {
    const opts = createMockPipelineScenario('SUCCESS_FULL_PASS');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === true, 'Overall success must be true');
    assert(result.overallListingEligible === true, 'Overall listing eligibility must be true');
    assert(result.stages.photoCapture.status === 'PASSED', 'Stage 1 Photo Capture must be PASSED');
    assert(result.stages.inventoryGate.status === 'PASSED', 'Stage 2 Inventory Gate must be PASSED');
    assert(result.stages.photoHandoff.status === 'PASSED', 'Stage 3 Photo Handoff must be PASSED');
    assert(result.stages.listingPreparation.status === 'PASSED', 'Stage 4 Listing Preparation must be PASSED');
    assert(result.stages.draftReview.status === 'PASSED', 'Stage 5 Draft Review must be PASSED');
    assert(result.stages.publishGate.status === 'PASSED', 'Stage 6 Publish Gate must be PASSED');
    assert(result.stages.publishGate.reasonCode === 'READY_FOR_PUBLISH_ACTION', 'Publish gate reasonCode must be READY_FOR_PUBLISH_ACTION');
    assert(result.stages.photoHandoff.stageData?.heroPhoto?.angle === 'FRONT', 'Hero photo must be FRONT angle');
    assert(result.stages.photoHandoff.stageData?.galleryPhotos.length === 4, 'Must have 4 gallery photo candidates');
  });

  // Test 2: Incomplete angles / untaken photos
  test('Test 2: Untaken photo angles block inventory gate and draft handoff', () => {
    const opts = createMockPipelineScenario('UNTAKEN_PHOTOS');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.overallListingEligible === false, 'Overall listing eligibility must be false');
    assert(result.stages.photoCapture.status === 'HOLD', 'Stage 1 must be HOLD');
    assert(result.stages.photoCapture.reasonCode === 'HOLD_INSUFFICIENT_ANGLES', 'Stage 1 reason code must be HOLD_INSUFFICIENT_ANGLES');
    assert(result.stages.inventoryGate.status === 'HOLD', 'Stage 2 must be HOLD');
    assert(result.stages.inventoryGate.reasonCode === 'HOLD_INCOMPLETE_ANGLES', 'Stage 2 reason code must be HOLD_INCOMPLETE_ANGLES');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_INSUFFICIENT_ANGLES', 'Stage 3 reason code must be HOLD_INSUFFICIENT_ANGLES');
    assert(result.stages.listingPreparation.status === 'NOT_REACHED', 'Stage 4 must be NOT_REACHED');
  });

  // Test 3: QA Retake required
  test('Test 3: Quality error (RETAKE) blocks pipeline at photo and inventory gates', () => {
    const opts = createMockPipelineScenario('QA_RETAKE');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.photoCapture.status === 'HOLD', 'Stage 1 must be HOLD');
    assert(result.stages.photoCapture.reasonCode === 'HOLD_QA_RETAKE_REQUIRED', 'Stage 1 reason code must be HOLD_QA_RETAKE_REQUIRED');
    assert(result.stages.inventoryGate.status === 'HOLD', 'Stage 2 must be HOLD');
    assert(result.stages.inventoryGate.reasonCode === 'HOLD_QA_RETAKE_REQUIRED', 'Stage 2 reason code must be HOLD_QA_RETAKE_REQUIRED');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_QA_NOT_PASSED', 'Stage 3 reason code must be HOLD_QA_NOT_PASSED');
  });

  // Test 4: Auto-Fix pending
  test('Test 4: Unapplied AUTO_FIX holds pipeline until correction is completed', () => {
    const opts = createMockPipelineScenario('AUTO_FIX_PENDING');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.photoCapture.status === 'HOLD', 'Stage 1 must be HOLD');
    assert(result.stages.photoCapture.reasonCode === 'HOLD_AUTO_FIX_PENDING', 'Stage 1 reason code must be HOLD_AUTO_FIX_PENDING');
    assert(result.stages.inventoryGate.status === 'HOLD', 'Stage 2 must be HOLD');
    assert(result.stages.inventoryGate.reasonCode === 'HOLD_AUTO_FIX_PENDING', 'Stage 2 reason code must be HOLD_AUTO_FIX_PENDING');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_QA_NOT_PASSED', 'Stage 3 reason code must be HOLD_QA_NOT_PASSED');
  });

  // Test 5: Cross-product photo pollution
  test('Test 5: Cross-product SKU pollution in photo metadata is blocked at Bridge', () => {
    const opts = createMockPipelineScenario('CROSS_PRODUCT_POLLUTION');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_CROSS_PRODUCT_POLLUTION', 'Stage 3 reason code must be HOLD_CROSS_PRODUCT_POLLUTION');
    assert(result.stages.listingPreparation.status === 'NOT_REACHED', 'Stage 4 must be NOT_REACHED');
  });

  // Test 6: Stale session timestamp check
  test('Test 6: Stale photos taken prior to session start are rejected', () => {
    const opts = createMockPipelineScenario('STALE_SESSION');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_STALE_SESSION', 'Stage 3 reason code must be HOLD_STALE_SESSION');
  });

  // Test 7: Unit ID mismatch
  test('Test 7: Mismatch between context Unit ID and Inventory Unit blocks sync', () => {
    const opts = createMockPipelineScenario('UNIT_ID_MISMATCH');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.inventoryGate.status === 'HOLD', 'Stage 2 must be HOLD');
    assert(result.stages.inventoryGate.reasonCode === 'HOLD_UNIT_NOT_FOUND', 'Stage 2 reason code must be HOLD_UNIT_NOT_FOUND');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_SKU_UNIT_MISMATCH', 'Stage 3 reason code must be HOLD_SKU_UNIT_MISMATCH');
  });

  // Test 8: Duplicate registration collision
  test('Test 8: Duplicate registration prevents overwriting existing unit photos', () => {
    const opts = createMockPipelineScenario('DUPLICATE_REGISTRATION');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.inventoryGate.status === 'HOLD', 'Stage 2 must be HOLD');
    assert(result.stages.inventoryGate.reasonCode === 'HOLD_ALREADY_REGISTERED_CONFLICT', 'Stage 2 reason code must be HOLD_ALREADY_REGISTERED_CONFLICT');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_DUPLICATE_REGISTRATION', 'Stage 3 reason code must be HOLD_DUPLICATE_REGISTRATION');
  });

  // Test 9: Midway aborted session
  test('Test 9: Midway aborted session halts pipeline at Bridge handoff', () => {
    const opts = createMockPipelineScenario('MIDWAY_ABORTED');
    const result = executeListingPipelineSimulation(opts);

    assert(result.overallSuccess === false, 'Overall success must be false');
    assert(result.stages.photoHandoff.status === 'HOLD', 'Stage 3 must be HOLD');
    assert(result.stages.photoHandoff.reasonCode === 'HOLD_MIDWAY_CAPTURE_FAILURE', 'Stage 3 reason code must be HOLD_MIDWAY_CAPTURE_FAILURE');
  });

  // Test 10: Retrying and recovering from RETAKE
  test('Test 10: Retrying after RETAKE successfully resolves all gates', () => {
    // Run RETAKE first
    const failOpts = createMockPipelineScenario('QA_RETAKE');
    const failRes = executeListingPipelineSimulation(failOpts);
    assert(failRes.overallSuccess === false, 'Initial run with blur must fail');

    // Run RETRY_SUCCESS
    const retryOpts = createMockPipelineScenario('RETRY_SUCCESS');
    const retryRes = executeListingPipelineSimulation(retryOpts);
    assert(retryRes.overallSuccess === true, 'Retry with clear photos must succeed');
    assert(retryRes.stages.photoCapture.status === 'PASSED', 'Photo stage must pass');
    assert(retryRes.stages.publishGate.status === 'PASSED', 'Publish gate stage must pass');
  });

  // Test 11: Non-photo inventory gates incomplete
  test('Test 11: Incomplete non-photo gates maintain HOLD on overall listing eligibility', () => {
    const opts = createMockPipelineScenario('NON_PHOTO_GATE_INCOMPLETE');
    const result = executeListingPipelineSimulation(opts);

    assert(result.stages.photoCapture.status === 'PASSED', 'Photo stage passes');
    assert(result.stages.inventoryGate.status === 'PASSED', 'Photo gate on inventory passes');
    assert(result.stages.inventoryGate.stageData?.gateDiff?.nonPhotoGatesUntouched === true, 'Non-photo gates are untouched');
    assert(result.stages.photoHandoff.status === 'PASSED', 'Photo handoff passes');
    assert(result.stages.publishGate.status === 'HOLD', 'Publish gate must be HOLD due to non-photo gates');
    assert(result.stages.publishGate.reasonCode === 'HOLD_NON_PHOTO_GATES_INCOMPLETE', 'Reason code must indicate non-photo gates incomplete');
    assert(result.overallListingEligible === false, 'Overall listing eligibility must remain false');
    assert(result.overallSuccess === false, 'Overall success must remain false');
  });

  // Test 12: Draft review missing price
  test('Test 12: Missing price in draft halts pipeline at Draft Review stage', () => {
    const opts = createMockPipelineScenario('DRAFT_REVIEW_MISSING_PRICE');
    const result = executeListingPipelineSimulation(opts);

    assert(result.stages.draftReview.status === 'HOLD', 'Draft review must be HOLD');
    assert(result.stages.draftReview.reasonCode === 'HOLD_DRAFT_REVIEW_INCOMPLETE', 'Reason code must be HOLD_DRAFT_REVIEW_INCOMPLETE');
    assert(result.stages.publishGate.status === 'NOT_REACHED', 'Publish gate must be NOT_REACHED');
    assert(result.overallSuccess === false, 'Overall success must be false');
  });

  // Test 13: Publish gate missing approval
  test('Test 13: Missing publish approval holds pipeline at Listing Publish Gate', () => {
    const opts = createMockPipelineScenario('PUBLISH_GATE_MISSING_APPROVAL');
    const result = executeListingPipelineSimulation(opts);

    assert(result.stages.draftReview.status === 'PASSED', 'Draft review must be PASSED');
    assert(result.stages.publishGate.status === 'HOLD', 'Publish gate must be HOLD');
    assert(result.stages.publishGate.reasonCode === 'HOLD_PUBLISH_GATE_INCOMPLETE', 'Reason code must be HOLD_PUBLISH_GATE_INCOMPLETE');
    assert(result.overallListingEligible === false, 'Overall listing eligibility must be false');
  });

  // Test 14: Evidence preservation guarantee
  test('Test 14: Evidence raw images are strictly preserved and distinct from candidate images', () => {
    const opts = createMockPipelineScenario('SUCCESS_FULL_PASS');
    const result = executeListingPipelineSimulation(opts);
    const handoff = result.stages.photoHandoff.stageData!;

    assert(handoff.evidencePreserved === true, 'Evidence preserved flag must be true');
    handoff.galleryPhotos.forEach((photo) => {
      assert(Boolean(photo.originalDataUrl), `Photo ${photo.angle} must retain originalDataUrl evidence`);
      assert(Boolean(photo.selectedListingUrl), `Photo ${photo.angle} must have selectedListingUrl candidate`);
    });
  });

  // Test 15: Storage isolation guarantee
  test('Test 15: In-memory simulation does not mutate localStorage or persistent state', () => {
    const initialKeys = Object.keys(localStorage);
    const opts = createMockPipelineScenario('SUCCESS_FULL_PASS');
    executeListingPipelineSimulation(opts);
    const postKeys = Object.keys(localStorage);

    assert(initialKeys.length === postKeys.length, 'localStorage key count must be unchanged');
  });

  // Test 16: Hardware validation status tracking
  test('Test 16: Hardware validation status is explicitly tracked as HARDWARE_PENDING', () => {
    const opts = createMockPipelineScenario('SUCCESS_FULL_PASS');
    const result = executeListingPipelineSimulation(opts);

    assert(result.hardwareStatus === 'HARDWARE_PENDING', 'Hardware validation status must be HARDWARE_PENDING');
  });

  return { passed, failed, log };
}
