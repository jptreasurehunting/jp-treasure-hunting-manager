import { EbaySellerAccount } from '../types/zonosCustoms';

const ACCOUNT_STORAGE_KEY = 'zonos_ebay_accounts_metadata_v2';

/**
 * Generates default initial eBay seller accounts
 */
export function createInitialEbayAccounts(): EbaySellerAccount[] {
  return [
    {
      id: 'acc_01',
      displayName: 'Main eBay Seller Account',
      ebayUsername: 'seller_japan_main',
      connectionStatus: 'connected',
      environment: 'Production',
      isSelectedForFetch: true,
      safeRefId: 'ref_acc_01',
      lastAuthDate: '2026-08-06 10:00'
    },
    {
      id: 'acc_02',
      displayName: 'Sub Store Account',
      ebayUsername: 'treasure_store_jp',
      connectionStatus: 'unconnected',
      environment: 'Production',
      isSelectedForFetch: false,
      safeRefId: 'ref_acc_02'
    }
  ];
}

/**
 * Loads accounts metadata (dynamic unlimited accounts)
 */
export function loadEbayAccounts(): EbaySellerAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNT_STORAGE_KEY) || sessionStorage.getItem(ACCOUNT_STORAGE_KEY);
    if (!raw) return createInitialEbayAccounts();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return createInitialEbayAccounts();
  } catch (e) {
    console.error('Failed to load eBay accounts:', e);
    return createInitialEbayAccounts();
  }
}

/**
 * Saves accounts metadata (dynamically persisted)
 */
export function saveEbayAccounts(accounts: EbaySellerAccount[]): void {
  try {
    const jsonStr = JSON.stringify(accounts);
    localStorage.setItem(ACCOUNT_STORAGE_KEY, jsonStr);
    sessionStorage.setItem(ACCOUNT_STORAGE_KEY, jsonStr);
  } catch (e) {
    console.error('Failed to save eBay accounts:', e);
  }
}

/**
 * Add a new eBay account dynamically
 */
export function addEbayAccount(displayName: string, ebayUsername: string): EbaySellerAccount[] {
  const current = loadEbayAccounts();
  const nextNum = current.length + 1;
  const numStr = nextNum < 10 ? `0${nextNum}` : `${nextNum}`;
  const newAccount: EbaySellerAccount = {
    id: `acc_${Date.now().toString().slice(-4)}_${numStr}`,
    displayName: displayName.trim() || `eBay Store ${nextNum}`,
    ebayUsername: ebayUsername.trim() || `seller_${numStr}`,
    connectionStatus: 'unconnected',
    environment: 'Production',
    isSelectedForFetch: false,
    safeRefId: `ref_acc_${numStr}`
  };
  const updated = [...current, newAccount];
  saveEbayAccounts(updated);
  return updated;
}

/**
 * Remove an eBay account by ID
 */
export function removeEbayAccount(accountId: string): EbaySellerAccount[] {
  const current = loadEbayAccounts();
  if (current.length <= 1) {
    return current; // Keep at least one account
  }
  const filtered = current.filter((a) => a.id !== accountId);
  // Ensure one account is selected
  if (!filtered.some((a) => a.isSelectedForFetch)) {
    filtered[0].isSelectedForFetch = true;
  }
  saveEbayAccounts(filtered);
  return filtered;
}

/**
 * Reorder accounts (Move up / Move down)
 */
export function moveEbayAccount(accountId: string, direction: 'up' | 'down'): EbaySellerAccount[] {
  const current = [...loadEbayAccounts()];
  const idx = current.findIndex((a) => a.id === accountId);
  if (idx < 0) return current;

  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= current.length) return current;

  const temp = current[idx];
  current[idx] = current[targetIdx];
  current[targetIdx] = temp;

  saveEbayAccounts(current);
  return current;
}
