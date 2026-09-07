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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Initialize Database on Startup
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

/**
 * Health Check Endpoint
 * Confirms server execution state and internal database connectivity.
 */
app.get('/health', async (req, res) => {
  res.json({
    status: 'UP',
    database: dbReady ? 'READY' : 'NOT_READY',
    timestamp: new Date().toISOString()
  });
});

/**
 * Account Connection Status Endpoint
 * Returns a list of connected accounts and their environments with SAFE metadata ONLY.
 * Never exposes access/refresh tokens or client secrets.
 */
app.get('/api/accounts/status', async (req, res) => {
  try {
    const db = getDB();
    const rows = await db.getConnectedAccountsMetadata();
    
    // Format into safe list
    const metadata = rows.map((row) => ({
      accountId: row.account_id,
      environment: row.environment,
      connectionStatus: 'connected',
      lastAuthDate: row.last_auth_date
    }));
    
    res.json({
      success: true,
      accounts: metadata
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve connection statuses.'
    });
  }
});

/**
 * Disconnect Account Endpoint
 * Removes token mapping for the specified account and environment.
 */
app.post('/api/accounts/disconnect', async (req, res) => {
  const { accountId, environment } = req.body;

  if (!accountId || !environment) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: accountId, environment.'
    });
  }

  try {
    await TokenVault.deleteTokens(accountId, environment);
    res.json({
      success: true,
      message: `Successfully disconnected account ${accountId} in ${environment} environment.`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to disconnect account.'
    });
  }
});

/**
 * Development-Only Mock Connection Seed
 * Strictly fail-closed: Checks Node environment first. Returns 403 in non-development modes.
 */
app.post('/api/auth/mock-connect', async (req, res) => {
  const { accountId, environment } = req.body;

  // Double-guard: Fail-closed verification
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Mock connections are restricted to development mode.'
    });
  }

  if (!accountId || !environment) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: accountId, environment.'
    });
  }

  try {
    await TokenVault.mockConnect(accountId, environment);
    res.json({
      success: true,
      message: `Mock connection registered successfully for ${accountId} in ${environment} environment.`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to seed mock connection.'
    });
  }
});

/**
 * eBay Sandbox OAuth Start
 * Creates a one-time CSRF state and returns the Sandbox user-consent URL.
 * Client Secret and tokens remain backend-only.
 */
app.post('/api/ebay/sandbox/oauth/start', (req, res) => {
  const { accountId, credentialRef } = req.body || {};
  try {
    const start = createSandboxAuthorizationStart(accountId, credentialRef);
    res.json({ success: true, ...start });
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

/**
 * eBay Sandbox OAuth Callback
 * Exchanges the one-time authorization code for user tokens only when Sandbox network
 * execution has been explicitly enabled. Tokens are encrypted into TokenVault and are
 * never returned to the browser.
 */
app.get('/api/ebay/sandbox/oauth/callback', async (req, res) => {
  const { code, state } = req.query || {};
  try {
    const result = await completeSandboxAuthorizationCallback({ code, state });
    res.json(result);
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

/**
 * eBay Sandbox Inventory API Non-Mutating Verification
 * Calls getVersion using the encrypted Sandbox user token. No listing/inventory mutation.
 */
app.get('/api/ebay/sandbox/inventory/version', async (req, res) => {
  const { accountId } = req.query || {};
  try {
    const result = await verifySandboxInventoryVersion(accountId);
    res.json(result);
  } catch (err) {
    return sendSafeOAuthError(res, err);
  }
});

// Start Server (If running directly and not imported as a module in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Secure Token Vault backend listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
  });
}

module.exports = app; // Export for unit tests
