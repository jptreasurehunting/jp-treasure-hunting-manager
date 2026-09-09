const crypto = require('crypto');
const { getDB } = require('../db/database');
const { buildShopeeSgAuthorizationSigningPreview } = require('./shopeeSgAuthorizationSigningPreviewBackend');

const STATE_BYTES = 32;
const AUTHORIZATION_STAGE_COMPONENTS = new Set(['PARTNER_ID', 'API_PATH', 'TIMESTAMP', 'REDIRECT_URI', 'SHOP_ID']);

function normalize(value) {
  return String(value || '').trim();
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateSessionId(value) {
  const sessionId = normalize(value);
  if (!/^shopee_sg_authsess_[A-Za-z0-9_-]{20,80}$/.test(sessionId)) {
    throw createError('INVALID_SHOPEE_AUTH_SESSION_ID', 'Shopee SG authorization session ID is invalid.');
  }
  return sessionId;
}

function serializeSignatureBase(values, serialization) {
  if (serialization === 'CONCAT_NO_SEPARATOR') return values.join('');
  if (serialization === 'COLON_SEPARATOR') return values.join(':');
  throw createError('UNSUPPORTED_SHOPEE_SIGNATURE_SERIALIZATION', 'Unsupported Shopee SG signature base serialization.');
}

function createSignature(baseString, partnerKey, implementation) {
  const hmac = crypto.createHmac('sha256', partnerKey).update(baseString, 'utf8');
  if (implementation === 'HMAC_SHA256_HEX') return hmac.digest('hex');
  if (implementation === 'HMAC_SHA256_BASE64') return hmac.digest('base64');
  throw createError('UNSUPPORTED_SHOPEE_SIGNATURE_IMPLEMENTATION', 'Unsupported Shopee SG signature implementation.');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function assertSessionBoundToPreview(row, preview) {
  const pairs = [
    ['account_id', preview.accountId, 'seller account'],
    ['shop_id', preview.shopId, 'shop ID'],
    ['credential_ref', preview.credentialRef, 'credential reference'],
    ['auth_schema_verification_id', preview.authSchemaVerificationId, 'auth schema verification'],
    ['structured_mapping_id', preview.structuredMappingId, 'structured auth mapping'],
    ['signing_runtime_id', preview.runtimeVerificationId, 'signing runtime'],
    ['redirect_uri', preview.redirectUriPreview, 'redirect URI']
  ];
  for (const [column, value, label] of pairs) {
    if (normalize(row[column]) !== normalize(value)) {
      throw createError('SHOPEE_AUTH_SESSION_BINDING_MISMATCH', `Shopee SG authorization session ${label} no longer matches the verified signing preview.`);
    }
  }
}

function buildQueryRoleValues(preview, structuredMapping, signature, stateValue, timestamp) {
  const byRole = {
    PARTNER_ID: normalize(process.env[`${preview.credentialRef}_PARTNER_ID`]),
    TIMESTAMP: String(timestamp),
    SIGNATURE: signature,
    REDIRECT_URI: preview.redirectUriPreview
  };
  const fieldNames = structuredMapping.authorizationQueryFieldNames;
  const roleToField = {
    PARTNER_ID: fieldNames.partnerId,
    TIMESTAMP: fieldNames.timestamp,
    SIGNATURE: fieldNames.signature,
    REDIRECT_URI: fieldNames.redirectUri
  };
  const params = [];
  for (const role of structuredMapping.authorizationQueryOrder) {
    const normalizedRole = normalize(role).toUpperCase();
    const fieldName = normalize(roleToField[normalizedRole]);
    const value = normalize(byRole[normalizedRole]);
    if (!fieldName || !value) {
      throw createError('SHOPEE_AUTHORIZATION_REQUEST_ASSEMBLY_INCOMPLETE', `Shopee SG authorization query role ${normalizedRole} is incomplete.`);
    }
    params.push({ role: normalizedRole, fieldName, value });
  }
  params.push({ role: 'CALLBACK_CORRELATION', fieldName: rowSafeFieldName(structuredMapping, stateValue.fieldName), value: stateValue.value });
  return params;
}

function rowSafeFieldName(structuredMapping, fieldName) {
  const normalized = normalize(fieldName);
  const existing = Object.values(structuredMapping.authorizationQueryFieldNames || {}).map(normalize);
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalized) || existing.includes(normalized)) {
    throw createError('SHOPEE_CORRELATION_FIELD_COLLISION', 'Shopee SG callback correlation request field is unsafe or collides with a structured authorization query field.');
  }
  return normalized;
}

/**
 * Issues one preview-only callback-correlation state for a prepared session, stores only its SHA-256 hash,
 * assembles the fully signed authorization request in backend memory, and returns only a redacted request summary.
 * The plaintext state, signature, signature base, Partner ID/Key, and executable authorization URL are never returned.
 */
async function issueShopeeSgAuthorizationRequestPreview(input, now = Date.now()) {
  const sessionId = validateSessionId(input && input.sessionId);
  const row = await getDB().getShopeeSgAuthSession(sessionId);
  if (!row) throw createError('SHOPEE_AUTH_SESSION_NOT_FOUND', 'Shopee SG authorization session was not found.');
  if (Date.parse(row.expires_at) <= now) throw createError('SHOPEE_AUTH_SESSION_EXPIRED', 'Shopee SG authorization session has expired.');
  if (row.status !== 'PREPARED' || row.correlation_state_hash || row.correlation_state_issued_at) {
    throw createError('SHOPEE_AUTH_SESSION_STATE_ALREADY_ISSUED', 'Shopee SG authorization session has already consumed its preview correlation-state issuance slot.');
  }

  const signingPreview = buildShopeeSgAuthorizationSigningPreview(input, now);
  if (!signingPreview.canPrepareSignedAuthorizationRequest || !signingPreview.redirectUriPreview) {
    throw createError('SHOPEE_SIGNED_AUTHORIZATION_PREPARATION_NOT_READY', 'Shopee SG signing preview is not ready for request assembly.');
  }
  assertSessionBoundToPreview(row, signingPreview);

  const structuredMapping = input && input.structuredAuthorizationMapping;
  if (!structuredMapping || normalize(structuredMapping.mappingId) !== normalize(row.structured_mapping_id)) {
    throw createError('SHOPEE_AUTH_SESSION_BINDING_MISMATCH', 'Shopee SG structured authorization mapping does not match the prepared session.');
  }
  const runtime = input && input.signingRuntimeVerification;
  if (!runtime || normalize(runtime.runtimeVerificationId) !== normalize(row.signing_runtime_id)) {
    throw createError('SHOPEE_AUTH_SESSION_BINDING_MISMATCH', 'Shopee SG signing runtime does not match the prepared session.');
  }

  const partnerId = normalize(process.env[`${row.credential_ref}_PARTNER_ID`]);
  const partnerKey = normalize(process.env[`${row.credential_ref}_PARTNER_KEY`]);
  if (!partnerId || !partnerKey) {
    throw createError('SHOPEE_BACKEND_CREDENTIAL_INCOMPLETE', 'Shopee SG backend Partner ID / Partner Key configuration is incomplete.');
  }

  const timestamp = Math.floor(now / 1000);
  const apiPath = new URL(signingPreview.authorizationEndpoint).pathname;
  const valueByComponent = {
    PARTNER_ID: partnerId,
    API_PATH: apiPath,
    TIMESTAMP: String(timestamp),
    REDIRECT_URI: signingPreview.redirectUriPreview,
    SHOP_ID: signingPreview.shopId
  };
  const baseComponents = structuredMapping.signatureBaseComponents || [];
  const unresolved = baseComponents.filter((component) => !AUTHORIZATION_STAGE_COMPONENTS.has(component) || !normalize(valueByComponent[component]));
  if (unresolved.length > 0) {
    throw createError('SHOPEE_AUTHORIZATION_REQUEST_ASSEMBLY_INCOMPLETE', `Shopee SG authorization signature still has unresolved components: ${unresolved.join(', ')}.`);
  }

  const baseString = serializeSignatureBase(baseComponents.map((component) => valueByComponent[component]), runtime.signatureBaseSerialization);
  const signature = createSignature(baseString, partnerKey, runtime.signatureImplementation);
  const state = crypto.randomBytes(STATE_BYTES).toString('base64url');
  const stateHash = sha256(state);
  const stateIssuedAt = new Date(now).toISOString();

  const params = buildQueryRoleValues(
    signingPreview,
    structuredMapping,
    signature,
    { fieldName: row.correlation_request_field, value: state },
    timestamp
  );
  const internalUrl = new URL(signingPreview.authorizationEndpoint);
  for (const param of params) internalUrl.searchParams.append(param.fieldName, param.value);
  const requestFingerprint = sha256(`${signingPreview.requestMethod}\n${internalUrl.toString()}`);

  await getDB().issueShopeeSgAuthSessionPreviewState(sessionId, stateHash, stateIssuedAt);

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    mode: 'SIGNED_AUTHORIZATION_REQUEST_PREVIEW_NO_NETWORK',
    sessionId,
    sessionStatus: 'STATE_ISSUED_PREVIEW_ONLY',
    accountId: row.account_id,
    shopId: row.shop_id,
    credentialRef: row.credential_ref,
    authorizationEndpoint: signingPreview.authorizationEndpoint,
    requestMethod: signingPreview.requestMethod,
    redirectUri: row.redirect_uri,
    queryFields: params.map((param) => ({ role: param.role, fieldName: param.fieldName })),
    signatureImplementation: runtime.signatureImplementation,
    signatureBaseSerialization: runtime.signatureBaseSerialization,
    signatureComponentRoles: baseComponents,
    signatureGenerated: true,
    signatureLength: signature.length,
    correlationStateIssued: true,
    correlationStateLength: state.length,
    correlationStateEntropyBytes: STATE_BYTES,
    correlationStatePlaintextStored: false,
    correlationStateValueReturned: false,
    correlationStateHashReturned: false,
    signatureValueReturned: false,
    signatureBaseReturned: false,
    partnerIdValueReturned: false,
    partnerKeyValueReturned: false,
    secretValuesReturned: false,
    executableAuthorizationUrlReturned: false,
    authorizationRequestFingerprint: requestFingerprint,
    stateIssuedAt,
    expiresAt: row.expires_at,
    canStartAuthorization: false,
    canReceiveAuthorizationCallback: false,
    canExchangeToken: false,
    sendAllowed: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    blockingReasons: [
      'This state was issued for preview only and its plaintext was deliberately discarded after request assembly; this session cannot be used for a live authorization redirect.',
      'Shopee authorization navigation, callback processing, and token exchange remain disabled.'
    ]
  };
}

module.exports = {
  STATE_BYTES,
  issueShopeeSgAuthorizationRequestPreview
};
