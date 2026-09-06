import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  assessPhotoPixels,
  createPerceptualHash,
  isLikelyDuplicate
} from '../../services/photoQaService';
import {
  createPedalInputProfile,
  describeHardwareValidation,
  resolveKeyboardCaptureSignal
} from '../../services/photoCaptureInputService';
import {
  CapturedPhoto,
  CaptureTrigger,
  PhotoAutoFix,
  PhotoQaDecision,
  PhotoQaResult,
  PhotoSource
} from '../../types/photoCapture';

const PEDAL_KEY_OPTIONS = [
  { code: 'F9', label: 'F9（推奨）' },
  { code: 'F8', label: 'F8' },
  { code: 'F10', label: 'F10' },
  { code: 'Enter', label: 'Enter' }
] as const;

const DECISION_LABELS: Record<PhotoQaDecision, string> = {
  USE_AS_IS: 'USE_AS_IS｜そのまま使用可',
  AUTO_FIX: 'AUTO_FIX｜安全な自動補正後に使用',
  RETAKE: 'RETAKE｜再撮影が必要'
};

const DECISION_COLORS: Record<PhotoQaDecision, string> = {
  USE_AS_IS: '#34d399',
  AUTO_FIX: '#60a5fa',
  RETAKE: '#f87171'
};

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.92)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(30, 41, 59, 0.95)',
  color: '#f8fafc',
  padding: '10px 14px',
  cursor: 'pointer',
  fontWeight: 700
};

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLButtonElement ||
    target.isContentEditable
  );
}

function applySafeAutoFix(sourceCanvas: HTMLCanvasElement, autoFix?: PhotoAutoFix): string {
  if (!autoFix) return sourceCanvas.toDataURL('image/jpeg', 0.92);

  const crop = autoFix.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const sx = Math.round(sourceCanvas.width * crop.x);
  const sy = Math.round(sourceCanvas.height * crop.y);
  const sw = Math.max(1, Math.round(sourceCanvas.width * crop.width));
  const sh = Math.max(1, Math.round(sourceCanvas.height * crop.height));

  const output = document.createElement('canvas');
  output.width = sw;
  output.height = sh;
  const ctx = output.getContext('2d');
  if (!ctx) return sourceCanvas.toDataURL('image/jpeg', 0.92);

  // Safe, non-generative correction only. Missing product pixels are never synthesized.
  ctx.filter = `brightness(${autoFix.brightnessPercent}%) contrast(${autoFix.contrastPercent}%)`;
  ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.filter = 'none';

  return output.toDataURL('image/jpeg', 0.92);
}

function withDuplicateRetake(qa: PhotoQaResult): PhotoQaResult {
  return {
    ...qa,
    decision: 'RETAKE',
    autoFix: undefined,
    reasons: ['直前までに採用した写真とほぼ同じ構図です。別角度を撮影してください。', ...qa.reasons]
  };
}

function createCanvasFromVideo(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export function PhotoCaptureCard() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const testCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const capturingRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('カメラ未接続でもテスト画像を読み込めばMVPを検証できます。');
  const [pedalKey, setPedalKey] = useState<string>('F9');
  const [angleNumber, setAngleNumber] = useState(1);
  const [acceptedPhotos, setAcceptedPhotos] = useState<CapturedPhoto[]>([]);
  const [lastAttempt, setLastAttempt] = useState<CapturedPhoto | null>(null);
  const [testImagePreview, setTestImagePreview] = useState<string | null>(null);
  const [testImageName, setTestImageName] = useState<string | null>(null);
  const [softwareTestRuns, setSoftwareTestRuns] = useState(0);
  const [busy, setBusy] = useState(false);

  const pedalProfile = useMemo(() => createPedalInputProfile(pedalKey), [pedalKey]);
  const hasSoftwareSource = Boolean(testCanvasRef.current && testImagePreview);
  const canCapture = cameraActive || hasSoftwareSource;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraMessage(
      testCanvasRef.current
        ? 'カメラを停止しました。テスト画像によるSoftware Validationを続けられます。'
        : 'カメラを停止しました。テスト画像を読み込めばSoftware Validationを続けられます。'
    );
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage('このブラウザではカメラAPIを利用できません。テスト画像でSoftware Validationを継続してください。');
        return;
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      setCameraMessage(`撮影準備OK。ペダル互換キー(${pedalKey})・Spaceキー・画面ボタンのどれでも同じ撮影処理を呼びます。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なカメラエラー';
      setCameraActive(false);
      setCameraMessage(`カメラを開始できませんでした: ${message}。テスト画像でSoftware Validationは継続できます。`);
    }
  }, [pedalKey]);

  const processCanvas = useCallback((canvas: HTMLCanvasElement, trigger: CaptureTrigger, source: PhotoSource) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('画像解析用Canvasを利用できません。');

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const originalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const perceptualHash = createPerceptualHash(imageData.data, canvas.width, canvas.height);
    let qa = assessPhotoPixels(imageData.data, canvas.width, canvas.height);

    // Duplicate rejection belongs to the real camera session. Software test images are
    // intentionally reusable so F9/Space/button can each validate the same input source.
    if (source === 'CAMERA') {
      const priorHashes = acceptedPhotos.map((photo) => photo.perceptualHash);
      if (isLikelyDuplicate(perceptualHash, priorHashes)) {
        qa = withDuplicateRetake(qa);
      }
    }

    const finalDataUrl = qa.decision === 'AUTO_FIX'
      ? applySafeAutoFix(canvas, qa.autoFix)
      : originalDataUrl;

    const captured: CapturedPhoto = {
      id: `photo_${Date.now()}_${angleNumber}_${source.toLowerCase()}`,
      angleNumber,
      capturedAt: new Date().toISOString(),
      trigger,
      source,
      originalDataUrl,
      finalDataUrl,
      qa,
      perceptualHash
    };

    setLastAttempt(captured);

    if (source === 'TEST_IMAGE') {
      setSoftwareTestRuns((previous) => previous + 1);
      setCameraMessage(
        `Software Validation: ${trigger}入力 → TEST_IMAGE → ${qa.decision}。` +
        ' 実機撮影ではないため採用写真一覧・角度番号は変更しません。'
      );
      return;
    }

    if (qa.decision === 'RETAKE') {
      setCameraMessage(`角度 ${angleNumber}: 再撮影が必要です。理由を確認して同じ角度を撮り直してください。`);
      return;
    }

    setAcceptedPhotos((previous) => [...previous, captured]);
    setAngleNumber((previous) => previous + 1);
    setCameraMessage(
      qa.decision === 'AUTO_FIX'
        ? `角度 ${angleNumber}: 安全な自動補正を適用して採用しました。次の角度へ進めます。`
        : `角度 ${angleNumber}: そのまま採用しました。次の角度へ進めます。`
    );
  }, [acceptedPhotos, angleNumber]);

  const capturePhoto = useCallback(async (trigger: CaptureTrigger) => {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setBusy(true);

    try {
      if (cameraActive && videoRef.current) {
        const cameraCanvas = createCanvasFromVideo(videoRef.current);
        if (!cameraCanvas) {
          setCameraMessage('カメラ映像の準備ができていません。少し待ってから再度撮影してください。');
          return;
        }
        processCanvas(cameraCanvas, trigger, 'CAMERA');
        return;
      }

      if (testCanvasRef.current) {
        processCanvas(testCanvasRef.current, trigger, 'TEST_IMAGE');
        return;
      }

      setCameraMessage('撮影元がありません。カメラを開始するか、Software Validation用のテスト画像を読み込んでください。');
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明な撮影エラー';
      setCameraMessage(`撮影または品質判定に失敗しました: ${message}`);
    } finally {
      capturingRef.current = false;
      setBusy(false);
    }
  }, [cameraActive, processCanvas]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isTextEntryTarget(event.target)) return;

      const trigger = resolveKeyboardCaptureSignal(
        { code: event.code, repeat: event.repeat },
        pedalProfile
      );
      if (!trigger) return;

      event.preventDefault();
      void capturePhoto(trigger);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [capturePhoto, pedalProfile]);

  const loadTestImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setCameraMessage('画像ファイルを選択してください。');
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = 'async';
      const loaded = new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('テスト画像を読み込めませんでした。'));
      });
      image.src = url;
      await loaded;

      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('テスト画像用Canvasを作成できません。');
      ctx.drawImage(image, 0, 0);

      testCanvasRef.current = canvas;
      setTestImagePreview(canvas.toDataURL('image/jpeg', 0.92));
      setTestImageName(file.name);
      setCameraMessage(
        `テスト画像「${file.name}」を読み込みました。` +
        ` ${pedalKey}（ペダル互換キー）/ Space / 画面ボタンで同じCapture Pipelineを検証できます。`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なテスト画像エラー';
      setCameraMessage(message);
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [pedalKey]);

  const clearTestImage = () => {
    testCanvasRef.current = null;
    setTestImagePreview(null);
    setTestImageName(null);
    setCameraMessage('テスト画像を解除しました。');
  };

  const resetSession = () => {
    setAcceptedPhotos([]);
    setLastAttempt(null);
    setAngleNumber(1);
    setSoftwareTestRuns(0);
    setCameraMessage(
      testCanvasRef.current
        ? '撮影セッションをリセットしました。テスト画像はそのままSoftware Validationに使えます。'
        : '撮影セッションをリセットしました。'
    );
  };

  const downloadPhoto = (photo: CapturedPhoto) => {
    if (photo.source !== 'CAMERA') return;
    const link = document.createElement('a');
    link.href = photo.finalDataUrl;
    link.download = `jp-treasure-photo-angle-${String(photo.angleNumber).padStart(2, '0')}.jpg`;
    link.click();
  };

  return (
    <section style={{ color: '#e2e8f0', padding: 20, maxWidth: 1240, margin: '0 auto' }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 26, color: '#f8fafc' }}>Photo Capture MVP</h2>
        <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
          商品を置く → ペダル/キーボード/ボタンで撮影 → 自動QA → OKなら次角度、問題があればその写真だけ再撮影
        </p>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16, borderColor: 'rgba(96, 165, 250, 0.35)' }}>
        <h3 style={{ margin: '0 0 10px', color: '#f8fafc' }}>Hardware / Software Validation</h3>
        <div style={{ display: 'grid', gap: 6, color: '#cbd5e1', fontSize: 14 }}>
          <div><strong>Pedal Input Mode:</strong> {pedalProfile.mode}</div>
          <div><strong>Pedal-compatible key:</strong> {pedalProfile.pedalKeyCode}</div>
          <div><strong>Keyboard fallback:</strong> {pedalProfile.fallbackKeyboardCode}</div>
          <div><strong>Hardware Validation:</strong> <span style={{ color: '#fbbf24' }}>{describeHardwareValidation(pedalProfile)}</span></div>
          <div><strong>Software Validation runs:</strong> {softwareTestRuns}</div>
        </div>
        <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: 13 }}>
          実機ペダルは専用APIへ依存しません。購入後、ペダルが設定キーを送れば現在のPEDAL入力経路をそのまま使用し、Hardware Validation記録だけを追加できます。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(300px, 1fr)', gap: 16 }}>
        <div style={panelStyle}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            <button type="button" style={buttonStyle} onClick={() => void startCamera()}>
              カメラを開始
            </button>
            <button type="button" style={buttonStyle} onClick={stopCamera} disabled={!cameraActive}>
              カメラを停止
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, background: '#2563eb', borderColor: '#3b82f6' }}
              onClick={() => void capturePhoto('BUTTON')}
              disabled={!canCapture || busy}
            >
              {busy ? '判定中…' : cameraActive ? `撮影する（角度 ${angleNumber}）` : '画面ボタンでSoftware Validation'}
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <label htmlFor="photo-pedal-key" style={{ color: '#cbd5e1', fontWeight: 700 }}>
              ペダルが送信するキー
            </label>
            <select
              id="photo-pedal-key"
              value={pedalKey}
              onChange={(event) => setPedalKey(event.target.value)}
              style={{ ...buttonStyle, cursor: 'default', padding: '8px 10px' }}
            >
              {PEDAL_KEY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>{option.label}</option>
              ))}
            </select>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>通常キーボード: Space / 画面: 撮影ボタン</span>
          </div>

          <div style={{ ...panelStyle, padding: 12, marginBottom: 14, background: 'rgba(30, 41, 59, 0.55)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <label htmlFor="photo-test-image" style={{ fontWeight: 700, color: '#cbd5e1' }}>Software Validation用テスト画像</label>
              <input
                id="photo-test-image"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file) void loadTestImage(file);
                  event.currentTarget.value = '';
                }}
                style={{ color: '#cbd5e1' }}
              />
              {testImageName && (
                <button type="button" style={{ ...buttonStyle, padding: '7px 10px' }} onClick={clearTestImage}>
                  テスト画像を解除
                </button>
              )}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#94a3b8' }}>
              カメラ未接続時はこの画像を疑似フレームとして使います。{pedalKey}・Space・画面ボタンの入力経路とPhoto QAを実機なしで検証できます。
            </p>
          </div>

          <div style={{ background: '#020617', borderRadius: 12, overflow: 'hidden', minHeight: 360, display: 'grid', placeItems: 'center' }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ display: cameraActive ? 'block' : 'none', width: '100%', maxHeight: 620, objectFit: 'contain' }}
            />
            {!cameraActive && testImagePreview && (
              <img
                src={testImagePreview}
                alt="Software Validation用テスト画像"
                style={{ width: '100%', maxHeight: 620, objectFit: 'contain' }}
              />
            )}
            {!cameraActive && !testImagePreview && <span style={{ color: '#64748b' }}>Camera preview / Test image</span>}
          </div>

          <div aria-live="polite" style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(30, 41, 59, 0.8)', color: '#cbd5e1' }}>
            {cameraMessage}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>最新の自動QA</h3>
            {!lastAttempt ? (
              <p style={{ color: '#94a3b8' }}>まだ撮影・Software Validationされていません。</p>
            ) : (
              <>
                <div style={{ fontWeight: 800, color: DECISION_COLORS[lastAttempt.qa.decision], marginBottom: 10 }}>
                  {DECISION_LABELS[lastAttempt.qa.decision]}
                </div>
                {lastAttempt.source === 'TEST_IMAGE' && (
                  <div style={{ marginBottom: 8, color: '#fbbf24', fontSize: 13, fontWeight: 700 }}>
                    SOFTWARE TEST RESULT（実機写真として保存しません）
                  </div>
                )}
                <img
                  src={lastAttempt.finalDataUrl}
                  alt={`${lastAttempt.source} の撮影結果`}
                  style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, background: '#020617' }}
                />
                <ul style={{ paddingLeft: 20, color: '#cbd5e1', fontSize: 14 }}>
                  {lastAttempt.qa.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}
                </ul>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  source: {lastAttempt.source} / trigger: {lastAttempt.trigger}<br />
                  sharpness: {lastAttempt.qa.metrics.edgeStrength.toFixed(3)} / contrast: {lastAttempt.qa.metrics.contrast.toFixed(3)}<br />
                  luminance: {lastAttempt.qa.metrics.meanLuminance.toFixed(3)} / min margin: {(lastAttempt.qa.metrics.minimumMargin * 100).toFixed(1)}%
                </div>
              </>
            )}
          </div>

          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>MVP安全ルール</h3>
            <ul style={{ paddingLeft: 20, marginBottom: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.65 }}>
              <li>商品がフレーム端に近い・情報損失が疑われる場合は RETAKE。</li>
              <li>軽い位置ずれ・余白・明るさ・コントラストだけを AUTO_FIX。</li>
              <li>欠けた商品部分、傷、印刷、形状を生成して補完しません。</li>
              <li>実機カメラでは同一構図の重複写真を再撮影対象にします。</li>
              <li>テスト画像はSoftware Validation専用で、実機写真として採用・保存しません。</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>実機撮影の採用済み写真: {acceptedPhotos.length}枚</h3>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>RETAKEとTEST_IMAGEは採用一覧へ入りません。</p>
          </div>
          <button type="button" style={buttonStyle} onClick={resetSession}>セッションをリセット</button>
        </div>

        {acceptedPhotos.length === 0 ? (
          <p style={{ color: '#64748b' }}>実機カメラから採用された写真はまだありません。</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginTop: 14 }}>
            {acceptedPhotos.map((photo) => (
              <article key={photo.id} style={{ background: '#020617', borderRadius: 10, padding: 10 }}>
                <img src={photo.finalDataUrl} alt={`採用写真 角度 ${photo.angleNumber}`} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'contain' }} />
                <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1' }}>
                  角度 {photo.angleNumber} · {photo.qa.decision} · {photo.trigger}
                </div>
                <button type="button" style={{ ...buttonStyle, marginTop: 8, width: '100%', padding: '7px 10px' }} onClick={() => downloadPhoto(photo)}>
                  JPGを保存
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <p style={{ marginTop: 14, color: '#64748b', fontSize: 12 }}>
        MVPのQAはブラウザ内の保守的な画素ヒューリスティックです。重要な文字・傷・真正性などの意味判断は自動確定せず、販売前の人間確認を残します。
      </p>
    </section>
  );
}
