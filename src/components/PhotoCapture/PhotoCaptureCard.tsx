import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  assessPhotoPixels,
  createPerceptualHash,
  isLikelyDuplicate
} from '../../services/photoQaService';
import {
  CapturedPhoto,
  CaptureTrigger,
  PhotoAutoFix,
  PhotoQaDecision,
  PhotoQaResult
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

export function PhotoCaptureCard() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturingRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('「カメラを開始」を押して撮影を開始してください。');
  const [pedalKey, setPedalKey] = useState<string>('F9');
  const [angleNumber, setAngleNumber] = useState(1);
  const [acceptedPhotos, setAcceptedPhotos] = useState<CapturedPhoto[]>([]);
  const [lastAttempt, setLastAttempt] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setCameraMessage('カメラを停止しました。');
  }, []);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraMessage('このブラウザではカメラAPIを利用できません。対応ブラウザで開いてください。');
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
      setCameraMessage(`撮影準備OK。ペダル(${pedalKey})・Spaceキー・画面ボタンのどれでも撮影できます。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明なカメラエラー';
      setCameraActive(false);
      setCameraMessage(`カメラを開始できませんでした: ${message}`);
    }
  }, [pedalKey]);

  const capturePhoto = useCallback(async (trigger: CaptureTrigger) => {
    if (capturingRef.current) return;
    const video = videoRef.current;
    if (!cameraActive || !video || video.readyState < 2 || video.videoWidth <= 0 || video.videoHeight <= 0) {
      setCameraMessage('カメラ映像の準備ができていません。「カメラを開始」を確認してください。');
      return;
    }

    capturingRef.current = true;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setCameraMessage('画像解析用Canvasを作成できませんでした。');
        return;
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const originalDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const perceptualHash = createPerceptualHash(imageData.data, canvas.width, canvas.height);
      let qa = assessPhotoPixels(imageData.data, canvas.width, canvas.height);

      const priorHashes = acceptedPhotos.map((photo) => photo.perceptualHash);
      if (isLikelyDuplicate(perceptualHash, priorHashes)) {
        qa = withDuplicateRetake(qa);
      }

      const finalDataUrl = qa.decision === 'AUTO_FIX'
        ? applySafeAutoFix(canvas, qa.autoFix)
        : originalDataUrl;

      const captured: CapturedPhoto = {
        id: `photo_${Date.now()}_${angleNumber}`,
        angleNumber,
        capturedAt: new Date().toISOString(),
        trigger,
        originalDataUrl,
        finalDataUrl,
        qa,
        perceptualHash
      };

      setLastAttempt(captured);

      if (qa.decision === 'RETAKE') {
        setCameraMessage(`角度 ${angleNumber}: 再撮影が必要です。理由を確認して同じ角度を撮り直してください。`);
      } else {
        setAcceptedPhotos((previous) => [...previous, captured]);
        setAngleNumber((previous) => previous + 1);
        setCameraMessage(
          qa.decision === 'AUTO_FIX'
            ? `角度 ${angleNumber}: 安全な自動補正を適用して採用しました。次の角度へ進めます。`
            : `角度 ${angleNumber}: そのまま採用しました。次の角度へ進めます。`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '不明な撮影エラー';
      setCameraMessage(`撮影または品質判定に失敗しました: ${message}`);
    } finally {
      capturingRef.current = false;
      setBusy(false);
    }
  }, [acceptedPhotos, angleNumber, cameraActive]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || isTextEntryTarget(event.target)) return;

      if (event.code === pedalKey) {
        event.preventDefault();
        void capturePhoto('PEDAL');
        return;
      }

      if (event.code === 'Space') {
        event.preventDefault();
        void capturePhoto('KEYBOARD');
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [capturePhoto, pedalKey]);

  const resetSession = () => {
    setAcceptedPhotos([]);
    setLastAttempt(null);
    setAngleNumber(1);
    setCameraMessage('撮影セッションをリセットしました。カメラはそのまま利用できます。');
  };

  const downloadPhoto = (photo: CapturedPhoto) => {
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
              disabled={!cameraActive || busy}
            >
              {busy ? '判定中…' : `撮影する（角度 ${angleNumber}）`}
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
            <span style={{ color: '#94a3b8', fontSize: 13 }}>通常キーボード: Space / 画面: 撮影する</span>
          </div>

          <div style={{ background: '#020617', borderRadius: 12, overflow: 'hidden', minHeight: 360, display: 'grid', placeItems: 'center' }}>
            <video
              ref={videoRef}
              muted
              playsInline
              style={{ display: cameraActive ? 'block' : 'none', width: '100%', maxHeight: 620, objectFit: 'contain' }}
            />
            {!cameraActive && <span style={{ color: '#64748b' }}>Camera preview</span>}
          </div>

          <div aria-live="polite" style={{ marginTop: 12, padding: 12, borderRadius: 10, background: 'rgba(30, 41, 59, 0.8)', color: '#cbd5e1' }}>
            {cameraMessage}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <div style={panelStyle}>
            <h3 style={{ marginTop: 0, color: '#f8fafc' }}>最新の自動QA</h3>
            {!lastAttempt ? (
              <p style={{ color: '#94a3b8' }}>まだ撮影されていません。</p>
            ) : (
              <>
                <div style={{ fontWeight: 800, color: DECISION_COLORS[lastAttempt.qa.decision], marginBottom: 10 }}>
                  {DECISION_LABELS[lastAttempt.qa.decision]}
                </div>
                <img
                  src={lastAttempt.finalDataUrl}
                  alt={`角度 ${lastAttempt.angleNumber} の撮影結果`}
                  style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10, background: '#020617' }}
                />
                <ul style={{ paddingLeft: 20, color: '#cbd5e1', fontSize: 14 }}>
                  {lastAttempt.qa.reasons.map((reason, index) => <li key={`${reason}-${index}`}>{reason}</li>)}
                </ul>
                <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                  trigger: {lastAttempt.trigger}<br />
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
              <li>同一構図の重複写真は再撮影対象にします。</li>
            </ul>
          </div>
        </div>
      </div>

      <div style={{ ...panelStyle, marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc' }}>採用済み写真: {acceptedPhotos.length}枚</h3>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>RETAKE判定の写真は採用一覧へ入りません。</p>
          </div>
          <button type="button" style={buttonStyle} onClick={resetSession}>セッションをリセット</button>
        </div>

        {acceptedPhotos.length === 0 ? (
          <p style={{ color: '#64748b' }}>採用された写真はまだありません。</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginTop: 14 }}>
            {acceptedPhotos.map((photo) => (
              <article key={photo.id} style={{ background: '#020617', borderRadius: 10, padding: 10 }}>
                <img src={photo.finalDataUrl} alt={`採用写真 角度 ${photo.angleNumber}`} style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'contain' }} />
                <div style={{ marginTop: 8, fontSize: 13, color: '#cbd5e1' }}>
                  角度 {photo.angleNumber} · {photo.qa.decision}
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
