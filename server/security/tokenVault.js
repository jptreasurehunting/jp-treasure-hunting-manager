const { encrypt, decrypt } = require('./encryption');
const { getDB } = require('../db/database');

class TokenVault {
  /**
   * Resolves encryption key from environment variable.
   * @returns {string}
   */
  static getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('Security configuration error: ENCRYPTION_KEY environment variable is not defined.');
    }
    return key;
  }

  /**
   * Guards and validates allowed environments.
   * @param {string} environment
   */
  static validateEnvironment(environment) {
    if (environment !== 'Production' && environment !== 'Sandbox') {
      throw new Error('Security validation error: Environment must be strictly either "Production" or "Sandbox".');
    }
  }

  /**
   * Encrypts and persists tokens using database provider.
   * @param {string} accountId
   * @param {string} environment
   * @param {string} refreshToken
   * @param {string} accessToken
   * @param {string} expiresAt - ISO Date String
   */
  static async saveTokens(accountId, environment, refreshToken, accessToken, expiresAt) {
    this.validateEnvironment(environment);
    if (!accountId) {
      throw new Error('Account ID is required.');
    }

    const key = this.getEncryptionKey();
    const encryptedRefresh = encrypt(refreshToken, key);
    const encryptedAccess = accessToken ? encrypt(accessToken, key) : null;

    const db = getDB();
    await db.saveTokens(accountId, environment, encryptedRefresh, encryptedAccess, expiresAt);
  }

  /**
   * Retrieves and decrypts tokens.
   * @param {string} accountId
   * @param {string} environment
   * @returns {Promise<Object|null>} Decrypted tokens metadata or null
   */
  static async getDecryptedTokens(accountId, environment) {
    this.validateEnvironment(environment);
    if (!accountId) {
      throw new Error('Account ID is required.');
    }

    const key = this.getEncryptionKey();
    const db = getDB();
    const row = await db.getTokens(accountId, environment);

    if (!row) {
      return null;
    }

    try {
      const refreshToken = decrypt(row.encrypted_refresh_token, key);
      const accessToken = row.encrypted_access_token ? decrypt(row.encrypted_access_token, key) : null;

      return {
        accountId: row.account_id,
        environment: row.environment,
        refreshToken,
        accessToken,
        accessTokenExpiresAt: row.access_token_expires_at,
        lastAuthDate: row.last_auth_date
      };
    } catch (e) {
      throw new Error('Decryption failed: Token data might be corrupted or encryption key mismatch.');
    }
  }

  /**
   * Revokes connection and deletes encrypted tokens from DB.
   * @param {string} accountId
   * @param {string} environment
   */
  static async deleteTokens(accountId, environment) {
    this.validateEnvironment(environment);
    if (!accountId) {
      throw new Error('Account ID is required.');
    }

    const db = getDB();
    await db.deleteTokens(accountId, environment);
  }

  /**
   * Seeds development dummy connections for testing.
   * Strictly fail-closed: Throws error in non-development mode.
   * @param {string} accountId
   * @param {string} environment
   */
  static async mockConnect(accountId, environment) {
    this.validateEnvironment(environment);
    
    // Fail-Closed Check
    if (process.env.NODE_ENV !== 'development') {
      throw new Error('Security Violation: Mock connections are strictly restricted to development/testing environments.');
    }

    const dummyRefreshToken = `dummy_refresh_token_${accountId}_${environment}`;
    const dummyAccessToken = `dummy_access_token_${accountId}_${environment}`;
    const dummyExpiresAt = new Date(Date.now() + 7200 * 1000).toISOString(); // 2 hours expiration

    await this.saveTokens(accountId, environment, dummyRefreshToken, dummyAccessToken, dummyExpiresAt);
  }
}

module.exports = TokenVault;
