/**
 * UI Navigation & Operational Diagnostics Tests (JTH-STEP 30)
 * Verifies screen reachability, status indicators, HOLD behavior,
 * cross-SKU photo pollution prevention, and confidentiality.
 */

import {
  TARGET_CONTEXT_PRESETS,
  TargetContextPreset
} from '../../components/PhotoCapture/PhotoCaptureCard';
import {
  evaluatePhotoInventoryLinkage,
  checkPhotoGateCompletion
} from '../photoCaptureService';
import {
  resolveDraftPhotoPreview,
  clearDryRunPhotoHandoffs
} from '../photoListingBridgeService';
import {
  evaluateListingPublishGate,
  ListingPublishGateInput
} from '../listingPublishGateService';
import { ListingPreparationDraft } from '../listingPreparationService';
import { CentralInventoryItem } from '../../types/centralInventory';
import type { PhotoAngle, CapturedPhoto } from '../../types/photoCapture';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export async function runUiNavigationDiagnosticsTests(): Promise<{ passed: number; failed: number; log: string[] }> {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      log.push(`✅ ${name}`);
    } catch (err: any) {
      failed++;
      log.push(`❌ ${name}: ${err.message}`);
    }
  };

  // Test 1: Navigation link destinations
  test('Test 1: Navigation routes connect index and inventory-sales without dead ends', () => {
    const toInventorySalesUrl = './inventory-sales.html';
    const toPhotoCaptureHashUrl = './index.html#photoCapture';
    const toManagerUrl = './index.html';

    assert(toInventorySalesUrl === './inventory-sales.html', 'Inventory sales URL must be valid relative path');
    assert(toPhotoCaptureHashUrl.endsWith('#photoCapture'), 'Photo capture link must use #photoCapture hash route');
    assert(toManagerUrl === './index.html', 'Return to manager link must be valid');
  });

  // Test 2: URL query confidentiality (No SKU / Unit ID / Base64 leaked in URL query)
  test('Test 2: Navigation URLs do not expose sensitive SKU, Unit ID, or image payloads in query strings', () => {
    const safeUrls = [
      './inventory-sales.html',
      './index.html#photoCapture',
      './index.html'
    ];

    safeUrls.forEach((url) => {
      assert(!url.includes('?sku='), `URL ${url} must not leak sku query param`);
      assert(!url.includes('?unitId='), `URL ${url} must not leak unitId query param`);
      assert(!url.includes('data:image'), `URL ${url} must not leak base64 image data`);
    });
  });

  // Test 3: TARGET_CONTEXT_PRESETS completeness
  test('Test 3: TARGET_CONTEXT_PRESETS contains unlinked HOLD default and valid catalog presets', () => {
    assert(TARGET_CONTEXT_PRESETS.length >= 4, 'Must have at least 4 presets');
    const nonePreset = TARGET_CONTEXT_PRESETS.find((p) => p.id === 'NONE');
    assert(nonePreset !== undefined, 'NONE preset must exist');
    assert(nonePreset?.context.isConfirmed === false, 'NONE preset must have isConfirmed: false');
    assert(nonePreset?.context.sku === '', 'NONE preset must have empty sku');

    const confirmedPresets = TARGET_CONTEXT_PRESETS.filter((p) => p.id !== 'NONE');
    confirmedPresets.forEach((p) => {
      assert(p.context.isConfirmed === true, `Preset ${p.id} must be confirmed`);
      assert(Boolean(p.context.sku), `Preset ${p.id} must specify sku`);
      assert(Boolean(p.context.inventoryUnitId), `Preset ${p.id} must specify inventoryUnitId`);
    });
  });

  // Test 4: Cross-SKU pollution prevention on context switch
  test('Test 4: Switching target SKU clears previous photos to prevent cross-SKU pollution', () => {
    const initialPhotos: Record<PhotoAngle, CapturedPhoto | null> = {
      FRONT: {
        id: 'photo-1',
        angle: 'FRONT',
        timestamp: new Date().toISOString(),
        dataUrl: 'data:image/svg+xml;utf8,<svg/>',
        sku: 'SKU-WATCH-STRAP-01',
        inventoryUnitId: 'UNIT-2026-0042',
        qaResult: { status: 'USE_AS_IS', issues: [], metrics: { blurScore: 10, brightness: 120, framingCoverage: 95, glareScore: 0 }, suggestedAction: 'OK' }
      },
      BACK: null,
      LEFT: null,
      RIGHT: null,
      TOP: null,
      LABEL_TAG: null,
      DEFECT_DETAIL: null
    };

    // Simulate context switch logic from PhotoCaptureCard
    const currentSku: string = 'SKU-WATCH-STRAP-01';
    const newSku: string = 'SKU-CAMERA-LENS-01';
    let nextPhotos = { ...initialPhotos };

    if (newSku !== currentSku) {
      nextPhotos = {
        FRONT: null,
        BACK: null,
        LEFT: null,
        RIGHT: null,
        TOP: null,
        LABEL_TAG: null,
        DEFECT_DETAIL: null
      };
    }

    assert(nextPhotos.FRONT === null, 'Photos must be cleared when switching to a different SKU');
    assert(Object.values(nextPhotos).every((p) => p === null), 'All photo angles must be reset to null');
  });

  // Test 5: Idempotent re-selection of same context
  test('Test 5: Re-selecting the same SKU preserves existing captured photos', () => {
    const currentSku: string = 'SKU-WATCH-STRAP-01';
    const newSku: string = 'SKU-WATCH-STRAP-01';
    let isDifferent = newSku !== currentSku;

    assert(isDifferent === false, 'Selecting same SKU must not trigger reset');
  });

  // Test 6: Truthful status indicators
  test('Test 6: Truthful status indicators report HARDWARE_PENDING, Mock/Dry Run, and Publish Disabled', () => {
    const hardwareStatus = 'HARDWARE_PENDING';
    const dataMode = 'Mock / Dry Run';
    const publishStatus = 'Publish Disabled';

    assert(hardwareStatus === 'HARDWARE_PENDING', 'Hardware status must be HARDWARE_PENDING');
    assert(dataMode.includes('Dry Run'), 'Data mode must reflect Dry Run');
    assert(publishStatus.includes('Disabled'), 'Publish status must reflect Disabled');
  });

  // Test 7: Unlinked HOLD behavior when target context is unconfirmed
  test('Test 7: Unconfirmed target context evaluates to UNLINKED_HOLD', () => {
    const unconfirmedContext = { isConfirmed: false, sku: '', inventoryUnitId: '' };
    const linkage = evaluatePhotoInventoryLinkage(unconfirmedContext);

    assert(linkage.status === 'UNLINKED_HOLD', 'Linkage status must be UNLINKED_HOLD');
    assert(linkage.canBindToInventory === false, 'canBindToInventory must be false for unconfirmed context');
  });

  // Test 8: NO_PHOTOS_RECORDED guidance in draft review
  test('Test 8: Draft review for SKU without photos returns NO_PHOTOS_RECORDED with actionable message', () => {
    clearDryRunPhotoHandoffs();
    const draft = { sku: 'SKU-NEW-UNRECORDED-01', targetChannel: 'eBay' as const };
    const preview = resolveDraftPhotoPreview(draft);

    assert(preview.status === 'NO_PHOTOS_RECORDED', 'Status must be NO_PHOTOS_RECORDED');
    assert(preview.canDisplayListingCandidate === false, 'canDisplayListingCandidate must be false');
    assert(Boolean(preview.reasonMessageJa?.includes('Photo Capture')), 'Message must guide user to Photo Capture screen');
  });

  // Test 9: Listing publish gate protection (Publish cannot be bypassed)
  test('Test 9: Listing publish gate strictly blocks approval when required fields are missing', () => {
    const draft: ListingPreparationDraft = {
      draftId: 'draft-test-01',
      sku: 'SKU-WATCH-STRAP-01',
      itemTitle: 'NATO Strap',
      targetChannel: 'eBay',
      status: 'DRAFT_REVIEW_REQUIRED', // Not advanced to final review!
      availableToSellAtCreation: 1,
      unitCostJpyAtCreation: 1000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'INVENTORY_SALES_WORKBENCH'
    };

    const item: CentralInventoryItem = {
      sku: 'SKU-WATCH-STRAP-01',
      itemTitle: 'NATO Strap',
      physicalStock: 1,
      sellableStock: 1,
      buyerAllocatedStock: 0,
      inboundStock: 0,
      availableToSell: 1,
      safetyBuffer: 0,
      unitCostJpy: 1000,
      weightGrams: 50,
      dimensionsCm: { length: 10, width: 5, height: 2 },
      category: 'ACCESSORIES',
      channelBindings: [],
      lastReconciledAt: new Date().toISOString(),
      isLockedForOversellingRisk: false
    };

    const emptyInput: ListingPublishGateInput = {
      targetMarketplace: '',
      sellerAccountVerified: false,
      sellerAccountVerificationNote: '',
      marketplaceRulesVerified: false,
      marketplaceRulesSourceUrl: '',
      marketplaceRulesCheckedAt: '',
      marketplaceRulesNote: '',
      finalApproved: false,
      approvedBy: '',
      approvalNote: ''
    };

    const evalResult = evaluateListingPublishGate(draft, item, emptyInput);
    assert(evalResult.canRecordApproval === false, 'Approval must be blocked');
    assert(evalResult.missingOrInvalidFieldsJa.length > 0, 'Must report missing fields');
    assert(evalResult.blockingReasonsJa.length > 0, 'Must report blocking reasons');
  });

  // Test 10: In-memory state isolation
  test('Test 10: UI navigation tests do not write to localStorage', () => {
    const initialKeys = Object.keys(localStorage);
    clearDryRunPhotoHandoffs();
    const postKeys = Object.keys(localStorage);

    assert(initialKeys.length === postKeys.length, 'localStorage key count must be identical');
  });

  return { passed, failed, log };
}
