import { ListingPublishAdapterSimulation } from './listingPublishAdapterService';

export type MarketplaceApiMappingVerificationStatus =
  | 'OFFICIAL_VERIFIED_WITH_REQUIRED_INPUTS'
  | 'OFFICIAL_SCHEMA_REVIEW_REQUIRED';

export type MarketplaceFieldMappingStatus =
  | 'MAPPED'
  | 'REQUIRES_INPUT'
  | 'POLICY_RESOLUTION_REQUIRED'
  | 'CATEGORY_DEPENDENT'
  | 'NOT_REQUEST_BODY'
  | 'RESPONSE_DERIVED';

export interface MarketplaceFieldMapping {
  internalField: string;
  apiField: string;
  status: MarketplaceFieldMappingStatus;
  noteJa: string;
}

export interface MarketplaceApiCallPlanStep {
  order: number;
  operationId: string;
  method: 'GET' | 'POST' | 'PUT';
  pathTemplate: string;
  purposeJa: string;
  mappings: MarketplaceFieldMapping[];
}

export interface MarketplaceApiMappingProfile {
  channel: 'eBay' | 'Shopee';
  apiFamily: string;
  apiVersion: string;
  checkedAt: string;
  verificationStatus: MarketplaceApiMappingVerificationStatus;
  networkAction: 'NONE';
  sendAllowed: false;
  officialSources: { label: string; url: string }[];
  callPlan: MarketplaceApiCallPlanStep[];
  requiredAdditionalDataJa: string[];
  notesJa: string[];
}

export interface MarketplaceApiMappingEvaluation {
  profile: MarketplaceApiMappingProfile;
  simulationSafe: boolean;
  canBuildOfficialPayloadAfterRequiredInputs: boolean;
  blockingReasonsJa: string[];
  warningsJa: string[];
}

const EBAY_OFFICIAL_SOURCES = [
  {
    label: 'Inventory API Release Notes',
    url: 'https://developer.ebay.com/api-docs/sell/inventory/static/release-notes.html'
  },
  {
    label: 'Inventory API Overview',
    url: 'https://developer.ebay.com/api-docs/sell/inventory/static/overview.html'
  },
  {
    label: 'Required fields for publishing an offer',
    url: 'https://developer.ebay.com/api-docs/sell/static/inventory/publishing-offers.html'
  },
  {
    label: 'From inventory item to eBay marketplace offer',
    url: 'https://developer.ebay.com/api-docs/sell/static/inventory/inventory-item-to-offer.html'
  }
];

const SHOPEE_OFFICIAL_SOURCES = [
  {
    label: 'Shopee Open Platform',
    url: 'https://open.shopee.com/'
  },
  {
    label: 'Shopee Open Platform FAQ',
    url: 'https://open.shopee.com/faq/92'
  }
];

export const EBAY_API_MAPPING_PROFILE: MarketplaceApiMappingProfile = {
  channel: 'eBay',
  apiFamily: 'Sell Inventory API',
  apiVersion: '1.18.5',
  checkedAt: '2026-09-08',
  verificationStatus: 'OFFICIAL_VERIFIED_WITH_REQUIRED_INPUTS',
  networkAction: 'NONE',
  sendAllowed: false,
  officialSources: EBAY_OFFICIAL_SOURCES,
  callPlan: [
    {
      order: 1,
      operationId: 'createOrReplaceInventoryItem',
      method: 'PUT',
      pathTemplate: '/sell/inventory/v1/inventory_item/{sku}',
      purposeJa: 'SKU単位の商品・在庫情報をeBay Inventory Itemとして作成または置換する。',
      mappings: [
        { internalField: 'sku', apiField: 'path.sku', status: 'MAPPED', noteJa: '自社SKUをパスパラメータへ使用する。' },
        { internalField: 'quantity', apiField: 'availability.shipToLocationAvailability.quantity', status: 'MAPPED', noteJa: '公開予定数量を在庫数量候補として使用する。Offer側availableQuantityを設定する場合はそちらが優先される。' },
        { internalField: 'listing.title', apiField: 'product.title', status: 'MAPPED', noteJa: '出品タイトルを商品タイトルへ対応付ける。' },
        { internalField: 'listing.description', apiField: 'product.description', status: 'MAPPED', noteJa: '商品説明をInventory Itemの商品説明へ対応付ける。' },
        { internalField: '(未保持)', apiField: 'condition', status: 'REQUIRES_INPUT', noteJa: 'eBayの対象カテゴリで利用可能なConditionEnumを取得・選択する必要がある。' },
        { internalField: '(未保持)', apiField: 'product.aspects', status: 'CATEGORY_DEPENDENT', noteJa: 'カテゴリごとのItem SpecificsをTaxonomy等の公式情報で解決する必要がある。' },
        { internalField: '(未保持)', apiField: 'product.imageUrls', status: 'REQUIRES_INPUT', noteJa: '公開前に少なくとも1枚の有効な画像URLが必要。' }
      ]
    },
    {
      order: 2,
      operationId: 'createOffer',
      method: 'POST',
      pathTemplate: '/sell/inventory/v1/offer',
      purposeJa: 'Inventory Itemを特定Marketplace向けの未公開Offerへ変換する。',
      mappings: [
        { internalField: 'sku', apiField: 'sku', status: 'MAPPED', noteJa: 'Inventory Itemと同じSKUを使用する。' },
        { internalField: 'quantity', apiField: 'availableQuantity', status: 'MAPPED', noteJa: 'Offer側の販売数量。設定するとInventory Item側数量より優先される。' },
        { internalField: 'targetMarketplace', apiField: 'marketplaceId', status: 'REQUIRES_INPUT', noteJa: '表示名ではなくeBay正式MarketplaceIdへ解決する必要がある。' },
        { internalField: 'listing.priceAmount + listing.priceCurrency', apiField: 'pricingSummary.price', status: 'MAPPED', noteJa: '価格値と通貨を対応付ける。' },
        { internalField: 'listing.description', apiField: 'listingDescription', status: 'MAPPED', noteJa: 'Offerの出品説明として対応付ける。' },
        { internalField: '(未保持)', apiField: 'format', status: 'REQUIRES_INPUT', noteJa: 'FIXED_PRICE等の正式な出品形式を選択する必要がある。' },
        { internalField: '(未保持)', apiField: 'categoryId', status: 'CATEGORY_DEPENDENT', noteJa: '対象Marketplaceの正式カテゴリIDを決定する必要がある。' },
        { internalField: '(未保持)', apiField: 'merchantLocationKey', status: 'REQUIRES_INPUT', noteJa: 'eBay Inventory LocationのmerchantLocationKeyが必要。' },
        { internalField: 'listing.shippingTerms', apiField: 'listingPolicies.fulfillmentPolicyId', status: 'POLICY_RESOLUTION_REQUIRED', noteJa: '自由記述の配送条件を直接送らず、承認済みFulfillment Policy IDへ解決する。' },
        { internalField: '(未保持)', apiField: 'listingPolicies.paymentPolicyId', status: 'POLICY_RESOLUTION_REQUIRED', noteJa: 'eBay Business PolicyのPayment Policy IDが必要。' },
        { internalField: '(未保持)', apiField: 'listingPolicies.returnPolicyId', status: 'POLICY_RESOLUTION_REQUIRED', noteJa: 'eBay Business PolicyのReturn Policy IDが必要。' },
        { internalField: '(未保持)', apiField: 'listingDuration', status: 'REQUIRES_INPUT', noteJa: '公開前に正式なlistingDurationを決定する必要がある。' },
        { internalField: 'sellerAccountId', apiField: '(OAuth認証コンテキスト)', status: 'NOT_REQUEST_BODY', noteJa: '販売アカウントは通常リクエスト本文ではなく、そのアカウントのOAuth認証で決まる。' }
      ]
    },
    {
      order: 3,
      operationId: 'publishOffer',
      method: 'POST',
      pathTemplate: '/sell/inventory/v1/offer/{offerId}/publish',
      purposeJa: '未公開Offerを実際のeBay Listingへ公開する。',
      mappings: [
        { internalField: '(createOffer応答)', apiField: 'path.offerId', status: 'RESPONSE_DERIVED', noteJa: 'createOffer成功時に返るofferIdを使用する。' }
      ]
    }
  ],
  requiredAdditionalDataJa: [
    'eBay正式MarketplaceId',
    'カテゴリID',
    '商品状態（ConditionEnum）',
    'カテゴリ別Item Specifics / aspects',
    '商品画像URL',
    'merchantLocationKey',
    'Payment Policy ID',
    'Fulfillment Policy ID',
    'Return Policy ID',
    '出品形式（format）',
    'listingDuration'
  ],
  notesJa: [
    'eBay Inventory APIの公式フローはInventory Item作成 → Offer作成 → Offer公開の順。',
    'Inventory APIで作成したListingは、公式ドキュメント上Seller Hub等の別Listing Platformから編集できない制約があるため、実運用設計で要確認。',
    'このProfileは公式仕様への対応表であり、認証情報を保持せず、通信も行わない。'
  ]
};

export const SHOPEE_API_MAPPING_PROFILE: MarketplaceApiMappingProfile = {
  channel: 'Shopee',
  apiFamily: 'Shopee Open Platform',
  apiVersion: 'OFFICIAL_SCHEMA_NOT_YET_VERIFIED',
  checkedAt: '2026-09-08',
  verificationStatus: 'OFFICIAL_SCHEMA_REVIEW_REQUIRED',
  networkAction: 'NONE',
  sendAllowed: false,
  officialSources: SHOPEE_OFFICIAL_SOURCES,
  callPlan: [],
  requiredAdditionalDataJa: [
    '対象マーケットで現在有効な商品作成APIの正式EndpointとVersion',
    '商品作成Requestの必須フィールド',
    'カテゴリ・属性・画像・物流関連の必須条件',
    '認証・署名・Shop識別子の最新仕様',
    '公開後に返る商品IDとエラー構造の最新仕様'
  ],
  notesJa: [
    'Shopee Open Platformの公式サイト自体は確認できたが、今回の自動取得環境では商品作成APIの最新Request Schema本文を十分に取得できなかった。',
    '非公式情報や過去Versionの項目名を推測実装しない。公式Schemaを確認できるまで実API用Payload生成をBLOCKする。',
    '現行のShopee Adapter Simulationは内部Previewのまま維持し、実送信には使用しない。'
  ]
};

export function getMarketplaceApiMappingProfile(
  channel: ListingPublishAdapterSimulation['targetChannel']
): MarketplaceApiMappingProfile {
  return channel === 'eBay' ? EBAY_API_MAPPING_PROFILE : SHOPEE_API_MAPPING_PROFILE;
}

export function evaluateMarketplaceApiMapping(
  simulation: ListingPublishAdapterSimulation
): MarketplaceApiMappingEvaluation {
  const profile = getMarketplaceApiMappingProfile(simulation.targetChannel);
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  const simulationSafe =
    simulation.mode === 'SIMULATION_ONLY' &&
    simulation.networkAction === 'NONE' &&
    simulation.sendAllowed === false;

  if (!simulationSafe) {
    blockingReasonsJa.push('入力された公開アダプター確認データが安全なSimulation状態ではありません。');
  }

  if (profile.verificationStatus === 'OFFICIAL_SCHEMA_REVIEW_REQUIRED') {
    blockingReasonsJa.push(`${profile.channel}の最新公式API Schema確認が未完了のため、実API Payloadへ昇格できません。`);
  }

  if (profile.requiredAdditionalDataJa.length > 0) {
    warningsJa.push(`実API接続前に追加で必要な情報が${profile.requiredAdditionalDataJa.length}項目あります。`);
  }
  warningsJa.push('この評価はAPI項目対応の設計確認のみで、外部送信・認証・出品は実行しません。');

  return {
    profile,
    simulationSafe,
    canBuildOfficialPayloadAfterRequiredInputs:
      simulationSafe && profile.verificationStatus === 'OFFICIAL_VERIFIED_WITH_REQUIRED_INPUTS',
    blockingReasonsJa,
    warningsJa
  };
}
