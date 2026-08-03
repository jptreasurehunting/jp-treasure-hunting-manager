import React, { useState } from 'react';
import { EbaySellerAccount } from '../../types/zonosCustoms';

interface EbayImportBarProps {
  initialOrderId?: string;
  initialItemId?: string;
  isLoading: boolean;
  accounts: EbaySellerAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  onImport: (orderId: string, itemId: string) => void;
}

export const EbayImportBar: React.FC<EbayImportBarProps> = ({
  initialOrderId = '',
  initialItemId = '',
  isLoading,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onImport
}) => {
  const [orderId, setOrderId] = useState<string>(initialOrderId);
  const [itemId, setItemId] = useState<string>(initialItemId);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

  const handleFetchClick = () => {
    // Unconnected Account Safeguard (Spec #3 & Spec #10 Test 2)
    if (selectedAccount && selectedAccount.connectionStatus === 'unconnected') {
      alert('⚠️ このeBayアカウントはまだ接続されていません。アカウント管理画面で接続手続きを行ってください。');
      return;
    }
    onImport(orderId, itemId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFetchClick();
    }
  };

  return (
    <div className="ebay-import-bar card-sub-box">
      <div className="import-bar-header space-between">
        <h4 className="import-bar-title font-bold text-sm">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          eBay注文データの自動読み込み (Ver.1.5)
        </h4>
        <span className="import-mode-tag">
          モード: {import.meta.env.VITE_EBAY_API_MODE === 'live_api' ? '📡 Live API' : '⚡ モックデータ (検証用)'}
        </span>
      </div>

      {/* Account Selector Row (Spec #3) */}
      <div className="account-selector-row margin-top-xs card-sub-box">
        <div className="form-group margin-bottom-none">
          <label htmlFor="selectEbayAccount" className="form-label text-xs font-semibold">
            使用するeBayアカウント (対象セラーアカウント)
          </label>
          <div className="account-select-group">
            <select
              id="selectEbayAccount"
              className="form-control select-account-dropdown"
              value={selectedAccountId}
              onChange={(e) => onSelectAccount(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.displayName} ({acc.ebayUsername}) - {acc.connectionStatus === 'connected' ? '🟢 接続中' : '⚪ 未接続'}
                </option>
              ))}
            </select>
            {selectedAccount && selectedAccount.connectionStatus === 'unconnected' && (
              <span className="account-status-tag status-unconnected">⚪ 未接続</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2col margin-top-xs">
        <div className="form-group">
          <label htmlFor="importOrderId" className="form-label text-xs font-semibold">
            eBay注文番号 (Order ID)
          </label>
          <input
            id="importOrderId"
            type="text"
            className="form-control font-mono"
            placeholder="例: 14-12345-67890"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="form-group">
          <label htmlFor="importItemId" className="form-label text-xs font-semibold">
            eBay商品番号 (Item ID)
          </label>
          <input
            id="importItemId"
            type="text"
            className="form-control font-mono"
            placeholder="例: 256123456789"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>

      <div className="import-bar-footer margin-top-xs space-between">
        <span className="field-hint text-xs">
          💡 どちらか一方で検索可能です。選択アカウント ({selectedAccount?.displayName || 'Account 1'}) から読み込みます。
        </span>
        <button
          type="button"
          className="btn-primary btn-import-ebay"
          onClick={handleFetchClick}
          disabled={isLoading || (!orderId.trim() && !itemId.trim())}
        >
          {isLoading ? (
            <>
              <span className="spinner-sm"></span>
              <span>eBay情報取得中...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span>eBayから読み込む</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
