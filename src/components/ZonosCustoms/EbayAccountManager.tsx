import React, { useState } from 'react';
import { EbaySellerAccount } from '../../types/zonosCustoms';

interface EbayAccountManagerProps {
  accounts: EbaySellerAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onUpdateDisplayName: (accountId: string, newDisplayName: string) => void;
  onOpenConnectPrep: (account: EbaySellerAccount) => void;
  onDisconnectAccount: (accountId: string) => void;
}

export const EbayAccountManager: React.FC<EbayAccountManagerProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  onUpdateDisplayName,
  onOpenConnectPrep,
  onDisconnectAccount
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNameInput, setEditNameInput] = useState<string>('');

  const handleStartEdit = (account: EbaySellerAccount) => {
    setEditingId(account.id);
    setEditNameInput(account.displayName);
  };

  const handleSaveEdit = (accountId: string) => {
    if (editNameInput.trim()) {
      onUpdateDisplayName(accountId, editNameInput.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="card ebay-account-manager-card margin-bottom-lg">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-lg font-bold">eBay アカウント管理 (最大10アカウント)</h3>
          <p className="card-subtitle text-xs text-muted">
            複数のeBayセラーアカウントを登録・切り替えて、注文情報の取得・通関申告に使用できます。
          </p>
        </div>
        <span className="baseline-badge">本番環境 (Production)</span>
      </div>

      <div className="card-body">
        <div className="accounts-table-wrapper">
          <table className="accounts-table">
            <thead>
              <tr>
                <th>対象</th>
                <th>内部ID</th>
                <th>表示名</th>
                <th>eBayユーザー名</th>
                <th>接続状態</th>
                <th>最終認証日時</th>
                <th>最終注文取得日時</th>
                <th>環境</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const isSelected = account.id === selectedAccountId;
                const isConnected = account.connectionStatus === 'connected';

                return (
                  <tr key={account.id} className={isSelected ? 'selected-account-row' : ''}>
                    {/* Active Select Radio */}
                    <td className="text-center">
                      <input
                        type="radio"
                        name="active_ebay_account"
                        id={`radio_${account.id}`}
                        checked={isSelected}
                        onChange={() => onSelectAccount(account.id)}
                        title="このアカウントを注文取得対象として選択"
                      />
                    </td>

                    {/* Internal ID */}
                    <td>
                      <strong className="font-mono text-xs">{account.id}</strong>
                    </td>

                    {/* Display Name (Editable) */}
                    <td>
                      {editingId === account.id ? (
                        <div className="edit-name-inline">
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={editNameInput}
                            onChange={(e) => setEditNameInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(account.id);
                            }}
                          />
                          <button
                            type="button"
                            className="btn-pill-sm active"
                            onClick={() => handleSaveEdit(account.id)}
                          >
                            保存
                          </button>
                        </div>
                      ) : (
                        <div className="display-name-row">
                          <strong className="text-sm">{account.displayName}</strong>
                          <button
                            type="button"
                            className="btn-text-edit"
                            onClick={() => handleStartEdit(account)}
                            title="表示名を変更"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </td>

                    {/* eBay Username */}
                    <td>
                      <span className="text-xs text-muted">{account.ebayUsername}</span>
                    </td>

                    {/* Connection Status */}
                    <td>
                      {account.connectionStatus === 'connected' ? (
                        <span className="status-badge status-connected">🟢 接続中</span>
                      ) : account.connectionStatus === 'prep_mode' ? (
                        <span className="status-badge status-prep">🟡 準備中</span>
                      ) : (
                        <span className="status-badge status-unconnected">⚪ 未接続</span>
                      )}
                    </td>

                    {/* Last Auth Date */}
                    <td>
                      <span className="text-xs text-muted">{account.lastAuthDate || '-'}</span>
                    </td>

                    {/* Last Order Fetch Date */}
                    <td>
                      <span className="text-xs text-muted">{account.lastOrderFetchDate || '-'}</span>
                    </td>

                    {/* Environment */}
                    <td>
                      <span className="env-badge">Production</span>
                    </td>

                    {/* Control Buttons */}
                    <td>
                      <div className="account-actions-group">
                        <button
                          type="button"
                          className="btn-pill-sm active"
                          onClick={() => onOpenConnectPrep(account)}
                        >
                          接続
                        </button>
                        <button
                          type="button"
                          className="btn-pill-sm"
                          onClick={() => onOpenConnectPrep(account)}
                        >
                          再認証
                        </button>
                        {isConnected && (
                          <button
                            type="button"
                            className="btn-pill-sm btn-danger-pill"
                            onClick={() => onDisconnectAccount(account.id)}
                          >
                            接続解除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
