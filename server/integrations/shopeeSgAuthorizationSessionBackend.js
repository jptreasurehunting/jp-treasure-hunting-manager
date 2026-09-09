const crypto = require('crypto');
const { getDB } = require('../db/database');
const { buildShopeeSgAuthorizationSigningPreview } = require('./shopeeSgAuthorizationSigningPreviewBackend');

const SESSION_TTL_MS = 10 * 60 * 1000;
const CORRELATION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function normalize(value) {
  return String(value || '').trim();
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isOfficialShopeeDocumentationUrl(value) {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch {
    return false;
  }
}

function isSafeWireFieldName(value) {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalize(value));
}

function validateCallbackCorrelationMapping(mapping, signingPreview, now) {
  if (!mapping || typeof mapping !== 'object') {
    throw createError('MISSING_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'A verified Shopee SG callback correlation mapping is required.');
  }

  const correlationMappingId = normalize(mapping.correlationMappingId);
  const status = normalize(mapping.status);
  const region = normalize(mapping.marketplaceRegion);
  const authSchemaVerificationId = normalize(mapping.authSchemaVerificationId);
  const structuredMappingId = normalize(mapping.structuredMappingId);
  const officialSourceUrl = normalize(mapping.officialSourceUrl);
  const correlationMode = normalize(mapping.correlationMode).toUpperCase();
  const authorizationRequestFieldName = normalize(mapping.authorizationRequestFieldName);
  const callbackFieldName = normalize(mapping.callbackFieldName);
  const signatureParticipation = normalize(mapping.signatureParticipation).toUpperCase();
  const checkedAt = normalize(mapping.checkedAt);

  if (!correlationMappingId || status !== 'CALLBACK_CORRELATION_VERIFIED' || region !== 'SG') {
    throw createError('INVALID_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'Shopee SG callback correlation mapping must be verified and Singapore-scoped.');
  }
  if (authSchemaVerificationId !== signingPreview.authSchemaVerificationId || structuredMappingId !== signingPreview.structuredMappingId) {
    throw createError('INVALID_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'Shopee SG callback correlation mapping must match the current auth schema and structured mapping.');
  }
  if (!isOfficialShopeeDocumentationUrl(officialSourceUrl)) {
    throw createError('INVALID_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'Shopee SG callback correlation mapping must reference an official Shopee HTTPS documentation source.');
  }
  if (correlationMode !== 'OFFICIAL_ROUND_TRIP_FIELD') {
    throw createError('SHOPEE_SAFE_CALLBACK_CORRELATION_UNAVAILABLE', 'No verified official round-trip callback correlation field is available; safe auth-session preparation is blocked.');
  }
  if (!isSafeWireFieldName(authorizationRequestFieldName) || !isSafeWireFieldName(callbackFieldName)) {
    throw createError('INVALID_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'Shopee SG callback correlation wire fields must be safe explicit field names.');
  }
  if (signatureParticipation !== 'NOT_INCLUDED') {
    throw createError('SHOPEE_CORRELATION_SIGNATURE_MAPPING_REQUIRED', 'The verified correlation value participates in the signature base; structured signing mapping must be updated before session preparation.');
  }
  if (mapping.safeSessionPreparationAllowed !== true) {
    throw createError('SHOPEE_SAFE_CALLBACK_CORRELATION_UNAVAILABLE', 'Callback correlation mapping does not allow safe session preparation.');
  }
  if (mapping.currentSingaporeApplicabilityConfirmed !== true || mapping.externalNetworkAllowed !== false || mapping.externalWriteAllowed !== false || mapping.secretsStored !== false) {
    throw createError('INVALID_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'Callback correlation mapping must confirm current SG applicability and grant no network/write permission or secret storage.');
  }

  const queryNames = (signingPreview.queryTemplate || []).map((entry) => normalize(entry.fieldName));
  if (queryNames.includes(authorizationRequestFieldName)) {
    throw createError('SHOPEE_CORRELATION_FIELD_COLLISION', 'Callback correlation request field collides with an existing authorization query field.');
  }
  const callbackNames = signingPreview.callbackTemplate
    ? [normalize(signingPreview.callbackTemplate.authorizationCodeField), normalize(signingPreview.callbackTemplate.shopIdField)]
    : [];
  if (callbackNames.includes(callbackFieldName)) {
    throw createError('SHOPEE_CORRELATION_FIELD_COLLISION', 'Callback correlation field collides with authorization-code or shop-ID callback fields.');
  }

  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs > now || now - checkedAtMs > CORRELATION_MAX_AGE_MS) {
    throw createError('STALE_SHOPEE_CALLBACK_CORRELATION_MAPPING', 'Shopee SG callback correlation mapping is missing, future-dated, or older than 90 days.');
  }

  return {
    correlationMappingId,
    authorizationRequestFieldName,
    callbackFieldName,
    checkedAt: new Date(checkedAtMs).toISOString()
  };
}

function safeSessionResponse(row, now = Date.now()) {
  const expired = Date.parse(row.expires_at) <= now;
  const stateIssued = Boolean(row.correlation_state_issued_at);
  const status = expired && (row.status === 'PREPARED' || row.status === 'STATE_ISSUED_PREVIEW_ONLY') ? 'EXPIRED' : row.status;
  const blockingReasons = [];
  if (!stateIssued) {
    blockingReasons.push('Correlation state has not been issued; external authorization navigation remains disabled.');
  } else if (row.status === 'STATE_ISSUED_PREVIEW_ONLY') {
    blockingReasons.push('The correlation state was issued for preview only and its plaintext was discarded; create a new session for any future live authorization start.');
  }
  blockingReasons.push('Authorization callback validation and token exchange are not enabled in this preparation stage.');

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    mode: 'AUTHORIZATION_SESSION_PREPARED_NO_NETWORK',
    sessionId: row.session_id,
    accountId: row.account_id,
    shopId: row.shop_id,
    credentialRef: row.credential_ref,
    authSchemaVerificationId: row.auth_schema_verification_id,
    structuredMappingId: row.structured_mapping_id,
    signingRuntimeId: row.signing_runtime_id,
    correlationMappingId: row.correlation_mapping_id,
    redirectUri: row.redirect_uri,
    correlationRequestField: row.correlation_request_field,
    correlationCallbackField: row.correlation_callback_field,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    status,
    correlationStateIssued: stateIssued,
    correlationStateValueReturned: false,
    correlationStateHashReturned: false,
    authorizationCodeStored: false,
    authorizationCodeReturned: false,
    signatureValueReturned: false,
    partnerKeyValueReturned: false,
    secretValuesReturned: false,
    canIssueCorrelationStateInFutureAuthStart: !expired && row.status === 'PREPARED' && !stateIssued,
    canStartAuthorization: false,
    canReceiveAuthorizationCallback: false,
    canExchangeToken: false,
    sendAllowed: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    blockingReasons
  };
}

async function prepareShopeeSgAuthorizationSession(input, now = Date.now()) {
  const signingPreview = buildShopeeSgAuthorizationSigningPreview(input, now);
  if (!signingPreview.canPrepareSignedAuthorizationRequest || !signingPreview.redirectUriPreview) {
    throw createError('SHOPEE_SIGNED_AUTHORIZATION_PREPARATION_NOT_READY', 'Shopee SG signing/redirect preview is not ready for safe auth-session preparation.');
  }

  const correlation = validateCallbackCorrelationMapping(input && input.callbackCorrelationMapping, signingPreview, now);
  const issuedAt = new Date(now).toISOString();
  const expiresAt = new Date(now + SESSION_TTL_MS).toISOString();
  const sessionId = `shopee_sg_authsess_${crypto.randomBytes(24).toString('base64url')}`;

  const session = {
    sessionId,
    accountId: signingPreview.accountId,
    shopId: signingPreview.shopId,
    credentialRef: signingPreview.credentialRef,
    authSchemaVerificationId: signingPreview.authSchemaVerificationId,
    structuredMappingId: signingPreview.structuredMappingId,
    signingRuntimeId: signingPreview.runtimeVerificationId,
    correlationMappingId: correlation.correlationMappingId,
    redirectUri: signingPreview.redirectUriPreview,
    correlationRequestField: correlation.authorizationRequestFieldName,
    correlationCallbackField: correlation.callbackFieldName,
    correlationStateHash: null,
    correlationStateIssuedAt: null,
    issuedAt,
    expiresAt,
    status: 'PREPARED',
    consumedAt: null,
    networkAction: 'NONE',
    externalWritePerformed: false
  };

  await getDB().createShopeeSgAuthSession(session);
  return safeSessionResponse({
    session_id: session.sessionId,
    account_id: session.accountId,
    shop_id: session.shopId,
    credential_ref: session.credentialRef,
    auth_schema_verification_id: session.authSchemaVerificationId,
    structured_mapping_id: session.structuredMappingId,
    signing_runtime_id: session.signingRuntimeId,
    correlation_mapping_id: session.correlationMappingId,
    redirect_uri: session.redirectUri,
    correlation_request_field: session.correlationRequestField,
    correlation_callback_field: session.correlationCallbackField,
    correlation_state_issued_at: null,
    issued_at: session.issuedAt,
    expires_at: session.expiresAt,
    status: session.status
  }, now);
}

async function getShopeeSgAuthorizationSessionStatus(sessionId, now = Date.now()) {
  const normalizedSessionId = normalize(sessionId);
  if (!/^shopee_sg_authsess_[A-Za-z0-9_-]{20,80}$/.test(normalizedSessionId)) {
    throw createError('INVALID_SHOPEE_AUTH_SESSION_ID', 'Shopee SG authorization session ID is invalid.');
  }
  const row = await getDB().getShopeeSgAuthSession(normalizedSessionId);
  if (!row) throw createError('SHOPEE_AUTH_SESSION_NOT_FOUND', 'Shopee SG authorization session was not found.');
  return safeSessionResponse(row, now);
}

module.exports = {
  SESSION_TTL_MS,
  prepareShopeeSgAuthorizationSession,
  getShopeeSgAuthorizationSessionStatus
};
