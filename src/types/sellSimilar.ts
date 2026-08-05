export type SearchInputType = 'item_id' | 'url' | 'title' | 'empty';

export interface ActiveListing {
  id: string;
  itemId: string;
  title: string;
  price: number;
  currency: string;
  category: string;
  imageUrl: string;
  status: 'Active' | 'Scheduled' | 'Ending Soon';
  quantity: number;
  sku?: string;
  views?: number;
  watchers?: number;
}

export interface SearchHistoryItem {
  id: string;
  rawInput: string;
  detectedType: 'item_id' | 'url' | 'title';
  extractedItemId: string;
  resultTitle?: string;
  resultCount: number;
  timestamp: string;
}

export interface SearchResultState {
  query: string;
  detectedType: SearchInputType;
  status: 'idle' | 'searching' | 'single_match' | 'multi_match' | 'no_match' | 'direct_item' | 'invalid_input';
  matchedListings: ActiveListing[];
  launchedItemId: string | null;
  message?: string;
  validationError?: string;
}
