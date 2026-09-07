import { CentralInventoryItem } from '../types/centralInventory';
import { ListingPreparationDraft } from './listingPreparationService';
import { ListingPublishGateRecord } from './listingPublishGateService';
import { ListingPrePublishCheckRecord } from './listingPrePublishCheckService';
import {
  evaluateStoredListingPublishDryRun,
  ListingPublishDryRunPacket
} from './listingPublishDryRunService';

const LISTING_ADAPTER_SIMULATION_STORAGE_KEY = 'jp_listing_publish_adapter_simulations_v1';
export const LISTING_ADAPTER_SIMULATION_CHANGED_EVENT = 'jp-listing-publish-adapter-simulation-changed';

export type ListingPublishAdapterId =
  | 'EBAY_PUBLISH_ADAPTER_V1'
  | 'SHOPEE_PUBLISH_ADAPTER_V1';

export interface ListingPublishAdapterSimulation {
  simulationId: string;
  adapterId: ListingPublishAdapterId;
  adapterVersion: '1';
  mode: 'SIMULATION_ONLY';
  networkAction: 'NONE';
  sendAllowed: false;
  schemaStatus: 'INTERNAL_PREVIEW_NOT_MARKETPLACE_API_SCHEMA';
  dryRunId: string;
  draftId: string;
  sku: string;
  targetChannel: ListingPublishDryRunPacket['targetChannel'];
  targetMarketplace: string;
  sellerAccountId: string;
  clientRequestKey: string;
  requestFingerprint: string;
  requestPreview: Record<string, unknown>;
  generatedAt: string;
  source: 'INVENTORY_SALES_WORKBENCH';
}

export interface ListingPublishAdapterEvaluation {
  canGenerateSimulation: boolean;
  blockingReasonsJa: string[];
  warningsJa: string[];
}

export interface ListingPublishAdapterSimulationResult {
  success: boolean;
  simulation?: ListingPublishAdapterSimulation;
  evaluation: ListingPublishAdapterEvaluation;
  messageJa: string;
}

export function loadListingPublishAdapterSimulations(): ListingPublishAdapterSimulation[] {
  try {
    const raw = localStorage.getItem(LISTING_ADAPTER_SIMULATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListingPublishAdapterSimulations(simulations: ListingPublishAdapterSimulation[]): void {
  localStorage.setItem(LISTING_ADAPTER_SIMULATION_STORAGE_KEY, JSON.stringify(simulations));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT));
  }
}

function getAdapterId(packet: ListingPublishDryRunPacket): ListingPublishAdapterId | undefined {
  if (packet.targetChannel === 'eBay') return 'EBAY_PUBLISH_ADAPTER_V1';
  if (packet.targetChannel === 'Shopee') return 'SHOPEE_PUBLISH_ADAPTER_V1';
  return undefined;
}

function buildEbayPreview(packet: ListingPublishDryRunPacket): Record<string, unknown> {
  return {
    intent: 'LISTING_CREATE_PREVIEW',
    marketplace: packet.targetMarketplace,
    sellerAccountId: packet.sellerAccountId,
    sku: packet.sku,
    quantity: packet.quantity,
    title: packet.listing.title,
    description: packet.listing.description,
    price: {
      value: packet.listing.priceAmount,
      currency: packet.listing.priceCurrency
    },
    shippingTerms: packet.listing.shippingTerms,
    clientRequestKey: packet.clientRequestKey
  };
}

function buildShopeePreview(packet: ListingPublishDryRunPacket): Record<string, unknown> {
  return {
    intent: 'ITEM_CREATE_PREVIEW',
    marketplace: packet.targetMarketplace,
    sellerAccountId: packet.sellerAccountId,
    item: {
      sku: packet.sku,
      quantity: packet.quantity,
      name: packet.listing.title,
      description: packet.listing.description,
      price: {
        value: packet.listing.priceAmount,
        currency: packet.listing.priceCurrency
      },
      shippingTerms: packet.listing.shippingTerms
    },
    clientRequestKey: packet.clientRequestKey
  };
}

function buildRequestPreview(packet: ListingPublishDryRunPacket): Record<string, unknown> {
  if (packet.targetChannel === 'eBay') return buildEbayPreview(packet);
  if (packet.targetChannel === 'Shopee') return buildShopeePreview(packet);
  return {};
}

export function evaluateListingPublishAdapterSimulation(
  packet: ListingPublishDryRunPacket,
  check: ListingPrePublishCheckRecord | undefined,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined
): ListingPublishAdapterEvaluation {
  const blockingReasonsJa: string[] = [];
  const warningsJa: string[] = [];

  const storedDryRunValidity = evaluateStoredListingPublishDryRun(
    packet,
    check,
    publishGateRecord,
    draft,
    item
  );
  blockingReasonsJa.push(...storedDryRunValidity.reasonsJa);

  if (!storedDryRunValidity.valid) {
    blockingReasonsJa.push('Dry Runが現在の在庫・下書き・承認状態では有効ではありません。');
  }

  if (!getAdapterId(packet)) {
    blockingReasonsJa.push('現在の公開アダプターMVPはeBay・Shopeeのみ対応しています。');
  }

  if (packet.mode !== 'DRY_RUN' || packet.networkAction !== 'NONE') {
    blockingReasonsJa.push('入力パケットが安全なDry Run状態ではありません。');
  }

  warningsJa.push('このアダプターは内部確認用の送信予定形式を生成するだけで、外部通信は行いません。');
  warningsJa.push('requestPreviewはeBay・Shopeeの正式APIリクエスト仕様ではありません。実API接続前に公式仕様との対応付けが必要です。');
  warningsJa.push('APIトークン・パスワード・Secret等の認証情報はこのシミュレーションへ含めません。');

  return {
    canGenerateSimulation: blockingReasonsJa.length === 0,
    blockingReasonsJa: Array.from(new Set(blockingReasonsJa)),
    warningsJa
  };
}

export function generateListingPublishAdapterSimulation(
  packet: ListingPublishDryRunPacket,
  check: ListingPrePublishCheckRecord | undefined,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined,
  simulations: ListingPublishAdapterSimulation[] = loadListingPublishAdapterSimulations()
): ListingPublishAdapterSimulationResult {
  const evaluation = evaluateListingPublishAdapterSimulation(
    packet,
    check,
    publishGateRecord,
    draft,
    item
  );
  const adapterId = getAdapterId(packet);

  if (!evaluation.canGenerateSimulation || !adapterId) {
    return {
      success: false,
      evaluation,
      messageJa: '公開アダプターのシミュレーション生成条件を満たしていません。外部送信は行っていません。'
    };
  }

  const simulation: ListingPublishAdapterSimulation = {
    simulationId: `listing_adapter_sim_${packet.draftId}_${Date.now()}`,
    adapterId,
    adapterVersion: '1',
    mode: 'SIMULATION_ONLY',
    networkAction: 'NONE',
    sendAllowed: false,
    schemaStatus: 'INTERNAL_PREVIEW_NOT_MARKETPLACE_API_SCHEMA',
    dryRunId: packet.dryRunId,
    draftId: packet.draftId,
    sku: packet.sku,
    targetChannel: packet.targetChannel,
    targetMarketplace: packet.targetMarketplace,
    sellerAccountId: packet.sellerAccountId,
    clientRequestKey: packet.clientRequestKey,
    requestFingerprint: packet.requestFingerprint,
    requestPreview: buildRequestPreview(packet),
    generatedAt: new Date().toISOString(),
    source: 'INVENTORY_SALES_WORKBENCH'
  };

  const next = simulations.filter((existing) => existing.draftId !== packet.draftId);
  next.push(simulation);
  saveListingPublishAdapterSimulations(next);

  return {
    success: true,
    simulation,
    evaluation,
    messageJa: `${packet.targetChannel} 用の公開アダプター確認データを生成しました。通信・出品は行っていません。`
  };
}

export function evaluateStoredListingPublishAdapterSimulation(
  simulation: ListingPublishAdapterSimulation,
  packet: ListingPublishDryRunPacket | undefined,
  check: ListingPrePublishCheckRecord | undefined,
  publishGateRecord: ListingPublishGateRecord | undefined,
  draft: ListingPreparationDraft | undefined,
  item: CentralInventoryItem | undefined
): { valid: boolean; reasonsJa: string[] } {
  const reasonsJa: string[] = [];

  if (!packet) {
    reasonsJa.push('対応するDry Runが見つかりません。');
  } else {
    if (packet.dryRunId !== simulation.dryRunId) {
      reasonsJa.push('Dry Runが再生成されています。アダプター確認データも再生成してください。');
    }
    if (packet.requestFingerprint !== simulation.requestFingerprint) {
      reasonsJa.push('Dry Runの送信予定内容がアダプター生成時から変わっています。');
    }

    const current = evaluateListingPublishAdapterSimulation(
      packet,
      check,
      publishGateRecord,
      draft,
      item
    );
    reasonsJa.push(...current.blockingReasonsJa);
  }

  if (simulation.mode !== 'SIMULATION_ONLY' || simulation.networkAction !== 'NONE' || simulation.sendAllowed !== false) {
    reasonsJa.push('保存済みアダプター確認データが安全なシミュレーション状態ではありません。');
  }

  return {
    valid: reasonsJa.length === 0,
    reasonsJa: Array.from(new Set(reasonsJa))
  };
}
