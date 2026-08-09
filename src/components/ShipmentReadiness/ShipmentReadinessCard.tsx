import React, { useState, useEffect, useMemo } from 'react';
import {
  NormalizedEbayOrder,
  ShipmentReadinessEvaluationResult,
  ShipmentReadinessState
} from '../../types/shipmentReadiness';
import {
  loadNormalizedEbayOrders,
  evaluateOrderShipmentReadiness,
  initShipmentReadinessHealthModule
} from '../../services/shipmentReadinessService';

interface ShipmentReadinessCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const ShipmentReadinessCard: React.FC<ShipmentReadinessCardProps> = ({ onAddAuditLog }) => {
  const [orders] = useState<NormalizedEbayOrder[]>(loadNormalizedEbayOrders());
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.orderId || '');
  const [filterState, setFilterState] = useState<ShipmentReadinessState | 'ALL'>('ALL');
  const [showProvenance, setShowProvenance] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    initShipmentReadinessHealthModule();
  }, []);

  const evaluations: ShipmentReadinessEvaluationResult[] = useMemo(() => {
    return orders.map((o) => evaluateOrderShipmentReadiness(o));
  }, [orders]);

  const selectedEvaluation = useMemo(() => {
    return evaluations.find((e) => e.orderId === selectedOrderId) || evaluations[0];
  }, [evaluations, selectedOrderId]);

  const selectedOrder = useMemo(() => {
    return orders.find((o) => o.orderId === selectedOrderId) || orders[0];
  }, [orders, selectedOrderId]);

  const counts = useMemo(() => {
    return {
      ready: evaluations.filter((e) => e.state === 'READY').length,
      waiting: evaluations.filter((e) => e.state === 'WAITING_FOR_DATA').length,
      review: evaluations.filter((e) => e.state === 'NEEDS_REVIEW').length,
      blocked: evaluations.filter((e) => e.state === 'BLOCKED').length
    };
  }, [evaluations]);

  const filteredOrders = useMemo(() => {
    if (filterState === 'ALL') return orders;
    return orders.filter((o) => {
      const ev = evaluations.find((e) => e.orderId === o.orderId);
      return ev?.state === filterState;
    });
  }, [orders, evaluations, filterState]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSimulateAction = (actionName: string) => {
    showToast(`🔒 Phase 1: 安全自動化ポリシーに基づき計算・書類生成を完了 (実決済・外部ラベル購入はPhase 2)`);
    if (onAddAuditLog) {
      onAddAuditLog(`ShipmentReadiness: ${actionName} for ${selectedOrderId}`, undefined, selectedEvaluation.state);
    }
  };

  return (
    <div className="shipment-readiness-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>📦</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">📦</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Order Fulfillment &amp; Shipment Readiness Gate (統合受注・出荷準備 ＆ 通関書類自動生成)
            </h3>
            <p className="text-[11px] text-slate-400">
              eBay受注から品目正規化・Zonos 1/3申告・FedEx Watch Worksheet 3分割・真贋鑑定ハブ住所を一気通貫で自動突合します。
            </p>
          </div>
        </div>

        {/* 4-State Pill Counters (Spec #1) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 shadow">
            🟢 準備完了: {counts.ready}件
          </span>
          <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
            ⚪ データ待機: {counts.waiting}件
          </span>
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950 px-2.5 py-1 rounded border border-amber-800">
            🟡 要レビュー: {counts.review}件
          </span>
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950 px-2.5 py-1 rounded border border-rose-800">
            🔴 停止: {counts.blocked}件
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            filterState === 'ALL' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setFilterState('ALL')}
        >
          全受注 ({orders.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            filterState === 'READY' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setFilterState('READY')}
        >
          🟢 出荷準備完了 ({counts.ready})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            filterState === 'WAITING_FOR_DATA' ? 'bg-slate-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setFilterState('WAITING_FOR_DATA')}
        >
          ⚪ データ待機中 ({counts.waiting})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            filterState === 'NEEDS_REVIEW' ? 'bg-amber-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setFilterState('NEEDS_REVIEW')}
        >
          🟡 要人間レビュー ({counts.review})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            filterState === 'BLOCKED' ? 'bg-rose-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setFilterState('BLOCKED')}
        >
          🔴 処理停止 / 禁止 ({counts.blocked})
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Order Selection List (4 cols) */}
        <div className="md:col-span-4 space-y-2">
          <h4 className="font-bold text-slate-200 flex items-center justify-between pb-1">
            <span>受注一覧</span>
            <span className="text-[10px] text-slate-400 font-mono">{filteredOrders.length} 件</span>
          </h4>

          <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredOrders.map((order) => {
              const ev = evaluations.find((e) => e.orderId === order.orderId);
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
                    <span className="font-mono text-[10px] text-cyan-400 font-bold">{order.orderNumber}</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        ev?.state === 'READY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : ev?.state === 'BLOCKED'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : ev?.state === 'NEEDS_REVIEW'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-900 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {ev?.state}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-200 font-medium line-clamp-2 mt-1">{order.itemTitle}</p>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1.5 mt-1 border-t border-slate-900">
                    <span className="font-bold text-emerald-300">${order.sellingPriceUsd.toLocaleString()}</span>
                    <span>{order.destinationCountry} | {order.itemCategory}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Order Fulfillment & Document Details Panel (8 cols) */}
        {selectedEvaluation && selectedOrder && (
          <div className="md:col-span-8 space-y-3">
            {/* Status & Action Banner */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold">状態判定:</span>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded font-mono ${
                      selectedEvaluation.state === 'READY'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : selectedEvaluation.state === 'BLOCKED'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : selectedEvaluation.state === 'NEEDS_REVIEW'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-slate-900 text-slate-300 border border-slate-700'
                    }`}
                  >
                    {selectedEvaluation.stateLabelJa}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">
                    推奨便: <strong className="text-cyan-300">{selectedEvaluation.selectedCarrier}</strong>
                  </span>
                </div>
              </div>

              {/* Non-Ready Details Card (Spec #2) */}
              {selectedEvaluation.nonReadyDetails && (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-rose-300">
                      理由コード: {selectedEvaluation.nonReadyDetails.reasonCode}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      根拠: {selectedEvaluation.nonReadyDetails.sourceKnowledgeOrService}
                    </span>
                  </div>
                  <p className="text-slate-200">{selectedEvaluation.nonReadyDetails.explanationJa}</p>
                  <div className="text-emerald-300 font-bold">
                    解決アクション: {selectedEvaluation.nonReadyDetails.resolutionActionJa}
                  </div>
                </div>
              )}

              {/* Order Normalization Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-900 text-[10px]">
                <div>
                  <span className="text-slate-400">販売価格:</span>
                  <div className="font-bold text-slate-100">${selectedOrder.sellingPriceUsd}</div>
                </div>
                <div>
                  <span className="text-slate-400">Zonos 1/3申告額:</span>
                  <div className="font-bold text-emerald-300">${selectedEvaluation.declaredPrice1ThirdUsd}</div>
                </div>
                <div>
                  <span className="text-slate-400">EVTN電子納税番号:</span>
                  <div className="font-mono text-cyan-300">{selectedOrder.evtnNumber || '(未到着・待機中)'}</div>
                </div>
                <div>
                  <span className="text-slate-400">梱包実測重量:</span>
                  <div className="font-mono text-slate-100">{selectedOrder.packageWeightGrams || 0}g</div>
                </div>
              </div>

              {/* Delivery Address (Authenticity Guarantee Hub switching) */}
              <div className="p-2 bg-slate-900 rounded border border-slate-800 text-[11px] space-y-0.5">
                <span className="text-slate-400 font-bold">
                  {selectedEvaluation.isAuthenticityHubRouted
                    ? '🎯 配送先住所 (eBay Authenticity Guarantee 真贋鑑定ハブ自動切替済み):'
                    : '📍 配送先住所 (バイヤー個人住所):'}
                </span>
                <p className="font-mono text-slate-200">{selectedEvaluation.effectiveDeliveryAddress}</p>
              </div>
            </div>

            {/* Generated Customs Documents (Watch Worksheet 3-way breakdown) */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              <h4 className="font-bold text-cyan-300 flex items-center justify-between">
                <span>📑 自動割当・生成通関書類 ({selectedEvaluation.requiredDocuments.length} 件)</span>
                <span className="text-[10px] text-slate-400 font-mono">FedEx Watch Worksheet Ver. 4.1</span>
              </h4>

              {selectedEvaluation.requiredDocuments.length === 0 ? (
                <div className="p-3 bg-slate-900 rounded text-slate-400 text-[11px]">
                  この商品カテゴリ・仕向国において追加の必須通関書類はありません。
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedEvaluation.requiredDocuments.map((doc) => (
                    <div key={doc.documentId} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-100 text-xs">{doc.documentNameJa}</span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {doc.status}
                        </span>
                      </div>

                      {/* Watch Worksheet 3-Way Table */}
                      {doc.watchWorksheetData && (
                        <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1.5 text-[10px]">
                          <div className="font-bold text-slate-300 flex justify-between">
                            <span>FedEx Watch Worksheet 3分割内訳 (米国関税率表 Chapter 91)</span>
                            <span className="font-mono text-emerald-300">合計: ${doc.watchWorksheetData.totalValueUsd}</span>
                          </div>
                          <table className="w-full text-left text-[10px]">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-400">
                                <th>部位</th>
                                <th>価額 (USD)</th>
                                <th>重量 (g)</th>
                                <th>材質構成・仕様</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900 text-slate-200">
                              <tr>
                                <td className="py-1 font-bold text-cyan-300">ムーブメント (30%)</td>
                                <td>${doc.watchWorksheetData.movementValueUsd}</td>
                                <td>{doc.watchWorksheetData.movementWeightGrams}g</td>
                                <td>{doc.watchWorksheetData.movementMaterialJa}</td>
                              </tr>
                              <tr>
                                <td className="py-1 font-bold text-cyan-300">ケース / ベゼル (50%)</td>
                                <td>${doc.watchWorksheetData.caseValueUsd}</td>
                                <td>{doc.watchWorksheetData.caseWeightGrams}g</td>
                                <td>{doc.watchWorksheetData.caseMaterialJa}</td>
                              </tr>
                              <tr>
                                <td className="py-1 font-bold text-cyan-300">バンド / ストラップ (20%)</td>
                                <td>${doc.watchWorksheetData.bandValueUsd}</td>
                                <td>{doc.watchWorksheetData.bandWeightGrams}g</td>
                                <td>{doc.watchWorksheetData.bandMaterialJa}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}

                      {doc.lithiumDeclaration && (
                        <p className="text-[10px] text-slate-300 font-mono p-2 bg-slate-950 rounded border border-slate-800">
                          {doc.lithiumDeclaration}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Decision Provenance (Spec #6: 「この判断は何を根拠にしましたか？」) */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 text-[11px]"
                  onClick={() => setShowProvenance(!showProvenance)}
                >
                  <span>🧠</span>
                  <span>{showProvenance ? '決定根拠 (Provenance) を閉じる ▲' : 'この出荷判断は何を根拠にしましたか？ (根拠を見る) ▼'}</span>
                </button>

                <button
                  type="button"
                  className="px-3 py-1 bg-emerald-800 hover:bg-emerald-700 text-slate-100 font-bold rounded text-[10px]"
                  onClick={() => handleSimulateAction('出荷準備完了として確定')}
                >
                  出荷準備完了として確定 (Phase 1)
                </button>
              </div>

              {showProvenance && (
                <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-bold">主要規約ソース:</span>
                    <span className="text-cyan-300 ml-1.5 font-mono">{selectedEvaluation.provenance.primaryRuleSource}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold">税関・Zonos根拠:</span>
                    <span className="text-slate-200 ml-1.5">{selectedEvaluation.provenance.customsZonosBasisJa}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold">配送キャリア判定理由:</span>
                    <span className="text-slate-200 ml-1.5">{selectedEvaluation.provenance.shippingCarrierReasonJa}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                    権威レベル: {selectedEvaluation.provenance.authorityLevel} | 鮮度格付: {selectedEvaluation.provenance.ruleFreshnessGrade}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
