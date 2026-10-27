/**
 * Types and Interfaces for Pedal-Assisted Photo Capture & Automated Photo QA MVP
 */

import type { InventoryUnit, SellableInventoryGate, InventoryUnitStatus } from './centralInventory';
import type { SalesChannel } from './shippingRouter';

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

export interface PixelImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
}

export interface RealPhotoFileMetadata {
  fileName: string;
  sizeBytes: number;
  mimeType: 'image/jpeg' | 'image/png';
  sha256Hex: string;
  width: number;
  height: number;
  isRealFile: boolean;
  importedAt: string;
  exifOrientation?: number;
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
  pixelData?: PixelImageData; // Decoded raw RGBA pixels for real photo QA and transformations
  fileMetadata?: RealPhotoFileMetadata; // Real photo file metadata if imported from disk
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

/**
 * 写真撮影結果と在庫ゲート(SellableInventoryGate)との連携ステータス
 */
export type InventoryPhotoGateStatus =
  | 'UPDATED'           // 撮影・QA合格により在庫個体の写真ゲートが正常更新された
  | 'IDEMPOTENT_NOOP'   // 既に合格済みのため安全にスキップ（冪等処理）
  | 'HOLD_BLOCKED'      // コンテキスト未確定・保留中のため更新ブロック
  | 'UNIT_NOT_FOUND'    // 指定の在庫個体が存在しない
  | 'SKU_MISMATCH'      // 個体のSKUと指定SKUが不一致
  | 'QA_INCOMPLETE';    // 必須アングルの撮影不足またはQA不合格

export interface InventoryPhotoGateSyncResult {
  success: boolean;
  status: InventoryPhotoGateStatus;
  unit?: InventoryUnit;
  messageJa: string;
  photoCaptureComplete: boolean;
  photoQaComplete: boolean;
}

/**
 * 写真ゲートと在庫連携の判定理由コード (Reason Codes)
 */
export type PhotoGateSyncReasonCode =
  | 'SUCCESS_EVALUATED'
  | 'HOLD_UNCONFIRMED_CONTEXT'
  | 'HOLD_UNIT_NOT_FOUND'
  | 'HOLD_SKU_MISMATCH'
  | 'HOLD_INCOMPLETE_ANGLES'
  | 'HOLD_QA_RETAKE_REQUIRED'
  | 'HOLD_AUTO_FIX_PENDING'
  | 'HOLD_ALREADY_REGISTERED_CONFLICT'
  | 'IDEMPOTENT_ALREADY_COMPLETED';

/**
 * 変更前後の比較が可能な Dry Run プレビューモデル
 * 実在庫DBへ書き込まず、ゲート更新の影響範囲を事前検証します。
 */
export interface PhotoGateDryRunPreview {
  isDryRun: boolean;
  canApply: boolean;
  reasonCode: PhotoGateSyncReasonCode;
  reasonMessageJa: string;
  before: {
    inventoryUnitId: string;
    sku: string;
    status: InventoryUnitStatus;
    sellableGate: SellableInventoryGate;
    physicalStock?: number;
    sellableStock?: number;
    availableToSell?: number;
  } | null;
  after: {
    inventoryUnitId: string;
    sku: string;
    status: InventoryUnitStatus;
    sellableGate: SellableInventoryGate;
    physicalStock?: number;
    sellableStock?: number;
    availableToSell?: number;
  } | null;
  gateDiff: {
    photoCaptureComplete: { before: boolean; after: boolean };
    photoQaComplete: { before: boolean; after: boolean };
    identityVerified: { before: boolean; after: boolean; changed: boolean };
    quantityVerified: { before: boolean; after: boolean; changed: boolean };
    conditionVerified: { before: boolean; after: boolean; changed: boolean };
    storageLocationRegistered: { before: boolean; after: boolean; changed: boolean };
    statusChanged: boolean;
    stockQuantitiesChanged: boolean;
    nonPhotoGatesUntouched: boolean;
  } | null;
  evidencePreserved: boolean;
  capturedPhotosCount: number;
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

/**
 * 出品準備用写真候補モデル (原本保護と補正後画像の対応関係を保持)
 */
export interface ListingPhotoCandidate {
  photoId: string;
  angle: PhotoAngle;
  originalDataUrl: string;       // 原本写真 (Read-only evidence: 加工・上書き厳禁)
  selectedListingUrl: string;    // 出品用選定画像 (AUTO_FIX補正済または合格画像)
  isAutoFixed: boolean;          // 自動補正が適用されたか
  autoFixCount: number;          // 補正適用回数
  qaStatus: PhotoQaStatus;       // 'USE_AS_IS'
  isHeroImageCandidate: boolean; // FRONTアングル等はメイン出品画像候補
}

/**
 * 出品準備データ受け渡しの判定理由コード (Reason Codes)
 */
export type ListingPhotoHandoffReasonCode =
  | 'READY_FOR_LISTING_DRAFT'        // 出品準備ドラフトへ引き渡し可能
  | 'HOLD_UNCONFIRMED_ID'            // SKUまたはUnit IDが未指定/未確定
  | 'HOLD_SKU_UNIT_MISMATCH'         // 指定SKU/Unit IDと在庫個体情報の不一致
  | 'HOLD_CROSS_PRODUCT_POLLUTION'   // 撮影写真に別商品・別個体のタグが混入
  | 'HOLD_QA_NOT_PASSED'             // RETAKEまたは未補正AUTO_FIXの写真が存在
  | 'HOLD_INSUFFICIENT_ANGLES'       // 必須4アングル(正面/背面/左/右)が不足
  | 'HOLD_DUPLICATE_REGISTRATION'    // 既に登録済み個体との競合・二重登録防止
  | 'HOLD_STALE_SESSION'             // 撮影セッションの鮮度不一致・古い撮影結果
  | 'HOLD_MIDWAY_CAPTURE_FAILURE';   // 撮影セッション途中中断・アダプター異常

/**
 * 出品準備データ受け渡し入力コンテキスト
 */
export interface PhotoListingHandoffInput {
  targetContext?: PhotoCaptureTargetContext;
  capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>;
  sessionId?: string;
  sessionStartedAt?: string;
  existingRegisteredUnitIds?: string[];
  unitSnapshot?: InventoryUnit;
  targetChannels?: SalesChannel[];
  isMidwayAborted?: boolean;
}

/**
 * 出品準備データ受け渡しの Dry Run プレビューモデル
 * 本番の在庫・出品データ・実DBへは一切書き込まず、安全に差分と連携結果を検証します。
 */
export interface DryRunListingPhotoHandoff {
  isDryRun: boolean;
  handoffId: string;
  sku: string;
  inventoryUnitId: string;
  sessionId?: string;
  targetChannels: SalesChannel[];
  canPrepareDraft: boolean;
  reasonCode: ListingPhotoHandoffReasonCode;
  reasonMessageJa: string;
  heroPhoto: ListingPhotoCandidate | null;
  galleryPhotos: ListingPhotoCandidate[];
  totalPhotoCount: number;
  evidencePreserved: boolean;
  nonPhotoGatesUntouched: boolean;
  overallListingEligible: boolean;
  inventoryGateStatus: SellableInventoryGate;
  draftPhotoPayloadPreview: {
    sku: string;
    inventoryUnitId: string;
    channelCandidates: SalesChannel[];
    primaryImageUrl: string | null;
    additionalImageUrls: string[];
    totalImageCount: number;
  } | null;
}
