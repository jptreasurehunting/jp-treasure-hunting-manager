import React from 'react';
import { ActiveListing } from '../../types/sellSimilar';
import { ActiveListingCard } from './ActiveListingCard';

interface SearchResultListProps {
  listings: ActiveListing[];
  query: string;
  onLaunch: (itemId: string, title?: string) => void;
}

export const SearchResultList: React.FC<SearchResultListProps> = ({
  listings,
  query,
  onLaunch
}) => {
  if (listings.length === 0) {
    return (
      <div className="search-results-empty">
        <div className="empty-icon">🔍</div>
        <h3>該当するアクティブ出品が見つかりませんでした</h3>
        <p>
          「<strong>{query}</strong>」に一致するアクティブ出品はありません。直接Item IDを入力するか、eBayで新しい出品を作成してください。
        </p>
      </div>
    );
  }

  return (
    <div className="search-results-container card">
      <div className="card-header space-between">
        <div className="results-header-title">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path>
          </svg>
          <h3>該当出品一覧 ({listings.length}件ヒット)</h3>
        </div>
        <span className="results-subtitle-badge">
          「{query}」の検索結果 — 出品を選択して Sell Similar を起動
        </span>
      </div>

      <div className="card-body">
        <p className="results-instruction font-medium">
          複数の該当出品が見つかりました。類似出品を作成したい商品を選択してください:
        </p>

        <div className="listings-grid">
          {listings.map((listing) => (
            <ActiveListingCard
              key={listing.id}
              listing={listing}
              onLaunch={onLaunch}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
