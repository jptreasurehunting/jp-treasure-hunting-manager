/**
 * Types and Interfaces for Pedal-Assisted Photo Capture & Automated Photo QA MVP
 */

export type PhotoAngle = 
  | 'FRONT'
  | 'BACK'
  | 'LEFT'
  | 'RIGHT'
  | 'TOP'
  | 'LABEL_TAG'
  | 'DEFECT_DETAIL';

export type PhotoQaStatus = 
  | 'USE_AS_IS'
  | 'AUTO_FIX'
  | 'RETAKE';

export interface PhotoQaIssue {
  code: 'BLUR_DETECTED' | 'EXPOSURE_UNDER' | 'EXPOSURE_OVER' | 'SUBJECT_CROPPED' | 'GLARE_DETECTED' | 'ANALYSIS_FAILED';
  severity: 'WARNING' | 'ERROR';
  message: string;
}

export interface PhotoQaMetrics {
  blurScore: number;        // 0 (crisp) - 100 (extremely blurry)
  brightness: number;       // 0 (pitch black) - 255 (blinding white)
  framingCoverage: number;  // 0 - 100% of subject within safe box
  glareScore: number;       // 0 (none) - 100 (heavy reflection)
}

export interface PhotoQaResult {
  status: PhotoQaStatus;
  issues: PhotoQaIssue[];
  metrics: PhotoQaMetrics;
  autoFixApplied?: boolean;
  suggestedAction: string;
}

export interface CapturedPhoto {
  id: string;
  angle: PhotoAngle;
  timestamp: string;
  dataUrl: string;
  qaResult: PhotoQaResult;
  originalDataUrl?: string; // Kept if auto-fix was applied
}

export interface PedalTriggerConfig {
  enabled: boolean;
  triggerKey: string; // e.g. 'Space' | 'Enter' | 'F12'
  keyLabel: string;
  isTabActive?: boolean;
}

export interface AngleGuide {
  angle: PhotoAngle;
  labelJa: string;
  labelEn: string;
  description: string;
  isRequired: boolean;
}

export const REQUIRED_ANGLES: AngleGuide[] = [
  { angle: 'FRONT', labelJa: '正面 (Front)', labelEn: 'Front View', description: '商品の正面全体が見えるように配置してください', isRequired: true },
  { angle: 'BACK', labelJa: '背面 (Back)', labelEn: 'Back View', description: '背面および型番・シリアル等の印字を確認できます', isRequired: true },
  { angle: 'LEFT', labelJa: '左側面 (Left)', labelEn: 'Left Side', description: '左側面の状態およびボタン類を確認できます', isRequired: true },
  { angle: 'RIGHT', labelJa: '右側面 (Right)', labelEn: 'Right Side', description: '右側面の状態および端子類を確認できます', isRequired: true },
  { angle: 'TOP', labelJa: '上面 (Top)', labelEn: 'Top View', description: '上面の操作パネルやダイヤル部を撮影します', isRequired: false },
  { angle: 'LABEL_TAG', labelJa: '銘板・タグ (Label/Tag)', labelEn: 'Serial / Label', description: 'シリアルナンバーや各種認証ラベルをズーム撮影', isRequired: false },
  { angle: 'DEFECT_DETAIL', labelJa: '傷・スレ詳細 (Defect)', labelEn: 'Defect Details', description: '目立つ傷や経年劣化箇所を接写撮影', isRequired: false }
];
