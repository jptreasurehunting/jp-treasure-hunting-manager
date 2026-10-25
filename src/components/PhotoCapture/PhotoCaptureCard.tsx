import React, { useState, useEffect, useRef } from 'react';
import {
  PhotoAngle,
  CapturedPhoto,
  REQUIRED_ANGLES,
  AngleGuide,
  PedalTriggerConfig,
  PhotoCaptureTargetContext
} from '../../types/photoCapture';
import {
  applyAutoFixToPhoto,
  VirtualMockCameraAdapter,
  PedalInputListener,
  generateMockImageDataUrl,
  ICameraHardwareAdapter,
  executePhotoCaptureFlow,
  evaluatePhotoInventoryLinkage,
  checkPhotoGateCompletion,
  MockInventoryPhotoGateBridge
} from '../../services/photoCaptureService';
import { CentralInventoryPhotoAdapter } from '../../services/centralInventoryPhotoAdapter';
import { evaluatePhotoListingHandoff } from '../../services/photoListingBridgeService';
import {
  PhotoCaptureStashService,
  globalPhotoCaptureStashService,
  StashSessionSummary
} from '../../services/photoCaptureStashService';
import {
  InventoryPhotoGateSyncResult,
  PhotoGateDryRunPreview,
  DryRunListingPhotoHandoff
} from '../../types/photoCapture';

export interface TargetContextPreset {
  id: string;
  label: string;
  context: PhotoCaptureTargetContext;
}

export const TARGET_CONTEXT_PRESETS: TargetContextPreset[] = [
  {
    id: 'NONE',
    label: '【未選択 / 紐付け保留中】(UNLINKED_HOLD)',
    context: { isConfirmed: false, sku: '', inventoryUnitId: '', itemTitle: '未選択' }
  },
  {
    id: 'MOCK_E2E',
    label: 'MOCK-E2E-CAM-001 | ビンテージ一眼レフカメラ (UNIT-CAM-001-A)',
    context: {
      sku: 'MOCK-E2E-CAM-001',
      inventoryUnitId: 'MOCK-UNIT-CAM-001-A',
      itemTitle: '【模擬テスト】ビンテージ一眼レフカメラ E2E検証個体',
      serialNumber: 'SN-E2E-998811',
      isConfirmed: true
    }
  },
  {
    id: 'WATCH_STRAP',
    label: 'SKU-WATCH-STRAP-01 | 本革NATOストラップ 20mm (UNIT-2026-0042)',
    context: {
      sku: 'SKU-WATCH-STRAP-01',
      inventoryUnitId: 'UNIT-2026-0042',
      itemTitle: '本革NATOストラップ 20mm ダークブラウン',
      serialNumber: 'STRAP-BROWN-042',
      isConfirmed: true
    }
  },
  {
    id: 'SEIKO_5',
    label: 'SKU-VINTAGE-SEIKO-01 | セイコー 5 アクタス 自動巻 (UNIT-2026-0089)',
    context: {
      sku: 'SKU-VINTAGE-SEIKO-01',
      inventoryUnitId: 'UNIT-2026-0089',
      itemTitle: 'セイコー 5 アクタス 自動巻 1974年製',
      serialNumber: '4D1289',
      isConfirmed: true
    }
  },
  {
    id: 'LEICA_LENS',
    label: 'SKU-CAMERA-LENS-01 | ズミクロン 50mm F2 3rd (UNIT-2026-0105)',
    context: {
      sku: 'SKU-CAMERA-LENS-01',
      inventoryUnitId: 'UNIT-2026-0105',
      itemTitle: 'ライカ ズミクロン 50mm F2 第3世代',
      serialNumber: '3201058',
      isConfirmed: true
    }
  }
];

interface SwitchConfirmModalState {
  isOpen: boolean;
  pendingContext: PhotoCaptureTargetContext | null;
  currentPhotoCount: number;
  currentUsableCount: number;
  mode: 'CONFIRM_STASH_OR_DISCARD' | 'CONFIRM_DISCARD_FINAL' | 'UNCONFIRMED_WARN';
  errorMessage?: string | null;
}

interface PhotoCaptureCardProps {
  isTabActive?: boolean;
  cameraAdapter?: ICameraHardwareAdapter;
  targetContext?: PhotoCaptureTargetContext;
  existingRegisteredUnitIds?: string[];
  inventoryBridge?: MockInventoryPhotoGateBridge;
  integrationAdapter?: CentralInventoryPhotoAdapter;
  stashService?: PhotoCaptureStashService;
  onPhotoGateEvaluated?: (gate: { photoCaptureComplete: boolean; photoQaComplete: boolean }) => void;
  onSyncToInventory?: (result: InventoryPhotoGateSyncResult) => void;
  onListingHandoffEvaluated?: (handoff: DryRunListingPhotoHandoff) => void;
}

export const PhotoCaptureCard: React.FC<PhotoCaptureCardProps> = ({
  isTabActive = true,
  cameraAdapter,
  targetContext,
  existingRegisteredUnitIds,
  inventoryBridge,
  integrationAdapter,
  stashService,
  onPhotoGateEvaluated,
  onSyncToInventory,
  onListingHandoffEvaluated
}) => {
  // Stash Service Instance (Isolated or Global Singleton)
  const activeStashService = stashService || globalPhotoCaptureStashService;

  // State & Ref variables
  const [currentAngleIndex, setCurrentAngleIndex] = useState<number>(0);
  const [capturedPhotos, setCapturedPhotos] = useState<Record<PhotoAngle, CapturedPhoto | null>>({
    FRONT: null,
    BACK: null,
    LEFT: null,
    RIGHT: null,
    TOP: null,
    LABEL_TAG: null,
    DEFECT_DETAIL: null
  });

  const [activeTargetContext, setActiveTargetContext] = useState<PhotoCaptureTargetContext>(
    targetContext || TARGET_CONTEXT_PRESETS[0].context
  );

  const [switchModal, setSwitchModal] = useState<SwitchConfirmModalState>({
    isOpen: false,
    pendingContext: null,
    currentPhotoCount: 0,
    currentUsableCount: 0,
    mode: 'CONFIRM_STASH_OR_DISCARD',
    errorMessage: null
  });

  const [stashedSummaries, setStashedSummaries] = useState<StashSessionSummary[]>(() =>
    activeStashService.listSummaries()
  );
  const [showStashDrawer, setShowStashDrawer] = useState<boolean>(false);

  // Auto-restore on mount if active context has stashed data
  useEffect(() => {
    if (activeTargetContext && activeTargetContext.isConfirmed && activeStashService.hasStash(activeTargetContext)) {
      const hasLocalPhotos = Object.values(capturedPhotos).some((p) => p !== null);
      if (!hasLocalPhotos) {
        const res = activeStashService.restorePhotos(activeTargetContext);
        if (res.success && res.session) {
          setCapturedPhotos(res.session.capturedPhotos);
          setCurrentAngleIndex(res.session.currentAngleIndex);
          setDryRunPreview(res.session.dryRunPreview);
          setShowPreviewPanel(Boolean(res.session.dryRunPreview));
          setListingHandoff(res.session.listingHandoff);
          setShowListingPanel(Boolean(res.session.listingHandoff));
          setStatusMessage(res.messageJa);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (targetContext) {
      setActiveTargetContext(targetContext);
    }
  }, [targetContext]);

  // Internal helper to apply a context switch with restore or clean reset
  const applyContextSwitch = (newContext: PhotoCaptureTargetContext) => {
    if (newContext.isConfirmed && activeStashService.hasStash(newContext)) {
      const restoreResult = activeStashService.restorePhotos(newContext);
      if (restoreResult.success && restoreResult.session) {
        setCapturedPhotos(restoreResult.session.capturedPhotos);
        setCurrentAngleIndex(restoreResult.session.currentAngleIndex);
        setDryRunPreview(restoreResult.session.dryRunPreview);
        setShowPreviewPanel(Boolean(restoreResult.session.dryRunPreview));
        setListingHandoff(restoreResult.session.listingHandoff);
        setShowListingPanel(Boolean(restoreResult.session.listingHandoff));
        setStatusMessage(restoreResult.messageJa);
        setActiveTargetContext(newContext);
        setStashedSummaries(activeStashService.listSummaries());
        return;
      }
    }

    // Clean reset for new context (no existing stash)
    setCapturedPhotos({
      FRONT: null,
      BACK: null,
      LEFT: null,
      RIGHT: null,
      TOP: null,
      LABEL_TAG: null,
      DEFECT_DETAIL: null
    });
    setCurrentAngleIndex(0);
    setDryRunPreview(null);
    setShowPreviewPanel(false);
    setListingHandoff(null);
    setShowListingPanel(false);
    setStatusMessage(
      newContext.isConfirmed
        ? `🔄 撮影対象を【${newContext.sku} (${newContext.inventoryUnitId})】に切り替えました。`
        : '⚠️ 撮影対象を未選択に設定しました。紐付け保留（UNLINKED_HOLD）状態です。'
    );
    setActiveTargetContext(newContext);
    setStashedSummaries(activeStashService.listSummaries());
  };

  // Safe Context Switch Handler with Unsaved Photo Protection & Modal Guard
  const handleSwitchTargetContext = (newContext: PhotoCaptureTargetContext) => {
    const isDifferent =
      newContext.sku !== activeTargetContext.sku ||
      newContext.inventoryUnitId !== activeTargetContext.inventoryUnitId;

    if (!isDifferent) {
      // Re-selecting same context is idempotent, keep current photos untouched
      return;
    }

    const currentNonNullPhotos = Object.values(capturedPhotos).filter((p) => p !== null);
    const photoCount = currentNonNullPhotos.length;

    if (photoCount === 0) {
      // No unsaved photos in current context, switch directly
      applyContextSwitch(newContext);
      return;
    }

    // Unsaved photos exist! Do NOT silently erase. Open safe selection modal.
    const usableCount = currentNonNullPhotos.filter((p) => p.qaResult.status === 'USE_AS_IS').length;
    if (!activeTargetContext.isConfirmed) {
      setSwitchModal({
        isOpen: true,
        pendingContext: newContext,
        currentPhotoCount: photoCount,
        currentUsableCount: usableCount,
        mode: 'UNCONFIRMED_WARN',
        errorMessage: null
      });
    } else {
      setSwitchModal({
        isOpen: true,
        pendingContext: newContext,
        currentPhotoCount: photoCount,
        currentUsableCount: usableCount,
        mode: 'CONFIRM_STASH_OR_DISCARD',
        errorMessage: null
      });
    }
  };

  // Modal Action: Stash and Switch (Recommended)
  const handleModalStashAndSwitch = () => {
    const stashRes = activeStashService.stashPhotos({
      targetContext: activeTargetContext,
      capturedPhotos,
      currentAngleIndex,
      dryRunPreview,
      listingHandoff
    });

    if (!stashRes.success) {
      // Stash failed (e.g. capacity exceeded or integrity issue): STOP switch, do not erase!
      setSwitchModal((prev) => ({
        ...prev,
        errorMessage: stashRes.messageJa
      }));
      return;
    }

    const pending = switchModal.pendingContext!;
    setSwitchModal({
      isOpen: false,
      pendingContext: null,
      currentPhotoCount: 0,
      currentUsableCount: 0,
      mode: 'CONFIRM_STASH_OR_DISCARD',
      errorMessage: null
    });
    applyContextSwitch(pending);
  };

  // Modal Action: Cancel Switch
  const handleModalCancel = () => {
    setSwitchModal({
      isOpen: false,
      pendingContext: null,
      currentPhotoCount: 0,
      currentUsableCount: 0,
      mode: 'CONFIRM_STASH_OR_DISCARD',
      errorMessage: null
    });
    setStatusMessage('ℹ️ 商品の切り替えをキャンセルし、現在の撮影セッションを保持しました。');
  };

  // Modal Action: Prompt Explicit Discard Confirmation
  const handleModalPromptDiscard = () => {
    setSwitchModal((prev) => ({
      ...prev,
      mode: 'CONFIRM_DISCARD_FINAL',
      errorMessage: null
    }));
  };

  // Modal Action: Execute Discard and Switch
  const handleModalExecuteDiscard = () => {
    const pending = switchModal.pendingContext!;
    setSwitchModal({
      isOpen: false,
      pendingContext: null,
      currentPhotoCount: 0,
      currentUsableCount: 0,
      mode: 'CONFIRM_STASH_OR_DISCARD',
      errorMessage: null
    });
    applyContextSwitch(pending);
    setStatusMessage(`⚠️ 【${activeTargetContext.sku}】の未保存写真を破棄し、【${pending.sku || '未選択'}】に切り替えました。`);
  };

  // Drawer Action: Discard stashed entry
  const handleDiscardStashedSession = (sku: string, unitId: string) => {
    activeStashService.discardStashedSession(sku, unitId);
    setStashedSummaries(activeStashService.listSummaries());
    setStatusMessage(`🗑️ 【${sku} (${unitId})】の一時退避データを破棄しました。`);
  };

  // Drawer Action: Resume stashed session directly
  const handleResumeFromDrawer = (summary: StashSessionSummary) => {
    const target = TARGET_CONTEXT_PRESETS.find(
      (p) => p.context.sku === summary.sku && p.context.inventoryUnitId === summary.inventoryUnitId
    )?.context || {
      sku: summary.sku,
      inventoryUnitId: summary.inventoryUnitId,
      itemTitle: summary.itemTitle,
      isConfirmed: true
    };
    handleSwitchTargetContext(target);
    setShowStashDrawer(false);
  };

  const [pedalConfig, setPedalConfig] = useState<PedalTriggerConfig>({
    enabled: true,
    triggerKey: 'Space',
    keyLabel: 'Space キー / フットペダル',
    isTabActive
  });

  const [simulatedPreset, setSimulatedPreset] = useState<'GOOD' | 'BLURRY' | 'DARK' | 'GLARE'>('GOOD');
  const [isPedalPressedAnimation, setIsPedalPressedAnimation] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('商品を配置し、フットペダル（Spaceキー）または撮影ボタンを押してください。');
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [evidenceViewMode, setEvidenceViewMode] = useState<'CORRECTED' | 'ORIGINAL'>('CORRECTED');
  const [dryRunPreview, setDryRunPreview] = useState<PhotoGateDryRunPreview | null>(null);
  const [showPreviewPanel, setShowPreviewPanel] = useState<boolean>(false);
  const [listingHandoff, setListingHandoff] = useState<DryRunListingPhotoHandoff | null>(null);
  const [showListingPanel, setShowListingPanel] = useState<boolean>(false);

  // Synchronous lock ref to prevent race conditions during rapid key events
  const isCapturingRef = useRef<boolean>(false);

  const currentAngleGuide: AngleGuide = REQUIRED_ANGLES[currentAngleIndex];
  const activePhoto = capturedPhotos[currentAngleGuide.angle];

  // Evaluate linkage safety & Sellable Inventory Gate alignment
  const linkage = evaluatePhotoInventoryLinkage(activeTargetContext, existingRegisteredUnitIds);
  const gateStatus = checkPhotoGateCompletion(capturedPhotos);

  useEffect(() => {
    onPhotoGateEvaluated?.({
      photoCaptureComplete: gateStatus.photoCaptureComplete,
      photoQaComplete: gateStatus.photoQaComplete
    });
  }, [capturedPhotos, onPhotoGateEvaluated]);

  // Keep pedalConfig isTabActive in sync
  useEffect(() => {
    setPedalConfig((prev) => ({ ...prev, isTabActive }));
  }, [isTabActive]);

  // Setup foot pedal key listener
  useEffect(() => {
    const pedalListener = new PedalInputListener(pedalConfig, () => {
      handlePedalTrigger();
    });

    pedalListener.startListening();
    return () => {
      pedalListener.stopListening();
    };
  }, [pedalConfig, currentAngleIndex, simulatedPreset]);

  // Main Photo Capture Action with Synchronous Ref Lock & Error Handling
  const handlePedalTrigger = async () => {
    setIsPedalPressedAnimation(true);
    setTimeout(() => setIsPedalPressedAnimation(false), 400);

    const adapter = cameraAdapter || new VirtualMockCameraAdapter();
    await executePhotoCaptureFlow({
      isCapturingRef,
      currentAngle: currentAngleGuide.angle,
      simulatedPreset,
      adapter,
      existingPhotos: capturedPhotos,
      sku: activeTargetContext?.sku,
      inventoryUnitId: activeTargetContext?.inventoryUnitId,
      targetContext: activeTargetContext,
      onStateUpdate: (update) => {
        if (update.isCapturing !== undefined) setIsCapturing(update.isCapturing);
        if (update.capturedPhotos !== undefined) setCapturedPhotos(update.capturedPhotos);
        if (update.statusMessage !== undefined) setStatusMessage(update.statusMessage);
      }
    });
  };

  // Auto-Fix handler with real image transformation & re-QA
  const handleApplyAutoFix = () => {
    if (!activePhoto || activePhoto.qaResult.status !== 'AUTO_FIX' || isCapturingRef.current) return;

    isCapturingRef.current = true;
    setIsCapturing(true);
    try {
      const fixedPhoto = applyAutoFixToPhoto(activePhoto);
      setCapturedPhotos((prev) => ({
        ...prev,
        [currentAngleGuide.angle]: fixedPhoto
      }));

      if (fixedPhoto.qaResult.status === 'USE_AS_IS') {
        setStatusMessage('✨ 実画像への補正処理および再QA検査に合格し、合格品質（USE_AS_IS）へ昇格しました！');
      } else if (fixedPhoto.qaResult.status === 'RETAKE') {
        setStatusMessage('❌ 画像自動補正を実行しましたが再QA検査でエラー（RETAKE）となりました。再撮影が必要です。');
      } else {
        setStatusMessage('⚠️ 画像補正を試みましたが警告が解消されなかったため、AUTO_FIX 状態を保持しました。手動調整または再撮影を推奨します。');
      }
    } catch (err: any) {
      setStatusMessage(`❌ 自動補正処理中にエラーが発生しました: ${err?.message || '不明なエラー'}`);
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  };

  // Move to next angle
  const handleNextAngle = () => {
    if (currentAngleIndex < REQUIRED_ANGLES.length - 1) {
      setCurrentAngleIndex((prev) => prev + 1);
      setEvidenceViewMode('CORRECTED');
      setStatusMessage(`次の撮影角度【${REQUIRED_ANGLES[currentAngleIndex + 1].labelJa}】に移動しました。`);
    }
  };

  // Select angle directly
  const handleSelectAngle = (idx: number) => {
    setCurrentAngleIndex(idx);
    setEvidenceViewMode('CORRECTED');
  };

  // Manual trigger to generate Dry Run preview
  const handleGenerateDryRun = () => {
    if (!activeTargetContext || !activeTargetContext.isConfirmed) {
      setStatusMessage('⚠️ 撮影対象コンテキストが未確定のため Dry Run を生成できません。');
      return;
    }
    const adapter = integrationAdapter || new CentralInventoryPhotoAdapter({ existingRegisteredUnitIds });
    const preview = adapter.generateDryRunPreview(activeTargetContext, capturedPhotos);
    setDryRunPreview(preview);
    setShowPreviewPanel(true);
    setStatusMessage(`🔍 Dry Run プレビュー: [${preview.reasonCode}] ${preview.reasonMessageJa}`);
  };

  // Manual trigger to generate Listing Preparation Photo Handoff Preview
  const handleGenerateListingHandoff = () => {
    if (!activeTargetContext || !activeTargetContext.isConfirmed) {
      setStatusMessage('⚠️ 撮影対象コンテキストが未確定のため出品準備プレビューを生成できません。');
      return;
    }
    const handoff = evaluatePhotoListingHandoff({
      targetContext: activeTargetContext,
      capturedPhotos,
      existingRegisteredUnitIds
    });
    setListingHandoff(handoff);
    setShowListingPanel(true);
    onListingHandoffEvaluated?.(handoff);
    setStatusMessage(`📦 出品準備プレビュー: [${handoff.reasonCode}] ${handoff.reasonMessageJa}`);
  };

  // Manual trigger to sync photo gate to mock inventory unit
  const handleSyncToInventory = () => {
    if (!activeTargetContext) return;
    if (integrationAdapter) {
      const execResult = integrationAdapter.executeSafeIntegration(activeTargetContext, capturedPhotos);
      setDryRunPreview(execResult.preview);
      onSyncToInventory?.({
        success: execResult.success,
        status: execResult.preview.canApply ? 'UPDATED' : 'HOLD_BLOCKED',
        unit: execResult.committedUnit,
        messageJa: execResult.messageJa,
        photoCaptureComplete: execResult.preview.gateDiff?.photoCaptureComplete.after ?? false,
        photoQaComplete: execResult.preview.gateDiff?.photoQaComplete.after ?? false
      });
      setStatusMessage(execResult.messageJa);
    } else if (inventoryBridge) {
      const result = inventoryBridge.syncPhotoGate(activeTargetContext, capturedPhotos);
      onSyncToInventory?.(result);
      setStatusMessage(result.messageJa);
    } else {
      setStatusMessage('ℹ️ モック在庫ブリッジが未設定のため、UIシミュレーションのみ実行されました。');
    }
  };

  // Calculate overall completion summary: ONLY count photos with status USE_AS_IS
  const completedCount = Object.values(capturedPhotos).filter((p) => p !== null && p.qaResult.status === 'USE_AS_IS').length;
  const requiredCount = REQUIRED_ANGLES.filter((a) => a.isRequired).length;
  const passedRequiredCount = REQUIRED_ANGLES.filter(
    (a) => a.isRequired && capturedPhotos[a.angle] !== null && capturedPhotos[a.angle]?.qaResult.status === 'USE_AS_IS'
  ).length;

  return (
    <div className="photo-capture-container" style={{ padding: '1rem', color: '#f8fafc' }}>
      {/* Header Bar */}
      <div className="card-header space-between" style={{ background: '#1e293b', padding: '1rem 1.25rem', borderRadius: '12px 12px 0 0', borderBottom: '1px solid #334155' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(59,130,246,0.15)', color: '#38bdf8', padding: '0.6rem', borderRadius: '10px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc' }}>
              Pedal-Assisted Photo Capture &amp; Automated Photo QA MVP
            </h2>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
              フットペダル連動高速撮影 &amp; 写真品質（USE_AS_IS / AUTO_FIX / RETAKE）自動評価ゲート
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '20px', background: pedalConfig.enabled && isTabActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: pedalConfig.enabled && isTabActive ? '#34d399' : '#f87171', border: '1px solid rgba(52,211,153,0.3)', fontWeight: 600 }}>
            🦶 ペダル連動: {pedalConfig.triggerKey} {isTabActive ? '(有効)' : '(他タブ停止中)'}
          </span>
          {/* Explicit Status for Hardware Validation Pending */}
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: '#090d16', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontWeight: 600 }}>
            📷 HARDWARE_PENDING (モック動作中)
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '6px', fontWeight: 600 }}>
            🛡️ Mock / Dry Run
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontWeight: 600 }}>
            🚫 Publish Disabled
          </span>
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '6px', fontWeight: 600 }} title="正式永続化（Evidence Vault）は現在モック検証段階であり、実ディスクへの保存は未接続です">
            🏛️ Evidence Vault: 設計・検証中 (In-Memory Mock)
          </span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0 0 12px 12px', border: '1px solid #334155', borderTop: 'none' }}>
        {/* Step 0: Target Context Header (商品カタログ番号 vs 実物個体管理番号 分離表示) */}
        <div style={{ background: '#1e293b', padding: '0.85rem 1.15rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>商品カタログ番号 (SKU)</span>
                <strong style={{ fontSize: '0.95rem', color: activeTargetContext?.sku ? '#38bdf8' : '#64748b' }}>
                  {activeTargetContext?.sku || '未指定 (HOLD)'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>商品名</span>
                <span style={{ fontSize: '0.9rem', color: '#f8fafc', fontWeight: 600 }}>
                  {activeTargetContext?.itemTitle || '未登録'}
                </span>
              </div>
              <div style={{ borderLeft: '1px solid #475569', paddingLeft: '1.25rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>実物個体管理番号 (Unit ID)</span>
                <strong style={{ fontSize: '0.95rem', color: activeTargetContext?.inventoryUnitId ? '#34d399' : '#64748b' }}>
                  {activeTargetContext?.inventoryUnitId || '未指定 (HOLD)'}
                </strong>
              </div>
              {activeTargetContext?.serialNumber && (
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>個体刻印シリアル</span>
                  <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                    {activeTargetContext.serialNumber}
                  </span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  background:
                    linkage.status === 'LINKED_STAGED'
                      ? 'rgba(16,185,129,0.2)'
                      : linkage.status === 'ALREADY_REGISTERED'
                      ? 'rgba(239,68,68,0.2)'
                      : 'rgba(245,158,11,0.2)',
                  color:
                    linkage.status === 'LINKED_STAGED'
                      ? '#34d399'
                      : linkage.status === 'ALREADY_REGISTERED'
                      ? '#f87171'
                      : '#fbbf24',
                  border:
                    linkage.status === 'LINKED_STAGED'
                      ? '1px solid #10b981'
                      : linkage.status === 'ALREADY_REGISTERED'
                      ? '1px solid #ef4444'
                      : '1px solid #f59e0b'
                }}
              >
                {linkage.status === 'LINKED_STAGED' && '🟢 紐付け確定 (LINKED_STAGED)'}
                {linkage.status === 'ALREADY_REGISTERED' && '🚫 登録済み (ALREADY_REGISTERED)'}
                {linkage.status === 'UNLINKED_HOLD' && '⚠️ 紐付け保留中 (UNLINKED_HOLD)'}
                {linkage.status === 'MISMATCH_ERROR' && '❌ 個体不一致 (MISMATCH_ERROR)'}
              </span>

              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  background: gateStatus.photoQaComplete ? 'rgba(16,185,129,0.2)' : '#1e293b',
                  color: gateStatus.photoQaComplete ? '#34d399' : '#94a3b8',
                  border: gateStatus.photoQaComplete ? '1px solid #10b981' : '1px solid #475569'
                }}
              >
                Gate 要件: {gateStatus.photoQaComplete ? '合格 (PASS)' : `未達 (${gateStatus.passedRequiredAngles.length}/4)`}
              </span>

              <button
                type="button"
                onClick={handleGenerateDryRun}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  background: '#1e293b',
                  color: '#38bdf8',
                  border: '1px solid #0284c7',
                  cursor: 'pointer'
                }}
                title="実在庫DBへ書き込まず、差分と理由コードを事前プレビューします"
              >
                🔍 Dry Run プレビュー
              </button>

              <button
                type="button"
                onClick={handleGenerateListingHandoff}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  fontWeight: 700,
                  background: '#1e293b',
                  color: '#c084fc',
                  border: '1px solid #9333ea',
                  cursor: 'pointer'
                }}
                title="本番出品や在庫DBを変更せず、出品ドラフト用写真候補とゲート状態を事前プレビューします"
              >
                📦 出品準備プレビュー
              </button>

              {gateStatus.photoQaComplete && linkage.status === 'LINKED_STAGED' && (
                <button
                  type="button"
                  onClick={handleSyncToInventory}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.65rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  🔄 在庫ゲートへ写真合格を反映 (Mock Sync)
                </button>
              )}
            </div>
          </div>

          {/* Target Context Quick Selector Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid rgba(148, 163, 184, 0.15)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>撮影対象の選択:</span>
            <select
              value={
                TARGET_CONTEXT_PRESETS.find(
                  (p) => p.context.sku === activeTargetContext?.sku && p.context.inventoryUnitId === activeTargetContext?.inventoryUnitId
                )?.id || 'NONE'
              }
              onChange={(e) => {
                const preset = TARGET_CONTEXT_PRESETS.find((p) => p.id === e.target.value);
                if (preset) {
                  handleSwitchTargetContext(preset.context);
                }
              }}
              style={{
                background: '#0f172a',
                color: '#f8fafc',
                border: '1px solid #475569',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              {TARGET_CONTEXT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>

            {activeTargetContext?.isConfirmed && (
              <button
                type="button"
                onClick={() => handleSwitchTargetContext(TARGET_CONTEXT_PRESETS[0].context)}
                style={{
                  background: 'none',
                  border: '1px solid #64748b',
                  color: '#94a3b8',
                  borderRadius: '4px',
                  padding: '3px 8px',
                  fontSize: '0.72rem',
                  cursor: 'pointer'
                }}
              >
                ✕ 選択解除 (HOLDへ)
              </button>
            )}

            {/* Stash Drawer Toggle Button */}
            <button
              type="button"
              onClick={() => setShowStashDrawer(!showStashDrawer)}
              style={{
                background: stashedSummaries.length > 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(51, 65, 85, 0.4)',
                color: stashedSummaries.length > 0 ? '#60a5fa' : '#94a3b8',
                border: stashedSummaries.length > 0 ? '1px solid #3b82f6' : '1px solid #475569',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem'
              }}
              title="メモリ内一時退避セッション一覧を表示"
            >
              <span>💾</span>
              <span>一時退避中: {stashedSummaries.length} 個体</span>
              <span style={{ fontSize: '0.7rem' }}>{showStashDrawer ? '▲ 閉じる' : '▼ 一覧'}</span>
            </button>

            <div style={{ marginLeft: 'auto' }}>
              <a
                href="./inventory-sales.html"
                style={{
                  fontSize: '0.75rem',
                  color: '#93c5fd',
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <span>📦</span> 在庫販売ワークベンチを開く ↗
              </a>
            </div>
          </div>

          {/* Stash Drawer Panel */}
          {showStashDrawer && (
            <div
              style={{
                marginTop: '0.75rem',
                padding: '0.75rem 1rem',
                background: '#0a0f1d',
                border: '1px solid #2563eb',
                borderRadius: '8px',
                fontSize: '0.8rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontWeight: 700, color: '#60a5fa' }}>
                  💾 メモリ内一時退避セッション一覧（{stashedSummaries.length} 個体）
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  上限: {activeStashService.maxEntries} 個体
                </span>
              </div>

              {stashedSummaries.length === 0 ? (
                <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.78rem' }}>
                  現在一時退避されている写真データはありません。撮影途中で商品・個体を切り替えると自動退避されます。
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {stashedSummaries.map((s) => (
                    <div
                      key={s.stashKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: '#1e293b',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #334155',
                        flexWrap: 'wrap',
                        gap: '0.5rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>
                          {s.sku} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({s.inventoryUnitId})</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#cbd5e1' }}>
                          写真: {s.photoCount} 枚（合格: {s.usableCount} 枚） | 退避日時: {new Date(s.stashedAt).toLocaleTimeString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          type="button"
                          onClick={() => handleResumeFromDrawer(s)}
                          style={{
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          🔄 撮影再開
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscardStashedSession(s.sku, s.inventoryUnitId)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.4)',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.72rem',
                            cursor: 'pointer'
                          }}
                        >
                          🗑️ 破棄
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '0.6rem', padding: '0.4rem 0.6rem', background: '#020617', borderRadius: '4px', fontSize: '0.72rem', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                ⚠️ <strong>【一時退避（In-Memory Stash）について】</strong> これは同一ブラウザセッション内の一時退避領域です。正式な証拠保存（Evidence Vault）や在庫DBではありません。ページ更新、タブ終了、ブラウザ終了によりデータは消失します。
              </div>
            </div>
          )}
        </div>

        {/* Dry Run Preview Panel (In-memory diff & Reason code display) */}
        {showPreviewPanel && dryRunPreview && (
          <div
            style={{
              background: '#0b1329',
              border: dryRunPreview.canApply ? '1px solid #10b981' : '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.82rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    background: dryRunPreview.canApply ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
                    color: dryRunPreview.canApply ? '#34d399' : '#fbbf24',
                    border: dryRunPreview.canApply ? '1px solid #10b981' : '1px solid #f59e0b'
                  }}
                >
                  [{dryRunPreview.reasonCode}]
                </span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                  {dryRunPreview.canApply ? '適用可能 (Safe Dry Run PASS)' : '保留対象 (HOLD)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                ✕ 閉じる
              </button>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', color: '#cbd5e1' }}>
              {dryRunPreview.reasonMessageJa}
            </p>

            {dryRunPreview.gateDiff && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', background: '#070d1e', padding: '0.6rem', borderRadius: '6px' }}>
                <div>
                  <span style={{ color: '#94a3b8' }}>撮影完了 (photoCaptureComplete): </span>
                  <span style={{ color: dryRunPreview.gateDiff.photoCaptureComplete.before ? '#34d399' : '#94a3b8' }}>
                    {String(dryRunPreview.gateDiff.photoCaptureComplete.before)}
                  </span>
                  {' ➔ '}
                  <span style={{ color: dryRunPreview.gateDiff.photoCaptureComplete.after ? '#34d399' : '#f87171', fontWeight: 700 }}>
                    {String(dryRunPreview.gateDiff.photoCaptureComplete.after)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>QA完了 (photoQaComplete): </span>
                  <span style={{ color: dryRunPreview.gateDiff.photoQaComplete.before ? '#34d399' : '#94a3b8' }}>
                    {String(dryRunPreview.gateDiff.photoQaComplete.before)}
                  </span>
                  {' ➔ '}
                  <span style={{ color: dryRunPreview.gateDiff.photoQaComplete.after ? '#34d399' : '#f87171', fontWeight: 700 }}>
                    {String(dryRunPreview.gateDiff.photoQaComplete.after)}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>非写真ゲート保護: </span>
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>全4項目 変更なし (SAFE)</span>
                </div>
                <div>
                  <span style={{ color: '#94a3b8' }}>原本写真保全: </span>
                  <span style={{ color: dryRunPreview.evidencePreserved ? '#34d399' : '#f87171', fontWeight: 600 }}>
                    {dryRunPreview.evidencePreserved ? '保全済み (READ-ONLY)' : '未保全'} ({dryRunPreview.capturedPhotosCount} 枚)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Listing Photo Handoff Preview Panel (Dry Run) */}
        {showListingPanel && listingHandoff && (
          <div
            style={{
              background: '#150f28',
              border: listingHandoff.canPrepareDraft ? '1px solid #a855f7' : '1px solid #f59e0b',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.82rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    fontWeight: 700,
                    background: listingHandoff.canPrepareDraft ? 'rgba(168,85,247,0.2)' : 'rgba(245,158,11,0.2)',
                    color: listingHandoff.canPrepareDraft ? '#c084fc' : '#fbbf24',
                    border: listingHandoff.canPrepareDraft ? '1px solid #a855f7' : '1px solid #f59e0b'
                  }}
                >
                  [{listingHandoff.reasonCode}]
                </span>
                <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                  {listingHandoff.canPrepareDraft ? '出品ドラフト写真準備可能 (Dry Run PASS)' : '出品準備保留 (HOLD)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowListingPanel(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                ✕ 閉じる
              </button>
            </div>

            <p style={{ margin: '0 0 0.5rem 0', color: '#e9d5ff' }}>
              {listingHandoff.reasonMessageJa}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', background: '#0b0617', padding: '0.6rem', borderRadius: '6px' }}>
              <div>
                <span style={{ color: '#94a3b8' }}>対象チャネル: </span>
                <span style={{ color: '#c084fc', fontWeight: 600 }}>{listingHandoff.targetChannels.join(', ')}</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>メイン出品画像 (Hero): </span>
                <span style={{ color: listingHandoff.heroPhoto ? '#34d399' : '#f87171', fontWeight: 600 }}>
                  {listingHandoff.heroPhoto ? `正面 (${listingHandoff.heroPhoto.angle}) ${listingHandoff.heroPhoto.isAutoFixed ? '補正済' : '高画質原本'}` : '未選定'}
                </span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>写真候補総数: </span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{listingHandoff.totalPhotoCount} 枚 (原本証拠保全: 済)</span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>全体出品適格性 (6ゲート): </span>
                <span style={{ color: listingHandoff.overallListingEligible ? '#34d399' : '#fbbf24', fontWeight: 600 }}>
                  {listingHandoff.overallListingEligible ? '全適格 (READY)' : '検品・棚入ゲート待ち (HOLD)'}
                </span>
              </div>
            </div>

            {listingHandoff.canPrepareDraft && (
              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <a
                  href="./inventory-sales.html"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    color: '#ffffff',
                    padding: '0.45rem 0.95rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    textDecoration: 'none',
                    border: '1px solid #9333ea'
                  }}
                >
                  <span>📦</span> 在庫販売ワークベンチで出品準備・ドラフト確認を開く ↗
                </a>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Angle Navigation Steps */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #1e293b' }}>
          {REQUIRED_ANGLES.map((guide, idx) => {
            const photo = capturedPhotos[guide.angle];
            const isActive = idx === currentAngleIndex;
            let badgeBg = '#334155';
            let badgeText = '未撮影';
            let badgeColor = '#94a3b8';

            if (photo) {
              if (photo.qaResult.status === 'USE_AS_IS') {
                badgeBg = 'rgba(16,185,129,0.2)';
                badgeText = '合格';
                badgeColor = '#34d399';
              } else if (photo.qaResult.status === 'AUTO_FIX') {
                badgeBg = 'rgba(245,158,11,0.2)';
                badgeText = '要自動補正';
                badgeColor = '#fbbf24';
              } else {
                badgeBg = 'rgba(239,68,68,0.2)';
                badgeText = '再撮影';
                badgeColor = '#f87171';
              }
            }

            return (
              <button
                key={guide.angle}
                type="button"
                onClick={() => handleSelectAngle(idx)}
                style={{
                  flex: '0 0 auto',
                  padding: '0.6rem 0.85rem',
                  borderRadius: '8px',
                  background: isActive ? '#1e293b' : '#090d16',
                  border: isActive ? '2px solid #38bdf8' : '1px solid #1e293b',
                  color: isActive ? '#38bdf8' : '#cbd5e1',
                  textAlign: 'left',
                  cursor: 'pointer',
                  minWidth: '130px'
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  STEP {idx + 1} {guide.isRequired ? '(必須)' : '(任意)'}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, margin: '2px 0' }}>{guide.labelJa}</div>
                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: badgeBg, color: badgeColor, fontWeight: 600 }}>
                  {badgeText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Message Banner */}
        <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', borderLeft: '4px solid #38bdf8', fontSize: '0.9rem', color: '#e2e8f0' }}>
          💡 <strong>ガイド ({currentAngleGuide.labelJa}):</strong> {currentAngleGuide.description}
          <div style={{ marginTop: '0.25rem', color: '#38bdf8', fontWeight: 600 }}>{statusMessage}</div>
        </div>

        {/* Step 2: Camera Viewport & QA Assessment Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.25rem' }}>
          {/* Left Viewport Frame */}
          <div style={{ background: '#020617', padding: '1rem', borderRadius: '10px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '380px' }}>
            {/* Minimal Evidence Preservation Comparison Bar */}
            {activePhoto?.originalDataUrl && (
              <div style={{ marginBottom: '0.65rem', display: 'flex', gap: '0.5rem', background: '#090d16', padding: '0.35rem', borderRadius: '8px', border: '1px solid #334155' }}>
                <button
                  type="button"
                  onClick={() => setEvidenceViewMode('CORRECTED')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: evidenceViewMode === 'CORRECTED' ? '#0284c7' : 'transparent',
                    color: evidenceViewMode === 'CORRECTED' ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  📸 補正後画像 (USE_AS_IS)
                </button>
                <button
                  type="button"
                  onClick={() => setEvidenceViewMode('ORIGINAL')}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    background: evidenceViewMode === 'ORIGINAL' ? '#b45309' : 'transparent',
                    color: evidenceViewMode === 'ORIGINAL' ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer'
                  }}
                >
                  🛡️ 補正前原本 (証拠保全: 変更不可)
                </button>
              </div>
            )}

            <img
              src={
                activePhoto
                  ? (evidenceViewMode === 'ORIGINAL' && activePhoto.originalDataUrl
                      ? activePhoto.originalDataUrl
                      : activePhoto.dataUrl)
                  : generateMockImageDataUrl(currentAngleGuide.angle, simulatedPreset)
              }
              alt="Camera Preview"
              style={{ width: '100%', maxHeight: '320px', borderRadius: '8px', objectFit: 'contain' }}
            />

            {evidenceViewMode === 'ORIGINAL' && activePhoto?.originalDataUrl && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#fbbf24', background: 'rgba(245,158,11,0.15)', padding: '0.3rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(245,158,11,0.3)', width: '100%', textAlign: 'center' }}>
                🛡️ 補正前原本画像（改ざん不可・証拠保全）: 撮影時の生データを保護表示しています
              </div>
            )}

            {/* Visual Pedals Trigger Overlay Flash */}
            {isPedalPressedAnimation && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(56,189,248,0.25)', border: '4px solid #38bdf8', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', background: '#0284c7', padding: '0.5rem 1.25rem', borderRadius: '20px', boxShadow: '0 0 20px rgba(56,189,248,0.8)' }}>
                  🦶 CAPTURED! (FOOT PEDAL)
                </span>
              </div>
            )}

            {/* Quick Trigger Bar */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', width: '100%', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={handlePedalTrigger}
                disabled={isCapturing}
                style={{
                  padding: '0.85rem 1.75rem',
                  fontSize: '1rem',
                  fontWeight: 700,
                  background: isCapturing ? '#64748b' : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  cursor: isCapturing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>📸 {isCapturing ? '撮影処理中...' : `撮影実行 (${pedalConfig.triggerKey} / Pedal)`}</span>
              </button>

              {activePhoto && activePhoto.qaResult.status === 'AUTO_FIX' && (
                <button
                  type="button"
                  onClick={handleApplyAutoFix}
                  disabled={isCapturing}
                  style={{
                    padding: '0.85rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    background: isCapturing ? '#64748b' : '#d97706',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: isCapturing ? 'not-allowed' : 'pointer'
                  }}
                >
                  ✨ 画像補正 &amp; 再QA実行 (AUTO_FIX)
                </button>
              )}

              <button
                type="button"
                onClick={handleNextAngle}
                disabled={currentAngleIndex >= REQUIRED_ANGLES.length - 1}
                style={{
                  padding: '0.85rem 1.25rem',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  background: '#334155',
                  color: currentAngleIndex >= REQUIRED_ANGLES.length - 1 ? '#64748b' : '#f8fafc',
                  border: '1px solid #475569',
                  borderRadius: '10px',
                  cursor: currentAngleIndex >= REQUIRED_ANGLES.length - 1 ? 'not-allowed' : 'pointer'
                }}
              >
                次の角度へ ➔
              </button>
            </div>
          </div>

          {/* Right QA Assessment & Hardware Simulation Side Panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* QA Evaluation Status Box */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
              <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>🔍 品質自動判定 (Photo QA)</span>
                {activePhoto && (
                  <span
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '12px',
                      fontWeight: 700,
                      background:
                        activePhoto.qaResult.status === 'USE_AS_IS'
                          ? 'rgba(16,185,129,0.2)'
                          : activePhoto.qaResult.status === 'AUTO_FIX'
                          ? 'rgba(245,158,11,0.2)'
                          : 'rgba(239,68,68,0.2)',
                      color:
                        activePhoto.qaResult.status === 'USE_AS_IS'
                          ? '#34d399'
                          : activePhoto.qaResult.status === 'AUTO_FIX'
                          ? '#fbbf24'
                          : '#f87171'
                    }}
                  >
                    {activePhoto.qaResult.status}
                  </span>
                )}
              </h3>

              {activePhoto ? (
                <div>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#cbd5e1' }}>
                    <strong>推奨アクション:</strong> {activePhoto.qaResult.suggestedAction}
                  </div>

                  {/* Metrics Table */}
                  <div style={{ background: '#0f172a', padding: '0.6rem', borderRadius: '6px', fontSize: '0.8rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div>ピンぼけ: <strong>{isNaN(activePhoto.qaResult.metrics.blurScore) ? '解析エラー (NaN)' : `${activePhoto.qaResult.metrics.blurScore} / 100`}</strong></div>
                    <div>露出・明るさ: <strong>{isNaN(activePhoto.qaResult.metrics.brightness) ? '解析エラー (NaN)' : `${activePhoto.qaResult.metrics.brightness} / 255`}</strong></div>
                    <div>被写体率: <strong>{isNaN(activePhoto.qaResult.metrics.framingCoverage) ? '解析エラー (NaN)' : `${activePhoto.qaResult.metrics.framingCoverage}%`}</strong></div>
                    <div>グレア反射: <strong>{isNaN(activePhoto.qaResult.metrics.glareScore) ? '解析エラー (NaN)' : `${activePhoto.qaResult.metrics.glareScore} / 100`}</strong></div>
                  </div>

                  {/* Issues List */}
                  {activePhoto.qaResult.issues.length > 0 ? (
                    <div style={{ fontSize: '0.8rem' }}>
                      <strong style={{ color: '#f87171' }}>検出された課題:</strong>
                      <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0, color: '#fda4af' }}>
                        {activePhoto.qaResult.issues.map((iss, i) => (
                          <li key={i}>{iss.message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#34d399' }}>✓ 検出された画質上の課題はありません。合格です。</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  まだ撮影されていません。フットペダルまたは撮影ボタンを押して評価を開始してください。
                </div>
              )}
            </div>

            {/* Hardware-Free Simulation & Pedal Configuration Control Panel */}
            <div style={{ background: '#1e293b', padding: '1rem', borderRadius: '10px', border: '1px solid #334155' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#38bdf8', fontWeight: 700 }}>
                🧪 実機なしテスト用 疑似撮影プリセット
              </h4>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                実機カメラ・ペダル未購入環境で全3状態 (USE_AS_IS / AUTO_FIX / RETAKE) をテスト可能です。
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.85rem' }}>
                <button
                  type="button"
                  onClick={() => setSimulatedPreset('GOOD')}
                  style={{
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: simulatedPreset === 'GOOD' ? '2px solid #10b981' : '1px solid #475569',
                    background: simulatedPreset === 'GOOD' ? 'rgba(16,185,129,0.2)' : '#0f172a',
                    color: '#34d399',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🟢 クリア写真 (USE_AS_IS)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedPreset('DARK')}
                  style={{
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: simulatedPreset === 'DARK' ? '2px solid #f59e0b' : '1px solid #475569',
                    background: simulatedPreset === 'DARK' ? 'rgba(245,158,11,0.2)' : '#0f172a',
                    color: '#fbbf24',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🟡 露出不足 (AUTO_FIX)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedPreset('BLURRY')}
                  style={{
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: simulatedPreset === 'BLURRY' ? '2px solid #ef4444' : '1px solid #475569',
                    background: simulatedPreset === 'BLURRY' ? 'rgba(239,68,68,0.2)' : '#0f172a',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🔴 ピンぼけ (RETAKE)
                </button>
                <button
                  type="button"
                  onClick={() => setSimulatedPreset('GLARE')}
                  style={{
                    padding: '0.4rem 0.6rem',
                    fontSize: '0.75rem',
                    borderRadius: '6px',
                    border: simulatedPreset === 'GLARE' ? '2px solid #ef4444' : '1px solid #475569',
                    background: simulatedPreset === 'GLARE' ? 'rgba(239,68,68,0.2)' : '#0f172a',
                    color: '#f87171',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  🔴 光反射 (RETAKE)
                </button>
              </div>

              {/* Pedal Config Selector */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <label style={{ color: '#cbd5e1' }}>ペダル割り当てキー:</label>
                <select
                  value={pedalConfig.triggerKey}
                  onChange={(e) =>
                    setPedalConfig({
                      ...pedalConfig,
                      triggerKey: e.target.value,
                      keyLabel: `${e.target.value} キー / ペダル`
                    })
                  }
                  style={{ background: '#0f172a', color: '#f8fafc', border: '1px solid #475569', borderRadius: '4px', padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                >
                  <option value="Space">Space Key</option>
                  <option value="Enter">Enter Key</option>
                  <option value="F12">F12 Key</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Step 3: Captured Photos Gallery Summary */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
              🖼️ アングル別撮影ギャラリー ({passedRequiredCount} / {requiredCount} 必須アングル USE_AS_IS 合格)
            </h3>
            <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>
              進捗率: {Math.round((completedCount / REQUIRED_ANGLES.length) * 100)}% (合格 {completedCount}件)
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.65rem' }}>
            {REQUIRED_ANGLES.map((guide, idx) => {
              const photo = capturedPhotos[guide.angle];
              const isSelected = idx === currentAngleIndex;

              return (
                <div
                  key={guide.angle}
                  onClick={() => handleSelectAngle(idx)}
                  style={{
                    background: '#090d16',
                    borderRadius: '8px',
                    padding: '0.4rem',
                    border: isSelected ? '2px solid #38bdf8' : '1px solid #1e293b',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.2rem' }}>{guide.labelJa}</div>
                  {photo ? (
                    <img src={photo.dataUrl} alt={guide.labelJa} style={{ width: '100%', height: '65px', objectFit: 'cover', borderRadius: '4px' }} />
                  ) : (
                    <div style={{ width: '100%', height: '65px', background: '#1e293b', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', color: '#64748b' }}>
                      未撮影
                    </div>
                  )}
                  {photo && (
                    <div
                      style={{
                        marginTop: '0.3rem',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color:
                          photo.qaResult.status === 'USE_AS_IS'
                            ? '#34d399'
                            : photo.qaResult.status === 'AUTO_FIX'
                            ? '#fbbf24'
                            : '#f87171'
                      }}
                    >
                      {photo.qaResult.status}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Safe Switch & Unsaved Photo Protection Modal */}
      {switchModal.isOpen && switchModal.pendingContext && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: switchModal.mode === 'CONFIRM_DISCARD_FINAL' ? '2px solid #ef4444' : '2px solid #3b82f6',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
              color: '#f8fafc'
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div
                style={{
                  background: switchModal.mode === 'CONFIRM_DISCARD_FINAL' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: switchModal.mode === 'CONFIRM_DISCARD_FINAL' ? '#f87171' : '#60a5fa',
                  padding: '0.6rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{switchModal.mode === 'CONFIRM_DISCARD_FINAL' ? '⚠️' : '💾'}</span>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                  {switchModal.mode === 'CONFIRM_DISCARD_FINAL'
                    ? '未保存写真の破棄確認'
                    : switchModal.mode === 'UNCONFIRMED_WARN'
                    ? '未確定コンテキストの写真保護警告'
                    : '未保存写真の一時退避と商品切り替え'}
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                  別商品への写真混入防止 &amp; 撮影データの安全な退避
                </p>
              </div>
            </div>

            {/* Error Message if Stash failed */}
            {switchModal.errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid #ef4444',
                  borderRadius: '6px',
                  padding: '0.6rem 0.8rem',
                  marginBottom: '1rem',
                  fontSize: '0.82rem',
                  color: '#fca5a5'
                }}
              >
                <strong>❌ 退避不可:</strong> {switchModal.errorMessage}
              </div>
            )}

            {/* Target Item Details Box */}
            <div
              style={{
                background: '#1e293b',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.82rem',
                border: '1px solid #334155'
              }}
            >
              <div style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>現在の対象: </span>
                <strong style={{ color: '#f8fafc' }}>
                  {activeTargetContext.sku || '未確定 (UNLINKED_HOLD)'}
                </strong>
                {activeTargetContext.inventoryUnitId && (
                  <span style={{ color: '#cbd5e1' }}> ({activeTargetContext.inventoryUnitId})</span>
                )}
              </div>
              <div style={{ marginBottom: '0.4rem' }}>
                <span style={{ color: '#94a3b8' }}>撮影済み写真: </span>
                <strong style={{ color: '#38bdf8' }}>{switchModal.currentPhotoCount} 枚</strong>
                <span style={{ color: '#94a3b8' }}>
                  {' '}(合格 USE_AS_IS: <strong style={{ color: '#34d399' }}>{switchModal.currentUsableCount}</strong> 枚)
                </span>
              </div>
              <div>
                <span style={{ color: '#94a3b8' }}>切替先: </span>
                <strong style={{ color: '#c084fc' }}>
                  {switchModal.pendingContext.sku || '未選択 (HOLD)'}
                </strong>
                {switchModal.pendingContext.inventoryUnitId && (
                  <span style={{ color: '#cbd5e1' }}> ({switchModal.pendingContext.inventoryUnitId})</span>
                )}
              </div>
            </div>

            {/* Mode-specific Explanations & Action Buttons */}
            {switchModal.mode === 'CONFIRM_STASH_OR_DISCARD' && (
              <>
                <p style={{ fontSize: '0.83rem', color: '#cbd5e1', lineHeight: '1.45', marginBottom: '1rem' }}>
                  現在の撮影データをメモリ内に一時退避すると、後からこの個体に戻った際に撮影途中から再開できます。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {/* Default / Primary Recommended Action */}
                  <button
                    type="button"
                    onClick={handleModalStashAndSwitch}
                    style={{
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      color: '#ffffff',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
                    }}
                  >
                    <span>💾</span> 一時退避して切り替える（推奨）
                  </button>

                  {/* Secondary Action: Cancel Switch */}
                  <button
                    type="button"
                    onClick={handleModalCancel}
                    style={{
                      background: '#334155',
                      color: '#cbd5e1',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      padding: '0.6rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    ❌ 切り替えをキャンセル（現在の撮影を継続）
                  </button>

                  {/* Destructive Action: Discard prompt */}
                  <div style={{ textAlign: 'center', marginTop: '0.4rem' }}>
                    <button
                      type="button"
                      onClick={handleModalPromptDiscard}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        fontSize: '0.76rem',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      🗑️ 未保存写真を破棄して切り替える...
                    </button>
                  </div>
                </div>
              </>
            )}

            {switchModal.mode === 'CONFIRM_DISCARD_FINAL' && (
              <>
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: '#fca5a5'
                  }}
                >
                  ⚠️ <strong>【不可逆なデータ消去の警告】</strong>
                  <br />
                  SKU: <strong>{activeTargetContext.sku}</strong> の撮影済み写真（原本および補正後画像 {switchModal.currentPhotoCount} 枚）はメモリから完全に消去され、復元できなくなります。
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {/* Default Action: Keep Data / Cancel */}
                  <button
                    type="button"
                    onClick={handleModalCancel}
                    style={{
                      flex: 1,
                      background: '#2563eb',
                      color: '#ffffff',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🛡️ キャンセル（破棄せずデータを保持）
                  </button>

                  {/* Danger Action */}
                  <button
                    type="button"
                    onClick={handleModalExecuteDiscard}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ 破棄を実行して切り替え
                  </button>
                </div>
              </>
            )}

            {switchModal.mode === 'UNCONFIRMED_WARN' && (
              <>
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    marginBottom: '1rem',
                    fontSize: '0.82rem',
                    color: '#fcd34d'
                  }}
                >
                  ⚠️ 現在の撮影写真は商品カタログ番号（SKU）および実物個体IDが未確定（UNLINKED_HOLD）のため、他商品への誤紐付け防止のためメモリ一時退避が禁止されています。
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  {/* Default Action: Cancel */}
                  <button
                    type="button"
                    onClick={handleModalCancel}
                    style={{
                      flex: 1,
                      background: '#334155',
                      color: '#ffffff',
                      border: '1px solid #475569',
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🛡️ キャンセル（未確定のまま撮影継続）
                  </button>

                  <button
                    type="button"
                    onClick={handleModalExecuteDiscard}
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    🗑️ 未確定写真を破棄して切り替え
                  </button>
                </div>
              </>
            )}

            {/* Truthful Disclosure Banner */}
            <div
              style={{
                marginTop: '1rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                fontSize: '0.72rem',
                color: '#94a3b8',
                lineHeight: '1.4'
              }}
            >
              ℹ️ <strong>【一時退避（In-Memory Stash）について】</strong>
              {' '}これは同一ブラウザセッション内の一時退避領域です。正式な証拠保存（Evidence Vault）や在庫DBではありません。ページ更新、タブ終了、ブラウザ終了によりデータは消失します。
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
