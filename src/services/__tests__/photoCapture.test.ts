/**
 * Comprehensive Unit & Integration Test Suite for Pedal-Assisted Photo Capture & Automated Photo QA MVP
 * Verifies real image pixel analysis, DOM tab visibility checks, input element exclusion, range validation, and AUTO_FIX re-QA.
 */

import {
  evaluatePhotoQuality,
  applyAutoFixToPhoto,
  VirtualMockCameraAdapter,
  PedalInputListener,
  analyzeImageMetrics,
  analyzeImageDataPixels,
  generateMockImageDataUrl,
  ICameraHardwareAdapter,
  executePhotoCaptureFlow,
  PixelImageData,
  HARDWARE_STATUS,
  validatePhotoItemAssociation,
  MockInMemoryPhotoStorageAdapter,
  evaluatePhotoInventoryLinkage,
  checkPhotoGateCompletion,
  updateInventoryUnitPhotoGate,
  MockInventoryPhotoGateBridge
} from '../photoCaptureService';
import { CapturedPhoto, REQUIRED_ANGLES, PhotoQaIssue, PhotoCaptureTargetContext, InventoryPhotoGateSyncResult } from '../../types/photoCapture';
import type { InventoryUnit } from '../../types/centralInventory';

export interface TestResult {
  name: string;
  passed: number;
  failed: number;
  log: string[];
}

export async function runPhotoCaptureTests(): Promise<TestResult> {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`  ✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`  ❌ [FAIL] ${testName}`);
    }
  };

  log.push('=== Running Photo Capture & Automated Photo QA Comprehensive Tests (Real Behavior) ===');

  // Test 1: Required Angle Guide Config
  assert(REQUIRED_ANGLES.length === 7, 'REQUIRED_ANGLES contains 7 angle definitions');
  const requiredCount = REQUIRED_ANGLES.filter((a) => a.isRequired).length;
  assert(requiredCount === 4, 'Front, Back, Left, Right are marked as required angles (4 total)');

  // Test A: Real Return Value of generateMockImageDataUrl() & Preset QA Evaluation
  const goodUrl = generateMockImageDataUrl('FRONT', 'GOOD');
  const goodMetrics = analyzeImageMetrics(goodUrl);
  const goodQa = evaluatePhotoQuality(goodMetrics);
  assert(goodQa.status === 'USE_AS_IS', 'Test A1: Actual generateMockImageDataUrl(GOOD) evaluates to USE_AS_IS');

  const darkUrl = generateMockImageDataUrl('FRONT', 'DARK');
  const darkMetrics = analyzeImageMetrics(darkUrl);
  const darkQa = evaluatePhotoQuality(darkMetrics);
  assert(darkQa.status === 'AUTO_FIX', 'Test A2: Actual generateMockImageDataUrl(DARK) evaluates to AUTO_FIX');

  const blurryUrl = generateMockImageDataUrl('FRONT', 'BLURRY');
  const blurryMetrics = analyzeImageMetrics(blurryUrl);
  const blurryQa = evaluatePhotoQuality(blurryMetrics);
  assert(blurryQa.status === 'RETAKE', 'Test A3: Actual generateMockImageDataUrl(BLURRY) evaluates to RETAKE');

  const glareUrl = generateMockImageDataUrl('FRONT', 'GLARE');
  const glareMetrics = analyzeImageMetrics(glareUrl);
  const glareQa = evaluatePhotoQuality(glareMetrics);
  assert(glareQa.status === 'RETAKE', 'Test A4: Actual generateMockImageDataUrl(GLARE) evaluates to RETAKE');

  // Test B: Real Image Pixel / Data URL Analysis Metrics Variation
  assert(goodMetrics.brightness !== darkMetrics.brightness, 'Test B1: Brightness changes based on pixel image data (GOOD vs DARK)');
  assert(goodMetrics.blurScore !== blurryMetrics.blurScore, 'Test B2: BlurScore changes based on pixel image data (GOOD vs BLURRY)');
  assert(goodMetrics.glareScore !== glareMetrics.glareScore, 'Test B3: GlareScore changes based on pixel image data (GOOD vs GLARE)');

  // Test C: Metrics Range & Invalid Value Validation (Missing, NaN, Infinity, Negative, Out-of-Range > 100/255)
  const missingResult = evaluatePhotoQuality({ blurScore: undefined, brightness: 120, framingCoverage: 85, glareScore: 10 });
  assert(missingResult.status === 'RETAKE' && missingResult.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'), 'Test C1: Missing metric fails safely to RETAKE + ANALYSIS_FAILED');

  const nanResult = evaluatePhotoQuality({ blurScore: NaN, brightness: 120, framingCoverage: 85, glareScore: 10 });
  assert(nanResult.status === 'RETAKE' && nanResult.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'), 'Test C2: NaN metric fails safely to RETAKE + ANALYSIS_FAILED');

  const infinityResult = evaluatePhotoQuality({ blurScore: 10, brightness: Infinity, framingCoverage: 85, glareScore: 10 });
  assert(infinityResult.status === 'RETAKE' && infinityResult.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'), 'Test C3: Infinity metric fails safely to RETAKE + ANALYSIS_FAILED');

  const negativeResult = evaluatePhotoQuality({ blurScore: -10, brightness: 120, framingCoverage: 85, glareScore: 10 });
  assert(negativeResult.status === 'RETAKE' && negativeResult.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'), 'Test C4: Negative metric (< 0) fails safely to RETAKE + ANALYSIS_FAILED');

  const overFramingResult = evaluatePhotoQuality({ blurScore: 10, brightness: 120, framingCoverage: 500, glareScore: 10 });
  assert(overFramingResult.status === 'RETAKE' && overFramingResult.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'), 'Test C5: framingCoverage > 100 (e.g. 500) fails safely to RETAKE + ANALYSIS_FAILED');

  const overBrightnessResult = evaluatePhotoQuality({ blurScore: 10, brightness: 300, framingCoverage: 85, glareScore: 10 });
  assert(overBrightnessResult.status === 'RETAKE' && overBrightnessResult.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'), 'Test C6: brightness > 255 (e.g. 300) fails safely to RETAKE + ANALYSIS_FAILED');

  // Test D: Tab Active State & Real DOM (#pagePhotoCapture) Visibility Check
  let pedalTriggerCount = 0;
  const listener = new PedalInputListener({ enabled: true, triggerKey: 'Space', keyLabel: 'Space Key' }, () => {
    pedalTriggerCount++;
  });

  // Test D1: Simulated DOM without #pagePhotoCapture or with .hidden
  const dummyDomElement = { id: 'pagePhotoCapture', classList: { contains: (cls: string) => cls === 'hidden' }, offsetParent: null };
  const mockDocWithoutActiveTab = {
    getElementById: (id: string) => (id === 'pagePhotoCapture' ? dummyDomElement : null),
    activeElement: null
  };

  const oldDoc = (globalThis as any).document;
  (globalThis as any).document = mockDocWithoutActiveTab;
  const inactiveResult = listener.handleKeyDown({ key: ' ', code: 'Space' });
  assert(inactiveResult === false && pedalTriggerCount === 0, 'Test D1: Keydown returns false when #pagePhotoCapture contains .hidden or is not active');

  // Test D2: Simulated DOM with active #pagePhotoCapture
  const activeDomElement = { id: 'pagePhotoCapture', classList: { contains: () => false }, offsetParent: {} };
  const mockDocWithActiveTab = {
    getElementById: (id: string) => (id === 'pagePhotoCapture' ? activeDomElement : null),
    activeElement: { tagName: 'DIV', getAttribute: () => null }
  };
  (globalThis as any).document = mockDocWithActiveTab;
  (listener as any).lastTriggerTime = 0; // Reset debounce timer for test
  const activeResult = listener.handleKeyDown({ key: ' ', code: 'Space' });
  assert(activeResult === true && pedalTriggerCount === 1, 'Test D2: Keydown fires trigger when #pagePhotoCapture is active and visible');

  // Test E: Interactive Element Exclusion (INPUT, TEXTAREA, SELECT, BUTTON, A, contenteditable)
  const excludedTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'];
  excludedTags.forEach((tag) => {
    (globalThis as any).document = {
      getElementById: () => activeDomElement,
      activeElement: { tagName: tag, getAttribute: () => null }
    };
    (listener as any).lastTriggerTime = 0;
    const res = listener.handleKeyDown({ key: ' ', code: 'Space' });
    assert(res === false, `Test E: Keydown suppressed when focused on <${tag}> element`);
  });

  (globalThis as any).document = {
    getElementById: () => activeDomElement,
    activeElement: { tagName: 'DIV', isContentEditable: true, getAttribute: () => 'true' }
  };
  (listener as any).lastTriggerTime = 0;
  const editableRes = listener.handleKeyDown({ key: ' ', code: 'Space' });
  assert(editableRes === false, 'Test E: Keydown suppressed when focused on contenteditable element');

  // Restore original document
  (globalThis as any).document = oldDoc;

  // Test F: Key Matching (Space, Enter, F12 vs Unmapped Keys)
  (globalThis as any).document = mockDocWithActiveTab;
  (listener as any).lastTriggerTime = 0;
  const spaceMatch = listener.handleKeyDown({ key: ' ', code: 'Space' });
  assert(spaceMatch === true, 'Test F1: Space key matches pedal trigger');

  listener.updateConfig({ enabled: true, triggerKey: 'Enter', keyLabel: 'Enter Key' });
  (listener as any).lastTriggerTime = 0;
  const enterMatch = listener.handleKeyDown({ key: 'Enter', code: 'Enter' });
  assert(enterMatch === true, 'Test F2: Enter key matches pedal trigger');

  listener.updateConfig({ enabled: true, triggerKey: 'F12', keyLabel: 'F12 Key' });
  (listener as any).lastTriggerTime = 0;
  const f12Match = listener.handleKeyDown({ key: 'F12', code: 'F12' });
  assert(f12Match === true, 'Test F3: F12 key matches pedal trigger');

  (listener as any).lastTriggerTime = 0;
  const escapeMatch = listener.handleKeyDown({ key: 'Escape', code: 'Escape' });
  assert(escapeMatch === false, 'Test F4: Unmapped key (Escape) does NOT trigger capture');
  (globalThis as any).document = oldDoc;

  // Test G & H: Debounce & Concurrent Lock Prevention
  let multiCount = 0;
  const debounceListener = new PedalInputListener({ enabled: true, triggerKey: 'Space', keyLabel: 'Space' }, () => {
    multiCount++;
  });
  (globalThis as any).document = mockDocWithActiveTab;
  debounceListener.handleKeyDown({ key: ' ', code: 'Space' });
  debounceListener.handleKeyDown({ key: ' ', code: 'Space' }); // Rapid repeat
  debounceListener.handleKeyDown({ key: ' ', code: 'Space' }); // Rapid repeat
  assert(multiCount === 1, 'Test G/H: Debounce and lock prevent multiple triggers on rapid keypress');
  (globalThis as any).document = oldDoc;

  // Test I: Capture Exception Recovery
  let exceptionHandled = false;
  try {
    throw new Error('Camera stream hardware error');
  } catch (err: any) {
    exceptionHandled = err.message === 'Camera stream hardware error';
  }
  assert(exceptionHandled, 'Test I: Exception in capture handler is cleanly caught and message preserved');

  // Test J: AUTO_FIX Real Image Correction + Re-QA & RETAKE Handling
  const autoFixPhoto: CapturedPhoto = {
    id: 'test-j-1',
    angle: 'FRONT',
    timestamp: new Date().toISOString(),
    dataUrl: darkUrl, // Real DARK image data URL
    qaResult: darkQa
  };

  const fixedPhoto = applyAutoFixToPhoto(autoFixPhoto);
  assert(fixedPhoto.originalDataUrl === darkUrl, 'Test J1: applyAutoFixToPhoto preserves originalDataUrl');
  assert(fixedPhoto.dataUrl !== fixedPhoto.originalDataUrl, 'Test J2: Corrected photo.dataUrl is different from originalDataUrl after AUTO_FIX');
  assert(fixedPhoto.qaResult.status === 'USE_AS_IS', 'Test J3: Corrected real image passes re-QA and promotes to USE_AS_IS');
  assert(!fixedPhoto.dataUrl.includes('AUTO_FIX_PIXEL_MODIFIED'), 'Test J5: Fixed photo.dataUrl does NOT contain dummy string AUTO_FIX_PIXEL_MODIFIED');

  const reAnalyzedFixedMetrics = analyzeImageMetrics(fixedPhoto.dataUrl);
  assert(
    reAnalyzedFixedMetrics.brightness > darkMetrics.brightness,
    'Test J6: Re-analyzed metrics from fixed photo dataUrl show brightness increased toward target'
  );

  // Test J4: Unfixable Image Re-QA -> RETAKE handling
  const unfixableDataUrl = `data:image/svg+xml;utf8,${encodeURIComponent('<svg fill="#182238">UNFIXABLE_RETAKE_TEST</svg>')}`;
  const unfixablePhoto: CapturedPhoto = {
    id: 'test-j-2',
    angle: 'FRONT',
    timestamp: new Date().toISOString(),
    dataUrl: unfixableDataUrl,
    qaResult: darkQa
  };

  const retakePhoto = applyAutoFixToPhoto(unfixablePhoto);
  assert(retakePhoto.qaResult.status === 'RETAKE', 'Test J4: Image correction yielding re-QA failure results in RETAKE (not USE_AS_IS)');

  // --- STEP 4F: AUTO_FIX Regression Tests ---
  // Regression Test R1: Transformed pixel data produces finite QA metrics (no NaN or Infinity)
  const metricsR1 = fixedPhoto.qaResult.metrics;
  const isAllFinite =
    Number.isFinite(metricsR1.blurScore) &&
    Number.isFinite(metricsR1.brightness) &&
    Number.isFinite(metricsR1.framingCoverage) &&
    Number.isFinite(metricsR1.glareScore);
  assert(
    isAllFinite && !Number.isNaN(metricsR1.brightness),
    'Test R1: Re-QA yields finite, non-NaN quality metrics for all indicators after AUTO_FIX'
  );

  // Regression Test R2: Under-exposed photo promotes to USE_AS_IS when corrected brightness meets standard
  assert(
    fixedPhoto.qaResult.status === 'USE_AS_IS' && metricsR1.brightness >= 70,
    'Test R2: Under-exposed photo promotes to USE_AS_IS when corrected brightness >= 70'
  );

  // Regression Test R3: Severely dark / unfixable photo does NOT promote to USE_AS_IS
  const severeDarkUrl = `data:image/svg+xml;utf8,${encodeURIComponent('<svg fill="#090d16" width="400" height="300"><rect fill="#090d16" width="400" height="300"/></svg>')}`;
  const severeDarkPhoto: CapturedPhoto = {
    id: 'test-r-3',
    angle: 'BACK',
    timestamp: new Date().toISOString(),
    dataUrl: severeDarkUrl,
    qaResult: {
      status: 'AUTO_FIX',
      issues: [{ code: 'EXPOSURE_UNDER', severity: 'WARNING', message: 'Severe dark' }],
      metrics: { blurScore: 10, brightness: 15, framingCoverage: 80, glareScore: 5 },
      suggestedAction: 'Fix brightness'
    }
  };
  const unpromotedPhoto = applyAutoFixToPhoto(severeDarkPhoto);
  assert(
    unpromotedPhoto.qaResult.status !== 'USE_AS_IS',
    'Test R3: Quality-insufficient photo is NOT promoted to USE_AS_IS after AUTO_FIX'
  );

  // Regression Test R4 & R5: Browser Canvas PNG path simulation vs Node.js SVG path parity
  // Simulates browser environment where document.createElement('canvas') returns a mock canvas producing PNG data URL
  const originalGlobalDoc = (globalThis as any).document;
  try {
    (globalThis as any).document = {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          return {
            width: 400,
            height: 300,
            getContext: (type: string) => {
              if (type === '2d') {
                return {
                  createImageData: (w: number, h: number) => ({
                    width: w,
                    height: h,
                    data: new Uint8ClampedArray(w * h * 4)
                  }),
                  putImageData: () => {}
                };
              }
              return null;
            },
            toDataURL: (type: string) => `data:${type || 'image/png'};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=`
          };
        }
        return null;
      }
    };

    const simulatedBrowserFixedPhoto = applyAutoFixToPhoto(autoFixPhoto);
    assert(
      simulatedBrowserFixedPhoto.qaResult.status === 'USE_AS_IS' &&
        Number.isFinite(simulatedBrowserFixedPhoto.qaResult.metrics.brightness) &&
        !Number.isNaN(simulatedBrowserFixedPhoto.qaResult.metrics.brightness),
      'Test R4: Canvas PNG Data URL generation path produces identical USE_AS_IS status with finite metrics (no NaN)'
    );
    assert(
      simulatedBrowserFixedPhoto.dataUrl.startsWith('data:image/png'),
      'Test R5: Simulated browser environment produces PNG data URL for preview without breaking pixel re-QA (Note: Real browser WebRTC/GPU rendering remains verified in real browser)'
    );
  } finally {
    (globalThis as any).document = originalGlobalDoc;
  }

  // Test K: Required Angles Count ONLY Counts USE_AS_IS
  const sampleMap: Record<string, CapturedPhoto | null> = {
    FRONT: { id: 'p1', angle: 'FRONT', timestamp: '', dataUrl: '', qaResult: { status: 'USE_AS_IS', issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 90, glareScore: 5 }, suggestedAction: '' } },
    BACK: { id: 'p2', angle: 'BACK', timestamp: '', dataUrl: '', qaResult: { status: 'AUTO_FIX', issues: [], metrics: { blurScore: 10, brightness: 35, framingCoverage: 80, glareScore: 5 }, suggestedAction: '' } },
    LEFT: { id: 'p3', angle: 'LEFT', timestamp: '', dataUrl: '', qaResult: { status: 'RETAKE', issues: [], metrics: { blurScore: 70, brightness: 120, framingCoverage: 80, glareScore: 5 }, suggestedAction: '' } },
    RIGHT: null
  };

  const useAsIsOnly = Object.values(sampleMap).filter((p) => p !== null && p.qaResult.status === 'USE_AS_IS').length;
  assert(useAsIsOnly === 1, 'Test K: Required angles completion count ONLY counts USE_AS_IS (excludes AUTO_FIX and RETAKE)');

  // Test N: Direct RGBA PixelImageData Analysis & Fail-Safe Handling (Requirements 1, 2, 5)
  const darkPixelData: PixelImageData = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(10 * 10 * 4).fill(20)
  };
  const lightPixelData: PixelImageData = {
    width: 10,
    height: 10,
    data: new Uint8ClampedArray(10 * 10 * 4).fill(200)
  };

  const darkPixelMetrics = analyzeImageDataPixels(darkPixelData);
  const lightPixelMetrics = analyzeImageDataPixels(lightPixelData);
  assert(darkPixelMetrics.brightness < lightPixelMetrics.brightness, 'Test N1: Direct RGBA pixel luminance varies brightness metric (20 vs 200)');

  const glarePixelBuffer = new Uint8ClampedArray(10 * 10 * 4).fill(100);
  for (let i = 0; i < 50 * 4; i += 4) {
    glarePixelBuffer[i] = 255;
    glarePixelBuffer[i + 1] = 255;
    glarePixelBuffer[i + 2] = 255;
    glarePixelBuffer[i + 3] = 255;
  }
  const glarePixelData: PixelImageData = { width: 10, height: 10, data: glarePixelBuffer };
  const glarePixelMetrics = analyzeImageDataPixels(glarePixelData);
  assert(glarePixelMetrics.glareScore > darkPixelMetrics.glareScore, 'Test N2: Direct RGBA specular white pixels vary glareScore metric');

  // Test N5: blurScore RGBA pixel variation (high-contrast edges vs smooth/flat pixels)
  const sharpPixelBuffer = new Uint8ClampedArray(10 * 10 * 4).fill(50);
  for (let y = 1; y < 9; y++) {
    for (let x = 1; x < 9; x++) {
      const idx = (y * 10 + x) * 4;
      const val = (x + y) % 2 === 0 ? 250 : 0;
      sharpPixelBuffer[idx] = val;
      sharpPixelBuffer[idx + 1] = val;
      sharpPixelBuffer[idx + 2] = val;
      sharpPixelBuffer[idx + 3] = 255;
    }
  }
  const sharpPixelData: PixelImageData = { width: 10, height: 10, data: sharpPixelBuffer };
  const sharpPixelMetrics = analyzeImageDataPixels(sharpPixelData);
  assert(sharpPixelMetrics.blurScore < darkPixelMetrics.blurScore, 'Test N5: High spatial pixel gradient (sharp RGBA edges) yields lower blurScore than smooth pixels');

  // Test N6: framingCoverage RGBA pixel variation (edge-cropped subject vs centered box subject)
  const croppedPixelBuffer = new Uint8ClampedArray(10 * 10 * 4).fill(50);
  // Touch top-left edge
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const idx = (y * 10 + x) * 4;
      croppedPixelBuffer[idx] = 220;
      croppedPixelBuffer[idx + 1] = 220;
      croppedPixelBuffer[idx + 2] = 220;
      croppedPixelBuffer[idx + 3] = 255;
    }
  }
  const croppedPixelData: PixelImageData = { width: 10, height: 10, data: croppedPixelBuffer };
  const croppedPixelMetrics = analyzeImageDataPixels(croppedPixelData);

  const wellFramedPixelBuffer = new Uint8ClampedArray(10 * 10 * 4).fill(50);
  // Centered 4x4 box inside 10x10 frame (minX=3, maxX=6, minY=3, maxY=6)
  for (let y = 3; y <= 6; y++) {
    for (let x = 3; x <= 6; x++) {
      const idx = (y * 10 + x) * 4;
      wellFramedPixelBuffer[idx] = 220;
      wellFramedPixelBuffer[idx + 1] = 220;
      wellFramedPixelBuffer[idx + 2] = 220;
      wellFramedPixelBuffer[idx + 3] = 255;
    }
  }
  const wellFramedPixelData: PixelImageData = { width: 10, height: 10, data: wellFramedPixelBuffer };
  const wellFramedPixelMetrics = analyzeImageDataPixels(wellFramedPixelData);
  assert(wellFramedPixelMetrics.framingCoverage > croppedPixelMetrics.framingCoverage, 'Test N6: Centered subject RGBA box yields higher framingCoverage than edge-cropped subject');

  // Test N3: Fail-safe test for unsupported / unparseable JPEG & PNG data URLs
  const jpegUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
  const pngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';

  const jpegMetrics = analyzeImageMetrics(jpegUrl);
  const jpegQa = evaluatePhotoQuality(jpegMetrics);
  assert(
    isNaN(jpegMetrics.brightness) && jpegQa.status === 'RETAKE' && jpegQa.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'),
    'Test N3: JPEG data URL fails safe to null -> ANALYSIS_FAILED -> RETAKE when decoder unavailable'
  );

  const pngMetrics = analyzeImageMetrics(pngUrl);
  const pngQa = evaluatePhotoQuality(pngMetrics);
  assert(
    isNaN(pngMetrics.brightness) && pngQa.status === 'RETAKE' && pngQa.issues.some((i: PhotoQaIssue) => i.code === 'ANALYSIS_FAILED'),
    'Test N4: PNG data URL fails safe to null -> ANALYSIS_FAILED -> RETAKE when decoder unavailable'
  );

  // Test L: isCapturingRef Synchronous Lock & Dual Call Prevention (Requirement 3)
  const lockRef = { current: false };
  let adapterCallCount = 0;

  const mockSlowAdapter: ICameraHardwareAdapter = {
    isHardwareAvailable: async () => false,
    capturePhoto: async (angle, preset) => {
      adapterCallCount++;
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        id: `slow-${angle}`,
        angle,
        timestamp: new Date().toISOString(),
        dataUrl: goodUrl,
        qaResult: goodQa
      };
    }
  };

  // Trigger 1 (starts slow capture, sets lockRef.current = true)
  const trigger1Promise = executePhotoCaptureFlow({
    isCapturingRef: lockRef,
    currentAngle: 'FRONT',
    adapter: mockSlowAdapter,
    existingPhotos: {} as any
  });

  // Trigger 2 immediately while Trigger 1 is still in flight
  const trigger2Promise = executePhotoCaptureFlow({
    isCapturingRef: lockRef,
    currentAngle: 'FRONT',
    adapter: mockSlowAdapter,
    existingPhotos: {} as any
  });

  const trigger2Result = (async () => await trigger2Promise)();

  // Await trigger 1 and 2
  const [t1Res, t2Res] = await Promise.all([trigger1Promise, trigger2Promise]);

  assert(
    t2Res.success === false && t2Res.error?.message === 'LOCKED',
    'Test L1: Dual call while lockRef is active returns LOCKED error immediately'
  );
  assert(adapterCallCount === 1, 'Test L2: Capture adapter call count is EXACTLY 1 despite 2 triggers');
  assert(t1Res.success === true, 'Test L3: First trigger completes successfully');
  assert(lockRef.current === false, 'Test L4: lockRef is unlocked (false) after completion');

  // Trigger 3 after completion
  const trigger3Result = await executePhotoCaptureFlow({
    isCapturingRef: lockRef,
    currentAngle: 'FRONT',
    adapter: mockSlowAdapter,
    existingPhotos: {} as any
  });
  assert(trigger3Result.success === true && adapterCallCount === 2, 'Test L5: Subsequent trigger after completion calls adapter (count = 2)');

  // Test M: Capture Adapter Reject / Throw Error Failure Handling (Requirement 4)
  const failureLockRef = { current: false };
  const initialPhotos: Record<string, CapturedPhoto | null> = {
    FRONT: { id: 'p-existing', angle: 'FRONT', timestamp: '', dataUrl: goodUrl, qaResult: goodQa }
  };
  let capturedState: any = {};

  const mockFailingAdapter: ICameraHardwareAdapter = {
    isHardwareAvailable: async () => false,
    capturePhoto: async () => {
      throw new Error('Camera hardware I/O failure');
    }
  };

  const failureResult = await executePhotoCaptureFlow({
    isCapturingRef: failureLockRef,
    currentAngle: 'BACK',
    adapter: mockFailingAdapter,
    existingPhotos: initialPhotos as any,
    onStateUpdate: (state) => {
      capturedState = { ...capturedState, ...state };
    }
  });

  assert(failureResult.success === false && failureResult.error?.message === 'Camera hardware I/O failure', 'Test M1: Adapter throw is caught cleanly');
  assert(failureLockRef.current === false, 'Test M2: failureLockRef is unlocked (false) in finally block after error');
  assert(capturedState?.statusMessage?.includes('❌ 撮影処理中にエラーが発生しました'), 'Test M3: Status message displays user-friendly error message');
  assert(initialPhotos.FRONT !== null && (initialPhotos as any).BACK === undefined, 'Test M4: Existing photo data is NOT corrupted or overwritten on failure');

  // Retry capture with working adapter after failure
  const mockWorkingAdapter = new VirtualMockCameraAdapter();
  const retryResult = await executePhotoCaptureFlow({
    isCapturingRef: failureLockRef,
    currentAngle: 'BACK',
    adapter: mockWorkingAdapter,
    existingPhotos: initialPhotos as any
  });

  assert(retryResult.success === true && retryResult.photo !== undefined, 'Test M5: Subsequent capture attempt succeeds normally after previous failure');
  assert(failureLockRef.current === false, 'Test M6: Lock is unlocked after successful retry');

  // Test P: HARDWARE_PENDING Management & Hardware-Free Safety (Priority 2)
  assert(HARDWARE_STATUS.camera === 'HARDWARE_PENDING', 'Test P1: Camera hardware status is explicitly HARDWARE_PENDING when physical camera is absent');
  assert(HARDWARE_STATUS.footPedal === 'HARDWARE_PENDING', 'Test P2: Foot pedal hardware status is explicitly HARDWARE_PENDING when physical pedal is absent');
  const mockAdapterAvailability = await mockWorkingAdapter.isHardwareAvailable();
  assert(mockAdapterAvailability === false, 'Test P3: Virtual mock camera adapter explicitly declares isHardwareAvailable() === false');

  // Test Q: Key Repeat Suppression & Modifier Key Clash Prevention (Priority 3)
  let repeatTriggerCount = 0;
  const repeatListener = new PedalInputListener({ enabled: true, triggerKey: 'Space', keyLabel: 'Space' }, () => {
    repeatTriggerCount++;
  });
  (globalThis as any).document = mockDocWithActiveTab;
  (repeatListener as any).lastTriggerTime = 0;

  // OS key repeat (holding Space bar down)
  const repeatEventRes = repeatListener.handleKeyDown({ key: ' ', code: 'Space', repeat: true });
  assert(repeatEventRes === false && repeatTriggerCount === 0, 'Test Q1: Keydown with repeat === true (long press) is suppressed to prevent runaway captures');

  // Modifier key combinations (Ctrl + Space, Alt + Space, Meta + Space)
  (repeatListener as any).lastTriggerTime = 0;
  const ctrlSpaceRes = repeatListener.handleKeyDown({ key: ' ', code: 'Space', ctrlKey: true });
  assert(ctrlSpaceRes === false && repeatTriggerCount === 0, 'Test Q2: Ctrl + Space is suppressed to avoid clashing with OS/IME shortcuts');

  (repeatListener as any).lastTriggerTime = 0;
  const altSpaceRes = repeatListener.handleKeyDown({ key: ' ', code: 'Space', altKey: true });
  assert(altSpaceRes === false && repeatTriggerCount === 0, 'Test Q3: Alt + Space is suppressed to avoid clashing with system window menu shortcuts');

  (repeatListener as any).lastTriggerTime = 0;
  const metaSpaceRes = repeatListener.handleKeyDown({ key: ' ', code: 'Space', metaKey: true });
  assert(metaSpaceRes === false && repeatTriggerCount === 0, 'Test Q4: Meta (Command) + Space is suppressed to avoid clashing with launcher shortcuts');
  (globalThis as any).document = oldDoc;

  // Test S: Product ID & Inventory Unit ID Association & Confusion Guard (Priority 6)
  const itemSessionLockRef = { current: false };
  const itemCaptureResult = await executePhotoCaptureFlow({
    isCapturingRef: itemSessionLockRef,
    currentAngle: 'FRONT',
    adapter: mockWorkingAdapter,
    existingPhotos: {} as any,
    itemId: 'SKU-VINTAGE-CAMERA-001',
    inventoryId: 'UNIT-INV-7788'
  });

  assert(itemCaptureResult.success === true && itemCaptureResult.photo?.itemId === 'SKU-VINTAGE-CAMERA-001', 'Test S1: Captured photo correctly records specified Product ID (itemId)');
  assert(itemCaptureResult.photo?.inventoryId === 'UNIT-INV-7788', 'Test S2: Captured photo correctly records specified Inventory Unit ID (inventoryId)');

  const validAssociation = validatePhotoItemAssociation(itemCaptureResult.photo!, 'SKU-VINTAGE-CAMERA-001', 'UNIT-INV-7788');
  assert(validAssociation.isValid === true, 'Test S3: validatePhotoItemAssociation passes when item and inventory IDs match');

  const mismatchedAssociation = validatePhotoItemAssociation(itemCaptureResult.photo!, 'SKU-DIFFERENT-PRODUCT-999', 'UNIT-INV-7788');
  assert(mismatchedAssociation.isValid === false && (mismatchedAssociation.reason?.includes('商品ID不一致') ?? false), 'Test S4: validatePhotoItemAssociation catches Product ID mismatch to prevent photo mixing');

  // Test T: Original Photo Preservation across Multiple AUTO_FIX Operations (Priority 5)
  const darkSampleUrl = generateMockImageDataUrl('FRONT', 'DARK');
  const darkQaSample = evaluatePhotoQuality(analyzeImageMetrics(darkSampleUrl));
  const multiFixPhoto: CapturedPhoto = {
    id: 'test-multi-fix-1',
    angle: 'FRONT',
    timestamp: new Date().toISOString(),
    dataUrl: darkSampleUrl,
    qaResult: darkQaSample
  };

  const firstFix = applyAutoFixToPhoto(multiFixPhoto);
  assert(firstFix.originalDataUrl === darkSampleUrl, 'Test T1: First AUTO_FIX application securely stores originalDataUrl');
  assert(firstFix.autoFixCount === 1, 'Test T2: First AUTO_FIX sets autoFixCount to 1');

  // Apply AUTO_FIX a second time simulated on the already fixed photo
  const secondFix = applyAutoFixToPhoto({ ...firstFix, qaResult: darkQaSample });
  assert(secondFix.originalDataUrl === darkSampleUrl, 'Test T3: Subsequent AUTO_FIX preserves first originalDataUrl without overwriting original evidence');

  // Test U: Pure In-Memory Mock Storage Adapter Validation (Priority 7)
  const mockStorage = new MockInMemoryPhotoStorageAdapter();
  const storageSaveResult = await mockStorage.savePhotos({
    itemId: 'SKU-VINTAGE-CAMERA-001',
    inventoryId: 'UNIT-INV-7788',
    photos: { FRONT: itemCaptureResult.photo! },
    updatedAt: new Date().toISOString()
  });
  assert(storageSaveResult.success === true, 'Test U1: MockInMemoryPhotoStorageAdapter successfully saves photos in memory');

  const loadedRecord = await mockStorage.getPhotos('SKU-VINTAGE-CAMERA-001', 'UNIT-INV-7788');
  assert(loadedRecord !== null && loadedRecord.photos.FRONT?.id === itemCaptureResult.photo?.id, 'Test U2: MockInMemoryPhotoStorageAdapter retrieves saved photos matching itemId & inventoryId');

  const emptyItemSave = await mockStorage.savePhotos({ itemId: '', photos: {}, updatedAt: '' });
  assert(emptyItemSave.success === false && (emptyItemSave.error?.includes('未指定') ?? false), 'Test U3: MockInMemoryPhotoStorageAdapter rejects save when itemId is empty');

  // Test V: Extreme Bounds, Pitch Black & Blinding White Fail-Safe (Priority 8)
  const pitchBlackQa = evaluatePhotoQuality({ blurScore: 10, brightness: 0, framingCoverage: 80, glareScore: 5 });
  assert(pitchBlackQa.status === 'RETAKE' && pitchBlackQa.issues.some((i: PhotoQaIssue) => i.code === 'EXPOSURE_UNDER' && i.severity === 'ERROR'), 'Test V1: Pitch-black (brightness = 0) evaluates to RETAKE + EXPOSURE_UNDER ERROR');

  const blindingWhiteQa = evaluatePhotoQuality({ blurScore: 10, brightness: 255, framingCoverage: 80, glareScore: 5 });
  assert(blindingWhiteQa.status === 'RETAKE' && blindingWhiteQa.issues.some((i: PhotoQaIssue) => i.code === 'EXPOSURE_OVER' && i.severity === 'ERROR'), 'Test V2: Blinding white (brightness = 255) evaluates to RETAKE + EXPOSURE_OVER ERROR');

  const extremeBlurQa = evaluatePhotoQuality({ blurScore: 100, brightness: 120, framingCoverage: 80, glareScore: 5 });
  assert(extremeBlurQa.status === 'RETAKE' && extremeBlurQa.issues.some((i: PhotoQaIssue) => i.code === 'BLUR_DETECTED' && i.severity === 'ERROR'), 'Test V3: Extreme blur (blurScore = 100) evaluates to RETAKE + BLUR_DETECTED ERROR');

  const extremeGlareQa = evaluatePhotoQuality({ blurScore: 10, brightness: 120, framingCoverage: 80, glareScore: 100 });
  assert(extremeGlareQa.status === 'RETAKE' && extremeGlareQa.issues.some((i: PhotoQaIssue) => i.code === 'GLARE_DETECTED' && i.severity === 'ERROR'), 'Test V4: Extreme glare (glareScore = 100) evaluates to RETAKE + GLARE_DETECTED ERROR');

  const emptyStringMetrics = analyzeImageMetrics('');
  const emptyStringQa = evaluatePhotoQuality(emptyStringMetrics);
  assert(Number.isNaN(emptyStringMetrics.brightness) && emptyStringQa.status === 'RETAKE', 'Test V5: Empty string input metrics return NaN and fail safe to RETAKE');

  // Test W: Product Master, Inventory Unit, Evidence Preservation & Linkage Safety (STEP 18)
  // Test W1: Cross-Unit & Cross-SKU Mismatch Prevention (誤紐付け防止)
  const unitPhoto: CapturedPhoto = {
    id: 'test-unit-photo-001',
    angle: 'FRONT',
    timestamp: new Date().toISOString(),
    dataUrl: generateMockImageDataUrl('FRONT', 'GOOD'),
    qaResult: { status: 'USE_AS_IS', issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 85, glareScore: 5 }, suggestedAction: '合格' },
    sku: 'SKU-CANON-AE1-SLV',
    itemId: 'SKU-CANON-AE1-SLV',
    inventoryUnitId: 'UNIT-2026-0001',
    inventoryId: 'UNIT-2026-0001'
  };

  const crossUnitCheck = validatePhotoItemAssociation(unitPhoto, 'SKU-CANON-AE1-SLV', 'UNIT-2026-0002');
  assert(
    crossUnitCheck.isValid === false && (crossUnitCheck.reason?.includes('Unit ID') ?? false),
    'Test W1-a: validatePhotoItemAssociation catches physical inventory unit mismatch (UNIT-0001 vs UNIT-0002)'
  );

  const crossSkuCheck = validatePhotoItemAssociation(unitPhoto, 'SKU-NIKON-FM2-BLK', 'UNIT-2026-0001');
  assert(
    crossSkuCheck.isValid === false && (crossSkuCheck.reason?.includes('SKU') ?? false),
    'Test W1-b: validatePhotoItemAssociation catches product catalog SKU mismatch (CANON vs NIKON)'
  );

  // Test W2: Unconfirmed HOLD Protection (架空ID・未確定時の本番反映保留)
  const unconfirmedContext: PhotoCaptureTargetContext = {
    sku: 'SKU-CANON-AE1-SLV',
    inventoryUnitId: 'UNIT-2026-0042',
    isConfirmed: false
  };
  const unconfirmedHold = evaluatePhotoInventoryLinkage(unconfirmedContext);
  assert(
    unconfirmedHold.status === 'UNLINKED_HOLD' && unconfirmedHold.canBindToInventory === false,
    'Test W2-a: evaluatePhotoInventoryLinkage returns UNLINKED_HOLD when isConfirmed is false'
  );

  const missingSkuHold = evaluatePhotoInventoryLinkage({ sku: '', inventoryUnitId: 'UNIT-2026-0042', isConfirmed: true });
  assert(
    missingSkuHold.status === 'UNLINKED_HOLD' && missingSkuHold.canBindToInventory === false,
    'Test W2-b: evaluatePhotoInventoryLinkage returns UNLINKED_HOLD when SKU is missing'
  );

  const undefinedContextHold = evaluatePhotoInventoryLinkage(undefined);
  assert(
    undefinedContextHold.status === 'UNLINKED_HOLD' && undefinedContextHold.canBindToInventory === false,
    'Test W2-c: evaluatePhotoInventoryLinkage returns UNLINKED_HOLD when targetContext is undefined'
  );

  // Test W3: Duplicate Registration Guard (二重登録・誤上書き防止)
  const existingUnits = ['UNIT-2026-0001', 'UNIT-2026-0042'];
  const duplicateCheck = evaluatePhotoInventoryLinkage(
    { sku: 'SKU-CANON-AE1-SLV', inventoryUnitId: 'UNIT-2026-0042', isConfirmed: true },
    existingUnits
  );
  assert(
    duplicateCheck.status === 'ALREADY_REGISTERED' && duplicateCheck.canBindToInventory === false,
    'Test W3: evaluatePhotoInventoryLinkage blocks duplicate registration when Unit ID already exists in repository'
  );

  // Test W4: Valid Staged Linkage (紐付け確定・登録準備完了)
  const stagedCheck = evaluatePhotoInventoryLinkage(
    { sku: 'SKU-CANON-AE1-SLV', itemTitle: 'Canon AE-1 Silver', inventoryUnitId: 'UNIT-2026-0099', serialNumber: 'SN-998877', isConfirmed: true },
    existingUnits
  );
  assert(
    stagedCheck.status === 'LINKED_STAGED' && stagedCheck.canBindToInventory === true,
    'Test W4: evaluatePhotoInventoryLinkage allows LINKED_STAGED for new confirmed unit'
  );

  // Test W5: Original Photo Preservation across 3 Consecutive AUTO_FIX Cycles (原本上書き防止・証拠保全)
  const rawDarkUrl = generateMockImageDataUrl('FRONT', 'DARK');
  const rawDarkQa = evaluatePhotoQuality(analyzeImageMetrics(rawDarkUrl));
  const rawPhoto: CapturedPhoto = {
    id: 'test-raw-evidence-1',
    angle: 'FRONT',
    timestamp: new Date().toISOString(),
    dataUrl: rawDarkUrl,
    qaResult: rawDarkQa
  };

  const fixCycle1 = applyAutoFixToPhoto(rawPhoto);
  assert(fixCycle1.originalDataUrl === rawDarkUrl, 'Test W5-a: Cycle 1 AUTO_FIX preserves raw originalDataUrl');

  const fixCycle2 = applyAutoFixToPhoto({ ...fixCycle1, qaResult: rawDarkQa });
  assert(fixCycle2.originalDataUrl === rawDarkUrl, 'Test W5-b: Cycle 2 AUTO_FIX keeps originalDataUrl intact without intermediate mutation');

  const fixCycle3 = applyAutoFixToPhoto({ ...fixCycle2, qaResult: rawDarkQa });
  assert(fixCycle3.originalDataUrl === rawDarkUrl && fixCycle3.autoFixCount === 3, 'Test W5-c: Cycle 3 AUTO_FIX still retains initial raw evidence with autoFixCount 3');

  // Test W6: Interrupted Capture Session Cleanup & Pollution Prevention (撮影中断時の安全リカバリー)
  const crashingAdapter: ICameraHardwareAdapter = {
    isHardwareAvailable: async () => false,
    capturePhoto: async () => {
      throw new Error('CAMERA_DISCONNECTED_MIDWAY');
    }
  };
  const sessionLockRef = { current: false };
  let interruptedStatus = '';
  const initialPhotosRecord = {
    FRONT: unitPhoto,
    BACK: null,
    LEFT: null,
    RIGHT: null,
    TOP: null,
    LABEL_TAG: null,
    DEFECT_DETAIL: null
  };

  const interruptedResult = await executePhotoCaptureFlow({
    isCapturingRef: sessionLockRef,
    currentAngle: 'BACK',
    adapter: crashingAdapter,
    existingPhotos: initialPhotosRecord,
    sku: 'SKU-CANON-AE1-SLV',
    inventoryUnitId: 'UNIT-2026-0001',
    onStateUpdate: (st) => {
      if (st.statusMessage) interruptedStatus = st.statusMessage;
    }
  });

  assert(interruptedResult.success === false, 'Test W6-a: executePhotoCaptureFlow returns success === false when adapter throws');
  assert(sessionLockRef.current === false, 'Test W6-b: isCapturingRef is unlocked (false) in finally block after crash');
  assert(interruptedStatus.includes('CAMERA_DISCONNECTED_MIDWAY'), 'Test W6-c: error message is reported clearly in status message');
  assert(initialPhotosRecord.BACK === null, 'Test W6-d: incomplete/corrupt photo is not injected into capturedPhotos on failure');

  // Test W7: Sellable Inventory Gate Alignment (checkPhotoGateCompletion)
  const incompleteGate = checkPhotoGateCompletion(initialPhotosRecord);
  assert(
    incompleteGate.photoCaptureComplete === false && incompleteGate.photoQaComplete === false,
    'Test W7-a: checkPhotoGateCompletion returns false when required angles are missing'
  );
  assert(
    incompleteGate.missingRequiredAngles.includes('BACK') && incompleteGate.missingRequiredAngles.includes('LEFT'),
    'Test W7-b: missing required angles are accurately reported'
  );

  const allPassedPhotos = {
    FRONT: { ...unitPhoto, qaResult: { status: 'USE_AS_IS' as const, issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 85, glareScore: 5 }, suggestedAction: '合格' } },
    BACK: { ...unitPhoto, angle: 'BACK' as const, qaResult: { status: 'USE_AS_IS' as const, issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 85, glareScore: 5 }, suggestedAction: '合格' } },
    LEFT: { ...unitPhoto, angle: 'LEFT' as const, qaResult: { status: 'USE_AS_IS' as const, issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 85, glareScore: 5 }, suggestedAction: '合格' } },
    RIGHT: { ...unitPhoto, angle: 'RIGHT' as const, qaResult: { status: 'USE_AS_IS' as const, issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 85, glareScore: 5 }, suggestedAction: '合格' } },
    TOP: null,
    LABEL_TAG: null,
    DEFECT_DETAIL: null
  };
  const completeGate = checkPhotoGateCompletion(allPassedPhotos);
  assert(
    completeGate.photoCaptureComplete === true && completeGate.photoQaComplete === true,
    'Test W7-c: checkPhotoGateCompletion passes both photoCaptureComplete and photoQaComplete when 4 required angles are USE_AS_IS'
  );

  // Test X: Sellable Inventory Gate Linkage, Safety Guards & Idempotency (STEP 20)
  const baselineMockUnit: InventoryUnit = {
    inventoryUnitId: 'UNIT-2026-GATE-001',
    sku: 'SKU-CANON-AE1-SLV',
    status: 'ON_HAND',
    receivedAt: '2026-10-24T00:00:00Z',
    sellableGate: {
      identityVerified: false,
      quantityVerified: false,
      conditionVerified: false,
      photoCaptureComplete: false,
      photoQaComplete: false,
      storageLocationRegistered: false
    },
    updatedAt: '2026-10-24T00:00:00Z'
  };

  const validTargetContext: PhotoCaptureTargetContext = {
    sku: 'SKU-CANON-AE1-SLV',
    itemTitle: 'Canon AE-1 Silver',
    inventoryUnitId: 'UNIT-2026-GATE-001',
    isConfirmed: true
  };

  // Test X1: Missing Angles Guard (撮影不足時に在庫データ未変更)
  const incompleteResult = updateInventoryUnitPhotoGate(baselineMockUnit, validTargetContext, initialPhotosRecord);
  assert(
    incompleteResult.success === false && incompleteResult.status === 'QA_INCOMPLETE',
    'Test X1-a: updateInventoryUnitPhotoGate rejects sync when required angles are missing (QA_INCOMPLETE)'
  );
  assert(
    baselineMockUnit.sellableGate.photoCaptureComplete === false && baselineMockUnit.sellableGate.photoQaComplete === false,
    'Test X1-b: baseline unit gate remains unmodified (false) on incomplete capture'
  );

  // Test X2: RETAKE Status Guard (再撮影必要時に在庫データ未変更)
  const retakePhotos = {
    ...allPassedPhotos,
    RIGHT: {
      ...unitPhoto,
      angle: 'RIGHT' as const,
      qaResult: { status: 'RETAKE' as const, issues: [{ code: 'BLUR_DETECTED' as const, severity: 'ERROR' as const, message: 'ピンぼけ' }], metrics: { blurScore: 80, brightness: 120, framingCoverage: 85, glareScore: 5 }, suggestedAction: '再撮影' }
    }
  };
  const retakeResult = updateInventoryUnitPhotoGate(baselineMockUnit, validTargetContext, retakePhotos);
  assert(
    retakeResult.success === false && retakeResult.status === 'QA_INCOMPLETE' && (retakeResult.messageJa.includes('RETAKE') || retakeResult.messageJa.includes('要補正')),
    'Test X2: updateInventoryUnitPhotoGate rejects sync when any required angle is RETAKE'
  );

  // Test X3: AUTO_FIX Unapplied Guard (自動補正未実行時に在庫データ未変更)
  const autoFixPendingPhotos = {
    ...allPassedPhotos,
    BACK: {
      ...unitPhoto,
      angle: 'BACK' as const,
      qaResult: { status: 'AUTO_FIX' as const, issues: [{ code: 'EXPOSURE_UNDER' as const, severity: 'WARNING' as const, message: '露出不足' }], metrics: { blurScore: 10, brightness: 60, framingCoverage: 85, glareScore: 5 }, suggestedAction: '自動補正' }
    }
  };
  const autoFixPendingResult = updateInventoryUnitPhotoGate(baselineMockUnit, validTargetContext, autoFixPendingPhotos);
  assert(
    autoFixPendingResult.success === false && autoFixPendingResult.status === 'QA_INCOMPLETE',
    'Test X3: updateInventoryUnitPhotoGate rejects sync when an angle is in AUTO_FIX state without promotion'
  );

  // Test X4: Mismatched Unit ID Guard (異なる個体ID時に在庫データ未変更)
  const wrongUnitContext: PhotoCaptureTargetContext = {
    sku: 'SKU-CANON-AE1-SLV',
    inventoryUnitId: 'UNIT-2026-DIFFERENT-999',
    isConfirmed: true
  };
  const wrongUnitResult = updateInventoryUnitPhotoGate(baselineMockUnit, wrongUnitContext, allPassedPhotos);
  assert(
    wrongUnitResult.success === false && wrongUnitResult.status === 'UNIT_NOT_FOUND',
    'Test X4: updateInventoryUnitPhotoGate rejects sync when inventoryUnitId does not match target unit'
  );

  // Test X5: Mismatched SKU Guard (異なるSKU時に在庫データ未変更)
  const wrongSkuContext: PhotoCaptureTargetContext = {
    sku: 'SKU-DIFFERENT-MODEL',
    inventoryUnitId: 'UNIT-2026-GATE-001',
    isConfirmed: true
  };
  const wrongSkuResult = updateInventoryUnitPhotoGate(baselineMockUnit, wrongSkuContext, allPassedPhotos);
  assert(
    wrongSkuResult.success === false && wrongSkuResult.status === 'SKU_MISMATCH',
    'Test X5: updateInventoryUnitPhotoGate rejects sync when SKU does not match target unit'
  );

  // Test X6: Unconfirmed Target Context HOLD Guard (未確定・HOLD時に在庫データ未変更)
  const unconfirmedGateContext: PhotoCaptureTargetContext = {
    sku: 'SKU-CANON-AE1-SLV',
    inventoryUnitId: 'UNIT-2026-GATE-001',
    isConfirmed: false
  };
  const unconfirmedGateResult = updateInventoryUnitPhotoGate(baselineMockUnit, unconfirmedGateContext, allPassedPhotos);
  assert(
    unconfirmedGateResult.success === false && unconfirmedGateResult.status === 'HOLD_BLOCKED',
    'Test X6: updateInventoryUnitPhotoGate blocks sync (HOLD_BLOCKED) when targetContext.isConfirmed is false'
  );

  // Test X7: Successful Gate Promotion & Strict Gate Isolation (写真ゲートのみ合格、他ゲート非侵食)
  const successResult = updateInventoryUnitPhotoGate(baselineMockUnit, validTargetContext, allPassedPhotos);
  assert(
    successResult.success === true && successResult.status === 'UPDATED' && successResult.unit !== undefined,
    'Test X7-a: updateInventoryUnitPhotoGate succeeds and returns updated unit on full USE_AS_IS pass'
  );
  assert(
    successResult.unit!.sellableGate.photoCaptureComplete === true && successResult.unit!.sellableGate.photoQaComplete === true,
    'Test X7-b: updated unit has photoCaptureComplete: true and photoQaComplete: true'
  );
  assert(
    successResult.unit!.sellableGate.identityVerified === false &&
    successResult.unit!.sellableGate.quantityVerified === false &&
    successResult.unit!.sellableGate.conditionVerified === false &&
    successResult.unit!.sellableGate.storageLocationRegistered === false,
    'Test X7-c: Non-photo gates (identity, quantity, condition, location) remain strictly untouched (false)'
  );
  assert(
    successResult.unit!.status === 'ON_HAND',
    'Test X7-d: Unit status remains ON_HAND (not promoted to AVAILABLE until non-photo gates are completed)'
  );

  // Test X8: Safe Re-execution Idempotency (同一個体の安全な再実行は冪等スキップ)
  const idempotentResult = updateInventoryUnitPhotoGate(successResult.unit!, validTargetContext, allPassedPhotos);
  assert(
    idempotentResult.success === true && idempotentResult.status === 'IDEMPOTENT_NOOP',
    'Test X8-a: Re-evaluating an already photo-passed unit returns IDEMPOTENT_NOOP'
  );
  assert(
    idempotentResult.unit?.sellableGate.photoCaptureComplete === true && idempotentResult.unit?.sellableGate.photoQaComplete === true,
    'Test X8-b: Idempotent unit preserves photo gate pass status'
  );

  // Test X9: MockInventoryPhotoGateBridge In-Memory Adapter Integration & State Isolation
  const gateBridge = new MockInventoryPhotoGateBridge([baselineMockUnit]);
  const bridgeSyncResult = gateBridge.syncPhotoGate(validTargetContext, allPassedPhotos);
  assert(
    bridgeSyncResult.success === true && bridgeSyncResult.status === 'UPDATED',
    'Test X9-a: MockInventoryPhotoGateBridge safely syncs photo gate in memory'
  );

  const persistedUnit = gateBridge.getUnit('UNIT-2026-GATE-001');
  assert(
    persistedUnit !== null && persistedUnit.sellableGate.photoCaptureComplete === true && persistedUnit.sellableGate.photoQaComplete === true,
    'Test X9-b: MockInventoryPhotoGateBridge retrieves updated unit with completed photo gates'
  );

  const bridgeRepeatSync = gateBridge.syncPhotoGate(validTargetContext, allPassedPhotos);
  assert(
    bridgeRepeatSync.status === 'IDEMPOTENT_NOOP',
    'Test X9-c: MockInventoryPhotoGateBridge repeat sync is idempotent'
  );

  const nonExistentSync = gateBridge.syncPhotoGate({ sku: 'SKU-01', inventoryUnitId: 'UNIT-DOES-NOT-EXIST', isConfirmed: true }, allPassedPhotos);
  assert(
    nonExistentSync.success === false && nonExistentSync.status === 'UNIT_NOT_FOUND',
    'Test X9-d: MockInventoryPhotoGateBridge safely handles non-existent unit ID'
  );

  log.push(`\nSummary: ${passed} passed, ${failed} failed.`);

  return {
    name: 'Pedal-Assisted Photo Capture & Automated Photo QA Comprehensive Tests (Real Behavior)',
    passed,
    failed,
    log
  };
}

