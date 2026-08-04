import React, { useState } from 'react';
import {
  SalesPerformanceRecord,
  StoreLearningSummary,
  HistoricalChangeSnapshot
} from '../../types/safetyGate';
import {
  loadSalesPerformanceRecords,
  saveSalesPerformanceRecords,
  generateStoreLearningSummaries,
  loadHistoricalChangeSnapshots,
  saveHistoricalChangeSnapshot,
  calculateRecordMetrics
} from '../../services/salesPerformanceService';

interface SalesPerformanceDashboardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const SalesPerformanceDashboard: React.FC<SalesPerformanceDashboardProps> = ({ onAddAuditLog }) => {
  const [records, setRecords] = useState<SalesPerformanceRecord[]>(loadSalesPerformanceRecords());
  const [snapshots, setSnapshots] = useState<HistoricalChangeSnapshot[]>(loadHistoricalChangeSnapshots());
  const [selectedRecordForCostModal, setSelectedRecordForCostModal] = useState<SalesPerformanceRecord | null>(null);

  // Form states for cost entry modal
  const [inputPCostJpy, setInputPCostJpy] = useState<number>(0);
  const [inputDShipJpy, setInputDShipJpy] = useState<number>(0);
  const [inputPackJpy, setInputPackJpy] = useState<number>(0);

  const summaries: StoreLearningSummary[] = generateStoreLearningSummaries(records);
  const globalSummary = summaries.find((s) => s.groupType === 'global') || summaries[0];

  const handleRecalculate = () => {
    const recalculated = records.map(calculateRecordMetrics);
    setRecords(recalculated);
    saveSalesPerformanceRecords(recalculated);

    // Save snapshot
    const snap: HistoricalChangeSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toLocaleString('ja-JP'),
      metricName: '平均売上利益率 (Avg Sales Margin)',
      previousValue: `${globalSummary.avgSalesMarginPct}%`,
      currentValue: `${globalSummary.avgSalesMarginPct}%`,
      changeAmount: '0.0%',
      changePercentage: '0.0%',
      effectiveDate: new Date().toISOString().split('T')[0],
      reason: '手動再計算実行',
      source: 'SalesPerformanceDashboard',
      affectedRecommendations: '仕入れ前審査アドバイスに反映'
    };

    saveHistoricalChangeSnapshot(snap);
    setSnapshots(loadHistoricalChangeSnapshots());

    if (onAddAuditLog) {
      onAddAuditLog('Sales Performance Recalculation Executed', 'Recalculation', `Records: ${records.length}`);
    }

    alert('全実績データの再計算および自動学習の更新が完了しました。');
  };

  const handleSaveMissingCosts = () => {
    if (!selectedRecordForCostModal) return;

    const updated = records.map((r) => {
      if (r.id === selectedRecordForCostModal.id) {
        return calculateRecordMetrics({
          ...r,
          purchaseCostJpy: inputPCostJpy,
          domesticShippingCostJpy: inputDShipJpy,
          packagingCostJpy: inputPackJpy
        });
      }
      return r;
    });

    setRecords(updated);
    saveSalesPerformanceRecords(updated);

    if (onAddAuditLog) {
      onAddAuditLog(
        'Missing Costs Entered Manually',
        `Record: ${selectedRecordForCostModal.sku}`,
        `Purchase Cost: ¥${inputPCostJpy}, Domestic Shipping: ¥${inputDShipJpy}`
      );
    }

    setSelectedRecordForCostModal(null);
  };

  const openCostModal = (rec: SalesPerformanceRecord) => {
    setSelectedRecordForCostModal(rec);
    setInputPCostJpy(rec.purchaseCostJpy || 5000);
    setInputDShipJpy(rec.domesticShippingCostJpy || 500);
    setInputPackJpy(rec.packagingCostJpy || 200);
  };

  return (
    <div className="card sales-performance-dashboard space-y-6">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">📈 売上・販売パフォーマンス実績 & 店舗固有学習 (Phase 2)</h3>
          <p className="card-subtitle text-xs text-muted">
            過去のeBay販売実績データを自動集計し、貴社店舗独自の利益率・回転率・返金率を仕入れ判断に学習反映します。
          </p>
        </div>
        <button type="button" className="btn-secondary btn-sm" onClick={handleRecalculate}>
          🔄 再計算 & 学習更新
        </button>
      </div>

      <div className="card-body space-y-4 text-xs">
        {/* Top Summary Stat Cards */}
        <div className="grid-4col gap-3">
          <div className="card-sub-box bg-slate-900 border-slate-700 text-center">
            <span className="text-muted block font-bold">完了販売件数</span>
            <strong className="text-base text-highlight font-mono">{globalSummary.totalCompletedSales} 件</strong>
            <div className="text-xs text-amber-400 mt-1">信頼度: {globalSummary.confidenceBand}</div>
          </div>

          <div className="card-sub-box bg-slate-900 border-slate-700 text-center">
            <span className="text-muted block font-bold">平均予想純利益 (円)</span>
            <strong className="text-base text-emerald-400 font-mono font-bold">¥{globalSummary.avgNetProfitJpy.toLocaleString()}</strong>
            <div className="text-xs text-slate-400 mt-1">($ {globalSummary.avgNetProfitUsd})</div>
          </div>

          <div className="card-sub-box bg-slate-900 border-slate-700 text-center">
            <span className="text-muted block font-bold">平均利益率 (%)</span>
            <strong className="text-base text-emerald-400 font-mono font-bold">{globalSummary.avgSalesMarginPct}%</strong>
            <div className="text-xs text-slate-400 mt-1">(ROI: {globalSummary.avgRoiPct}%)</div>
          </div>

          <div className="card-sub-box bg-slate-900 border-slate-700 text-center">
            <span className="text-muted block font-bold">平均販売日数 (回転率)</span>
            <strong className="text-base font-mono font-bold text-highlight-gold">{globalSummary.medianDaysToSell} 日</strong>
            <div className="text-xs text-slate-400 mt-1">(仕入れから受注まで)</div>
          </div>
        </div>

        {/* Brand & Category Store Learning Cards */}
        <div className="space-y-2">
          <h4 className="font-bold text-highlight text-xs">店舗固有学習要約 (Store Learning Summaries)</h4>
          <div className="grid-2col gap-3">
            {summaries.map((s, idx) => (
              <div key={idx} className="card-sub-box bg-slate-950 border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-primary font-bold">{s.groupKey}</strong>
                  <span className="status-badge status-connected font-mono">{s.confidenceBand}</span>
                </div>
                <p className="text-slate-300">{s.recommendationMessage}</p>
                <div className="flex justify-between text-muted pt-1 border-t border-slate-800/60">
                  <span>完了件数: {s.totalCompletedSales}件</span>
                  <span>平均利益率: {s.avgSalesMarginPct}%</span>
                  <span>平均回転: {s.medianDaysToSell}日</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Performance Transaction Table & Missing Cost Checklist */}
        <div className="space-y-2">
          <h4 className="font-bold text-highlight text-xs">販売実績レコード & コスト補完チェックリスト</h4>
          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>注文番号</th>
                  <th>SKU / 商品名</th>
                  <th>販売価格</th>
                  <th>実純利益</th>
                  <th>利益率</th>
                  <th>計算状態</th>
                  <th>欠損コスト項目</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td><span className="font-mono text-muted">{r.ebayOrderId}</span></td>
                    <td>
                      <strong className="font-mono text-highlight-gold">{r.sku}</strong>
                      <div className="text-slate-300 truncate max-w-xs">{r.productTitle}</div>
                    </td>
                    <td><span className="font-mono font-bold">${r.finalSalePriceUsd}</span></td>
                    <td>
                      <strong className={(r.calculatedNetProfitJpy || 0) >= 0 ? 'font-mono text-emerald-400' : 'font-mono text-danger'}>
                        ¥{(r.calculatedNetProfitJpy || 0).toLocaleString()}
                      </strong>
                    </td>
                    <td><span className="font-mono font-bold">{r.calculatedSalesMarginPct}%</span></td>
                    <td>
                      {r.calculationState === 'CONFIRMED' ? (
                        <span className="status-badge status-connected">🟢 CONFIRMED</span>
                      ) : (
                        <span className="status-badge status-prep">🟡 PROVISIONAL</span>
                      )}
                    </td>
                    <td>
                      {r.missingCostsChecklist.length > 0 ? (
                        <span className="text-amber-400 font-semibold">{r.missingCostsChecklist[0]}</span>
                      ) : (
                        <span className="text-muted">欠損なし</span>
                      )}
                    </td>
                    <td>
                      {r.calculationState === 'PROVISIONAL' && (
                        <button
                          type="button"
                          className="btn-pill-sm active"
                          onClick={() => openCostModal(r)}
                        >
                          原産コスト補完
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Manual Missing-Cost Entry Modal */}
      {selectedRecordForCostModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title-ja">手動欠損コスト補完 (Manual Cost Entry)</h3>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedRecordForCostModal(null)}>&times;</button>
            </div>
            <div className="modal-body text-xs space-y-3">
              <p className="text-slate-300">
                対象SKU: <strong className="font-mono text-highlight">{selectedRecordForCostModal.sku}</strong> の未入力コストを手動補完し、計算状態を CONFIRMED (確定) へ変更します。
              </p>
              <div className="form-group">
                <label className="form-label font-bold">仕入原価 (円 - Purchase Cost)</label>
                <input
                  type="number"
                  className="form-control font-mono font-bold"
                  value={inputPCostJpy}
                  onChange={(e) => setInputPCostJpy(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label font-bold">国内送料 (円 - Domestic Shipping)</label>
                <input
                  type="number"
                  className="form-control font-mono"
                  value={inputDShipJpy}
                  onChange={(e) => setInputDShipJpy(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label font-bold">梱包費 (円 - Packaging Cost)</label>
                <input
                  type="number"
                  className="form-control font-mono"
                  value={inputPackJpy}
                  onChange={(e) => setInputPackJpy(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="modal-footer space-between">
              <button type="button" className="btn-secondary" onClick={() => setSelectedRecordForCostModal(null)}>
                キャンセル
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveMissingCosts}>
                コストを補完して確定保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
