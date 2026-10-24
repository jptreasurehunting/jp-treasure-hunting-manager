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
  itemId?: string;          // Associated Product/Item ID (商品ID - 互換用)
  inventoryId?: string;     // Associated Inventory / Individual Unit ID (在庫個体ID - 互換用)
  sku?: string;             // 商品カタログ番号 (SKU)
  inventoryUnitId?: string; // 実物個体管理番号 (Unit ID)
  autoFixCount?: number;    // Number of auto-fix attempts applied
}

export type HardwareValidationStatus =
  | 'HARDWARE_PENDING'      // 実機未接続・実機検証待ち (手元に実機なし)
  | 'MOCK_SIMULATED'        // モック/擬似環境での検証合格
  | 'HARDWARE_VERIFIED';    // 実機接続での検証合格

/**
 * 写真と商品・在庫個体との紐付けステータス
 */
export type PhotoLinkageStatus =
  | 'UNLINKED_HOLD'         // 紐付け保留中 (SKUまたはUnit IDが未指定/未確定。撮影テスト可能だが本番反映を安全にブロック)
  | 'LINKED_STAGED'         // 紐付け確定・登録準備完了 (実在するSKUとUnit IDに安全に関連付け済み)
  | 'ALREADY_REGISTERED'    // 登録済み警告 (指定の個体IDには既に写真が登録されており上書き防止)
  | 'MISMATCH_ERROR';       // ID不一致エラー (撮影中写真と対象個体IDが相違)

/**
 * 撮影対象の商品・個体コンテキスト
 * 架空IDの保存を防止し、商品カタログ番号 (SKU) と 実物個体管理番号 (Unit ID) を明確に区別します。
 */
export interface PhotoCaptureTargetContext {
  sku?: string;             // 商品カタログ番号 (SKU: 例 SKU-CANON-AE1-SLV)
  itemTitle?: string;       // 商品名 (カタログ品名)
  inventoryUnitId?: string; // 実物個体管理番号 (Unit ID: 例 UNIT-2026-0042)
  serialNumber?: string;    // 個体シリアル番号 (現物に刻印された製造番号等)
  isConfirmed: boolean;     // 確定フラグ (falseの場合はUNLINKED_HOLDとなり本番反映を禁止)
}

export interface PhotoStorageRecord {
  itemId: string;           // 互換用
  inventoryId?: string;     // 互換用
  sku?: string;             // 商品カタログ番号 (SKU)
  inventoryUnitId?: string; // 実物個体管理番号 (Unit ID)
  photos: Partial<Record<PhotoAngle, CapturedPhoto>>;
  updatedAt: string;
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
