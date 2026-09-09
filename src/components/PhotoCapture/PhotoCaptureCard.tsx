import React, { useState, useEffect, useRef } from 'react';
import {
  PhotoAngle,
  CapturedPhoto,
  REQUIRED_ANGLES,
  AngleGuide,
  PedalTriggerConfig
} from '../../types/photoCapture';
import {
  applyAutoFixToPhoto,
  VirtualMockCameraAdapter,
  PedalInputListener,
  generateMockImageDataUrl,
  ICameraHardwareAdapter,
  executePhotoCaptureFlow
} from '../../services/photoCaptureService';

interface PhotoCaptureCardProps {
  isTabActive?: boolean;
  cameraAdapter?: ICameraHardwareAdapter;
}

export const PhotoCaptureCard: React.FC<PhotoCaptureCardProps> = ({ isTabActive = true, cameraAdapter }) => {
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

  // Synchronous lock ref to prevent race conditions during rapid key events
  const isCapturingRef = useRef<boolean>(false);

  const currentAngleGuide: AngleGuide = REQUIRED_ANGLES[currentAngleIndex];
  const activePhoto = capturedPhotos[currentAngleGuide.angle];

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
      setStatusMessage(`次の撮影角度【${REQUIRED_ANGLES[currentAngleIndex + 1].labelJa}】に移動しました。`);
    }
  };

  // Select angle directly
  const handleSelectAngle = (idx: number) => {
    setCurrentAngleIndex(idx);
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

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '20px', background: pedalConfig.enabled && isTabActive ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: pedalConfig.enabled && isTabActive ? '#34d399' : '#f87171', border: '1px solid rgba(52,211,153,0.3)', fontWeight: 600 }}>
            🦶 ペダル連動: {pedalConfig.triggerKey} {isTabActive ? '(有効)' : '(他タブ停止中)'}
          </span>
          {/* Explicit Status for Hardware Validation Pending */}
          <span style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', background: '#090d16', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontWeight: 600 }}>
            🚫 実機WebRTCカメラ: Hardware Validation 待ち (モック動作中)
          </span>
        </div>
      </div>

      {/* Main Grid Content */}
      <div style={{ background: '#0f172a', padding: '1.25rem', borderRadius: '0 0 12px 12px', border: '1px solid #334155', borderTop: 'none' }}>
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
            <img
              src={activePhoto ? activePhoto.dataUrl : generateMockImageDataUrl(currentAngleGuide.angle, simulatedPreset)}
              alt="Camera Preview"
              style={{ width: '100%', maxHeight: '320px', borderRadius: '8px', objectFit: 'contain' }}
            />

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
    </div>
  );
};
