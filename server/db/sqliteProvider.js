const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DBProvider } = require('./database');

class SqliteProvider extends DBProvider {
  /**
   * @param {string} [dbPath] - Optional custom SQLite file path (defaults to database.sqlite in server root)
   */
  constructor(dbPath) {
    super();
    this.dbPath = dbPath || process.env.DATABASE_FILE || path.join(__dirname, '../database.sqlite');
    this.db = null;
  }

  /**
   * Connects to SQLite and verifies schema setup.
   * @returns {Promise<void>}
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      // Setup database connection (use ':memory:' for tests if specified in constructor)
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          return reject(new Error(`Failed to open SQLite database: ${err.message}`));
        }
        
        // Execute schema initialization
        const schemaQuery = `
          CREATE TABLE IF NOT EXISTS ebay_tokens (
            account_id TEXT NOT NULL,
            environment TEXT NOT NULL,
            encrypted_refresh_token TEXT NOT NULL,
            encrypted_access_token TEXT,
            access_token_expires_at TEXT,
            last_auth_date TEXT,
            PRIMARY KEY (account_id, environment)
          )
        `;

        this.db.run(schemaQuery, (err) => {
          if (err) {
            return reject(new Error(`Failed to initialize SQLite tables: ${err.message}`));
          }
          resolve();
        });
      });
    });
  }

  /**
   * Closes the active database connection.
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      this.db.close((err) => {
        if (err) return reject(err);
        this.db = null;
        resolve();
      });
    });
  }

  /**
   * Inserts or replaces a token row for an account + environment.
   * @param {string} accountId
   * @param {string} environment
   * @param {string} encryptedRefreshToken
   * @param {string} encryptedAccessToken
   * @param {string} accessTokenExpiresAt
   */
  async saveTokens(accountId, environment, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt) {
    if (!this.db) {
      await this.initialize();
    }

    const query = `
      INSERT OR REPLACE INTO ebay_tokens (
        account_id,
        environment,
        encrypted_refresh_token,
        encrypted_access_token,
        access_token_expires_at,
        last_auth_date
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    const lastAuthDate = new Date().toISOString();

    return new Promise((resolve, reject) => {
      this.db.run(
        query,
        [accountId, environment, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt, lastAuthDate],
        (err) => {
          if (err) {
            return reject(new Error(`Failed to save tokens in SQLite: ${err.message}`));
          }
          resolve();
        }
      );
    });
  }

  /**
   * Retrieves account tokens strictly isolated by compound key.
   * @param {string} accountId
   * @param {string} environment
   * @returns {Promise<Object|null>}
   */
  async getTokens(accountId, environment) {
    if (!this.db) {
      await this.initialize();
    }

    const query = `
      SELECT * FROM ebay_tokens 
      WHERE account_id = ? AND environment = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.get(query, [accountId, environment], (err, row) => {
        if (err) {
          return reject(new Error(`Failed to fetch tokens from SQLite: ${err.message}`));
        }
        resolve(row || null);
      });
    });
  }

  /**
   * Deletes tokens from database.
   * @param {string} accountId
   * @param {string} environment
   */
  async deleteTokens(accountId, environment) {
    if (!this.db) {
      await this.initialize();
    }

    const query = `
      DELETE FROM ebay_tokens 
      WHERE account_id = ? AND environment = ?
    `;

    return new Promise((resolve, reject) => {
      this.db.run(query, [accountId, environment], (err) => {
        if (err) {
          return reject(new Error(`Failed to delete tokens from SQLite: ${err.message}`));
        }
        resolve();
      });
    });
  }

  /**
   * Returns list of connected accounts metadata (no secrets included).
   * @returns {Promise<Array>} Safe account connection list
   */
  async getConnectedAccountsMetadata() {
    if (!this.db) {
      await this.initialize();
    }

    const query = `
      SELECT account_id, environment, last_auth_date 
      FROM ebay_tokens
    `;

    return new Promise((resolve, reject) => {
      this.db.all(query, [], (err, rows) => {
        if (err) {
          return reject(new Error(`Failed to query accounts metadata from SQLite: ${err.message}`));
        }
        resolve(rows || []);
      });
    });
  }
}

module.exports = SqliteProvider;
