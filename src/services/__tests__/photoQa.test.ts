import {
  assessPhotoPixels,
  createPerceptualHash,
  isLikelyDuplicate
} from '../photoQaService';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function makePhoto(
  width: number,
  height: number,
  rect: Rect | null,
  options: {
    background?: [number, number, number];
    foregroundA?: [number, number, number];
    foregroundB?: [number, number, number];
  } = {}
): Uint8ClampedArray {
  const background = options.background ?? [245, 245, 245];
  const foregroundA = options.foregroundA ?? [45, 65, 85];
  const foregroundB = options.foregroundB ?? [180, 120, 60];
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      let rgb = background;
      if (
        rect &&
        x >= rect.x &&
        y >= rect.y &&
        x < rect.x + rect.width &&
        y < rect.y + rect.height
      ) {
        // Checkerboard detail gives the synthetic subject enough real edges for focus tests.
        rgb = ((Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0)
          ? foregroundA
          : foregroundB;
      }
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }

  return data;
}

export function runPhotoQaTests(): { passed: number; failed: number; log: string[] } {
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

  const width = 800;
  const height = 600;

  // Test 1: centered, detailed, correctly exposed subject is accepted as-is.
  const centered = makePhoto(width, height, { x: 140, y: 90, width: 520, height: 420 });
  const centeredResult = assessPhotoPixels(centered, width, height);
  assert(
    centeredResult.decision === 'USE_AS_IS',
    'Test 1: Centered in-frame detailed product returns USE_AS_IS'
  );

  // Test 2: safe off-center composition is cropped/recentered rather than forcing a retake.
  const offCenter = makePhoto(width, height, { x: 70, y: 130, width: 360, height: 320 });
  const offCenterResult = assessPhotoPixels(offCenter, width, height);
  assert(
    Boolean(offCenterResult.decision === 'AUTO_FIX' && offCenterResult.autoFix?.crop),
    'Test 2: Recoverable position/whitespace issue returns AUTO_FIX with safe crop'
  );

  // Test 3: subject touching the frame edge is never synthesized or cropped into acceptance.
  const clipped = makePhoto(width, height, { x: 0, y: 100, width: 460, height: 380 });
  const clippedResult = assessPhotoPixels(clipped, width, height);
  assert(
    clippedResult.decision === 'RETAKE' && clippedResult.reasons.some((reason) => reason.includes('フレーム端')),
    'Test 3: Product at frame edge returns RETAKE instead of generative repair'
  );

  // Test 4: empty/near-uniform frame cannot be treated as a product photo.
  const empty = makePhoto(width, height, null);
  const emptyResult = assessPhotoPixels(empty, width, height);
  assert(
    emptyResult.decision === 'RETAKE' && !emptyResult.metrics.subjectDetected,
    'Test 4: Empty uniform frame returns RETAKE with subject not detected'
  );

  // Test 5: extreme foreground darkness is treated as lost information.
  const tooDark = makePhoto(
    width,
    height,
    { x: 180, y: 120, width: 440, height: 360 },
    { foregroundA: [2, 2, 2], foregroundB: [12, 12, 12] }
  );
  const tooDarkResult = assessPhotoPixels(tooDark, width, height);
  assert(
    tooDarkResult.decision === 'RETAKE',
    'Test 5: Extreme underexposure returns RETAKE'
  );

  // Test 6: mild darkness remains recoverable using non-generative brightness correction.
  const mildlyDark = makePhoto(
    width,
    height,
    { x: 180, y: 120, width: 440, height: 360 },
    { foregroundA: [35, 35, 35], foregroundB: [85, 85, 85] }
  );
  const mildlyDarkResult = assessPhotoPixels(mildlyDark, width, height);
  assert(
    Boolean(
      mildlyDarkResult.decision === 'AUTO_FIX' &&
      mildlyDarkResult.autoFix &&
      mildlyDarkResult.autoFix.brightnessPercent > 100
    ),
    'Test 6: Mild underexposure returns AUTO_FIX with brightness-only correction'
  );

  // Test 7: perceptual hash identifies the same accepted view as a likely duplicate.
  const hashA = createPerceptualHash(centered, width, height);
  const hashB = createPerceptualHash(centered, width, height);
  assert(
    hashA.length === 64 && isLikelyDuplicate(hashB, [hashA]),
    'Test 7: Identical view is detected as a likely duplicate'
  );

  // Test 8: a materially different composition is not automatically labelled duplicate.
  const different = makePhoto(width, height, { x: 350, y: 100, width: 300, height: 400 });
  const differentHash = createPerceptualHash(different, width, height);
  assert(
    !isLikelyDuplicate(differentHash, [hashA]),
    'Test 8: Materially different composition is not treated as duplicate'
  );

  return { passed, failed, log };
}
