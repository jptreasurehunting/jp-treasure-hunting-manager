import { EbaySellerAccount } from '../types/zonosCustoms';

const ACCOUNT_SESSION_KEY = 'zonos_ebay_accounts_metadata';

/**
 * Generates initial 10 unconnected eBay seller account slots (Spec #2)
 */
export function createInitialEbayAccounts(): EbaySellerAccount[] {
  const accounts: EbaySellerAccount[] = [];
  for (let i = 1; i <= 10; i++) {
    const numStr = i < 10 ? `0${i}` : `${i}`;
    accounts.push({
      id: `acc_${numStr}`,
      displayName: `Account ${i}`,
      ebayUsername: `Account ${i}`,
      connectionStatus: 'unconnected',
      environment: 'Production',
      isSelectedForFetch: i === 1, // Account 1 selected by default
      safeRefId: `ref_acc_${numStr}`
    });
  }
  return accounts;
}

/**
 * Loads accounts metadata from sessionStorage (MAD compliant, in-memory per session)
 */
export function loadEbayAccounts(): EbaySellerAccount[] {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_SESSION_KEY);
    if (!raw) return createInitialEbayAccounts();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === 10) {
      return parsed;
    }
    return createInitialEbayAccounts();
  } catch (e) {
    console.error('Failed to load eBay accounts metadata from sessionStorage:', e);
    return createInitialEbayAccounts();
  }
}

/**
 * Saves accounts metadata to sessionStorage (No secret tokens included)
 */
export function saveEbayAccounts(accounts: EbaySellerAccount[]): void {
  try {
    sessionStorage.setItem(ACCOUNT_SESSION_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save eBay accounts metadata to sessionStorage:', e);
  }
}
