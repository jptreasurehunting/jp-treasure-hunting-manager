/**
 * Listing Pipeline End-to-End Simulation Service
 * Provides comprehensive in-memory simulation and validation across:
 * 1. Photo Capture & QA Verification
 * 2. Central Inventory Photo Gate Sync
 * 3. Photo Listing Handoff Bridge
 * 4. Listing Preparation Draft
 * 5. Listing Draft Review
 * 6. Listing Publish Gate
 *
 * Safety Guarantees:
 * - Operates strictly on detached in-memory mock datasets (ZERO persistent DB/localStorage writes).
 * - Enforces immutable evidence preservation (originalDataUrl is never mutated or overwritten).
 * - Strictly protects non-photo inventory gates; overall listing eligibility is never falsely promoted.
 * - Hardware status for camera and foot pedal is explicitly tracked as HARDWARE_PENDING.
 */

import type {
  PhotoAngle,
  CapturedPhoto,
  PhotoCaptureTargetContext,
  DryRunListingPhotoHandoff,
  PhotoGateDryRunPreview,
  HardwareValidationStatus
} from '../types/photoCapture';
import { REQUIRED_ANGLES } from '../types/photoCapture';
import type {
  InventoryUnit,
  CentralInventoryItem,
  SellableInventoryGate
} from '../types/centralInventory';
import type { SalesChannel } from '../types/shippingRouter';
import { CentralInventoryPhotoAdapter } from './centralInventoryPhotoAdapter';
import {
  evaluatePhotoListingHandoff,
  resolveDraftPhotoPreview,
  registerDryRunPhotoHandoff,
  clearDryRunPhotoHandoffs,
  DraftPhotoPreviewSummary
} from './photoListingBridgeService';
import {
  ListingPreparationDraft,
  evaluateListingPreparation
} from './listingPreparationService';
import {
  evaluateListingDraftReadiness,
  ListingDraftReadiness
} from './listingDraftReviewService';
import {
  evaluateListingPublishGate,
  ListingPublishGateInput,
  ListingPublishGateEvaluation
} from './listingPublishGateService';
import {
  evaluatePhotoInventoryLinkage,
  checkPhotoGateCompletion
} from './photoCaptureService';

export type PipelineScenarioType =
  | 'SUCCESS_FULL_PASS'
  | 'UNTAKEN_PHOTOS'
  | 'QA_RETAKE'
  | 'AUTO_FIX_PENDING'
  | 'CROSS_PRODUCT_POLLUTION'
  | 'STALE_SESSION'
  | 'UNIT_ID_MISMATCH'
  | 'DUPLICATE_REGISTRATION'
  | 'MIDWAY_ABORTED'
  | 'RETRY_SUCCESS'
  | 'NON_PHOTO_GATE_INCOMPLETE'
  | 'DRAFT_REVIEW_MISSING_PRICE'
  | 'PUBLISH_GATE_MISSING_APPROVAL';

export type PipelineStageStatus = 'PASSED' | 'HOLD' | 'BLOCKED' | 'NOT_REACHED';

export type PipelineStageName =
  | 'PHOTO_CAPTURE'
  | 'INVENTORY_PHOTO_GATE'
  | 'PHOTO_LISTING_HANDOFF'
  | 'LISTING_PREPARATION'
  | 'LISTING_DRAFT_REVIEW'
  | 'LISTING_PUBLISH_GATE';

export interface ListingPipelineStageDetail<T = any> {
  stageName: PipelineStageName;
  displayNameJa: string;
  status: PipelineStageStatus;
  reasonCode: string;
  reasonMessageJa: string;
  nextActionJa: string;
  beforeSnapshot?: any;
  afterSnapshot?: any;
  stageData?: T;
}

export interface ListingPipelineSimulationResult {
  isSimulation: true;
  simulatedAt: string;
  scenarioType: PipelineScenarioType;
  sku: string;
  inventoryUnitId: string;
  overallSuccess: boolean;
  overallListingEligible: boolean;
  blockingStage?: PipelineStageName;
  stages: {
    photoCapture: ListingPipelineStageDetail;
    inventoryGate: ListingPipelineStageDetail<PhotoGateDryRunPreview | null>;
    photoHandoff: ListingPipelineStageDetail<DryRunListingPhotoHandoff | null>;
    listingPreparation: ListingPipelineStageDetail<{ draft: ListingPreparationDraft | null }>;
    draftReview: ListingPipelineStageDetail<{ readiness: ListingDraftReadiness | null; photoPreview: DraftPhotoPreviewSummary | null }>;
    publishGate: ListingPipelineStageDetail<{ evaluation: ListingPublishGateEvaluation | null }>;
  };
  summaryJa: string;
  hardwareStatus: HardwareValidationStatus;
}

export interface ListingPipelineSimulationOptions {
  scenarioType: PipelineScenarioType;
  targetContext: PhotoCaptureTargetContext;
  capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>;
  unit: InventoryUnit;
  item: CentralInventoryItem;
  targetChannels?: SalesChannel[];
  existingRegisteredUnitIds?: string[];
  isMidwayAborted?: boolean;
  sessionStartedAt?: string;
  publishGateInput?: ListingPublishGateInput;
  draftOverrides?: Partial<ListingPreparationDraft>;
}

/**
 * Creates dummy base64 photo data URL with embedded SVG text.
 */
function createDummyPhotoDataUrl(angle: string, note = ''): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <rect width="600" height="600" fill="#1e293b"/>
    <rect x="20" y="20" width="560" height="560" fill="none" stroke="#38bdf8" stroke-width="4"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-size="28" font-family="sans-serif" font-weight="bold">PHOTO: ${angle}</text>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-size="16" font-family="sans-serif">${note || 'E2E SIMULATION EVIDENCE'}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Factory to generate realistic, isolated mock scenario configurations.
 */
export function createMockPipelineScenario(scenarioType: PipelineScenarioType): ListingPipelineSimulationOptions {
  const now = new Date().toISOString();
  const sku = 'MOCK-E2E-CAM-001';
  const unitId = 'MOCK-UNIT-CAM-001-A';

  const targetContext: PhotoCaptureTargetContext = {
    sku,
    inventoryUnitId: unitId,
    itemTitle: '【模擬テスト】ビンテージ一眼レフカメラ E2E検証個体',
    serialNumber: 'SN-E2E-998811',
    isConfirmed: true
  };

  const createPhoto = (angle: PhotoAngle, status: 'USE_AS_IS' | 'RETAKE' | 'AUTO_FIX' = 'USE_AS_IS'): CapturedPhoto => {
    const rawData = createDummyPhotoDataUrl(angle, 'ORIGINAL EVIDENCE');
    const correctedData = status === 'AUTO_FIX'
      ? createDummyPhotoDataUrl(angle, 'AUTO-FIX APPLIED')
      : rawData;

    return {
      id: `mock-photo-${angle.toLowerCase()}-${Date.now()}`,
      angle,
      timestamp: now,
      dataUrl: correctedData,
      originalDataUrl: rawData,
      sku,
      inventoryUnitId: unitId,
      autoFixCount: status === 'AUTO_FIX' ? 1 : 0,
      qaResult: {
        status,
        issues: status === 'RETAKE'
          ? [{ code: 'BLUR_DETECTED', severity: 'ERROR', message: '被写体ぶれを検出しました' }]
          : status === 'AUTO_FIX'
          ? [{ code: 'EXPOSURE_UNDER', severity: 'WARNING', message: '露出不足を検出（自動補正可）' }]
          : [],
        metrics: {
          blurScore: status === 'RETAKE' ? 75 : 12,
          brightness: status === 'AUTO_FIX' ? 70 : 135,
          framingCoverage: 95,
          glareScore: 5
        },
        autoFixApplied: status === 'AUTO_FIX',
        suggestedAction: status === 'USE_AS_IS' ? 'そのまま使用可能です' : '再撮影または補正を行ってください'
      }
    };
  };

  // Base 4 required photos
  const capturedPhotos: Record<PhotoAngle, CapturedPhoto | null> = {
    FRONT: createPhoto('FRONT', 'USE_AS_IS'),
    BACK: createPhoto('BACK', 'USE_AS_IS'),
    LEFT: createPhoto('LEFT', 'USE_AS_IS'),
    RIGHT: createPhoto('RIGHT', 'USE_AS_IS'),
    TOP: null,
    LABEL_TAG: null,
    DEFECT_DETAIL: null
  };

  // Base inventory unit with non-photo gates passed
  const unit: InventoryUnit = {
    inventoryUnitId: unitId,
    sku,
    status: 'ON_HAND',
    storageLocation: 'BIN-E2E-01',
    receivedAt: now,
    sellableGate: {
      identityVerified: true,
      quantityVerified: true,
      conditionVerified: true,
      photoCaptureComplete: false,
      photoQaComplete: false,
      storageLocationRegistered: true
    },
    updatedAt: now,
    notes: 'SN-E2E-998811'
  };

  // Base central inventory item
  const item: CentralInventoryItem = {
    sku,
    itemTitle: '【模擬テスト】ビンテージ一眼レフカメラ E2E検証個体',
    physicalStock: 1,
    sellableStock: 0,
    buyerAllocatedStock: 0,
    inboundStock: 0,
    availableToSell: 1,
    safetyBuffer: 0,
    unitCostJpy: 18000,
    weightGrams: 850,
    dimensionsCm: { length: 14, width: 16, height: 11 },
    category: 'VINTAGE_CAMERAS',
    channelBindings: [],
    lastReconciledAt: now,
    isLockedForOversellingRisk: false
  };

  // Base publish gate input
  const publishGateInput: ListingPublishGateInput = {
    targetMarketplace: 'eBay US (Vintage Cameras)',
    sellerAccountVerified: true,
    sellerAccountVerificationNote: '社内販売アカウント管理台帳にてトークン有効性と出品ポリシーを確認済み',
    marketplaceRulesVerified: true,
    marketplaceRulesSourceUrl: 'https://www.ebay.com/help/policies/listing-policies',
    marketplaceRulesCheckedAt: now,
    marketplaceRulesNote: '2026年最新のeBay写真ガイドライン（白背景・長辺1600px推奨）を確認済み',
    finalApproved: true,
    approvedBy: 'LEAD_INSPECTOR_E2E',
    approvalNote: '写真4方向USE_AS_IS合格、シリアル一致、原本保全、価格・配送条件確認済み'
  };

  // Scenario specific modifications
  let isMidwayAborted = false;
  let sessionStartedAt = now;
  const existingRegisteredUnitIds: string[] = [];

  switch (scenarioType) {
    case 'UNTAKEN_PHOTOS':
      capturedPhotos.BACK = null;
      capturedPhotos.LEFT = null;
      capturedPhotos.RIGHT = null;
      break;

    case 'QA_RETAKE':
      capturedPhotos.FRONT = createPhoto('FRONT', 'RETAKE');
      break;

    case 'AUTO_FIX_PENDING':
      // AUTO_FIX with autoFixApplied = false
      capturedPhotos.BACK = {
        ...createPhoto('BACK', 'AUTO_FIX'),
        qaResult: {
          status: 'AUTO_FIX',
          issues: [{ code: 'EXPOSURE_UNDER', severity: 'WARNING', message: '露出不足（未補正）' }],
          metrics: { blurScore: 15, brightness: 60, framingCoverage: 90, glareScore: 2 },
          autoFixApplied: false,
          suggestedAction: '自動露出補正を適用してください'
        }
      };
      break;

    case 'CROSS_PRODUCT_POLLUTION':
      capturedPhotos.RIGHT = {
        ...createPhoto('RIGHT', 'USE_AS_IS'),
        sku: 'MOCK-POLLUTED-SKU-999'
      };
      break;

    case 'STALE_SESSION':
      sessionStartedAt = now;
      // Photos taken 2 hours before session
      const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
      (Object.keys(capturedPhotos) as PhotoAngle[]).forEach((ang) => {
        if (capturedPhotos[ang]) {
          capturedPhotos[ang] = { ...capturedPhotos[ang]!, timestamp: twoHoursAgo };
        }
      });
      break;

    case 'UNIT_ID_MISMATCH':
      targetContext.inventoryUnitId = 'MOCK-UNIT-DIFFERENT-999';
      break;

    case 'DUPLICATE_REGISTRATION':
      existingRegisteredUnitIds.push(unitId);
      break;

    case 'MIDWAY_ABORTED':
      isMidwayAborted = true;
      break;

    case 'RETRY_SUCCESS':
      // Simulates recovering from a prior RETAKE: all photos are crisp and passed
      capturedPhotos.FRONT = createPhoto('FRONT', 'USE_AS_IS');
      capturedPhotos.BACK = createPhoto('BACK', 'USE_AS_IS');
      capturedPhotos.LEFT = createPhoto('LEFT', 'USE_AS_IS');
      capturedPhotos.RIGHT = createPhoto('RIGHT', 'USE_AS_IS');
      break;

    case 'NON_PHOTO_GATE_INCOMPLETE':
      unit.sellableGate.conditionVerified = false;
      unit.sellableGate.storageLocationRegistered = false;
      break;

    case 'DRAFT_REVIEW_MISSING_PRICE':
      // Price will be omitted / set to 0 in draft
      break;

    case 'PUBLISH_GATE_MISSING_APPROVAL':
      publishGateInput.finalApproved = false;
      publishGateInput.sellerAccountVerified = false;
      break;

    case 'SUCCESS_FULL_PASS':
    default:
      break;
  }

  return {
    scenarioType,
    targetContext,
    capturedPhotos,
    unit,
    item,
    targetChannels: ['eBay', 'Shopee'],
    existingRegisteredUnitIds,
    isMidwayAborted,
    sessionStartedAt,
    publishGateInput
  };
}

/**
 * Executes a simulated End-to-End run through all 6 pipeline stages.
 * Guaranteed 100% in-memory with zero side-effects to production database or localStorage.
 */
export function executeListingPipelineSimulation(options: ListingPipelineSimulationOptions): ListingPipelineSimulationResult {
  const simulatedAt = new Date().toISOString();
  const {
    scenarioType,
    targetContext,
    capturedPhotos,
    unit,
    item,
    targetChannels = ['eBay', 'Shopee'],
    existingRegisteredUnitIds = [],
    isMidwayAborted = false,
    sessionStartedAt = simulatedAt,
    publishGateInput
  } = options;

  const sku = targetContext.sku?.trim() || '';
  const inventoryUnitId = targetContext.inventoryUnitId?.trim() || '';

  // Clean in-memory registry before running simulation
  clearDryRunPhotoHandoffs();

  // =========================================================================
  // Stage 1: Photo Capture & Automated QA (必須4方向 & USE_AS_IS合格検証)
  // =========================================================================
  const linkage = evaluatePhotoInventoryLinkage(targetContext, existingRegisteredUnitIds);
  const gateCheck = checkPhotoGateCompletion(capturedPhotos);
  const photoValues = Object.values(capturedPhotos).filter((p): p is CapturedPhoto => p !== null);

  let stage1Status: PipelineStageStatus = 'PASSED';
  let stage1ReasonCode = 'PASS_ALL_ANGLES';
  let stage1MessageJa = '必須4アングル（正面・背面・左・右）の撮影および品質QA（USE_AS_IS）に合格しました。';
  let stage1NextActionJa = '在庫個体へのゲート反映（Dry Run）へ進んでください。';

  if (!targetContext.isConfirmed || !sku || !inventoryUnitId) {
    stage1Status = 'HOLD';
    stage1ReasonCode = 'HOLD_UNCONFIRMED_CONTEXT';
    stage1MessageJa = '商品カタログ番号(SKU)または実物個体管理番号(Unit ID)が未確定です。';
    stage1NextActionJa = '商品および在庫個体を確認し、紐付けを確定してください。';
  } else if (linkage.status === 'ALREADY_REGISTERED') {
    stage1Status = 'HOLD';
    stage1ReasonCode = 'HOLD_ALREADY_REGISTERED';
    stage1MessageJa = `個体番号(${inventoryUnitId})は既に登録済みリストに存在します。上書き防止のため保留します。`;
    stage1NextActionJa = '登録済み写真を確認するか、別の個体番号を指定してください。';
  } else if (gateCheck.missingRequiredAngles.length > 0) {
    stage1Status = 'HOLD';
    stage1ReasonCode = 'HOLD_INSUFFICIENT_ANGLES';
    stage1MessageJa = `必須アングルが未撮影です: ${gateCheck.missingRequiredAngles.join(', ')}`;
    stage1NextActionJa = 'Spaceキーまたはフットペダルを押して未撮影アングルを撮影してください。';
  } else {
    const retakePhotos = photoValues.filter((p) => p.qaResult.status === 'RETAKE');
    const autoFixPending = photoValues.filter((p) => p.qaResult.status === 'AUTO_FIX' && !p.qaResult.autoFixApplied);

    if (retakePhotos.length > 0) {
      stage1Status = 'HOLD';
      stage1ReasonCode = 'HOLD_QA_RETAKE_REQUIRED';
      stage1MessageJa = `再撮影(RETAKE)判定の写真が含まれています: ${retakePhotos.map((p) => p.angle).join(', ')}`;
      stage1NextActionJa = '照明や被写体の配置を見直し、該当アングルを再撮影してください。';
    } else if (autoFixPending.length > 0) {
      stage1Status = 'HOLD';
      stage1ReasonCode = 'HOLD_AUTO_FIX_PENDING';
      stage1MessageJa = `自動補正(AUTO_FIX)未適用の写真が存在します: ${autoFixPending.map((p) => p.angle).join(', ')}`;
      stage1NextActionJa = '自動補正を適用して再評価を実行してください。';
    }
  }

  const stage1Detail: ListingPipelineStageDetail = {
    stageName: 'PHOTO_CAPTURE',
    displayNameJa: '写真撮影 & 自動品質QA',
    status: stage1Status,
    reasonCode: stage1ReasonCode,
    reasonMessageJa: stage1MessageJa,
    nextActionJa: stage1NextActionJa,
    stageData: {
      passedRequiredAngles: gateCheck.passedRequiredAngles,
      missingRequiredAngles: gateCheck.missingRequiredAngles,
      photoCount: photoValues.length
    }
  };

  // =========================================================================
  // Stage 2: Central Inventory Photo Gate Sync Simulation (在庫ゲートDry Run)
  // =========================================================================
  const adapter = new CentralInventoryPhotoAdapter({
    inMemoryUnits: [unit],
    customItems: [item],
    existingRegisteredUnitIds,
    dryRunOnly: true
  });

  const gatePreview = adapter.generateDryRunPreview(targetContext, capturedPhotos);

  let stage2Status: PipelineStageStatus = 'PASSED';
  let stage2NextActionJa = '出品ドラフト用写真候補の生成（Bridge）へ進んでください。';

  if (!gatePreview.canApply) {
    stage2Status = 'HOLD';
    stage2NextActionJa = '在庫ゲートの保留理由を解消してください。';
  }

  const stage2Detail: ListingPipelineStageDetail<PhotoGateDryRunPreview | null> = {
    stageName: 'INVENTORY_PHOTO_GATE',
    displayNameJa: '在庫ゲート連携 (SellableInventoryGate Dry Run)',
    status: stage2Status,
    reasonCode: gatePreview.reasonCode,
    reasonMessageJa: gatePreview.reasonMessageJa,
    nextActionJa: stage2NextActionJa,
    beforeSnapshot: gatePreview.before,
    afterSnapshot: gatePreview.after,
    stageData: gatePreview
  };

  // =========================================================================
  // Stage 3: Photo Listing Handoff Bridge (ドラフト画像候補生成 & 原本保護)
  // =========================================================================
  const handoffResult = evaluatePhotoListingHandoff({
    sessionId: `session-sim-${Date.now()}`,
    sessionStartedAt,
    isMidwayAborted,
    targetContext,
    capturedPhotos,
    unitSnapshot: unit,
    targetChannels,
    existingRegisteredUnitIds
  });

  let stage3Status: PipelineStageStatus = 'PASSED';
  let stage3NextActionJa = '出品準備下書き（Listing Preparation Draft）を作成してください。';

  if (!handoffResult.canPrepareDraft) {
    stage3Status = 'HOLD';
    stage3NextActionJa = '写真連携の保留理由を解消し、再度Bridge評価を実行してください。';
  } else {
    // In-memory registration
    registerDryRunPhotoHandoff(handoffResult);
  }

  const stage3Detail: ListingPipelineStageDetail<DryRunListingPhotoHandoff | null> = {
    stageName: 'PHOTO_LISTING_HANDOFF',
    displayNameJa: '出品準備写真連携 (Photo Listing Bridge)',
    status: stage3Status,
    reasonCode: handoffResult.reasonCode,
    reasonMessageJa: handoffResult.reasonMessageJa,
    nextActionJa: stage3NextActionJa,
    stageData: handoffResult
  };

  // =========================================================================
  // Stage 4: Listing Preparation Draft Simulation (出品準備下書き作成)
  // =========================================================================
  let stage4Status: PipelineStageStatus = 'NOT_REACHED';
  let stage4ReasonCode = 'STAGE_NOT_REACHED';
  let stage4MessageJa = '前工程（写真連携）が保留または未達のため、出品準備下書きへ到達していません。';
  let stage4NextActionJa = '前工程の保留を解消してください。';
  let simulatedDraft: ListingPreparationDraft | null = null;

  if (stage3Status === 'PASSED') {
    const prepEligibility = evaluateListingPreparation(item, []);
    if (!prepEligibility.canPrepareAny) {
      stage4Status = 'BLOCKED';
      stage4ReasonCode = 'HOLD_LISTING_PREP_BLOCKED';
      stage4MessageJa = prepEligibility.blockedReasonsJa.join(' ') || '出品準備の前提条件を満たしていません。';
      stage4NextActionJa = '中央在庫の販売可能数量および同期状態を確認してください。';
    } else {
      stage4Status = 'PASSED';
      stage4ReasonCode = 'DRAFT_CREATED_IN_MEMORY';
      stage4MessageJa = `eBay / Shopee 向けの出品準備下書きをメモリ上に安全に作成しました（実DB未書込）。`;
      stage4NextActionJa = '出品ドラフトの必須項目（タイトル・説明・価格・配送条件）を入力・検証してください。';

      const priceAmount = scenarioType === 'DRAFT_REVIEW_MISSING_PRICE' ? 0 : 185;

      simulatedDraft = {
        draftId: `draft-sim-${sku}-eBay`,
        sku,
        itemTitle: item.itemTitle,
        targetChannel: 'eBay',
        sellerAccountId: 'jp_treasure_hunting_official',
        listingTitle: 'Vintage SLR Camera Japan Mint Condition Tested',
        listingDescription: 'Authentic vintage Japanese SLR camera in excellent working condition. Thoroughly inspected with 4-angle high resolution QA photos.',
        priceAmount,
        priceCurrency: 'USD',
        shippingTerms: 'DHL Express / FedEx Priority with full tracking & signature',
        status: 'DRAFT_REVIEW_REQUIRED',
        availableToSellAtCreation: item.availableToSell,
        unitCostJpyAtCreation: item.unitCostJpy,
        createdAt: simulatedAt,
        updatedAt: simulatedAt,
        source: 'INVENTORY_SALES_WORKBENCH',
        ...options.draftOverrides
      };
    }
  }

  const stage4Detail: ListingPipelineStageDetail<{ draft: ListingPreparationDraft | null }> = {
    stageName: 'LISTING_PREPARATION',
    displayNameJa: '出品準備下書き (Listing Preparation)',
    status: stage4Status,
    reasonCode: stage4ReasonCode,
    reasonMessageJa: stage4MessageJa,
    nextActionJa: stage4NextActionJa,
    stageData: { draft: simulatedDraft }
  };

  // =========================================================================
  // Stage 5: Listing Draft Review Simulation (下書き項目・写真制約検証)
  // =========================================================================
  let stage5Status: PipelineStageStatus = 'NOT_REACHED';
  let stage5ReasonCode = 'STAGE_NOT_REACHED';
  let stage5MessageJa = '出品準備下書きが作成されていないため、ドラフトレビューへ到達していません。';
  let stage5NextActionJa = '出品準備下書きを作成してください。';
  let draftReadiness: ListingDraftReadiness | null = null;
  let draftPhotoPreview: DraftPhotoPreviewSummary | null = null;
  let finalReviewDraft: ListingPreparationDraft | null = null;

  if (stage4Status === 'PASSED' && simulatedDraft) {
    draftReadiness = evaluateListingDraftReadiness(simulatedDraft, item);
    draftPhotoPreview = resolveDraftPhotoPreview(simulatedDraft, handoffResult);

    if (!draftReadiness.canAdvanceToFinalReview) {
      stage5Status = 'HOLD';
      stage5ReasonCode = 'HOLD_DRAFT_REVIEW_INCOMPLETE';
      stage5MessageJa = draftReadiness.missingOrInvalidFieldsJa.join(' ') || draftReadiness.blockingReasonsJa.join(' ');
      stage5NextActionJa = '未入力または不正な下書き項目（価格・配送条件など）を修正してください。';
    } else {
      stage5Status = 'PASSED';
      stage5ReasonCode = 'ADVANCED_TO_FINAL_REVIEW';
      stage5MessageJa = '下書きの社内入力項目および写真候補プレビュー（Hero/Gallery）が検証合格し、最終確認待ちへ移行しました。';
      stage5NextActionJa = 'Marketplaceポリシーと販売アカウント実在を確認し、Listing Publish Gateの承認へ進んでください。';

      finalReviewDraft = {
        ...simulatedDraft,
        status: 'READY_FOR_FINAL_REVIEW'
      };
    }
  }

  const stage5Detail: ListingPipelineStageDetail<{ readiness: ListingDraftReadiness | null; photoPreview: DraftPhotoPreviewSummary | null }> = {
    stageName: 'LISTING_DRAFT_REVIEW',
    displayNameJa: '出品ドラフト確認 (Listing Draft Review)',
    status: stage5Status,
    reasonCode: stage5ReasonCode,
    reasonMessageJa: stage5MessageJa,
    nextActionJa: stage5NextActionJa,
    stageData: { readiness: draftReadiness, photoPreview: draftPhotoPreview }
  };

  // =========================================================================
  // Stage 6: Listing Publish Gate Simulation (出品前審査・公開適格性検証)
  // =========================================================================
  let stage6Status: PipelineStageStatus = 'NOT_REACHED';
  let stage6ReasonCode = 'STAGE_NOT_REACHED';
  let stage6MessageJa = 'ドラフトの最終確認が完了していないため、Listing Publish Gateへ到達していません。';
  let stage6NextActionJa = '出品ドラフトのレビューを完了させてください。';
  let publishGateEvaluation: ListingPublishGateEvaluation | null = null;
  let overallListingEligible = false;

  if (stage5Status === 'PASSED' && finalReviewDraft && publishGateInput) {
    publishGateEvaluation = evaluateListingPublishGate(finalReviewDraft, item, publishGateInput);

    // CRITICAL SAFETY CHECK: Non-photo gates on unit MUST all be true
    const nonPhotoGatesSatisfied =
      unit.sellableGate.identityVerified &&
      unit.sellableGate.quantityVerified &&
      unit.sellableGate.conditionVerified &&
      unit.sellableGate.storageLocationRegistered;

    if (!publishGateEvaluation.canRecordApproval) {
      stage6Status = 'HOLD';
      stage6ReasonCode = 'HOLD_PUBLISH_GATE_INCOMPLETE';
      stage6MessageJa = publishGateEvaluation.missingOrInvalidFieldsJa.join(' ') || publishGateEvaluation.blockingReasonsJa.join(' ');
      stage6NextActionJa = '販売アカウント確認、Marketplace最新ルールURL、最終承認者の入力を完了させてください。';
    } else if (!nonPhotoGatesSatisfied) {
      // Photo gates passed, publish form passed, but physical inventory non-photo gates are incomplete!
      stage6Status = 'HOLD';
      stage6ReasonCode = 'HOLD_NON_PHOTO_GATES_INCOMPLETE';
      stage6MessageJa = '写真ゲートおよびドラフト審査は合格ですが、商品個体の非写真ゲート（検品・数量・保管場所）が未達です。全体の出品適格性は保持(HOLD)されます。';
      stage6NextActionJa = '在庫管理側で個体の検品完了および保管場所登録を完了させてください。';
      overallListingEligible = false;
    } else {
      stage6Status = 'PASSED';
      stage6ReasonCode = 'READY_FOR_PUBLISH_ACTION';
      stage6MessageJa = '写真撮影から出品前審査までの全工程が安全に検証合格しました（※シミュレーションのため外部API送信は未実行）。';
      stage6NextActionJa = '全工程が検証合格しました。本番出品時は管理者の最終承認のもと、安全に公開を実行してください。';
      overallListingEligible = true;
    }
  }

  const stage6Detail: ListingPipelineStageDetail<{ evaluation: ListingPublishGateEvaluation | null }> = {
    stageName: 'LISTING_PUBLISH_GATE',
    displayNameJa: '出品前審査ゲート (Listing Publish Gate)',
    status: stage6Status,
    reasonCode: stage6ReasonCode,
    reasonMessageJa: stage6MessageJa,
    nextActionJa: stage6NextActionJa,
    stageData: { evaluation: publishGateEvaluation }
  };

  // Find first blocking stage if any
  const stagesList = [stage1Detail, stage2Detail, stage3Detail, stage4Detail, stage5Detail, stage6Detail];
  const blocking = stagesList.find((s) => s.status === 'HOLD' || s.status === 'BLOCKED');

  const overallSuccess = stagesList.every((s) => s.status === 'PASSED') && overallListingEligible;

  const summaryJa = overallSuccess
    ? `🎉 【E2E一括検証 成功】写真撮影から在庫ゲート、ドラフト候補生成、出品前審査までの全6工程が合格しました。(SKU: ${sku}, Unit: ${inventoryUnitId})`
    : `⚠️ 【E2E一括検証 保留】工程 [${blocking?.displayNameJa || '未達'}] にて安全上の保留 (${blocking?.reasonCode}) が発生しました: ${blocking?.reasonMessageJa}`;

  return {
    isSimulation: true,
    simulatedAt,
    scenarioType,
    sku,
    inventoryUnitId,
    overallSuccess,
    overallListingEligible,
    blockingStage: blocking?.stageName,
    stages: {
      photoCapture: stage1Detail,
      inventoryGate: stage2Detail,
      photoHandoff: stage3Detail,
      listingPreparation: stage4Detail,
      draftReview: stage5Detail,
      publishGate: stage6Detail
    },
    summaryJa,
    hardwareStatus: 'HARDWARE_PENDING'
  };
}
