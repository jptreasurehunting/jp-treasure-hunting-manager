import type { CrossChannelInventorySyncRequest } from '../crossChannelInventorySyncService';
import {
  BackendSafeError,
  describeBackendError,
  executeEbaySandboxInventorySync
} from '../ebaySandboxBackendClient';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function makeRequest(overrides: Partial<CrossChannelInventorySyncRequest> = {}): CrossChannelInventorySyncRequest {
  return {
    requestId: overrides.requestId ?? 'sync-client-001',
    sourceEventId: overrides.sourceEventId ?? 'sale-event-001',
    sku: overrides.sku ?? 'SKU-CLIENT-001',
    targetChannel: overrides.targetChannel ?? 'eBay',
    sellerAccountId: overrides.sellerAccountId ?? 'ebay-sandbox-main',
    channelListingId: overrides.channelListingId ?? 'listing-001',
    targetStock: overrides.targetStock ?? 0,
    triggerChannel: overrides.triggerChannel ?? 'Shopee',
    triggerOrderId: overrides.triggerOrderId ?? 'order-001',
    reason: overrides.reason ?? 'SALE_RESERVATION',
    status: overrides.status ?? 'QUEUED',
    createdAt: overrides.createdAt ?? '2026-09-08T00:00:00.000Z',
    attemptedAt: overrides.attemptedAt,
    completedAt: overrides.completedAt,
    errorMessage: overrides.errorMessage,
    externalWritePerformed: overrides.externalWritePerformed ?? false
  };
}

export async function runEbaySandboxInventorySyncClientTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  let passed = 0;
  let failed = 0;
  const log: string[] = [];
  const assert = (condition: boolean, name: string) => {
    if (condition) { passed += 1; log.push(`✅ [PASS] ${name}`); }
    else { failed += 1; log.push(`❌ [FAIL] ${name}`); }
  };

  const baseUrl = 'http://localhost:3001';
  const request = makeRequest();
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const result = await executeEbaySandboxInventorySync(request, baseUrl, async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return jsonResponse({
      success: true,
      environment: 'Sandbox',
      requestId: request.requestId,
      sellerAccountId: request.sellerAccountId,
      sku: request.sku,
      targetStock: request.targetStock,
      updatedOfferIds: ['offer-001'],
      operation: 'bulkUpdatePriceQuantity',
      endpoint: '/sell/inventory/v1/bulk_update_price_quantity',
      externalWritePerformed: true,
      verifiedByEbayResponse: true,
      tokenReturnedToBrowser: false,
      completedAt: '2026-09-08T00:01:00.000Z',
      message: 'Sandbox update confirmed.'
    });
  });

  assert(
    capturedUrl === `${baseUrl}/api/ebay/sandbox/inventory/sync` && capturedInit?.method === 'POST',
    'Test 1: eBay Sandbox inventory sync uses the dedicated backend endpoint'
  );
  const body = JSON.parse(String(capturedInit?.body || '{}'));
  assert(
    body.request.requestId === request.requestId && body.request.sku === request.sku && body.request.targetStock === 0,
    'Test 2: Client sends the exact queued absolute-stock request to the backend'
  );
  assert(
    result.externalWritePerformed === true && result.verifiedByEbayResponse === true && result.tokenReturnedToBrowser === false,
    'Test 3: Successful client response requires confirmed Sandbox write and never returns OAuth token'
  );

  let nonEbayFetchCalled = false;
  try {
    await executeEbaySandboxInventorySync(makeRequest({ targetChannel: 'Shopee' }), baseUrl, async () => {
      nonEbayFetchCalled = true;
      return jsonResponse({});
    });
    assert(false, 'Test 4: Non-eBay request should fail before backend communication');
  } catch (error) {
    assert(
      !nonEbayFetchCalled && describeBackendError(error).includes('UNSUPPORTED_SYNC_CHANNEL'),
      'Test 4: Non-eBay queue request is rejected before backend communication'
    );
  }

  let invalidStockFetchCalled = false;
  try {
    await executeEbaySandboxInventorySync(makeRequest({ targetStock: 1.5 }), baseUrl, async () => {
      invalidStockFetchCalled = true;
      return jsonResponse({});
    });
    assert(false, 'Test 5: Fractional stock should fail before backend communication');
  } catch (error) {
    assert(
      !invalidStockFetchCalled && describeBackendError(error).includes('INVALID_TARGET_STOCK'),
      'Test 5: Invalid absolute stock is rejected before backend communication'
    );
  }

  try {
    await executeEbaySandboxInventorySync(request, baseUrl, async () => jsonResponse({
      success: false,
      errorCode: 'SANDBOX_INVENTORY_SYNC_WRITE_DISABLED',
      error: 'Sandbox inventory synchronization writes are disabled.',
      externalWritePerformed: false,
      tokenReturnedToBrowser: false
    }, 503));
    assert(false, 'Test 6: Disabled write gate should reject the client request');
  } catch (error) {
    const safe = error as BackendSafeError;
    assert(
      safe.errorCode === 'SANDBOX_INVENTORY_SYNC_WRITE_DISABLED' && safe.externalWritePerformed === false,
      'Test 6: Pre-write failure preserves externalWritePerformed=false so queue can remain pending'
    );
  }

  try {
    await executeEbaySandboxInventorySync(request, baseUrl, async () => jsonResponse({
      success: false,
      errorCode: 'EBAY_BULK_UPDATE_FAILED',
      error: 'eBay Sandbox bulk update failed.',
      externalWritePerformed: true,
      tokenReturnedToBrowser: false
    }, 502));
    assert(false, 'Test 7: Failed eBay write should reject the client request');
  } catch (error) {
    const safe = error as BackendSafeError;
    assert(
      safe.errorCode === 'EBAY_BULK_UPDATE_FAILED' && safe.externalWritePerformed === true,
      'Test 7: Post-write failure preserves externalWritePerformed=true so central inventory can lock the SKU'
    );
  }

  return { passed, failed, log };
}
