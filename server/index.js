const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { getDB } = require('./db/database');
const TokenVault = require('./security/tokenVault');

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

// Start Server (If running directly and not imported as a module in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Secure Token Vault backend listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`);
  });
}

module.exports = app; // Export for unit tests
