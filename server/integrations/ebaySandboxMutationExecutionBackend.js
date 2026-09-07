const TokenVault = require('../security/tokenVault');
const { getDB } = require('../db/database');

const ALLOWED_OPERATION = 'createOrReplaceInventoryItem';
const EXPECTED_METHOD = 'PUT';
const EXPECTED_PATH_TEMPLATE = '/sell/inventory/v1/inventory_item/{sku}';
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
  if (!authorization || typeof authorization !== 'object') {
    throw backendError('MISSING_AUTHORIZATION', 'Sandbox mutation authorization is required.');
  }
  if (!step || typeof step !== 'object') {
    throw backendError('MISSING_MUTATION_STEP', 'Sandbox mutation step is required.');
  }

  const requiredTextFields = [
    'authorizationId',
    'sellerAccountId',
    'sku',
    'previewId',
    'requestFingerprint',
    'planId',
    'credentialRef',
    'verificationId',
    'stepFingerprint',
    'approvedBy',
    'approvalReason',
    'approvedAt',
    'expiresAt'
  ];

  for (const field of requiredTextFields) {
    if (!normalize(authorization[field])) {
      throw backendError('INVALID_AUTHORIZATION_RECORD', `Sandbox mutation authorization field ${field} is required.`);
    }
  }

  if (authorization.environment !== 'SANDBOX') {
    throw backendError('PRODUCTION_NOT_ALLOWED', 'Only eBay Sandbox mutation staging is allowed.');
  }
  if (authorization.operationId !== ALLOWED_OPERATION || authorization.operationOrder !== 1) {
    throw backendError('OPERATION_NOT_ALLOWED', 'Only createOrReplaceInventoryItem step 1 may be staged at this phase.');
  }
  if (authorization.method !== EXPECTED_METHOD || authorization.pathTemplate !== EXPECTED_PATH_TEMPLATE) {
    throw backendError('INVALID_MUTATION_TARGET', 'Sandbox mutation authorization does not target the approved inventory-item endpoint.');
  }
  if (authorization.oneTimeUse !== true || authorization.executionTriggered !== false) {
    throw backendError('AUTHORIZATION_NOT_UNUSED', 'Sandbox mutation authorization must be unused and one-time.');
  }
  if (authorization.networkAction !== 'NONE' || authorization.status !== 'SANDBOX_MUTATION_AUTHORIZED_NOT_EXECUTED') {
    throw backendError('UNSAFE_AUTHORIZATION_STATE', 'Sandbox mutation authorization is not in the safe pre-execution state.');
  }
  if (
    authorization.confirmedSandboxOnly !== true ||
    authorization.confirmedSellerAccountAndSku !== true ||
    authorization.confirmedPayloadPreview !== true ||
    authorization.confirmedMutationRisk !== true
  ) {
    throw backendError('MISSING_EXPLICIT_CONFIRMATION', 'All explicit Sandbox mutation confirmations are required.');
  }

  const approvedAtMs = Date.parse(authorization.approvedAt);
  const expiresAtMs = Date.parse(authorization.expiresAt);
  if (!Number.isFinite(approvedAtMs) || !Number.isFinite(expiresAtMs)) {
    throw backendError('INVALID_AUTHORIZATION_TIME', 'Sandbox mutation authorization timestamps are invalid.');
  }
  if (approvedAtMs > nowMs + 30_000) {
    throw backendError('INVALID_AUTHORIZATION_TIME', 'Sandbox mutation authorization approval time is in the future.');
  }
  if (expiresAtMs <= nowMs) {
    throw backendError('AUTHORIZATION_EXPIRED', 'Sandbox mutation authorization has expired.');
  }
  if (expiresAtMs - approvedAtMs > MAX_AUTHORIZATION_LIFETIME_MS + 1000) {
    throw backendError('AUTHORIZATION_TTL_TOO_LONG', 'Sandbox mutation authorization exceeds the maximum 15-minute lifetime.');
  }

  if (step.operationId !== authorization.operationId || step.order !== authorization.operationOrder) {
    throw backendError('STEP_AUTHORIZATION_MISMATCH', 'Mutation step does not match the approved operation.');
  }
  if (step.method !== EXPECTED_METHOD || step.pathTemplate !== EXPECTED_PATH_TEMPLATE) {
    throw backendError('INVALID_MUTATION_TARGET', 'Mutation step does not target the approved inventory-item endpoint.');
  }
  if (!step.pathParameters || normalize(step.pathParameters.sku) !== normalize(authorization.sku)) {
    throw backendError('SKU_MISMATCH', 'Mutation step SKU does not match the approved SKU.');
  }
  if (!step.requestBody || typeof step.requestBody !== 'object' || Array.isArray(step.requestBody)) {
    throw backendError('INVALID_REQUEST_BODY', 'Inventory-item mutation request body is required.');
  }

  const computedFingerprint = fingerprintStep(step);
  if (computedFingerprint !== authorization.stepFingerprint) {
    throw backendError('STEP_FINGERPRINT_MISMATCH', 'Mutation step content changed after approval.');
  }

  return {
    approvedAtMs,
    expiresAtMs,
    computedFingerprint
  };
}

async function stageSandboxMutationExecution({ authorization, step, now = Date.now() }) {
  validateAuthorizationShape(authorization, step, now);

  const sandboxTokens = await TokenVault.getDecryptedTokens(authorization.sellerAccountId, 'Sandbox');
  if (!sandboxTokens) {
    throw backendError('SANDBOX_TOKEN_NOT_FOUND', 'No connected eBay Sandbox token exists for the approved seller account.');
  }

  const reservation = {
    authorizationId: normalize(authorization.authorizationId),
    sellerAccountId: normalize(authorization.sellerAccountId),
    sku: normalize(authorization.sku),
    previewId: normalize(authorization.previewId),
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
    if (error && error.code === 'AUTHORIZATION_ALREADY_CONSUMED') {
      throw backendError('AUTHORIZATION_ALREADY_CONSUMED', 'This Sandbox mutation authorization was already staged and cannot be reused.');
    }
    throw error;
  }

  return {
    success: true,
    environment: 'Sandbox',
    authorizationId: reservation.authorizationId,
    sellerAccountId: reservation.sellerAccountId,
    sku: reservation.sku,
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
  if (!normalizedAuthorizationId) {
    throw backendError('MISSING_AUTHORIZATION_ID', 'Sandbox mutation authorization ID is required.');
  }

  const row = await getDB().getSandboxMutationStageReservation(normalizedAuthorizationId);
  if (!row) {
    throw backendError('STAGED_MUTATION_NOT_FOUND', 'No staged Sandbox mutation exists for this authorization ID.');
  }

  return {
    success: true,
    environment: 'Sandbox',
    authorizationId: row.authorization_id,
    sellerAccountId: row.seller_account_id,
    sku: row.sku,
    previewId: row.preview_id,
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

module.exports = {
  ALLOWED_OPERATION,
  EXPECTED_METHOD,
  EXPECTED_PATH_TEMPLATE,
  MAX_AUTHORIZATION_LIFETIME_MS,
  fingerprintStep,
  validateAuthorizationShape,
  stageSandboxMutationExecution,
  getSandboxMutationStageStatus
};
