export type CaptureTrigger = 'PEDAL' | 'KEYBOARD' | 'BUTTON';

export type PhotoSource = 'CAMERA' | 'TEST_IMAGE';

export type PhotoQaDecision = 'USE_AS_IS' | 'AUTO_FIX' | 'RETAKE';

export type HardwareValidationStatus = 'NOT_RUN' | 'PASSED' | 'FAILED';

export interface HardwareValidationRecord {
  status: HardwareValidationStatus;
  validatedAt?: string;
  deviceLabel?: string;
  notes?: string;
}

export interface PedalInputProfile {
  mode: 'KEYBOARD_EMULATION';
  pedalKeyCode: string;
  fallbackKeyboardCode: 'Space';
  hardwareValidation: HardwareValidationRecord;
}

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PhotoQualityMetrics {
  width: number;
  height: number;
  subjectDetected: boolean;
  subjectBounds?: NormalizedRect;
  subjectAreaRatio: number;
  minimumMargin: number;
  centerOffsetX: number;
  centerOffsetY: number;
  meanLuminance: number;
  contrast: number;
  edgeStrength: number;
  clippedDarkRatio: number;
  clippedLightRatio: number;
  backgroundUniformity: number;
}

export interface PhotoAutoFix {
  brightnessPercent: number;
  contrastPercent: number;
  crop?: NormalizedRect;
}

export interface PhotoQaResult {
  decision: PhotoQaDecision;
  reasons: string[];
  metrics: PhotoQualityMetrics;
  autoFix?: PhotoAutoFix;
}

export interface CapturedPhoto {
  id: string;
  angleNumber: number;
  capturedAt: string;
  trigger: CaptureTrigger;
  source: PhotoSource;
  originalDataUrl: string;
  finalDataUrl: string;
  qa: PhotoQaResult;
  perceptualHash: string;
}
