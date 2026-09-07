const TokenVault = require('../security/tokenVault');
const {
  SANDBOX_API_BASE_URL,
  assertSandboxNetworkEnabled
} = require('./ebaySandboxOAuthBackend');

const BULK_UPDATE_PATH = '/sell/inventory/v1/bulk_update_price_quantity';
const GET_OFFERS_PATH = '/sell/inventory/v1/offer';

function createError(code, message, extra = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

function normalize(value) {
  return String(value || '').trim();
}

function assertSandboxInventorySyncWriteEnabled() {
  assertSandboxNetworkEnabled();
  if (process.env.EBAY_SANDBOX_INVENTORY_SYNC_WRITE_ENABLED !== 'true') {
    throw createError(
      'SANDBOX_INVENTORY_SYNC_WRITE_DISABLED',
      'eBay Sandbox inventory synchronization writes are disabled. Set EBAY_SANDBOX_INVENTORY_SYNC_WRITE_ENABLED=true only for an approved Sandbox inventory test.'
    );
  }
}

function validateSyncRequest(request) {
  if (!request || typeof request !== 'object') {
    throw createError('MISSING_SYNC_REQUEST', 'Cross-channel inventory sync request is required.');
  }
  if (request.targetChannel !== 'eBay') {
    throw createError('UNSUPPORTED_SYNC_CHANNEL', 'This Sandbox adapter accepts only eBay inventory sync requests.');
  }

  const requestId = normalize(request.requestId);
  const sellerAccountId = normalize(request.sellerAccountId);
  const sku = normalize(request.sku);
  if (!requestId) throw createError('MISSING_SYNC_REQUEST_ID', 'Inventory sync request ID is required.');
  if (!sellerAccountId) throw createError('MISSING_ACCOUNT_ID', 'eBay Sandbox seller account ID is required.');
  if (!sku) throw createError('MISSING_SKU', 'SKU is required for eBay inventory synchronization.');
  if (!Number.isInteger(request.targetStock) || request.targetStock < 0) {
    throw createError('INVALID_TARGET_STOCK', 'Target stock must be a non-negative integer.');
  }
  if (request.status && request.status !== 'QUEUED' && request.status !== 'FAILED') {
    throw createError('INVALID_SYNC_REQUEST_STATE', 'Only queued or failed inventory sync requests can be retried in Sandbox.');
  }

  return {
    requestId,
    sellerAccountId,
    sku,
    targetStock: request.targetStock
  };
}

async function getSandboxTokens(accountId) {
  const tokens = await TokenVault.getDecryptedTokens(accountId, 'Sandbox');
  if (!tokens || !normalize(tokens.accessToken)) {
    throw createError('SANDBOX_TOKEN_NOT_FOUND', 'No connected eBay Sandbox User Access Token exists for this seller account.');
  }
  const expiresAtMs = Date.parse(tokens.accessTokenExpiresAt || '');
  if (Number.isFinite(expiresAtMs) && expiresAtMs <= Date.now()) {
    throw createError('SANDBOX_ACCESS_TOKEN_EXPIRED', 'The connected eBay Sandbox access token is expired. Reauthorize before inventory synchronization.');
  }
  return tokens;
}

async function fetchOffersBySku(sku, accessToken, fetchImpl) {
  const url = new URL(`${SANDBOX_API_BASE_URL}${GET_OFFERS_PATH}`);
  url.searchParams.set('sku', sku);
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createError('EBAY_GET_OFFERS_FAILED', `eBay Sandbox getOffers failed with HTTP ${response.status}.`);
  }

  const offers = Array.isArray(payload.offers) ? payload.offers : [];
  const publishedOffers = offers.filter((offer) => {
    const status = normalize(offer && offer.status).toUpperCase();
    const listingStatus = normalize(offer && offer.listing && offer.listing.listingStatus).toUpperCase();
    return normalize(offer && offer.offerId) && (status === 'PUBLISHED' || listingStatus === 'ACTIVE');
  });

  if (publishedOffers.length === 0) {
    throw createError(
      'EBAY_PUBLISHED_OFFER_NOT_FOUND',
      'No published eBay Sandbox offer was found for this SKU. Inventory sync was not sent.'
    );
  }

  return publishedOffers;
}

function buildBulkUpdatePayload(sku, targetStock, publishedOffers) {
  return {
    requests: [
      {
        sku,
        shipToLocationAvailability: { quantity: targetStock },
        offers: publishedOffers.map((offer) => ({
          offerId: normalize(offer.offerId),
          availableQuantity: targetStock
        }))
      }
    ]
  };
}

function evaluateBulkUpdateResponse(payload) {
  const responses = Array.isArray(payload && payload.responses) ? payload.responses : [];
  if (responses.length === 0) {
    return {
      success: false,
      errorMessage: 'eBay Sandbox bulkUpdatePriceQuantity returned no per-record response.'
    };
  }

  const failures = responses.filter((entry) => {
    const code = Number(entry && entry.statusCode);
    return !Number.isFinite(code) || code < 200 || code >= 300;
  });

  if (failures.length > 0) {
    const codes = failures.map((entry) => String(entry && entry.statusCode || 'unknown')).join(', ');
    return {
      success: false,
      errorMessage: `eBay Sandbox reported inventory update failure status: ${codes}.`
    };
  }

  return { success: true };
}

async function executeEbaySandboxInventorySync(request, fetchImpl = globalThis.fetch) {
  const normalized = validateSyncRequest(request);
  assertSandboxInventorySyncWriteEnabled();
  if (typeof fetchImpl !== 'function') {
    throw createError('FETCH_UNAVAILABLE', 'Backend fetch implementation is unavailable.');
  }

  const tokens = await getSandboxTokens(normalized.sellerAccountId);
  const publishedOffers = await fetchOffersBySku(normalized.sku, tokens.accessToken, fetchImpl);
  const payload = buildBulkUpdatePayload(normalized.sku, normalized.targetStock, publishedOffers);
  const response = await fetchImpl(`${SANDBOX_API_BASE_URL}${BULK_UPDATE_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responsePayload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createError(
      'EBAY_BULK_UPDATE_FAILED',
      `eBay Sandbox bulkUpdatePriceQuantity failed with HTTP ${response.status}.`,
      { externalWritePerformed: true }
    );
  }

  const evaluated = evaluateBulkUpdateResponse(responsePayload);
  if (!evaluated.success) {
    throw createError('EBAY_BULK_UPDATE_PARTIAL_FAILURE', evaluated.errorMessage, { externalWritePerformed: true });
  }

  return {
    success: true,
    environment: 'Sandbox',
    requestId: normalized.requestId,
    sellerAccountId: normalized.sellerAccountId,
    sku: normalized.sku,
    targetStock: normalized.targetStock,
    updatedOfferIds: publishedOffers.map((offer) => normalize(offer.offerId)),
    operation: 'bulkUpdatePriceQuantity',
    endpoint: BULK_UPDATE_PATH,
    externalWritePerformed: true,
    verifiedByEbayResponse: true,
    tokenReturnedToBrowser: false,
    completedAt: new Date().toISOString(),
    message: 'eBay Sandbox confirmed the inventory quantity update for the inventory item and published offer(s).'
  };
}

module.exports = {
  BULK_UPDATE_PATH,
  GET_OFFERS_PATH,
  assertSandboxInventorySyncWriteEnabled,
  validateSyncRequest,
  buildBulkUpdatePayload,
  evaluateBulkUpdateResponse,
  executeEbaySandboxInventorySync
};
