import { AccountHealthRecord } from '../types/safetyGate';
import { EbaySellerAccount } from '../types/zonosCustoms';

const ACCOUNT_HEALTH_SESSION_KEY = 'zonos_safety_account_health';

export function createInitialAccountHealthRecords(accounts: EbaySellerAccount[]): AccountHealthRecord[] {
  return accounts.map((acc, idx) => {
    // Default account health records
    const isRestricted = idx === 4; // Account 5 mocked as restricted for testing
    return {
      accountId: acc.id,
      displayName: acc.displayName,
      connectionStatus: 'connected',
      authStatus: 'valid',
      authExpiryDate: '2026-12-31',
      environment: 'Production',
      canList: !isRestricted,
      sellingRestrictionStatus: isRestricted ? 'Restricted' : 'Active',
      unshippedOrdersCount: idx === 0 ? 1 : 0,
      overdueHandlingCount: 0,
      missingTrackingCount: 0,
      sellerCancelledCount: 0,
      unresolvedCasesCount: 0,
      accountHealthWarnings: isRestricted
        ? ['⚠️ アカウントにポリシー制限が適用されています。新規出品およびMove Listingは一時停止されます。']
        : []
    };
  });
}

export function loadAccountHealthRecords(accounts: EbaySellerAccount[]): AccountHealthRecord[] {
  try {
    const raw = sessionStorage.getItem(ACCOUNT_HEALTH_SESSION_KEY);
    if (!raw) return createInitialAccountHealthRecords(accounts);
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return createInitialAccountHealthRecords(accounts);
  } catch (e) {
    console.error('Failed to load account health records:', e);
    return createInitialAccountHealthRecords(accounts);
  }
}

export function saveAccountHealthRecords(records: AccountHealthRecord[]): void {
  try {
    sessionStorage.setItem(ACCOUNT_HEALTH_SESSION_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save account health records:', e);
  }
}
