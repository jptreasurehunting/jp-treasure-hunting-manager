import React, { useState, useEffect, useMemo } from 'react';
import {
  NormalizedFulfillmentOrder,
  ShippingRouteDecision,
  PrinterProfile,
  FulfillmentAction,
  ReusablePackagingProfile,
  PackagingType
} from '../../types/shippingRouter';
import { SenderProfile } from '../../types/envelopeLayout';
import {
  loadFulfillmentOrders,
  evaluateShippingRoute,
  loadPrinterProfiles,
  savePrinterProfiles,
  loadPackagingKnowledge,
  savePackagingKnowledge,
  initShippingRouterHealthModule
} from '../../services/shippingRouterService';
import { loadSenderProfile, saveSenderProfile } from '../../services/envelopeLayoutService';
import { EnvelopePreviewModal } from './EnvelopePreviewModal';

interface ShippingRouterCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const ShippingRouterCard: React.FC<ShippingRouterCardProps> = ({ onAddAuditLog }) => {
  const [orders, setOrders] = useState<NormalizedFulfillmentOrder[]>(loadFulfillmentOrders());
  const [printerProfiles, setPrinterProfiles] = useState<PrinterProfile[]>(loadPrinterProfiles());
  const [packagingKnowledge, setPackagingKnowledge] = useState<ReusablePackagingProfile[]>(loadPackagingKnowledge());
  const [senderProfile, setSenderProfile] = useState<SenderProfile>(loadSenderProfile());
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.orderId || '');
  const [activeTab, setActiveTab] = useState<'orders' | 'printers' | 'knowledge' | 'sender'>('orders');
  const [filterAction, setFilterAction] = useState<FulfillmentAction | 'ALL'>('ALL');
  const [showProvenance, setShowProvenance] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = useState<NormalizedFulfillmentOrder | null>(null);

  useEffect(() => {
    initShippingRouterHealthModule();
  }, []);

  const decisions: ShippingRouteDecision[] = useMemo(() => {
    return orders.map((o) => evaluateShippingRoute(o));
  }, [orders, printerProfiles, packagingKnowledge]);

  const selectedDecision = useMemo(() => {
    return decisions.find((d) => d.orderId === selectedOrderId) || decisions[0];
  }, [decisions, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.orderId === selectedOrderId) || orders[0];
  }, [orders, selectedOrderId]);

  const counts = useMemo(() => {
    return {
      envelope: decisions.filter((d) => d.action === 'PRINT_ENVELOPE').length,
      parcel: decisions.filter((d) => d.action === 'CREATE_SHIPMENT_AND_PRINT_LABEL').length,
      manual: decisions.filter((d) => d.action === 'MANUAL_REVIEW').length,
      intl: decisions.filter((d) => d.action === 'INTERNATIONAL_SHIPMENT').length,
      ready: decisions.filter((d) => d.status === 'READY_FOR_EXECUTION').length
    };
  }, [decisions]);

  const filteredOrders = useMemo(() => {
    if (filterAction === 'ALL') return orders;
    return orders.filter((o) => {
      const dec = decisions.find((d) => d.orderId === o.orderId);
      return dec?.action === filterAction;
    });
  }, [orders, decisions, filterAction]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleResolveManualPackaging = (pkgType: PackagingType, action: FulfillmentAction, carrier: string) => {
    if (!selectedOrder.sku) return;
    const newProfile: ReusablePackagingProfile = {
      skuOrCategory: selectedOrder.sku,
      maxUnitsForEnvelope: action === 'PRINT_ENVELOPE' ? 2 : 0,
      preferredPackaging: pkgType,
      preferredFulfillmentAction: action,
      preferredCarrier: carrier,
      suggestedPrinterRoleId: action === 'PRINT_ENVELOPE' ? 'envelope' : 'label',
      lastConfirmedDate: new Date().toISOString().split('T')[0],
      confirmedBy: 'User Quick Resolution'
    };

    const updated = [...packagingKnowledge.filter((k) => k.skuOrCategory !== selectedOrder.sku), newProfile];
    savePackagingKnowledge(updated);
    setPackagingKnowledge(updated);
    showToast(`✅ [${selectedOrder.sku}] の梱包プロファイルを保存しました。次回以降は全自動で判定されます。`);
    if (onAddAuditLog) {
      onAddAuditLog(`ShippingRouter: Resolved packaging for ${selectedOrder.sku}`, undefined, pkgType);
    }
  };

  const handleUpdatePrinterName = (profileId: string, newName: string) => {
    const updated = printerProfiles.map((p) => (p.profileId === profileId ? { ...p, windowsPrinterName: newName } : p));
    savePrinterProfiles(updated);
    setPrinterProfiles(updated);
    showToast(`🖨️ プリンタ設定を更新しました: ${newName}`);
  };

  const handleSaveSenderProfile = (updated: SenderProfile) => {
    saveSenderProfile(updated);
    setSenderProfile(updated);
    showToast('📭 差出人情報を更新しました');
  };

  return (
    <div className="shipping-router-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>🚦</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Envelope Preview Modal (Safe Test Mode) */}
      {previewOrder && (
        <EnvelopePreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🚦</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Automated Domestic Shipping Router (汎用シッピング・ルーター ＆ 自動フルフィルメント基盤)
            </h3>
            <p className="text-[11px] text-slate-400">
              国内/国際・梱包形態・数量・配送方法から最適なフルフィルメントアクション（封筒直接印刷・段ボール小包・レターパック・QR便）を自動判定します。
            </p>
          </div>
        </div>

        {/* Action Counters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 shadow">
            ✉️ 封筒直接印刷: {counts.envelope}件
          </span>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
            📦 段ボール小包: {counts.parcel}件
          </span>
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950 px-2.5 py-1 rounded border border-amber-800">
            ⚠️ 要確認: {counts.manual}件
          </span>
          <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950 px-2.5 py-1 rounded border border-purple-800">
            🌐 国際配送: {counts.intl}件
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'orders' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('orders')}
        >
          📋 受注ルーティング判定一覧 ({orders.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'printers' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('printers')}
        >
          🖨️ Windows プリンタプロファイル ({printerProfiles.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'knowledge' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('knowledge')}
        >
          📚 登録済み梱包ナレッジ ({packagingKnowledge.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'sender' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('sender')}
        >
          📭 差出人情報設定
        </button>
      </div>

      {/* TAB 1: 受注ルーティング判定一覧 */}
      {activeTab === 'orders' && (
        <div className="space-y-3">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterAction === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
              onClick={() => setFilterAction('ALL')}
            >
              全件 ({orders.length})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterAction === 'PRINT_ENVELOPE' ? 'bg-emerald-900 text-emerald-200 border border-emerald-700' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
              onClick={() => setFilterAction('PRINT_ENVELOPE')}
            >
              ✉️ 封筒印刷 ({counts.envelope})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterAction === 'CREATE_SHIPMENT_AND_PRINT_LABEL' ? 'bg-cyan-900 text-cyan-200 border border-cyan-700' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
              onClick={() => setFilterAction('CREATE_SHIPMENT_AND_PRINT_LABEL')}
            >
              📦 段ボール小包 ({counts.parcel})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterAction === 'MANUAL_REVIEW' ? 'bg-amber-900 text-amber-200 border border-amber-700' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
              onClick={() => setFilterAction('MANUAL_REVIEW')}
            >
              ⚠️ 要確認 ({counts.manual})
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded text-xs font-bold ${
                filterAction === 'INTERNATIONAL_SHIPMENT' ? 'bg-purple-900 text-purple-200 border border-purple-700' : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
              }`}
              onClick={() => setFilterAction('INTERNATIONAL_SHIPMENT')}
            >
              🌐 国際配送 ({counts.intl})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {/* Left: Order Selection List (4 cols) */}
            <div className="md:col-span-4 space-y-2">
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredOrders.map((order) => {
                  const dec = decisions.find((d) => d.orderId === order.orderId);
                  const isSelected = order.orderId === selectedOrderId;

                  return (
                    <div
                      key={order.orderId}
                      className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-slate-800 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                      }`}
                      onClick={() => setSelectedOrderId(order.orderId)}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[10px] text-cyan-400 font-bold">
                          [{order.salesChannel}] {order.orderNumber}
                        </span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            dec?.action === 'PRINT_ENVELOPE'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : dec?.action === 'CREATE_SHIPMENT_AND_PRINT_LABEL'
                              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                              : dec?.action === 'MANUAL_REVIEW'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-purple-950 text-purple-300 border border-purple-800'
                          }`}
                        >
                          {dec?.action}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-200 font-medium line-clamp-2 mt-1">{order.itemTitle}</p>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 mt-1 border-t border-slate-900">
                        <span>数量: {order.quantity}点</span>
                        <span className="font-bold text-slate-200">{order.buyerName || '(宛名未入力)'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Detailed Routing Decision (8 cols) */}
            {selectedDecision && selectedOrder && (
              <div className="md:col-span-8 space-y-3">
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold">決定アクション:</span>
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded font-mono ${
                          selectedDecision.action === 'PRINT_ENVELOPE'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : selectedDecision.action === 'CREATE_SHIPMENT_AND_PRINT_LABEL'
                            ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                            : selectedDecision.action === 'MANUAL_REVIEW'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-purple-950 text-purple-300 border border-purple-800'
                        }`}
                      >
                        {selectedDecision.actionLabelJa}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-cyan-300">
                      ハッシュ: {selectedDecision.idempotencyHash}
                    </span>
                  </div>

                  {/* Manual Review Guidance Box */}
                  {selectedDecision.requiresHumanReview && selectedDecision.actionRequiredReasonJa && (
                    <div className="p-3 bg-amber-950/40 rounded-lg border border-amber-800 space-y-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <span>⚠️</span>
                        <span>要人間確認 (Action Required): {selectedDecision.actionRequiredReasonJa}</span>
                      </div>

                      {/* Quick Resolution Buttons for Unknown SKU */}
                      {selectedDecision.matchedRuleSource.includes('First-time') && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] text-slate-300 font-bold">この商品の標準梱包を選択してナレッジ登録:</span>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-emerald-800 hover:bg-emerald-700 text-slate-100 rounded text-[10px] font-bold"
                              onClick={() => handleResolveManualPackaging('ENVELOPE_NAGAGATA_3', 'PRINT_ENVELOPE', '日本郵便 (普通郵便)')}
                            >
                              ✉️ 封筒 (長形3号 直接印刷)
                            </button>
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-cyan-800 hover:bg-cyan-700 text-slate-100 rounded text-[10px] font-bold"
                              onClick={() => handleResolveManualPackaging('BOX_60_SIZE', 'CREATE_SHIPMENT_AND_PRINT_LABEL', 'ヤマト運輸 (宅急便 60サイズ)')}
                            >
                              📦 60サイズ 段ボール小包
                            </button>
                            <button
                              type="button"
                              className="px-2.5 py-1 bg-purple-800 hover:bg-purple-700 text-slate-100 rounded text-[10px] font-bold"
                              onClick={() => handleResolveManualPackaging('LETTER_PACK_LIGHT', 'PRINT_SHIPPING_LABEL', '日本郵便 (レターパックライト)')}
                            >
                              📮 レターパックライト
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Order & Address Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-900 text-[10px]">
                    <div>
                      <span className="text-slate-400">モール / 注文:</span>
                      <div className="font-bold text-slate-100">{selectedOrder.salesChannel} ({selectedOrder.orderNumber})</div>
                    </div>
                    <div>
                      <span className="text-slate-400">購入数量 / 金額:</span>
                      <div className="font-bold text-emerald-300">{selectedOrder.quantity}点 ({selectedOrder.unitPriceJpyOrUsd.toLocaleString()} {selectedOrder.currency})</div>
                    </div>
                    <div>
                      <span className="text-slate-400">梱包タイプ:</span>
                      <div className="font-bold text-cyan-300">{selectedDecision.packagingLabelJa}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">選定配送便:</span>
                      <div className="font-bold text-slate-100">{selectedDecision.selectedServiceMethod || selectedDecision.carrierName}</div>
                    </div>
                  </div>

                  {/* Recipient Address */}
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-[11px] space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-400">配送先宛名:</span>
                      <span className="font-mono text-cyan-300">{selectedOrder.postalCode ? `〒${selectedOrder.postalCode}` : '(郵便番号欠損)'}</span>
                    </div>
                    <p className="font-bold text-slate-100">{selectedOrder.buyerName ? `${selectedOrder.buyerName} 様` : '(氏名欠損)'}</p>
                    <p className="text-slate-300">
                      {selectedOrder.stateOrProvince} {selectedOrder.city} {selectedOrder.addressLine1} {selectedOrder.addressLine2 || ''}
                    </p>
                  </div>

                  {/* Assigned Windows Printer Profile */}
                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between items-center text-[11px]">
                    <div>
                      <span className="text-slate-400 font-bold">自動割当プリンタプロファイル:</span>
                      <div className="text-slate-100 font-bold">{selectedDecision.assignedPrinterProfile?.profileName || '未割当'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Windows設定名: <span className="text-cyan-300">{selectedDecision.assignedPrinterProfile?.windowsPrinterName}</span> | 給紙: {selectedDecision.assignedPrinterProfile?.trayName}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                      役割: {selectedDecision.assignedPrinterProfile?.targetRole}
                    </span>
                  </div>

                  {/* Phase B: Interactive Envelope Preview Button */}
                  {selectedDecision.action === 'PRINT_ENVELOPE' && (
                    <div className="pt-2 border-t border-slate-900 flex justify-end">
                      <button
                        type="button"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg transition-all"
                        onClick={() => setPreviewOrder(selectedOrder)}
                      >
                        <span>✉️</span>
                        <span>封筒レイアウトプレビュー ＆ 安全テスト印刷 (Safe Test Mode)</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Decision Provenance Section */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <button
                    type="button"
                    className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 text-[11px]"
                    onClick={() => setShowProvenance(!showProvenance)}
                  >
                    <span>🧠</span>
                    <span>{showProvenance ? '決定根拠 (Provenance) を閉じる ▲' : 'このルーティングは何を根拠に決定しましたか？ (根拠を見る) ▼'}</span>
                  </button>

                  {showProvenance && (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-slate-400 font-bold">照合ナレッジソース:</span>
                        <span className="text-cyan-300 ml-1.5 font-mono">{selectedDecision.matchedRuleSource}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold">決定論的推論理由:</span>
                        <span className="text-slate-200 ml-1.5">{selectedDecision.decisionProvenanceJa}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                        自動実行安全性: {selectedDecision.isSafeForAutomaticExecution ? '🟢 安全 (Safe for Auto)' : '⛔ 要確認 (Hold)'} | 重複防止キー: {selectedDecision.idempotencyHash}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Windows プリンタプロファイル管理 */}
      {activeTab === 'printers' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>🖨️</span>
              <span>Windows プリンタプロファイル設定</span>
            </h4>
            <span className="text-xs text-slate-400">ハードコードを排除し、Windows上の実プリンタ名と給紙トレイを柔軟にマッピング</span>
          </div>

          <div className="space-y-3">
            {printerProfiles.map((p) => (
              <div key={p.profileId} className="p-3.5 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-xs">{p.profileName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                      役割: {p.targetRole}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">用紙: {p.paperSize}</span>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[10px] text-slate-400 font-bold min-w-[130px]">Windows プリンタ名:</span>
                  <input
                    type="text"
                    className="flex-1 p-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs font-mono"
                    defaultValue={p.windowsPrinterName}
                    onBlur={(e) => handleUpdatePrinterName(p.profileId, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: 登録済み梱包ナレッジ */}
      {activeTab === 'knowledge' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📚</span>
              <span>再利用可能 梱包 ＆ シッピングナレッジ (Packaging Knowledge Profiles)</span>
            </h4>
            <span className="text-xs text-slate-400">過去に確定した梱包実績を自動再利用し、重複確認をゼロ化</span>
          </div>

          <div className="space-y-2">
            {packagingKnowledge.map((k) => (
              <div key={k.skuOrCategory} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 font-mono text-xs">{k.skuOrCategory}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                      {k.preferredPackaging}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    配送便: {k.preferredCarrier} | 封筒上限: {k.maxUnitsForEnvelope > 0 ? `${k.maxUnitsForEnvelope}点まで` : '封筒不可(段ボール)'} | 確定者: {k.confirmedBy}
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded bg-slate-900 text-emerald-300 border border-slate-800">
                  {k.preferredFulfillmentAction}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: 差出人情報設定 (Phase B) */}
      {activeTab === 'sender' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📭</span>
              <span>差出人情報設定 (Sender Information Profile)</span>
            </h4>
            <span className="text-xs text-slate-400">封筒表面の左下や裏面に印字される自社ショップ情報</span>
          </div>

          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 max-w-xl">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">ショップ名 / 屋号:</label>
                <input
                  type="text"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                  defaultValue={senderProfile.shopName}
                  onChange={(e) => setSenderProfile({ ...senderProfile, shopName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">担当者 / センター名:</label>
                <input
                  type="text"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                  defaultValue={senderProfile.senderName}
                  onChange={(e) => setSenderProfile({ ...senderProfile, senderName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">郵便番号:</label>
                <input
                  type="text"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs font-mono"
                  defaultValue={senderProfile.postalCode}
                  onChange={(e) => setSenderProfile({ ...senderProfile, postalCode: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">都道府県:</label>
                <input
                  type="text"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                  defaultValue={senderProfile.stateOrProvince}
                  onChange={(e) => setSenderProfile({ ...senderProfile, stateOrProvince: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold">市区町村:</label>
                <input
                  type="text"
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                  defaultValue={senderProfile.city}
                  onChange={(e) => setSenderProfile({ ...senderProfile, city: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">番地・建物名:</label>
              <input
                type="text"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs"
                defaultValue={`${senderProfile.addressLine1} ${senderProfile.addressLine2 || ''}`}
                onChange={(e) => setSenderProfile({ ...senderProfile, addressLine1: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold">電話番号 (任意):</label>
              <input
                type="text"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs font-mono"
                defaultValue={senderProfile.phoneNumber}
                onChange={(e) => setSenderProfile({ ...senderProfile, phoneNumber: e.target.value })}
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs shadow transition-all"
                onClick={() => handleSaveSenderProfile(senderProfile)}
              >
                💾 差出人情報を保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
