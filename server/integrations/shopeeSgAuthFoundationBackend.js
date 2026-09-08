const SCHEMA_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

function normalize(value) {
  return String(value || '').trim();
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateShopeeSgCredentialRef(value) {
  const credentialRef = normalize(value);
  if (!/^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(credentialRef)) {
    throw createError(
      'INVALID_SHOPEE_CREDENTIAL_REF',
      'Shopee Singapore credential reference must use an uppercase backend prefix such as SHOPEE_SG_MAIN.'
    );
  }
  return credentialRef;
}

function resolveShopeeSgCredentialMetadata(value) {
  const credentialRef = validateShopeeSgCredentialRef(value);
  const partnerIdConfigured = normalize(process.env[`${credentialRef}_PARTNER_ID`]).length > 0;
  const partnerKeyConfigured = normalize(process.env[`${credentialRef}_PARTNER_KEY`]).length > 0;

  return {
    credentialRef,
    partnerIdConfigured,
    partnerKeyConfigured,
    credentialConfigured: partnerIdConfigured && partnerKeyConfigured
  };
}

function isOfficialShopeeHttpsUrl(value) {
  try {
    const url = new URL(normalize(value));
    return url.protocol === 'https:' && (url.hostname === 'open.shopee.com' || url.hostname.endsWith('.shopee.com'));
  } catch {
    return false;
  }
}

function validateSchemaVerification(schemaVerification, now = Date.now()) {
  if (!schemaVerification || typeof schemaVerification !== 'object') {
    throw createError('INVALID_SHOPEE_SCHEMA_VERIFICATION', 'Shopee SG official inventory schema verification is required.');
  }

  const verificationId = normalize(schemaVerification.verificationId);
  const status = normalize(schemaVerification.status);
  const officialSourceUrl = normalize(schemaVerification.officialSourceUrl);
  const checkedAt = normalize(schemaVerification.checkedAt);

  if (!verificationId || status !== 'OFFICIAL_SCHEMA_VERIFIED') {
    throw createError('INVALID_SHOPEE_SCHEMA_VERIFICATION', 'Shopee SG inventory schema verification must be OFFICIAL_SCHEMA_VERIFIED.');
  }
  if (!isOfficialShopeeHttpsUrl(officialSourceUrl)) {
    throw createError('INVALID_SHOPEE_SCHEMA_VERIFICATION', 'Shopee SG schema verification must reference an official Shopee HTTPS source.');
  }
  if (schemaVerification.externalWriteAllowed !== false) {
    throw createError('INVALID_SHOPEE_SCHEMA_VERIFICATION', 'Schema verification must not itself grant external write permission.');
  }

  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs > now || now - checkedAtMs > SCHEMA_MAX_AGE_MS) {
    throw createError('STALE_SHOPEE_SCHEMA_VERIFICATION', 'Shopee SG inventory schema verification is missing, future-dated, or older than 90 days.');
  }

  return {
    verificationId,
    status: 'OFFICIAL_SCHEMA_VERIFIED',
    officialSourceUrl,
    checkedAt: new Date(checkedAtMs).toISOString()
  };
}

function validateAuthSchemaVerification(authSchemaVerification, now = Date.now()) {
  if (!authSchemaVerification) return null;
  if (typeof authSchemaVerification !== 'object') {
    throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Shopee SG auth schema verification must be a structured record.');
  }

  const verificationId = normalize(authSchemaVerification.verificationId);
  const status = normalize(authSchemaVerification.status);
  const officialSourceUrl = normalize(authSchemaVerification.officialSourceUrl);
  const checkedAt = normalize(authSchemaVerification.checkedAt);

  if (!verificationId || status !== 'OFFICIAL_AUTH_SCHEMA_VERIFIED') {
    throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Shopee SG auth schema verification must be OFFICIAL_AUTH_SCHEMA_VERIFIED.');
  }
  if (!isOfficialShopeeHttpsUrl(officialSourceUrl)) {
    throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Shopee SG auth schema verification must reference an official Shopee HTTPS source.');
  }
  if (authSchemaVerification.currentSingaporeApplicabilityConfirmed !== true) {
    throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Shopee SG auth schema verification must confirm current Singapore applicability.');
  }
  if (authSchemaVerification.externalNetworkAllowed !== false || authSchemaVerification.externalWriteAllowed !== false) {
    throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Auth schema verification must not itself grant external network or write permission.');
  }
  if (authSchemaVerification.secretsStored !== false) {
    throw createError('INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Auth schema verification must not contain or claim to store secret values.');
  }

  const checkedAtMs = Date.parse(checkedAt);
  if (!Number.isFinite(checkedAtMs) || checkedAtMs > now || now - checkedAtMs > SCHEMA_MAX_AGE_MS) {
    throw createError('STALE_SHOPEE_AUTH_SCHEMA_VERIFICATION', 'Shopee SG auth schema verification is missing, future-dated, or older than 90 days.');
  }

  return {
    verificationId,
    status: 'OFFICIAL_AUTH_SCHEMA_VERIFIED',
    officialSourceUrl,
    checkedAt: new Date(checkedAtMs).toISOString(),
    currentSingaporeApplicabilityConfirmed: true
  };
}

function getShopeeSgAuthReadiness(input, now = Date.now()) {
  const accountId = normalize(input && input.accountId);
  const shopId = normalize(input && input.shopId);
  const credentialRef = validateShopeeSgCredentialRef(input && input.credentialRef);

  if (!accountId) {
    throw createError('MISSING_SHOPEE_ACCOUNT_ID', 'Shopee Singapore seller account ID is required.');
  }
  if (!/^[1-9]\d*$/.test(shopId)) {
    throw createError('INVALID_SHOPEE_SHOP_ID', 'Shopee Singapore shop ID must be a positive integer identifier.');
  }

  const schema = validateSchemaVerification(input && input.schemaVerification, now);
  const authSchema = validateAuthSchemaVerification(input && input.authSchemaVerification, now);
  const credentialState = resolveShopeeSgCredentialMetadata(credentialRef);
  const networkFlagConfigured = process.env.SHOPEE_SG_NETWORK_ENABLED === 'true';
  const blockingReasons = [];

  if (!credentialState.credentialConfigured) {
    blockingReasons.push('Shopee SG backend Partner ID / Partner Key configuration is incomplete.');
  }
  if (!authSchema) {
    blockingReasons.push('Current Singapore Shopee Open Platform authorization, token, and request-signature schema still requires official verification.');
  }
  blockingReasons.push('Shopee authorization start, callback/token exchange, token refresh, and API request signing transport are not implemented in this foundation.');
  if (networkFlagConfigured) {
    blockingReasons.push('SHOPEE_SG_NETWORK_ENABLED is set, but network execution remains disabled because no approved Shopee auth transport exists.');
  } else {
    blockingReasons.push('Shopee SG network execution is disabled.');
  }

  return {
    success: true,
    marketplace: 'Shopee',
    marketplaceRegion: 'SG',
    accountId,
    shopId,
    credentialRef,
    credentialState: {
      partnerIdConfigured: credentialState.partnerIdConfigured,
      partnerKeyConfigured: credentialState.partnerKeyConfigured,
      credentialConfigured: credentialState.credentialConfigured
    },
    inventorySchemaVerificationId: schema.verificationId,
    inventorySchemaStatus: schema.status,
    inventorySchemaCheckedAt: schema.checkedAt,
    authSchemaVerificationId: authSchema ? authSchema.verificationId : null,
    authSchemaStatus: authSchema ? authSchema.status : 'OFFICIAL_AUTH_SCHEMA_REVIEW_REQUIRED',
    authSchemaCheckedAt: authSchema ? authSchema.checkedAt : null,
    networkFlagConfigured,
    canStartAuthorization: false,
    canExecuteApi: false,
    canWriteInventory: false,
    networkAction: 'NONE',
    externalWritePerformed: false,
    secretValuesReturned: false,
    blockingReasons
  };
}

module.exports = {
  SCHEMA_MAX_AGE_MS,
  validateShopeeSgCredentialRef,
  resolveShopeeSgCredentialMetadata,
  validateSchemaVerification,
  validateAuthSchemaVerification,
  getShopeeSgAuthReadiness
};
