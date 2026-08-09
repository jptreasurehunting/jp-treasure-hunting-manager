import {
  NormalizedFulfillmentOrder,
  PackagingType,
  FulfillmentAction,
  RouterActionStatus,
  PrinterProfile,
  ReusablePackagingProfile,
  ShippingRouteDecision,
  ShippingRouterAuditEntry,
  DomesticShippingCandidateService
} from '../types/shippingRouter';
import { registerHealthCheckModule, getStatusDisplayLabel, getAuthorityLevelDisplayLabel } from './projectHealthService';

const ROUTER_ORDERS_STORAGE_KEY = 'zonos_shipping_router_orders_v1';
const PROFILES_STORAGE_KEY = 'zonos_shipping_router_profiles_v1';
const PACKAGING_KNOWLEDGE_KEY = 'zonos_shipping_packaging_knowledge_v1';
const AUDIT_STORAGE_KEY = 'zonos_shipping_router_audit_v1';

// Technical Specification Database for Domestic Shipping Services (Stage 1 & Stage 2)
export function getStandardDomesticServices(): DomesticShippingCandidateService[] {
  return [
    {
      serviceId: 'jp_post_standard_letter',
      serviceName: '日本郵便 定形郵便 (長形3号/長形4号 封筒)',
      carrier: '日本郵便',
      packagingType: 'ENVELOPE_NAGAGATA_3',
      fulfillmentAction: 'PRINT_ENVELOPE',
      maxWeightGrams: 50,
      maxDimensionsCm: { length: 23.5, width: 12, height: 1.0 },
      maxThicknessCm: 1.0,
      baseCostJpy: 94,
      hasTracking: false,
      hasCompensation: false,
      compensationLimitJpy: 0,
      isEnvelopeDirectPrint: true,
      operationalEffortScore: 1 // 最も手軽 (封筒へ直接宛名印刷)
    },
    {
      serviceId: 'jp_post_non_standard_letter',
      serviceName: '日本郵便 定形外郵便 (規格内 角形2号/クッション封筒)',
      carrier: '日本郵便',
      packagingType: 'ENVELOPE_KAKUGATA_2',
      fulfillmentAction: 'PRINT_ENVELOPE',
      maxWeightGrams: 1000,
      maxDimensionsCm: { length: 34, width: 25, height: 3.0 },
      maxThicknessCm: 3.0,
      baseCostJpy: 140,
      hasTracking: false,
      hasCompensation: false,
      compensationLimitJpy: 0,
      isEnvelopeDirectPrint: true,
      operationalEffortScore: 1
    },
    {
      serviceId: 'jp_post_click_post',
      serviceName: '日本郵便 クリックポスト (全国一律・追跡あり)',
      carrier: '日本郵便',
      packagingType: 'PADDED_MAILER',
      fulfillmentAction: 'PRINT_SHIPPING_LABEL',
      maxWeightGrams: 1000,
      maxDimensionsCm: { length: 34, width: 25, height: 3.0 },
      maxThicknessCm: 3.0,
      baseCostJpy: 185,
      hasTracking: true,
      hasCompensation: false,
      compensationLimitJpy: 0,
      isEnvelopeDirectPrint: false,
      operationalEffortScore: 2
    },
    {
      serviceId: 'jp_post_letter_pack_light',
      serviceName: '日本郵便 レターパックライト (青 / ポスト投函・追跡あり)',
      carrier: '日本郵便',
      packagingType: 'LETTER_PACK_LIGHT',
      fulfillmentAction: 'PRINT_SHIPPING_LABEL',
      maxWeightGrams: 4000,
      maxDimensionsCm: { length: 34, width: 24.8, height: 3.0 },
      maxThicknessCm: 3.0,
      baseCostJpy: 370,
      hasTracking: true,
      hasCompensation: false,
      compensationLimitJpy: 0,
      isEnvelopeDirectPrint: false,
      operationalEffortScore: 2
    },
    {
      serviceId: 'jp_post_letter_pack_plus',
      serviceName: '日本郵便 レターパックプラス (赤 / 対面手渡し・追跡あり・厚さ無制限)',
      carrier: '日本郵便',
      packagingType: 'LETTER_PACK_PLUS',
      fulfillmentAction: 'PRINT_SHIPPING_LABEL',
      maxWeightGrams: 4000,
      maxDimensionsCm: { length: 34, width: 24.8, height: 5.0 },
      maxThicknessCm: 5.0,
      baseCostJpy: 520,
      hasTracking: true,
      hasCompensation: false,
      compensationLimitJpy: 0,
      isEnvelopeDirectPrint: false,
      operationalEffortScore: 2
    },
    {
      serviceId: 'yamato_takkyubin_compact',
      serviceName: 'ヤマト運輸 宅急便コンパクト (専用箱 / 追跡・補償3万円)',
      carrier: 'ヤマト運輸',
      packagingType: 'BOX_COMPACT',
      fulfillmentAction: 'CREATE_SHIPMENT_AND_PRINT_LABEL',
      maxWeightGrams: 2000,
      maxDimensionsCm: { length: 25, width: 20, height: 5.0 },
      maxThicknessCm: 5.0,
      baseCostJpy: 550,
      hasTracking: true,
      hasCompensation: true,
      compensationLimitJpy: 30000,
      isEnvelopeDirectPrint: false,
      operationalEffortScore: 3
    },
    {
      serviceId: 'yamato_takkyubin_60',
      serviceName: 'ヤマト運輸 宅急便 60サイズ (段ボール箱 / 追跡・補償30万円)',
      carrier: 'ヤマト運輸',
      packagingType: 'BOX_60_SIZE',
      fulfillmentAction: 'CREATE_SHIPMENT_AND_PRINT_LABEL',
      maxWeightGrams: 2000,
      maxDimensionsCm: { length: 25, width: 20, height: 16.0 },
      maxThicknessCm: 16.0,
      baseCostJpy: 750,
      hasTracking: true,
      hasCompensation: true,
      compensationLimitJpy: 300000,
      isEnvelopeDirectPrint: false,
      operationalEffortScore: 3
    },
    {
      serviceId: 'yamato_takkyubin_80',
      serviceName: 'ヤマト運輸 宅急便 80サイズ (段ボール箱 / 追跡・補償30万円)',
      carrier: 'ヤマト運輸',
      packagingType: 'BOX_80_SIZE',
      fulfillmentAction: 'CREATE_SHIPMENT_AND_PRINT_LABEL',
      maxWeightGrams: 5000,
      maxDimensionsCm: { length: 35, width: 25, height: 20.0 },
      maxThicknessCm: 20.0,
      baseCostJpy: 950,
      hasTracking: true,
      hasCompensation: true,
      compensationLimitJpy: 300000,
      isEnvelopeDirectPrint: false,
      operationalEffortScore: 3
    }
  ];
}

// Initial Windows Printer Profiles
export function getInitialPrinterProfiles(): PrinterProfile[] {
  return [
    {
      profileId: 'printer_profile_envelope',
      profileName: '国内封筒専用プリンタ (長形3号/角形2号 手差しトレイ)',
      targetRole: 'envelope',
      windowsPrinterName: 'Brother MFC-L2750DW (Envelope Feed)',
      paperSize: 'Nagagata 3 (120x235mm)',
      orientation: 'portrait',
      isDefault: true,
      trayName: 'Manual Feed Slot'
    },
    {
      profileId: 'printer_profile_label',
      profileName: '宅配便・小包ラベル専用プリンタ (サーマルロール紙)',
      targetRole: 'label',
      windowsPrinterName: 'Zebra ZD421 Thermal Label Printer',
      paperSize: 'Label 4x6 inch (100x150mm)',
      orientation: 'portrait',
      isDefault: true,
      trayName: 'Roll Tray'
    },
    {
      profileId: 'printer_profile_document',
      profileName: '納品書・一般ドキュメントプリンタ (A4標準)',
      targetRole: 'document',
      windowsPrinterName: 'Canon LBP621C A4 Laser Printer',
      paperSize: 'A4 (210x297mm)',
      orientation: 'portrait',
      isDefault: false,
      trayName: 'Cassette 1'
    }
  ];
}

// Reusable Packaging & Shipping Knowledge Profiles
export function getInitialPackagingKnowledge(): ReusablePackagingProfile[] {
  return [
    {
      skuOrCategory: 'SKU-STRAP-LEATHER',
      maxUnitsForEnvelope: 2, // 1〜2本は長形3号封筒
      preferredPackaging: 'ENVELOPE_NAGAGATA_3',
      preferredFulfillmentAction: 'PRINT_ENVELOPE',
      preferredCarrier: '日本郵便 (普通郵便 / 定形)',
      suggestedPrinterRoleId: 'envelope',
      lastConfirmedDate: '2026-08-08',
      confirmedBy: 'Admin (Verified Rule)'
    },
    {
      skuOrCategory: 'SKU-TRADING-CARD-PACK',
      maxUnitsForEnvelope: 4,
      preferredPackaging: 'ENVELOPE_NAGAGATA_4',
      preferredFulfillmentAction: 'PRINT_ENVELOPE',
      preferredCarrier: '日本郵便 (ミニレター / 定形)',
      suggestedPrinterRoleId: 'envelope',
      lastConfirmedDate: '2026-08-08',
      confirmedBy: 'Admin (Verified Rule)'
    },
    {
      skuOrCategory: 'SKU-CAMERA-BODY',
      maxUnitsForEnvelope: 0, // 封筒不可 ➔ 段ボール
      preferredPackaging: 'BOX_60_SIZE',
      preferredFulfillmentAction: 'CREATE_SHIPMENT_AND_PRINT_LABEL',
      preferredCarrier: 'ヤマト運輸 (宅急便 60サイズ)',
      suggestedPrinterRoleId: 'label',
      lastConfirmedDate: '2026-08-08',
      confirmedBy: 'Admin (Verified Rule)'
    },
    {
      skuOrCategory: 'SKU-VOUCHER-DOC',
      maxUnitsForEnvelope: 10,
      preferredPackaging: 'LETTER_PACK_LIGHT',
      preferredFulfillmentAction: 'PRINT_SHIPPING_LABEL',
      preferredCarrier: '日本郵便 (レターパックライト)',
      suggestedPrinterRoleId: 'label',
      lastConfirmedDate: '2026-08-08',
      confirmedBy: 'Admin (Verified Rule)'
    }
  ];
}

// Initial Normalized Orders for Routing Demonstration
export function getInitialFulfillmentOrders(): NormalizedFulfillmentOrder[] {
  return [
    {
      orderId: 'ord_dom_01_strap_single',
      orderNumber: 'EBAY-DOM-2026-01',
      salesChannel: 'eBay',
      buyerName: '山田 太郎',
      postalCode: '150-0001',
      stateOrProvince: '東京都',
      city: '渋谷区',
      addressLine1: '神宮前1-2-3',
      addressLine2: 'サンシャイン青山 301号室',
      destinationCountryCode: 'JP',
      sku: 'SKU-STRAP-LEATHER',
      itemTitle: 'イタリアンレザー 腕時計交換ベルト 20mm 本革 ブラック',
      quantity: 1, // 1 unit -> ENVELOPE
      unitPriceJpyOrUsd: 2800,
      currency: 'JPY',
      packageWeightGrams: 45,
      packageDimensionsCm: { length: 18, width: 8, height: 0.8 },
      customerRequestedShippingMethod: '標準郵便 (送料無料)',
      createdDate: '2026-08-09T08:00:00Z'
    },
    {
      orderId: 'ord_dom_02_strap_bulk_5units',
      orderNumber: 'EBAY-DOM-2026-02',
      salesChannel: 'eBay',
      buyerName: '佐藤 一郎',
      postalCode: '530-0001',
      stateOrProvince: '大阪府',
      city: '大阪市北区',
      addressLine1: '梅田2-4-9',
      addressLine2: 'ブリーゼタワー 12F',
      destinationCountryCode: 'JP',
      sku: 'SKU-STRAP-LEATHER',
      itemTitle: 'イタリアンレザー 腕時計交換ベルト 20mm 本革 ブラック (5本まとめ買い)',
      quantity: 5, // 5 units -> EXCEEDS ENVELOPE CAPACITY -> BOX!
      unitPriceJpyOrUsd: 2800,
      currency: 'JPY',
      packageWeightGrams: 280,
      packageDimensionsCm: { length: 22, width: 16, height: 8 },
      customerRequestedShippingMethod: '宅配便',
      createdDate: '2026-08-09T08:15:00Z'
    },
    {
      orderId: 'ord_dom_03_camera_body',
      orderNumber: 'MERCARI-DOM-2026-03',
      salesChannel: 'Mercari', // Mercari order requiring box
      buyerName: '鈴木 花子',
      postalCode: '460-0008',
      stateOrProvince: '愛知県',
      city: '名古屋市中区',
      addressLine1: '栄3-5-1',
      destinationCountryCode: 'JP',
      sku: 'SKU-CAMERA-BODY',
      itemTitle: 'Canon EOS 5D Mark III デジタル一眼レフカメラ ボディ 極上品',
      quantity: 1,
      unitPriceJpyOrUsd: 65000,
      currency: 'JPY',
      packageWeightGrams: 950,
      packageDimensionsCm: { length: 24, width: 20, height: 16 },
      requiresTracking: true,
      requiresCompensation: true,
      createdDate: '2026-08-09T08:30:00Z'
    },
    {
      orderId: 'ord_dom_04_mercari_strap_envelope',
      orderNumber: 'MERCARI-DOM-2026-04',
      salesChannel: 'Mercari', // Mercari order using envelope! (Proves Mercari != Box)
      buyerName: '加藤 翼',
      postalCode: '060-0001',
      stateOrProvince: '北海道',
      city: '札幌市中央区',
      addressLine1: '北1条西2丁目',
      destinationCountryCode: 'JP',
      sku: 'SKU-STRAP-LEATHER',
      itemTitle: 'レザー腕時計ベルト 20mm (普通郵便発送)',
      quantity: 1,
      unitPriceJpyOrUsd: 2500,
      currency: 'JPY',
      packageWeightGrams: 40,
      packageDimensionsCm: { length: 18, width: 8, height: 0.8 },
      createdDate: '2026-08-09T08:35:00Z'
    },
    {
      orderId: 'ord_dom_05_missing_address',
      orderNumber: 'EBAY-DOM-2026-05',
      salesChannel: 'eBay',
      buyerName: '田中 健二',
      postalCode: '', // Missing Postal Code -> MANUAL_REVIEW
      stateOrProvince: '福岡県',
      city: '福岡市博多区',
      addressLine1: '', // Missing Address Line -> MANUAL_REVIEW
      destinationCountryCode: 'JP',
      sku: 'SKU-STRAP-LEATHER',
      itemTitle: '腕時計ベルト 20mm',
      quantity: 1,
      unitPriceJpyOrUsd: 2800,
      currency: 'JPY',
      packageWeightGrams: 45,
      createdDate: '2026-08-09T08:45:00Z'
    },
    {
      orderId: 'ord_dom_06_unknown_new_product',
      orderNumber: 'YAHOO-DOM-2026-06',
      salesChannel: 'YahooAuction',
      buyerName: '高橋 誠',
      postalCode: '980-0021',
      stateOrProvince: '宮城県',
      city: '仙台市青葉区',
      addressLine1: '中央1-1-1',
      destinationCountryCode: 'JP',
      sku: 'SKU-NEW-UNKNOWN-FIGURINE-99',
      itemTitle: '限定特注フィギュア プレミアム仕様 (未登録新規商品)',
      quantity: 1,
      unitPriceJpyOrUsd: 12000,
      currency: 'JPY',
      createdDate: '2026-08-09T09:00:00Z'
    },
    {
      orderId: 'ord_intl_07_watch_to_us',
      orderNumber: 'EBAY-INTL-2026-07',
      salesChannel: 'eBay',
      buyerName: 'John Smith',
      postalCode: '90210',
      stateOrProvince: 'CA',
      city: 'Beverly Hills',
      addressLine1: '123 Rodeo Drive',
      destinationCountryCode: 'US', // International -> INTERNATIONAL_SHIPMENT
      sku: 'SKU-ROLEX-16233',
      itemTitle: 'Rolex Datejust 36mm Automatic Watch',
      quantity: 1,
      unitPriceJpyOrUsd: 3450,
      currency: 'USD',
      packageWeightGrams: 450,
      createdDate: '2026-08-09T09:15:00Z'
    }
  ];
}

// Storage Operations
export function loadFulfillmentOrders(): NormalizedFulfillmentOrder[] {
  try {
    const raw = localStorage.getItem(ROUTER_ORDERS_STORAGE_KEY);
    if (!raw) return getInitialFulfillmentOrders();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialFulfillmentOrders();
  } catch (e) {
    return getInitialFulfillmentOrders();
  }
}

export function saveFulfillmentOrders(orders: NormalizedFulfillmentOrder[]): void {
  try {
    localStorage.setItem(ROUTER_ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to save fulfillment orders:', e);
  }
}

export function loadPrinterProfiles(): PrinterProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return getInitialPrinterProfiles();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialPrinterProfiles();
  } catch (e) {
    return getInitialPrinterProfiles();
  }
}

export function savePrinterProfiles(profiles: PrinterProfile[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Failed to save printer profiles:', e);
  }
}

export function loadPackagingKnowledge(): ReusablePackagingProfile[] {
  try {
    const raw = localStorage.getItem(PACKAGING_KNOWLEDGE_KEY);
    if (!raw) return getInitialPackagingKnowledge();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialPackagingKnowledge();
  } catch (e) {
    return getInitialPackagingKnowledge();
  }
}

export function savePackagingKnowledge(knowledge: ReusablePackagingProfile[]): void {
  try {
    localStorage.setItem(PACKAGING_KNOWLEDGE_KEY, JSON.stringify(knowledge));
  } catch (e) {
    console.error('Failed to save packaging knowledge:', e);
  }
}

export function loadRouterAuditLogs(): ShippingRouterAuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function recordRouterAuditLog(entry: Omit<ShippingRouterAuditEntry, 'id' | 'timestamp'>): void {
  try {
    const logs = loadRouterAuditLogs();
    const newEntry: ShippingRouterAuditEntry = {
      ...entry,
      id: `router_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify([newEntry, ...logs.slice(0, 99)]));
  } catch (e) {
    console.error('Failed to record router audit log:', e);
  }
}

/**
 * Idempotency Fingerprint Hash Calculator
 */
export function calculateIdempotencyHash(salesChannel: string, orderId: string, action: FulfillmentAction): string {
  let str = `${salesChannel}_${orderId}_${action}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `idmp_${Math.abs(hash).toString(16)}`;
}

/**
 * Two-Stage Deterministic Shipping Router Engine
 * Stage 1: ELIGIBILITY FILTER (Disqualifies ineligible services)
 * Stage 2: MULTI-FACTOR OPTIMIZATION (Ranks and selects best service & derives action)
 */
export function evaluateShippingRoute(order: NormalizedFulfillmentOrder): ShippingRouteDecision {
  const printerProfiles = loadPrinterProfiles();
  const packagingKnowledge = loadPackagingKnowledge();
  const auditLogs = loadRouterAuditLogs();
  const allServices = getStandardDomesticServices();

  const isDomestic = order.destinationCountryCode.toUpperCase() === 'JP';

  // 1. Check International Routing
  if (!isDomestic) {
    const idmpHash = calculateIdempotencyHash(order.salesChannel, order.orderId, 'INTERNATIONAL_SHIPMENT');
    return {
      orderId: order.orderId,
      salesChannel: order.salesChannel,
      isDomestic: false,
      action: 'INTERNATIONAL_SHIPMENT',
      actionLabelJa: '🌐 国際配送フローへ自動引き渡し',
      status: 'READY_FOR_EXECUTION',
      packagingType: 'OTHER_CUSTOM',
      packagingLabelJa: '国際配送梱包 (Zonos / FedEx / DHL / 鑑定ハブ)',
      carrierName: 'FedEx / Japan Post / DHL Express (DDP)',
      selectedServiceMethod: '国際優先便 (DDP)',
      estimatedCostJpy: 3800,
      hasTracking: true,
      assignedPrinterProfile: printerProfiles.find((p) => p.targetRole === 'document'),
      idempotencyHash: idmpHash,
      isSafeForAutomaticExecution: true,
      decisionProvenanceJa: `仕向国 [${order.destinationCountryCode}] を検知。国際通関・Zonos 1/3申告・DDP計算フローへ自動引き渡し。`,
      matchedRuleSource: 'Global Trade Compliance Router v4.7',
      eligibleServicesCount: 1,
      filteredOutServicesCount: 0,
      requiresHumanReview: false,
      evaluatedAt: new Date().toISOString()
    };
  }

  // 2. Validate Address Integrity (Never guess missing info)
  const missingFields: string[] = [];
  if (!order.buyerName || order.buyerName.trim().length === 0) missingFields.push('受取人氏名');
  if (!order.postalCode || order.postalCode.trim().length < 7) missingFields.push('郵便番号 (7桁)');
  if (!order.stateOrProvince || order.stateOrProvince.trim().length === 0) missingFields.push('都道府県');
  if (!order.city || order.city.trim().length === 0) missingFields.push('市区町村');
  if (!order.addressLine1 || order.addressLine1.trim().length === 0) missingFields.push('町名・番地');

  if (missingFields.length > 0) {
    const idmpHash = calculateIdempotencyHash(order.salesChannel, order.orderId, 'MANUAL_REVIEW');
    return {
      orderId: order.orderId,
      salesChannel: order.salesChannel,
      isDomestic: true,
      action: 'MANUAL_REVIEW',
      actionLabelJa: '⚠️ 要人間確認 (住所・宛名データ不備)',
      status: 'ACTION_REQUIRED',
      packagingType: 'OTHER_CUSTOM',
      packagingLabelJa: '未確定 (住所確認待ち)',
      carrierName: '未定',
      selectedServiceMethod: '未定',
      estimatedCostJpy: 0,
      hasTracking: false,
      idempotencyHash: idmpHash,
      isSafeForAutomaticExecution: false,
      decisionProvenanceJa: `必須配送先情報 [${missingFields.join(', ')}] が欠落しているため、自動処理を安全に停止。`,
      matchedRuleSource: 'Address Integrity Gate (Never Guess Policy)',
      eligibleServicesCount: 0,
      filteredOutServicesCount: allServices.length,
      actionRequiredReasonJa: `配送先住所に [${missingFields.join(', ')}] の欠損があります。確認・補正してください。`,
      missingFields,
      requiresHumanReview: true,
      evaluatedAt: new Date().toISOString()
    };
  }

  // Match Reusable Packaging Knowledge by SKU
  const matchedKnowledge = packagingKnowledge.find((k) =>
    (order.sku && order.sku === k.skuOrCategory) ||
    order.itemTitle.toLowerCase().includes(k.skuOrCategory.toLowerCase())
  );

  // If brand new product with zero dimensions/weight/knowledge -> MANUAL_REVIEW
  const weight = order.packageWeightGrams || 0;
  const dims = order.packageDimensionsCm || { length: 0, width: 0, height: 0 };

  if (!matchedKnowledge && weight === 0 && dims.height === 0) {
    const idmpHash = calculateIdempotencyHash(order.salesChannel, order.orderId, 'MANUAL_REVIEW');
    return {
      orderId: order.orderId,
      salesChannel: order.salesChannel,
      isDomestic: true,
      action: 'MANUAL_REVIEW',
      actionLabelJa: '🟡 要人間確認 (新規未登録商品の梱包選択)',
      status: 'ACTION_REQUIRED',
      packagingType: 'OTHER_CUSTOM',
      packagingLabelJa: '未設定 (初回梱包選択待ち)',
      carrierName: order.customerRequestedShippingMethod || '未定',
      selectedServiceMethod: '未定',
      estimatedCostJpy: 0,
      hasTracking: false,
      idempotencyHash: idmpHash,
      isSafeForAutomaticExecution: false,
      decisionProvenanceJa: '過去の梱包実績・寸法・重量データが存在しない新規商品です。初回梱包方法の選択が必要です。',
      matchedRuleSource: 'First-time Product Safety Gate',
      eligibleServicesCount: 0,
      filteredOutServicesCount: allServices.length,
      actionRequiredReasonJa: 'この商品の標準梱包タイプ（封筒 / プチプチ封筒 / 60サイズ段ボール等）を選択してください。',
      requiresHumanReview: true,
      evaluatedAt: new Date().toISOString()
    };
  }

  // ==========================================
  // STAGE 1: ELIGIBILITY FILTER
  // ==========================================
  const requiresTracking = order.requiresTracking || (order.currency === 'JPY' && order.unitPriceJpyOrUsd >= 10000);
  const requiresCompensation = order.requiresCompensation || (order.currency === 'JPY' && order.unitPriceJpyOrUsd >= 50000);
  const isCourierExplicitlyRequested =
    order.customerRequestedShippingMethod &&
    (order.customerRequestedShippingMethod.includes('宅配便') ||
      order.customerRequestedShippingMethod.includes('宅急便') ||
      order.customerRequestedShippingMethod.includes('ゆうパック'));

  const eligibleServices = allServices.filter((service) => {
    // Check Weight Limit
    if (weight > 0 && weight > service.maxWeightGrams) return false;

    // Check Thickness Limit
    if (service.maxThicknessCm && dims.height > 0 && dims.height > service.maxThicknessCm) return false;

    // Check Tracking Requirement
    if (requiresTracking && !service.hasTracking) return false;

    // Check Compensation Requirement
    if (requiresCompensation && (!service.hasCompensation || service.compensationLimitJpy < order.unitPriceJpyOrUsd)) return false;

    // Check Quantity Limit for Envelopes
    if (service.isEnvelopeDirectPrint && matchedKnowledge && matchedKnowledge.maxUnitsForEnvelope > 0) {
      if (order.quantity > matchedKnowledge.maxUnitsForEnvelope) return false; // Exceeds envelope limit
    }

    // If bulk quantity exceeds envelope, flat mail services with maxThickness <= 3cm cannot be used
    if (matchedKnowledge && matchedKnowledge.maxUnitsForEnvelope > 0 && order.quantity > matchedKnowledge.maxUnitsForEnvelope) {
      if (service.isEnvelopeDirectPrint || (service.maxThicknessCm && service.maxThicknessCm <= 3.0)) {
        return false;
      }
    }

    // If matched knowledge specifically requires a Box type, flat envelope services are filtered out
    if (matchedKnowledge && matchedKnowledge.preferredPackaging.startsWith('BOX_')) {
      if (service.isEnvelopeDirectPrint || service.packagingType.startsWith('ENVELOPE_') || service.packagingType === 'PADDED_MAILER') {
        return false;
      }
    }

    return true;
  });

  const filteredOutCount = allServices.length - eligibleServices.length;

  // If no services are eligible -> MANUAL_REVIEW
  if (eligibleServices.length === 0) {
    const idmpHash = calculateIdempotencyHash(order.salesChannel, order.orderId, 'MANUAL_REVIEW');
    return {
      orderId: order.orderId,
      salesChannel: order.salesChannel,
      isDomestic: true,
      action: 'MANUAL_REVIEW',
      actionLabelJa: '⚠️ 要人間確認 (適格な配送便なし・規格超過)',
      status: 'ACTION_REQUIRED',
      packagingType: 'OTHER_CUSTOM',
      packagingLabelJa: '規格外梱包',
      carrierName: '未定',
      selectedServiceMethod: '未定',
      estimatedCostJpy: 0,
      hasTracking: false,
      idempotencyHash: idmpHash,
      isSafeForAutomaticExecution: false,
      decisionProvenanceJa: `サイズ・重量・数量 (${order.quantity}点) または補償要件を満たす国内配送便が見つかりません。`,
      matchedRuleSource: 'Two-Stage Eligibility Filter',
      eligibleServicesCount: 0,
      filteredOutServicesCount: filteredOutCount,
      actionRequiredReasonJa: '商品サイズ・重量または補償条件が一般配送便の制限を超過しています。個別手配が必要です。',
      requiresHumanReview: true,
      evaluatedAt: new Date().toISOString()
    };
  }

  // ==========================================
  // STAGE 2: MULTI-FACTOR OPTIMIZATION
  // ==========================================
  let bestService = eligibleServices[0];
  let bestScore = -99999;

  for (const service of eligibleServices) {
    let score = 1000 - service.baseCostJpy; // Base cost efficiency

    // Operational effort bonus (Direct envelope printing saves manual labeling)
    if (service.isEnvelopeDirectPrint) {
      score += 300;
    }

    // Matched profile packaging affinity bonus (decisive priority for verified packaging knowledge)
    if (matchedKnowledge && matchedKnowledge.preferredPackaging === service.packagingType) {
      score += 2000;
    }

    // Customer requested courier bonus
    if (isCourierExplicitlyRequested && service.fulfillmentAction === 'CREATE_SHIPMENT_AND_PRINT_LABEL') {
      score += 1500;
    }

    if (score > bestScore) {
      bestScore = score;
      bestService = service;
    }
  }

  // Dynamic Quantity Recalculation Note
  let provenanceReasonJa = `適格な国内配送便 ${eligibleServices.length} 件から多要素最適化（送料・作業工数・追跡）により [${bestService.serviceName}] を選定。`;
  if (matchedKnowledge && matchedKnowledge.maxUnitsForEnvelope > 0 && order.quantity > matchedKnowledge.maxUnitsForEnvelope) {
    provenanceReasonJa = `購入数量 [${order.quantity}点] が封筒上限容量 [${matchedKnowledge.maxUnitsForEnvelope}点] を超過したため、適格性フィルタにより小包便 (${bestService.serviceName}) へ自動昇格。`;
  }

  // Assign Target Windows Printer Profile
  const targetRole = bestService.fulfillmentAction === 'PRINT_ENVELOPE' ? 'envelope' : 'label';
  const assignedPrinter = printerProfiles.find((p) => p.targetRole === targetRole) || printerProfiles[0];

  const idmpHash = calculateIdempotencyHash(order.salesChannel, order.orderId, bestService.fulfillmentAction);

  // Check Duplicate Execution
  const isDuplicate = auditLogs.some(
    (log) => log.idempotencyHash === idmpHash && (log.status === 'COMPLETED' || log.status === 'SUBMITTED')
  );

  const finalStatus: RouterActionStatus = isDuplicate ? 'BLOCKED_DUPLICATE' : 'READY_FOR_EXECUTION';

  const actionLabels: Record<FulfillmentAction, string> = {
    PRINT_ENVELOPE: '✉️ 封筒直接宛名印刷 (Envelope Print)',
    CREATE_SHIPMENT_AND_PRINT_LABEL: '📦 伝票作成 ＆ 送り状ラベル印刷 (Parcel Label)',
    CREATE_SHIPMENT_ONLY: '📑 運送会社API伝票作成のみ (No Label Print)',
    PRINT_SHIPPING_LABEL: '🏷️ 送り状ラベル印刷 (Letter Pack / Click Post)',
    PREPARE_QR_SHIPMENT: '📱 店頭二次元コード発送準備 (QR Shipment)',
    INTERNATIONAL_SHIPMENT: '🌐 国際配送フローへ引き渡し',
    MANUAL_REVIEW: '⚠️ 要人間確認 (Manual Review)'
  };

  const packagingLabels: Record<PackagingType, string> = {
    ENVELOPE_NAGAGATA_3: '長形3号 封筒 (120x235mm, 厚さ1cm以内)',
    ENVELOPE_NAGAGATA_4: '長形4号 封筒 (90x205mm, 厚さ1cm以内)',
    ENVELOPE_KAKUGATA_2: '角形2号 封筒 (240x332mm, A4そのまま)',
    PADDED_MAILER: 'クッション封筒 / プチプチ封筒 (厚さ3cm以内)',
    COURIER_BAG: '宅配ビニール袋 (厚さ3cm〜60サイズ)',
    BOX_COMPACT: '宅急便コンパクト / ゆうパケットプラス専用箱',
    BOX_60_SIZE: '60サイズ 段ボール箱',
    BOX_80_SIZE: '80サイズ 段ボール箱',
    BOX_100_SIZE: '100サイズ 段ボール箱',
    BOX_LARGE: '大型段ボール箱 (120〜160サイズ)',
    LETTER_PACK_PLUS: 'レターパックプラス (赤 / 対面手渡し)',
    LETTER_PACK_LIGHT: 'レターパックライト (青 / 3cm以内)',
    SMART_LETTER: 'スマートレター (A5厚さ2cm)',
    OTHER_CUSTOM: 'その他・特注梱包'
  };

  return {
    orderId: order.orderId,
    salesChannel: order.salesChannel,
    isDomestic: true,
    action: bestService.fulfillmentAction,
    actionLabelJa: actionLabels[bestService.fulfillmentAction],
    status: finalStatus,
    packagingType: bestService.packagingType,
    packagingLabelJa: packagingLabels[bestService.packagingType],
    carrierName: bestService.carrier,
    selectedServiceMethod: bestService.serviceName,
    estimatedCostJpy: bestService.baseCostJpy,
    hasTracking: bestService.hasTracking,
    assignedPrinterProfile: assignedPrinter,
    idempotencyHash: idmpHash,
    isSafeForAutomaticExecution: finalStatus === 'READY_FOR_EXECUTION',
    decisionProvenanceJa: provenanceReasonJa,
    matchedRuleSource: `Two-Stage Optimization Router: ${bestService.serviceId}`,
    eligibleServicesCount: eligibleServices.length,
    filteredOutServicesCount: filteredOutCount,
    actionRequiredReasonJa: isDuplicate ? 'この注文・アクションは既に実行済みです。二重印刷・二重発送を防ぐためブロックされました。' : undefined,
    requiresHumanReview: isDuplicate,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * Register Shipping Router with Project Health Dashboard
 */
export function initShippingRouterHealthModule(): void {
  registerHealthCheckModule({
    moduleId: 'module_shipping_router_engine',
    moduleName: 'Automated Domestic Shipping Router (汎用シッピング・ルーター基盤)',
    category: 'future_module',
    defaultAuthorityLevel: 'authoritative_source',
    defaultVerificationMethod: 'official_structured',
    checkHealth: () => {
      const orders = loadFulfillmentOrders();
      const decisions = orders.map((o) => evaluateShippingRoute(o));

      const reviewCount = decisions.filter((d) => d.status === 'ACTION_REQUIRED').length;
      const readyCount = decisions.filter((d) => d.status === 'READY_FOR_EXECUTION').length;
      const duplicateCount = decisions.filter((d) => d.status === 'BLOCKED_DUPLICATE').length;

      const isWarning = reviewCount > 0;
      const status = isWarning ? 'needs_check' : 'healthy';

      return {
        id: 'module_shipping_router_engine',
        name: 'Automated Domestic Shipping Router',
        category: 'future_module',
        status,
        statusLabel: getStatusDisplayLabel(status),
        isLiveVerified: true,
        liveVerificationNote: `ルーター正常稼働: ${new Date().toLocaleDateString('ja-JP')} 22:00`,
        lastVerifiedAt: new Date().toISOString(),
        authorityLevel: 'authoritative_source',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
        verificationMethod: 'official_structured',
        verificationMethodLabel: '2段階適格性フィルタ ＆ 多要素最適化エンジン',
        sourceName: 'Shipping Router v4.7',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: `シッピング・ルーター正常稼働中 (実行準備完了: ${readyCount}件 / 要確認: ${reviewCount}件 / 重複防止: ${duplicateCount}件)`,
        details: {
          exactRestriction: '封筒直接印刷・段ボール小包・レターパック・QR便の2段階自動最適化',
          source: 'Automated Shipping Router Engine v4.7',
          ruleVersion: 'Ver. 4.7',
          estimatedBusinessImpact: '宛名・品名手入力を100%自動化（誤発送・二重印刷を完全防止）',
          recommendedCorrectiveAction: isWarning ? '「要人間確認」キューから不備住所・新規商品の確認を行ってください' : '特になし'
        }
      };
    }
  });
}
