const {
  validateShopeeSgCredentialRef,
  resolveShopeeSgCredentialMetadata,
  validateSchemaVerification,
  validateAuthSchemaVerification
} = require('./shopeeSgAuthFoundationBackend');

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
 * It intentionally does not infer query parameter names or signing components from prose.
 * No signature, Partner ID value, Partner Key value, or clickable authorization URL is returned.
 */
function buildShopeeSgAuthorizationRequestPreview(input, now = Date.now()) {
  const { accountId, shopId, credentialRef } = validateTransportIdentity(input);
  const { inventorySchema, authSchema } = validateTransportSchemas(input, now);
  const authorizationEndpoint = normalize(input && input.authSchemaVerification && input.authSchemaVerification.authorizationEndpoint);

  if (!isShopeeServiceEndpoint(authorizationEndpoint)) {
    throw createError(
      'INVALID_SHOPEE_AUTHORIZATION_ENDPOINT',
      'A verified Shopee HTTPS authorization endpoint is required for the authorization-request preview.'
    );
  }

  const credentialState = resolveShopeeSgCredentialMetadata(credentialRef);
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
      status: 'REVIEW_REQUIRED',
      detail: 'Exact authorization query field names/order are not yet stored as a machine-verifiable mapping.'
    },
    {
      requirement: 'STRUCTURED_SIGNATURE_BASE_COMPONENTS',
      status: 'REVIEW_REQUIRED',
      detail: 'The signing base components are still human-reviewed text and are not parsed or guessed by the backend.'
    },
    {
      requirement: 'CALLBACK_BINDING_CONTRACT',
      status: 'REVIEW_REQUIRED',
      detail: 'The exact callback fields and seller/shop binding checks are not yet machine-structured.'
    }
  ];

  const blockingReasons = [];
  if (!credentialState.credentialConfigured) {
    blockingReasons.push('Shopee SG backend Partner ID / Partner Key configuration is incomplete.');
  }
  blockingReasons.push('Authorization query parameters are not machine-structured; the backend will not infer them from free-text notes.');
  blockingReasons.push('Signature base components are not machine-structured; no signature is generated.');
  blockingReasons.push('Callback binding is not machine-structured; authorization start remains disabled.');

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    mode: 'AUTHORIZATION_REQUEST_PREVIEW_ONLY',
    stage: 'AUTHORIZATION_REQUEST_BUILD',
    previewStatus: 'STRUCTURED_MAPPING_REQUIRED',
    accountId,
    shopId,
    credentialRef,
    inventorySchemaVerificationId: inventorySchema.verificationId,
    authSchemaVerificationId: authSchema.verificationId,
    authorizationEndpoint,
    requestMethod: 'UNVERIFIED',
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
