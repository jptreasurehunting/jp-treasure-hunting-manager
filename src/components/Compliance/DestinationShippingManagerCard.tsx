import React, { useState } from 'react';
import { CountryComplianceRecord, DestinationShippingCost } from '../../types/zonosCustoms';

interface DestinationShippingManagerCardProps {
  complianceRecords: CountryComplianceRecord[];
  shippingRates: DestinationShippingCost[];
  onUpdateShippingRate: (updatedRate: DestinationShippingCost) => void;
  onOpenComplianceManager: () => void;
  onAddAuditLog: (action: string, beforeState?: string, afterState?: string) => void;
}

export const DestinationShippingManagerCard: React.FC<DestinationShippingManagerCardProps> = ({
  complianceRecords,
  shippingRates,
  onUpdateShippingRate,
  onOpenComplianceManager,
  onAddAuditLog
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('US');
  const [editRateForm, setEditRateForm] = useState<DestinationShippingCost | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState<boolean>(false);

  const activeRecord = complianceRecords.find((r) => r.countryCode === selectedCountryCode);
  const activeRate = shippingRates.find((r) => r.countryCode === selectedCountryCode);

  const handleSelectCountry = (countryCode: string) => {
    const record = complianceRecords.find((r) => r.countryCode === countryCode);
    if (record && !record.isSalesEnabled) {
      alert(`「${record.countryName}」は法規制コンプライアンス未完了のためロックされています。コンプライアンス管理画面で対応情報を登録してください。`);
      onOpenComplianceManager();
      return;
    }

    setSelectedCountryCode(countryCode);
    const existingRate = shippingRates.find((r) => r.countryCode === countryCode) || {
      countryCode,
      countryName: record?.countryName || countryCode,
      shippingService: 'Japan Post EMS',
      shippingCost: 20.0,
      currency: 'USD',
      handlingTimeDays: 2
    };
    setEditRateForm({ ...existingRate });
  };

  const handleSaveRateClick = () => {
    if (!editRateForm) return;
    setReviewModalOpen(true);
  };

  const handleConfirmSaveRate = () => {
    if (!editRateForm) return;
    onUpdateShippingRate(editRateForm);
    onAddAuditLog(
      '国別送料・配送設定を変更',
      `${editRateForm.countryName}`,
      `配送方法: ${editRateForm.shippingService}, 送料: $${editRateForm.shippingCost} USD (他国の設定へ影響なし)`
    );
    setReviewModalOpen(false);
  };

  return (
    <div className="card destination-shipping-manager-card margin-bottom-lg">
      <div className="card-header space-between">
        <div>
          <div className="banner-tag-badge margin-bottom-xs">🚚 国別個別送料・配送設定 (Spec #7)</div>
          <h3 className="card-title text-base font-semibold">Shipping Region Manager & Destination-Specific Rates</h3>
          <p className="card-subtitle text-xs text-muted">
            国ごとに独立した配送方法・送料を設定できます。カナダや豪州の送料変更が米国等他国の送料を上書きすることはありません。
          </p>
        </div>
        <button
          type="button"
          className="btn-pill-sm active"
          onClick={onOpenComplianceManager}
        >
          🌐 コンプライアンス管理を開く
        </button>
      </div>

      <div className="card-body space-y-4">
        {/* Country Selector Pills with Lock Reason (Spec #5) */}
        <div>
          <label className="form-label font-bold text-xs margin-bottom-xs block">
            配送対象国の選択 (Select Destination Country)
          </label>
          <div className="flex flex-wrap gap-2">
            {complianceRecords.map((rec) => {
              const isLocked = !rec.isSalesEnabled;

              return (
                <button
                  key={rec.countryCode}
                  type="button"
                  className={`country-select-pill ${selectedCountryCode === rec.countryCode ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => handleSelectCountry(rec.countryCode)}
                >
                  <span className="font-bold">{rec.countryName}</span>
                  {isLocked ? (
                    <span className="lock-reason-tag">
                      🔒 Locked — {rec.countryCode === 'DE' ? 'Information incomplete' : 'Compliance review required'}
                    </span>
                  ) : (
                    <span className="available-tag">🟢 Available</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Country Rate Editor */}
        {activeRecord && activeRecord.isSalesEnabled && editRateForm && (
          <div className="card-sub-box bg-slate-900 border-slate-700 margin-top-md">
            <h4 className="font-bold text-sm text-highlight margin-bottom-sm">
              [{editRateForm.countryName}] 個別送料・配送設定
            </h4>

            <div className="grid-3col text-xs space-y-2">
              <div className="form-group">
                <label className="form-label font-bold">配送サービス (Shipping Service)</label>
                <select
                  className="form-control"
                  value={editRateForm.shippingService}
                  onChange={(e) => setEditRateForm({ ...editRateForm, shippingService: e.target.value })}
                >
                  <option value="Japan Post EMS">Japan Post EMS</option>
                  <option value="Japan Post International Parcel Air">Japan Post International Parcel Air</option>
                  <option value="Japan Post Express Air">Japan Post Express Air</option>
                  <option value="DHL Express International">DHL Express International</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">国別送料 (Shipping Cost)</label>
                <div className="flex items-center gap-1">
                  <span className="font-mono">$</span>
                  <input
                    type="number"
                    step="0.5"
                    className="form-control font-mono font-bold text-highlight-gold"
                    value={editRateForm.shippingCost}
                    onChange={(e) => setEditRateForm({ ...editRateForm, shippingCost: parseFloat(e.target.value) || 0 })}
                  />
                  <span className="font-mono text-muted">USD</span>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label font-bold">ハンドリングタイム (Handling Time)</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    className="form-control font-mono"
                    value={editRateForm.handlingTimeDays}
                    onChange={(e) => setEditRateForm({ ...editRateForm, handlingTimeDays: parseInt(e.target.value) || 1 })}
                  />
                  <span className="text-muted">Days</span>
                </div>
              </div>
            </div>

            <div className="margin-top-md flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveRateClick}
              >
                国別送料設定を確認・適用
              </button>
            </div>
          </div>
        )}

        {/* Existing Rates Summary Table (Spec #7) */}
        <div>
          <h4 className="font-bold text-xs text-muted margin-bottom-xs">現在の設定済み国別送料サマリー</h4>
          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>対象国名</th>
                  <th>国コード</th>
                  <th>配送サービス</th>
                  <th>国別設定送料 ($)</th>
                  <th>ハンドリングタイム</th>
                </tr>
              </thead>
              <tbody>
                {shippingRates.map((rate) => (
                  <tr key={rate.countryCode}>
                    <td><strong className="text-sm">{rate.countryName}</strong></td>
                    <td><span className="font-mono">{rate.countryCode}</span></td>
                    <td><span>{rate.shippingService}</span></td>
                    <td><strong className="font-mono text-highlight-gold">${rate.shippingCost.toFixed(2)} USD</strong></td>
                    <td><span>{rate.handlingTimeDays} Days</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review Modal (Spec #6) */}
      {reviewModalOpen && editRateForm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title-ja">国別配送設定の確認 (Review Destination Settings)</h3>
              <button type="button" className="modal-close-btn" onClick={() => setReviewModalOpen(false)}>&times;</button>
            </div>

            <div className="modal-body text-xs space-y-3">
              <div className="modal-info-banner">
                <p>⚠️ <strong>独立送料確認:</strong> この設定は「<strong>{editRateForm.countryName}</strong>」専用の送料です。米国や他国の送料へ上書き・干渉することはありません。</p>
              </div>

              <div className="order-summary-box space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted">対象国:</span>
                  <strong>{editRateForm.countryName} ({editRateForm.countryCode})</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">配送サービス:</span>
                  <strong>{editRateForm.shippingService}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">国別個別送料:</span>
                  <strong className="font-mono text-highlight-gold">${editRateForm.shippingCost.toFixed(2)} USD</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">ハンドリングタイム:</span>
                  <strong>{editRateForm.handlingTimeDays} Days</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer space-between">
              <button type="button" className="btn-secondary" onClick={() => setReviewModalOpen(false)}>
                キャンセル
              </button>
              <button type="button" className="btn-primary" onClick={handleConfirmSaveRate}>
                確認して国別配送設定を適用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
