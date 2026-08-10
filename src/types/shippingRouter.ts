export type SalesChannel = 'eBay' | 'Mercari' | 'YahooAuction' | 'Shopify' | 'Rakuma' | 'Shopee' | 'ManualDomestic';

export type PackagingType =
  | 'ENVELOPE_NAGAGATA_3' // 長形3号 (120x235mm, 厚さ1cm以内, 50g以内)
  | 'ENVELOPE_NAGAGATA_4' // 長形4号 (90x205mm, 厚さ1cm以内, 25g以内)
  | 'ENVELOPE_KAKUGATA_2' // 角形2号 (240x332mm, A4そのまま)
  | 'PADDED_MAILER' // クッション封筒 / プチプチ封筒 (厚さ3cm以内)
  | 'COURIER_BAG' // 宅配ビニール袋 (厚さ3cm〜60サイズ)
  | 'BOX_COMPACT' // 宅急便コンパクト / ゆうパケットプラス専用箱
  | 'BOX_60_SIZE' // 60サイズ段ボール
  | 'BOX_80_SIZE' // 80サイズ段ボール
  | 'BOX_100_SIZE' // 100サイズ段ボール
  | 'BOX_LARGE' // 120〜160サイズ段ボール
  | 'LETTER_PACK_PLUS' // レターパックプラス (赤 / 対面手渡し)
  | 'LETTER_PACK_LIGHT' // レターパックライト (青 / 4kg以内, 3cm以内)
  | 'SMART_LETTER' // スマートレター (A5, 1kg以内, 2cm以内)
  | 'OTHER_CUSTOM'; // その他・特注梱包

export type FulfillmentAction =
  | 'PRINT_ENVELOPE' // 封筒直接宛名印刷 (封筒発送)
  | 'CREATE_SHIPMENT_AND_PRINT_LABEL' // 運送会社伝票作成 ＆ 送り状ラベル印刷 (段ボール・小包)
  | 'CREATE_SHIPMENT_ONLY' // 運送会社API伝票作成のみ (外部集荷・印刷不要)
  | 'PRINT_SHIPPING_LABEL' // 既存伝票の送り状ラベル印刷 (レターパック/クリックポスト等)
  | 'PREPARE_QR_SHIPMENT' // 店頭発送用QRコード生成 (郵便局/コンビニ)
  | 'INTERNATIONAL_SHIPMENT' // 国際配送フローへ引き渡し (Zonos/FedEx/AG)
  | 'MANUAL_REVIEW'; // 要人間確認 (Action Required: 住所不備・適格配送便なし・数量超過)

export type RouterActionStatus =
  | 'PENDING' // ルーティング判定待ち
  | 'VALIDATING' // バリデーション中
  | 'READY_FOR_EXECUTION' // 実行準備完了 (Phase A)
  | 'SUBMITTED' // 送信済み (Phase B+)
  | 'COMPLETED' // 完了
  | 'BLOCKED_DUPLICATE' // 重複のためブロック
  | 'ACTION_REQUIRED' // 人間確認要求
  | 'FAILED'; // 失敗

export interface PrinterProfile {
  profileId: string; // e.g. 'printer_profile_envelope', 'printer_profile_label'
  profileName: string; // e.g. '封筒専用プリンタ (長形3号/手差しトレイ)'
  targetRole: 'envelope' | 'label' | 'document';
  windowsPrinterName: string; // e.g. 'Brother MFC-L2750DW (Envelope)'
  paperSize: string; // e.g. 'Nagagata 3', 'A4', 'Roll 4x6'
  orientation: 'portrait' | 'landscape';
  isDefault: boolean;
  trayName?: string;
}

export interface NormalizedFulfillmentOrder {
  orderId: string;
  orderNumber: string;
  salesChannel: SalesChannel;
  sellerAccountId?: string;
  buyerName: string;
  postalCode: string; // e.g. '150-0001'
  stateOrProvince: string; // e.g. '東京都'
  city: string; // e.g. '渋谷区'
  addressLine1: string; // e.g. '神宮前1-2-3'
  addressLine2?: string; // e.g. '〇〇ビル 401号室'
  destinationCountryCode: string; // 'JP', 'US', 'DE', etc.
  sku?: string;
  itemTitle: string;
  quantity: number;
  unitPriceJpyOrUsd: number;
  currency: 'JPY' | 'USD' | 'EUR';
  packageWeightGrams?: number;
  packageDimensionsCm?: { length: number; width: number; height: number };
  customerRequestedShippingMethod?: string;
  requiresTracking?: boolean;
  requiresCompensation?: boolean;
  createdDate: string;
}

export interface DomesticShippingCandidateService {
  serviceId: string;
  serviceName: string;
  carrier: string;
  packagingType: PackagingType;
  fulfillmentAction: FulfillmentAction;
  maxWeightGrams: number;
  maxDimensionsCm: { length: number; width: number; height: number };
  maxThicknessCm?: number;
  baseCostJpy: number;
  hasTracking: boolean;
  hasCompensation: boolean;
  compensationLimitJpy: number;
  isEnvelopeDirectPrint: boolean;
  operationalEffortScore: number; // 1 (lowest effort) - 5 (highest effort)
}

export interface ReusablePackagingProfile {
  skuOrCategory: string; // e.g. 'SKU-STRAP-LEATHER', 'TradingCard', 'CameraLens'
  maxUnitsForEnvelope: number; // e.g. 2 units max
  preferredPackaging: PackagingType;
  preferredFulfillmentAction: FulfillmentAction;
  preferredCarrier: string; // e.g. '日本郵便 (普通郵便 / 定形外)', 'ヤマト運輸 (宅急便 60サイズ)'
  suggestedPrinterRoleId: 'envelope' | 'label' | 'document';
  lastConfirmedDate: string;
  confirmedBy: string;
}

export interface ShippingRouteDecision {
  orderId: string;
  salesChannel: SalesChannel;
  isDomestic: boolean;
  action: FulfillmentAction;
  actionLabelJa: string;
  status: RouterActionStatus;
  packagingType: PackagingType;
  packagingLabelJa: string;
  carrierName: string;
  selectedServiceMethod: string;
  estimatedCostJpy: number;
  hasTracking: boolean;
  assignedPrinterProfile?: PrinterProfile;
  idempotencyHash: string; // hash(salesChannel + orderId + action)
  isSafeForAutomaticExecution: boolean;
  decisionProvenanceJa: string;
  matchedRuleSource: string;
  eligibleServicesCount: number;
  filteredOutServicesCount: number;
  actionRequiredReasonJa?: string;
  missingFields?: string[];
  requiresHumanReview: boolean;
  evaluatedAt: string;
}

export interface ShippingRouterAuditEntry {
  id: string;
  timestamp: string;
  orderId: string;
  salesChannel: SalesChannel;
  action: FulfillmentAction;
  status: RouterActionStatus;
  idempotencyHash: string;
  matchedRule: string;
  decisionSummaryJa: string;
  isDuplicateDetected: boolean;
}
