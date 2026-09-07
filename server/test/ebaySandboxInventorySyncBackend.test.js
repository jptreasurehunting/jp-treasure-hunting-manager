const crypto = require('crypto');
const { setDB } = require('../db/database');
const SqliteProvider = require('../db/sqliteProvider');
const TokenVault = require('../security/tokenVault');
const {
  BULK_UPDATE_PATH,
  buildBulkUpdatePayload,
  executeEbaySandboxInventorySync
} = require('../integrations/ebaySandboxInventorySyncBackend');

describe('eBay Sandbox Cross-Channel Inventory Sync Safety', () => {
  let db;
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  const accountId = 'ebay-sandbox-inventory-sync-account';

  beforeAll(async () => {
    db = new SqliteProvider(':memory:');
    await db.initialize();
    setDB(db);
    process.env.ENCRYPTION_KEY = encryptionKey;
  });

  beforeEach(async () => {
    process.env.ENCRYPTION_KEY = encryptionKey;
    process.env.EBAY_SANDBOX_NETWORK_ENABLED = 'true';
    process.env.EBAY_SANDBOX_INVENTORY_SYNC_WRITE_ENABLED = 'true';
    await TokenVault.saveTokens(
      accountId,
      'Sandbox',
      'sandbox-refresh-token',
      'sandbox-access-token',
      new Date(Date.now() + 60 * 60 * 1000).toISOString()
    );
  });

  afterEach(() => {
    process.env.EBAY_SANDBOX_NETWORK_ENABLED = 'false';
    process.env.EBAY_SANDBOX_INVENTORY_SYNC_WRITE_ENABLED = 'false';
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  function makeRequest(overrides = {}) {
    return {
      requestId: overrides.requestId ?? 'inventory-sync-001',
      sourceEventId: overrides.sourceEventId ?? 'sale-event-001',
      sku: overrides.sku ?? 'SKU-SANDBOX-001',
      targetChannel: overrides.targetChannel ?? 'eBay',
      sellerAccountId: overrides.sellerAccountId ?? accountId,
      channelListingId: overrides.channelListingId ?? 'sandbox-listing-001',
      targetStock: overrides.targetStock ?? 0,
      triggerChannel: overrides.triggerChannel ?? 'Shopee',
      reason: overrides.reason ?? 'SALE_RESERVATION',
      status: overrides.status ?? 'QUEUED',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      externalWritePerformed: false
    };
  }

  function response(status, payload) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload
    };
  }

  test('bulk payload updates inventory-level and every published offer to the same absolute stock', () => {
    const payload = buildBulkUpdatePayload('SKU-1', 2, [
      { offerId: 'offer-1' },
      { offerId: 'offer-2' }
    ]);
    expect(payload).toEqual({
      requests: [{
        sku: 'SKU-1',
        shipToLocationAvailability: { quantity: 2 },
        offers: [
          { offerId: 'offer-1', availableQuantity: 2 },
          { offerId: 'offer-2', availableQuantity: 2 }
        ]
      }]
    });
  });

  test('write remains fail-closed unless the separate inventory-sync write flag is enabled', async () => {
    process.env.EBAY_SANDBOX_INVENTORY_SYNC_WRITE_ENABLED = 'false';
    const fetchMock = jest.fn();
    await expect(executeEbaySandboxInventorySync(makeRequest(), fetchMock))
      .rejects.toMatchObject({ code: 'SANDBOX_INVENTORY_SYNC_WRITE_DISABLED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('non-eBay queue requests cannot reach the eBay adapter', async () => {
    const fetchMock = jest.fn();
    await expect(executeEbaySandboxInventorySync(makeRequest({ targetChannel: 'Shopee' }), fetchMock))
      .rejects.toMatchObject({ code: 'UNSUPPORTED_SYNC_CHANNEL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('invalid negative or fractional stock is rejected before network use', async () => {
    const fetchMock = jest.fn();
    await expect(executeEbaySandboxInventorySync(makeRequest({ targetStock: -1 }), fetchMock))
      .rejects.toMatchObject({ code: 'INVALID_TARGET_STOCK' });
    await expect(executeEbaySandboxInventorySync(makeRequest({ targetStock: 1.5 }), fetchMock))
      .rejects.toMatchObject({ code: 'INVALID_TARGET_STOCK' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('published offers are discovered by SKU before any quantity-changing request is sent', async () => {
    const calls = [];
    const fetchMock = jest.fn(async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.includes('/offer?')) {
        return response(200, {
          offers: [
            { offerId: 'offer-live-1', status: 'PUBLISHED', listing: { listingStatus: 'ACTIVE' } },
            { offerId: 'offer-draft', status: 'UNPUBLISHED' }
          ]
        });
      }
      if (url.endsWith(BULK_UPDATE_PATH)) {
        return response(200, { responses: [{ sku: 'SKU-SANDBOX-001', statusCode: 200 }] });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const result = await executeEbaySandboxInventorySync(makeRequest({ targetStock: 0 }), fetchMock);

    expect(result.success).toBe(true);
    expect(result.externalWritePerformed).toBe(true);
    expect(result.verifiedByEbayResponse).toBe(true);
    expect(result.updatedOfferIds).toEqual(['offer-live-1']);
    expect(result.tokenReturnedToBrowser).toBe(false);
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('https://api.sandbox.ebay.com/sell/inventory/v1/offer?sku=SKU-SANDBOX-001');
    expect(calls[1].url).toBe(`https://api.sandbox.ebay.com${BULK_UPDATE_PATH}`);
    const sentBody = JSON.parse(calls[1].init.body);
    expect(sentBody.requests[0].shipToLocationAvailability.quantity).toBe(0);
    expect(sentBody.requests[0].offers).toEqual([{ offerId: 'offer-live-1', availableQuantity: 0 }]);
    expect(JSON.stringify(result)).not.toContain('sandbox-access-token');
  });

  test('no published offer fails before the mutation request', async () => {
    const fetchMock = jest.fn(async () => response(200, { offers: [{ offerId: 'draft', status: 'UNPUBLISHED' }] }));
    await expect(executeEbaySandboxInventorySync(makeRequest(), fetchMock))
      .rejects.toMatchObject({ code: 'EBAY_PUBLISHED_OFFER_NOT_FOUND' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('HTTP mutation failure is reported as an external write attempt and never as synchronized', async () => {
    const fetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/offer?')) {
        return response(200, { offers: [{ offerId: 'offer-1', status: 'PUBLISHED' }] });
      }
      return response(500, { errors: [{ message: 'Sandbox failure' }] });
    });

    await expect(executeEbaySandboxInventorySync(makeRequest(), fetchMock))
      .rejects.toMatchObject({ code: 'EBAY_BULK_UPDATE_FAILED', externalWritePerformed: true });
  });

  test('per-record partial failure is fail-closed even when HTTP status itself is successful', async () => {
    const fetchMock = jest.fn(async (input) => {
      const url = String(input);
      if (url.includes('/offer?')) {
        return response(200, { offers: [{ offerId: 'offer-1', status: 'PUBLISHED' }] });
      }
      return response(200, { responses: [{ sku: 'SKU-SANDBOX-001', statusCode: 400 }] });
    });

    await expect(executeEbaySandboxInventorySync(makeRequest(), fetchMock))
      .rejects.toMatchObject({ code: 'EBAY_BULK_UPDATE_PARTIAL_FAILURE', externalWritePerformed: true });
  });

  test('missing Sandbox token fails before eBay calls', async () => {
    const fetchMock = jest.fn();
    await expect(executeEbaySandboxInventorySync(makeRequest({ sellerAccountId: 'not-connected' }), fetchMock))
      .rejects.toMatchObject({ code: 'SANDBOX_TOKEN_NOT_FOUND' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
