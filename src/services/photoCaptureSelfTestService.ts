import {
  assessPhotoPixels,
  createPerceptualHash,
  isLikelyDuplicate
} from './photoQaService';
import {
  createPedalInputProfile,
  resolveKeyboardCaptureSignal
} from './photoCaptureInputService';
import { HardwareValidationStatus } from '../types/photoCapture';

export type SoftwareSelfTestStatus = 'PASS' | 'FAIL';

export interface PhotoCaptureSoftwareSelfTestCheck {
  id: string;
  labelJa: string;
  status: SoftwareSelfTestStatus;
  details: string;
}

export interface PhotoCaptureSoftwareSelfTestSummary {
  overallStatus: SoftwareSelfTestStatus;
  passed: number;
  failed: number;
  checks: PhotoCaptureSoftwareSelfTestCheck[];
  hardwareValidationStatus: HardwareValidationStatus;
  hardwareRequiredForSoftwareResult: false;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function makeSyntheticPhoto(
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

function createCheck(
  id: string,
  labelJa: string,
  condition: boolean,
  passDetails: string,
  failDetails: string
): PhotoCaptureSoftwareSelfTestCheck {
  return {
    id,
    labelJa,
    status: condition ? 'PASS' : 'FAIL',
    details: condition ? passDetails : failDetails
  };
}

/**
 * Runs a deterministic software-only validation of the Photo Capture MVP.
 *
 * No camera or foot pedal is required. The checks intentionally exercise the
 * same keyboard-emulation mapping and Photo QA functions used by the real UI.
 * Hardware Validation remains separate and is not inferred from these results.
 */
export function runPhotoCaptureSoftwareSelfTest(
  pedalKeyCode: string = 'F9'
): PhotoCaptureSoftwareSelfTestSummary {
  const profile = createPedalInputProfile(pedalKeyCode);
  const width = 800;
  const height = 600;

  const centered = makeSyntheticPhoto(width, height, {
    x: 140,
    y: 90,
    width: 520,
    height: 420
  });
  const offCenter = makeSyntheticPhoto(width, height, {
    x: 70,
    y: 130,
    width: 360,
    height: 320
  });
  const frameEdge = makeSyntheticPhoto(width, height, {
    x: 0,
    y: 100,
    width: 460,
    height: 380
  });
  const empty = makeSyntheticPhoto(width, height, null);

  const centeredResult = assessPhotoPixels(centered, width, height);
  const offCenterResult = assessPhotoPixels(offCenter, width, height);
  const frameEdgeResult = assessPhotoPixels(frameEdge, width, height);
  const emptyResult = assessPhotoPixels(empty, width, height);
  const centeredHash = createPerceptualHash(centered, width, height);

  const checks: PhotoCaptureSoftwareSelfTestCheck[] = [
    createCheck(
      'PEDAL_KEY_PATH',
      'ペダル互換キー入力',
      resolveKeyboardCaptureSignal({ code: pedalKeyCode }, profile) === 'PEDAL',
      `${pedalKeyCode} がPEDAL撮影経路へ正しく変換されました。`,
      `${pedalKeyCode} をPEDAL撮影経路へ変換できませんでした。`
    ),
    createCheck(
      'KEYBOARD_FALLBACK_PATH',
      '通常キーボード入力',
      resolveKeyboardCaptureSignal({ code: 'Space' }, profile) === 'KEYBOARD',
      'Spaceキーが通常キーボード撮影経路へ正しく変換されました。',
      'Spaceキーを通常キーボード撮影経路へ変換できませんでした。'
    ),
    createCheck(
      'KEY_REPEAT_GUARD',
      '長押し連写防止',
      resolveKeyboardCaptureSignal({ code: pedalKeyCode, repeat: true }, profile) === null,
      'キー長押しによるrepeat入力を無視しました。',
      'キー長押しによるrepeat入力が誤って撮影扱いになりました。'
    ),
    createCheck(
      'QA_USE_AS_IS',
      '正常写真の品質判定',
      centeredResult.decision === 'USE_AS_IS',
      '中央配置・十分な余白のテスト画像をUSE_AS_ISと判定しました。',
      `正常テスト画像が${centeredResult.decision}になりました。`
    ),
    createCheck(
      'QA_AUTO_FIX',
      '安全な自動補正判定',
      offCenterResult.decision === 'AUTO_FIX' && Boolean(offCenterResult.autoFix?.crop),
      '軽い位置ずれをAUTO_FIXとして安全なトリミング候補にしました。',
      `軽い位置ずれの判定が${offCenterResult.decision}になりました。`
    ),
    createCheck(
      'QA_RETAKE_EDGE',
      'フレーム端の再撮影判定',
      frameEdgeResult.decision === 'RETAKE',
      '商品がフレーム端にある場合をRETAKEと判定しました。',
      `フレーム端の画像が${frameEdgeResult.decision}になりました。`
    ),
    createCheck(
      'QA_RETAKE_EMPTY',
      '商品未検出の再撮影判定',
      emptyResult.decision === 'RETAKE' && !emptyResult.metrics.subjectDetected,
      '商品が検出できない画像をRETAKEと判定しました。',
      '商品未検出画像の安全な停止判定に失敗しました。'
    ),
    createCheck(
      'DUPLICATE_DETECTION',
      '重複写真検出',
      centeredHash.length === 64 && isLikelyDuplicate(centeredHash, [centeredHash]),
      '同一画像の重複を検出しました。',
      '同一画像の重複を検出できませんでした。'
    )
  ];

  const passed = checks.filter((check) => check.status === 'PASS').length;
  const failed = checks.length - passed;

  return {
    overallStatus: failed === 0 ? 'PASS' : 'FAIL',
    passed,
    failed,
    checks,
    hardwareValidationStatus: profile.hardwareValidation.status,
    hardwareRequiredForSoftwareResult: false
  };
}
