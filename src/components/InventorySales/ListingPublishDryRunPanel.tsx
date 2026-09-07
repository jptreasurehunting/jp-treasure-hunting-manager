import React, { useEffect, useState } from 'react';
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
  evaluateListingPublishDryRun,
  evaluateStoredListingPublishDryRun,
  generateListingPublishDryRun,
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
  border: '1px solid rgba(56, 189, 248, 0.45)',
  background: 'rgba(3, 105, 161, 0.62)',
  color: '#f0f9ff',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 800
};

export function ListingPublishDryRunPanel({ items }: { items: CentralInventoryItem[] }) {
  const [drafts, setDrafts] = useState<ListingPreparationDraft[]>(() => loadListingPreparationDrafts());
  const [gateRecords, setGateRecords] = useState<ListingPublishGateRecord[]>(() => loadListingPublishGateRecords());
  const [checks, setChecks] = useState<ListingPrePublishCheckRecord[]>(() => loadListingPrePublishChecks());
  const [packets, setPackets] = useState<ListingPublishDryRunPacket[]>(() => loadListingPublishDryRuns());
  const [selectedCheckId, setSelectedCheckId] = useState(() => checks[0]?.checkId ?? '');
  const [message, setMessage] = useState('');

  const selectedCheck = checks.find((check) => check.checkId === selectedCheckId) ?? checks[0];
  const selectedGate = gateRecords.find((record) => record.recordId === selectedCheck?.publishGateRecordId);
  const selectedDraft = drafts.find((draft) => draft.draftId === selectedCheck?.draftId);
  const selectedItem = items.find((item) => item.sku === selectedCheck?.sku);
  const selectedPacket = packets.find((packet) => packet.draftId === selectedCheck?.draftId);

  const evaluation = selectedCheck
    ? evaluateListingPublishDryRun(selectedCheck, selectedGate, selectedDraft, selectedItem)
    : undefined;
  const storedValidity = selectedPacket
    ? evaluateStoredListingPublishDryRun(selectedPacket, selectedCheck, selectedGate, selectedDraft, selectedItem)
    : undefined;

  const reload = () => {
    const nextDrafts = loadListingPreparationDrafts();
    const nextGates = loadListingPublishGateRecords();
    const nextChecks = loadListingPrePublishChecks();
    const nextPackets = loadListingPublishDryRuns();
    setDrafts(nextDrafts);
    setGateRecords(nextGates);
    setChecks(nextChecks);
    setPackets(nextPackets);
    setSelectedCheckId((current) => nextChecks.some((check) => check.checkId === current) ? current : (nextChecks[0]?.checkId ?? ''));
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
    window.addEventListener(PRE_PUBLISH_CHECK_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_DRY_RUN_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
      window.removeEventListener(PRE_PUBLISH_CHECK_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_DRY_RUN_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    setMessage('');
  }, [selectedCheck?.checkId]);

  const handleGenerate = () => {
    if (!selectedCheck) return;
    const result = generateListingPublishDryRun(
      selectedCheck,
      selectedGate,
      selectedDraft,
      selectedItem,
      packets
    );
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>公開リクエスト Dry Run（模擬実行）</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          実際にMarketplaceへ送る予定の内容を1つのパケットにまとめて確認します。
          Dry Runでは通信・出品・在庫変更を一切行いません。
        </p>
      </div>

      {checks.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>有効な公開直前チェック記録がありません。先に「公開直前チェック」を完了してください。</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(190px, 260px)', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Dry Run対象</label>
              <select style={inputStyle} value={selectedCheck?.checkId ?? ''} onChange={(event) => setSelectedCheckId(event.target.value)}>
                {checks.map((check) => (
                  <option key={check.checkId} value={check.checkId}>
                    {check.targetChannel} | {check.targetMarketplace} | {check.sku} | 数量 {check.publishQuantity}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Dry Run状態</span>
              <div style={{
                padding: '9px 10px',
                borderRadius: 8,
                background: storedValidity?.valid ? 'rgba(14, 116, 144, 0.38)' : 'rgba(120, 53, 15, 0.35)',
                color: storedValidity?.valid ? '#a5f3fc' : '#fde68a',
                fontWeight: 800
              }}>
                {storedValidity?.valid ? 'Dry Run有効（未送信）' : selectedPacket ? '再生成が必要' : '未生成'}
              </div>
            </div>
          </div>

          {selectedCheck && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.72)', marginBottom: 14, color: '#cbd5e1', fontSize: 12, lineHeight: 1.7 }}>
              <strong style={{ color: '#f8fafc' }}>{selectedCheck.targetChannel}</strong> / {selectedCheck.targetMarketplace} / SKU {selectedCheck.sku}<br />
              販売アカウント: {selectedDraft?.sellerAccountId ?? '不明'} / 公開予定数量: {selectedCheck.publishQuantity} 件 / 現在の販売可能在庫: {selectedItem?.availableToSell ?? '不明'} 件<br />
              タイトル: {selectedDraft?.listingTitle ?? '不明'}<br />
              価格: {selectedDraft?.priceAmount ?? '不明'} {selectedDraft?.priceCurrency ?? ''}
            </div>
          )}

          {evaluation && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 14 }}>
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
              <strong>保存済みDry Runは現在無効です:</strong>
              {storedValidity.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" style={buttonStyle} onClick={handleGenerate} disabled={!evaluation?.canGenerate}>
              Dry Run公開リクエストを生成
            </button>
            <button type="button" style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }} onClick={reload}>
              再読込
            </button>
          </div>

          {message && <div aria-live="polite" style={{ marginBottom: 12, color: '#bfdbfe', fontSize: 13 }}>{message}</div>}

          {selectedPacket && (
            <div>
              <div style={{ color: '#cbd5e1', fontSize: 12, fontWeight: 800, marginBottom: 6 }}>送信予定パケット（確認用）</div>
              <pre style={{ margin: 0, padding: 12, borderRadius: 9, overflowX: 'auto', background: 'rgba(2, 6, 23, 0.86)', color: '#cbd5e1', fontSize: 11, lineHeight: 1.6 }}>
                {JSON.stringify(selectedPacket, null, 2)}
              </pre>
            </div>
          )}
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        `networkAction: NONE` のため、この工程では外部APIを呼びません。実出品機能は別工程として実装・承認します。
      </p>
    </section>
  );
}
