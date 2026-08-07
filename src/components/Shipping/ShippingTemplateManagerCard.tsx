import React, { useState, useMemo } from 'react';
import { ShippingTemplate } from '../../types/shippingTemplate';
import {
  loadShippingTemplates,
  saveShippingTemplates,
  generateFullShippingDescriptionSection,
  generatePostDispatchBuyerMessage,
  validateShippingTemplateGate
} from '../../services/shippingTemplateService';
import { DutyTerm } from '../../types/shippingRegistry';

export const ShippingTemplateManagerCard: React.FC = () => {
  const [templates, setTemplates] = useState<ShippingTemplate[]>(loadShippingTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('tpl_jp_sea_mail');
  const [dutyTerm, setDutyTerm] = useState<DutyTerm>('DDP');
  const [isDdpConfirmed, setIsDdpConfirmed] = useState<boolean>(true);
  const [rawItemDescription, setRawItemDescription] = useState<string>('Authentic Japanese Vintage Collectible, carefully packed and shipped from Japan.');

  // Dispatch message generator state
  const [dispatchOrderId, setDispatchOrderId] = useState<string>('ORDER-2026-8801');
  const [dispatchTracking, setDispatchTracking] = useState<string>('EL123456789JP');
  const [generatedBuyerMessage, setGeneratedBuyerMessage] = useState<string>('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const selectedTemplate = useMemo(() => {
    return templates.find((t) => t.templateId === selectedTemplateId) || templates[0];
  }, [templates, selectedTemplateId]);

  // Generate Full Description Section Preview
  const generatedSection = useMemo(() => {
    return generateFullShippingDescriptionSection(selectedTemplate, dutyTerm, isDdpConfirmed, rawItemDescription);
  }, [selectedTemplate, dutyTerm, isDdpConfirmed, rawItemDescription]);

  // Template Validation Gate
  const validationGate = useMemo(() => {
    return validateShippingTemplateGate(selectedTemplate, dutyTerm, selectedTemplate.isDomestic);
  }, [selectedTemplate, dutyTerm]);

  const handleUpdateSelectedTemplate = (updated: ShippingTemplate) => {
    const updatedList = templates.map((t) => (t.templateId === updated.templateId ? updated : t));
    setTemplates(updatedList);
    saveShippingTemplates(updatedList);
  };

  const handleGenerateDispatchMessage = () => {
    const msgObj = generatePostDispatchBuyerMessage(
      dispatchOrderId,
      dispatchTracking,
      selectedTemplate.carrier,
      selectedTemplate.estimatedDeliveryText,
      dutyTerm === 'DDP' && isDdpConfirmed
    );
    setGeneratedBuyerMessage(msgObj.buyerMessage);
    showToast('✉️ 出荷完了後のバイヤー宛通知メッセージを自動生成しました！');
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">📜</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">配送テンプレートマネージャー &amp; 出品文言自動生成</h3>
            <p className="text-[11px] text-slate-400">配送方法に応じた正確なお届け日数・追跡・DDP文言を商品説明の直前に自動挿入します。</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-300">テンプレート選択:</span>
          <select
            className="form-control text-xs bg-slate-950 border-slate-700 text-amber-300 font-bold px-2 py-1 rounded"
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.templateId} value={t.templateId}>
                {t.serviceTitle} ({t.carrier}) [{t.isActive ? '🟢 有効' : '⚪ 無効'}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template Editor Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Left Column: Editable Template Fields */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
          <strong className="text-emerald-400 font-bold block text-sm pb-1 border-b border-slate-800">
            ✏️ 配送テンプレートの編集 ({selectedTemplate.serviceTitle})
          </strong>

          <div>
            <label className="font-bold text-slate-300 block">配送サービス表示タイトル (Shipping Method Title)</label>
            <input
              type="text"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              value={selectedTemplate.serviceTitle}
              onChange={(e) => handleUpdateSelectedTemplate({ ...selectedTemplate, serviceTitle: e.target.value })}
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block">お届け予定日数記述 (Estimated Delivery Text)</label>
            <input
              type="text"
              className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-amber-300 font-bold"
              value={selectedTemplate.estimatedDeliveryText}
              onChange={(e) => handleUpdateSelectedTemplate({ ...selectedTemplate, estimatedDeliveryText: e.target.value })}
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block">追跡情報に関する記述 (Tracking Paragraph)</label>
            <textarea
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200 w-full p-2 rounded"
              rows={2}
              value={selectedTemplate.trackingParagraph}
              onChange={(e) => handleUpdateSelectedTemplate({ ...selectedTemplate, trackingParagraph: e.target.value })}
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block">遅延注意に関する記述 (Delay Paragraph)</label>
            <textarea
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200 w-full p-2 rounded"
              rows={2}
              value={selectedTemplate.delayParagraph}
              onChange={(e) => handleUpdateSelectedTemplate({ ...selectedTemplate, delayParagraph: e.target.value })}
            />
          </div>

          <div>
            <label className="font-bold text-slate-300 block">オプション補足ノート (船便の送料節約説明等)</label>
            <input
              type="text"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-300"
              placeholder="例: Sea Mail is selected to keep international shipping costs as low as possible."
              value={selectedTemplate.optionalCostSavingNote || ''}
              onChange={(e) => handleUpdateSelectedTemplate({ ...selectedTemplate, optionalCostSavingNote: e.target.value })}
            />
          </div>

          <div className="flex justify-between items-center pt-1 border-t border-slate-800">
            <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedTemplate.isActive}
                onChange={(e) => handleUpdateSelectedTemplate({ ...selectedTemplate, isActive: e.target.checked })}
              />
              <span className="font-bold">このテンプレートを有効にする</span>
            </label>

            <span className="text-[10px] text-slate-400 font-mono">
              更新日時: {new Date(selectedTemplate.lastUpdated).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Right Column: Full Markdown Generated Preview */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
          <div className="flex justify-between items-center pb-1 border-b border-slate-800">
            <strong className="text-blue-400 font-bold block text-sm">
              👁️ 自動生成された商品説明用 Markdown プレビュー
            </strong>
            <span className="text-[10px] text-emerald-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-bold">
              Shipping Information 先頭自動挿入
            </span>
          </div>

          <textarea
            className="form-control text-xs font-mono bg-slate-900 border-slate-800 text-emerald-300 w-full p-2.5 rounded h-[280px]"
            readOnly
            value={generatedSection.fullMarkdownText}
          />
        </div>
      </div>

      {/* Dispatch Message Generator Component */}
      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
        <strong className="text-amber-300 font-bold block text-sm flex items-center gap-1">
          <span>✉️</span>
          <span>出荷完了後 バイヤー通知メッセージ自動生成 (Shipment Notification Generator)</span>
        </strong>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-slate-200"
            placeholder="注文番号 (Order ID)"
            value={dispatchOrderId}
            onChange={(e) => setDispatchOrderId(e.target.value)}
          />
          <input
            type="text"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-slate-200"
            placeholder="追跡番号 (Tracking Number)"
            value={dispatchTracking}
            onChange={(e) => setDispatchTracking(e.target.value)}
          />
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1 bg-amber-950 border-amber-600/60 text-amber-300 hover:bg-amber-900"
            onClick={handleGenerateDispatchMessage}
          >
            ⚡ 出荷メッセージを生成
          </button>
        </div>

        {generatedBuyerMessage && (
          <div className="space-y-1">
            <textarea
              className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-slate-200 w-full p-2 rounded"
              rows={5}
              readOnly
              value={generatedBuyerMessage}
            />
          </div>
        )}
      </div>

      {/* Template Validation Gate */}
      {!validationGate.isValid && (
        <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-lg text-red-200 text-xs font-semibold space-y-1">
          <strong className="block text-red-300 font-bold">🛑 発送テンプレートバリデーションエラー</strong>
          {validationGate.errors.map((err, idx) => (
            <div key={idx} className="flex items-center space-x-2">
              <span>❌</span>
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
