import React from 'react';
import { SearchInputType } from '../../types/sellSimilar';

interface SearchInputBoxProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  detectedType: SearchInputType;
  isSearching: boolean;
}

export const SearchInputBox: React.FC<SearchInputBoxProps> = ({
  value,
  onChange,
  onSubmit,
  onClear,
  detectedType,
  isSearching
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
        return <span className="type-badge badge-item-id">⚡ 検出: eBay Item Number</span>;
      case 'url':
        return <span className="type-badge badge-url">🔗 検出: eBay Item URL</span>;
      case 'title':
        return <span className="type-badge badge-title">🔍 検出: 出品タイトル検索</span>;
      default:
        return <span className="type-badge badge-empty">💡 Item ID / URL / タイトル</span>;
    }
  };

  return (
    <div className="search-input-container">
      <div className="search-input-header">
        <label htmlFor="sellSimilarInput" className="form-label font-bold text-lg">
          検索キーワード・URL・Item ID
        </label>
        {renderBadge()}
      </div>

      <div className="search-input-wrapper">
        <div className="input-icon-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
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

      <div className="search-action-bar">
        <button
          type="button"
          className="btn-primary btn-launch-sell-similar"
          onClick={onSubmit}
          disabled={!value.trim() || isSearching}
        >
          {isSearching ? (
            <>
              <span className="spinner-sm"></span>
              <span>検索中...</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>Open Sell Similar (類似出品)</span>
            </>
          )}
        </button>
      </div>
      <p className="field-hint">
        💡 <strong>Enterキーで実行可能</strong>。Item ID、eBay商品URL、または出品商品のタイトルで出品フローを最速起動します。
      </p>
    </div>
  );
};
