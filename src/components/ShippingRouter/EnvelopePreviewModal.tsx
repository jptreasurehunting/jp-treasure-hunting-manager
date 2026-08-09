import React, { useState, useMemo } from 'react';
import { NormalizedFulfillmentOrder, PackagingType } from '../../types/shippingRouter';
import { EnvelopePrintSettings, SenderProfile } from '../../types/envelopeLayout';
import {
  generateEnvelopeLayout,
  simulateEnvelopePrintJob,
  loadSenderProfile,
  getDefaultEnvelopePrintSettings
} from '../../services/envelopeLayoutService';

interface EnvelopePreviewModalProps {
  order: NormalizedFulfillmentOrder;
  onClose: () => void;
}

export const EnvelopePreviewModal: React.FC<EnvelopePreviewModalProps> = ({ order, onClose }) => {
  const [envelopeType, setEnvelopeType] = useState<PackagingType>('ENVELOPE_NAGAGATA_3');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [includeItemSummary, setIncludeItemSummary] = useState<boolean>(true);
  const [includeSenderInfo, setIncludeSenderInfo] = useState<boolean>(true);
  const [fontSizeScale, setFontSizeScale] = useState<number>(1.0);
  const [simulationLog, setSimulationLog] = useState<string | null>(null);

  const sender: SenderProfile = useMemo(() => loadSenderProfile(), []);

  const settings: EnvelopePrintSettings = useMemo(() => {
    return {
      envelopeType,
      orientation,
      includeItemSummary,
      includeSenderInfo,
      fontSizeScale,
      offsetXmm: 0,
      offsetYmm: 0
    };
  }, [envelopeType, orientation, includeItemSummary, includeSenderInfo, fontSizeScale]);

  const payload = useMemo(() => {
    return generateEnvelopeLayout(order, settings, sender);
  }, [order, settings, sender]);

  const handleSimulatePrint = () => {
    const res = simulateEnvelopePrintJob(order, settings);
    setSimulationLog(res.simulationMessageJa);
  };

  // Dimensions for visual preview container
  const isKakugata = envelopeType === 'ENVELOPE_KAKUGATA_2';
  const previewWidthPx = isKakugata ? 360 : 280;
  const previewHeightPx = isKakugata ? 500 : 550;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full p-5 shadow-2xl space-y-4 text-xs max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">✉️</span>
            <div>
              <h3 className="font-black text-sm text-slate-100">
                封筒ベクターレイアウト リアルタイムプレビュー (Safe Test Mode)
              </h3>
              <p className="text-[11px] text-slate-400">
                ミリ単位の郵便番号赤枠ピッチ・縦書き/横書き・差出人情報の配置を画面上で安全に検証します。（物理印刷は行われません）
              </p>
            </div>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 text-lg font-bold px-2.5 py-1 rounded bg-slate-800"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {simulationLog && (
          <div className="p-3 bg-emerald-950 border border-emerald-700 text-emerald-200 rounded-lg text-xs font-bold flex items-center gap-2">
            <span>🛡️</span>
            <span>{simulationLog}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Left: Interactive Real-Time Envelope Vector Canvas (7 cols) */}
          <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div
              className="relative shadow-2xl rounded-sm transition-all text-slate-900 overflow-hidden select-none border border-amber-200"
              style={{
                width: `${previewWidthPx}px`,
                height: `${previewHeightPx}px`,
                backgroundColor: '#fffdf5', // Natural Japanese envelope paper color
                fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif'
              }}
            >
              {/* 1. Postal Code 7-Digit Red Boxes (Japan Post Standard Pitch) */}
              <div
                className="absolute flex items-center"
                style={{
                  top: '24px',
                  right: '28px',
                  gap: '3px'
                }}
              >
                {/* 3 Digits Group */}
                <div className="flex gap-[3px]">
                  {payload.recipient.postalMetrics.digits.slice(0, 3).map((d, i) => (
                    <div
                      key={`box1_${i}`}
                      className="w-[16px] h-[22px] border border-red-500 rounded-[1px] flex items-center justify-center font-mono font-bold text-[14px] text-slate-950"
                      style={{ color: '#111827' }}
                    >
                      {d !== ' ' ? d : ''}
                    </div>
                  ))}
                </div>

                {/* Hyphen Gap */}
                <span className="text-red-500 font-bold text-[10px] px-[1px]">-</span>

                {/* 4 Digits Group */}
                <div className="flex gap-[3px]">
                  {payload.recipient.postalMetrics.digits.slice(3, 7).map((d, i) => (
                    <div
                      key={`box2_${i}`}
                      className="w-[16px] h-[22px] border border-red-500 rounded-[1px] flex items-center justify-center font-mono font-bold text-[14px] text-slate-950"
                      style={{ color: '#111827' }}
                    >
                      {d !== ' ' ? d : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Recipient Address & Name Body */}
              {orientation === 'vertical' ? (
                /* Vertical Writing Mode (Japanese Traditional) */
                <div
                  className="absolute inset-0 pt-16 pb-20 px-8 flex flex-row-reverse justify-start items-start gap-4"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  {/* Address Line 1 (Prefecture, City, Block) */}
                  <div
                    className="font-medium text-[13px] tracking-widest text-slate-900 leading-relaxed max-h-[380px]"
                    style={{ fontSize: `${13 * fontSizeScale}px` }}
                  >
                    {payload.recipient.addressLine1}
                  </div>

                  {/* Address Line 2 (Building / Apt) */}
                  {payload.recipient.addressLine2 && (
                    <div
                      className="font-medium text-[12px] tracking-widest text-slate-800 leading-relaxed max-h-[360px] pt-4"
                      style={{ fontSize: `${12 * fontSizeScale}px` }}
                    >
                      {payload.recipient.addressLine2}
                    </div>
                  )}

                  {/* Recipient Full Name + '様' */}
                  <div
                    className="font-bold text-[20px] tracking-[0.25em] text-slate-950 pt-8"
                    style={{ fontSize: `${20 * fontSizeScale}px` }}
                  >
                    {payload.recipient.fullName} <span className="text-[17px]">様</span>
                  </div>
                </div>
              ) : (
                /* Horizontal Writing Mode */
                <div className="absolute inset-0 pt-20 pb-20 px-6 flex flex-col justify-center items-start space-y-3">
                  <div className="text-[11px] font-mono font-bold text-slate-800">
                    {payload.recipient.postalCodeFormatted}
                  </div>
                  <div className="text-[13px] font-medium text-slate-900 leading-snug">
                    {payload.recipient.fullAddressFormatted}
                  </div>
                  <div className="text-[20px] font-bold text-slate-950 pt-2">
                    {payload.recipient.fullName} <span className="text-[16px]">様</span>
                  </div>
                </div>
              )}

              {/* 3. Sender Information (Bottom-Left) */}
              {includeSenderInfo && payload.sender && (
                <div
                  className="absolute bottom-4 left-4 p-2 bg-amber-50/60 rounded border border-amber-200/60 text-[9px] text-slate-700 leading-tight space-y-0.5"
                  style={{ maxWidth: '160px', writingMode: 'horizontal-tb' }}
                >
                  <div className="font-bold text-slate-900">{payload.sender.shopName}</div>
                  <div>〒{payload.sender.postalCode} {payload.sender.stateOrProvince}{payload.sender.city}{payload.sender.addressLine1}</div>
                  {payload.sender.phoneNumber && <div>TEL: {payload.sender.phoneNumber}</div>}
                </div>
              )}

              {/* 4. Item Title & Order Number Verification Note (Bottom-Right) */}
              {includeItemSummary && payload.itemSummary && (
                <div
                  className="absolute bottom-4 right-4 p-1.5 bg-slate-100 rounded text-[9px] text-slate-500 font-mono"
                  style={{ maxWidth: '140px', writingMode: 'horizontal-tb' }}
                >
                  <div className="font-bold truncate text-slate-700">{payload.itemSummary.itemTitle}</div>
                  <div>注文: {payload.itemSummary.orderNumber} ({payload.itemSummary.quantity}点)</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Layout Customization Controls & Test Simulation (5 cols) */}
          <div className="md:col-span-5 space-y-3.5">
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span>⚙️</span>
                <span>封筒レイアウト設定 (Live Settings)</span>
              </h4>

              {/* Envelope Type Selector */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">封筒種別:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                  value={envelopeType}
                  onChange={(e) => setEnvelopeType(e.target.value as PackagingType)}
                >
                  <option value="ENVELOPE_NAGAGATA_3">長形3号 封筒 (120x235mm, A4三つ折り標準)</option>
                  <option value="ENVELOPE_NAGAGATA_4">長形4号 封筒 (90x205mm, B5四つ折り)</option>
                  <option value="ENVELOPE_KAKUGATA_2">角形2号 封筒 (240x332mm, A4そのまま)</option>
                  <option value="PADDED_MAILER">クッション封筒 (150x240mm)</option>
                </select>
              </div>

              {/* Orientation Toggle */}
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">印字向き:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={`py-1.5 rounded font-bold text-xs ${
                      orientation === 'vertical'
                        ? 'bg-cyan-700 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                    onClick={() => setOrientation('vertical')}
                  >
                    📝 縦書き (和文標準)
                  </button>
                  <button
                    type="button"
                    className={`py-1.5 rounded font-bold text-xs ${
                      orientation === 'horizontal'
                        ? 'bg-cyan-700 text-slate-950'
                        : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
                    }`}
                    onClick={() => setOrientation('horizontal')}
                  >
                    📄 横書き
                  </button>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-slate-900">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSenderInfo}
                    onChange={(e) => setIncludeSenderInfo(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span className="text-slate-200">差出人情報 (ショップ名・住所) を印字する</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeItemSummary}
                    onChange={(e) => setIncludeItemSummary(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-cyan-500"
                  />
                  <span className="text-slate-200">品名 ＆ 注文番号の注記を印字する (誤封入防止)</span>
                </label>
              </div>

              {/* Font Scale Slider */}
              <div className="space-y-1 pt-1 border-t border-slate-900">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-bold">文字サイズ微調整:</span>
                  <span className="font-mono text-cyan-300">{Math.round(fontSizeScale * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.2"
                  step="0.05"
                  value={fontSizeScale}
                  onChange={(e) => setFontSizeScale(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Safe Test Mode Action (Spec: No physical printing) */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-cyan-800/60 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛡️</span>
                <div>
                  <h5 className="font-bold text-slate-100">安全テストモード実行 (Test Mode)</h5>
                  <p className="text-[10px] text-slate-400">物理プリンタへは出力せず、レイアウト妥当性をシミュレーション検証します。</p>
                </div>
              </div>

              <button
                type="button"
                className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black rounded-lg text-xs shadow-lg transition-all"
                onClick={handleSimulatePrint}
              >
                🧪 安全テストモードで印刷シミュレーションを実行
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg text-xs"
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
