const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getDB } = require('./db/database');
const TokenVault = require('./security/tokenVault');
const {
  createSandboxAuthorizationStart,
  completeSandboxAuthorizationCallback,
  verifySandboxInventoryVersion
} = require('./integrations/ebaySandboxOAuthBackend');
const {
  stageSandboxMutationExecution,
  getSandboxMutationStageStatus,
  buildSandboxMutationExecutionPreview
} = require('./integrations/ebaySandboxMutationExecutionBackend');
const {
  executeEbaySandboxInventorySync
} = require('./integrations/ebaySandboxInventorySyncBackend');
const {
  getShopeeSgAuthReadiness
} = require('./integrations/shopeeSgAuthFoundationBackend');
const {
  buildShopeeSgAuthTransportPlan
} = require('./integrations/shopeeSgAuthTransportBackend');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let dbReady = false;
getDB().initialize()
  .then(() => {
    dbReady = true;
    console.log('Database initialized successfully.');
  })
  .catch((err) => {
    console.error('Database initialization failed:', err.message);
  });

function oauthErrorStatus(error) {
  switch (error && error.code) {
    case 'MISSING_ACCOUNT_ID':
    case 'INVALID_CREDENTIAL_REF':
    case 'MISSING_AUTHORIZATION_CODE':
    case 'MISSING_OAUTH_STATE':
      return 400;
    case 'INVALID_OAUTH_STATE':
    case 'EXPIRED_OAUTH_STATE':
      return 409;
    case 'CREDENTIAL_NOT_CONFIGURED':
    case 'SANDBOX_NETWORK_DISABLED':
      return 503;
    case 'SANDBOX_TOKEN_NOT_FOUND':
      return 404;
    default:
      return 502;
  }
}

function sendSafeOAuthError(res, error) {
  return res.status(oauthErrorStatus(error)).json({
    success: false,
    errorCode: error && error.code ? error.code : 'EBAY_SANDBOX_BACKEND_ERROR',
    error: error && error.message ? error.message : 'eBay Sandbox backend operation failed.'
  });
}

function mutationStageErrorStatus(error) {
  switch (error && error.code) {
    case 'MISSING_AUTHORIZATION':
    case 'MISSING_MUTATION_STEP':
    case 'MISSING_AUTHORIZATION_ID':
    case 'INVALID_AUTHORIZATION_RECORD':
    case 'INVALID_AUTHORIZATION_TIME':
    case 'INVALID_MUTATION_TARGET':
    case 'INVALID_REQUEST_BODY':
    case 'MISSING_EXPLICIT_CONFIRMATION':
    case 'SKU_MISMATCH':
    case 'STEP_AUTHORIZATION_MISMATCH':
    case 'STEP_FINGERPRINT_MISMATCH':
    case 'MARKETPLACE_ID_MISSING':
    case 'CONTENT_LANGUAGE_MISSING':
      return 400;
    case 'PRODUCTION_NOT_ALLOWED':
    case 'OPERATION_NOT_ALLOWED':
    case 'AUTHORIZATION_NOT_UNUSED':
    case 'UNSAFE_AUTHORIZATION_STATE':
    case 'AUTHORIZATION_EXPIRED':
    case 'AUTHORIZATION_TTL_TOO_LONG':
    case 'AUTHORIZATION_ALREADY_CONSUMED':
    case 'STAGED_MUTATION_UNSAFE_STATE':
    case 'STAGED_MUTATION_EXPIRED':
    case 'SANDBOX_ACCESS_TOKEN_EXPIRED':
      return 409;
    case 'SANDBOX_TOKEN_NOT_FOUND':
    case 'SANDBOX_ACCESS_TOKEN_MISSING':
    case 'STAGED_MUTATION_NOT_FOUND':
      return 404;
    default:
      return 500;
  }
}

function sendSafeMutationStageError(res, error) {
  return res.status(mutationStageErrorStatus(error)).json({
    success: false,
    errorCode: error && error.code ? error.code : 'EBAY_SANDBOX_MUTATION_STAGE_ERROR',
    error: error && error.message ? error.message : 'eBay Sandbox mutation staging failed.',
    networkAction: 'NONE',
    externalWritePerformed: false
  });
}

function inventorySyncErrorStatus(error) {
  switch (error && error.code) {
    case 'MISSING_SYNC_REQUEST':
    case 'MISSING_SYNC_REQUEST_ID':
    case 'MISSING_ACCOUNT_ID':
    case 'MISSING_SKU':
    case 'INVALID_TARGET_STOCK':
    case 'INVALID_SYNC_REQUEST_STATE':
    case 'UNSUPPORTED_SYNC_CHANNEL':
      return 400;
    case 'SANDBOX_ACCESS_TOKEN_EXPIRED':
      return 409;
    case 'SANDBOX_TOKEN_NOT_FOUND':
    case 'EBAY_PUBLISHED_OFFER_NOT_FOUND':
      return 404;
    case 'SANDBOX_NETWORK_DISABLED':
    case 'SANDBOX_INVENTORY_SYNC_WRITE_DISABLED':
      return 503;
    case 'EBAY_GET_OFFERS_FAILED':
    case 'EBAY_BULK_UPDATE_FAILED':
    case 'EBAY_BULK_UPDATE_PARTIAL_FAILURE':
      return 502;
    default:
      return 500;
  }
}

function sendSafeInventorySyncError(res, error) {
  return res.status(inventorySyncErrorStatus(error)).json({
    success: false,
    errorCode: error && error.code ? error.code : 'EBAY_SANDBOX_INVENTORY_SYNC_ERROR',
    error: error && error.message ? error.message : 'eBay Sandbox inventory synchronization failed.',
    externalWritePerformed: Boolean(error && error.externalWritePerformed),
    tokenReturnedToBrowser: false
  });
}

function shopeeAuthReadinessErrorStatus(error) {
  switch (error && error.code) {
    case 'MISSING_SHOPEE_ACCOUNT_ID':
    case 'INVALID_SHOPEE_CREDENTIAL_REF':
    case 'INVALID_SHOPEE_SHOP_ID':
    case 'INVALID_SHOPEE_SCHEMA_VERIFICATION':
    case 'INVALID_SHOPEE_AUTH_SCHEMA_VERIFICATION':
    case 'MISSING_SHOPEE_AUTH_SCHEMA_VERIFICATION':
      return 400;
    case 'STALE_SHOPEE_SCHEMA_VERIFICATION':
    case 'STALE_SHOPEE_AUTH_SCHEMA_VERIFICATION':
      return 409;
    default:
      return 500;
  }
}

function sendSafeShopeeAuthReadinessError(res, error) {
  return res.status(shopeeAuthReadinessErrorStatus(error)).json({
    success: false,
    errorCode: error && error.code ? error.code : 'SHOPEE_SG_AUTH_READINESS_ERROR',
    error: error && error.message ? error.message : 'Shopee SG authentication readiness check failed.',
    networkAction: 'NONE',
    externalWritePerformed: false,
    secretValuesReturned: false
  });
}

app.get('/health', async (req, res) => {
  res.json({ status: 'UP', database: dbReady ? 'READY' : 'NOT_READY', timestamp: new Date().toISOString() });
});

app.get('/api/accounts/status', async (req, res) => {
  try {
    const rows = await getDB().getConnectedAccountsMetadata();
    res.json({
      success: true,
      accounts: rows.map((row) => ({
        accountId: row.account_id,
        environment: row.environment,
        connectionStatus: 'connected',
        lastAuthDate: row.last_auth_date
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve connection statuses.' });
  }
});

app.post('/api/accounts/disconnect', async (req, res) => {
  const { accountId, environment } = req.body;
  if (!accountId || !environment) return res.status(400).json({ success: false, error: 'Missing required parameters: accountId, environment.' });
  try {
    await TokenVault.deleteTokens(accountId, environment);
    res.json({ success: true, message: `Successfully disconnected account ${accountId} in ${environment} environment.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to disconnect account.' });
  }
});

app.post('/api/auth/mock-connect', async (req, res) => {
  const { accountId, environment } = req.body;
  if (process.env.NODE_ENV !== 'development') return res.status(403).json({ success: false, error: 'Forbidden: Mock connections are restricted to development mode.' });
  if (!accountId || !environment) return res.status(400).json({ success: false, error: 'Missing required parameters: accountId, environment.' });
  try {
    await TokenVault.mockConnect(accountId, environment);
    res.json({ success: true, message: `Mock connection registered successfully for ${accountId} in ${environment} environment.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to seed mock connection.' });
  }
});

/**
 * Reports only safe Shopee Singapore backend credential/configuration readiness metadata.
 * This endpoint never contacts Shopee, never signs requests, and never returns Partner Key/token values.
 */
app.post('/api/shopee/sg/auth/readiness', (req, res) => {
  try {
    res.json(getShopeeSgAuthReadiness(req.body || {}));
  } catch (err) {
    return sendSafeShopeeAuthReadinessError(res, err);
  }
});

/**
 * Builds a contract-only Shopee Singapore auth transport plan.
 * Every external/auth/signing stage stays NOT_IMPLEMENTED and networkAction remains NONE.
 */
app.post('/api/shopee/sg/auth/transport/plan', (req, res) => {
  try {
    res.json(buildShopeeSgAuthTransportPlan(req.body || {}));
  } catch (err) {
    return sendSafeShopeeAuthReadinessError(res, err);
  }
});

app.post('/api/ebay/sandbox/oauth/start', (req, res) => {
  const { accountId, credentialRef } = req.body || {};
  try {
    const start = createSandboxAuthorizationStart(accountId, credentialRef);
    res.json({ success: true, ...start });
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

app.get('/api/ebay/sandbox/oauth/callback', async (req, res) => {
  const { code, state } = req.query || {};
  try {
    res.json(await completeSandboxAuthorizationCallback({ code, state }));
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

app.get('/api/ebay/sandbox/inventory/version', async (req, res) => {
  const { accountId } = req.query || {};
  try {
    res.json(await verifySandboxInventoryVersion(accountId));
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

/**
 * Executes one absolute-stock synchronization against eBay Sandbox only.
 * The backend discovers published offers by SKU, then updates inventory-level and offer-level quantity together.
 * Production endpoints are never selected here.
 */
app.post('/api/ebay/sandbox/inventory/sync', async (req, res) => {
  try {
    res.json(await executeEbaySandboxInventorySync(req.body && req.body.request));
  } catch (err) {
    return sendSafeInventorySyncError(res, err);
  }
});

/** Consumes one approved Sandbox authorization into persistent staging. Never calls eBay. */
app.post('/api/ebay/sandbox/mutation/stage', async (req, res) => {
  const { authorization, step } = req.body || {};
  try {
    res.json(await stageSandboxMutationExecution({ authorization, step }));
  } catch (err) {
    return sendSafeMutationStageError(res, err);
  }
});

/** Returns safe staged metadata only; request body and tokens are not returned. */
app.get('/api/ebay/sandbox/mutation/stage/:authorizationId', async (req, res) => {
  try {
    res.json(await getSandboxMutationStageStatus(req.params.authorizationId));
  } catch (err) {
    return sendSafeMutationStageError(res, err);
  }
});

/**
 * Builds the final Sandbox HTTP request shape from backend staging without sending it.
 * Access tokens remain in TokenVault and are represented only by a redacted placeholder.
 * MarketplaceId and Content-Language must already be bound by the approved prerequisite flow.
 */
app.get('/api/ebay/sandbox/mutation/stage/:authorizationId/execution-preview', async (req, res) => {
  try {
    res.json(await buildSandboxMutationExecutionPreview(req.params.authorizationId));
  } catch (err) {
    return sendSafeMutationStageError(res, err);
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Secure Token Vault backend listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
  });
}

module.exports = app;
