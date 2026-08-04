import React from 'react';
import { WatermarkConfig, BrandAssetRecord } from '../../types/brandAsset';
import { checkWatermarkSafety } from '../../services/brandAssetService';

interface WatermarkSafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalPhotoUrl: string;
  watermarkAsset: BrandAssetRecord;
  watermarkConfig: WatermarkConfig;
  onUpdateConfig: (newConfig: WatermarkConfig) => void;
}

export const WatermarkSafetyModal: React.FC<WatermarkSafetyModalProps> = ({
  isOpen,
  onClose,
  originalPhotoUrl,
  watermarkAsset,
  watermarkConfig,
  onUpdateConfig
}) => {
  if (!isOpen) return null;

  const safetyCheck = checkWatermarkSafety(watermarkConfig);

  const getPositionStyle = () => {
    const margin = `${watermarkConfig.marginPx}px`;
    switch (watermarkConfig.position) {
      case 'top-left':
        return { top: margin, left: margin };
      case 'top-right':
        return { top: margin, right: margin };
      case 'bottom-left':
        return { bottom: margin, left: margin };
      case 'bottom-right':
      default:
        return { bottom: margin, right: margin };
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-4xl w-full">
        <div className="modal-header space-between">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🛡️</span>
            <h2 className="modal-title text-base font-bold">
              ウォーターマーク安全制御 & 非破壊比較プレビュー (Watermark Inspection Guard)
            </h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="modal-body space-y-4 text-xs text-slate-300">
          {/* Notice Banner */}
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-1">
            <strong>🛡️ コンプライアンス保護ルール:</strong>
            <p className="text-muted">
              商品の「傷・汚れ・タグ・製造国刻印・シリアルナンバー・付属品表記」等の証拠箇所の上にウォーターマークを重ねることは禁止されています。
              元画像は一切変更せず、表示用派生プレビューのみに適用されます。
            </p>
          </div>

          {/* Controls Bar */}
          <div className="grid-3col gap-3 p-3 bg-slate-950 rounded border border-slate-800">
            <div>
              <label className="form-label block text-xs">透明度 (Opacity): {(watermarkConfig.opacity * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={watermarkConfig.opacity}
                onChange={(e) =>
                  onUpdateConfig({
                    ...watermarkConfig,
                    opacity: parseFloat(e.target.value)
                  })
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="form-label block text-xs">余白 (Margin): {watermarkConfig.marginPx}px</label>
              <input
                type="range"
                min="5"
                max="40"
                step="5"
                value={watermarkConfig.marginPx}
                onChange={(e) =>
                  onUpdateConfig({
                    ...watermarkConfig,
                    marginPx: parseInt(e.target.value, 10)
                  })
                }
                className="w-full"
              />
            </div>

            <div>
              <label className="form-label block text-xs">配置コーナー (Corner Position)</label>
              <select
                value={watermarkConfig.position}
                onChange={(e) =>
                  onUpdateConfig({
                    ...watermarkConfig,
                    position: e.target.value as any
                  })
                }
                className="form-control text-xs"
              >
                <option value="top-left">左上 (Top-Left)</option>
                <option value="top-right">右上 (Top-Right)</option>
                <option value="bottom-left">左下 (Bottom-Left)</option>
                <option value="bottom-right">右下 (Bottom-Right)</option>
              </select>
            </div>
          </div>

          {/* Obscure Simulation Toggle */}
          <div className="flex items-center space-x-3 p-2 bg-slate-900/50 rounded border border-slate-800">
            <input
              type="checkbox"
              id="evidenceObscureCheck"
              checked={watermarkConfig.isObscuringEvidenceDetected}
              onChange={(e) =>
                onUpdateConfig({
                  ...watermarkConfig,
                  isObscuringEvidenceDetected: e.target.checked
                })
              }
              className="custom-checkbox"
            />
            <label htmlFor="evidenceObscureCheck" className="text-xs text-amber-300 font-semibold cursor-pointer">
              ⚠️ 【テストシミュレーション】商品証拠領域（シリアル・傷・タグ）との被りを検出した状態にする
            </label>
          </div>

          {/* Safety Warning */}
          {!safetyCheck.isSafe && (
            <div className="p-3 bg-red-950/40 border border-red-500/50 text-red-300 rounded font-semibold text-xs">
              {safetyCheck.warningMessage}
            </div>
          )}

          {/* Side-by-side Comparison */}
          <div className="grid-2col gap-4 pt-2">
            {/* Left: Original Photo */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <strong className="text-emerald-400 font-mono text-xs">① 元画像 (Original Master) - 非破壊保持</strong>
                <span className="status-badge status-connected">✓ 原本保護済み</span>
              </div>
              <div className="relative border border-slate-700 rounded overflow-hidden bg-slate-950 aspect-video flex items-center justify-center">
                <img src={originalPhotoUrl} alt="Original Product" className="max-h-56 object-contain" />
              </div>
            </div>

            {/* Right: Branded Derivative Preview */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <strong className="text-sky-400 font-mono text-xs">② ブランド適用派生画像 (Branded Preview)</strong>
                <span className="text-xs text-muted">Asset: {watermarkAsset.fileName}</span>
              </div>
              <div className="relative border border-slate-700 rounded overflow-hidden bg-slate-950 aspect-video flex items-center justify-center">
                <img src={originalPhotoUrl} alt="Branded Product" className="max-h-56 object-contain" />

                {/* Overlay Watermark Logo if Safe */}
                {safetyCheck.isSafe && (
                  <div
                    className="absolute pointer-events-none transition-all duration-200"
                    style={{
                      ...getPositionStyle(),
                      opacity: watermarkConfig.opacity
                    }}
                  >
                    <img
                      src={watermarkAsset.path}
                      alt="Watermark Overlay"
                      className="h-10 w-auto drop-shadow-md"
                    />
                  </div>
                )}

                {!safetyCheck.isSafe && (
                  <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center text-center p-4 text-amber-400 font-bold text-xs">
                    ⛔ ウォーターマーク適用自動停止中<br />(証拠領域保護モード有効)
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer flex justify-between items-center">
          <span className="text-xs text-muted">
            ステータス: {watermarkAsset.status} ({watermarkAsset.version})
          </span>
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
