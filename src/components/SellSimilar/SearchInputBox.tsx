import React from 'react';
import { SearchInputType } from '../../types/sellSimilar';

interface SearchInputBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  detectedType: SearchInputType;
  isSearching: boolean;
  onSampleClick?: (sampleVal: string) => void;
}

export const SearchInputBox: React.FC<SearchInputBoxProps> = ({
  value,
  onChange,
  onSubmit,
  onClear,
  detectedType,
  isSearching,
  onSampleClick
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  const renderBadge = () => {
    switch (detectedType) {
      case 'item_id':
        return <span className="type-badge badge-item-id">⚡ 検出: eBay Item Number (10〜14桁)</span>;
      case 'url':
        return <span className="type-badge badge-url">🔗 検出: eBay Item URL</span>;
      case 'title':
        return <span className="type-badge badge-title">🔍 検出: 出品タイトル / キーワード</span>;
      default:
        return <span className="type-badge badge-empty">💡 Item ID / URL / キーワードを入力</span>;
    }
  };

  return (
    <div className="search-input-container">
      <div className="search-input-header">
        <label htmlFor="sellSimilarInput" className="form-label font-bold text-base">
          入力: eBay Item ID / URL / 商品タイトル
        </label>
        {renderBadge()}
      </div>

      <div className="search-input-wrapper">
        <div className="input-icon-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>

        <input
          id="sellSimilarInput"
          type="text"
          className="form-control search-field-input"
          placeholder="例: 256123456789 または https://www.ebay.com/itm/... または Canon AE-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />

        {value && (
          <button
            type="button"
            className="input-clear-btn"
            onClick={onClear}
            title="入力クリア"
            aria-label="Clear input"
          >
            &times;
          </button>
        )}
      </div>

      {/* Sample 1-Click Chips for Beginners */}
      {onSampleClick && (
        <div className="flex items-center gap-2 text-xs flex-wrap pt-1">
          <span className="text-muted font-semibold">初心者向けワンクリック入力例:</span>
          <button
            type="button"
            className="btn-secondary btn-xs font-mono"
            onClick={() => onSampleClick('256123456789')}
          >
            ⚡ Item Number (256123456789)
          </button>
          <button
            type="button"
            className="btn-secondary btn-xs font-mono"
            onClick={() => onSampleClick('Canon AE-1 Program Vintage Camera')}
          >
            🔍 商品名 (Canon AE-1)
          </button>
          <button
            type="button"
            className="btn-secondary btn-xs font-mono"
            onClick={() => onSampleClick('https://www.ebay.com/itm/256123456789')}
          >
            🔗 eBay URL
          </button>
        </div>
      )}

      <div className="search-action-bar flex justify-between items-center pt-2">
        <p className="field-hint text-xs">
          💡 <strong>Item ID (10〜14桁)</strong> を入力すると最速で Sell Similar 画面を起動します。
        </p>

        <button
          type="button"
          className="btn-primary btn-launch-sell-similar"
          onClick={onSubmit}
          disabled={isSearching}
        >
          {isSearching ? (
            <>
              <span className="spinner-sm"></span>
              <span>検証・検索中...</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>🚀 1クリックで類似出品を開く (Sell Similar)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
