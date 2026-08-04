import { EbayDraftItem, EbayDraftState } from '../types/safetyGate';
import { loadFulfillmentPolicies, loadReturnPolicies, loadPaymentPolicies } from './ebayBusinessPolicyService';
import { validateDescriptionTextPolicyConsistency } from './ebayDescriptionEngineService';

const EBAY_DRAFTS_SESSION_KEY = 'zonos_ebay_draft_items';

export function createInitialEbayDrafts(): EbayDraftItem[] {
  const fulPols = loadFulfillmentPolicies();
  const retPols = loadReturnPolicies();
  const payPols = loadPaymentPolicies();

  return [
    {
      id: 'draft-001',
      internalProductId: 'INV-2026-001',
      sku: 'SKU-CAM-001',
      accountId: 'acc_01',
      marketplaceId: 'EBAY_US',
      title: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
      categoryId: '31388',
      categoryName: 'Cameras & Photo > Film Cameras',
      itemAspects: {
        Brand: 'Canon',
        Model: 'Canon AE-1 Program',
        Type: '35mm Film Camera',
        Format: '35 mm',
        FocusType: 'Manual',
        Color: 'Black / Silver',
        CountryOfManufacture: 'Japan'
      },
      conditionDescription: 'Used - Excellent condition. Tested and fully operational.',
      priceUsd: 280,
      priceApproved: true,
      quantity: 3,
      physicalStockConfirmed: true,
      weightGrams: 850,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 12,
      fulfillmentPolicyId: fulPols[0]?.id,
      returnPolicyId: retPols[0]?.id,
      paymentPolicyId: payPols[0]?.id,
      isDdp: false,
      photoRecords: [
        { id: 'p1', url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500', tagType: 'Front', isActualItemConfirmed: true, orderIndex: 1 },
        { id: 'p2', url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500', tagType: 'LabelTag', isActualItemConfirmed: true, orderIndex: 2 }
      ],
      descriptionHtml: 'Shipped directly from Japan with full tracking number provided upon dispatch.',
      draftState: 'READY_TO_PUBLISH',
      complianceResult: '🟢 PASS (All gates cleared)',
      estimatedFeesUsd: 42.0
    }
  ];
}

export function evaluateDraftState(draft: EbayDraftItem): { state: EbayDraftState; reasons: string[] } {
  const reasons: string[] = [];

  if (!draft.photoRecords || draft.photoRecords.length === 0 || !draft.photoRecords.some((p) => p.isActualItemConfirmed)) {
    reasons.push('現物写真が未登録、または現物確認チェックが入っていません。');
    return { state: 'PHOTO_REQUIRED', reasons };
  }

  if (!draft.itemAspects || !draft.itemAspects['Brand'] || !draft.itemAspects['CountryOfManufacture']) {
    reasons.push('必須 Item Specifics (Brand, CountryOfManufacture) が未入力です。');
    return { state: 'IDENTIFICATION_REQUIRED', reasons };
  }

  if (!draft.priceApproved) {
    reasons.push('最終販売価格のユーザー承認 (Price Approval) が完了していません。');
    return { state: 'PRICE_APPROVAL_REQUIRED', reasons };
  }

  if (!draft.fulfillmentPolicyId || !draft.returnPolicyId || !draft.paymentPolicyId) {
    reasons.push('ビジネスポリシー (Fulfillment / Return / Payment) が設定されていません。');
    return { state: 'POLICY_REQUIRED', reasons };
  }

  const fulPols = loadFulfillmentPolicies();
  const retPols = loadReturnPolicies();
  const selectedFul = fulPols.find((p) => p.id === draft.fulfillmentPolicyId);
  const selectedRet = retPols.find((p) => p.id === draft.returnPolicyId);

  const descVal = validateDescriptionTextPolicyConsistency(
    draft.descriptionHtml,
    selectedFul,
    selectedRet,
    draft.isDdp,
    true
  );

  if (!descVal.isValid) {
    reasons.push(...descVal.errors);
    return { state: 'BLOCKED', reasons };
  }

  return { state: 'READY_TO_PUBLISH', reasons: [] };
}

export function loadEbayDraftItems(): EbayDraftItem[] {
  try {
    const raw = sessionStorage.getItem(EBAY_DRAFTS_SESSION_KEY);
    if (!raw) return createInitialEbayDrafts();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialEbayDrafts();
  } catch (e) {
    console.error('Failed to load ebay draft items:', e);
    return createInitialEbayDrafts();
  }
}

export function saveEbayDraftItems(drafts: EbayDraftItem[]): void {
  try {
    sessionStorage.setItem(EBAY_DRAFTS_SESSION_KEY, JSON.stringify(drafts));
  } catch (e) {
    console.error('Failed to save ebay draft items:', e);
  }
}
