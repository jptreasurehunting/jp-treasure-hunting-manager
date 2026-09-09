const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { DBProvider } = require('./database');

class SqliteProvider extends DBProvider {
  constructor(dbPath) {
    super();
    this.dbPath = dbPath || process.env.DATABASE_FILE || path.join(__dirname, '../database.sqlite');
    this.db = null;
  }

  async ensureSandboxMutationLocaleColumns() {
    return new Promise((resolve, reject) => {
      this.db.all('PRAGMA table_info(ebay_sandbox_mutation_stage)', [], (err, rows) => {
        if (err) return reject(new Error(`Failed to inspect Sandbox mutation table: ${err.message}`));
        const existing = new Set((rows || []).map((row) => row.name));
        const statements = [];
        if (!existing.has('marketplace_id')) statements.push('ALTER TABLE ebay_sandbox_mutation_stage ADD COLUMN marketplace_id TEXT');
        if (!existing.has('content_language')) statements.push('ALTER TABLE ebay_sandbox_mutation_stage ADD COLUMN content_language TEXT');
        if (statements.length === 0) return resolve();
        this.db.exec(`${statements.join(';')};`, (alterErr) => {
          if (alterErr) return reject(new Error(`Failed to migrate Sandbox mutation locale columns: ${alterErr.message}`));
          resolve();
        });
      });
    });
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) return reject(new Error(`Failed to open SQLite database: ${err.message}`));

        const schemaQuery = `
          CREATE TABLE IF NOT EXISTS ebay_tokens (
            account_id TEXT NOT NULL,
            environment TEXT NOT NULL,
            encrypted_refresh_token TEXT NOT NULL,
            encrypted_access_token TEXT,
            access_token_expires_at TEXT,
            last_auth_date TEXT,
            PRIMARY KEY (account_id, environment)
          );

          CREATE TABLE IF NOT EXISTS ebay_sandbox_mutation_stage (
            authorization_id TEXT PRIMARY KEY,
            seller_account_id TEXT NOT NULL,
            sku TEXT NOT NULL,
            preview_id TEXT NOT NULL,
            marketplace_id TEXT,
            content_language TEXT,
            request_fingerprint TEXT NOT NULL,
            plan_id TEXT NOT NULL,
            credential_ref TEXT NOT NULL,
            verification_id TEXT NOT NULL,
            operation_id TEXT NOT NULL,
            operation_order INTEGER NOT NULL,
            method TEXT NOT NULL,
            path_template TEXT NOT NULL,
            path_parameters_json TEXT NOT NULL,
            request_body_json TEXT,
            step_fingerprint TEXT NOT NULL,
            approved_by TEXT NOT NULL,
            approval_reason TEXT NOT NULL,
            approved_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            staged_at TEXT NOT NULL,
            status TEXT NOT NULL,
            network_action TEXT NOT NULL,
            external_write_performed INTEGER NOT NULL DEFAULT 0
          );

          CREATE TABLE IF NOT EXISTS shopee_sg_auth_session (
            session_id TEXT PRIMARY KEY,
            account_id TEXT NOT NULL,
            shop_id TEXT NOT NULL,
            credential_ref TEXT NOT NULL,
            auth_schema_verification_id TEXT NOT NULL,
            structured_mapping_id TEXT NOT NULL,
            signing_runtime_id TEXT NOT NULL,
            correlation_mapping_id TEXT NOT NULL,
            redirect_uri TEXT NOT NULL,
            correlation_request_field TEXT NOT NULL,
            correlation_callback_field TEXT NOT NULL,
            correlation_state_hash TEXT,
            correlation_state_issued_at TEXT,
            issued_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            status TEXT NOT NULL,
            consumed_at TEXT,
            network_action TEXT NOT NULL,
            external_write_performed INTEGER NOT NULL DEFAULT 0
          );
        `;

        this.db.exec(schemaQuery, async (schemaErr) => {
          if (schemaErr) return reject(new Error(`Failed to initialize SQLite tables: ${schemaErr.message}`));
          try {
            await this.ensureSandboxMutationLocaleColumns();
            resolve();
          } catch (migrationErr) {
            reject(migrationErr);
          }
        });
      });
    });
  }

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

  async saveTokens(accountId, environment, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt) {
    if (!this.db) await this.initialize();
    const query = `
      INSERT OR REPLACE INTO ebay_tokens (
        account_id, environment, encrypted_refresh_token, encrypted_access_token,
        access_token_expires_at, last_auth_date
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    const lastAuthDate = new Date().toISOString();
    return new Promise((resolve, reject) => {
      this.db.run(query, [accountId, environment, encryptedRefreshToken, encryptedAccessToken, accessTokenExpiresAt, lastAuthDate], (err) => {
        if (err) return reject(new Error(`Failed to save tokens in SQLite: ${err.message}`));
        resolve();
      });
    });
  }

  async getTokens(accountId, environment) {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM ebay_tokens WHERE account_id = ? AND environment = ?', [accountId, environment], (err, row) => {
        if (err) return reject(new Error(`Failed to fetch tokens from SQLite: ${err.message}`));
        resolve(row || null);
      });
    });
  }

  async deleteTokens(accountId, environment) {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM ebay_tokens WHERE account_id = ? AND environment = ?', [accountId, environment], (err) => {
        if (err) return reject(new Error(`Failed to delete tokens from SQLite: ${err.message}`));
        resolve();
      });
    });
  }

  async getConnectedAccountsMetadata() {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      this.db.all('SELECT account_id, environment, last_auth_date FROM ebay_tokens', [], (err, rows) => {
        if (err) return reject(new Error(`Failed to query accounts metadata: ${err.message}`));
        resolve(rows || []);
      });
    });
  }

  async createSandboxMutationStageReservation(reservation) {
    if (!this.db) await this.initialize();
    const query = `
      INSERT INTO ebay_sandbox_mutation_stage (
        authorization_id, seller_account_id, sku, preview_id, marketplace_id, content_language,
        request_fingerprint, plan_id, credential_ref, verification_id, operation_id,
        operation_order, method, path_template, path_parameters_json, request_body_json,
        step_fingerprint, approved_by, approval_reason, approved_at, expires_at, staged_at,
        status, network_action, external_write_performed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      reservation.authorizationId, reservation.sellerAccountId, reservation.sku, reservation.previewId,
      reservation.marketplaceId, reservation.contentLanguage, reservation.requestFingerprint, reservation.planId,
      reservation.credentialRef, reservation.verificationId, reservation.operationId, reservation.operationOrder,
      reservation.method, reservation.pathTemplate, JSON.stringify(reservation.pathParameters || {}),
      reservation.requestBody == null ? null : JSON.stringify(reservation.requestBody), reservation.stepFingerprint,
      reservation.approvedBy, reservation.approvalReason, reservation.approvedAt, reservation.expiresAt,
      reservation.stagedAt, reservation.status, reservation.networkAction, reservation.externalWritePerformed ? 1 : 0
    ];
    return new Promise((resolve, reject) => {
      this.db.run(query, values, (err) => {
        if (err) {
          const wrapped = new Error(err.code === 'SQLITE_CONSTRAINT' ? 'Sandbox mutation authorization has already been consumed.' : `Failed to stage Sandbox mutation authorization: ${err.message}`);
          if (err.code === 'SQLITE_CONSTRAINT') wrapped.code = 'AUTHORIZATION_ALREADY_CONSUMED';
          return reject(wrapped);
        }
        resolve();
      });
    });
  }

  async getSandboxMutationStageReservation(authorizationId) {
    if (!this.db) await this.initialize();
    const query = `
      SELECT authorization_id, seller_account_id, sku, preview_id, marketplace_id, content_language,
             request_fingerprint, plan_id, credential_ref, verification_id, operation_id, operation_order,
             method, path_template, path_parameters_json, request_body_json, step_fingerprint,
             approved_by, approval_reason, approved_at, expires_at, staged_at, status,
             network_action, external_write_performed
      FROM ebay_sandbox_mutation_stage WHERE authorization_id = ?
    `;
    return new Promise((resolve, reject) => {
      this.db.get(query, [authorizationId], (err, row) => {
        if (err) return reject(new Error(`Failed to fetch Sandbox mutation stage reservation: ${err.message}`));
        if (!row) return resolve(null);
        resolve({
          ...row,
          path_parameters: JSON.parse(row.path_parameters_json || '{}'),
          request_body: row.request_body_json ? JSON.parse(row.request_body_json) : null,
          external_write_performed: Boolean(row.external_write_performed)
        });
      });
    });
  }

  async createShopeeSgAuthSession(session) {
    if (!this.db) await this.initialize();
    const query = `
      INSERT INTO shopee_sg_auth_session (
        session_id, account_id, shop_id, credential_ref, auth_schema_verification_id,
        structured_mapping_id, signing_runtime_id, correlation_mapping_id, redirect_uri,
        correlation_request_field, correlation_callback_field, correlation_state_hash,
        correlation_state_issued_at, issued_at, expires_at, status, consumed_at,
        network_action, external_write_performed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      session.sessionId, session.accountId, session.shopId, session.credentialRef,
      session.authSchemaVerificationId, session.structuredMappingId, session.signingRuntimeId,
      session.correlationMappingId, session.redirectUri, session.correlationRequestField,
      session.correlationCallbackField, session.correlationStateHash || null,
      session.correlationStateIssuedAt || null, session.issuedAt, session.expiresAt, session.status,
      session.consumedAt || null, session.networkAction, session.externalWritePerformed ? 1 : 0
    ];
    return new Promise((resolve, reject) => {
      this.db.run(query, values, (err) => {
        if (err) {
          const wrapped = new Error(err.code === 'SQLITE_CONSTRAINT' ? 'Shopee SG authorization session ID already exists.' : `Failed to save Shopee SG authorization session: ${err.message}`);
          if (err.code === 'SQLITE_CONSTRAINT') wrapped.code = 'SHOPEE_AUTH_SESSION_ALREADY_EXISTS';
          return reject(wrapped);
        }
        resolve();
      });
    });
  }

  async getShopeeSgAuthSession(sessionId) {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT session_id, account_id, shop_id, credential_ref, auth_schema_verification_id,
               structured_mapping_id, signing_runtime_id, correlation_mapping_id, redirect_uri,
               correlation_request_field, correlation_callback_field, correlation_state_hash,
               correlation_state_issued_at, issued_at, expires_at, status, consumed_at,
               network_action, external_write_performed
        FROM shopee_sg_auth_session WHERE session_id = ?
      `, [sessionId], (err, row) => {
        if (err) return reject(new Error(`Failed to fetch Shopee SG authorization session: ${err.message}`));
        if (!row) return resolve(null);
        resolve({ ...row, external_write_performed: Boolean(row.external_write_performed) });
      });
    });
  }

  async issueShopeeSgAuthSessionPreviewState(sessionId, stateHash, issuedAt) {
    if (!this.db) await this.initialize();
    const db = this.db;
    const query = `
      UPDATE shopee_sg_auth_session
      SET correlation_state_hash = ?, correlation_state_issued_at = ?, status = 'STATE_ISSUED_PREVIEW_ONLY'
      WHERE session_id = ?
        AND status = 'PREPARED'
        AND correlation_state_hash IS NULL
        AND correlation_state_issued_at IS NULL
        AND expires_at > ?
    `;

    return new Promise((resolve, reject) => {
      db.run(query, [stateHash, issuedAt, sessionId, issuedAt], function onIssued(err) {
        if (err) return reject(new Error(`Failed to issue Shopee SG preview correlation state: ${err.message}`));
        if (this.changes === 1) return resolve();

        db.get(
          'SELECT session_id, status, correlation_state_hash, correlation_state_issued_at, expires_at FROM shopee_sg_auth_session WHERE session_id = ?',
          [sessionId],
          (readErr, row) => {
            if (readErr) return reject(new Error(`Failed to inspect Shopee SG authorization session: ${readErr.message}`));
            const wrapped = new Error('Shopee SG authorization session cannot issue another preview correlation state.');
            if (!row) {
              wrapped.code = 'SHOPEE_AUTH_SESSION_NOT_FOUND';
            } else if (Date.parse(row.expires_at) <= Date.parse(issuedAt)) {
              wrapped.code = 'SHOPEE_AUTH_SESSION_EXPIRED';
            } else if (row.correlation_state_hash || row.correlation_state_issued_at || row.status !== 'PREPARED') {
              wrapped.code = 'SHOPEE_AUTH_SESSION_STATE_ALREADY_ISSUED';
            } else {
              wrapped.code = 'SHOPEE_AUTH_SESSION_STATE_NOT_ISSUABLE';
            }
            reject(wrapped);
          }
        );
      });
    });
  }
}

module.exports = SqliteProvider;
