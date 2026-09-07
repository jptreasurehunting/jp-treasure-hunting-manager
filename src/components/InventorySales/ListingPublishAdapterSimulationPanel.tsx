import React, { useEffect, useMemo, useState } from 'react';
import { CentralInventoryItem } from '../../types/centralInventory';
import {
  LISTING_DRAFTS_CHANGED_EVENT,
  ListingPreparationDraft,
  loadListingPreparationDrafts
} from '../../services/listingPreparationService';
import {
  LISTING_PUBLISH_GATE_CHANGED_EVENT,
  ListingPublishGateRecord,
  loadListingPublishGateRecords
} from '../../services/listingPublishGateService';
import {
  ListingPrePublishCheckRecord,
  loadListingPrePublishChecks,
  PRE_PUBLISH_CHECK_CHANGED_EVENT
} from '../../services/listingPrePublishCheckService';
import {
  LISTING_DRY_RUN_CHANGED_EVENT,
  ListingPublishDryRunPacket,
  loadListingPublishDryRuns
} from '../../services/listingPublishDryRunService';
import {
  evaluateListingPublishAdapterSimulation,
  evaluateStoredListingPublishAdapterSimulation,
  generateListingPublishAdapterSimulation,
  LISTING_ADAPTER_SIMULATION_CHANGED_EVENT,
  ListingPublishAdapterSimulation,
  loadListingPublishAdapterSimulations
} from '../../services/listingPublishAdapterService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(30, 41, 59, 0.95)',
  color: '#f8fafc',
  padding: '9px 10px'
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 9,
  border: '1px solid rgba(129, 140, 248, 0.5)',
  background: 'rgba(67, 56, 202, 0.62)',
  color: '#eef2ff',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 800
};

export function ListingPublishAdapterSimulationPanel({ items }: { items: CentralInventoryItem[] }) {
  const [drafts, setDrafts] = useState<ListingPreparationDraft[]>(() => loadListingPreparationDrafts());
  const [gateRecords, setGateRecords] = useState<ListingPublishGateRecord[]>(() => loadListingPublishGateRecords());
  const [checks, setChecks] = useState<ListingPrePublishCheckRecord[]>(() => loadListingPrePublishChecks());
  const [dryRuns, setDryRuns] = useState<ListingPublishDryRunPacket[]>(() => loadListingPublishDryRuns());
  const [simulations, setSimulations] = useState<ListingPublishAdapterSimulation[]>(() => loadListingPublishAdapterSimulations());
  const [selectedDryRunId, setSelectedDryRunId] = useState(() => dryRuns[0]?.dryRunId ?? '');
  const [message, setMessage] = useState('');

  const selectedPacket = dryRuns.find((packet) => packet.dryRunId === selectedDryRunId) ?? dryRuns[0];
  const selectedCheck = checks.find((check) => check.checkId === selectedPacket?.prePublishCheckId);
  const selectedGate = gateRecords.find((record) => record.recordId === selectedPacket?.publishGateRecordId);
  const selectedDraft = drafts.find((draft) => draft.draftId === selectedPacket?.draftId);
  const selectedItem = items.find((item) => item.sku === selectedPacket?.sku);
  const selectedSimulation = simulations.find((simulation) => simulation.dryRunId === selectedPacket?.dryRunId);

  const evaluation = selectedPacket
    ? evaluateListingPublishAdapterSimulation(
        selectedPacket,
        selectedCheck,
        selectedGate,
        selectedDraft,
        selectedItem
      )
    : undefined;

  const storedValidity = selectedSimulation
    ? evaluateStoredListingPublishAdapterSimulation(
        selectedSimulation,
        selectedPacket,
        selectedCheck,
        selectedGate,
        selectedDraft,
        selectedItem
      )
    : undefined;

  const draftsById = useMemo(() => new Map(drafts.map((draft) => [draft.draftId, draft])), [drafts]);

  const reload = () => {
    const nextDrafts = loadListingPreparationDrafts();
    const nextGateRecords = loadListingPublishGateRecords();
    const nextChecks = loadListingPrePublishChecks();
    const nextDryRuns = loadListingPublishDryRuns();
    const nextSimulations = loadListingPublishAdapterSimulations();
    setDrafts(nextDrafts);
    setGateRecords(nextGateRecords);
    setChecks(nextChecks);
    setDryRuns(nextDryRuns);
    setSimulations(nextSimulations);
    setSelectedDryRunId((current) =>
      nextDryRuns.some((packet) => packet.dryRunId === current)
        ? current
        : (nextDryRuns[0]?.dryRunId ?? '')
    );
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
    window.addEventListener(PRE_PUBLISH_CHECK_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_DRY_RUN_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
      window.removeEventListener(PRE_PUBLISH_CHECK_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_DRY_RUN_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    setMessage('');
  }, [selectedPacket?.dryRunId]);

  const handleGenerate = () => {
    if (!selectedPacket) return;
    const result = generateListingPublishAdapterSimulation(
      selectedPacket,
      selectedCheck,
      selectedGate,
      selectedDraft,
      selectedItem,
      simulations
    );
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Marketplace公開アダプター シミュレーション</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          Dry RunをeBay用・Shopee用の内部送信予定形式へ変換して確認します。外部通信や実出品を行う機能はありません。
        </p>
      </div>

      {dryRuns.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>Dry Runがありません。先に公開リクエストのDry Runを生成してください。</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(190px, 270px)', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>確認するDry Run</label>
              <select style={inputStyle} value={selectedPacket?.dryRunId ?? ''} onChange={(event) => setSelectedDryRunId(event.target.value)}>
                {dryRuns.map((packet) => {
                  const draft = draftsById.get(packet.draftId);
                  return (
                    <option key={packet.dryRunId} value={packet.dryRunId}>
                      {packet.targetChannel} | {packet.targetMarketplace} | {packet.sku} | {draft?.itemTitle ?? '下書き不明'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <span style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>アダプター状態</span>
              <div style={{
                padding: '9px 10px',
                borderRadius: 8,
                background: storedValidity?.valid ? 'rgba(67, 56, 202, 0.38)' : 'rgba(120, 53, 15, 0.35)',
                color: storedValidity?.valid ? '#c7d2fe' : '#fde68a',
                fontWeight: 800
              }}>
                {storedValidity?.valid ? '確認データ有効（送信不可）' : selectedSimulation ? '再生成が必要' : '未生成'}
              </div>
            </div>
          </div>

          {selectedPacket && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.72)', marginBottom: 14, color: '#cbd5e1', fontSize: 12, lineHeight: 1.7 }}>
              <strong style={{ color: '#f8fafc' }}>{selectedPacket.targetChannel}</strong> / {selectedPacket.targetMarketplace} / SKU {selectedPacket.sku}<br />
              販売アカウント: {selectedPacket.sellerAccountId} / 数量: {selectedPacket.quantity}<br />
              Dry Run: {selectedPacket.mode} / Network: {selectedPacket.networkAction}
            </div>
          )}

          {evaluation && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {evaluation.blockingReasonsJa.length > 0 && (
                <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.34)', color: '#fecaca' }}>
                  {evaluation.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
                </div>
              )}
              <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.7)', color: '#94a3b8', fontSize: 12 }}>
                {evaluation.warningsJa.map((warning) => <div key={warning}>・{warning}</div>)}
              </div>
            </div>
          )}

          {storedValidity && storedValidity.reasonsJa.length > 0 && (
            <div style={{ marginBottom: 12, padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.25)', color: '#fecaca', fontSize: 12 }}>
              <strong>保存済み確認データは現在無効です:</strong>
              {storedValidity.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          {selectedSimulation && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                {selectedSimulation.adapterId} / {selectedSimulation.schemaStatus}
              </div>
              <pre style={{ margin: 0, maxHeight: 360, overflow: 'auto', padding: 12, borderRadius: 9, background: 'rgba(2, 6, 23, 0.9)', color: '#cbd5e1', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(selectedSimulation.requestPreview, null, 2)}
              </pre>
            </div>
          )}

          {message && <div aria-live="polite" style={{ marginBottom: 12, color: '#bfdbfe', fontSize: 13 }}>{message}</div>}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={handleGenerate}>アダプター確認データを生成</button>
            <button type="button" style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }} onClick={reload}>再読込</button>
          </div>
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        生成されるrequestPreviewは内部設計用で、Marketplace公式APIの正式スキーマではありません。送信ボタン・認証情報・ネットワーク処理は実装していません。
      </p>
    </section>
  );
}
