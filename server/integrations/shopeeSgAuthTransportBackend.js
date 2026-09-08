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

function buildShopeeSgAuthTransportPlan(input, now = Date.now()) {
  const accountId = normalize(input && input.accountId);
  const shopId = normalize(input && input.shopId);
  const credentialRef = validateShopeeSgCredentialRef(input && input.credentialRef);

  if (!accountId) {
    throw createError('MISSING_SHOPEE_ACCOUNT_ID', 'Shopee Singapore seller account ID is required.');
  }
  if (!/^[1-9]\d*$/.test(shopId)) {
    throw createError('INVALID_SHOPEE_SHOP_ID', 'Shopee Singapore shop ID must be a positive integer identifier.');
  }

  const inventorySchema = validateSchemaVerification(input && input.schemaVerification, now);
  const authSchema = validateAuthSchemaVerification(input && input.authSchemaVerification, now);
  if (!authSchema) {
    throw createError(
      'MISSING_SHOPEE_AUTH_SCHEMA_VERIFICATION',
      'A fresh current-Singapore Shopee auth schema verification is required before an auth transport contract can be prepared.'
    );
  }

  const credentialState = resolveShopeeSgCredentialMetadata(credentialRef);
  const blockingReasons = [];
  if (!credentialState.credentialConfigured) {
    blockingReasons.push('Shopee SG backend Partner ID / Partner Key configuration is incomplete.');
  }
  blockingReasons.push('Authorization-request generation is intentionally not implemented in this contract-only layer.');
  blockingReasons.push('OAuth-style callback handling and authorization-code/token exchange are intentionally not implemented.');
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

module.exports = {
  buildShopeeSgAuthTransportPlan
};
