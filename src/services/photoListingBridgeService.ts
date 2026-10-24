/**
 * Photo Capture, Central Inventory Gate & Listing Preparation Safe Handoff Bridge
 * Provides safe, read-only data evaluation between Photo QA results and Listing Preparation Drafts.
 *
 * Safety Guarantees:
 * 1. NEVER writes to production inventory DB or localStorage drafts.
 * 2. Operates strictly in Dry Run mode on cloned/in-memory snapshots.
 * 3. Enforces strict linkage: SKU, inventoryUnitId, photoId, angle, and QA results.
 * 4. Preserves raw original photos as immutable evidence; selects AUTO_FIX images as listing candidates.
 * 5. Strictly protects non-photo inventory gates; overall listing eligibility is evaluated separately.
 */

import type {
  PhotoAngle,
  CapturedPhoto,
  ListingPhotoCandidate,
  ListingPhotoHandoffReasonCode,
  PhotoListingHandoffInput,
  DryRunListingPhotoHandoff
} from '../types/photoCapture';
import { REQUIRED_ANGLES } from '../types/photoCapture';
import type { SellableInventoryGate } from '../types/centralInventory';
import type { SalesChannel } from '../types/shippingRouter';

export const DEFAULT_LISTING_CHANNELS: SalesChannel[] = ['eBay', 'Shopee'];

/**
 * Evaluates whether captured photos and inventory unit context can safely hand off to Listing Preparation.
 * Returns a Dry Run preview with full reason codes, hero photo candidate, gallery photos, and gate status.
 */
export function evaluatePhotoListingHandoff(input: PhotoListingHandoffInput): DryRunListingPhotoHandoff {
  const targetChannels = input.targetChannels && input.targetChannels.length > 0
    ? input.targetChannels
    : DEFAULT_LISTING_CHANNELS;

  const targetContext = input.targetContext;
  const sku = targetContext?.sku?.trim() || '';
  const inventoryUnitId = targetContext?.inventoryUnitId?.trim() || '';

  // Baseline SellableInventoryGate snapshot
  const baseGate: SellableInventoryGate = input.unitSnapshot?.sellableGate
    ? { ...input.unitSnapshot.sellableGate }
    : {
        identityVerified: false,
        quantityVerified: false,
        conditionVerified: false,
        photoCaptureComplete: false,
        photoQaComplete: false,
        storageLocationRegistered: false
      };

  const handoffId = `handoff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const createFailureResult = (
    reasonCode: ListingPhotoHandoffReasonCode,
    reasonMessageJa: string
  ): DryRunListingPhotoHandoff => ({
    isDryRun: true,
    handoffId,
    sku,
    inventoryUnitId,
    sessionId: input.sessionId,
    targetChannels,
    canPrepareDraft: false,
    reasonCode,
    reasonMessageJa,
    heroPhoto: null,
    galleryPhotos: [],
    totalPhotoCount: Object.values(input.capturedPhotos).filter(Boolean).length,
    evidencePreserved: true,
    nonPhotoGatesUntouched: true,
    overallListingEligible: false,
    inventoryGateStatus: baseGate,
    draftPhotoPayloadPreview: null
  });

  // 1. Check for midway capture session failure / abort
  if (input.isMidwayAborted) {
    return createFailureResult(
      'HOLD_MIDWAY_CAPTURE_FAILURE',
      '撮影セッション中断 (HOLD): 撮影または補正処理中に異常または中断が発生したため、出品準備連携を保留します。'
    );
  }

  // 2. Unconfirmed target context or empty identifiers
  if (!targetContext || !targetContext.isConfirmed || !sku || !inventoryUnitId) {
    return createFailureResult(
      'HOLD_UNCONFIRMED_ID',
      'コンテキスト未確定 (HOLD): 商品カタログ番号(SKU)または実物個体管理番号(Unit ID)が未確定のため、出品準備へ渡せません。'
    );
  }

  // 3. Unit snapshot SKU / Unit ID mismatch check
  if (input.unitSnapshot) {
    if (input.unitSnapshot.inventoryUnitId !== inventoryUnitId) {
      return createFailureResult(
        'HOLD_SKU_UNIT_MISMATCH',
        `個体番号不一致 (HOLD): 指定個体番号(${inventoryUnitId})と既存在庫個体(${input.unitSnapshot.inventoryUnitId})が一致しません。`
      );
    }
    if (input.unitSnapshot.sku !== sku) {
      return createFailureResult(
        'HOLD_SKU_UNIT_MISMATCH',
        `SKU不一致 (HOLD): 指定SKU(${sku})と既存在庫SKU(${input.unitSnapshot.sku})が一致しません。`
      );
    }
  }

  // 4. Duplicate registration conflict guard
  if (input.existingRegisteredUnitIds && input.existingRegisteredUnitIds.includes(inventoryUnitId)) {
    return createFailureResult(
      'HOLD_DUPLICATE_REGISTRATION',
      `二重登録警告 (HOLD): 実物個体(${inventoryUnitId})は既に登録済みです。上書き防止のため出品準備連携を保留します。`
    );
  }

  // 5. Cross-product pollution check (写真メタデータと対象の照合)
  const nonNullPhotos = Object.values(input.capturedPhotos).filter((p): p is CapturedPhoto => p !== null);
  for (const photo of nonNullPhotos) {
    if (photo.sku && photo.sku !== sku) {
      return createFailureResult(
        'HOLD_CROSS_PRODUCT_POLLUTION',
        `別商品混入警告 (HOLD): 撮影写真(${photo.angle})に別商品SKU(${photo.sku})が記録されています。混入防止のため保留します。`
      );
    }
    if (photo.inventoryUnitId && photo.inventoryUnitId !== inventoryUnitId) {
      return createFailureResult(
        'HOLD_CROSS_PRODUCT_POLLUTION',
        `別個体混入警告 (HOLD): 撮影写真(${photo.angle})に別個体Unit ID(${photo.inventoryUnitId})が記録されています。混入防止のため保留します。`
      );
    }
  }

  // 6. Stale session / timestamp check
  if (input.sessionStartedAt) {
    const sessionTime = new Date(input.sessionStartedAt).getTime();
    for (const photo of nonNullPhotos) {
      const photoTime = new Date(photo.timestamp).getTime();
      // Allow up to 60 seconds clock skew, but reject photos clearly taken before session started
      if (!Number.isNaN(photoTime) && !Number.isNaN(sessionTime) && photoTime < sessionTime - 60000) {
        return createFailureResult(
          'HOLD_STALE_SESSION',
          `古い撮影結果 (HOLD): 撮影写真(${photo.angle})のタイムスタンプが現在の撮影セッション開始以前のものです。最新写真で再実行してください。`
        );
      }
    }
  }

  // 7. Required angles check (FRONT, BACK, LEFT, RIGHT)
  const missingAngles: PhotoAngle[] = [];
  const requiredGuideList = REQUIRED_ANGLES.filter((a) => a.isRequired);
  for (const guide of requiredGuideList) {
    if (!input.capturedPhotos[guide.angle]) {
      missingAngles.push(guide.angle);
    }
  }

  if (missingAngles.length > 0) {
    return createFailureResult(
      'HOLD_INSUFFICIENT_ANGLES',
      `撮影不足 (HOLD): 出品に必須の4アングルのうち未撮影のアングルが存在します (${missingAngles.join(', ')})。`
    );
  }

  // 8. Quality evaluation: All required angles must pass USE_AS_IS
  const failingAngles: string[] = [];
  for (const guide of requiredGuideList) {
    const photo = input.capturedPhotos[guide.angle]!;
    if (photo.qaResult.status !== 'USE_AS_IS') {
      const label = photo.qaResult.status === 'AUTO_FIX' ? '要自動補正(AUTO_FIX)' : '再撮影(RETAKE)';
      failingAngles.push(`${guide.angle}:${label}`);
    }
  }

  if (failingAngles.length > 0) {
    return createFailureResult(
      'HOLD_QA_NOT_PASSED',
      `QA未合格 (HOLD): 必須アングルに未合格の写真が含まれています (${failingAngles.join(', ')})。合格(USE_AS_IS)にしてから進めてください。`
    );
  }

  // 9. Build ListingPhotoCandidate records & Protect raw evidence
  // Candidate image selects photo.dataUrl (which contains AUTO_FIX if applied), while originalDataUrl is strictly preserved
  const candidateList: ListingPhotoCandidate[] = [];
  let heroPhoto: ListingPhotoCandidate | null = null;

  // Order angles: FRONT first, then other required, then optional
  const angleOrder: PhotoAngle[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'LABEL_TAG', 'DEFECT_DETAIL'];
  for (const angle of angleOrder) {
    const photo = input.capturedPhotos[angle];
    if (!photo) continue;

    const rawEvidenceUrl = photo.originalDataUrl || photo.dataUrl;
    const selectedListingUrl = photo.dataUrl; // Enhanced or clean raw image
    const isAutoFixed = Boolean(photo.originalDataUrl && photo.dataUrl !== photo.originalDataUrl);

    const candidate: ListingPhotoCandidate = {
      photoId: photo.id,
      angle: photo.angle,
      originalDataUrl: rawEvidenceUrl,
      selectedListingUrl,
      isAutoFixed,
      autoFixCount: photo.autoFixCount || (isAutoFixed ? 1 : 0),
      qaStatus: photo.qaResult.status,
      isHeroImageCandidate: photo.angle === 'FRONT'
    };

    if (photo.angle === 'FRONT') {
      heroPhoto = candidate;
    }
    candidateList.push(candidate);
  }

  // If FRONT was somehow not marked hero, fallback to first photo
  if (!heroPhoto && candidateList.length > 0) {
    heroPhoto = candidateList[0];
  }

  // 10. Compute updated gate preview (photo gates pass, non-photo gates remain untouched)
  const updatedGate: SellableInventoryGate = {
    ...baseGate,
    photoCaptureComplete: true,
    photoQaComplete: true
  };

  // Overall listing eligibility requires all 6 gates to be satisfied
  const overallListingEligible =
    updatedGate.identityVerified &&
    updatedGate.quantityVerified &&
    updatedGate.conditionVerified &&
    updatedGate.photoCaptureComplete &&
    updatedGate.photoQaComplete &&
    updatedGate.storageLocationRegistered;

  const reasonMessageJa = overallListingEligible
    ? `✅ 撮影QAおよび全販売ゲート合格: 個体(${inventoryUnitId})の出品準備ドラフト用写真データが準備完了しました。`
    : `✅ 撮影QAゲート合格: 必須4アングルは合格ですが、検品・保管場所等の非写真ゲート未完了のため全体出品適格性は保持(HOLD)されています。ドラフト写真候補のみ準備完了。`;

  // Additional gallery images (exclude hero from additional, or list in sequence)
  const additionalImageUrls = candidateList
    .filter((c) => c.angle !== heroPhoto?.angle)
    .map((c) => c.selectedListingUrl);

  const draftPhotoPayloadPreview = {
    sku,
    inventoryUnitId,
    channelCandidates: targetChannels,
    primaryImageUrl: heroPhoto ? heroPhoto.selectedListingUrl : null,
    additionalImageUrls,
    totalImageCount: candidateList.length
  };

  const result: DryRunListingPhotoHandoff = {
    isDryRun: true,
    handoffId,
    sku,
    inventoryUnitId,
    sessionId: input.sessionId,
    targetChannels,
    canPrepareDraft: true,
    reasonCode: 'READY_FOR_LISTING_DRAFT',
    reasonMessageJa,
    heroPhoto,
    galleryPhotos: candidateList,
    totalPhotoCount: candidateList.length,
    evidencePreserved: true,
    nonPhotoGatesUntouched: true,
    overallListingEligible,
    inventoryGateStatus: updatedGate,
    draftPhotoPayloadPreview
  };

  registerDryRunPhotoHandoff(result);
  return result;
}

/**
 * Lightweight in-memory bridge adapter for Photo Capture to Listing Preparation handoff.
 * Strictly operates in Dry Run mode without persistent side effects.
 */
export class PhotoListingBridgeAdapter {
  private existingRegisteredUnitIds: Set<string>;
  public readonly isDryRunOnly: boolean = true;

  constructor(options: { existingRegisteredUnitIds?: string[] } = {}) {
    this.existingRegisteredUnitIds = new Set(options.existingRegisteredUnitIds || []);
  }

  public evaluateHandoff(input: PhotoListingHandoffInput): DryRunListingPhotoHandoff {
    const combinedRegistered = input.existingRegisteredUnitIds
      ? Array.from(new Set([...this.existingRegisteredUnitIds, ...input.existingRegisteredUnitIds]))
      : Array.from(this.existingRegisteredUnitIds);

    const result = evaluatePhotoListingHandoff({
      ...input,
      existingRegisteredUnitIds: combinedRegistered
    });
    registerDryRunPhotoHandoff(result);
    return result;
  }
}

/**
 * 出品ドラフト画面向け写真プレビュー情報モデル (読み取り専用)
 */
export interface DraftPhotoPreviewSummary {
  sku: string;
  inventoryUnitId?: string;
  targetChannel: SalesChannel;
  status: 'AVAILABLE_PREVIEW' | 'HOLD_BLOCKED' | 'NO_PHOTOS_RECORDED';
  canDisplayListingCandidate: boolean;
  reasonCode?: ListingPhotoHandoffReasonCode;
  reasonMessageJa?: string;
  heroPhotoCandidate: ListingPhotoCandidate | null;
  galleryPhotoCandidates: ListingPhotoCandidate[];
  totalPhotoCount: number;
  evidencePreserved: boolean;
  nonPhotoGatesUntouched: boolean;
  overallListingEligible: boolean;
  channelConstraintsNote: {
    channel: SalesChannel;
    maxImagesAllowed: number;
    aspectRatioGuideline: string;
    disclaimerJa: string;
  };
}

/**
 * 販売チャネル別の安全な画像制約ガイドライン（情報提供のみ・出品保証はしない）
 */
export function getChannelPhotoConstraints(channel: SalesChannel): {
  channel: SalesChannel;
  maxImagesAllowed: number;
  aspectRatioGuideline: string;
  disclaimerJa: string;
} {
  if (channel === 'eBay') {
    return {
      channel: 'eBay',
      maxImagesAllowed: 24,
      aspectRatioGuideline: '長辺1600px以上推奨 (最小500px) / 白抜き・単色クリーン背景推奨',
      disclaimerJa: '※本表示は写真候補の確認用プレビューです。Listing Publish GateおよびeBay出品ポリシーの審査通過を保証するものではありません。'
    };
  }
  if (channel === 'Shopee') {
    return {
      channel: 'Shopee',
      maxImagesAllowed: 9,
      aspectRatioGuideline: '正方形 1:1 比率推奨 (500x500px以上、最大2MB) / 主画像は商品単体',
      disclaimerJa: '※本表示は写真候補の確認用プレビューです。Shopee現地マーケットプレイス規制・出品適格性を保証するものではありません。'
    };
  }
  return {
    channel,
    maxImagesAllowed: 12,
    aspectRatioGuideline: '高解像度写真推奨',
    disclaimerJa: '※本表示は写真候補の確認用プレビューです。各販売チャネルの出品適格性を保証するものではありません。'
  };
}

/**
 * In-memory Registry for Dry Run Photo Handoffs.
 * Strictly operates in memory with zero localStorage or DB writes.
 */
const inMemoryHandoffRegistry = new Map<string, DryRunListingPhotoHandoff>();

export function registerDryRunPhotoHandoff(handoff: DryRunListingPhotoHandoff): void {
  if (handoff.sku) {
    inMemoryHandoffRegistry.set(handoff.sku, handoff);
  }
}

export function getDryRunPhotoHandoff(sku: string): DryRunListingPhotoHandoff | undefined {
  return inMemoryHandoffRegistry.get(sku);
}

export function clearDryRunPhotoHandoffs(): void {
  inMemoryHandoffRegistry.clear();
}

/**
 * 出品ドラフトのSKUおよびチャネルに対する写真プレビュー状態を解決します。
 * 本番DBや永続ストレージへの書き込みを一切行いません。
 */
export function resolveDraftPhotoPreview(
  draft: { sku: string; targetChannel: SalesChannel },
  handoff?: DryRunListingPhotoHandoff
): DraftPhotoPreviewSummary {
  const constraints = getChannelPhotoConstraints(draft.targetChannel);
  const resolvedHandoff = handoff || getDryRunPhotoHandoff(draft.sku);

  if (!resolvedHandoff) {
    return {
      sku: draft.sku,
      targetChannel: draft.targetChannel,
      status: 'NO_PHOTOS_RECORDED',
      canDisplayListingCandidate: false,
      reasonMessageJa: `SKU (${draft.sku}) に紐付く確定済み写真データがありません。Photo Capture画面で撮影・QA合格を実行してください。`,
      heroPhotoCandidate: null,
      galleryPhotoCandidates: [],
      totalPhotoCount: 0,
      evidencePreserved: true,
      nonPhotoGatesUntouched: true,
      overallListingEligible: false,
      channelConstraintsNote: constraints
    };
  }

  // Cross-SKU pollution check between draft and handoff
  if (resolvedHandoff.sku && resolvedHandoff.sku !== draft.sku) {
    return {
      sku: draft.sku,
      inventoryUnitId: resolvedHandoff.inventoryUnitId,
      targetChannel: draft.targetChannel,
      status: 'HOLD_BLOCKED',
      canDisplayListingCandidate: false,
      reasonCode: 'HOLD_CROSS_PRODUCT_POLLUTION',
      reasonMessageJa: `SKU不一致警告 (HOLD): 下書きSKU (${draft.sku}) と撮影写真SKU (${resolvedHandoff.sku}) が一致しません。混同防止のためプレビューをブロックします。`,
      heroPhotoCandidate: null,
      galleryPhotoCandidates: [],
      totalPhotoCount: resolvedHandoff.totalPhotoCount,
      evidencePreserved: true,
      nonPhotoGatesUntouched: true,
      overallListingEligible: false,
      channelConstraintsNote: constraints
    };
  }

  if (!resolvedHandoff.canPrepareDraft) {
    return {
      sku: draft.sku,
      inventoryUnitId: resolvedHandoff.inventoryUnitId,
      targetChannel: draft.targetChannel,
      status: 'HOLD_BLOCKED',
      canDisplayListingCandidate: false,
      reasonCode: resolvedHandoff.reasonCode,
      reasonMessageJa: resolvedHandoff.reasonMessageJa,
      heroPhotoCandidate: null,
      galleryPhotoCandidates: [],
      totalPhotoCount: resolvedHandoff.totalPhotoCount,
      evidencePreserved: resolvedHandoff.evidencePreserved,
      nonPhotoGatesUntouched: resolvedHandoff.nonPhotoGatesUntouched,
      overallListingEligible: false,
      channelConstraintsNote: constraints
    };
  }

  return {
    sku: draft.sku,
    inventoryUnitId: resolvedHandoff.inventoryUnitId,
    targetChannel: draft.targetChannel,
    status: 'AVAILABLE_PREVIEW',
    canDisplayListingCandidate: true,
    reasonCode: resolvedHandoff.reasonCode,
    reasonMessageJa: resolvedHandoff.reasonMessageJa,
    heroPhotoCandidate: resolvedHandoff.heroPhoto,
    galleryPhotoCandidates: resolvedHandoff.galleryPhotos,
    totalPhotoCount: resolvedHandoff.totalPhotoCount,
    evidencePreserved: resolvedHandoff.evidencePreserved,
    nonPhotoGatesUntouched: resolvedHandoff.nonPhotoGatesUntouched,
    overallListingEligible: resolvedHandoff.overallListingEligible,
    channelConstraintsNote: constraints
  };
}
