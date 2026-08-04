import React, { useState } from 'react';
import { ImportedEbayOrderRecord } from '../../types/safetyGate';
import {
  loadImportedOrders,
  saveImportedOrders,
  validateShipmentPrep
} from '../../services/orderFulfillmentService';

interface OrderFulfillmentManagerCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const OrderFulfillmentManagerCard: React.FC<OrderFulfillmentManagerCardProps> = ({ onAddAuditLog }) => {
  const [orders, setOrders] = useState<ImportedEbayOrderRecord[]>(loadImportedOrders());
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];

  const handleUpdateOrder = (updated: ImportedEbayOrderRecord) => {
    const updatedList = orders.map((o) => (o.id === updated.id ? updated : o));
    setOrders(updatedList);
    saveImportedOrders(updatedList);
  };

  const handleExecuteMarkAsShipped = () => {
    if (!activeOrder) return;

    const val = validateShipmentPrep(activeOrder);
    if (!val.isValid) {
      alert(`[BLOCKED] 発送完了手続きを実行できません:\n- ${val.errors.join('\n- ')}`);
      return;
    }

    const updated: ImportedEbayOrderRecord = {
      ...activeOrder,
      fulfillmentStatus: 'Shipped'
    };

    handleUpdateOrder(updated);

    if (onAddAuditLog) {
      onAddAuditLog(
        `Order Marked as Shipped (Order ID: ${updated.ebayOrderId})`,
        'Fulfillment Status: Unshipped',
        `Carrier: ${updated.carrierName} | Tracking: ${updated.trackingNumber} | Weight: ${updated.packageWeightGrams}g`
      );
    }

    alert(`[SUCCESS] 注文番号 ${updated.ebayOrderId} の発送完了手続きおよび追跡番号の登録が完了しました！`);
  };

  return (
    <div className="card order-fulfillment-card space-y-4">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">📦 受注確定・Shipping Record & 出荷完了・追跡管理 (Phase 4)</h3>
          <p className="card-subtitle text-xs text-muted">
            受注入庫の手元実在庫引き当て、発送前の現物手元確認、Packing Weight検証、追跡番号アタッチ、Zonos転記を保護実行します。
          </p>
        </div>
        <span className="baseline-badge">Phase 4 モジュール</span>
      </div>

      <div className="card-body space-y-4 text-xs">
        {/* Order Selector Pills */}
        <div className="space-y-1">
          <label className="form-label font-bold">未発送受注リスト (Imported Orders awaiting Shipment)</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`country-select-pill ${o.id === activeOrder?.id ? 'active' : ''}`}
                onClick={() => setSelectedOrderId(o.id)}
              >
                <div className="flex items-center gap-1 font-bold">
                  <span>{o.fulfillmentStatus === 'Shipped' ? '🟢' : '📦'}</span>
                  <span>{o.ebayOrderId}</span>
                </div>
                <div className="text-xs text-muted font-mono">{o.sku} | {o.destinationCountry} | ${o.salePriceUsd}</div>
              </button>
            ))}
          </div>
        </div>

        {activeOrder && (
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <strong className="text-highlight text-sm font-mono">{activeOrder.ebayOrderId}</strong>
                <span className="text-slate-300 ml-2 font-bold">{activeOrder.productTitle}</span>
              </div>
              <span className={activeOrder.fulfillmentStatus === 'Shipped' ? 'status-badge status-connected' : 'status-badge status-prep'}>
                {activeOrder.fulfillmentStatus}
              </span>
            </div>

            {/* Mandatory Physical Item Confirmation Checkbox */}
            <div className="p-3 bg-slate-950 rounded border border-amber-500/40 space-y-1">
              <label className="flex items-center gap-2 text-amber-300 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-amber-500"
                  checked={activeOrder.physicalItemConfirmed}
                  onChange={(e) => handleUpdateOrder({ ...activeOrder, physicalItemConfirmed: e.target.checked })}
                />
                <span>必修確認: 「発送する現物を手元で確認しました。」</span>
              </label>
              <p className="text-slate-400 text-xs pl-6">
                ※ 現物の手元棚卸しおよび外観状態が未確認の場合、発送完了手続きおよび追跡番号の自動連携は実行できません (Fail-Closed)。
              </p>
            </div>

            {/* Shipping Details Entry Grid */}
            <div className="grid-3col gap-3">
              <div className="form-group">
                <label className="form-label font-bold">配送キャリア・サービス</label>
                <select
                  className="form-control font-bold"
                  value={activeOrder.carrierName}
                  onChange={(e) => handleUpdateOrder({ ...activeOrder, carrierName: e.target.value })}
                >
                  <option value="Japan Post (EMS)">Japan Post (EMS)</option>
                  <option value="FedEx (Connect Plus)">FedEx (Connect Plus)</option>
                  <option value="DHL Express">DHL Express</option>
                  <option value="eBay SpeedPAK">eBay SpeedPAK</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">梱包実重量 (g - Weight)</label>
                <input
                  type="number"
                  className="form-control font-mono font-bold"
                  value={activeOrder.packageWeightGrams}
                  onChange={(e) => handleUpdateOrder({ ...activeOrder, packageWeightGrams: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="form-group">
                <label className="form-label font-bold">追跡番号 (Tracking Number)</label>
                <input
                  type="text"
                  placeholder="e.g. EN123456789JP"
                  className="form-control font-mono font-bold text-emerald-400"
                  value={activeOrder.trackingNumber}
                  onChange={(e) => handleUpdateOrder({ ...activeOrder, trackingNumber: e.target.value })}
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
              <div className="text-muted text-xs font-mono">
                申告候補額 (1/3 Rule): <strong className="text-slate-200">${activeOrder.declaredValueUsd}</strong>
              </div>

              <button
                type="button"
                className="btn-primary btn-lg"
                onClick={handleExecuteMarkAsShipped}
                disabled={activeOrder.fulfillmentStatus === 'Shipped'}
              >
                {activeOrder.fulfillmentStatus === 'Shipped' ? '🟢 発送完了登録済み' : '📦 発送完了・追跡番号登録を実行'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
