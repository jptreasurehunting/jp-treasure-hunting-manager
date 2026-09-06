import {
  CaptureTrigger,
  HardwareValidationRecord,
  PedalInputProfile
} from '../types/photoCapture';

export const DEFAULT_PEDAL_KEY_CODE = 'F9';
export const DEFAULT_FALLBACK_KEY_CODE = 'Space' as const;

export interface KeyboardCaptureSignal {
  code: string;
  repeat?: boolean;
}

export function createPedalInputProfile(
  pedalKeyCode: string = DEFAULT_PEDAL_KEY_CODE,
  hardwareValidation?: HardwareValidationRecord
): PedalInputProfile {
  return {
    mode: 'KEYBOARD_EMULATION',
    pedalKeyCode,
    fallbackKeyboardCode: DEFAULT_FALLBACK_KEY_CODE,
    hardwareValidation: hardwareValidation ?? {
      status: 'NOT_RUN',
      notes: 'Physical foot pedal has not been purchased or validated yet.'
    }
  };
}

/**
 * Maps keyboard-like input to the shared capture command.
 *
 * A USB/Bluetooth foot pedal that behaves as a keyboard requires no special
 * hardware API: when it emits the configured key code it is treated as PEDAL.
 * Until hardware is available, pressing that same key on a normal keyboard
 * exercises the identical software path.
 */
export function resolveKeyboardCaptureSignal(
  signal: KeyboardCaptureSignal,
  profile: PedalInputProfile
): CaptureTrigger | null {
  if (signal.repeat) return null;

  if (signal.code === profile.pedalKeyCode) {
    return 'PEDAL';
  }

  if (signal.code === profile.fallbackKeyboardCode) {
    return 'KEYBOARD';
  }

  return null;
}

export function describeHardwareValidation(profile: PedalInputProfile): string {
  const validation = profile.hardwareValidation;

  if (validation.status === 'PASSED') {
    return `PASSED${validation.deviceLabel ? ` - ${validation.deviceLabel}` : ''}`;
  }

  if (validation.status === 'FAILED') {
    return `FAILED${validation.notes ? ` - ${validation.notes}` : ''}`;
  }

  return 'NOT_RUN - 実機未購入。現在は同じキー入力を通常キーボードで検証します。';
}
