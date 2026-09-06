import {
  NormalizedRect,
  PhotoAutoFix,
  PhotoQaResult,
  PhotoQualityMetrics
} from '../types/photoCapture';

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const luminance = (r: number, g: number, b: number): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const colorDistance = (
  r: number,
  g: number,
  b: number,
  bgR: number,
  bgG: number,
  bgB: number
): number => {
  const dr = r - bgR;
  const dg = g - bgG;
  const db = b - bgB;
  return Math.sqrt(dr * dr + dg * dg + db * db) / 441.67295593;
};

const getPixelOffset = (x: number, y: number, width: number): number =>
  (y * width + x) * 4;

const calculateBorderBackground = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  stride: number
): { r: number; g: number; b: number; uniformity: number } => {
  const samples: Array<[number, number, number]> = [];

  for (let x = 0; x < width; x += stride) {
    for (const y of [0, height - 1]) {
      const i = getPixelOffset(x, y, width);
      samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  }

  for (let y = stride; y < height - stride; y += stride) {
    for (const x of [0, width - 1]) {
      const i = getPixelOffset(x, y, width);
      samples.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
    }
  }

  if (samples.length === 0) {
    return { r: 255, g: 255, b: 255, uniformity: 1 };
  }

  const mean = samples.reduce(
    (acc, [r, g, b]) => ({ r: acc.r + r, g: acc.g + g, b: acc.b + b }),
    { r: 0, g: 0, b: 0 }
  );
  mean.r /= samples.length;
  mean.g /= samples.length;
  mean.b /= samples.length;

  const variance = samples.reduce((sum, [r, g, b]) => {
    const distance = colorDistance(r, g, b, mean.r, mean.g, mean.b);
    return sum + distance * distance;
  }, 0) / samples.length;

  return {
    r: mean.r,
    g: mean.g,
    b: mean.b,
    uniformity: Math.sqrt(variance)
  };
};

const createCropForSubject = (bounds: NormalizedRect): NormalizedRect | undefined => {
  const padding = 0.08;
  const left = Math.max(0, bounds.x - padding);
  const top = Math.max(0, bounds.y - padding);
  const right = Math.min(1, bounds.x + bounds.width + padding);
  const bottom = Math.min(1, bounds.y + bounds.height + padding);

  const width = right - left;
  const height = bottom - top;

  // Only crop when it meaningfully removes empty background.
  if (width >= 0.94 && height >= 0.94) return undefined;

  return { x: left, y: top, width, height };
};

export function analyzePhotoPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): PhotoQualityMetrics {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return {
      width,
      height,
      subjectDetected: false,
      subjectAreaRatio: 0,
      minimumMargin: 0,
      centerOffsetX: 0,
      centerOffsetY: 0,
      meanLuminance: 0,
      contrast: 0,
      edgeStrength: 0,
      clippedDarkRatio: 1,
      clippedLightRatio: 0,
      backgroundUniformity: 1
    };
  }

  const pixelCount = width * height;
  const stride = Math.max(1, Math.floor(Math.sqrt(pixelCount / 120000)));
  const background = calculateBorderBackground(rgba, width, height, Math.max(1, stride * 2));
  const backgroundLum = luminance(background.r, background.g, background.b);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let foregroundCount = 0;
  let lumSum = 0;
  let lumSqSum = 0;
  let clippedDark = 0;
  let clippedLight = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  const foregroundThreshold = clamp(0.08 + background.uniformity * 1.8, 0.08, 0.22);

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = getPixelOffset(x, y, width);
      const r = rgba[i];
      const g = rgba[i + 1];
      const b = rgba[i + 2];
      const lum = luminance(r, g, b);
      const distance = colorDistance(r, g, b, background.r, background.g, background.b);
      const isForeground = distance > foregroundThreshold || Math.abs(lum - backgroundLum) > foregroundThreshold;

      if (!isForeground) continue;

      foregroundCount++;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      lumSum += lum;
      lumSqSum += lum * lum;
      if (lum < 0.025) clippedDark++;
      if (lum > 0.975) clippedLight++;

      if (x + stride < width) {
        const j = getPixelOffset(x + stride, y, width);
        const neighborLum = luminance(rgba[j], rgba[j + 1], rgba[j + 2]);
        edgeSum += Math.abs(lum - neighborLum);
        edgeCount++;
      }
      if (y + stride < height) {
        const j = getPixelOffset(x, y + stride, width);
        const neighborLum = luminance(rgba[j], rgba[j + 1], rgba[j + 2]);
        edgeSum += Math.abs(lum - neighborLum);
        edgeCount++;
      }
    }
  }

  const sampledWidth = Math.ceil(width / stride);
  const sampledHeight = Math.ceil(height / stride);
  const sampledCount = sampledWidth * sampledHeight;
  const foregroundRatio = sampledCount > 0 ? foregroundCount / sampledCount : 0;
  const subjectDetected = foregroundCount >= 24 && foregroundRatio >= 0.01;

  if (!subjectDetected) {
    return {
      width,
      height,
      subjectDetected: false,
      subjectAreaRatio: 0,
      minimumMargin: 0,
      centerOffsetX: 0,
      centerOffsetY: 0,
      meanLuminance: backgroundLum,
      contrast: 0,
      edgeStrength: 0,
      clippedDarkRatio: backgroundLum < 0.025 ? 1 : 0,
      clippedLightRatio: backgroundLum > 0.975 ? 1 : 0,
      backgroundUniformity: background.uniformity
    };
  }

  const normalizedBounds: NormalizedRect = {
    x: minX / width,
    y: minY / height,
    width: (maxX - minX + stride) / width,
    height: (maxY - minY + stride) / height
  };
  normalizedBounds.width = clamp(normalizedBounds.width, 0, 1 - normalizedBounds.x);
  normalizedBounds.height = clamp(normalizedBounds.height, 0, 1 - normalizedBounds.y);

  const margins = {
    left: normalizedBounds.x,
    top: normalizedBounds.y,
    right: 1 - normalizedBounds.x - normalizedBounds.width,
    bottom: 1 - normalizedBounds.y - normalizedBounds.height
  };
  const minimumMargin = Math.max(0, Math.min(margins.left, margins.top, margins.right, margins.bottom));
  const centerX = normalizedBounds.x + normalizedBounds.width / 2;
  const centerY = normalizedBounds.y + normalizedBounds.height / 2;
  const meanLuminance = lumSum / foregroundCount;
  const variance = Math.max(0, lumSqSum / foregroundCount - meanLuminance * meanLuminance);

  return {
    width,
    height,
    subjectDetected: true,
    subjectBounds: normalizedBounds,
    subjectAreaRatio: normalizedBounds.width * normalizedBounds.height,
    minimumMargin,
    centerOffsetX: Math.abs(centerX - 0.5),
    centerOffsetY: Math.abs(centerY - 0.5),
    meanLuminance,
    contrast: Math.sqrt(variance),
    edgeStrength: edgeCount > 0 ? edgeSum / edgeCount : 0,
    clippedDarkRatio: clippedDark / foregroundCount,
    clippedLightRatio: clippedLight / foregroundCount,
    backgroundUniformity: background.uniformity
  };
}

export function evaluatePhotoQuality(metrics: PhotoQualityMetrics): PhotoQaResult {
  const retakeReasons: string[] = [];
  const safeFixReasons: string[] = [];
  const autoFix: PhotoAutoFix = {
    brightnessPercent: 100,
    contrastPercent: 100
  };

  if (metrics.width < 640 || metrics.height < 480) {
    retakeReasons.push('解像度が不足しています（最低 640×480 を推奨）。');
  }
  if (!metrics.subjectDetected || !metrics.subjectBounds) {
    retakeReasons.push('商品全体を安定して検出できません。商品を背景から分離して再撮影してください。');
  }

  if (metrics.subjectDetected && metrics.subjectBounds) {
    if (metrics.minimumMargin < 0.025) {
      retakeReasons.push('商品がフレーム端に近すぎます。欠けを避けるため余白を確保して再撮影してください。');
    }

    if (metrics.meanLuminance < 0.08 || metrics.meanLuminance > 0.92) {
      retakeReasons.push('露出が極端で、商品情報が失われている可能性があります。');
    }

    if (metrics.clippedDarkRatio > 0.3 || metrics.clippedLightRatio > 0.3) {
      retakeReasons.push('黒つぶれ・白飛びが多く、自動補正では安全に復元できません。');
    }

    if (metrics.edgeStrength < 0.012 && metrics.contrast < 0.065) {
      retakeReasons.push('ピントまたは手ブレの可能性が高く、細部の視認性が不足しています。');
    }

    if (metrics.backgroundUniformity > 0.18) {
      retakeReasons.push('背景の変化が大きく、商品判定が不安定です。背景を整えて再撮影してください。');
    }
  }

  if (retakeReasons.length > 0) {
    return {
      decision: 'RETAKE',
      reasons: retakeReasons,
      metrics
    };
  }

  if (metrics.subjectBounds) {
    if (
      metrics.centerOffsetX > 0.08 ||
      metrics.centerOffsetY > 0.08 ||
      metrics.subjectAreaRatio < 0.42
    ) {
      const crop = createCropForSubject(metrics.subjectBounds);
      if (crop) {
        autoFix.crop = crop;
        safeFixReasons.push('余白と位置ずれを安全なトリミングで補正します。');
      }
    }
  }

  if (metrics.meanLuminance >= 0.08 && metrics.meanLuminance < 0.3) {
    autoFix.brightnessPercent = 115;
    safeFixReasons.push('軽い暗さを明るさ補正します。');
  } else if (metrics.meanLuminance > 0.76 && metrics.meanLuminance <= 0.92) {
    autoFix.brightnessPercent = 90;
    safeFixReasons.push('軽い明るすぎを明るさ補正します。');
  }

  if (metrics.contrast < 0.09) {
    autoFix.contrastPercent = 112;
    safeFixReasons.push('軽い低コントラストを補正します。');
  }

  if (safeFixReasons.length > 0) {
    return {
      decision: 'AUTO_FIX',
      reasons: safeFixReasons,
      metrics,
      autoFix
    };
  }

  return {
    decision: 'USE_AS_IS',
    reasons: ['商品がフレーム内に収まり、ピント・露出・背景の基本条件を満たしています。'],
    metrics
  };
}

export function assessPhotoPixels(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): PhotoQaResult {
  return evaluatePhotoQuality(analyzePhotoPixels(rgba, width, height));
}

export function createPerceptualHash(
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): string {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) return '';

  const grid = 8;
  const values: number[] = [];
  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      const x = Math.min(width - 1, Math.floor(((gx + 0.5) / grid) * width));
      const y = Math.min(height - 1, Math.floor(((gy + 0.5) / grid) * height));
      const i = getPixelOffset(x, y, width);
      values.push(luminance(rgba[i], rgba[i + 1], rgba[i + 2]));
    }
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return values.map((value) => (value >= mean ? '1' : '0')).join('');
}

export function isLikelyDuplicate(hash: string, previousHashes: string[]): boolean {
  if (!hash || hash.length !== 64) return false;
  return previousHashes.some((previous) => {
    if (previous.length !== hash.length) return false;
    let different = 0;
    for (let i = 0; i < hash.length; i++) {
      if (hash[i] !== previous[i]) different++;
    }
    return different <= 4;
  });
}
