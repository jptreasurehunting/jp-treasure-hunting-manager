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
    }, 4000);
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
    setDetectedType('empty');
    setSearchState({
      query: '',
      detectedType: 'empty',
      status: 'idle',
      matchedListings: [],
      launchedItemId: null
    });
  };

  // Official eBay Sell Similar Launch URL
  const launchSellSimilarFlow = (itemId: string, title?: string) => {
    const sellSimilarUrl = `https://www.ebay.com/sl/sell?sr=sh&fee=false&itemId=${encodeURIComponent(itemId)}`;
    window.open(sellSimilarUrl, '_blank', 'noopener,noreferrer');
    showToast(`⚡ Item ID: ${itemId} の類似出品画面 (Sell Similar) を新しいタブで開きました`);
  };

  // Official eBay Keyword Search Launcher
  const launchEbayKeywordSearch = (keyword: string) => {
    const ebaySearchUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(keyword)}`;
    window.open(ebaySearchUrl, '_blank', 'noopener,noreferrer');
    showToast(`🌐 eBay公式で 「${keyword}」 の検索画面を開きました`);
  };

  // Official eBay Direct Draft Launcher by Keyword
  const launchEbayDraftByKeyword = (keyword: string) => {
    const ebayDraftUrl = `https://www.ebay.com/sl/sell?keyword=${encodeURIComponent(keyword)}`;
    window.open(ebayDraftUrl, '_blank', 'noopener,noreferrer');
    showToast(`⚡ eBay公式の新規出品作成画面（${keyword}）を開きました`);
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

    // Validation 1: Empty Input Check
    if (!raw) {
      setSearchState({
        query: '',
        detectedType: 'empty',
        status: 'invalid_input',
        matchedListings: [],
        launchedItemId: null,
        validationError: '⚠️ 【入力エラー】検索キー、eBay Item Number (例: 256123456789)、または商品名を入力してください。'
      });
      return;
    }

    setIsSearching(true);
    const inputType = detectInputType(raw);

    setTimeout(() => {
      if (inputType === 'item_id') {
        // Validation 2: Item ID digit count check (10 to 14 digits)
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
            (listing.sku && listing.sku.toLowerCase().includes(queryLower)) ||
            listing.category.toLowerCase().includes(queryLower)
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
            message: `「${raw}」に一致する自社アクティブ出品が1件ヒットしました。Sell Similarを自動起動しました。`
          });
        } else if (results.length > 1) {
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
              Sell Similar Quick Launcher (類似出品 1クリック最速ランチャー)
            </h2>
            <span className="feature-status-badge font-mono">1-Click Launch Ready</span>
          </div>
        </div>

        <div className="card-body space-y-3">
          <p className="page-description text-xs text-slate-300">
            eBay Item ID（10〜14桁）、商品URL、または商品名キーワードを入力するだけで、最も最速な <strong>Sell Similar（類似出品）出品作成画面</strong> をワンクリックで起動できます。
          </p>

          <SearchInputBox
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handlePerformSearch}
            onClear={handleClearInput}
            detectedType={detectedType}
            isSearching={isSearching}
            onSampleClick={(val) => {
              handleInputChange(val);
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

      {/* Input Validation Error Banner */}
      {searchState.status === 'invalid_input' && searchState.validationError && (
        <div className="p-3 bg-red-950/50 border border-red-500/60 rounded text-red-200 text-xs font-semibold flex items-center space-x-2">
          <span>❌</span>
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
                  ✓ ヒット商品 (1件) — Sell Similar 起動完了
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
                <h3 className="card-title text-success text-sm font-bold">
                  ✓ Item ID ({searchState.launchedItemId}) — Sell Similar 画面を起動しました
                </h3>
              </div>
              <div className="card-body space-y-2">
                {searchState.matchedListings.length > 0 ? (
                  <ActiveListingCard
                    listing={searchState.matchedListings[0]}
                    onLaunch={launchSellSimilarFlow}
                  />
                ) : (
                  <div className="p-3 bg-slate-900 border border-emerald-500/40 rounded space-y-2 text-xs">
                    <p className="text-slate-200">
                      ⚡ Item ID <strong>{searchState.launchedItemId}</strong> の eBay 類似出品作成ページ（Sell Similar）を別タブで開きました。
                    </p>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => launchSellSimilarFlow(searchState.launchedItemId!)}
                      >
                        🚀 もう一度 類似出品画面を開く
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
                  <h3 className="font-bold text-slate-200">自社アクティブ出品には未登録のキーワードです</h3>
                  <p className="text-xs text-muted">
                    「<strong>{searchState.query}</strong>」に一致する自社データはありません。以下のボタンからeBay公式画面をワンクリックで起動できます:
                  </p>
                  <div className="empty-action-group flex flex-wrap gap-2 justify-center pt-2">
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => launchEbayKeywordSearch(searchState.query)}
                    >
                      🌐 eBay全体で 「{searchState.query}」 の類似商品を検索
                    </button>
                    <button
                      type="button"
                      className="btn-secondary btn-sm"
                      onClick={() => launchEbayDraftByKeyword(searchState.query)}
                    >
                      ⚡ eBay公式の新規出品ドラフト画面を開く
                    </button>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800 text-xs text-slate-400 text-left mt-2">
                    <strong>🔰 初心者向けガイド:</strong>
                    <ol className="list-decimal list-inside space-y-1 mt-1">
                      <li>「eBay全体で検索」を押すと、eBay上の同種商品の検索結果が開きます。</li>
                      <li>状態や仕様が最も近い出品ページを開き、画面右側の <strong>『Sell Similar』</strong> ボタンを押してください。</li>
                      <li>タイトル・カテゴリ・商品属性が自動転記された状態で最速出品できます。</li>
                    </ol>
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
            自社アクティブ出品一覧 (1クリック起動ディレクトリ)
          </h3>
          <span className="count-badge font-mono">{MOCK_ACTIVE_LISTINGS.length} 件</span>
        </div>
        <div className="card-body">
          <p className="field-hint margin-bottom-md text-xs text-muted">
            よく類似出品に使用される自社アクティブ商品です。商品をワンクリックするだけで Sell Similar が起動します。
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
