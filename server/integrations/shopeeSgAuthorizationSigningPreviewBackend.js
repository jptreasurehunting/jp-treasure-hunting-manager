const crypto = require('crypto');
const { buildShopeeSgAuthorizationRequestPreview } = require('./shopeeSgAuthTransportBackend');

const RUNTIME_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const SUPPORTED_SIGNATURE_IMPLEMENTATIONS = new Set(['HMAC_SHA256_HEX', 'HMAC_SHA256_BASE64']);
const SUPPORTED_BASE_SERIALIZATIONS = new Set(['CONCAT_NO_SEPARATOR', 'COLON_SEPARATOR']);
const AUTHORIZATION_STAGE_COMPONENTS = new Set(['PARTNER_ID', 'API_PATH', 'TIMESTAMP', 'REDIRECT_URI', 'SHOP_ID']);

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

function validateRedirectUri(value) {
  const redirectUri = normalize(value);
  if (!redirectUri) return null;
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'https:') {
      throw createError('INVALID_SHOPEE_REDIRECT_URI', 'Shopee SG backend Redirect URI must use HTTPS.');
    }
    if (url.username || url.password || url.hash) {
      throw createError('INVALID_SHOPEE_REDIRECT_URI', 'Shopee SG backend Redirect URI must not contain credentials or a URL fragment.');
    }
    return url.toString();
  } catch (error) {
    if (error && error.code === 'INVALID_SHOPEE_REDIRECT_URI') throw error;
    throw createError('INVALID_SHOPEE_REDIRECT_URI', 'Shopee SG backend Redirect URI must be a valid absolute HTTPS URL.');
  }
}

function validateSigningRuntimeMapping(runtime, authorizationPreview, now) {
  if (!runtime || typeof runtime !== 'object') {
    throw createError('MISSING_SHOPEE_SIGNING_RUNTIME', 'A verified Shopee SG signing runtime mapping is required.');
  }

  const runtimeVerificationId = normalize(runtime.runtimeVerificationId);
  const status = normalize(runtime.status);
  const marketplaceRegion = normalize(runtime.marketplaceRegion);
  const structuredMappingId = normalize(runtime.structuredMappingId);
  const authSchemaVerificationId = normalize(runtime.authSchemaVerificationId);
  const officialSourceUrl = normalize(runtime.officialSourceUrl);
  const signatureAlgorithmLabel = normalize(runtime.signatureAlgorithmLabel);
  const signatureImplementation = normalize(runtime.signatureImplementation).toUpperCase();
  const signatureBaseSerialization = normalize(runtime.signatureBaseSerialization).toUpperCase();
  const redirectUriSource = normalize(runtime.redirectUriSource).toUpperCase();
  const checkedAt = normalize(runtime.checkedAt);

  if (!runtimeVerificationId || status !== 'SIGNING_RUNTIME_VERIFIED' || marketplaceRegion !== 'SG') {
    throw createError('INVALID_SHOPEE_SIGNING_RUNTIME', 'Shopee SG signing runtime mapping must be verified and Singapore-scoped.');
  }
  if (
    structuredMappingId !== authorizationPreview.structuredMappingId ||
    authSchemaVerificationId !== authorizationPreview.authSchemaVerificationId
  ) {
    throw createError('INVALID_SHOPEE_SIGNING_RUNTIME', 'Shopee SG signing runtime mapping must match the current structured mapping and auth schema verification.');
  }
  if (!isOfficialShopeeDocumentationUrl(officialSourceUrl)) {
    throw createError('INVALID_SHOPEE_SIGNING_RUNTIME', 'Shopee SG signing runtime mapping must reference an official Shopee HTTPS documentation source.');
  }
  if (!authorizationPreview.signatureTemplate || signatureAlgorithmLabel !== authorizationPreview.signatureTemplate.algorithm) {
    throw createError('INVALID_SHOPEE_SIGNING_RUNTIME', 'Shopee SG signing runtime algorithm label must exactly match the verified structured mapping.');
  }
  if (!SUPPORTED_SIGNATURE_IMPLEMENTATIONS.has(signatureImplementation)) {
    throw createError('UNSUPPORTED_SHOPEE_SIGNATURE_IMPLEMENTATION', 'Shopee SG signing runtime selected a signature implementation that this backend does not explicitly support.');
  }
  if (!SUPPORTED_BASE_SERIALIZATIONS.has(signatureBaseSerialization)) {
    throw createError('UNSUPPORTED_SHOPEE_SIGNATURE_SERIALIZATION', 'Shopee SG signing runtime selected a base-string serialization that this backend does not explicitly support.');
  }
  if (redirectUriSource !== 'BACKEND_ENV') {
    throw createError('INVALID_SHOPEE_SIGNING_RUNTIME', 'Shopee SG Redirect URI must come from backend environment configuration.');
  }
  if (
    runtime.currentSingaporeApplicabilityConfirmed !== true ||
    runtime.externalNetworkAllowed !== false ||
    runtime.externalWriteAllowed !== false ||
    runtime.secretValuesStored !== false
  ) {
    throw createError('INVALID_SHOPEE_SIGNING_RUNTIME', 'Shopee SG signing runtime must not grant network/write permission or store secret values.');
  }

  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs > now || now - checkedAtMs > RUNTIME_MAX_AGE_MS) {
    throw createError('STALE_SHOPEE_SIGNING_RUNTIME', 'Shopee SG signing runtime verification is missing, future-dated, or older than 90 days.');
  }

  return {
    runtimeVerificationId,
    structuredMappingId,
    authSchemaVerificationId,
    officialSourceUrl,
    signatureAlgorithmLabel,
    signatureImplementation,
    signatureBaseSerialization,
    redirectUriSource,
    checkedAt: new Date(checkedAtMs).toISOString()
  };
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

function buildShopeeSgAuthorizationSigningPreview(input, now = Date.now()) {
  const authorizationPreview = buildShopeeSgAuthorizationRequestPreview(input, now);
  if (authorizationPreview.previewStatus !== 'STRUCTURED_MAPPING_VERIFIED' || !authorizationPreview.signatureTemplate) {
    throw createError('SHOPEE_STRUCTURED_MAPPING_REQUIRED', 'A verified Shopee SG structured authorization mapping is required before signing preview.');
  }

  const runtime = validateSigningRuntimeMapping(input && input.signingRuntimeVerification, authorizationPreview, now);
  const credentialRef = authorizationPreview.credentialRef;
  const partnerId = normalize(process.env[`${credentialRef}_PARTNER_ID`]);
  const partnerKey = normalize(process.env[`${credentialRef}_PARTNER_KEY`]);
  const redirectUriRaw = normalize(process.env[`${credentialRef}_REDIRECT_URI`]);
  const redirectUri = redirectUriRaw ? validateRedirectUri(redirectUriRaw) : null;

  const runtimeConfigState = {
    partnerIdConfigured: Boolean(partnerId),
    partnerKeyConfigured: Boolean(partnerKey),
    redirectUriConfigured: Boolean(redirectUri),
    complete: Boolean(partnerId && partnerKey && redirectUri)
  };

  const timestamp = Math.floor(now / 1000).toString();
  const valueByComponent = {
    PARTNER_ID: partnerId,
    API_PATH: authorizationPreview.signatureTemplate.apiPath,
    TIMESTAMP: timestamp,
    REDIRECT_URI: redirectUri || '',
    SHOP_ID: authorizationPreview.shopId
  };

  const unresolvedComponents = authorizationPreview.signatureTemplate.baseComponents.filter(
    (component) => !AUTHORIZATION_STAGE_COMPONENTS.has(component) || !normalize(valueByComponent[component])
  );

  let signatureGenerated = false;
  let signatureLength = null;
  if (runtimeConfigState.complete && unresolvedComponents.length === 0) {
    const componentValues = authorizationPreview.signatureTemplate.baseComponents.map((component) => valueByComponent[component]);
    const baseString = serializeSignatureBase(componentValues, runtime.signatureBaseSerialization);
    const signature = createSignature(baseString, partnerKey, runtime.signatureImplementation);
    signatureGenerated = signature.length > 0;
    signatureLength = signature.length;
  }

  const blockingReasons = [];
  if (!runtimeConfigState.partnerIdConfigured) blockingReasons.push('Backend Partner ID is not configured.');
  if (!runtimeConfigState.partnerKeyConfigured) blockingReasons.push('Backend Partner Key is not configured.');
  if (!runtimeConfigState.redirectUriConfigured) blockingReasons.push('Backend Redirect URI is not configured.');
  if (unresolvedComponents.length > 0) {
    blockingReasons.push(`Authorization-stage signature has unresolved components: ${unresolvedComponents.join(', ')}.`);
  }
  blockingReasons.push('External Shopee authorization navigation/network action remains disabled in preview mode.');
  blockingReasons.push('Authorization callback and token exchange are not implemented in this stage.');

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    mode: 'AUTHORIZATION_SIGNING_PREVIEW_ONLY',
    accountId: authorizationPreview.accountId,
    shopId: authorizationPreview.shopId,
    credentialRef,
    authSchemaVerificationId: authorizationPreview.authSchemaVerificationId,
    structuredMappingId: authorizationPreview.structuredMappingId,
    runtimeVerificationId: runtime.runtimeVerificationId,
    authorizationEndpoint: authorizationPreview.authorizationEndpoint,
    requestMethod: authorizationPreview.requestMethod,
    redirectUriPreview: redirectUri,
    redirectUriSource: 'BACKEND_ENV',
    timestampPreview: Number(timestamp),
    signatureImplementation: runtime.signatureImplementation,
    signatureBaseSerialization: runtime.signatureBaseSerialization,
    signatureComponentRoles: authorizationPreview.signatureTemplate.baseComponents,
    signatureGenerated,
    signatureLength,
    signatureValueReturned: false,
    signatureBaseReturned: false,
    partnerIdValueReturned: false,
    partnerKeyValueReturned: false,
    secretValuesReturned: false,
    authorizationUrlReturned: false,
    runtimeConfigState,
    unresolvedComponents,
    queryTemplate: authorizationPreview.queryTemplate,
    callbackTemplate: authorizationPreview.callbackTemplate,
    canPrepareSignedAuthorizationRequest: signatureGenerated,
    canStartAuthorization: false,
    canReceiveAuthorizationCallback: false,
    canExchangeToken: false,
    sendAllowed: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    requiresSeparateExecutionApproval: true,
    blockingReasons
  };
}

module.exports = {
  buildShopeeSgAuthorizationSigningPreview
};
