let activeDBProvider = null;

/**
 * Base abstract class defining the database access layer interface.
 * Any future database providers (like PostgreSQL) must inherit from this class.
 */
class DBProvider {
  /**
   * Performs database connection, schema setup, and migrations if needed.
   * @returns {Promise<void>}
   */
  async initialize() {
    throw new Error('Database interface error: initialize() must be implemented.');
  }

  /**
   * Saves or updates encrypted token metadata.
   * @param {string} accountId
   * @param {string} environment - Strictly 'Production' or 'Sandbox'
   * @param {string} encryptedRefreshToken
   * @param {string} encryptedAccessToken
   * @param {string} accessTokenExpiresAt - ISO Date String
   * @returns {Promise<void>}
   */
  async saveTokens(accountId, environment, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt) {
    throw new Error('Database interface error: saveTokens() must be implemented.');
  }

  /**
   * Retrieves encrypted tokens for a specific account and environment.
   * @param {string} accountId
   * @param {string} environment - Strictly 'Production' or 'Sandbox'
   * @returns {Promise<Object|null>} Safe data row including encrypted tokens, or null
   */
  async getTokens(accountId, environment) {
    throw new Error('Database interface error: getTokens() must be implemented.');
  }

  /**
   * Deletes tokens from database, revoking connection state.
   * @param {string} accountId
   * @param {string} environment
   * @returns {Promise<void>}
   */
  async deleteTokens(accountId, environment) {
    throw new Error('Database interface error: deleteTokens() must be implemented.');
  }

  /**
   * Retrieves all registered accounts with safe metadata (no secrets).
   * @returns {Promise<Array>} List of connected accounts metadata
   */
  async getConnectedAccountsMetadata() {
    throw new Error('Database interface error: getConnectedAccountsMetadata() must be implemented.');
  }

  /**
   * Atomically stages a one-time eBay Sandbox mutation authorization.
   * authorization_id must be unique so replay attempts fail closed.
   * @param {Object} reservation
   * @returns {Promise<void>}
   */
  async createSandboxMutationStageReservation(reservation) {
    throw new Error('Database interface error: createSandboxMutationStageReservation() must be implemented.');
  }

  /**
   * Retrieves safe metadata for a staged Sandbox mutation by authorization ID.
   * @param {string} authorizationId
   * @returns {Promise<Object|null>}
   */
  async getSandboxMutationStageReservation(authorizationId) {
    throw new Error('Database interface error: getSandboxMutationStageReservation() must be implemented.');
  }
}

/**
 * Returns the currently active database provider instance.
 * Defaults to SQLite if none is configured.
 * @returns {DBProvider}
 */
function getDB() {
  if (!activeDBProvider) {
    // Dynamic import to prevent circular require dependencies at startup
    const SqliteProvider = require('./sqliteProvider');
    activeDBProvider = new SqliteProvider();
  }
  return activeDBProvider;
}

/**
 * Overrides the active database provider. Primarily used for unit testing or Postgres swaps.
 * @param {DBProvider} provider
 */
function setDB(provider) {
  activeDBProvider = provider;
}

module.exports = {
  DBProvider,
  getDB,
  setDB
};
