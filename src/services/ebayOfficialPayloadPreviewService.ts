import { EbayPublishPrerequisiteRecord, evaluateStoredEbayPublishPrerequisites } from './ebayPublishPrerequisiteService';
import { ListingPublishAdapterSimulation } from './listingPublishAdapterService';
import { ListingPublishDryRunPacket } from './listingPublishDryRunService';

const EBAY_OFFICIAL_PAYLOAD_PREVIEW_STORAGE_KEY = 'jp_ebay_official_payload_previews_v1';
export const EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT = 'jp-ebay-official-payload-preview-changed';

export interface EbayOfficialPayloadPreviewStep {
  order: 1 | 2 | 3;
  operationId: 'createOrReplaceInventoryItem' | 'createOffer' | 'publishOffer';
  method: 'PUT' | 'POST';
  pathTemplate: string;
  pathParameters: Record<string, string>;
  requestBody: Record<string, unknown> | null;
  responseDependency?: {
    field: string;
    usedAs: string;
    noteJa: string;
  };
}

export interface EbayOfficialPayloadPreview {
  previewId: string;
  apiFamily: 'eBay Sell Inventory API';
  apiVersion: '1.18.5';
  mode: 'PAYLOAD_PREVIEW_ONLY';
  networkAction: 'NONE';
  sendAllowed: false;
  schemaStatus: 'OFFICIAL_FIELD_MAPPING_PREVIEW_NOT_VALIDATED_BY_EBAY_API';
  authenticationStatus: 'NOT_ATTACHED';
  simulationId: string;
  dryRunId: string;
  prerequisiteRecordId: string;
  draftId: string;
  sku: string;
  sellerAccountIdExecutionContext: string;
  requestFingerprint: string;
  generatedAt: string;
  steps: EbayOfficialPayloadPreviewStep[];
  source: 'INVENTORY_SALES_WORKBENCH';
}

export interface EbayOfficialPayloadPreviewEvaluation {
  canGenerate: boolean;
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface EbayOfficialPayloadPreviewResult {
  success: boolean;
  preview?: EbayOfficialPayloadPreview;
  evaluation: EbayOfficialPayloadPreviewEvaluation;
  messageJa: string;
}

export function loadEbayOfficialPayloadPreviews(): EbayOfficialPayloadPreview[] {
  try {
    const raw = localStorage.getItem(EBAY_OFFICIAL_PAYLOAD_PREVIEW_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEbayOfficialPayloadPreviews(previews: EbayOfficialPayloadPreview[]): void {
  localStorage.setItem(EBAY_OFFICIAL_PAYLOAD_PREVIEW_STORAGE_KEY, JSON.stringify(previews));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT));
  }
}

function buildInventoryItemBody(
  packet: ListingPublishDryRunPacket,
  prerequisite: EbayPublishPrerequisiteRecord
): Record<string, unknown> {
  return {
    availability: {
      shipToLocationAvailability: {
        quantity: packet.quantity
      }
    },
    condition: prerequisite.condition,
    product: {
      title: packet.listing.title,
      description: packet.listing.description,
      aspects: prerequisite.aspects,
      imageUrls: prerequisite.imageUrls
    }
  };
}

function buildOfferBody(
  packet: ListingPublishDryRunPacket,
  prerequisite: EbayPublishPrerequisiteRecord
): Record<string, unknown> {
  return {
    sku: packet.sku,
    marketplaceId: prerequisite.marketplaceId,
    format: prerequisite.format,
    availableQuantity: packet.quantity,
    categoryId: prerequisite.categoryId,
    merchantLocationKey: prerequisite.merchantLocationKey,
    listingDescription: packet.listing.description,
    listingPolicies: {
      fulfillmentPolicyId: prerequisite.fulfillmentPolicyId,
      paymentPolicyId: prerequisite.paymentPolicyId,
      returnPolicyId: prerequisite.returnPolicyId
    },
    pricingSummary: {
      price: {
        value: String(packet.listing.priceAmount),
        currency: packet.listing.priceCurrency
      }
    },
    listingDuration: prerequisite.listingDuration
  };
}

export function evaluateEbayOfficialPayloadPreview(
  packet: ListingPublishDryRunPacket | undefined,
  simulation: ListingPublishAdapterSimulation | undefined,
  prerequisite: EbayPublishPrerequisiteRecord | undefined
): EbayOfficialPayloadPreviewEvaluation {
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  if (!packet) blockingReasonsJa.push('対応するDry Runが見つかりません。');
  if (!simulation) blockingReasonsJa.push('対応するeBay公開アダプターSimulationが見つかりません。');
  if (!prerequisite) blockingReasonsJa.push('確認済みのeBay公開前提条件が見つかりません。');

  if (packet && packet.targetChannel !== 'eBay') {
    blockingReasonsJa.push('Dry Runの対象チャネルがeBayではありません。');
  }

  if (simulation) {
    if (simulation.targetChannel !== 'eBay' || simulation.adapterId !== 'EBAY_PUBLISH_ADAPTER_V1') {
      blockingReasonsJa.push('eBay用の公開アダプターSimulationではありません。');
    }
    if (simulation.mode !== 'SIMULATION_ONLY' || simulation.networkAction !== 'NONE' || simulation.sendAllowed !== false) {
      blockingReasonsJa.push('公開アダプターSimulationが安全な送信禁止状態ではありません。');
    }
  }

  if (prerequisite && simulation) {
    const storedValidity = evaluateStoredEbayPublishPrerequisites(prerequisite, simulation);
    blockingReasonsJa.push(...storedValidity.reasonsJa);
  }

  if (packet && simulation) {
    if (packet.dryRunId !== simulation.dryRunId) {
      blockingReasonsJa.push('Dry Runと公開アダプターSimulationが一致しません。');
    }
    if (packet.requestFingerprint !== simulation.requestFingerprint) {
      blockingReasonsJa.push('Dry RunとSimulationの送信予定内容が一致しません。');
    }
    if (packet.sellerAccountId !== simulation.sellerAccountId) {
      blockingReasonsJa.push('Dry RunとSimulationの販売アカウントが一致しません。');
    }
  }

  if (packet && prerequisite) {
    if (packet.dryRunId !== prerequisite.dryRunId) {
      blockingReasonsJa.push('Dry RunとeBay公開前提条件が一致しません。');
    }
    if (packet.requestFingerprint !== prerequisite.requestFingerprintAtSave) {
      blockingReasonsJa.push('Dry Runの内容が前提条件確認時から変更されています。');
    }
    if (packet.sellerAccountId !== prerequisite.sellerAccountIdAtSave) {
      blockingReasonsJa.push('販売アカウントが前提条件確認時から変更されています。');
    }
  }

  warningsJa.push('このPreviewはeBay Sell Inventory APIの公式項目対応を使った送信予定データですが、eBay APIへ実送信してSchema検証した結果ではありません。');
  warningsJa.push('OAuthアクセストークン等の認証情報は付与・保存しません。販売アカウントは実行時のOAuthコンテキストで確定させます。');
  warningsJa.push('publishOfferのofferIdはcreateOffer成功応答から得るため、Previewではプレースホルダーのままです。');
  warningsJa.push('生成しても外部通信・出品・中央在庫変更は行いません。');

  return {
    canGenerate: blockingReasonsJa.length === 0,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function generateEbayOfficialPayloadPreview(
  packet: ListingPublishDryRunPacket | undefined,
  simulation: ListingPublishAdapterSimulation | undefined,
  prerequisite: EbayPublishPrerequisiteRecord | undefined,
  previews: EbayOfficialPayloadPreview[] = loadEbayOfficialPayloadPreviews()
): EbayOfficialPayloadPreviewResult {
  const evaluation = evaluateEbayOfficialPayloadPreview(packet, simulation, prerequisite);

  if (!evaluation.canGenerate || !packet || !simulation || !prerequisite) {
    return {
      success: false,
      evaluation,
      messageJa: 'eBay正式Payload Previewの生成条件を満たしていないため生成していません。外部通信も行っていません。'
    };
  }

  const preview: EbayOfficialPayloadPreview = {
    previewId: `ebay_payload_preview_${packet.draftId}_${Date.now()}`,
    apiFamily: 'eBay Sell Inventory API',
    apiVersion: '1.18.5',
    mode: 'PAYLOAD_PREVIEW_ONLY',
    networkAction: 'NONE',
    sendAllowed: false,
    schemaStatus: 'OFFICIAL_FIELD_MAPPING_PREVIEW_NOT_VALIDATED_BY_EBAY_API',
    authenticationStatus: 'NOT_ATTACHED',
    simulationId: simulation.simulationId,
    dryRunId: packet.dryRunId,
    prerequisiteRecordId: prerequisite.recordId,
    draftId: packet.draftId,
    sku: packet.sku,
    sellerAccountIdExecutionContext: packet.sellerAccountId,
    requestFingerprint: packet.requestFingerprint,
    generatedAt: new Date().toISOString(),
    steps: [
      {
        order: 1,
        operationId: 'createOrReplaceInventoryItem',
        method: 'PUT',
        pathTemplate: '/sell/inventory/v1/inventory_item/{sku}',
        pathParameters: { sku: packet.sku },
        requestBody: buildInventoryItemBody(packet, prerequisite)
      },
      {
        order: 2,
        operationId: 'createOffer',
        method: 'POST',
        pathTemplate: '/sell/inventory/v1/offer',
        pathParameters: {},
        requestBody: buildOfferBody(packet, prerequisite),
        responseDependency: {
          field: 'offerId',
          usedAs: 'publishOffer path.offerId',
          noteJa: 'createOffer成功応答のofferIdを次工程で使用します。'
        }
      },
      {
        order: 3,
        operationId: 'publishOffer',
        method: 'POST',
        pathTemplate: '/sell/inventory/v1/offer/{offerId}/publish',
        pathParameters: { offerId: '<createOffer response offerId>' },
        requestBody: null
      }
    ],
    source: 'INVENTORY_SALES_WORKBENCH'
  };

  const next = previews.filter((existing) => existing.draftId !== packet.draftId);
  next.push(preview);
  saveEbayOfficialPayloadPreviews(next);

  return {
    success: true,
    preview,
    evaluation,
    messageJa: 'eBay Inventory API向けPayload Previewを生成しました。OAuth認証・通信・出品は行っていません。'
  };
}

export function evaluateStoredEbayOfficialPayloadPreview(
  preview: EbayOfficialPayloadPreview,
  packet: ListingPublishDryRunPacket | undefined,
  simulation: ListingPublishAdapterSimulation | undefined,
  prerequisite: EbayPublishPrerequisiteRecord | undefined
): { valid: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];

  const current = evaluateEbayOfficialPayloadPreview(packet, simulation, prerequisite);
  reasonsJa.push(...current.blockingReasonsJa);

  if (preview.mode !== 'PAYLOAD_PREVIEW_ONLY' || preview.networkAction !== 'NONE' || preview.sendAllowed !== false) {
    reasonsJa.push('保存済みPayload Previewが安全な送信禁止状態ではありません。');
  }
  if (preview.authenticationStatus !== 'NOT_ATTACHED') {
    reasonsJa.push('Payload Previewに認証情報が付与されています。Previewでは認証情報を保持できません。');
  }
  if (!packet || preview.dryRunId !== packet.dryRunId) {
    reasonsJa.push('Dry RunがPayload Preview生成時から変更・消失しています。');
  } else if (preview.requestFingerprint !== packet.requestFingerprint) {
    reasonsJa.push('送信予定内容がPayload Preview生成時から変更されています。');
  }
  if (!simulation || preview.simulationId !== simulation.simulationId) {
    reasonsJa.push('公開アダプターSimulationがPayload Preview生成時から変更・消失しています。');
  }
  if (!prerequisite || preview.prerequisiteRecordId !== prerequisite.recordId) {
    reasonsJa.push('eBay公開前提条件がPayload Preview生成時から変更・消失しています。');
  }

  return {
    valid: reasonsJa.length === 0,
    reasonsJa: Array.from(new Set(reasonsJa))
  };
}
