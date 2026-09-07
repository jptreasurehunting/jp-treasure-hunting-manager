const crypto = require('crypto');
const TokenVault = require('../security/tokenVault');

const SANDBOX_AUTHORIZATION_ENDPOINT = 'https://auth.sandbox.ebay.com/oauth2/authorize';
const SANDBOX_TOKEN_ENDPOINT = 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';
const SANDBOX_API_BASE_URL = 'https://api.sandbox.ebay.com';
const INVENTORY_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.inventory';
const STATE_TTL_MS = 10 * 60 * 1000;

const pendingStates = new Map();

function normalize(value) {
  return String(value || '').trim();
}

function createError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function validateCredentialRef(credentialRef) {
  const normalized = normalize(credentialRef);
  if (!/^[A-Z][A-Z0-9_]{2,80}$/.test(normalized)) {
    throw createError(
      'INVALID_CREDENTIAL_REF',
      'Credential reference must be an uppercase environment-variable prefix such as EBAY_SANDBOX_MAIN.'
    );
  }
  return normalized;
}

function resolveSandboxCredential(credentialRef) {
  const prefix = validateCredentialRef(credentialRef);
  const clientId = normalize(process.env[`${prefix}_CLIENT_ID`]);
  const clientSecret = normalize(process.env[`${prefix}_CLIENT_SECRET`]);
  const ruName = normalize(process.env[`${prefix}_RUNAME`]);

  if (!clientId || !clientSecret || !ruName) {
    throw createError(
      'CREDENTIAL_NOT_CONFIGURED',
      `Sandbox OAuth credential reference ${prefix} is not fully configured in the backend environment.`
    );
  }

  return { prefix, clientId, clientSecret, ruName };
}

function assertSandboxNetworkEnabled() {
  if (process.env.EBAY_SANDBOX_NETWORK_ENABLED !== 'true') {
    throw createError(
      'SANDBOX_NETWORK_DISABLED',
      'Sandbox network execution is disabled. Set EBAY_SANDBOX_NETWORK_ENABLED=true only when an approved Sandbox test is ready.'
    );
  }
}

function issueOAuthState(accountId, credentialRef, now = Date.now()) {
  const normalizedAccountId = normalize(accountId);
  const normalizedCredentialRef = validateCredentialRef(credentialRef);
  if (!normalizedAccountId) {
    throw createError('MISSING_ACCOUNT_ID', 'Account ID is required.');
  }

  const state = crypto.randomBytes(32).toString('base64url');
  const expiresAtMs = now + STATE_TTL_MS;
  pendingStates.set(state, {
    accountId: normalizedAccountId,
    credentialRef: normalizedCredentialRef,
    expiresAtMs
  });

  return { state, expiresAt: new Date(expiresAtMs).toISOString() };
}

function consumeOAuthState(state, now = Date.now()) {
  const normalizedState = normalize(state);
  if (!normalizedState) {
    throw createError('MISSING_OAUTH_STATE', 'OAuth state is required.');
  }

  const record = pendingStates.get(normalizedState);
  pendingStates.delete(normalizedState);
  if (!record) {
    throw createError('INVALID_OAUTH_STATE', 'OAuth state is invalid or has already been used.');
  }
  if (record.expiresAtMs <= now) {
    throw createError('EXPIRED_OAUTH_STATE', 'OAuth state has expired. Start the Sandbox authorization again.');
  }
  return record;
}

function buildAuthorizationUrl(clientId, ruName, state) {
  const url = new URL(SANDBOX_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', ruName);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', INVENTORY_SCOPE);
  url.searchParams.set('state', state);
  return url.toString();
}

function createSandboxAuthorizationStart(accountId, credentialRef) {
  const credential = resolveSandboxCredential(credentialRef);
  const stateRecord = issueOAuthState(accountId, credential.prefix);

  return {
    environment: 'Sandbox',
    accountId: normalize(accountId),
    credentialRef: credential.prefix,
    authorizationUrl: buildAuthorizationUrl(credential.clientId, credential.ruName, stateRecord.state),
    expiresAt: stateRecord.expiresAt,
    scope: INVENTORY_SCOPE,
    networkAction: 'NONE',
    secretValuesReturned: false
  };
}

async function exchangeAuthorizationCode(code, credentialRef, fetchImpl = globalThis.fetch) {
  assertSandboxNetworkEnabled();
  const normalizedCode = normalize(code);
  if (!normalizedCode) {
    throw createError('MISSING_AUTHORIZATION_CODE', 'Authorization code is required.');
  }
  if (typeof fetchImpl !== 'function') {
    throw createError('FETCH_UNAVAILABLE', 'Backend fetch implementation is unavailable.');
  }

  const credential = resolveSandboxCredential(credentialRef);
  const basicCredentials = Buffer.from(`${credential.clientId}:${credential.clientSecret}`, 'utf8').toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: normalizedCode,
    redirect_uri: credential.ruName
  });

  const response = await fetchImpl(SANDBOX_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicCredentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createError('TOKEN_EXCHANGE_FAILED', `eBay Sandbox token exchange failed with HTTP ${response.status}.`);
  }
  if (!payload.access_token || !payload.refresh_token || !Number.isFinite(Number(payload.expires_in))) {
    throw createError('INVALID_TOKEN_RESPONSE', 'eBay Sandbox token response is missing required fields.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresInSeconds: Number(payload.expires_in),
    tokenType: payload.token_type || 'User Access Token'
  };
}

async function completeSandboxAuthorizationCallback({ code, state, fetchImpl = globalThis.fetch }) {
  const stateRecord = consumeOAuthState(state);
  const tokens = await exchangeAuthorizationCode(code, stateRecord.credentialRef, fetchImpl);
  const expiresAt = new Date(Date.now() + tokens.expiresInSeconds * 1000).toISOString();

  await TokenVault.saveTokens(
    stateRecord.accountId,
    'Sandbox',
    tokens.refreshToken,
    tokens.accessToken,
    expiresAt
  );

  return {
    success: true,
    environment: 'Sandbox',
    accountId: stateRecord.accountId,
    tokenType: tokens.tokenType,
    accessTokenExpiresAt: expiresAt,
    tokensReturnedToBrowser: false,
    authorizationCodeStored: false
  };
}

async function verifySandboxInventoryVersion(accountId, fetchImpl = globalThis.fetch) {
  assertSandboxNetworkEnabled();
  const normalizedAccountId = normalize(accountId);
  if (!normalizedAccountId) {
    throw createError('MISSING_ACCOUNT_ID', 'Account ID is required.');
  }
  if (typeof fetchImpl !== 'function') {
    throw createError('FETCH_UNAVAILABLE', 'Backend fetch implementation is unavailable.');
  }

  const tokens = await TokenVault.getDecryptedTokens(normalizedAccountId, 'Sandbox');
  if (!tokens || !tokens.accessToken) {
    throw createError('SANDBOX_TOKEN_NOT_FOUND', 'No Sandbox User Access Token is stored for this account.');
  }

  const response = await fetchImpl(`${SANDBOX_API_BASE_URL}/sell/inventory/v1/getVersion`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json'
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createError('GET_VERSION_FAILED', `eBay Sandbox getVersion failed with HTTP ${response.status}.`);
  }

  return {
    success: true,
    environment: 'Sandbox',
    accountId: normalizedAccountId,
    endpoint: '/sell/inventory/v1/getVersion',
    version: payload.version || null,
    checkedAt: new Date().toISOString(),
    mutatingOperation: false,
    tokenReturnedToBrowser: false
  };
}

function clearPendingOAuthStatesForTests() {
  pendingStates.clear();
}

module.exports = {
  SANDBOX_AUTHORIZATION_ENDPOINT,
  SANDBOX_TOKEN_ENDPOINT,
  SANDBOX_API_BASE_URL,
  INVENTORY_SCOPE,
  STATE_TTL_MS,
  resolveSandboxCredential,
  assertSandboxNetworkEnabled,
  issueOAuthState,
  consumeOAuthState,
  buildAuthorizationUrl,
  createSandboxAuthorizationStart,
  exchangeAuthorizationCode,
  completeSandboxAuthorizationCallback,
  verifySandboxInventoryVersion,
  clearPendingOAuthStatesForTests
};