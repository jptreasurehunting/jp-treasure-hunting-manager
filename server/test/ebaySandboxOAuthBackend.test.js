const crypto = require('crypto');
const { setDB } = require('../db/database');
const SqliteProvider = require('../db/sqliteProvider');
const TokenVault = require('../security/tokenVault');
const {
  SANDBOX_TOKEN_ENDPOINT,
  INVENTORY_SCOPE,
  createSandboxAuthorizationStart,
  issueOAuthState,
  consumeOAuthState,
  exchangeAuthorizationCode,
  completeSandboxAuthorizationCallback,
  verifySandboxInventoryVersion,
  clearPendingOAuthStatesForTests
} = require('../integrations/ebaySandboxOAuthBackend');

describe('eBay Sandbox OAuth Backend Safety', () => {
  let db;
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const credentialRef = 'EBAY_SANDBOX_TEST';
  const accountId = 'ebay-sandbox-account-1';

  beforeAll(async () => {
    db = new SqliteProvider(':memory:');
    await db.initialize();
    setDB(db);
  });

  beforeEach(() => {
    clearPendingOAuthStatesForTests();
    process.env.ENCRYPTION_KEY = encryptionKey;
    process.env.EBAY_SANDBOX_NETWORK_ENABLED = 'false';
    process.env[`${credentialRef}_CLIENT_ID`] = 'sandbox-client-id';
    process.env[`${credentialRef}_CLIENT_SECRET`] = 'sandbox-client-secret';
    process.env[`${credentialRef}_RUNAME`] = 'sandbox-ru-name';
  });

  afterEach(async () => {
    await TokenVault.deleteTokens(accountId, 'Sandbox').catch(() => {});
    clearPendingOAuthStatesForTests();
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  test('authorization start returns consent URL and never returns Client Secret', () => {
    const start = createSandboxAuthorizationStart(accountId, credentialRef);
    const url = new URL(start.authorizationUrl);

    expect(start.environment).toBe('Sandbox');
    expect(start.secretValuesReturned).toBe(false);
    expect(start).not.toHaveProperty('clientSecret');
    expect(url.hostname).toBe('auth.sandbox.ebay.com');
    expect(url.searchParams.get('client_id')).toBe('sandbox-client-id');
    expect(url.searchParams.get('redirect_uri')).toBe('sandbox-ru-name');
    expect(url.searchParams.get('scope')).toBe(INVENTORY_SCOPE);
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  test('OAuth state is one-time and replay is rejected', () => {
    const issued = issueOAuthState(accountId, credentialRef);
    const first = consumeOAuthState(issued.state);
    expect(first.accountId).toBe(accountId);
    expect(() => consumeOAuthState(issued.state)).toThrow('invalid or has already been used');
  });

  test('token exchange is fail-closed while Sandbox network execution is disabled', async () => {
    const fetchMock = jest.fn();
    await expect(exchangeAuthorizationCode('code-1', credentialRef, fetchMock))
      .rejects.toMatchObject({ code: 'SANDBOX_NETWORK_DISABLED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('authorization-code exchange uses backend Basic credentials and returns parsed tokens only inside backend service', async () => {
    process.env.EBAY_SANDBOX_NETWORK_ENABLED = 'true';
    const fetchMock = jest.fn(async (url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'access-secret-value',
        refresh_token: 'refresh-secret-value',
        expires_in: 7200,
        token_type: 'User Access Token'
      })
    }));

    const result = await exchangeAuthorizationCode('one-time-code', credentialRef, fetchMock);
    expect(result.accessToken).toBe('access-secret-value');
    expect(result.refreshToken).toBe('refresh-secret-value');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(SANDBOX_TOKEN_ENDPOINT);
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toMatch(/^Basic /);
    expect(options.body).toContain('grant_type=authorization_code');
    expect(options.body).toContain('code=one-time-code');
    expect(options.body).toContain('redirect_uri=sandbox-ru-name');
  });

  test('callback stores encrypted tokens in TokenVault and returns safe metadata only', async () => {
    process.env.EBAY_SANDBOX_NETWORK_ENABLED = 'true';
    const start = createSandboxAuthorizationStart(accountId, credentialRef);
    const state = new URL(start.authorizationUrl).searchParams.get('state');
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: 'access-secret-value',
        refresh_token: 'refresh-secret-value',
        expires_in: 7200,
        token_type: 'User Access Token'
      })
    }));

    const result = await completeSandboxAuthorizationCallback({
      code: 'one-time-code',
      state,
      fetchImpl: fetchMock
    });

    expect(result.success).toBe(true);
    expect(result.tokensReturnedToBrowser).toBe(false);
    expect(result.authorizationCodeStored).toBe(false);
    expect(result).not.toHaveProperty('accessToken');
    expect(result).not.toHaveProperty('refreshToken');

    const stored = await TokenVault.getDecryptedTokens(accountId, 'Sandbox');
    expect(stored.accessToken).toBe('access-secret-value');
    expect(stored.refreshToken).toBe('refresh-secret-value');
  });

  test('getVersion verification is non-mutating and never returns access token', async () => {
    process.env.EBAY_SANDBOX_NETWORK_ENABLED = 'true';
    await TokenVault.saveTokens(
      accountId,
      'Sandbox',
      'refresh-secret-value',
      'access-secret-value',
      new Date(Date.now() + 3600000).toISOString()
    );

    const fetchMock = jest.fn(async (url, options) => ({
      ok: true,
      status: 200,
      json: async () => ({ version: '1.18.5' })
    }));

    const result = await verifySandboxInventoryVersion(accountId, fetchMock);
    expect(result.success).toBe(true);
    expect(result.mutatingOperation).toBe(false);
    expect(result.tokenReturnedToBrowser).toBe(false);
    expect(result.version).toBe('1.18.5');
    expect(result).not.toHaveProperty('accessToken');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.sandbox.ebay.com/sell/inventory/v1/getVersion');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer access-secret-value');
  });
});
