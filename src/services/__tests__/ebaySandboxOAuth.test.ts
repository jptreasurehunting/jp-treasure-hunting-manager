import {
  EBAY_INVENTORY_SCOPE,
  EBAY_SANDBOX_API_BASE_URL,
  EBAY_SANDBOX_AUTHORIZATION_ENDPOINT,
  EBAY_SANDBOX_TOKEN_ENDPOINT,
  EbaySandboxOAuthPlanInput,
  buildEbaySandboxConsentUrl,
  evaluateEbaySandboxExecutionReadiness,
  evaluateEbaySandboxOAuthPlan,
  evaluateStoredEbaySandboxOAuthPlan,
  isValidEbaySandboxBackendCredentialRef,
  loadEbaySandboxOAuthPlans,
  recordEbaySandboxOAuthPlan
} from '../ebaySandboxOAuthService';
import { EbayOfficialPayloadPreview } from '../ebayOfficialPayloadPreviewService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makeInput(overrides: Partial<EbaySandboxOAuthPlanInput> = {}): EbaySandboxOAuthPlanInput {
  return {
    clientId: overrides.clientId ?? 'sandbox-client-id',
    ruName: overrides.ruName ?? 'JP_Treasure_Hunting-Sandbox-RuName',
    sandboxUserAlias: overrides.sandboxUserAlias ?? 'sandbox-seller-01',
    backendCredentialRef: overrides.backendCredentialRef ?? 'EBAY_SANDBOX_MAIN',
    checkedAt: overrides.checkedAt ?? '2026-09-08T06:30:00+09:00',
    checkedBy: overrides.checkedBy ?? 'owner',
    verificationNote: overrides.verificationNote ?? 'Sandbox application keys and RuName confirmed in eBay Developer Program.'
  };
}

function makePreview(overrides: Partial<EbayOfficialPayloadPreview> = {}): EbayOfficialPayloadPreview {
  return {
    previewId: overrides.previewId ?? 'preview-001',
    apiFamily: 'eBay Sell Inventory API',
    apiVersion: '1.18.5',
    mode: overrides.mode ?? 'PAYLOAD_PREVIEW_ONLY',
    networkAction: overrides.networkAction ?? 'NONE',
    sendAllowed: false,
    schemaStatus: 'OFFICIAL_FIELD_MAPPING_PREVIEW_NOT_VALIDATED_BY_EBAY_API',
    authenticationStatus: overrides.authenticationStatus ?? 'NOT_ATTACHED',
    simulationId: overrides.simulationId ?? 'sim-001',
    dryRunId: overrides.dryRunId ?? 'dryrun-001',
    prerequisiteRecordId: overrides.prerequisiteRecordId ?? 'prereq-001',
    draftId: overrides.draftId ?? 'draft-001',
    sku: overrides.sku ?? 'SKU-001',
    sellerAccountIdExecutionContext: overrides.sellerAccountIdExecutionContext ?? 'ebay-main',
    marketplaceId: overrides.marketplaceId ?? 'EBAY_US',
    contentLanguage: overrides.contentLanguage ?? 'en-US',
    requestFingerprint: overrides.requestFingerprint ?? 'abcd1234',
    generatedAt: overrides.generatedAt ?? '2026-09-08T00:00:00.000Z',
    steps: overrides.steps ?? [],
    source: 'INVENTORY_SALES_WORKBENCH'
  };
}

export function runEbaySandboxOAuthTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) {
      passed += 1;
      log.push(`✅ [PASS] ${name}`);
    } else {
      failed += 1;
      log.push(`❌ [FAIL] ${name}`);
    }
  };

  localStorage.clear();
  const input = makeInput();
  const evaluation = evaluateEbaySandboxOAuthPlan('ebay-main', input);
  assert(evaluation.canSavePlan, 'Test 1: Complete Sandbox OAuth plan is accepted');

  const recorded = recordEbaySandboxOAuthPlan('ebay-main', input, []);
  const plan = recorded.plan!;
  assert(recorded.success && plan.status === 'SANDBOX_OAUTH_PLAN_READY', 'Test 2: Safe Sandbox OAuth plan can be stored');
  assert(plan.environment === 'SANDBOX' && plan.apiBaseUrl === EBAY_SANDBOX_API_BASE_URL, 'Test 3: Plan is pinned to eBay Sandbox');
  assert(plan.authorizationEndpoint === EBAY_SANDBOX_AUTHORIZATION_ENDPOINT && plan.tokenEndpoint === EBAY_SANDBOX_TOKEN_ENDPOINT, 'Test 4: Sandbox OAuth endpoints are explicit');
  assert(plan.requiredScopes.includes(EBAY_INVENTORY_SCOPE), 'Test 5: Inventory write scope is included');
  assert(plan.clientSecretStored === false && plan.authorizationCodeStored === false && plan.accessTokenStored === false && plan.refreshTokenStored === false, 'Test 6: Browser plan stores no OAuth secrets or tokens');
  assert(loadEbaySandboxOAuthPlans().length === 1, 'Test 7: OAuth plan is persisted locally without secrets');

  const consentUrl = buildEbaySandboxConsentUrl(input.clientId, input.ruName);
  assert(consentUrl.startsWith(EBAY_SANDBOX_AUTHORIZATION_ENDPOINT) && consentUrl.includes('response_type=code'), 'Test 8: Consent URL targets Sandbox authorization-code flow');

  const missingRuName = evaluateEbaySandboxOAuthPlan('ebay-main', makeInput({ ruName: '' }));
  assert(!missingRuName.canSavePlan && missingRuName.missingOrInvalidFieldsJa.some((reason) => reason.includes('RuName')), 'Test 9: Missing RuName blocks plan storage');

  const secretLeak = evaluateEbaySandboxOAuthPlan('ebay-main', makeInput({ verificationNote: 'access_token=do-not-store-this' }));
  assert(!secretLeak.canSavePlan && secretLeak.blockingReasonsJa.some((reason) => reason.includes('Token')), 'Test 10: Likely token leakage is rejected');

  const storedValidity = evaluateStoredEbaySandboxOAuthPlan(plan, 'ebay-main');
  assert(storedValidity.valid, 'Test 11: Stored plan remains valid for the same seller account');

  const wrongAccount = evaluateStoredEbaySandboxOAuthPlan(plan, 'ebay-secondary');
  assert(!wrongAccount.valid && wrongAccount.reasonsJa.some((reason) => reason.includes('販売アカウント')), 'Test 12: Seller-account mismatch invalidates OAuth plan');

  const readiness = evaluateEbaySandboxExecutionReadiness(makePreview(), plan);
  assert(readiness.canStartUserConsent && readiness.canExecuteSandboxApi === false, 'Test 13: Valid plan can start consent but cannot execute Sandbox API yet');
  assert(readiness.nextStepsJa.some((step) => step.includes('getVersion')), 'Test 14: Next plan includes non-mutating Sandbox verification');

  const unsafePreview = makePreview({ authenticationStatus: 'NOT_ATTACHED' });
  (unsafePreview as any).sendAllowed = true;
  const unsafeReadiness = evaluateEbaySandboxExecutionReadiness(unsafePreview, plan);
  assert(!unsafeReadiness.canStartUserConsent, 'Test 15: Unsafe payload preview blocks Sandbox consent readiness');

  const invalidCredentialRef = evaluateEbaySandboxOAuthPlan('ebay-main', makeInput({ backendCredentialRef: 'secret-store:ebay-sandbox-main' }));
  assert(!invalidCredentialRef.canSavePlan && invalidCredentialRef.missingOrInvalidFieldsJa.some((reason) => reason.includes('EBAY_SANDBOX_MAIN')), 'Test 16: Free-form secret references are rejected before saving a backend-bound plan');
  assert(isValidEbaySandboxBackendCredentialRef('EBAY_SANDBOX_MAIN') && !isValidEbaySandboxBackendCredentialRef('bad-ref'), 'Test 17: Backend credential reference format matches the backend contract');

  localStorage.clear();
  return { passed, failed, log };
}
