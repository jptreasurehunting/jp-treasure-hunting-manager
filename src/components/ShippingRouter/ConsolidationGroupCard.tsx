import React, { useState, useMemo } from 'react';
import { FulfillmentGroup, ConsolidationDecision } from '../../types/consolidation';
import { NormalizedFulfillmentOrder } from '../../types/shippingRouter';
import {
  loadFulfillmentGroups,
  saveFulfillmentGroups,
  disbandFulfillmentGroup,
  evaluateConsolidationEligibility
} from '../../services/consolidationService';
import { t, tBilingual, formatLocaleWeight, formatLocaleDimensions, formatLocaleCurrency } from '../../services/i18nService';
import { loadFulfillmentOrders } from '../../services/shippingRouterService';
import { EnvelopePreviewModal } from './EnvelopePreviewModal';

interface ConsolidationGroupCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const ConsolidationGroupCard: React.FC<ConsolidationGroupCardProps> = ({ onAddAuditLog }) => {
  const [groups, setGroups] = useState<FulfillmentGroup[]>(loadFulfillmentGroups());
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.groupId || '');
  const [previewOrder, setPreviewOrder] = useState<NormalizedFulfillmentOrder | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const orders = useMemo(() => loadFulfillmentOrders(), []);

  const selectedGroup = useMemo(() => {
    return groups.find((g) => g.groupId === selectedGroupId) || groups[0];
  }, [groups, selectedGroupId]);

  const candidateDecision: ConsolidationDecision | null = useMemo(() => {
    if (!selectedGroup || selectedGroup.orders.length < 2) return null;
    return evaluateConsolidationEligibility(selectedGroup.orders[0], selectedGroup.orders[1]);
  }, [selectedGroup]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDisband = (groupId: string) => {
    const res = disbandFulfillmentGroup(groupId);
    setGroups(loadFulfillmentGroups());
    showToast(res.messageJa);
    if (onAddAuditLog) {
      onAddAuditLog('Consolidation: Disbanded Fulfillment Group', groupId, 'SEPARATED');
    }
  };

  const handlePreviewConsolidatedEnvelope = () => {
    if (!selectedGroup) return;
    // Create combined synthetic order for Phase B preview
    const combinedOrder: NormalizedFulfillmentOrder = {
      ...selectedGroup.orders[0],
      orderId: selectedGroup.groupId,
      orderNumber: selectedGroup.orders.map((o) => o.orderNumber).join(' + '),
      itemTitle: selectedGroup.orders.map((o, idx) => `(${idx + 1}) ${o.itemTitle} [${o.quantity}点]`).join(' / '),
      quantity: selectedGroup.totalQuantity,
      packageWeightGrams: selectedGroup.combinedWeightGrams,
      packageDimensionsCm: selectedGroup.combinedDimensionsCm
    };

    setPreviewOrder(combinedOrder);
  };

  return (
    <div className="consolidation-group-card space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>📦</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Envelope Preview Modal for Combined Parcel */}
      {previewOrder && (
        <EnvelopePreviewModal order={previewOrder} onClose={() => setPreviewOrder(null)} />
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">📦</span>
          <div>
            <h4 className="font-black text-sm text-slate-100">
              {tBilingual('nav.consolidation')}
            </h4>
            <p className="text-[11px] text-slate-400">
              モール規約（Marketplace Policy）を第1ゲートとし、同一モール・同一アカウント・同一住所のみ安全に同梱統合します。
            </p>
          </div>
        </div>

        <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800">
          確定済みグループ / Active Groups: {groups.length}件
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Left: Groups List (4 cols) */}
        <div className="md:col-span-4 space-y-2">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            おまとめグループ一覧 / Groups List ({groups.length})
          </span>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {groups.map((group) => {
              const isSelected = group.groupId === selectedGroupId;
              return (
                <div
                  key={group.groupId}
                  className={`p-3 rounded-lg border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-slate-800 border-cyan-500 shadow-md ring-1 ring-cyan-500'
                      : 'bg-slate-950 border-slate-800 hover:bg-slate-900'
                  }`}
                  onClick={() => setSelectedGroupId(group.groupId)}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] text-cyan-400 font-bold">
                      [{group.salesChannel}] {group.groupId}
                    </span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      {group.state}
                    </span>
                  </div>

                  <p className="font-bold text-slate-100 text-xs">{group.groupName}</p>

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                    <span>点数: {group.totalQuantity}点</span>
                    <span className="font-mono text-emerald-300 font-bold">
                      {formatLocaleCurrency(group.totalPrice, group.currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Detailed Decision & 12-Step Audit View (8 cols) */}
        {selectedGroup && (
          <div className="md:col-span-8 space-y-3">
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-900">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">決定ステータス / Decision Status:</span>
                  <div className="text-sm font-black text-emerald-300 flex items-center gap-1.5">
                    <span>{tBilingual('consolidation.status.consolidate')}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-mono">セラーアカウント: {selectedGroup.sellerAccountId}</span>
                  <div className="text-[10px] font-mono text-cyan-300">排他印刷ロック: 🔒 有効 (Active)</div>
                </div>
              </div>

              {/* Metrics Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400">合算点数 / Units:</span>
                  <div className="font-bold text-slate-100">{selectedGroup.totalQuantity}点</div>
                </div>
                <div>
                  <span className="text-slate-400">合算重量 / Weight:</span>
                  <div className="font-bold text-cyan-300">{formatLocaleWeight(selectedGroup.combinedWeightGrams)}</div>
                </div>
                <div>
                  <span className="text-slate-400">合算寸法 / Size:</span>
                  <div className="font-bold text-cyan-300">{formatLocaleDimensions(selectedGroup.combinedDimensionsCm.length, selectedGroup.combinedDimensionsCm.width, selectedGroup.combinedDimensionsCm.height)}</div>
                </div>
                <div>
                  <span className="text-slate-400">選定配送便 / Service:</span>
                  <div className="font-bold text-emerald-300 truncate">{selectedGroup.routingDecision.selectedServiceMethod || selectedGroup.routingDecision.carrierName}</div>
                </div>
              </div>

              {/* Multi-Layer Validation Checklist (12-Step Audit) */}
              {candidateDecision && (
                <div className="space-y-2 pt-1">
                  <span className="text-[10px] text-slate-300 font-bold flex items-center gap-1">
                    <span>🛡️</span>
                    <span>多層バリデーション検証結果 / Multi-Layer Audit Verification:</span>
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                    {candidateDecision.checks.map((chk, idx) => (
                      <div key={idx} className="p-2 bg-slate-900 rounded border border-slate-800 flex items-center justify-between">
                        <span className="text-slate-300">{t(chk.checkNameKey)}</span>
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${chk.passed ? 'bg-emerald-950 text-emerald-300' : 'bg-red-950 text-red-300'}`}>
                          {chk.passed ? '✅ PASS' : '❌ FAIL'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Consolidated Orders Table */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] text-slate-400 font-bold">含まれる個別注文 / Consolidated Orders:</span>
                <div className="space-y-1">
                  {selectedGroup.orders.map((ord) => (
                    <div key={ord.orderId} className="p-2 bg-slate-900 rounded border border-slate-800 flex justify-between items-center text-[11px]">
                      <div>
                        <span className="font-mono text-cyan-300 font-bold">[{ord.orderNumber}]</span>
                        <span className="text-slate-200 ml-1.5 font-medium">{ord.itemTitle}</span>
                      </div>
                      <span className="text-slate-400 font-mono">{ord.quantity}点</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-900 flex-wrap">
                <button
                  type="button"
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-bold text-xs"
                  onClick={() => handleDisband(selectedGroup.groupId)}
                >
                  {t('consolidation.action.disband')}
                </button>

                <button
                  type="button"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg font-bold text-xs shadow-lg transition-all flex items-center gap-1.5"
                  onClick={handlePreviewConsolidatedEnvelope}
                >
                  <span>✉️</span>
                  <span>{t('consolidation.action.preview_envelope')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
