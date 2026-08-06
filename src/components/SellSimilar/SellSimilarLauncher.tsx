import React, { useState, useEffect } from 'react';
import {
  SearchHistoryItem,
  SearchInputType,
  SearchResultState
} from '../../types/sellSimilar';
import { MOCK_ACTIVE_LISTINGS } from '../../data/mockActiveListings';
import { SearchInputBox } from './SearchInputBox';
import { SearchResultList } from './SearchResultList';
import { SearchHistory } from './SearchHistory';
import { ActiveListingCard } from './ActiveListingCard';
import { getEbaySellerHubActiveListingUrl } from '../../utils/ebaySellSimilarHelper';

const STORAGE_KEY = 'sell_similar_search_history';

export const SellSimilarLauncher: React.FC = () => {
  const [inputValue, setInputValue] = useState<string>('');
  const [titleInput, setTitleInput] = useState<string>('');
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
    }, 4500);
  };

  const detectInputType = (val: string): SearchInputType => {
    const trimmed = val.trim();
    if (!trimmed) return 'empty';

    if (/^\d+$/.test(trimmed)) {
      return 'item_id';
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.includes('ebay.com')) {
      return 'url';
    }

    return 'title';
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    setDetectedType(detectInputType(val));
  };

  const handleClearInput = () => {
    setInputValue('');
    setTitleInput('');
    setDetectedType('empty');
    setSearchState({
      query: '',
      detectedType: 'empty',
      status: 'idle',
      matchedListings: [],
      launchedItemId: null
    });
  };

  /**
   * SELLER HUB ACTIVE LISTINGS LAUNCHER:
   * Opens Seller Hub with strict Item ID & Full Title verification parameters.
   */
  const launchSellSimilarFlow = (itemId: string, title?: string) => {
    const matched = MOCK_ACTIVE_LISTINGS.find((item) => item.itemId === itemId);
    const targetTitle = (titleInput && titleInput.trim()) || title || matched?.title || (detectedType === 'title' ? inputValue : '');
    const targetSku = matched?.sku;
    
    const targetUrl = getEbaySellerHubActiveListingUrl(itemId, targetTitle, targetSku);
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    showToast(`🚀 Seller Hub 出品管理画面を起動しました (ID: ${itemId || 'N/A'}, Title: "${targetTitle || 'N/A'}")`);
  };

  const extractItemIdFromUrl = (urlStr: string): string | null => {
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

  const handlePerformSearch = () => {
    const raw = inputValue.trim();

    if (!raw) {
      setSearchState({
        query: '',
        detectedType: 'empty',
        status: 'invalid_input',
        matchedListings: [],
        launchedItemId: null,
        validationError: '⚠️ 【入力エラー】eBay Item Number (例: 256123456789)、eBay URL、または完全タイトルを入力してください。'
      });
      return;
    }

    setIsSearching(true);
    const inputType = detectInputType(raw);

    setTimeout(() => {
      if (inputType === 'item_id') {
        if (raw.length < 10 || raw.length > 14) {
          setSearchState({
            query: raw,
            detectedType: 'item_id',
            status: 'invalid_input',
            matchedListings: [],
            launchedItemId: null,
            validationError: `⚠️ 【Item ID形式エラー】「${raw}」は${raw.length}桁です。eBay Item Numberは10桁〜14桁の半角数字です。`
          });
          setIsSearching(false);
          return;
        }

        const itemId = raw;
        const matched = MOCK_ACTIVE_LISTINGS.find((item) => item.itemId === itemId);
        const resolvedTitle = titleInput.trim() || matched?.title || '';

        launchSellSimilarFlow(itemId, resolvedTitle);
        saveToHistory(raw, 'item_id', itemId, 1, resolvedTitle);

        setSearchState({
          query: raw,
          detectedType: 'item_id',
          status: 'direct_item',
          matchedListings: matched ? [matched] : [],
          launchedItemId: itemId,
          message: `Item Number ${itemId} の Seller Hub 出品管理画面を起動しました。`
        });
      } else if (inputType === 'url') {
        const extractedId = extractItemIdFromUrl(raw);
        if (extractedId) {
          const matched = MOCK_ACTIVE_LISTINGS.find((item) => item.itemId === extractedId);
          const resolvedTitle = titleInput.trim() || matched?.title || '';
          launchSellSimilarFlow(extractedId, resolvedTitle);
          saveToHistory(raw, 'url', extractedId, 1, resolvedTitle);

          setSearchState({
            query: raw,
            detectedType: 'url',
            status: 'direct_item',
            matchedListings: matched ? [matched] : [],
            launchedItemId: extractedId,
            message: `URLから Item ID: ${extractedId} を自動抽出し、Seller Hub 出品管理画面を起動しました。`
          });
        } else {
          setSearchState({
            query: raw,
            detectedType: 'url',
            status: 'invalid_input',
            matchedListings: [],
            launchedItemId: null,
            validationError: '⚠️ 【URL解析エラー】入力されたeBay URLから有効なItem ID (10〜14桁) を検出できませんでした。'
          });
        }
      } else if (inputType === 'title') {
        const queryLower = raw.toLowerCase();
        const results = MOCK_ACTIVE_LISTINGS.filter(
          (listing) =>
            listing.title.toLowerCase().includes(queryLower) ||
            (listing.sku && listing.sku.toLowerCase().includes(queryLower))
        );

        if (results.length === 1) {
          const matchedItem = results[0];
          launchSellSimilarFlow(matchedItem.itemId, matchedItem.title);
          saveToHistory(raw, 'title', matchedItem.itemId, 1, matchedItem.title);

          setSearchState({
            query: raw,
            detectedType: 'title',
            status: 'single_match',
            matchedListings: results,
            launchedItemId: matchedItem.itemId,
            message: `「${raw}」に一致する完全タイトルが1件見つかりました。Seller Hub を起動しました。`
          });
        } else if (results.length > 1) {
          saveToHistory(raw, 'title', '', results.length, `${results.length}件選択`);

          setSearchState({
            query: raw,
            detectedType: 'title',
            status: 'multi_match',
            matchedListings: results,
            launchedItemId: null,
            validationError: `⚠️ 【誤出品防止・安全停止】キーワード 「${raw}」 で複数の出品 (${results.length}件) がヒットしました。誤出品を防ぐため自動起動を停止しました。以下のリストから対象商品を選択するか、Item Number (10〜14桁) または完全タイトルを入力してください。`
          });
        } else {
          launchSellSimilarFlow('', raw);
          saveToHistory(raw, 'title', '', 0);

          setSearchState({
            query: raw,
            detectedType: 'title',
            status: 'no_match',
            matchedListings: [],
            launchedItemId: null,
            message: `「${raw}」のタイトル検索で Seller Hub を起動しました。`
          });
        }
      }

      setIsSearching(false);
    }, 200);
  };

  const handleSelectHistoryItem = (item: SearchHistoryItem) => {
    setInputValue(item.rawInput);
    setDetectedType(item.detectedType);
    if (item.extractedItemId) {
      launchSellSimilarFlow(item.extractedItemId, item.resultTitle);
    } else {
      handleInputChange(item.rawInput);
      setTimeout(() => {
        handlePerformSearch();
      }, 50);
    }
  };

  return (
    <div className="sell-similar-container space-y-4">
      {/* Launcher Header Card */}
      <div className="launcher-header-card card">
        <div className="card-header space-between">
          <div className="title-with-badge">
            <h2 className="card-title text-xl font-bold">
              <svg className="card-icon icon-lightning" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              Sell Similar Quick Launcher
            </h2>
            <span className="feature-status-badge font-mono">1-Click Automated</span>
          </div>
        </div>

        <div className="card-body space-y-3">
          <p className="page-description text-xs text-slate-300">
            eBay Item Number・URL・完全タイトルを厳密検証し、Seller Hub から 1クリックで「Sell similar」を全自動実行します。
          </p>

          <SearchInputBox
            value={inputValue}
            onChange={handleInputChange}
            titleValue={titleInput}
            onTitleChange={setTitleInput}
            onSubmit={handlePerformSearch}
            onClear={handleClearInput}
            detectedType={detectedType}
            isSearching={isSearching}
            onSampleClick={(val, sampleTitle) => {
              handleInputChange(val);
              if (sampleTitle) setTitleInput(sampleTitle);
              setTimeout(() => handlePerformSearch(), 50);
            }}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Input Validation & Broad Keyword Safety Banner */}
      {(searchState.status === 'invalid_input' || searchState.status === 'multi_match') && searchState.validationError && (
        <div className="p-3 bg-red-950/60 border border-red-500/70 rounded text-red-200 text-xs font-semibold flex items-center space-x-2 shadow-lg">
          <span className="text-lg">🛡️</span>
          <span>{searchState.validationError}</span>
        </div>
      )}

      {/* Search Result Feedback Section */}
      {searchState.status !== 'idle' && searchState.status !== 'invalid_input' && (
        <div className="search-state-feedback-area space-y-4">
          {searchState.status === 'single_match' && searchState.matchedListings[0] && (
            <div className="card matched-single-card">
              <div className="card-header space-between">
                <h3 className="card-title text-success text-sm font-bold">
                  ✓ 完全一致を検証完了 — タイトル: 「{searchState.matchedListings[0].title}」
                </h3>
              </div>
              <div className="card-body space-y-3">
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
                <h3 className="card-title text-success text-sm font-bold">
                  ✓ Seller Hub 画面を起動しました (Item ID: {searchState.launchedItemId})
                </h3>
              </div>
              <div className="card-body space-y-3">
                {searchState.matchedListings.length > 0 ? (
                  <ActiveListingCard
                    listing={searchState.matchedListings[0]}
                    onLaunch={launchSellSimilarFlow}
                  />
                ) : (
                  <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded space-y-3 text-xs">
                    <p className="text-slate-200">
                      📦 Item ID <strong>{searchState.launchedItemId}</strong> の Seller Hub 出品画面を開きました。
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary btn-sm font-bold"
                        onClick={() => launchSellSimilarFlow(searchState.launchedItemId!, titleInput)}
                      >
                        🚀 Seller Hub 出品画面を開く
                      </button>
                    </div>
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
                <div className="empty-state-box space-y-3">
                  <span className="empty-state-icon">🔎</span>
                  <h3 className="font-bold text-slate-200">Seller Hub で 「{searchState.query}」 を検索します</h3>
                  <p className="text-xs text-muted">
                    Seller Hub にて Item ID / 完全タイトル <strong>「{searchState.query}」</strong> の検索を実行します。
                  </p>
                  <div className="empty-action-group flex flex-wrap gap-2 justify-center pt-2">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => launchSellSimilarFlow('', searchState.query)}
                    >
                      📦 Seller Hub で 「{searchState.query}」 を検索
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
          <h3 className="card-title text-sm font-semibold">
            <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
            自社アクティブ出品一覧 (1クリック起動)
          </h3>
          <span className="count-badge font-mono">{MOCK_ACTIVE_LISTINGS.length} 件</span>
        </div>
        <div className="card-body">
          <p className="field-hint margin-bottom-md text-xs text-muted">
            よく類似出品に使用される自社アクティブ商品です。ボタンを押すと Item ID・完全タイトル検証経由で Sell Similar が自動実行されます。
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
