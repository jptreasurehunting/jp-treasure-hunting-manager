import { EbaySandboxConnectionStatus } from '../ebaySandboxBackendClient';
import { EbayOfficialPayloadPreview } from '../ebayOfficialPayloadPreviewService';
import { EbaySandboxOAuthPlanRecord } from '../ebaySandboxOAuthService';
import { EbaySandboxVerificationRecord } from '../ebaySandboxVerificationService';
import {
  EBAY_SANDBOX_MUTATION_AUTHORIZATION_TTL_MS,
  EbaySandboxMutationApprovalInput,
  evaluateEbaySandboxMutationApproval,
  evaluateStoredEbaySandboxMutationAuthorization,
  loadEbaySandboxMutationAuthorizations,
  markEbaySandboxMutationAuthorizationBackendStaged,
  recordEbaySandboxMutationAuthorization
} from '../ebaySandboxMutationGateService';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((key) => delete store[key]); }
  };
}

function makePreview(): EbayOfficialPayloadPreview {
  return {
    previewId: 'preview-001',
    apiFamily: 'eBay Sell Inventory API',
    apiVersion: '1.18.5',
    mode: 'PAYLOAD_PREVIEW_ONLY',
    networkAction: 'NONE',
    sendAllowed: false,
    schemaStatus: 'OFFICIAL_FIELD_MAPPING_PREVIEW_NOT_VALIDATED_BY_EBAY_API',
    authenticationStatus: 'NOT_ATTACHED',
    simulationId: 'sim-001',
    dryRunId: 'dryrun-001',
    prerequisiteRecordId: 'prereq-001',
    draftId: 'draft-001',
    sku: 'SKU-001',
    sellerAccountIdExecutionContext: 'ebay-main',
    requestFingerprint: 'request-fingerprint-001',
    generatedAt: '2026-09-08T00:00:00.000Z',
    steps: [
      {
        order: 1,
        operationId: 'createOrReplaceInventoryItem',
        method: 'PUT',
        pathTemplate: '/sell/inventory/v1/inventory_item/{sku}',
        pathParameters: { sku: 'SKU-001' },
        requestBody: { availability: { shipToLocationAvailability: { quantity: 1 } } }
      },
      {
        order: 2,
        operationId: 'createOffer',
        method: 'POST',
        pathTemplate: '/sell/inventory/v1/offer',
        pathParameters: {},
        requestBody: { sku: 'SKU-001' }
      },
      {
        order: 3,
        operationId: 'publishOffer',
        method: 'POST',
        pathTemplate: '/sell/inventory/v1/offer/{offerId}/publish',
        pathParameters: { offerId: '<createOffer response offerId>' },
        requestBody: null
      }
    ],
    source: 'INVENTORY_SALES_WORKBENCH'
  };
}

function makePlan(): EbaySandboxOAuthPlanRecord {
  return {
    planId: 'plan-001',
    sellerAccountId: 'ebay-main',
    environment: 'SANDBOX',
    authorizationFlow: 'AUTHORIZATION_CODE_GRANT',
    authorizationEndpoint: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    tokenEndpoint: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    apiBaseUrl: 'https://api.sandbox.ebay.com',
    requiredScopes: ['https://api.ebay.com/oauth/api_scope/sell.inventory'],
    clientId: 'sandbox-client-id',
    ruName: 'sandbox-runame',
    sandboxUserAlias: 'sandbox-user',
    backendCredentialRef: 'EBAY_SANDBOX_MAIN',
    checkedAt: '2026-09-08T00:00:00.000Z',
    checkedBy: 'owner',
    verificationNote: 'Verified Sandbox credentials.',
    consentUrl: 'https://auth.sandbox.ebay.com/oauth2/authorize?client_id=sandbox-client-id',
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

function makeConnection(): EbaySandboxConnectionStatus {
  return {
    connected: true,
    account: {
      accountId: 'ebay-main',
      environment: 'Sandbox',
      connectionStatus: 'connected',
      lastAuthDate: '2026-09-08T00:05:00.000Z'
    }
  };
}

function makeVerification(): EbaySandboxVerificationRecord {
  return {
    verificationId: 'verification-001',
    sellerAccountId: 'ebay-main',
    environment: 'SANDBOX',
    planId: 'plan-001',
    credentialRef: 'EBAY_SANDBOX_MAIN',
    backendBaseUrl: 'http://localhost:3001',
    connectionLastAuthDate: '2026-09-08T00:05:00.000Z',
    inventoryApiVersion: '1.18.5',
    verificationEndpoint: '/sell/inventory/v1/getVersion',
    verifiedAt: '2026-09-08T00:06:00.000Z',
    mutatingOperation: false,
    tokenReturnedToBrowser: false,
    status: 'SANDBOX_CONNECTION_VERIFIED'
  };
}

function makeInput(overrides: Partial<EbaySandboxMutationApprovalInput> = {}): EbaySandboxMutationApprovalInput {
  return {
    operationId: overrides.operationId ?? 'createOrReplaceInventoryItem',
    approvedBy: overrides.approvedBy ?? 'owner',
    approvalReason: overrides.approvalReason ?? 'Sandboxで最初の在庫Item作成を検証するため。',
    confirmedSandboxOnly: overrides.confirmedSandboxOnly ?? true,
    confirmedSellerAccountAndSku: overrides.confirmedSellerAccountAndSku ?? true,
    confirmedPayloadPreview: overrides.confirmedPayloadPreview ?? true,
    confirmedMutationRisk: overrides.confirmedMutationRisk ?? true
  };
}

export function runEbaySandboxMutationGateTests(): { passed: number; failed: number; log: string[] } {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  localStorage.clear();
  const preview = makePreview();
  const plan = makePlan();
  const connection = makeConnection();
  const verification = makeVerification();
  const backendBaseUrl = 'http://localhost:3001';
  const now = Date.parse('2026-09-08T00:10:00.000Z');

  const ready = evaluateEbaySandboxMutationApproval(preview, plan, verification, connection, backendBaseUrl, makeInput());
  assert(ready.canApprove && ready.step?.operationId === 'createOrReplaceInventoryItem', 'Test 1: Verified Sandbox first mutation can reach approval gate');

  const missingConfirmation = evaluateEbaySandboxMutationApproval(
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    makeInput({ confirmedMutationRisk: false })
  );
  assert(!missingConfirmation.canApprove && missingConfirmation.blockingReasonsJa.some((reason) => reason.includes('変更系API')), 'Test 2: Explicit mutation-risk confirmation is required');

  const createOfferBlocked = evaluateEbaySandboxMutationApproval(
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    makeInput({ operationId: 'createOffer' })
  );
  assert(!createOfferBlocked.canApprove && createOfferBlocked.blockingReasonsJa.some((reason) => reason.includes('前') || reason.includes('実行成功')), 'Test 3: createOffer stays blocked until first-step execution result exists');

  const publishBlocked = evaluateEbaySandboxMutationApproval(
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    makeInput({ operationId: 'publishOffer' })
  );
  assert(!publishBlocked.canApprove && publishBlocked.blockingReasonsJa.some((reason) => reason.includes('offerId')), 'Test 4: publishOffer stays blocked until createOffer result exists');

  const wrongConnection: EbaySandboxConnectionStatus = {
    connected: true,
    account: { ...connection.account!, accountId: 'other-account' }
  };
  const mismatch = evaluateEbaySandboxMutationApproval(preview, plan, verification, wrongConnection, backendBaseUrl, makeInput());
  assert(!mismatch.canApprove, 'Test 5: Current Token Vault account mismatch blocks authorization');

  const recorded = recordEbaySandboxMutationAuthorization(
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    makeInput(),
    [],
    now
  );
  assert(recorded.success && recorded.record?.status === 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED', 'Test 6: Valid first-step authorization is stored as not executed');
  assert(recorded.record?.networkAction === 'NONE' && recorded.record?.executionTriggered === false && recorded.record?.oneTimeUse === true, 'Test 7: Authorization record cannot itself trigger network execution');
  assert(loadEbaySandboxMutationAuthorizations().length === 1, 'Test 8: Authorization record is persisted without secrets');

  const validStored = evaluateStoredEbaySandboxMutationAuthorization(
    recorded.record,
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    now + 1000
  );
  assert(validStored.validForExecution, 'Test 9: Fresh unchanged authorization is eligible for a future execution layer');

  const expired = evaluateStoredEbaySandboxMutationAuthorization(
    recorded.record,
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    now + EBAY_SANDBOX_MUTATION_AUTHORIZATION_TTL_MS + 1
  );
  assert(!expired.validForExecution && expired.reasonsJa.some((reason) => reason.includes('失効')), 'Test 10: Authorization expires after 15 minutes');

  const changedPreview = { ...preview, requestFingerprint: 'changed-request-fingerprint' };
  const stalePayload = evaluateStoredEbaySandboxMutationAuthorization(
    recorded.record,
    changedPreview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    now + 1000
  );
  assert(!stalePayload.validForExecution && stalePayload.reasonsJa.some((reason) => reason.includes('送信予定内容')), 'Test 11: Payload change invalidates stored authorization');

  const changedPlan = { ...plan, planId: 'plan-002' };
  const stalePlan = evaluateStoredEbaySandboxMutationAuthorization(
    recorded.record,
    preview,
    changedPlan,
    verification,
    connection,
    backendBaseUrl,
    now + 1000
  );
  assert(!stalePlan.validForExecution, 'Test 12: OAuth plan change invalidates stored authorization');

  const staged = markEbaySandboxMutationAuthorizationBackendStaged(
    recorded.record!.authorizationId,
    '2026-09-08T00:11:00.000Z'
  );
  const stagedStored = evaluateStoredEbaySandboxMutationAuthorization(
    staged.record,
    preview,
    plan,
    verification,
    connection,
    backendBaseUrl,
    now + 2 * 60 * 1000
  );
  assert(staged.success && staged.record?.backendStagingConsumed === true, 'Test 13: Backend staging acknowledgement marks local authorization consumed');
  assert(!stagedStored.validForExecution && stagedStored.reasonsJa.some((reason) => reason.includes('消費済み')), 'Test 14: Consumed authorization cannot be executed again locally');

  localStorage.clear();
  return { passed, failed, log };
}
