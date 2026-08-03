import React, { useState } from 'react';
import { CountryComplianceRecord } from '../../types/zonosCustoms';
import {
  validateGermanyCompliance,
  checkExpiryWarning
} from '../../services/countryComplianceService';

interface CountryComplianceManagerProps {
  records: CountryComplianceRecord[];
  onUpdateRecord: (updatedRecord: CountryComplianceRecord) => void;
  onAddAuditLog: (action: string, beforeState?: string, afterState?: string) => void;
}

export const CountryComplianceManager: React.FC<CountryComplianceManagerProps> = ({
  records,
  onUpdateRecord,
  onAddAuditLog
}) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CountryComplianceRecord | null>(null);
  const [germanyWarning, setGermanyWarning] = useState<string | null>(null);

  const activeRecord = selectedCountryCode
    ? records.find((r) => r.countryCode === selectedCountryCode) || null
    : null;

  const handleOpenEdit = (record: CountryComplianceRecord) => {
    setSelectedCountryCode(record.countryCode);
    setEditForm({ ...record });
    setGermanyWarning(null);
  };

  const handleCloseEdit = () => {
    setSelectedCountryCode(null);
    setEditForm(null);
    setGermanyWarning(null);
  };

  // Toggle Sales Enable Handler
  const handleToggleSalesEnabled = (record: CountryComplianceRecord) => {
    if (!record.isSalesEnabled) {
      // Trying to enable
      if (record.countryCode === 'DE') {
        const val = validateGermanyCompliance(record);
        if (!val.isValid) {
          onAddAuditLog('配送先の追加を停止', 'Germany', 'LUCID等の適合情報未完了のため停止');
          setGermanyWarning(
            'ドイツ向け販売には包装法等への対応確認が必要です。必要な登録・契約が確認できないため、ドイツを配送先に追加できません。'
          );
          handleOpenEdit(record);
          return;
        }
      } else if (record.countryCode !== 'US' && record.countryCode !== 'CA' && record.countryCode !== 'AU') {
        if (!record.evidenceConfirmedByUser) {
          onAddAuditLog('配送先の追加を停止', record.countryName, 'EPR・製品規制の確認未完了のため停止');
          alert('「国ごとに包装・EPR・製品規制が異なるため、別途確認が必要です。」編集ボタンから確認手続きを行ってください。');
          handleOpenEdit(record);
          return;
        }
      }
    }

    const newEnabled = !record.isSalesEnabled;
    const updated: CountryComplianceRecord = {
      ...record,
      isSalesEnabled: newEnabled,
      status: newEnabled
        ? record.evidenceConfirmedByUser ? 'Confirmed by user' : 'Available'
        : 'Disabled'
    };

    onUpdateRecord(updated);
    if (newEnabled) {
      onAddAuditLog('国別販売を許可', record.countryName, '販売有効');
    } else {
      onAddAuditLog('国別販売を停止', record.countryName, '販売無効');
    }
  };

  // Save Edit Form Handler
  const handleSaveGermanyForm = () => {
    if (!editForm) return;

    if (editForm.countryCode === 'DE') {
      const val = validateGermanyCompliance(editForm);
      if (!val.isValid) {
        setGermanyWarning(
          'ドイツ向け販売には包装法等への対応確認が必要です。必要な登録・契約が確認できないため、ドイツを配送先に追加できません。'
        );
        onAddAuditLog('コンプライアンス情報入力不備', 'Germany', `${val.errors.length}件の不足`);
        return;
      }
    }

    const nowStr = new Date().toLocaleString('ja-JP');
    const expiryCheck = checkExpiryWarning(editForm.validUntilDate);

    let newStatus = editForm.status;
    let newEnabled = editForm.isSalesEnabled;

    if (expiryCheck.isExpired) {
      newStatus = 'Expired';
      newEnabled = false;
    } else if (editForm.evidenceConfirmedByUser) {
      newStatus = 'Confirmed by user';
      newEnabled = true;
    }

    const updatedRecord: CountryComplianceRecord = {
      ...editForm,
      isSalesEnabled: newEnabled,
      status: newStatus,
      evidenceConfirmedAt: editForm.evidenceConfirmedByUser ? nowStr : undefined
    };

    onUpdateRecord(updatedRecord);
    onAddAuditLog(
      'コンプライアンス情報を変更',
      `${editForm.countryName}`,
      `ステータス: ${newStatus} (確認者: ユーザー)`
    );

    if (editForm.evidenceConfirmedByUser) {
      onAddAuditLog('ユーザー確認を完了', editForm.countryName, `確認日時: ${nowStr}`);
    } else {
      onAddAuditLog('コンプライアンス確認を取消', editForm.countryName, '確認解除');
    }

    handleCloseEdit();
  };

  return (
    <div className="card country-compliance-manager-card margin-bottom-lg">
      <div className="card-header space-between">
        <div>
          <div className="banner-tag-badge margin-bottom-xs">🌐 Ver.1.7 法規制コンプライアンス管理</div>
          <h3 className="card-title text-lg font-bold">Country Sales & Compliance Manager</h3>
          <p className="card-subtitle text-xs text-muted">
            eBay出品で選択可能な配送先国を統合管理し、包装法(LUCID)やEPR等の法令未対応国の誤有効化を自動防除します。
          </p>
        </div>
        <span className="baseline-badge">法令適合補助</span>
      </div>

      <div className="card-body">
        {/* Legal Disclaimer Banner (Spec #10) */}
        <div className="legal-disclaimer-banner card-sub-box border-amber-500/30 bg-amber-500/10 margin-bottom-md text-xs">
          ⚖️ <strong>免責告知 (Legal Advisory):</strong> 「この機能は登録情報の管理補助です。法令適合を保証するものではありません。」
        </div>

        {/* Country Compliance Table */}
        <div className="accounts-table-wrapper">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>販売許可</th>
                <th>国コード</th>
                <th>国名 / 地域</th>
                <th>コンプライアンス状態</th>
                <th>必要登録・認証</th>
                <th>登録番号 / LUCID番号</th>
                <th>証拠確認日時</th>
                <th>メモ</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const expiryCheck = checkExpiryWarning(record.validUntilDate);

                return (
                  <tr key={record.countryCode} className={record.isSalesEnabled ? 'selected-account-row' : ''}>
                    {/* Sales Enabled Toggle */}
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={record.isSalesEnabled}
                        onChange={() => handleToggleSalesEnabled(record)}
                        title={`${record.countryName} の販売許可を切替`}
                      />
                    </td>

                    {/* Country Code */}
                    <td>
                      <strong className="font-mono text-xs">{record.countryCode}</strong>
                    </td>

                    {/* Country Name */}
                    <td>
                      <strong className="text-sm">{record.countryName}</strong>
                    </td>

                    {/* Compliance Status */}
                    <td>
                      {record.status === 'Available' ? (
                        <span className="status-badge status-connected">🟢 Available (許可)</span>
                      ) : record.status === 'Confirmed by user' ? (
                        <span className="status-badge status-connected">✅ Confirmed by user</span>
                      ) : record.status === 'Expired' ? (
                        <span className="status-badge status-unconnected text-danger">⚠️ Expired (期限切れ)</span>
                      ) : (
                        <span className="status-badge status-prep">🟡 Compliance required</span>
                      )}
                    </td>

                    {/* Required Registrations */}
                    <td>
                      {record.requiredRegistrations.length > 0 ? (
                        <ul className="text-xs text-muted space-y-0.5">
                          {record.requiredRegistrations.map((req, idx) => (
                            <li key={idx}>・{req}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>

                    {/* Reg Number */}
                    <td>
                      <span className="font-mono text-xs text-highlight-gold">
                        {record.registrationNumber || '-'}
                      </span>
                    </td>

                    {/* Confirmation Date */}
                    <td>
                      <span className="text-xs text-muted">{record.evidenceConfirmedAt || '-'}</span>
                    </td>

                    {/* Notes */}
                    <td>
                      <span className="text-xs text-muted truncate max-w-xs block">{record.notes || '-'}</span>
                    </td>

                    {/* Edit Control */}
                    <td>
                      <button
                        type="button"
                        className="btn-pill-sm active"
                        onClick={() => handleOpenEdit(record)}
                      >
                        編集 / 確認
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Country Compliance Edit Modal (Germany LUCID / EU EPR) */}
      {selectedCountryCode && editForm && (
        <div className="modal-overlay">
          <div className="modal-card compliance-modal-card">
            <div className="modal-header">
              <div className="modal-title-group">
                <span className="modal-alert-icon">📜</span>
                <div>
                  <h3 className="modal-title-ja">{editForm.countryName} コンプライアンス管理</h3>
                  <p className="modal-title-en text-muted">Packaging & Product Compliance Detail Review</p>
                </div>
              </div>
              <button type="button" className="modal-close-btn" onClick={handleCloseEdit} aria-label="閉じる">&times;</button>
            </div>

            <div className="modal-body space-y-4">
              {germanyWarning && (
                <div className="validation-error-item text-xs">
                  ❌ {germanyWarning}
                  <p className="text-muted text-xs margin-top-xs">
                    "Germany cannot be enabled until the required packaging compliance information has been confirmed."
                  </p>
                </div>
              )}

              {/* Germany Specific Requirements Info Box */}
              {editForm.countryCode === 'DE' && (
                <div className="card-sub-box bg-amber-500/10 border-amber-500/30 text-xs">
                  <h4 className="font-bold text-amber-400 margin-bottom-xs">🇩🇪 Germany — Packaging compliance required</h4>
                  <ul className="space-y-1 text-slate-300">
                    <li>・LUCID包装レジスターへの登録完了</li>
                    <li>・二元処理システム(Packaging system participation)との契約完了</li>
                    <li>・LUCID登録番号の取得およびeBayへの登録入力完了</li>
                    <li>・適合証拠（契約書・支払受領書等）のユーザー目視確認完了</li>
                  </ul>
                </div>
              )}

              {/* Other EU Countries Info Box */}
              {editForm.countryCode !== 'DE' && editForm.countryCode !== 'US' && editForm.countryCode !== 'CA' && editForm.countryCode !== 'AU' && (
                <div className="card-sub-box bg-slate-800 text-xs">
                  <h4 className="font-bold text-highlight margin-bottom-xs">🇪🇺 EU/EEA 国別個別要求事項</h4>
                  <p className="text-muted">「国ごとに包装・EPR・製品規制が異なるため、別途確認が必要です。」ドイツの登録情報が他国へ自動適用されることはありません。</p>
                </div>
              )}

              {/* Form Inputs */}
              <div className="grid-2col text-xs">
                <div className="form-group">
                  <label className="form-label font-bold">LUCID/EPR 登録番号 (Registration Number)</label>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="例: DE1234567890123"
                    value={editForm.registrationNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, registrationNumber: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label font-bold">包装システム事業者名 (Provider)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="例: Der Grüne Punkt / Landbell"
                    value={editForm.packagingProvider || ''}
                    onChange={(e) => setEditForm({ ...editForm, packagingProvider: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label font-bold">契約/参照番号 (Contract/Ref No.)</label>
                  <input
                    type="text"
                    className="form-control font-mono"
                    placeholder="例: CNT-2026-9988"
                    value={editForm.contractRefNumber || ''}
                    onChange={(e) => setEditForm({ ...editForm, contractRefNumber: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label font-bold">契約開始日 (Valid From)</label>
                  <input
                    type="date"
                    className="form-control font-mono"
                    value={editForm.validFromDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, validFromDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label font-bold">契約終了/更新日 (Valid Until)</label>
                  <input
                    type="date"
                    className="form-control font-mono"
                    value={editForm.validUntilDate || ''}
                    onChange={(e) => setEditForm({ ...editForm, validUntilDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label font-bold">メモ (Notes)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="例: 2026年度年間契約完了"
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  />
                </div>
              </div>

              {/* Evidence Confirmation Checkbox (Spec #3) */}
              <div className="card-sub-box bg-slate-900 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="chk_evidence_confirm"
                  checked={editForm.evidenceConfirmedByUser}
                  onChange={(e) => setEditForm({ ...editForm, evidenceConfirmedByUser: e.target.checked })}
                />
                <label htmlFor="chk_evidence_confirm" className="text-xs font-semibold cursor-pointer">
                  適合証拠を目視確認しました (Compliance evidence confirmed by user)
                </label>
              </div>
            </div>

            <div className="modal-footer space-between">
              <button type="button" className="btn-secondary" onClick={handleCloseEdit}>
                キャンセル
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveGermanyForm}>
                保存して確認完了
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
