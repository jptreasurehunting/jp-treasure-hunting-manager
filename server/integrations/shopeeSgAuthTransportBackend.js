const {
  validateShopeeSgCredentialRef,
  resolveShopeeSgCredentialMetadata,
  validateSchemaVerification,
  validateAuthSchemaVerification
} = require('./shopeeSgAuthFoundationBackend');

const STRUCTURED_MAPPING_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const AUTHORIZATION_QUERY_ROLES = [
  'PARTNER_ID',
  'TIMESTAMP',
  'SIGNATURE',
  'REDIRECT_URI'
];
const SIGNATURE_COMPONENTS = [
  'PARTNER_ID',
  'API_PATH',
  'TIMESTAMP',
  'ACCESS_TOKEN',
  'SHOP_ID',
  'MERCHANT_ID',
  'REDIRECT_URI',
  'AUTHORIZATION_CODE'
];

function normalize(value) {
  return String(value || '').trim();
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isShopeeServiceEndpoint(value) {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (
      url.hostname === 'shopee.com' ||
      url.hostname.endsWith('.shopee.com') ||
      url.hostname === 'shopeemobile.com' ||
      url.hostname.endsWith('.shopeemobile.com')
    );
  } catch {
    return false;
  }
}

function isOfficialShopeeDocumentationUrl(value) {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (
      url.hostname === 'open.shopee.com' ||
      url.hostname.endsWith('.shopee.com')
    );
  } catch {
    return false;
  }
}

function normalizeEndpoint(value) {
  try {
    const url = new URL(normalize(value));
    url.hash = '';
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return normalize(value);
  }
}

function isSafeWireFieldName(value) {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(normalize(value));
}

function hasDuplicate(values) {
  return new Set(values).size !== values.length;
}

function hasExactRoleSet(values, allowed) {
  if (!Array.isArray(values) || values.length !== allowed.length || hasDuplicate(values)) return false;
  const allowedSet = new Set(allowed);
  return values.every((value) => allowedSet.has(value));
}

function validateTransportIdentity(input) {
  const accountId = normalize(input && input.accountId);
  const shopId = normalize(input && input.shopId);
  const credentialRef = validateShopeeSgCredentialRef(input && input.credentialRef);

  if (!accountId) {
    throw createError('MISSING_SHOPEE_ACCOUNT_ID', 'Shopee Singapore seller account ID is required.');
  }
  if (!/^[1-9]\d*$/.test(shopId)) {
    throw createError('INVALID_SHOPEE_SHOP_ID', 'Shopee Singapore shop ID must be a positive integer identifier.');
  }

  return { accountId, shopId, credentialRef };
}

function validateTransportSchemas(input, now) {
  const inventorySchema = validateSchemaVerification(input && input.schemaVerification, now);
  const authSchema = validateAuthSchemaVerification(input && input.authSchemaVerification, now);
  if (!authSchema) {
    throw createError(
      'MISSING_SHOPEE_AUTH_SCHEMA_VERIFICATION',
      'A fresh current-Singapore Shopee auth schema verification is required before an auth transport contract can be prepared.'
    );
  }
  return { inventorySchema, authSchema };
}

function validateStructuredAuthorizationMapping(mapping, authSchema, rawAuthSchema, now) {
  if (!mapping || typeof mapping !== 'object') return null;

  const mappingId = normalize(mapping.mappingId);
  const status = normalize(mapping.status);
  const region = normalize(mapping.marketplaceRegion);
  const authSchemaVerificationId = normalize(mapping.authSchemaVerificationId);
  const officialSourceUrl = normalize(mapping.officialSourceUrl);
  const authorizationEndpoint = normalize(mapping.authorizationEndpoint);
  const authorizationHttpMethod = normalize(mapping.authorizationHttpMethod).toUpperCase();
  const signatureAlgorithm = normalize(mapping.signatureAlgorithm);
  const checkedAt = normalize(mapping.checkedAt);
  const expectedAuthorizationEndpoint = normalize(rawAuthSchema && rawAuthSchema.authorizationEndpoint);

  if (
    !mappingId ||
    status !== 'STRUCTURED_AUTH_MAPPING_VERIFIED' ||
    region !== 'SG' ||
    authSchemaVerificationId !== authSchema.verificationId
  ) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Shopee SG structured auth mapping must be verified, Singapore-scoped, and bound to the current auth schema verification.'
    );
  }
  if (!isOfficialShopeeDocumentationUrl(officialSourceUrl)) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Shopee SG structured auth mapping must reference an official Shopee HTTPS documentation source.'
    );
  }
  if (
    !isShopeeServiceEndpoint(authorizationEndpoint) ||
    !isShopeeServiceEndpoint(expectedAuthorizationEndpoint) ||
    normalizeEndpoint(authorizationEndpoint) !== normalizeEndpoint(expectedAuthorizationEndpoint)
  ) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Shopee SG structured auth mapping authorization endpoint must match the current verified auth schema endpoint.'
    );
  }
  if (authorizationHttpMethod !== 'GET' && authorizationHttpMethod !== 'POST') {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Shopee SG structured auth mapping HTTP method must be GET or POST.'
    );
  }

  const queryFields = mapping.authorizationQueryFieldNames;
  if (!queryFields || typeof queryFields !== 'object') {
    throw createError('INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING', 'Structured authorization query field mapping is required.');
  }
  const normalizedQueryFields = {
    partnerId: normalize(queryFields.partnerId),
    timestamp: normalize(queryFields.timestamp),
    signature: normalize(queryFields.signature),
    redirectUri: normalize(queryFields.redirectUri)
  };
  const queryFieldValues = Object.values(normalizedQueryFields);
  if (queryFieldValues.some((value) => !isSafeWireFieldName(value)) || hasDuplicate(queryFieldValues)) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Structured authorization query wire names must be safe and unique.'
    );
  }

  const authorizationQueryOrder = Array.isArray(mapping.authorizationQueryOrder)
    ? mapping.authorizationQueryOrder.map((value) => normalize(value).toUpperCase())
    : [];
  if (!hasExactRoleSet(authorizationQueryOrder, AUTHORIZATION_QUERY_ROLES)) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Structured authorization query order must contain each supported semantic role exactly once.'
    );
  }

  const signatureBaseComponents = Array.isArray(mapping.signatureBaseComponents)
    ? mapping.signatureBaseComponents.map((value) => normalize(value).toUpperCase())
    : [];
  if (
    !signatureAlgorithm ||
    signatureAlgorithm.length > 80 ||
    signatureBaseComponents.length < 1 ||
    signatureBaseComponents.length > 8 ||
    hasDuplicate(signatureBaseComponents) ||
    signatureBaseComponents.some((value) => !SIGNATURE_COMPONENTS.includes(value))
  ) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Structured signature algorithm and base components must be explicitly supported and non-duplicated.'
    );
  }

  const callbackFields = mapping.callbackFieldNames;
  if (!callbackFields || typeof callbackFields !== 'object') {
    throw createError('INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING', 'Structured callback field mapping is required.');
  }
  const normalizedCallbackFields = {
    authorizationCode: normalize(callbackFields.authorizationCode),
    shopId: normalize(callbackFields.shopId)
  };
  const callbackValues = Object.values(normalizedCallbackFields);
  if (callbackValues.some((value) => !isSafeWireFieldName(value)) || hasDuplicate(callbackValues)) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Structured callback wire names must be safe and unique.'
    );
  }

  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs > now || now - checkedAtMs > STRUCTURED_MAPPING_MAX_AGE_MS) {
    throw createError(
      'STALE_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Shopee SG structured auth mapping is missing, future-dated, or older than 90 days.'
    );
  }
  if (
    mapping.currentSingaporeApplicabilityConfirmed !== true ||
    mapping.externalNetworkAllowed !== false ||
    mapping.externalWriteAllowed !== false ||
    mapping.secretsStored !== false
  ) {
    throw createError(
      'INVALID_SHOPEE_STRUCTURED_AUTH_MAPPING',
      'Structured auth mapping must confirm current Singapore applicability and must not grant network/write permission or store secrets.'
    );
  }

  return {
    mappingId,
    authSchemaVerificationId,
    officialSourceUrl,
    authorizationEndpoint,
    authorizationHttpMethod,
    authorizationQueryFieldNames: normalizedQueryFields,
    authorizationQueryOrder,
    signatureAlgorithm,
    signatureBaseComponents,
    callbackFieldNames: normalizedCallbackFields,
    checkedAt: new Date(checkedAtMs).toISOString()
  };
}

function buildAuthorizationQueryTemplate(mapping) {
  const roleMap = {
    PARTNER_ID: {
      fieldName: mapping.authorizationQueryFieldNames.partnerId,
      valueSource: 'BACKEND_PARTNER_ID'
    },
    TIMESTAMP: {
      fieldName: mapping.authorizationQueryFieldNames.timestamp,
      valueSource: 'CURRENT_UNIX_TIMESTAMP'
    },
    SIGNATURE: {
      fieldName: mapping.authorizationQueryFieldNames.signature,
      valueSource: 'BACKEND_GENERATED_SIGNATURE'
    },
    REDIRECT_URI: {
      fieldName: mapping.authorizationQueryFieldNames.redirectUri,
      valueSource: 'BACKEND_CONFIGURED_REDIRECT_URI'
    }
  };

  return mapping.authorizationQueryOrder.map((role) => ({
    role,
    fieldName: roleMap[role].fieldName,
    valueSource: roleMap[role].valueSource
  }));
}

function buildShopeeSgAuthTransportPlan(input, now = Date.now()) {
  const { accountId, shopId, credentialRef } = validateTransportIdentity(input);
  const { inventorySchema, authSchema } = validateTransportSchemas(input, now);

  const credentialState = resolveShopeeSgCredentialMetadata(credentialRef);
  const blockingReasons = [];
  if (!credentialState.credentialConfigured) {
    blockingReasons.push('Shopee SG backend Partner ID / Partner Key configuration is incomplete.');
  }
  blockingReasons.push('Authorization-request generation is intentionally not implemented in this contract-only layer.');
  blockingReasons.push('Authorization callback validation and authorization-code/token exchange are intentionally not implemented.');
  blockingReasons.push('Token refresh and authenticated API request signing are intentionally not implemented.');
  blockingReasons.push('No Shopee external network request or inventory write can be executed from this contract.');

  const stages = [
    {
      stage: 'AUTHORIZATION_REQUEST_BUILD',
      status: 'NOT_IMPLEMENTED',
      networkAllowed: false,
      secretsRequiredInBrowser: false,
      description: 'Future backend-only construction of the verified current-SG Shopee authorization request.'
    },
    {
      stage: 'AUTHORIZATION_CALLBACK_VALIDATE',
      status: 'NOT_IMPLEMENTED',
      networkAllowed: false,
      secretsRequiredInBrowser: false,
      description: 'Future callback validation and seller/shop binding checks.'
    },
    {
      stage: 'TOKEN_EXCHANGE',
      status: 'NOT_IMPLEMENTED',
      networkAllowed: false,
      secretsRequiredInBrowser: false,
      description: 'Future backend-only token exchange using Secret Store credentials.'
    },
    {
      stage: 'TOKEN_REFRESH',
      status: 'NOT_IMPLEMENTED',
      networkAllowed: false,
      secretsRequiredInBrowser: false,
      description: 'Future backend-only refresh flow with token values kept outside the browser.'
    },
    {
      stage: 'AUTHENTICATED_REQUEST_SIGNING',
      status: 'NOT_IMPLEMENTED',
      networkAllowed: false,
      secretsRequiredInBrowser: false,
      description: 'Future backend-only request signing after the exact verified SG signing rule is implemented.'
    },
    {
      stage: 'API_EXECUTION',
      status: 'NOT_IMPLEMENTED',
      networkAllowed: false,
      secretsRequiredInBrowser: false,
      description: 'Future external API execution behind a separate explicit execution/write gate.'
    }
  ];

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    accountId,
    shopId,
    credentialRef,
    inventorySchemaVerificationId: inventorySchema.verificationId,
    authSchemaVerificationId: authSchema.verificationId,
    transportImplementationStatus: 'CONTRACT_ONLY',
    credentialState: {
      partnerIdConfigured: credentialState.partnerIdConfigured,
      partnerKeyConfigured: credentialState.partnerKeyConfigured,
      credentialConfigured: credentialState.credentialConfigured
    },
    stages,
    canGenerateAuthorizationRequest: false,
    canReceiveAuthorizationCallback: false,
    canExchangeToken: false,
    canRefreshToken: false,
    canSignApiRequest: false,
    canExecuteApi: false,
    canWriteInventory: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    secretValuesReturned: false,
    requiresSeparateExecutionApproval: true,
    blockingReasons
  };
}

/**
 * Produces only a non-executable preview of the first Shopee SG auth stage.
 * Free-text schema notes are never parsed into executable request fields.
 * Even with a verified structured mapping, no signature, secret value, or clickable authorization URL is returned.
 */
function buildShopeeSgAuthorizationRequestPreview(input, now = Date.now()) {
  const { accountId, shopId, credentialRef } = validateTransportIdentity(input);
  const { inventorySchema, authSchema } = validateTransportSchemas(input, now);
  const rawAuthSchema = input && input.authSchemaVerification;
  const authorizationEndpoint = normalize(rawAuthSchema && rawAuthSchema.authorizationEndpoint);

  if (!isShopeeServiceEndpoint(authorizationEndpoint)) {
    throw createError(
      'INVALID_SHOPEE_AUTHORIZATION_ENDPOINT',
      'A verified Shopee HTTPS authorization endpoint is required for the authorization-request preview.'
    );
  }

  const structuredMapping = validateStructuredAuthorizationMapping(
    input && input.structuredAuthorizationMapping,
    authSchema,
    rawAuthSchema,
    now
  );
  const credentialState = resolveShopeeSgCredentialMetadata(credentialRef);
  const mappingVerified = Boolean(structuredMapping);

  const requirements = [
    {
      requirement: 'CURRENT_SG_AUTH_SCHEMA',
      status: 'VERIFIED',
      detail: 'Fresh current-Singapore auth schema verification is present.'
    },
    {
      requirement: 'AUTHORIZATION_ENDPOINT',
      status: 'VERIFIED',
      detail: 'A Shopee HTTPS authorization endpoint is present in the verified record.'
    },
    {
      requirement: 'BACKEND_PARTNER_ID',
      status: credentialState.partnerIdConfigured ? 'CONFIGURED' : 'MISSING',
      detail: 'Partner ID value remains backend-only and is not returned in this preview.'
    },
    {
      requirement: 'BACKEND_PARTNER_KEY',
      status: credentialState.partnerKeyConfigured ? 'CONFIGURED' : 'MISSING',
      detail: 'Partner Key remains backend-only and is never returned to the browser.'
    },
    {
      requirement: 'STRUCTURED_AUTHORIZATION_QUERY_MAPPING',
      status: mappingVerified ? 'VERIFIED' : 'REVIEW_REQUIRED',
      detail: mappingVerified
        ? 'Exact authorization wire field names and explicit query-role order are machine-structured.'
        : 'Exact authorization query field names/order are not yet stored as a machine-verifiable mapping.'
    },
    {
      requirement: 'STRUCTURED_SIGNATURE_BASE_COMPONENTS',
      status: mappingVerified ? 'VERIFIED' : 'REVIEW_REQUIRED',
      detail: mappingVerified
        ? 'Signature algorithm label and base-component order are machine-structured without secret values.'
        : 'The signing base components are still human-reviewed text and are not parsed or guessed by the backend.'
    },
    {
      requirement: 'CALLBACK_BINDING_CONTRACT',
      status: mappingVerified ? 'VERIFIED' : 'REVIEW_REQUIRED',
      detail: mappingVerified
        ? 'Authorization-code and shop-ID callback wire names are machine-structured.'
        : 'The exact callback fields and seller/shop binding checks are not yet machine-structured.'
    }
  ];

  const blockingReasons = [];
  if (!credentialState.credentialConfigured) {
    blockingReasons.push('Shopee SG backend Partner ID / Partner Key configuration is incomplete.');
  }
  if (!mappingVerified) {
    blockingReasons.push('Authorization query parameters are not machine-structured; the backend will not infer them from free-text notes.');
    blockingReasons.push('Signature base components are not machine-structured; no signature is generated.');
    blockingReasons.push('Callback binding is not machine-structured; authorization start remains disabled.');
  } else {
    blockingReasons.push('Structured mapping is verified, but backend redirect-URI configuration and signature generation are not implemented in this preview-only stage.');
    blockingReasons.push('Authorization start remains disabled until a separate execution gate explicitly permits external navigation/network action.');
  }

  let apiPath = null;
  if (structuredMapping) {
    apiPath = new URL(structuredMapping.authorizationEndpoint).pathname;
  }

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    mode: 'AUTHORIZATION_REQUEST_PREVIEW_ONLY',
    stage: 'AUTHORIZATION_REQUEST_BUILD',
    previewStatus: mappingVerified ? 'STRUCTURED_MAPPING_VERIFIED' : 'STRUCTURED_MAPPING_REQUIRED',
    accountId,
    shopId,
    credentialRef,
    inventorySchemaVerificationId: inventorySchema.verificationId,
    authSchemaVerificationId: authSchema.verificationId,
    structuredMappingId: structuredMapping ? structuredMapping.mappingId : null,
    authorizationEndpoint,
    requestMethod: structuredMapping ? structuredMapping.authorizationHttpMethod : 'UNVERIFIED',
    queryTemplate: structuredMapping ? buildAuthorizationQueryTemplate(structuredMapping) : null,
    signatureTemplate: structuredMapping ? {
      algorithm: structuredMapping.signatureAlgorithm,
      baseComponents: structuredMapping.signatureBaseComponents,
      apiPath
    } : null,
    callbackTemplate: structuredMapping ? {
      authorizationCodeField: structuredMapping.callbackFieldNames.authorizationCode,
      shopIdField: structuredMapping.callbackFieldNames.shopId
    } : null,
    executableAuthorizationUrl: null,
    signatureValue: null,
    partnerIdValueReturned: false,
    partnerKeyValueReturned: false,
    secretValuesReturned: false,
    credentialState: {
      partnerIdConfigured: credentialState.partnerIdConfigured,
      partnerKeyConfigured: credentialState.partnerKeyConfigured,
      credentialConfigured: credentialState.credentialConfigured
    },
    requirements,
    canGenerateAuthorizationRequest: false,
    canStartAuthorization: false,
    sendAllowed: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    requiresSeparateExecutionApproval: true,
    blockingReasons
  };
}

module.exports = {
  buildShopeeSgAuthTransportPlan,
  buildShopeeSgAuthorizationRequestPreview
};
