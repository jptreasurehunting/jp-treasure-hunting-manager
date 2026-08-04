import React, { useState } from 'react';
import {
  ProtectedAction,
  SafetyGateResult,
  InventoryItemRecord,
  InventoryAdjustmentLog,
  InventoryAdjustmentType,
  AccountHealthRecord,
  ProductComplianceProfile
} from '../../types/safetyGate';
import {
  loadInventoryItems,
  saveInventoryItems,
  loadInventoryLogs,
  addInventoryAdjustment,
  checkStocktakeValidity
} from '../../services/safetyInventoryService';
import { loadAccountHealthRecords } from '../../services/safetyAccountHealthService';
import { loadProductProfiles, saveProductProfiles } from '../../services/productComplianceService';
import { evaluateSafetyGate, ACTION_NAME_MAP } from '../../services/safetyGateService';
import { loadComplianceRecords } from '../../services/countryComplianceService';
import { loadEbayAccounts } from '../../services/ebayAccountService';
import { ComplianceBlockingModal } from './ComplianceBlockingModal';

export const SafetyGateDashboard: React.FC = () => {
  const accounts = loadEbayAccounts();
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRecord[]>(loadInventoryItems());
  const [inventoryLogs, setInventoryLogs] = useState<InventoryAdjustmentLog[]>(loadInventoryLogs());
  const [accountHealthRecords, setAccountHealthRecords] = useState<AccountHealthRecord[]>(loadAccountHealthRecords(accounts));
  const [productProfiles, setProductProfiles] = useState<ProductComplianceProfile[]>(loadProductProfiles());
  const complianceRecords = loadComplianceRecords();

  // Selected state for Gate Simulator
  const [selectedAction, setSelectedAction] = useState<ProtectedAction>('CREATE_LISTING');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string>('INV-2026-001');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc_01');
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('DE');
  const [packageWeightInput, setPackageWeightInput] = useState<number>(450);
  const [isPhysicalConfirmedCheck, setIsPhysicalConfirmedCheck] = useState<boolean>(false);

  // Modal State
  const [activeGateResult, setActiveGateResult] = useState<SafetyGateResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Stock Adjustment Form State
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItemRecord | null>(null);
  const [adjustType, setAdjustType] = useState<InventoryAdjustmentType>('Stocktake correction');
  const [adjustDelta, setAdjustDelta] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('');

  const activeInventoryItem = inventoryItems.find((i) => i.inventoryId === selectedInventoryId) || inventoryItems[0];
  const activeAccountHealth = accountHealthRecords.find((a) => a.accountId === selectedAccountId) || accountHealthRecords[0];
  const activeCountryRecord = complianceRecords.find((c) => c.countryCode === selectedCountryCode) || complianceRecords[0];
  const activeProductProfile = productProfiles.find((p) => p.inventoryId === selectedInventoryId) || productProfiles[0];

  // Evaluate Safety Gate
  const handleEvaluateTrigger = () => {
    const res = evaluateSafetyGate({
      action: selectedAction,
      targetCountryCode: selectedCountryCode,
      targetAccountId: selectedAccountId,
      inventoryItem: activeInventoryItem,
      accountHealth: activeAccountHealth,
      countryRecord: activeCountryRecord,
      productProfile: activeProductProfile,
      packageWeightGrams: packageWeightInput,
      isPhysicalItemConfirmed: isPhysicalConfirmedCheck
    });

    setActiveGateResult(res);
    setIsModalOpen(true);
  };

  // Stock Adjustment Submit
  const handleExecuteAdjustment = () => {
    if (!adjustModalItem || !adjustReason.trim()) {
      alert('調整理由を入力してください。');
      return;
    }

    const res = addInventoryAdjustment(
      adjustModalItem.inventoryId,
      adjustType,
      adjustDelta,
      adjustReason
    );

    if (!res.success || !res.updatedItem) {
      alert(res.error || '在庫調整に失敗しました。');
      return;
    }

    setInventoryItems(loadInventoryItems());
    setInventoryLogs(loadInventoryLogs());
    setAdjustModalItem(null);
    setAdjustReason('');
  };

  return (
    <div className="safety-gate-dashboard space-y-6">
      {/* Top Banner Header */}
      <div className="japan-post-banner card">
        <div className="banner-content-row space-between">
          <div className="banner-text-group">
            <div className="banner-tag-badge">🛡️ JP Treasure Hunting Manager Ver.1.8</div>
            <h2 className="banner-title-ja">安全販売・法令・実在庫チェック & コンプライアンスゲート</h2>
            <p className="banner-desc-ja">
              出品・国許可・移動・発送・受注確定の11主要ワークフローを横断保護し、法規制未対応や実在庫不足によるトラブルを防止します。
            </p>
          </div>
        </div>
      </div>

      {/* Advisory Disclaimer Banner (Spec #1) */}
      <div className="legal-disclaimer-banner card-sub-box border-amber-500/30 bg-amber-500/10 text-xs">
        ⚖️ <strong>案内告知 (Advisory Disclaimer):</strong> 「この機能は法令・販売・発送条件の確認を補助するものです。法令適合やeBayアカウント停止の完全な防止を保証するものではありません。」
      </div>

      {/* SECTION 1: 11 Protected Actions Simulator & Safety Gate Checker */}
      <div className="card ebay-baseline-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">1. 11保護ワークフロー・コンプライアンスゲート検証 (Gate Simulator)</h3>
          <span className="baseline-badge">リアルタイム検証</span>
        </div>

        <div className="card-body space-y-4">
          <div className="grid-2col text-xs">
            {/* Action Select */}
            <div className="form-group">
              <label className="form-label font-bold">検証対象操作 (Protected Action)</label>
              <select
                className="form-control font-semibold"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value as ProtectedAction)}
              >
                {Object.entries(ACTION_NAME_MAP).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Inventory Item */}
            <div className="form-group">
              <label className="form-label font-bold">対象実在庫商品 (Inventory Item)</label>
              <select
                className="form-control"
                value={selectedInventoryId}
                onChange={(e) => setSelectedInventoryId(e.target.value)}
              >
                {inventoryItems.map((item) => (
                  <option key={item.inventoryId} value={item.inventoryId}>
                    {item.sku} - {item.productName} (実在庫: {item.physicalStockQuantity}個 / ステータス: {item.verificationStatus})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Account */}
            <div className="form-group">
              <label className="form-label font-bold">対象eBayアカウント (eBay Account)</label>
              <select
                className="form-control"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
              >
                {accountHealthRecords.map((acc) => (
                  <option key={acc.accountId} value={acc.accountId}>
                    {acc.displayName} (状態: {acc.sellingRestrictionStatus})
                  </option>
                ))}
              </select>
            </div>

            {/* Target Country */}
            <div className="form-group">
              <label className="form-label font-bold">配送対象国 (Destination Country)</label>
              <select
                className="form-control"
                value={selectedCountryCode}
                onChange={(e) => setSelectedCountryCode(e.target.value)}
              >
                {complianceRecords.map((c) => (
                  <option key={c.countryCode} value={c.countryCode}>
                    {c.countryName} ({c.countryCode}) - {c.status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Additional Inputs for Shipment Check */}
          {(selectedAction === 'CONFIRM_SHIPMENT_PREP' || selectedAction === 'MARK_ORDER_SHIPPED') && (
            <div className="card-sub-box bg-slate-900 border-slate-700 text-xs grid-2col gap-3">
              <div className="form-group">
                <label className="form-label font-bold">梱包後実重量 (Package Weight)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    className="form-control font-mono"
                    value={packageWeightInput}
                    onChange={(e) => setPackageWeightInput(parseInt(e.target.value) || 0)}
                  />
                  <span className="text-muted">g</span>
                </div>
              </div>

              <div className="form-group flex items-center pt-4">
                <input
                  type="checkbox"
                  id="chk_physical_confirmed"
                  checked={isPhysicalConfirmedCheck}
                  onChange={(e) => setIsPhysicalConfirmedCheck(e.target.checked)}
                />
                <label htmlFor="chk_physical_confirmed" className="ml-2 font-bold text-emerald-400 cursor-pointer">
                  「発送する現物を手元で確認しました。」(必須)
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={handleEvaluateTrigger}
            >
              🛡️ コンプライアンスゲート判定を実行
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: Physical Inventory & Stocktake Manager (Spec #3, #4, #5, #6) */}
      <div className="card inventory-section-card">
        <div className="card-header space-between">
          <div>
            <h3 className="card-title text-base font-semibold">2. 手元実在庫・棚卸し管理 (Manual Physical Inventory)</h3>
            <p className="card-subtitle text-xs text-muted">
              ※ 実在庫数はeBay出品数から自動推測されません。手元現物を目視確認のうえ手動入力・更新してください。
            </p>
          </div>
        </div>

        <div className="card-body">
          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>在庫ID</th>
                  <th>SKU</th>
                  <th>商品名</th>
                  <th>手元実在庫</th>
                  <th>発送可能(Available)</th>
                  <th>検証ステータス</th>
                  <th>最終棚卸し日</th>
                  <th>確認担当者</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item) => {
                  const validity = checkStocktakeValidity(item);

                  return (
                    <tr key={item.inventoryId}>
                      <td><strong className="font-mono">{item.inventoryId}</strong></td>
                      <td><span className="font-mono text-highlight-gold">{item.sku}</span></td>
                      <td><strong className="text-primary">{item.productName}</strong></td>
                      <td><strong className="font-mono text-sm">{item.physicalStockQuantity} 個</strong></td>
                      <td><strong className="font-mono text-sm text-emerald-400">{item.availableQuantity} 個</strong></td>
                      <td>
                        {item.verificationStatus === 'Verified' && !validity.isExpired ? (
                          <span className="status-badge status-connected">🟢 Verified (検証済み)</span>
                        ) : item.verificationStatus === 'Recheck Required' || validity.isExpired ? (
                          <span className="status-badge status-prep">🟡 Recheck Required</span>
                        ) : (
                          <span className="status-badge status-unconnected">🔴 {item.verificationStatus}</span>
                        )}
                      </td>
                      <td><span className="font-mono text-muted">{item.lastStocktakeDate || '-'}</span></td>
                      <td><span className="text-muted">{item.lastVerifiedBy}</span></td>
                      <td>
                        <button
                          type="button"
                          className="btn-pill-sm active"
                          onClick={() => setAdjustModalItem(item)}
                        >
                          手動在庫調整
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3: Account Health Dashboard (Spec #17) */}
      <div className="card account-health-card">
        <div className="card-header space-between">
          <div>
            <h3 className="card-title text-base font-semibold">3. アカウント健全性 & 制限監視 (Account Health Dashboard)</h3>
            <p className="card-subtitle text-xs text-muted">
              ※ アカウント制限やサスペンド回避のための監視ダッシュボードです (マルチアカウントによる制限回避は自動ブロックされます)。
            </p>
          </div>
        </div>

        <div className="card-body">
          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>アカウント表示名</th>
                  <th>販売制限状態</th>
                  <th>出品権限</th>
                  <th>受注未発送</th>
                  <th>ハンドリング遅延リスク</th>
                  <th>追跡番号未入力</th>
                  <th>警告メッセージ</th>
                </tr>
              </thead>
              <tbody>
                {accountHealthRecords.map((acc) => (
                  <tr key={acc.accountId}>
                    <td><strong className="text-sm">{acc.displayName}</strong></td>
                    <td>
                      {acc.sellingRestrictionStatus === 'Active' ? (
                        <span className="status-badge status-connected">🟢 Active (正常)</span>
                      ) : (
                        <span className="status-badge status-unconnected">🔴 {acc.sellingRestrictionStatus} (制限あり)</span>
                      )}
                    </td>
                    <td><span className="font-mono">{acc.canList ? '許可' : '停止'}</span></td>
                    <td><span className="font-mono">{acc.unshippedOrdersCount} 件</span></td>
                    <td><span className="font-mono text-amber-400">{acc.overdueHandlingCount} 件</span></td>
                    <td><span className="font-mono">{acc.missingTrackingCount} 件</span></td>
                    <td>
                      {acc.accountHealthWarnings.length > 0 ? (
                        <span className="text-xs text-danger">{acc.accountHealthWarnings[0]}</span>
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Compliance Blocking Modal */}
      <ComplianceBlockingModal
        gateResult={activeGateResult}
        isOpen={isModalOpen}
        onRecheck={handleEvaluateTrigger}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Manual Stock Adjustment Modal */}
      {adjustModalItem && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title-ja">手動在庫調整 (Manual Stock Adjustment)</h3>
              <button type="button" className="modal-close-btn" onClick={() => setAdjustModalItem(null)}>&times;</button>
            </div>

            <div className="modal-body text-xs space-y-3">
              <div>
                <span className="text-muted">対象SKU: </span>
                <strong className="font-mono text-highlight">{adjustModalItem.sku}</strong>
                <span className="text-muted ml-3">現在の実在庫: </span>
                <strong className="font-mono text-highlight-gold">{adjustModalItem.physicalStockQuantity} 個</strong>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">調整種別 (Adjustment Type)</label>
                <select
                  className="form-control"
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as InventoryAdjustmentType)}
                >
                  <option value="Initial stock entry">Initial stock entry (初期在庫入力)</option>
                  <option value="Stocktake correction">Stocktake correction (棚卸し修正)</option>
                  <option value="New stock received">New stock received (新規入荷)</option>
                  <option value="Sale">Sale (売上減算)</option>
                  <option value="Damaged">Damaged (破損廃棄)</option>
                  <option value="Lost">Lost (紛失)</option>
                  <option value="Manual correction">Manual correction (手動補正)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">増減数量 (Adjustment Delta)</label>
                <input
                  type="number"
                  className="form-control font-mono font-bold"
                  value={adjustDelta}
                  onChange={(e) => setAdjustDelta(parseInt(e.target.value) || 0)}
                />
                <p className="field-hint">※ 入荷・増加はプラス (+1)、減算・廃棄はマイナス (-1) を入力</p>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">調整理由 (Reason - 必須)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="例: 月末実在庫カウントによる修正"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-footer space-between">
              <button type="button" className="btn-secondary" onClick={() => setAdjustModalItem(null)}>
                キャンセル
              </button>
              <button type="button" className="btn-primary" onClick={handleExecuteAdjustment}>
                調整を実行して記録
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
