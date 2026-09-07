import { runPhotoCaptureSoftwareSelfTest } from '../photoCaptureSelfTestService';

export function runPhotoCaptureSelfTestTests(): { passed: number; failed: number; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`❌ [FAIL] ${testName}`);
    }
  };

  const result = runPhotoCaptureSoftwareSelfTest();

  assert(
    result.overallStatus === 'PASS' && result.failed === 0,
    'Test 1: Software-only Photo Capture self-test passes all checks'
  );

  assert(
    result.checks.length === 8 && result.passed === 8,
    'Test 2: Self-test executes the full 8-check software validation matrix'
  );

  assert(
    result.hardwareValidationStatus === 'NOT_RUN',
    'Test 3: Software self-test never falsely marks physical hardware as validated'
  );

  assert(
    result.hardwareRequiredForSoftwareResult === false,
    'Test 4: Camera and pedal hardware are not required for software validation result'
  );

  const customPedalResult = runPhotoCaptureSoftwareSelfTest('F10');
  assert(
    customPedalResult.overallStatus === 'PASS' &&
      customPedalResult.checks.find((check) => check.id === 'PEDAL_KEY_PATH')?.status === 'PASS',
    'Test 5: Self-test supports a configurable keyboard-emulated pedal key'
  );

  return { passed, failed, log };
}
