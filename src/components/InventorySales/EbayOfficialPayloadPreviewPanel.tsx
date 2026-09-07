import React, { useEffect, useMemo, useState } from 'react';
import {
  EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT,
  EbayOfficialPayloadPreview,
  evaluateEbayOfficialPayloadPreview,
  evaluateStoredEbayOfficialPayloadPreview,
  generateEbayOfficialPayloadPreview,
  loadEbayOfficialPayloadPreviews
} from '../../services/ebayOfficialPayloadPreviewService';
import {
  EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT,
  EbayPublishPrerequisiteRecord,
  loadEbayPublishPrerequisites
} from '../../services/ebayPublishPrerequisiteService';
import {
  LISTING_ADAPTER_SIMULATION_CHANGED_EVENT,
  ListingPublishAdapterSimulation,
  loadListingPublishAdapterSimulations
} from '../../services/listingPublishAdapterService';
import {
  LISTING_DRY_RUN_CHANGED_EVENT,
  ListingPublishDryRunPacket,
  loadListingPublishDryRuns
} from '../../services/listingPublishDryRunService';

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
  border: '1px solid rgba(34, 197, 94, 0.45)',
  background: 'rgba(21, 128, 61, 0.62)',
  color: '#f0fdf4',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 800
};

export function EbayOfficialPayloadPreviewPanel() {
  const [prerequisites, setPrerequisites] = useState<EbayPublishPrerequisiteRecord[]>(() => loadEbayPublishPrerequisites());
  const [simulations, setSimulations] = useState<ListingPublishAdapterSimulation[]>(() => loadListingPublishAdapterSimulations());
  const [dryRuns, setDryRuns] = useState<ListingPublishDryRunPacket[]>(() => loadListingPublishDryRuns());
  const [previews, setPreviews] = useState<EbayOfficialPayloadPreview[]>(() => loadEbayOfficialPayloadPreviews());
  const [selectedPrerequisiteId, setSelectedPrerequisiteId] = useState(() => prerequisites[0]?.recordId ?? '');
  const [message, setMessage] = useState('');

  const selectedPrerequisite = prerequisites.find((record) => record.recordId === selectedPrerequisiteId) ?? prerequisites[0];
  const selectedSimulation = selectedPrerequisite
    ? simulations.find((simulation) => simulation.simulationId === selectedPrerequisite.simulationId)
    : undefined;
  const selectedDryRun = selectedPrerequisite
    ? dryRuns.find((packet) => packet.dryRunId === selectedPrerequisite.dryRunId)
    : undefined;
  const selectedPreview = selectedPrerequisite
    ? previews.find((preview) => preview.prerequisiteRecordId === selectedPrerequisite.recordId)
    : undefined;

  const evaluation = useMemo(
    () => evaluateEbayOfficialPayloadPreview(selectedDryRun, selectedSimulation, selectedPrerequisite),
    [selectedDryRun, selectedSimulation, selectedPrerequisite]
  );

  const storedValidity = useMemo(
    () => selectedPreview
      ? evaluateStoredEbayOfficialPayloadPreview(selectedPreview, selectedDryRun, selectedSimulation, selectedPrerequisite)
      : undefined,
    [selectedPreview, selectedDryRun, selectedSimulation, selectedPrerequisite]
  );

  const reload = () => {
    const nextPrerequisites = loadEbayPublishPrerequisites();
    setPrerequisites(nextPrerequisites);
    setSimulations(loadListingPublishAdapterSimulations());
    setDryRuns(loadListingPublishDryRuns());
    setPreviews(loadEbayOfficialPayloadPreviews());
    setSelectedPrerequisiteId((current) =>
      nextPrerequisites.some((record) => record.recordId === current)
        ? current
        : (nextPrerequisites[0]?.recordId ?? '')
    );
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_DRY_RUN_CHANGED_EVENT, handler);
    window.addEventListener(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_DRY_RUN_CHANGED_EVENT, handler);
      window.removeEventListener(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT, handler);
    };
  }, []);

  const handleGenerate = () => {
    const result = generateEbayOfficialPayloadPreview(
      selectedDryRun,
      selectedSimulation,
      selectedPrerequisite,
      previews
    );
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>eBay 正式Payload Preview</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
        確認済みのDry RunとeBay公開前提条件を合成し、Inventory APIへ送る予定の3段階Payloadを確認します。
        OAuth認証・API通信・出品は実行しません。
      </p>

      {prerequisites.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>
          確認済みeBay公開前提条件がありません。先に「eBay 公開前提条件」を完了してください。
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
              Payloadを作るeBay前提条件
            </label>
            <select
              style={inputStyle}
              value={selectedPrerequisite?.recordId ?? ''}
              onChange={(event) => {
                setSelectedPrerequisiteId(event.target.value);
                setMessage('');
              }}
            >
              {prerequisites.map((record) => (
                <option key={record.recordId} value={record.recordId}>
                  {record.targetMarketplaceLabel} | {record.sku} | {record.sellerAccountIdAtSave}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.65)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>API</div>
              <strong style={{ color: '#f8fafc' }}>Sell Inventory API 1.18.5</strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.65)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>生成可否</div>
              <strong style={{ color: evaluation.canGenerate ? '#a7f3d0' : '#fecaca' }}>
                {evaluation.canGenerate ? '生成可能（未送信）' : 'BLOCKED'}
              </strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.65)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>保存済みPreview</div>
              <strong style={{ color: storedValidity?.valid ? '#a7f3d0' : '#fde68a' }}>
                {storedValidity?.valid ? '現在も有効' : selectedPreview ? '再生成必要' : '未生成'}
              </strong>
            </div>
          </div>

          {evaluation.blockingReasonsJa.length > 0 && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.3)', color: '#fecaca', marginBottom: 10 }}>
              {evaluation.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          {storedValidity && storedValidity.reasonsJa.length > 0 && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120, 53, 15, 0.28)', color: '#fde68a', marginBottom: 10 }}>
              <strong>保存済みPreviewは現在無効です:</strong>
              {storedValidity.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.6)', color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
            {evaluation.warningsJa.map((warning) => <div key={warning}>・{warning}</div>)}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" style={buttonStyle} onClick={handleGenerate} disabled={!evaluation.canGenerate}>
              正式Payload Previewを生成
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }}
              onClick={reload}
            >
              再読込
            </button>
          </div>

          {message && <div aria-live="polite" style={{ color: '#bfdbfe', fontSize: 13, marginBottom: 12 }}>{message}</div>}

          {selectedPreview && (
            <div style={{ display: 'grid', gap: 10 }}>
              {selectedPreview.steps.map((step) => (
                <div key={step.operationId} style={{ padding: 12, borderRadius: 9, background: 'rgba(2, 6, 23, 0.65)' }}>
                  <div style={{ color: '#bfdbfe', fontWeight: 800, marginBottom: 6 }}>
                    {step.order}. {step.operationId} — {step.method} {step.pathTemplate}
                  </div>
                  <pre style={{ margin: 0, overflowX: 'auto', whiteSpace: 'pre-wrap', color: '#cbd5e1', fontSize: 11, lineHeight: 1.55 }}>
                    {JSON.stringify({ pathParameters: step.pathParameters, requestBody: step.requestBody, responseDependency: step.responseDependency }, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        Payload Previewは公式項目対応に基づく内部確認用です。eBay APIによる実Schema検証、OAuth認証、送信結果確認はまだ実施していません。
      </p>
    </section>
  );
}
