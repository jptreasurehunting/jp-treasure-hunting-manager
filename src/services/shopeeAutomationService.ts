import {
  ShopeeListingCapacity,
  ShopeeAutoListingPolicy,
  ShopeeListingItem,
  ShopeeOptimizationScore,
  ShopeeAutomationAuditRecord
} from '../types/shopeeAutomation';
import { CentralInventoryItem } from '../types/centralInventory';
import { loadCentralInventory } from './centralInventoryService';
import { registerHealthCheckModule } from './projectHealthService';
import { HealthCheckModulePlugin } from '../types/projectHealth';

const CAPACITY_STORAGE_KEY = 'zonos_shopee_listing_capacity_v1';
const POLICY_STORAGE_KEY = 'zonos_shopee_auto_listing_policy_v1';
const LISTINGS_STORAGE_KEY = 'zonos_shopee_active_listings_v1';
const AUDIT_STORAGE_KEY = 'zonos_shopee_automation_audit_v1';

export function getDefaultShopeeCapacity(): ShopeeListingCapacity {
  return {
    sellerAccountId: 'shopee_sg_main',
    marketplaceRegion: 'SG',
    freeListingCapacity: 100, // User's understood assumption (Configurable)
    usedListingCapacity: 96,
    remainingFreeCapacity: 4,
    paidListingRequired: false,
    capacitySource: 'CONFIGURED_ASSUMPTION',
    capacityVerifiedAt: new Date().toISOString(),
    isVerifiedByOfficialDoc: false, // UNKNOWN / REQUIRES VERIFICATION
    warningThreshold: 5
  };
}

export function getDefaultShopeePolicy(): ShopeeAutoListingPolicy {
  return {
    policyVersion: 'shopee_policy_v1.0',
    autoListingEnabled: true,
    autoReplacementEnabled: true,
    maxFreeListingCapacity: 100,
    minExpectedProfitJpy: 1500,
    minOpportunityScore: 70,
    minEvaluationPeriodDays: 30,
    minImpressionThreshold: 100,
    minClickThreshold: 5,
    replacementCooldownDays: 14,
    maxReplacementsPerDay: 5,
    approvedBy: 'Administrator (Policy Pre-Approved)',
    approvedAt: new Date().toISOString(),
    isPolicyApproved: true
  };
}

export function getDefaultShopeeListings(): ShopeeListingItem[] {
  return [
    {
      shopeeItemId: 'shopee_item_sg_2201',
      sku: 'SKU-WATCH-STRAP-01',
      title: 'Italian Leather Watch Strap 20mm Brown',
      priceSgd: 24.5,
      priceJpyEquivalent: 2750,
      stock: 6,
      viewsCount: 340,
      clicksCount: 28,
      salesCount: 3,
      listedAt: '2026-07-01T00:00:00.000Z',
      lastEvaluatedAt: new Date().toISOString(),
      opportunityScore: 88,
      status: 'ACTIVE',
      isReplacementCandidate: false
    },
    {
      shopeeItemId: 'shopee_item_sg_2202',
      sku: 'SKU-VINTAGE-SEIKO-01',
      title: 'Seiko 5 Automatic Vintage Watch 7S26',
      priceSgd: 110.0,
      priceJpyEquivalent: 12500,
      stock: 1,
      viewsCount: 520,
      clicksCount: 45,
      salesCount: 1,
      listedAt: '2026-07-05T00:00:00.000Z',
      lastEvaluatedAt: new Date().toISOString(),
      opportunityScore: 92,
      status: 'ACTIVE',
      isReplacementCandidate: false
    },
    {
      shopeeItemId: 'shopee_item_sg_2203',
      sku: 'SKU-OLD-STRAP-BUCKLE-99',
      title: 'Generic Brass Buckle 18mm Old Stock',
      priceSgd: 6.0,
      priceJpyEquivalent: 680,
      stock: 5,
      viewsCount: 12, // Low views after 30+ days
      clicksCount: 0,
      salesCount: 0,
      listedAt: '2026-06-15T00:00:00.000Z',
      lastEvaluatedAt: new Date().toISOString(),
      opportunityScore: 32, // Low score
      status: 'REPLACEMENT_CANDIDATE',
      isReplacementCandidate: true,
      replacementReasonKey: 'shopee.reason.low_engagement_replaced'
    }
  ];
}

const memStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    if (typeof (globalThis as any).localStorage !== 'undefined') return (globalThis as any).localStorage.getItem(key);
    return memStorage[key] || null;
  } catch (e) {
    return memStorage[key] || null;
  }
}

function safeSetItem(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, val);
      return;
    }
    if (typeof (globalThis as any).localStorage !== 'undefined') {
      (globalThis as any).localStorage.setItem(key, val);
      return;
    }
    memStorage[key] = val;
  } catch (e) {
    memStorage[key] = val;
  }
}

export function loadShopeeCapacity(): ShopeeListingCapacity {
  try {
    const raw = safeGetItem(CAPACITY_STORAGE_KEY);
    if (!raw) {
      const def = getDefaultShopeeCapacity();
      saveShopeeCapacity(def);
      return def;
    }
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultShopeeCapacity();
  }
}

export function saveShopeeCapacity(capacity: ShopeeListingCapacity): void {
  try {
    capacity.remainingFreeCapacity = Math.max(0, capacity.freeListingCapacity - capacity.usedListingCapacity);
    capacity.paidListingRequired = capacity.usedListingCapacity >= capacity.freeListingCapacity;
    safeSetItem(CAPACITY_STORAGE_KEY, JSON.stringify(capacity));
  } catch (e) {
    console.error('Failed to save Shopee capacity:', e);
  }
}

export function loadShopeePolicy(): ShopeeAutoListingPolicy {
  try {
    const raw = safeGetItem(POLICY_STORAGE_KEY);
    if (!raw) {
      const def = getDefaultShopeePolicy();
      saveShopeePolicy(def);
      return def;
    }
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultShopeePolicy();
  }
}

export function saveShopeePolicy(policy: ShopeeAutoListingPolicy): void {
  try {
    safeSetItem(POLICY_STORAGE_KEY, JSON.stringify(policy));
  } catch (e) {
    console.error('Failed to save Shopee policy:', e);
  }
}

export function loadShopeeListings(): ShopeeListingItem[] {
  try {
    const raw = safeGetItem(LISTINGS_STORAGE_KEY);
    if (!raw) {
      const def = getDefaultShopeeListings();
      saveShopeeListings(def);
      return def;
    }
    return JSON.parse(raw);
  } catch (e) {
    return getDefaultShopeeListings();
  }
}

export function saveShopeeListings(listings: ShopeeListingItem[]): void {
  try {
    safeSetItem(LISTINGS_STORAGE_KEY, JSON.stringify(listings));
  } catch (e) {
    console.error('Failed to save Shopee listings:', e);
  }
}

export function loadShopeeAuditLogs(): ShopeeAutomationAuditRecord[] {
  try {
    const raw = safeGetItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

export function saveShopeeAuditLogs(logs: ShopeeAutomationAuditRecord[]): void {
  try {
    safeSetItem(AUDIT_STORAGE_KEY, JSON.stringify(logs.slice(0, 100)));
  } catch (e) {
    console.error('Failed to save Shopee audit logs:', e);
  }
}

/**
 * Multi-Signal Opportunity Scoring Engine for Shopee
 */
export function calculateShopeeOptimizationScore(item: CentralInventoryItem): ShopeeOptimizationScore {
  // 1. eBay Sales Velocity Signal (simulated proxy)
  let velocityScore = 70;
  if (item.category.includes('Watch')) velocityScore = 90;
  if (item.category.includes('Camera')) velocityScore = 80;

  // 2. Expected Margin Signal
  const marginJpy = item.unitCostJpy * 1.5 - item.unitCostJpy;
  const marginPercent = (marginJpy / Math.max(1, item.unitCostJpy)) * 100;
  const profitScore = Math.min(100, Math.round(marginPercent * 1.5));

  // 3. Weight / Dimensions Shipping Penalty for Singapore Air Freight
  let weightPenalty = 0;
  if (item.weightGrams > 500) weightPenalty += 15;
  if (item.dimensionsCm.height > 5.0) weightPenalty += 10;

  const overall = Math.max(0, Math.min(100, Math.round((velocityScore * 0.5 + profitScore * 0.5) - weightPenalty)));

  let action: ShopeeOptimizationScore['recommendationAction'] = 'KEEP_LISTED';
  const reasonCodeKeys: string[] = [];

  if (overall >= 75) {
    action = 'LIST_TO_SHOPEE';
    reasonCodeKeys.push('shopee.reason.high_velocity_score');
  } else if (overall < 40) {
    action = 'REPLACE_CANDIDATE';
    reasonCodeKeys.push('shopee.reason.low_engagement_replaced');
  }

  return {
    sku: item.sku,
    title: item.itemTitle,
    ebaySalesVelocity: velocityScore,
    profitScore,
    weightPenalty,
    overallOpportunityScore: overall,
    recommendationAction: action,
    reasonCodeKeys
  };
}

/**
 * Autonomous Listing Replacement Evaluator (Simulation/Mock Mode)
 */
export function evaluateAutonomousReplacements(): {
  replacementsExecuted: number;
  candidatesFound: number;
  auditLogs: ShopeeAutomationAuditRecord[];
  summaryMessageJa: string;
} {
  const policy = loadShopeePolicy();
  const capacity = loadShopeeCapacity();
  const listings = loadShopeeListings();
  const inventory = loadCentralInventory();
  const newAuditLogs: ShopeeAutomationAuditRecord[] = [];

  if (!policy.isPolicyApproved || !policy.autoListingEnabled) {
    return {
      replacementsExecuted: 0,
      candidatesFound: 0,
      auditLogs: [],
      summaryMessageJa: '⏸️ Shopee自動出品ポリシーが無効または未承認のため自律実行を停止中'
    };
  }

  // 1. Identify poor-performing listing candidates
  let candidatesCount = 0;
  let executedCount = 0;

  listings.forEach((listing) => {
    if (listing.viewsCount < policy.minImpressionThreshold && listing.opportunityScore < policy.minOpportunityScore) {
      listing.isReplacementCandidate = true;
      listing.status = 'REPLACEMENT_CANDIDATE';
      candidatesCount++;

      // If Auto Replacement is enabled and within daily limit
      if (policy.autoReplacementEnabled && executedCount < policy.maxReplacementsPerDay) {
        // Find best candidate from central inventory not yet on Shopee
        const availableCatalog = inventory.filter(
          (inv) => !listings.some((l) => l.sku === inv.sku && l.status === 'ACTIVE') && inv.availableToSell > 0
        );

        if (availableCatalog.length > 0) {
          const bestNewItem = availableCatalog[0];
          const newScore = calculateShopeeOptimizationScore(bestNewItem);

          if (newScore.overallOpportunityScore > listing.opportunityScore) {
            // Execute simulated replacement
            listing.status = 'DELISTED';
            listing.isReplacementCandidate = false;

            const newListing: ShopeeListingItem = {
              shopeeItemId: `shopee_item_sg_auto_${Date.now()}`,
              sku: bestNewItem.sku,
              title: bestNewItem.itemTitle,
              priceSgd: Math.round((bestNewItem.unitCostJpy * 1.6) / 112),
              priceJpyEquivalent: bestNewItem.unitCostJpy * 1.6,
              stock: bestNewItem.availableToSell,
              viewsCount: 0,
              clicksCount: 0,
              salesCount: 0,
              listedAt: new Date().toISOString(),
              lastEvaluatedAt: new Date().toISOString(),
              opportunityScore: newScore.overallOpportunityScore,
              status: 'ACTIVE',
              isReplacementCandidate: false
            };

            listings.push(newListing);
            executedCount++;

            const audit: ShopeeAutomationAuditRecord = {
              auditId: `aud_shopee_rep_${Date.now()}_${executedCount}`,
              timestamp: new Date().toISOString(),
              policyVersion: policy.policyVersion,
              actionType: 'AUTO_REPLACEMENT_EXECUTED',
              sku: bestNewItem.sku,
              replacedSku: listing.sku,
              opportunityScore: newScore.overallOpportunityScore,
              reasonCodeKeys: ['shopee.reason.low_engagement_replaced', 'shopee.reason.high_velocity_score'],
              capacityState: {
                usedCapacity: capacity.usedListingCapacity,
                maxFreeCapacity: capacity.freeListingCapacity,
                remainingFreeCapacity: capacity.remainingFreeCapacity
              },
              isAutomated: true,
              operatorId: 'SYSTEM_SHOPEE_AUTO_ROUTER',
              marketplaceApiResult: {
                success: true,
                shopeeItemId: newListing.shopeeItemId
              }
            };

            newAuditLogs.push(audit);
          }
        }
      }
    }
  });

  saveShopeeListings(listings);
  if (newAuditLogs.length > 0) {
    const existingLogs = loadShopeeAuditLogs();
    saveShopeeAuditLogs([...newAuditLogs, ...existingLogs]);
  }

  return {
    replacementsExecuted: executedCount,
    candidatesFound: candidatesCount,
    auditLogs: newAuditLogs,
    summaryMessageJa: `✅ [自律入替評価完了] 入替候補: ${candidatesCount}件 / 自動入替実行: ${executedCount}件 (ポリシー事前承認範囲内)`
  };
}

/**
 * Project Health Plugin for Shopee Automation
 */
export function initShopeeAutomationHealthModule(): void {
  registerHealthCheckModule({
    moduleId: 'module_shopee_automation_engine',
    moduleName: 'Shopee 自動出品 ＆ 出品枠最適化エンジン (Policy-Based)',
    category: 'future_module',
    defaultAuthorityLevel: 'admin_approved',
    defaultVerificationMethod: 'admin_approved_rule',
    checkHealth: () => {
      const capacity = loadShopeeCapacity();
      const isWarning = !capacity.isVerifiedByOfficialDoc;
      const status = isWarning ? 'needs_check' : 'healthy';

      return {
        id: 'module_shopee_automation_engine',
        name: 'Shopee Auto-Listing & Capacity Engine',
        category: 'future_module',
        status,
        statusLabel: isWarning ? '🟡 要確認' : '✅ 正常',
        isLiveVerified: !isWarning,
        liveVerificationNote: isWarning ? '上限情報: UNKNOWN / 仮定値' : '上限情報: 公式API検証済み',
        lastVerifiedAt: new Date().toISOString(),
        authorityLevel: isWarning ? 'unverified' : 'admin_approved',
        authorityLevelLabel: isWarning ? 'D. 未検証情報 (仮定値)' : 'B. 管理者承認済みポリシー解釈',
        verificationMethod: isWarning ? 'unsupported_live' : 'admin_approved_rule',
        verificationMethodLabel: '事前承認ポリシー駆動 自律入替エンジン',
        sourceName: 'Shopee Automation Engine v1.0',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: isWarning
          ? `🟡 Shopee出品枠 (${capacity.freeListingCapacity}品) は未検証の仮定値です (残り${capacity.remainingFreeCapacity}枠)`
          : `✅ Shopee自動出品基盤 正常稼働中 (使用中: ${capacity.usedListingCapacity}/${capacity.freeListingCapacity})`,
        details: {
          exactRestriction: '管理者事前承認ポリシー範囲内での自律出品・入替（上限超過時は停止）',
          source: 'Shopee Automation Service',
          ruleVersion: 'Ver. 1.0',
          recommendedCorrectiveAction: isWarning ? 'Shopee Seller Centre にて実際の無料出品枠上限を確認してください' : '特になし'
        }
      };
    }
  });
}
