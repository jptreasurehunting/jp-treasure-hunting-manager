import React from 'react';
import { SearchHistoryItem } from '../../types/sellSimilar';

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelectHistoryItem: (item: SearchHistoryItem) => void;
  onClearHistory: () => void;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({
  history,
  onSelectHistoryItem,
  onClearHistory
}) => {
  if (!history || history.length === 0) {
    return null;
  }

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'item_id':
        return 'type-tag tag-item-id';
      case 'url':
        return 'type-tag tag-url';
      case 'title':
        return 'type-tag tag-title';
      default:
        return 'type-tag';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'item_id':
        return 'Item ID';
      case 'url':
        return 'URL';
      case 'title':
        return 'Title';
      default:
        return 'Search';
    }
  };

  return (
    <div className="search-history-card card">
      <div className="card-header space-between">
        <h3 className="card-title">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          最近の検索履歴 (最大10件)
        </h3>
        <button
          type="button"
          className="btn-secondary btn-sm btn-clear-history"
          onClick={onClearHistory}
          title="検索履歴を全削除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          履歴クリア
        </button>
      </div>

      <div className="card-body">
        <div className="history-items-list">
          {history.map((item) => (
            <div
              key={item.id}
              className="history-item-row"
              onClick={() => onSelectHistoryItem(item)}
              title="この検索結果を再実行"
            >
              <div className="history-item-main">
                <span className={getTypeBadgeClass(item.detectedType)}>
                  {getTypeLabel(item.detectedType)}
                </span>
                <span className="history-query-text">{item.rawInput}</span>
                {item.resultTitle && (
                  <span className="history-result-title">({item.resultTitle})</span>
                )}
              </div>

              <div className="history-item-meta">
                {item.extractedItemId && (
                  <span className="history-item-id">ID: {item.extractedItemId}</span>
                )}
                <span className="history-timestamp">{item.timestamp}</span>
                <button type="button" className="history-action-btn">
                  再実行 ⚡
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
