import {
  createPedalInputProfile,
  describeHardwareValidation,
  resolveKeyboardCaptureSignal
} from '../photoCaptureInputService';

export function runPhotoCaptureInputTests(): { passed: number; failed: number; log: string[] } {
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

  const defaultProfile = createPedalInputProfile();

  assert(
    defaultProfile.mode === 'KEYBOARD_EMULATION' &&
      defaultProfile.pedalKeyCode === 'F9' &&
      defaultProfile.hardwareValidation.status === 'NOT_RUN',
    'Test 1: Default pedal profile is keyboard-emulated and hardware validation starts NOT_RUN'
  );

  assert(
    resolveKeyboardCaptureSignal({ code: 'F9' }, defaultProfile) === 'PEDAL',
    'Test 2: Configured pedal key maps to PEDAL capture path'
  );

  assert(
    resolveKeyboardCaptureSignal({ code: 'Space' }, defaultProfile) === 'KEYBOARD',
    'Test 3: Space maps to normal keyboard capture path'
  );

  assert(
    resolveKeyboardCaptureSignal({ code: 'F9', repeat: true }, defaultProfile) === null,
    'Test 4: Key-repeat is ignored to prevent accidental burst captures'
  );

  assert(
    resolveKeyboardCaptureSignal({ code: 'Escape' }, defaultProfile) === null,
    'Test 5: Unrelated key does not trigger capture'
  );

  const customProfile = createPedalInputProfile('F10');
  assert(
    resolveKeyboardCaptureSignal({ code: 'F10' }, customProfile) === 'PEDAL' &&
      resolveKeyboardCaptureSignal({ code: 'F9' }, customProfile) === null,
    'Test 6: Pedal key binding is configurable without changing capture logic'
  );

  const validatedProfile = createPedalInputProfile('F9', {
    status: 'PASSED',
    validatedAt: '2026-10-01T00:00:00.000Z',
    deviceLabel: 'Future USB Foot Pedal'
  });
  assert(
    describeHardwareValidation(validatedProfile).startsWith('PASSED'),
    'Test 7: Future hardware validation can be attached without changing keyboard abstraction'
  );

  return { passed, failed, log };
}
