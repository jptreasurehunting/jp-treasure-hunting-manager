const crypto = require('crypto');
const { encrypt, decrypt } = require('../security/encryption');
const TokenVault = require('../security/tokenVault');
const { setDB } = require('../db/database');
const SqliteProvider = require('../db/sqliteProvider');

describe('Security & Encryption Layer Tests', () => {
  // Generate a valid 256-bit hexadecimal key for test suites
  const masterKey = crypto.randomBytes(32).toString('hex');
  const dummyText = 'test_ebay_refresh_token_xyz_123';

  describe('AES-256-GCM Authenticated Encryption', () => {
    test('Encrypt and decrypt match original plain text with correct key', () => {
      const encrypted = encrypt(dummyText, masterKey);
      expect(encrypted).toContain(':');
      
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(dummyText);
    });

    test('Throws error if key is invalid length', () => {
      const invalidKey = 'short_key';
      expect(() => {
        encrypt(dummyText, invalidKey);
      }).toThrow('Encryption key must be exactly 32 bytes');
    });

    test('Throws authentication error if key is wrong during decryption', () => {
      const otherKey = crypto.randomBytes(32).toString('hex');
      const encrypted = encrypt(dummyText, masterKey);
      
      expect(() => {
        decrypt(encrypted, otherKey);
      }).toThrow();
    });

    test('Throws authentication error if cipher text has been tampered with (AES-GCM integrity check)', () => {
      const encrypted = encrypt(dummyText, masterKey);
      const parts = encrypted.split(':');
      
      // Corrupt the encrypted text payload part
      parts[2] = parts[2].substring(0, parts[2].length - 2) + '00';
      const corruptedPayload = parts.join(':');

      expect(() => {
        decrypt(corruptedPayload, masterKey);
      }).toThrow();
    });
  });

  describe('Database Abstraction (SQLite Provider & CRUD)', () => {
    let testDbProvider;

    beforeAll(async () => {
      // Use in-memory SQLite for isolated database testing
      testDbProvider = new SqliteProvider(':memory:');
      await testDbProvider.initialize();
      setDB(testDbProvider);
    });

    afterAll(async () => {
      if (testDbProvider) {
        await testDbProvider.close();
      }
    });

    test('CRUD Token transactions strictly filter by accountId and environment', async () => {
      process.env.ENCRYPTION_KEY = masterKey;

      const accountId = 'acc_01';
      const environment = 'Production';
      const refreshToken = 'ebay_refresh_01';
      const accessToken = 'ebay_access_01';
      const expiresAt = new Date().toISOString();

      // 1. Save and decrypt test
      await TokenVault.saveTokens(accountId, environment, refreshToken, accessToken, expiresAt);
      
      const decrypted = await TokenVault.getDecryptedTokens(accountId, environment);
      expect(decrypted).not.toBeNull();
      expect(decrypted.refreshToken).toBe(refreshToken);
      expect(decrypted.accessToken).toBe(accessToken);

      // 2. Separation check: query sandbox environment for same account should be null
      const sandboxTokens = await TokenVault.getDecryptedTokens(accountId, 'Sandbox');
      expect(sandboxTokens).toBeNull();

      // 3. Metadata check (safe details only)
      const list = await testDbProvider.getConnectedAccountsMetadata();
      expect(list.length).toBe(1);
      expect(list[0].account_id).toBe(accountId);
      expect(list[0].environment).toBe(environment);
      expect(list[0].encrypted_refresh_token).toBeUndefined(); // Schema returns database values, but check no raw leakage in list
      
      // 4. Delete tokens
      await TokenVault.deleteTokens(accountId, environment);
      const postDelete = await TokenVault.getDecryptedTokens(accountId, environment);
      expect(postDelete).toBeNull();
    });
  });

  describe('Development Safeguard (Fail-Closed)', () => {
    let testDbProvider;
    const oldEnv = process.env.NODE_ENV;

    beforeAll(async () => {
      testDbProvider = new SqliteProvider(':memory:');
      await testDbProvider.initialize();
      setDB(testDbProvider);
      process.env.ENCRYPTION_KEY = masterKey;
    });

    afterAll(async () => {
      process.env.NODE_ENV = oldEnv;
      if (testDbProvider) {
        await testDbProvider.close();
      }
    });

    test('mockConnect succeeds when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development';
      await TokenVault.mockConnect('acc_test', 'Production');
      
      const tokens = await TokenVault.getDecryptedTokens('acc_test', 'Production');
      expect(tokens).not.toBeNull();
      expect(tokens.refreshToken).toContain('dummy_refresh_token');
    });

    test('mockConnect throws error and halts execution when NODE_ENV is production (fail-closed)', async () => {
      process.env.NODE_ENV = 'production';
      
      await expect(
        TokenVault.mockConnect('acc_prod_test', 'Production')
      ).rejects.toThrow('Security Violation: Mock connections are strictly restricted to development/testing environments.');
    });
  });
});
