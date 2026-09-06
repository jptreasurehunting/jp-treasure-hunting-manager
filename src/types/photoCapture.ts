export type CaptureTrigger = 'PEDAL' | 'KEYBOARD' | 'BUTTON';

export type PhotoQaDecision = 'USE_AS_IS' | 'AUTO_FIX' | 'RETAKE';

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
  originalDataUrl: string;
  finalDataUrl: string;
  qa: PhotoQaResult;
  perceptualHash: string;
}
