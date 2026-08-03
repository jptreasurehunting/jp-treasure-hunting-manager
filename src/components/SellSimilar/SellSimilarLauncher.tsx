import React, { useState, useEffect } from 'react';
import {
  ActiveListing,
  SearchHistoryItem,
  SearchInputType,
  SearchResultState
} from '../../types/sellSimilar';
import { MOCK_ACTIVE_LISTINGS } from '../../data/mockActiveListings';
import { SearchInputBox } from './SearchInputBox';
import { SearchResultList } from './SearchResultList';
import { SearchHistory } from './SearchHistory';
import { ActiveListingCard } from './ActiveListingCard';

const STORAGE_KEY = 'sell_similar_search_history';

export const SellSimilarLauncher: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [detectedType, setDetectedType] = useState<SearchInputType>('empty');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [searchState, setSearchState] = useState<SearchResultState>({
    query: '',
    detectedType: 'empty',
    status: 'idle',
    matchedListings: [],
    launchedItemId: null
  });

  // Load history on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to load search history from sessionStorage:', e);
    }
  }, []);

  // Save history helper
  const saveToHistory = (
    rawInput: string,
    type: 'item_id' | 'url' | 'title',
    extractedItemId: string,
    resultCount: number,
    resultTitle?: string
  ) => {
    const newItem: SearchHistoryItem = {
      id: Date.now().toString(),
      rawInput,
      detectedType: type,
      extractedItemId,
      resultTitle,
      resultCount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setHistory((prevHistory) => {
      // Filter out duplicate raw inputs if any
      const filtered = prevHistory.filter((item) => item.rawInput.trim() !== rawInput.trim());
      const updated = [newItem, ...filtered].slice(0, 10);
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save search history to sessionStorage:', e);
      }
      return updated;
    });
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear search history:', e);
    }
    showToast('検索履歴を削除しました');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper to extract item ID from raw input or URL
  const detectInputType = (val: string): SearchInputType => {
    const trimmed = val.trim();
    if (!trimmed) return 'empty';

    // Check if 10-14 digit item number
    if (/^\d{10,14}$/.test(trimmed)) {
      return 'item_id';
    }

    // Check if URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('ebay.com')) {
      return 'url';
    }

    return 'title';
  };

  // Handle live input change
  const handleInputChange = (val: string) => {
    setInputValue(val);
    setDetectedType(detectInputType(val));
  };

  const handleClearInput = () => {
    setInputValue('');
    setDetectedType('empty');
    setSearchState({
      query: '',
      detectedType: 'empty',
      status: 'idle',
      matchedListings: [],
      launchedItemId: null
    });
  };

  // Execute Sell Similar URL open action
  const launchSellSimilarFlow = (itemId: string, title?: string) => {
    // Official eBay Sell Similar launch URL pattern
    const sellSimilarUrl = `https://www.ebay.com/sl/sell?sr=sh&fee=false&itemId=${encodeURIComponent(itemId)}`;
    
    // Open in new tab securely
    window.open(sellSimilarUrl, '_blank', 'noopener,noreferrer');

    showToast(`⚡ Item ID: ${itemId} の類似出品画面 (Sell Similar) を新しいタブで開きました`);
  };

  // Extract Item ID from eBay URL
  const extractItemIdFromUrl = (urlStr: string): string | null => {
    // Matches /itm/.../123456789012 or /itm/123456789012 or itemId=123456789012
    const patterns = [
      /\/itm\/(?:[^\/]+\/)?(\d{10,14})/i,
      /itemId=(\d{10,14})/i,
      /\b(\d{10,14})\b/
    ];

    for (const pattern of patterns) {
      const match = urlStr.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  // Perform search / action
  const handlePerformSearch = () => {
    const raw = inputValue.trim();
    if (!raw) return;

    setIsSearching(true);
    const inputType = detectInputType(raw);

    setTimeout(() => {
      if (inputType === 'item_id') {
        const itemId = raw;
        const matched = MOCK_ACTIVE_LISTINGS.find((item) => item.itemId === itemId);
        
        launchSellSimilarFlow(itemId, matched?.title);
        saveToHistory(raw, 'item_id', itemId, 1, matched?.title);

        setSearchState({
          query: raw,
          detectedType: 'item_id',
          status: 'direct_item',
          matchedListings: matched ? [matched] : [],
          launchedItemId: itemId,
          message: `Item Number ${itemId} の Sell Similar フローを直接起動しました。`
        });
      } else if (inputType === 'url') {
        const extractedId = extractItemIdFromUrl(raw);
        if (extractedId) {
          const matched = MOCK_ACTIVE_LISTINGS.find((item) => item.itemId === extractedId);
          launchSellSimilarFlow(extractedId, matched?.title);
          saveToHistory(raw, 'url', extractedId, 1, matched?.title);

          setSearchState({
            query: raw,
            detectedType: 'url',
            status: 'direct_item',
            matchedListings: matched ? [matched] : [],
            launchedItemId: extractedId,
            message: `URLから Item ID: ${extractedId} を自動抽出し、Sell Similar フローを起動しました。`
          });
        } else {
          setSearchState({
            query: raw,
            detectedType: 'url',
            status: 'no_match',
            matchedListings: [],
            launchedItemId: null,
            message: '⚠️ 入力されたURLから有効なeBay Item ID (10〜14桁) を検出できませんでした。'
          });
        }
      } else if (inputType === 'title') {
        // Search active listings by title
        const queryLower = raw.toLowerCase();
        const results = MOCK_ACTIVE_LISTINGS.filter(
          (listing) =>
            listing.title.toLowerCase().includes(queryLower) ||
            (listing.sku && listing.sku.toLowerCase().includes(queryLower)) ||
            listing.category.toLowerCase().includes(queryLower)
        );

        if (results.length === 1) {
          // Requirement 3: If input is Product Title: Search active listings first. If one result exists: Open Sell Similar.
          const matchedItem = results[0];
          launchSellSimilarFlow(matchedItem.itemId, matchedItem.title);
          saveToHistory(raw, 'title', matchedItem.itemId, 1, matchedItem.title);

          setSearchState({
            query: raw,
            detectedType: 'title',
            status: 'single_match',
            matchedListings: results,
            launchedItemId: matchedItem.itemId,
            message: `「${raw}」に一致するアクティブ出品が1件ヒットしました。Sell Similarを自動起動しました。`
          });
        } else if (results.length > 1) {
          // Requirement 3: If multiple: Show selectable list.
          saveToHistory(raw, 'title', '', results.length, `${results.length}件選択`);

          setSearchState({
            query: raw,
            detectedType: 'title',
            status: 'multi_match',
            matchedListings: results,
            launchedItemId: null,
            message: `「${raw}」に一致する出品が ${results.length} 件見つかりました。`
          });
        } else {
          // 0 results
          saveToHistory(raw, 'title', '', 0);

          setSearchState({
            query: raw,
            detectedType: 'title',
            status: 'no_match',
            matchedListings: [],
            launchedItemId: null,
            message: `「${raw}」に一致する自社アクティブ出品は見つかりませんでした。`
          });
        }
      }

      setIsSearching(false);
    }, 250);
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    setInputValue(item.rawInput);
    setDetectedType(item.detectedType);
    if (item.extractedItemId) {
      launchSellSimilarFlow(item.extractedItemId, item.resultTitle);
    } else {
      // Re-trigger title search
      handleInputChange(item.rawInput);
      setTimeout(() => {
        handlePerformSearch();
      }, 50);
    }
  };

  return (
    <div className="sell-similar-container">
      {/* Page Header */}
      <div className="launcher-header-card card">
        <div className="card-header space-between">
          <div className="title-with-badge">
            <h2 className="card-title text-xl font-bold">
              <svg className="card-icon icon-lightning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              Sell Similar Quick Launcher (類似出品クイックランチャー)
            </h2>
            <span className="feature-status-badge">新規機能 ✨</span>
          </div>
        </div>
        <div className="card-body">
          <p className="page-description">
            eBay Item ID、商品URL、または商品タイトルを入力するだけで、最も最速な <strong>Sell Similar（類似出品）フロー</strong> を起動できます。
            検索履歴（直近10件）から過去の出品をワンクリックで再利用可能です。
          </p>

          <SearchInputBox
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handlePerformSearch}
            onClear={handleClearInput}
            detectedType={detectedType}
            isSearching={isSearching}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Search Result Feedback Section */}
      {searchState.status !== 'idle' && (
        <div className="search-state-feedback-area">
          {searchState.status === 'single_match' && searchState.matchedListings[0] && (
            <div className="card matched-single-card">
              <div className="card-header space-between">
                <h3 className="card-title text-success">
                  ✓ ヒット商品 (1件) — Sell Similar 起動済
                </h3>
              </div>
              <div className="card-body">
                <ActiveListingCard
                  listing={searchState.matchedListings[0]}
                  onLaunch={launchSellSimilarFlow}
                />
              </div>
            </div>
          )}

          {searchState.status === 'direct_item' && (
            <div className="card matched-single-card">
              <div className="card-header space-between">
                <h3 className="card-title text-success">
                  ✓ Item ID ({searchState.launchedItemId}) — Sell Similar 起動済
                </h3>
              </div>
              <div className="card-body">
                {searchState.matchedListings.length > 0 ? (
                  <ActiveListingCard
                    listing={searchState.matchedListings[0]}
                    onLaunch={launchSellSimilarFlow}
                  />
                ) : (
                  <div className="direct-item-fallback-box">
                    <p>💡 Item ID <strong>{searchState.launchedItemId}</strong> の eBay 類似出品作成ページを開きました。</p>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => launchSellSimilarFlow(searchState.launchedItemId!)}
                    >
                      Sell Similar 画面を再開する
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {searchState.status === 'multi_match' && (
            <SearchResultList
              listings={searchState.matchedListings}
              query={searchState.query}
              onLaunch={launchSellSimilarFlow}
            />
          )}

          {searchState.status === 'no_match' && (
            <div className="card no-match-card">
              <div className="card-body">
                <div className="empty-state-box">
                  <span className="empty-state-icon">🔎</span>
                  <h3>該当する自社アクティブ出品が見つかりませんでした</h3>
                  <p>{searchState.message}</p>
                  <div className="empty-action-group">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        window.open(`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchState.query)}`, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      eBay全体で 「{searchState.query}」 を検索する
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* User's Active Listings Quick Directory */}
      <div className="card active-directory-card">
        <div className="card-header space-between">
          <h3 className="card-title">
            <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            自社アクティブ出品一覧 (クイック選択)
          </h3>
          <span className="count-badge">{MOCK_ACTIVE_LISTINGS.length} 件のアクティブ出品</span>
        </div>
        <div className="card-body">
          <p className="field-hint margin-bottom-md">
            よく類似出品されるアクティブ商品一覧です。アイテムを選択すると即座に Sell Similar が起動します。
          </p>
          <div className="listings-grid">
            {MOCK_ACTIVE_LISTINGS.map((listing) => (
              <ActiveListingCard
                key={listing.id}
                listing={listing}
                onLaunch={launchSellSimilarFlow}
                isCompact
              />
            ))}
          </div>
        </div>
      </div>

      {/* History Component */}
      <SearchHistory
        history={history}
        onSelectHistoryItem={handleSelectHistoryItem}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
};
