import React, { useState } from 'react';

interface EbayImportBarProps {
  initialOrderId?: string;
  initialItemId?: string;
  isLoading: boolean;
  onImport: (orderId: string, itemId: string) => void;
}

export const EbayImportBar: React.FC<EbayImportBarProps> = ({
  initialOrderId = '',
  initialItemId = '',
  isLoading,
  onImport
}) => {
  const [orderId, setOrderId] = useState<string>(initialOrderId);
  const [itemId, setItemId] = useState<string>(initialItemId);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onImport(orderId, itemId);
    }
  };

  return (
    <div className="ebay-import-bar card-sub-box">
      <div className="import-bar-header space-between">
        <h4 className="import-bar-title font-bold text-sm">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          eBay注文データの自動読み込み (Ver.1.2)
        </h4>
        <span className="import-mode-tag">
          モード: {import.meta.env.VITE_EBAY_API_MODE === 'live_api' ? '📡 Live API' : '⚡ モックデータ (検証用)'}
        </span>
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
          💡 どちらか一方で検索可能です。両方入力時は注文番号を優先します。
        </span>
        <button
          type="button"
          className="btn-primary btn-import-ebay"
          onClick={() => onImport(orderId, itemId)}
          disabled={isLoading || (!orderId.trim() && !itemId.trim())}
        >
          {isLoading ? (
            <>
              <span className="spinner-sm"></span>
              <span>eBay情報取得中...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
