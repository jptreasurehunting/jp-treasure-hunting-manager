let activeDBProvider = null;

/**
 * Base abstract class defining the database access layer interface.
 * Any future database providers (like PostgreSQL) must inherit from this class.
 */
class DBProvider {
  async initialize() { throw new Error('Database interface error: initialize() must be implemented.'); }
  async saveTokens(accountId, environment, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt) { throw new Error('Database interface error: saveTokens() must be implemented.'); }
  async getTokens(accountId, environment) { throw new Error('Database interface error: getTokens() must be implemented.'); }
  async deleteTokens(accountId, environment) { throw new Error('Database interface error: deleteTokens() must be implemented.'); }
  async getConnectedAccountsMetadata() { throw new Error('Database interface error: getConnectedAccountsMetadata() must be implemented.'); }
  async createSandboxMutationStageReservation(reservation) { throw new Error('Database interface error: createSandboxMutationStageReservation() must be implemented.'); }
  async getSandboxMutationStageReservation(authorizationId) { throw new Error('Database interface error: getSandboxMutationStageReservation() must be implemented.'); }

  /**
   * Creates one short-lived Shopee SG authorization session without contacting Shopee.
   * The correlation state is not issued at this preparation stage.
   * @param {Object} session
   * @returns {Promise<void>}
   */
  async createShopeeSgAuthSession(session) {
    throw new Error('Database interface error: createShopeeSgAuthSession() must be implemented.');
  }

  /** Retrieves safe Shopee SG auth-session metadata by session ID. */
  async getShopeeSgAuthSession(sessionId) {
    throw new Error('Database interface error: getShopeeSgAuthSession() must be implemented.');
  }
}

function getDB() {
  if (!activeDBProvider) {
    const SqliteProvider = require('./sqliteProvider');
    activeDBProvider = new SqliteProvider();
  }
  return activeDBProvider;
}

function setDB(provider) { activeDBProvider = provider; }

module.exports = { DBProvider, getDB, setDB };
