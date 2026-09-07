import {
  evaluateStoredEbaySandboxVerification,
  findEbaySandboxVerificationForAccount,
  loadEbaySandboxVerificationRecords,
  recordEbaySandboxVerification
} from '../ebaySandboxVerificationService';
import { EbaySandboxConnectionStatus, EbaySandboxVersionResponse } from '../ebaySandboxBackendClient';
import { EbaySandboxOAuthPlanRecord } from '../ebaySandboxOAuthService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makePlan(overrides: Partial<EbaySandboxOAuthPlanRecord> = {}): EbaySandboxOAuthPlanRecord {
  return {
    planId: overrides.planId ?? 'plan-001',
    sellerAccountId: overrides.sellerAccountId ?? 'ebay-main',
    environment: 'SANDBOX',
    authorizationFlow: 'AUTHORIZATION_CODE_GRANT',
    authorizationEndpoint: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    tokenEndpoint: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    apiBaseUrl: 'https://api.sandbox.ebay.com',
    requiredScopes: ['https://api.ebay.com/oauth/api_scope/sell.inventory'],
    clientId: 'sandbox-client-id',
    ruName: 'sandbox-runame',
    sandboxUserAlias: 'sandbox-user',
    backendCredentialRef: overrides.backendCredentialRef ?? 'EBAY_SANDBOX_MAIN',
    checkedAt: '2026-09-08T00:00:00.000Z',
    checkedBy: 'owner',
    verificationNote: 'verified',
    consentUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    nonMutatingVerificationEndpoint: 'https://api.sandbox.ebay.com/sell/inventory/v1/getVersion',
    secretStorage: 'BACKEND_ONLY_REQUIRED',
    clientSecretStored: false,
    authorizationCodeStored: false,
    accessTokenStored: false,
    refreshTokenStored: false,
    status: 'SANDBOX_OAUTH_PLAN_READY',
    networkAction: 'NONE',
    sendAllowed: false,
    savedAt: '2026-09-08T00:00:00.000Z'
  };
}

function makeConnection(overrides: Partial<EbaySandboxConnectionStatus> = {}): EbaySandboxConnectionStatus {
  return {
    connected: overrides.connected ?? true,
    account: overrides.account ?? {
      accountId: 'ebay-main',
      environment: 'Sandbox',
      connectionStatus: 'connected',
      lastAuthDate: '2026-09-08T00:05:00.000Z'
    }
  };
}

function makeVersion(overrides: Partial<EbaySandboxVersionResponse> = {}): EbaySandboxVersionResponse {
  return {
    success: true,
    environment: 'Sandbox',
    accountId: overrides.accountId ?? 'ebay-main',
    endpoint: '/sell/inventory/v1/getVersion',
    version: overrides.version ?? '1.18.5',
    checkedAt: overrides.checkedAt ?? '2026-09-08T00:06:00.000Z',
    mutatingOperation: false,
    tokenReturnedToBrowser: false
  };
}

export function runEbaySandboxVerificationTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.clear();
  const plan = makePlan();
  const connection = makeConnection();
  const version = makeVersion();
  const recorded = recordEbaySandboxVerification(plan, connection, version, 'http://localhost:3001/', []);
  assert(recorded.success && recorded.record?.status === 'SANDBOX_CONNECTION_VERIFIED', 'Test 1: Successful non-mutating getVersion can create a verification record');
  assert(recorded.record?.backendBaseUrl === 'http://localhost:3001', 'Test 2: Backend URL is normalized before persistence');
  assert(recorded.record?.mutatingOperation === false && recorded.record?.tokenReturnedToBrowser === false, 'Test 3: Verification record preserves non-mutating and no-token-return safety facts');
  assert(loadEbaySandboxVerificationRecords().length === 1, 'Test 4: Verification record is persisted locally without secrets');
  assert(findEbaySandboxVerificationForAccount('ebay-main')?.inventoryApiVersion === '1.18.5', 'Test 5: Verification can be reloaded by seller account');

  const valid = evaluateStoredEbaySandboxVerification(recorded.record, plan, connection, 'http://localhost:3001');
  assert(valid.valid, 'Test 6: Stored verification remains valid when plan, connection and backend are unchanged');

  const reauthedConnection = makeConnection({
    account: {
      accountId: 'ebay-main',
      environment: 'Sandbox',
      connectionStatus: 'connected',
      lastAuthDate: '2026-09-08T01:00:00.000Z'
    }
  });
  const staleAfterReauth = evaluateStoredEbaySandboxVerification(recorded.record, plan, reauthedConnection, 'http://localhost:3001');
  assert(!staleAfterReauth.valid && staleAfterReauth.reasonsJa.some((reason) => reason.includes('OAuth認証記録')), 'Test 7: Reauthorization makes the prior getVersion verification stale');

  const changedPlan = makePlan({ planId: 'plan-002' });
  const staleAfterPlanChange = evaluateStoredEbaySandboxVerification(recorded.record, changedPlan, connection, 'http://localhost:3001');
  assert(!staleAfterPlanChange.valid && staleAfterPlanChange.reasonsJa.some((reason) => reason.includes('OAuth接続計画')), 'Test 8: Changing the OAuth plan requires re-verification');

  const changedBackend = evaluateStoredEbaySandboxVerification(recorded.record, plan, connection, 'http://127.0.0.1:3001');
  assert(!changedBackend.valid && changedBackend.reasonsJa.some((reason) => reason.includes('バックエンドURL')), 'Test 9: Backend change invalidates the stored verification');

  const disconnected = recordEbaySandboxVerification(plan, { connected: false }, version, 'http://localhost:3001', []);
  assert(!disconnected.success && disconnected.reasonsJa.some((reason) => reason.includes('Token Vault')), 'Test 10: Disconnected account cannot be recorded as verified');

  const wrongAccountVersion = recordEbaySandboxVerification(plan, connection, makeVersion({ accountId: 'other-account' }), 'http://localhost:3001', []);
  assert(!wrongAccountVersion.success && wrongAccountVersion.reasonsJa.some((reason) => reason.includes('販売アカウント')), 'Test 11: getVersion response for another account is rejected');

  const unsafeVersion = makeVersion();
  (unsafeVersion as any).mutatingOperation = true;
  const unsafe = recordEbaySandboxVerification(plan, connection, unsafeVersion, 'http://localhost:3001', []);
  assert(!unsafe.success && unsafe.reasonsJa.some((reason) => reason.includes('非破壊')), 'Test 12: Mutating verification response is rejected');

  localStorage.clear();
  return { passed, failed, log };
}
