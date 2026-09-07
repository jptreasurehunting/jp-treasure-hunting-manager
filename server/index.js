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

app.get('/health', async (req, res) => {
  res.json({
    status: 'UP',
    database: dbReady ? 'READY' : 'NOT_READY',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/accounts/status', async (req, res) => {
  try {
    const db = getDB();
    const rows = await db.getConnectedAccountsMetadata();
    const metadata = rows.map((row) => ({
      accountId: row.account_id,
      environment: row.environment,
      connectionStatus: 'connected',
      lastAuthDate: row.last_auth_date
    }));

    res.json({ success: true, accounts: metadata });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve connection statuses.' });
  }
});

app.post('/api/accounts/disconnect', async (req, res) => {
  const { accountId, environment } = req.body;
  if (!accountId || !environment) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: accountId, environment.' });
  }

  try {
    await TokenVault.deleteTokens(accountId, environment);
    res.json({
      success: true,
      message: `Successfully disconnected account ${accountId} in ${environment} environment.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to disconnect account.' });
  }
});

app.post('/api/auth/mock-connect', async (req, res) => {
  const { accountId, environment } = req.body;
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ success: false, error: 'Forbidden: Mock connections are restricted to development mode.' });
  }
  if (!accountId || !environment) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: accountId, environment.' });
  }

  try {
    await TokenVault.mockConnect(accountId, environment);
    res.json({
      success: true,
      message: `Mock connection registered successfully for ${accountId} in ${environment} environment.`
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Failed to seed mock connection.' });
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
    const result = await completeSandboxAuthorizationCallback({ code, state });
    res.json(result);
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

app.get('/api/ebay/sandbox/inventory/version', async (req, res) => {
  const { accountId } = req.query || {};
  try {
    const result = await verifySandboxInventoryVersion(accountId);
    res.json(result);
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

/**
 * eBay Sandbox Mutation Staging
 * Consumes an approved one-time createOrReplaceInventoryItem authorization into backend
 * persistent staging. This endpoint NEVER calls eBay and never performs an external write.
 */
app.post('/api/ebay/sandbox/mutation/stage', async (req, res) => {
  const { authorization, step } = req.body || {};
  try {
    const result = await stageSandboxMutationExecution({ authorization, step });
    res.json(result);
  } catch (err) {
    return sendSafeMutationStageError(res, err);
  }
});

/**
 * Returns safe staging metadata only. The request body is intentionally not returned here.
 */
app.get('/api/ebay/sandbox/mutation/stage/:authorizationId', async (req, res) => {
  try {
    const result = await getSandboxMutationStageStatus(req.params.authorizationId);
    res.json(result);
  } catch (err) {
    return sendSafeMutationStageError(res, err);
  }
});

/**
 * Builds the final Sandbox HTTP request shape from backend staging without sending it.
 * Access tokens remain in TokenVault and are represented only by a redacted placeholder.
 * Content-Language remains a blocking REVIEW_REQUIRED field until the target locale is resolved.
 */
app.get('/api/ebay/sandbox/mutation/stage/:authorizationId/execution-preview', async (req, res) => {
  try {
    const result = await buildSandboxMutationExecutionPreview(req.params.authorizationId);
    res.json(result);
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
