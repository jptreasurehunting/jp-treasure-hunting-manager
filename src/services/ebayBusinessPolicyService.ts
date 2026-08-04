import {
  EbayFulfillmentPolicy,
  EbayReturnPolicy,
  EbayPaymentPolicy
} from '../types/safetyGate';

const FULFILLMENT_POLICIES_SESSION_KEY = 'zonos_ebay_fulfillment_policies';
const RETURN_POLICIES_SESSION_KEY = 'zonos_ebay_return_policies';
const PAYMENT_POLICIES_SESSION_KEY = 'zonos_ebay_payment_policies';

export function createInitialFulfillmentPolicies(): EbayFulfillmentPolicy[] {
  return [
    {
      id: 'pol-ful-001',
      name: 'Japan Post EMS Standard Policy (EBAY_US)',
      description: 'Standard international shipping via Japan Post EMS with tracking.',
      marketplaceId: 'EBAY_US',
      shippingCarrier: 'Japan Post',
      shippingService: 'EMS International',
      isDdp: false,
      estimatedDeliveryDays: '3-7 business days',
      rateUsd: 24.0
    },
    {
      id: 'pol-ful-002',
      name: 'FedEx International Connect Plus DDP (EBAY_US)',
      description: 'Expedited courier service with pre-paid customs (DDP).',
      marketplaceId: 'EBAY_US',
      shippingCarrier: 'FedEx',
      shippingService: 'FedEx International Connect Plus',
      isDdp: true,
      estimatedDeliveryDays: '2-5 business days',
      rateUsd: 32.0
    },
    {
      id: 'pol-ful-003',
      name: 'eBay SpeedPAK Standard (EBAY_US)',
      description: 'eBay SpeedPAK international shipping service.',
      marketplaceId: 'EBAY_US',
      shippingCarrier: 'SpeedPAK',
      shippingService: 'SpeedPAK Standard',
      isDdp: false,
      estimatedDeliveryDays: '7-12 business days',
      rateUsd: 18.0
    }
  ];
}

export function createInitialReturnPolicies(): EbayReturnPolicy[] {
  return [
    {
      id: 'pol-ret-001',
      name: '30 Days Free Returns (Seller Pays)',
      description: 'Standard 30-day domestic & international returns. Seller pays return shipping.',
      marketplaceId: 'EBAY_US',
      returnsAccepted: true,
      returnPeriodDays: 30,
      returnShippingCostPayer: 'Seller'
    },
    {
      id: 'pol-ret-002',
      name: '30 Days Buyer Pays Returns',
      description: '30-day return policy. Buyer pays return shipping.',
      marketplaceId: 'EBAY_US',
      returnsAccepted: true,
      returnPeriodDays: 30,
      returnShippingCostPayer: 'Buyer'
    }
  ];
}

export function createInitialPaymentPolicies(): EbayPaymentPolicy[] {
  return [
    {
      id: 'pol-pay-001',
      name: 'eBay Managed Payments Default (EBAY_US)',
      description: 'eBay Managed Payments (Credit Card, PayPal, Apple Pay, Google Pay).',
      marketplaceId: 'EBAY_US',
      paymentMethods: ['Credit Card', 'PayPal', 'Apple Pay', 'Google Pay']
    }
  ];
}

export function loadFulfillmentPolicies(): EbayFulfillmentPolicy[] {
  try {
    const raw = sessionStorage.getItem(FULFILLMENT_POLICIES_SESSION_KEY);
    if (!raw) return createInitialFulfillmentPolicies();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialFulfillmentPolicies();
  } catch (e) {
    console.error('Failed to load fulfillment policies:', e);
    return createInitialFulfillmentPolicies();
  }
}

export function loadReturnPolicies(): EbayReturnPolicy[] {
  try {
    const raw = sessionStorage.getItem(RETURN_POLICIES_SESSION_KEY);
    if (!raw) return createInitialReturnPolicies();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialReturnPolicies();
  } catch (e) {
    console.error('Failed to load return policies:', e);
    return createInitialReturnPolicies();
  }
}

export function loadPaymentPolicies(): EbayPaymentPolicy[] {
  try {
    const raw = sessionStorage.getItem(PAYMENT_POLICIES_SESSION_KEY);
    if (!raw) return createInitialPaymentPolicies();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialPaymentPolicies();
  } catch (e) {
    console.error('Failed to load payment policies:', e);
    return createInitialPaymentPolicies();
  }
}

export function findMatchingFulfillmentPolicy(name: string): EbayFulfillmentPolicy | undefined {
  const policies = loadFulfillmentPolicies();
  return policies.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase());
}
