const crypto = require('crypto');

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const SUPPORTED_SIGNATURE_IMPLEMENTATIONS = new Set(['HMAC_SHA256_HEX', 'HMAC_SHA256_BASE64']);
const SUPPORTED_BASE_SERIALIZATIONS = new Set(['CONCAT_NO_SEPARATOR', 'COLON_SEPARATOR']);
const TOKEN_STAGE_COMPONENTS = new Set(['PARTNER_ID', 'API_PATH', 'TIMESTAMP', 'SHOP_ID', 'AUTHORIZATION_CODE', 'REDIRECT_URI']);
const QUERY_ROLES = new Set(['PARTNER_ID_QUERY', 'TIMESTAMP_QUERY', 'SIGNATURE_QUERY']);
const BODY_ROLES = new Set(['AUTHORIZATION_CODE_BODY', 'SHOP_ID_BODY', 'PARTNER_ID_BODY']);

function normalize(value) { return String(value || '').trim(); }
function createError(code, message) { const error = new Error(message); error.code = code; return error; }
function isSafeWireFieldName(value) { return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalize(value)); }
function isOfficialShopeeDocumentationUrl(value) {
  try { const url = new URL(normalize(value)); return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com')); } catch { return false; }
}
function isShopeeServiceEndpoint(value) {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (url.hostname === 'shopee.com' || url.hostname.endsWith('.shopee.com') || url.hostname === 'shopeemobile.com' || url.hostname.endsWith('.shopeemobile.com'));
  } catch { return false; }
}
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function serializeSignatureBase(values, serialization) {
  if (serialization === 'CONCAT_NO_SEPARATOR') return values.join('');
  if (serialization === 'COLON_SEPARATOR') return values.join(':');
  throw createError('UNSUPPORTED_SHOPEE_TOKEN_SIGNATURE_SERIALIZATION', 'Unsupported Shopee SG token signature base serialization.');
}
function createSignature(baseString, partnerKey, implementation) {
  const hmac = crypto.createHmac('sha256', partnerKey).update(baseString, 'utf8');
  if (implementation === 'HMAC_SHA256_HEX') return hmac.digest('hex');
  if (implementation === 'HMAC_SHA256_BASE64') return hmac.digest('base64');
  throw createError('UNSUPPORTED_SHOPEE_TOKEN_SIGNATURE_IMPLEMENTATION', 'Unsupported Shopee SG token signature implementation.');
}
function hasExactRoles(values, allowed) {
  if (!Array.isArray(values) || values.length !== allowed.size || new Set(values).size !== values.length) return false;
  return values.every((value) => allowed.has(normalize(value).toUpperCase()));
}
function validateFreshTimestamp(value, code, message, now) {
  const checkedAt = Date.parse(normalize(value));
  if (!Number.isFinite(checkedAt) || checkedAt > now + 5 * 60 * 1000 || now - checkedAt > MAX_AGE_MS) throw createError(code, message);
}

function validateTokenMapping(mapping, authSchema, now) {
  if (!mapping || typeof mapping !== 'object') throw createError('MISSING_SHOPEE_TOKEN_MAPPING', 'A verified Shopee SG structured token mapping is required.');
  if (!authSchema || typeof authSchema !== 'object' || normalize(authSchema.status) !== 'OFFICIAL_AUTH_SCHEMA_VERIFIED') throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'A verified Shopee SG auth schema is required.');
  if (normalize(mapping.status) !== 'STRUCTURED_TOKEN_MAPPING_VERIFIED' || normalize(mapping.marketplaceRegion) !== 'SG') throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping must be verified and Singapore-scoped.');
  if (normalize(mapping.authSchemaVerificationId) !== normalize(authSchema.verificationId)) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping must match the current auth schema verification.');
  if (!isOfficialShopeeDocumentationUrl(mapping.officialSourceUrl) || !isShopeeServiceEndpoint(mapping.tokenEndpoint)) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping must reference official Shopee documentation and HTTPS service endpoint.');
  if (normalize(mapping.tokenEndpoint) !== normalize(authSchema.tokenEndpoint)) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token endpoint does not match the auth schema verification.');
  if (normalize(mapping.tokenHttpMethod).toUpperCase() !== 'POST') throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token exchange preview supports only an officially verified POST mapping.');
  if (!['JSON', 'FORM_URLENCODED'].includes(normalize(mapping.tokenBodyEncoding).toUpperCase())) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token body encoding is unsupported.');
  if (mapping.allRequiredRequestFieldsRepresented !== true || mapping.allRequiredResponseFieldsRepresented !== true) throw createError('INCOMPLETE_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping must explicitly cover all required request and response fields.');
  if (mapping.tokenExchangeAllowed !== false || mapping.externalNetworkAllowed !== false || mapping.externalWriteAllowed !== false || mapping.secretsStored !== false) throw createError('UNSAFE_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping must grant no live exchange/network/write permission and store no secrets.');
  if (mapping.currentSingaporeApplicabilityConfirmed !== true) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping must confirm current Singapore applicability.');
  if (!hasExactRoles(mapping.tokenQueryOrder, QUERY_ROLES) || !hasExactRoles(mapping.tokenBodyRoles, BODY_ROLES)) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token query/body role coverage is incomplete or duplicated.');
  const queryFields = Object.values(mapping.tokenQueryFieldNames || {});
  const bodyFields = Object.values(mapping.tokenBodyFieldNames || {});
  const responseFields = Object.values(mapping.tokenResponseFieldNames || {});
  if (queryFields.length !== 3 || bodyFields.length !== 3 || responseFields.length !== 3 || [...queryFields, ...bodyFields, ...responseFields].some((field) => !isSafeWireFieldName(field))) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token wire field names are incomplete or unsafe.');
  if (new Set(queryFields).size !== queryFields.length || new Set(bodyFields).size !== bodyFields.length || new Set(responseFields).size !== responseFields.length) throw createError('INVALID_SHOPEE_TOKEN_MAPPING', 'Shopee SG token wire field names must not duplicate within a request section/response.');
  validateFreshTimestamp(mapping.checkedAt, 'STALE_SHOPEE_TOKEN_MAPPING', 'Shopee SG token mapping is missing, future-dated, or older than 90 days.', now);
  validateFreshTimestamp(authSchema.checkedAt, 'STALE_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Shopee SG auth schema is missing, future-dated, or older than 90 days.', now);
  return mapping;
}

function validateRuntime(runtime, mapping, now) {
  if (!runtime || typeof runtime !== 'object') throw createError('MISSING_SHOPEE_TOKEN_RUNTIME', 'A verified Shopee SG token exchange runtime is required.');
  if (normalize(runtime.status) !== 'TOKEN_EXCHANGE_RUNTIME_VERIFIED' || normalize(runtime.marketplaceRegion) !== 'SG') throw createError('INVALID_SHOPEE_TOKEN_RUNTIME', 'Shopee SG token exchange runtime must be verified and Singapore-scoped.');
  if (normalize(runtime.tokenMappingId) !== normalize(mapping.tokenMappingId) || normalize(runtime.authSchemaVerificationId) !== normalize(mapping.authSchemaVerificationId)) throw createError('INVALID_SHOPEE_TOKEN_RUNTIME', 'Shopee SG token runtime must match the current token mapping and auth schema.');
  if (normalize(runtime.signatureAlgorithmLabel) !== normalize(mapping.signatureAlgorithm)) throw createError('INVALID_SHOPEE_TOKEN_RUNTIME', 'Shopee SG token runtime algorithm label must match the token mapping.');
  if (!SUPPORTED_SIGNATURE_IMPLEMENTATIONS.has(normalize(runtime.signatureImplementation).toUpperCase())) throw createError('UNSUPPORTED_SHOPEE_TOKEN_SIGNATURE_IMPLEMENTATION', 'Shopee SG token runtime selected an unsupported signature implementation.');
  if (!SUPPORTED_BASE_SERIALIZATIONS.has(normalize(runtime.signatureBaseSerialization).toUpperCase())) throw createError('UNSUPPORTED_SHOPEE_TOKEN_SIGNATURE_SERIALIZATION', 'Shopee SG token runtime selected an unsupported signature serialization.');
  if (!isOfficialShopeeDocumentationUrl(runtime.officialSourceUrl) || runtime.currentSingaporeApplicabilityConfirmed !== true) throw createError('INVALID_SHOPEE_TOKEN_RUNTIME', 'Shopee SG token runtime must reference current official Singapore-applicable documentation.');
  if (runtime.previewAllowed !== true || runtime.tokenExchangeAllowed !== false || runtime.externalNetworkAllowed !== false || runtime.externalWriteAllowed !== false || runtime.secretValuesStored !== false) throw createError('UNSAFE_SHOPEE_TOKEN_RUNTIME', 'Shopee SG token runtime may allow preview only and must grant no live exchange/network/write permission.');
  validateFreshTimestamp(runtime.checkedAt, 'STALE_SHOPEE_TOKEN_RUNTIME', 'Shopee SG token runtime is missing, future-dated, or older than 90 days.', now);
  return runtime;
}

function buildShopeeSgTokenExchangeRequestPreview(input, now = Date.now()) {
  const accountId = normalize(input && input.accountId);
  const shopId = normalize(input && input.shopId);
  const credentialRef = normalize(input && input.credentialRef);
  if (!accountId) throw createError('MISSING_SHOPEE_ACCOUNT_ID', 'Shopee SG seller account ID is required.');
  if (!/^[1-9]\d*$/.test(shopId)) throw createError('INVALID_SHOPEE_SHOP_ID', 'Shopee SG Shop ID must be a positive integer.');
  if (!/^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(credentialRef)) throw createError('INVALID_SHOPEE_CREDENTIAL_REF', 'Shopee SG credential reference is invalid.');

  const mapping = validateTokenMapping(input && input.tokenMapping, input && input.authSchemaVerification, now);
  const runtime = validateRuntime(input && input.tokenRuntimeVerification, mapping, now);
  const partnerId = normalize(process.env[`${credentialRef}_PARTNER_ID`]);
  const partnerKey = normalize(process.env[`${credentialRef}_PARTNER_KEY`]);
  const redirectUri = normalize(process.env[`${credentialRef}_REDIRECT_URI`]);
  if (!partnerId || !partnerKey) throw createError('SHOPEE_BACKEND_CREDENTIAL_INCOMPLETE', 'Shopee SG backend Partner ID / Partner Key configuration is incomplete.');

  const syntheticAuthorizationCode = `preview_${crypto.randomBytes(24).toString('base64url')}`;
  const timestamp = Math.floor(now / 1000).toString();
  const tokenEndpoint = new URL(mapping.tokenEndpoint);
  const valueByComponent = {
    PARTNER_ID: partnerId,
    API_PATH: tokenEndpoint.pathname,
    TIMESTAMP: timestamp,
    SHOP_ID: shopId,
    AUTHORIZATION_CODE: syntheticAuthorizationCode,
    REDIRECT_URI: redirectUri
  };
  const baseComponents = Array.isArray(mapping.signatureBaseComponents) ? mapping.signatureBaseComponents.map((v) => normalize(v).toUpperCase()) : [];
  const unresolved = baseComponents.filter((component) => !TOKEN_STAGE_COMPONENTS.has(component) || !normalize(valueByComponent[component]));
  if (unresolved.length > 0) throw createError('SHOPEE_TOKEN_PREVIEW_UNRESOLVED_COMPONENTS', `Shopee SG token signature has unresolved components: ${unresolved.join(', ')}.`);

  const baseString = serializeSignatureBase(baseComponents.map((component) => valueByComponent[component]), normalize(runtime.signatureBaseSerialization).toUpperCase());
  const signature = createSignature(baseString, partnerKey, normalize(runtime.signatureImplementation).toUpperCase());
  const queryFieldByRole = {
    PARTNER_ID_QUERY: mapping.tokenQueryFieldNames.partnerId,
    TIMESTAMP_QUERY: mapping.tokenQueryFieldNames.timestamp,
    SIGNATURE_QUERY: mapping.tokenQueryFieldNames.signature
  };
  const queryValueByRole = { PARTNER_ID_QUERY: partnerId, TIMESTAMP_QUERY: timestamp, SIGNATURE_QUERY: signature };
  const queryParams = mapping.tokenQueryOrder.map((rawRole) => {
    const role = normalize(rawRole).toUpperCase();
    return { role, fieldName: normalize(queryFieldByRole[role]), value: normalize(queryValueByRole[role]) };
  });
  const bodyFieldByRole = {
    AUTHORIZATION_CODE_BODY: mapping.tokenBodyFieldNames.authorizationCode,
    SHOP_ID_BODY: mapping.tokenBodyFieldNames.shopId,
    PARTNER_ID_BODY: mapping.tokenBodyFieldNames.partnerId
  };
  const bodyValueByRole = { AUTHORIZATION_CODE_BODY: syntheticAuthorizationCode, SHOP_ID_BODY: shopId, PARTNER_ID_BODY: partnerId };
  const bodyParams = mapping.tokenBodyRoles.map((rawRole) => {
    const role = normalize(rawRole).toUpperCase();
    return { role, fieldName: normalize(bodyFieldByRole[role]), value: normalize(bodyValueByRole[role]) };
  });

  const internalUrl = new URL(mapping.tokenEndpoint);
  for (const param of queryParams) internalUrl.searchParams.append(param.fieldName, param.value);
  let serializedBody;
  if (normalize(mapping.tokenBodyEncoding).toUpperCase() === 'JSON') {
    serializedBody = JSON.stringify(Object.fromEntries(bodyParams.map((param) => [param.fieldName, param.value])));
  } else {
    const form = new URLSearchParams();
    for (const param of bodyParams) form.append(param.fieldName, param.value);
    serializedBody = form.toString();
  }
  const requestFingerprint = sha256(`POST\n${internalUrl.toString()}\n${serializedBody}`);

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    mode: 'TOKEN_EXCHANGE_REQUEST_PREVIEW_NO_NETWORK',
    accountId,
    shopId,
    credentialRef,
    authSchemaVerificationId: mapping.authSchemaVerificationId,
    tokenMappingId: mapping.tokenMappingId,
    runtimeVerificationId: runtime.runtimeVerificationId,
    tokenEndpoint: mapping.tokenEndpoint,
    requestMethod: 'POST',
    bodyEncoding: normalize(mapping.tokenBodyEncoding).toUpperCase(),
    queryFields: queryParams.map(({ role, fieldName }) => ({ role, fieldName })),
    bodyFields: bodyParams.map(({ role, fieldName }) => ({ role, fieldName })),
    responseFields: {
      accessToken: mapping.tokenResponseFieldNames.accessToken,
      refreshToken: mapping.tokenResponseFieldNames.refreshToken,
      expiresIn: mapping.tokenResponseFieldNames.expiresIn,
      expiresInUnit: mapping.expiresInUnit
    },
    signatureComponentRoles: baseComponents,
    signatureImplementation: runtime.signatureImplementation,
    signatureBaseSerialization: runtime.signatureBaseSerialization,
    signatureGenerated: true,
    signatureLength: signature.length,
    authorizationCodeSource: 'SYNTHETIC_PREVIEW_ONLY',
    authorizationCodeStored: false,
    authorizationCodeReturned: false,
    partnerIdValueReturned: false,
    partnerKeyValueReturned: false,
    signatureValueReturned: false,
    signatureBaseReturned: false,
    tokenValuesReturned: false,
    executableRequestReturned: false,
    secretValuesReturned: false,
    requestFingerprint,
    timestampPreview: Number(timestamp),
    canExchangeToken: false,
    canStoreTokens: false,
    sendAllowed: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    blockingReasons: [
      'This preview uses a synthetic authorization code generated only in backend memory; no real Shopee authorization code is accepted or stored.',
      'Token exchange network execution and token persistence remain disabled.'
    ]
  };
}

module.exports = { buildShopeeSgTokenExchangeRequestPreview };
