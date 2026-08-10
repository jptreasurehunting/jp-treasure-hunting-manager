import React, { useState } from 'react';
import {
  ShopeeListingCapacity,
  ShopeeAutoListingPolicy,
  ShopeeListingItem
} from '../../types/shopeeAutomation';
import { CentralInventoryItem } from '../../types/centralInventory';
import {
  loadShopeeCapacity,
  saveShopeeCapacity,
  loadShopeePolicy,
  saveShopeePolicy,
  loadShopeeListings,
  evaluateAutonomousReplacements
} from '../../services/shopeeAutomationService';
import { loadCentralInventory, reconcileCentralInventory } from '../../services/centralInventoryService';
import { t, tBilingual, formatLocaleCurrency } from '../../services/i18nService';

interface ShopeeAutomationCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const ShopeeAutomationCard: React.FC<ShopeeAutomationCardProps> = ({ onAddAuditLog }) => {
  const [capacity, setCapacity] = useState<ShopeeListingCapacity>(loadShopeeCapacity());
  const [policy, setPolicy] = useState<ShopeeAutoListingPolicy>(loadShopeePolicy());
  const [listings, setListings] = useState<ShopeeListingItem[]>(loadShopeeListings());
  const [inventory, setInventory] = useState<CentralInventoryItem[]>(loadCentralInventory());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleTogglePolicy = () => {
    const updated = { ...policy, autoListingEnabled: !policy.autoListingEnabled };
    saveShopeePolicy(updated);
    setPolicy(updated);
    showToast(updated.autoListingEnabled ? '🟢 Shopee自動出品ポリシーを有効化しました' : '⏸️ Shopee自動出品ポリシーを一時停止しました');
    if (onAddAuditLog) {
      onAddAuditLog('ShopeeAutomation: Policy Toggled', undefined, String(updated.autoListingEnabled));
    }
  };

  const handleRunOptimizationSimulation = () => {
    const res = evaluateAutonomousReplacements();
    setListings(loadShopeeListings());
    showToast(res.summaryMessageJa);
    if (onAddAuditLog) {
      onAddAuditLog('ShopeeAutomation: Evaluated autonomous replacements', undefined, `Executed: ${res.replacementsExecuted}`);
    }
  };

  const handleReconcileInventory = () => {
    const res = reconcileCentralInventory();
    setInventory(loadCentralInventory());
    showToast(`✅ 中央在庫リコンシリエーション完了 (照合SKU: ${res.totalSkusChecked}件 / 補正: ${res.discrepancyCount}件)`);
  };

  return (
    <div className="shopee-automation-card space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>🛒</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛒</span>
          <div>
            <h4 className="font-black text-sm text-slate-100">
              {tBilingual('nav.shopee')}
            </h4>
            <p className="text-[11px] text-slate-400">
              事前承認ポリシーの範囲内で、無料出品枠（100枠）を最大限に活用し自律出品・在庫同期・入替を実行します。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all ${
              policy.autoListingEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-slate-950 shadow'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            onClick={handleTogglePolicy}
          >
            {policy.autoListingEnabled ? t('shopee.policy.auto_listing_enabled') : t('shopee.policy.auto_listing_disabled')}
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Card 1: Listing Capacity */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <span>📊</span>
              <span>{tBilingual('shopee.capacity.free_listing_capacity')}</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
              未検証の仮定値 (Assumed)
            </span>
          </div>

          <div className="flex justify-between items-end pt-1">
            <div>
              <div className="text-xl font-black text-cyan-300 font-mono">
                {capacity.usedListingCapacity} <span className="text-xs text-slate-400 font-normal">/ {capacity.freeListingCapacity} 品</span>
              </div>
              <div className="text-[10px] text-slate-400">
                {t('shopee.capacity.remaining_free_capacity')}: <span className="font-bold text-emerald-300 font-mono">{capacity.remainingFreeCapacity} 枠</span>
              </div>
            </div>

            <span className="text-[10px] font-mono text-slate-400">Region: SG (シンガポール)</span>
          </div>
        </div>

        {/* Card 2: Central Inventory SSOT */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <span>🔄</span>
              <span>{tBilingual('inventory.sync.title')}</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              {t('inventory.status.synced')}
            </span>
          </div>

          <div className="flex justify-between items-end pt-1">
            <div>
              <div className="text-xl font-black text-emerald-300 font-mono">
                {inventory.reduce((acc, i) => acc + i.availableToSell, 0)} <span className="text-xs text-slate-400 font-normal">点 (ATS)</span>
              </div>
              <div className="text-[10px] text-slate-400">
                実在庫: {inventory.reduce((acc, i) => acc + i.physicalStock, 0)}点 / 引当予約: {inventory.reduce((acc, i) => acc + i.reservedStock, 0)}点
              </div>
            </div>

            <button
              type="button"
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold"
              onClick={handleReconcileInventory}
            >
              照合実行 (Reconcile)
            </button>
          </div>
        </div>

        {/* Card 3: Auto Replacement Activity */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-slate-300 flex items-center gap-1">
              <span>💡</span>
              <span>自動入替 ＆ 最適化 (Optimization)</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              上限: {policy.maxReplacementsPerDay}件/日
            </span>
          </div>

          <div className="flex justify-between items-end pt-1">
            <div>
              <div className="text-xs font-bold text-slate-200">
                入替候補検知: {listings.filter((l) => l.isReplacementCandidate).length}件
              </div>
              <div className="text-[10px] text-slate-400">
                最低スコア閾値: {policy.minOpportunityScore}点 / 評価期間: {policy.minEvaluationPeriodDays}日
              </div>
            </div>

            <button
              type="button"
              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded text-xs font-bold shadow"
              onClick={handleRunOptimizationSimulation}
            >
              🧪 自律入替シミュレーション実行
            </button>
          </div>
        </div>
      </div>

      {/* Shopee Active Listings & Replacement Candidates Table */}
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
        <div className="flex justify-between items-center border-b border-slate-900 pb-2">
          <span className="font-bold text-slate-100 text-xs">
            Shopee 出品一覧 ＆ スコア評価 (Active Listings & Optimization Status)
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            ポリシー承認者: {policy.approvedBy}
          </span>
        </div>

        <div className="space-y-2">
          {listings.map((item) => (
            <div
              key={item.shopeeItemId}
              className={`p-3 rounded-lg border flex justify-between items-center gap-3 ${
                item.isReplacementCandidate
                  ? 'bg-amber-950/30 border-amber-800/80'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100">{item.title}</span>
                  <span className="font-mono text-[10px] text-slate-400">[{item.sku}]</span>
                  {item.isReplacementCandidate && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-900 text-amber-200 border border-amber-700">
                      {t('shopee.optimization.replacement_candidate')}
                    </span>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 flex gap-3">
                  <span>価格: SGD {item.priceSgd.toFixed(2)} ({formatLocaleCurrency(item.priceJpyEquivalent)})</span>
                  <span>在庫数: {item.stock}点</span>
                  <span>閲覧数: {item.viewsCount}回</span>
                  <span>クリック数: {item.clicksCount}回</span>
                  <span>販売実績: {item.salesCount}件</span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <div className="font-mono font-bold text-xs text-cyan-300">
                  スコア: {item.opportunityScore}点
                </div>
                <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded ${
                  item.status === 'ACTIVE'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    : 'bg-slate-950 text-slate-400 border border-slate-800'
                }`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
