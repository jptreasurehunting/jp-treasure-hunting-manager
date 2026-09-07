const TokenVault = require('../security/tokenVault');
const { getDB } = require('../db/database');

const ALLOWED_OPERATION = 'createOrReplaceInventoryItem';
const EXPECTED_METHOD = 'PUT';
const EXPECTED_PATH_TEMPLATE = '/sell/inventory/v1/inventory_item/{sku}';
const SANDBOX_API_BASE_URL = 'https://api.sandbox.ebay.com';
const MAX_AUTHORIZATION_LIFETIME_MS = 15 * 60 * 1000;

function backendError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function shortFingerprint(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function fingerprintStep(step) {
  return shortFingerprint({
    order: step.order,
    operationId: step.operationId,
    method: step.method,
    pathTemplate: step.pathTemplate,
    pathParameters: step.pathParameters || {},
    requestBody: step.requestBody == null ? null : step.requestBody,
    responseDependency: step.responseDependency || null
  });
}

function validateAuthorizationShape(authorization, step, nowMs) {
  if (!authorization || typeof authorization !== 'object') throw backendError('MISSING_AUTHORIZATION', 'Sandbox mutation authorization is required.');
  if (!step || typeof step !== 'object') throw backendError('MISSING_MUTATION_STEP', 'Sandbox mutation step is required.');

  const requiredTextFields = [
    'authorizationId', 'sellerAccountId', 'sku', 'previewId', 'marketplaceId', 'contentLanguage',
    'requestFingerprint', 'planId', 'credentialRef', 'verificationId', 'stepFingerprint',
    'approvedBy', 'approvalReason', 'approvedAt', 'expiresAt'
  ];
  for (const field of requiredTextFields) {
    if (!normalize(authorization[field])) throw backendError('INVALID_AUTHORIZATION_RECORD', `Sandbox mutation authorization field ${field} is required.`);
  }

  if (authorization.environment !== 'SANDBOX') throw backendError('PRODUCTION_NOT_ALLOWED', 'Only eBay Sandbox mutation staging is allowed.');
  if (authorization.operationId !== ALLOWED_OPERATION || authorization.operationOrder !== 1) throw backendError('OPERATION_NOT_ALLOWED', 'Only createOrReplaceInventoryItem step 1 may be staged at this phase.');
  if (authorization.method !== EXPECTED_METHOD || authorization.pathTemplate !== EXPECTED_PATH_TEMPLATE) throw backendError('INVALID_MUTATION_TARGET', 'Sandbox mutation authorization does not target the approved inventory-item endpoint.');
  if (authorization.oneTimeUse !== true || authorization.executionTriggered !== false) throw backendError('AUTHORIZATION_NOT_UNUSED', 'Sandbox mutation authorization must be unused and one-time.');
  if (authorization.networkAction !== 'NONE' || authorization.status !== 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED') throw backendError('UNSAFE_AUTHORIZATION_STATE', 'Sandbox mutation authorization is not in the safe pre-execution state.');
  if (
    authorization.confirmedSandboxOnly !== true || authorization.confirmedSellerAccountAndSku !== true ||
    authorization.confirmedPayloadPreview !== true || authorization.confirmedMutationRisk !== true
  ) throw backendError('MISSING_EXPLICIT_CONFIRMATION', 'All explicit Sandbox mutation confirmations are required.');

  const approvedAtMs = Date.parse(authorization.approvedAt);
  const expiresAtMs = Date.parse(authorization.expiresAt);
  if (!Number.isFinite(approvedAtMs) || !Number.isFinite(expiresAtMs)) throw backendError('INVALID_AUTHORIZATION_TIME', 'Sandbox mutation authorization timestamps are invalid.');
  if (approvedAtMs > nowMs + 30_000) throw backendError('INVALID_AUTHORIZATION_TIME', 'Sandbox mutation authorization approval time is in the future.');
  if (expiresAtMs <= nowMs) throw backendError('AUTHORIZATION_EXPIRED', 'Sandbox mutation authorization has expired.');
  if (expiresAtMs - approvedAtMs > MAX_AUTHORIZATION_LIFETIME_MS + 1000) throw backendError('AUTHORIZATION_TTL_TOO_LONG', 'Sandbox mutation authorization exceeds the maximum 15-minute lifetime.');

  if (step.operationId !== authorization.operationId || step.order !== authorization.operationOrder) throw backendError('STEP_AUTHORIZATION_MISMATCH', 'Mutation step does not match the approved operation.');
  if (step.method !== EXPECTED_METHOD || step.pathTemplate !== EXPECTED_PATH_TEMPLATE) throw backendError('INVALID_MUTATION_TARGET', 'Mutation step does not target the approved inventory-item endpoint.');
  if (!step.pathParameters || normalize(step.pathParameters.sku) !== normalize(authorization.sku)) throw backendError('SKU_MISMATCH', 'Mutation step SKU does not match the approved SKU.');
  if (!step.requestBody || typeof step.requestBody !== 'object' || Array.isArray(step.requestBody)) throw backendError('INVALID_REQUEST_BODY', 'Inventory-item mutation request body is required.');

  const computedFingerprint = fingerprintStep(step);
  if (computedFingerprint !== authorization.stepFingerprint) throw backendError('STEP_FINGERPRINT_MISMATCH', 'Mutation step content changed after approval.');

  return { approvedAtMs, expiresAtMs, computedFingerprint };
}

async function stageSandboxMutationExecution({ authorization, step, now = Date.now() }) {
  validateAuthorizationShape(authorization, step, now);

  const sandboxTokens = await TokenVault.getDecryptedTokens(authorization.sellerAccountId, 'Sandbox');
  if (!sandboxTokens) throw backendError('SANDBOX_TOKEN_NOT_FOUND', 'No connected eBay Sandbox token exists for the approved seller account.');

  const reservation = {
    authorizationId: normalize(authorization.authorizationId),
    sellerAccountId: normalize(authorization.sellerAccountId),
    sku: normalize(authorization.sku),
    previewId: normalize(authorization.previewId),
    marketplaceId: normalize(authorization.marketplaceId),
    contentLanguage: normalize(authorization.contentLanguage),
    requestFingerprint: normalize(authorization.requestFingerprint),
    planId: normalize(authorization.planId),
    credentialRef: normalize(authorization.credentialRef),
    verificationId: normalize(authorization.verificationId),
    operationId: ALLOWED_OPERATION,
    operationOrder: 1,
    method: EXPECTED_METHOD,
    pathTemplate: EXPECTED_PATH_TEMPLATE,
    pathParameters: { sku: normalize(step.pathParameters.sku) },
    requestBody: step.requestBody,
    stepFingerprint: authorization.stepFingerprint,
    approvedBy: normalize(authorization.approvedBy),
    approvalReason: normalize(authorization.approvalReason),
    approvedAt: new Date(authorization.approvedAt).toISOString(),
    expiresAt: new Date(authorization.expiresAt).toISOString(),
    stagedAt: new Date(now).toISOString(),
    status: 'STAGED_NOT_SENT',
    networkAction: 'NONE',
    externalWritePerformed: false
  };

  try {
    await getDB().createSandboxMutationStageReservation(reservation);
  } catch (error) {
    if (error && error.code === 'AUTHORIZATION_ALREADY_CONSUMED') throw backendError('AUTHORIZATION_ALREADY_CONSUMED', 'This Sandbox mutation authorization was already staged and cannot be reused.');
    throw error;
  }

  return {
    success: true,
    environment: 'Sandbox',
    authorizationId: reservation.authorizationId,
    sellerAccountId: reservation.sellerAccountId,
    sku: reservation.sku,
    marketplaceId: reservation.marketplaceId,
    contentLanguage: reservation.contentLanguage,
    operationId: reservation.operationId,
    stagedAt: reservation.stagedAt,
    expiresAt: reservation.expiresAt,
    status: reservation.status,
    networkAction: 'NONE',
    externalWritePerformed: false,
    tokenReturnedToBrowser: false,
    message: 'Sandbox mutation authorization was consumed into backend staging. No eBay API request was sent.'
  };
}

async function getSandboxMutationStageStatus(authorizationId) {
  const normalizedAuthorizationId = normalize(authorizationId);
  if (!normalizedAuthorizationId) throw backendError('MISSING_AUTHORIZATION_ID', 'Sandbox mutation authorization ID is required.');
  const row = await getDB().getSandboxMutationStageReservation(normalizedAuthorizationId);
  if (!row) throw backendError('STAGED_MUTATION_NOT_FOUND', 'No staged Sandbox mutation exists for this authorization ID.');

  return {
    success: true,
    environment: 'Sandbox',
    authorizationId: row.authorization_id,
    sellerAccountId: row.seller_account_id,
    sku: row.sku,
    previewId: row.preview_id,
    marketplaceId: row.marketplace_id,
    contentLanguage: row.content_language,
    operationId: row.operation_id,
    method: row.method,
    pathTemplate: row.path_template,
    stagedAt: row.staged_at,
    expiresAt: row.expires_at,
    status: row.status,
    networkAction: row.network_action,
    externalWritePerformed: Boolean(row.external_write_performed),
    tokenReturnedToBrowser: false
  };
}

function validateStagedReservationForExecutionPreview(row, nowMs) {
  if (!row) throw backendError('STAGED_MUTATION_NOT_FOUND', 'No staged Sandbox mutation exists for this authorization ID.');
  if (row.operation_id !== ALLOWED_OPERATION || row.operation_order !== 1) throw backendError('OPERATION_NOT_ALLOWED', 'Only staged createOrReplaceInventoryItem step 1 can be previewed.');
  if (row.method !== EXPECTED_METHOD || row.path_template !== EXPECTED_PATH_TEMPLATE) throw backendError('INVALID_MUTATION_TARGET', 'Staged mutation target does not match the approved Sandbox inventory-item endpoint.');
  if (row.status !== 'STAGED_NOT_SENT' || row.network_action !== 'NONE' || Boolean(row.external_write_performed)) throw backendError('STAGED_MUTATION_UNSAFE_STATE', 'Staged mutation is not in the safe not-sent state.');
  const expiresAtMs = Date.parse(row.expires_at);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) throw backendError('STAGED_MUTATION_EXPIRED', 'Staged Sandbox mutation has expired and must be re-approved.');
  if (!row.request_body || typeof row.request_body !== 'object' || Array.isArray(row.request_body)) throw backendError('INVALID_REQUEST_BODY', 'Staged inventory-item request body is missing or invalid.');
  const stagedSku = normalize(row.path_parameters && row.path_parameters.sku);
  if (!stagedSku || stagedSku !== normalize(row.sku)) throw backendError('SKU_MISMATCH', 'Staged path SKU does not match the reserved SKU.');
  if (!normalize(row.marketplace_id)) throw backendError('MARKETPLACE_ID_MISSING', 'Staged mutation has no verified eBay MarketplaceId.');
  if (!normalize(row.content_language)) throw backendError('CONTENT_LANGUAGE_MISSING', 'Staged mutation has no verified Content-Language.');
}

async function buildSandboxMutationExecutionPreview(authorizationId, now = Date.now()) {
  const normalizedAuthorizationId = normalize(authorizationId);
  if (!normalizedAuthorizationId) throw backendError('MISSING_AUTHORIZATION_ID', 'Sandbox mutation authorization ID is required.');

  const row = await getDB().getSandboxMutationStageReservation(normalizedAuthorizationId);
  validateStagedReservationForExecutionPreview(row, now);

  const sandboxTokens = await TokenVault.getDecryptedTokens(row.seller_account_id, 'Sandbox');
  if (!sandboxTokens) throw backendError('SANDBOX_TOKEN_NOT_FOUND', 'No connected eBay Sandbox token exists for the staged seller account.');
  if (!normalize(sandboxTokens.accessToken)) throw backendError('SANDBOX_ACCESS_TOKEN_MISSING', 'Connected Sandbox account has no usable access token.');
  const accessTokenExpiresAtMs = Date.parse(sandboxTokens.accessTokenExpiresAt || '');
  if (!Number.isFinite(accessTokenExpiresAtMs) || accessTokenExpiresAtMs <= now) throw backendError('SANDBOX_ACCESS_TOKEN_EXPIRED', 'Connected Sandbox access token is expired or has no valid expiry time.');

  const encodedSku = encodeURIComponent(normalize(row.sku));
  const requestUrl = `${SANDBOX_API_BASE_URL}/sell/inventory/v1/inventory_item/${encodedSku}`;

  return {
    success: true,
    environment: 'Sandbox',
    authorizationId: row.authorization_id,
    sellerAccountId: row.seller_account_id,
    sku: row.sku,
    marketplaceId: row.marketplace_id,
    contentLanguage: row.content_language,
    operationId: row.operation_id,
    stageStatus: row.status,
    stagedAt: row.staged_at,
    stageExpiresAt: row.expires_at,
    generatedAt: new Date(now).toISOString(),
    httpRequest: {
      method: EXPECTED_METHOD,
      url: requestUrl,
      headers: {
        Authorization: 'Bearer <TOKENVAULT_REDACTED>',
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Content-Language': row.content_language
      },
      body: row.request_body
    },
    accessTokenState: {
      presentInBackendVault: true,
      expiresAt: sandboxTokens.accessTokenExpiresAt
    },
    readyForExternalNetwork: true,
    blockingReasons: [],
    networkAction: 'NONE',
    externalWritePerformed: false,
    tokenReturnedToBrowser: false,
    message: 'HTTP execution preview generated with verified MarketplaceId and Content-Language. No eBay API request was sent.'
  };
}

module.exports = {
  ALLOWED_OPERATION,
  EXPECTED_METHOD,
  EXPECTED_PATH_TEMPLATE,
  SANDBOX_API_BASE_URL,
  MAX_AUTHORIZATION_LIFETIME_MS,
  fingerprintStep,
  validateAuthorizationShape,
  stageSandboxMutationExecution,
  getSandboxMutationStageStatus,
  buildSandboxMutationExecutionPreview
};
