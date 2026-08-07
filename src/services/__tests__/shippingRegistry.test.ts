/**
 * Unit Test Suite for DDP Shipping Decision System & Registry
 */

import {
  loadShippingRegistry,
  saveShippingRegistry,
  calculateTotalSellerCost,
  calculateDeliveryEstimateRange,
  findCheapestEligibleDdpMethod,
  validateListingPublicationGate,
  generateDdpListingNoticeWording
} from '../shippingRegistryService';
import { ShippingMethod } from '../../types/shippingRegistry';

export function runShippingRegistryTests(): { passed: number; failed: number; log: string[] } {
  const log: string[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      passed++;
      log.push(`✅ [PASS] ${testName}`);
    } else {
      failed++;
      log.push(`❌ [FAIL] ${testName}`);
    }
  };

  // Test 1: Domestic Japan listing (exempt from DDP requirement)
  const gate1 = validateListingPublicationGate(true, 'DDP');
  assert(Boolean(gate1.isValid && gate1.canPublish && gate1.isDomestic), 'Test 1: Domestic Japan listing exempt from DDP requirement');

  // Test 2: International listing with eBay-integrated DDP
  const registry = loadShippingRegistry();
  const eISMethod = registry.find((m) => m.methodId === 'ebay_eIS_std');
  const gate2 = validateListingPublicationGate(false, 'DDP', eISMethod, 1000, { length: 20, width: 15, height: 10 }, true);
  assert(Boolean(gate2.isValid && gate2.canPublish && gate2.ddpClassification === 'ebay_integrated_ddp'), 'Test 2: International listing with eBay-integrated DDP');

  // Test 3: International listing with DDU selected (blocked with Japanese error)
  const gate3 = validateListingPublicationGate(false, 'DDU', eISMethod, 1000, { length: 20, width: 15, height: 10 }, true);
  assert(Boolean(!gate3.isValid && !gate3.canPublish && gate3.errors[0]?.includes('DDUでは出品できません')), 'Test 3: DDU international listing blocked with Japanese error');

  // Test 4: Unknown duty term (blocked with Japanese error)
  const gate4 = validateListingPublicationGate(false, 'UNKNOWN', eISMethod, 1000, { length: 20, width: 15, height: 10 }, true);
  assert(Boolean(!gate4.isValid && !gate4.canPublish && gate4.errors[0]?.includes('関税条件が確認できないため')), 'Test 4: Unknown duty term blocked with Japanese error');

  // Test 5: Future newly added eBay-integrated method
  const customMethod: ShippingMethod = {
    methodId: 'ebay_future_express_ddp',
    carrier: 'eBay Global Super Express',
    serviceName: 'eBay Super Express DDP 2027',
    aliases: ['Super Express'],
    isEbayIntegrated: true,
    dutyTermSupport: ['DDP'],
    ddpHandler: 'ebay_integrated_ddp',
    zonosRequirement: 'not_required',
    supportedDestinationCountries: ['*'],
    excludedDestinationCountries: [],
    minWeightGrams: 1,
    maxWeightGrams: 50000,
    maxDimensionCm: { length: 200, width: 100, height: 100, girth: 350 },
    maxItemValueUsd: 10000,
    restrictedCategories: [],
    trackingLevel: 'full_end_to_end',
    insuranceLevel: 'full',
    signatureAvailable: true,
    rateSource: '1_official_ebay_api',
    transitTimeSource: 'eBay API',
    isActive: true,
    effectiveStartDate: '2026-08-01',
    lastSynchronizedTime: new Date().toISOString()
  };
  saveShippingRegistry([...registry, customMethod]);
  const updatedReg = loadShippingRegistry();
  assert(Boolean(updatedReg.some((m) => m.methodId === 'ebay_future_express_ddp')), 'Test 5: Future newly added eBay-integrated method');

  // Test 6: Disabled eBay-integrated method
  const disabledReg = updatedReg.map((m) => (m.methodId === 'ebay_future_express_ddp' ? { ...m, isActive: false } : m));
  saveShippingRegistry(disabledReg);
  const eval6 = findCheapestEligibleDdpMethod(1000, { length: 20, width: 15, height: 10 }, 'US', 100);
  assert(Boolean(!eval6.allEvaluations.some((e) => e.method.methodId === 'ebay_future_express_ddp' && e.isEligible)), 'Test 6: Disabled method excluded from evaluation');

  // Test 7: Cheapest service based on total seller cost, not base price
  const sampleMethod: ShippingMethod = updatedReg[0];
  const costBreakdown = calculateTotalSellerCost(sampleMethod, 1200, 800); // Value >= 750 adds signature & insurance
  assert(Boolean(costBreakdown.totalSellerCost > costBreakdown.baseShippingCharge && costBreakdown.signatureFee > 0), 'Test 7: Total seller cost includes fuel, insurance & signature');

  // Test 8: Oversize package
  const evalOversize = findCheapestEligibleDdpMethod(1000, { length: 300, width: 100, height: 100 }, 'US', 100);
  assert(Boolean(evalOversize.allEvaluations.every((e) => !e.isEligible || e.ineligibleReasons.some((r) => r.includes('サイズ')))), 'Test 8: Oversize package triggers ineligible reason');

  // Test 9: Overweight package
  const evalOverweight = findCheapestEligibleDdpMethod(100000, { length: 30, width: 20, height: 10 }, 'US', 100); // 100kg
  assert(Boolean(evalOverweight.allEvaluations.every((e) => !e.isEligible || e.ineligibleReasons.some((r) => r.includes('重量')))), 'Test 9: Overweight package triggers ineligible reason');

  // Test 10: Restricted category
  const evalCat = findCheapestEligibleDdpMethod(1000, { length: 20, width: 15, height: 10 }, 'US', 100, 'Hazardous Goods');
  assert(Boolean(evalCat.allEvaluations.some((e) => !e.isEligible && e.ineligibleReasons.some((r) => r.includes('カテゴリー')))), 'Test 10: Restricted category triggers ineligible reason');

  // Test 11: No eligible eBay-integrated method (Fallback to external carriers warning)
  // Clean registry to original
  saveShippingRegistry(registry);
  const evalOversizeEbay = findCheapestEligibleDdpMethod(25000, { length: 115, width: 75, height: 75 }, 'US', 100);
  assert(Boolean(evalOversizeEbay.noEligibleEbayIntegrated && evalOversizeEbay.japaneseErrorMessage?.includes('eBay連携配送では')), 'Test 11: No eligible eBay-integrated method triggers fallback Japanese warning');

  // Test 12: Japan Post plus Zonos Prepay
  const jpZonosMethod = registry.find((m) => m.methodId === 'japanpost_zonos_prepay');
  const gateZonosUnval = validateListingPublicationGate(false, 'DDP', jpZonosMethod, 1000, { length: 20, width: 15, height: 10 }, false);
  assert(Boolean(!gateZonosUnval.isValid && gateZonosUnval.errors[0]?.includes('Zonos Prepay')), 'Test 12: Japan Post seller-managed shipment requires Zonos validation');

  // Test 13: External carrier with DDP (FedEx)
  const fedexMethod = registry.find((m) => m.methodId === 'fedex_connect_plus_ddp');
  assert(Boolean(fedexMethod && fedexMethod.ddpHandler === 'carrier_managed_ddp' && fedexMethod.dutyTermSupport.includes('DDP')), 'Test 13: External carrier FedEx DDP verified');

  // Test 14: DDP Listing Notice Preferred Wording Format
  const noticeWording = generateDdpListingNoticeWording('preferred');
  assert(Boolean(noticeWording.includes('Delivered Duty Paid') && noticeWording.includes('Import duties and taxes are prepaid')), 'Test 14: Default DDP listing notice wording format');

  return { passed, failed, log };
}
