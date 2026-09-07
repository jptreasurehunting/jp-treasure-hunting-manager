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
  evaluateListingPrePublishCheck,
  isStoredPrePublishCheckStillValid,
  ListingPrePublishCheckRecord,
  ListingPrePublishInput,
  loadListingPrePublishChecks,
  PRE_PUBLISH_CHECK_CHANGED_EVENT,
  recordListingPrePublishCheck
} from '../../services/listingPrePublishCheckService';

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

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#cbd5e1',
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 5
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

function toLocalDateTimeInput(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function emptyForm(record?: ListingPrePublishCheckRecord): ListingPrePublishInput {
  return {
    publishQuantity: record?.publishQuantity ?? 1,
    inventoryReconfirmed: false,
    duplicateListingReconfirmed: false,
    listingContentReconfirmed: false,
    sellerAccountReconfirmed: false,
    marketplaceRulesReconfirmed: false,
    marketplaceRulesRecheckSourceUrl: record?.marketplaceRulesRecheckSourceUrl ?? '',
    marketplaceRulesRecheckedAt: toLocalDateTimeInput(),
    checkedBy: record?.checkedBy ?? '',
    checkNote: record?.checkNote ?? ''
  };
}

export function ListingPrePublishCheckPanel({ items }: { items: CentralInventoryItem[] }) {
  const [drafts, setDrafts] = useState<ListingPreparationDraft[]>(() => loadListingPreparationDrafts());
  const [gateRecords, setGateRecords] = useState<ListingPublishGateRecord[]>(() => loadListingPublishGateRecords());
  const [checks, setChecks] = useState<ListingPrePublishCheckRecord[]>(() => loadListingPrePublishChecks());
  const [selectedGateRecordId, setSelectedGateRecordId] = useState(() => gateRecords[0]?.recordId ?? '');
  const selectedGateRecord = gateRecords.find((record) => record.recordId === selectedGateRecordId) ?? gateRecords[0];
  const selectedDraft = drafts.find((draft) => draft.draftId === selectedGateRecord?.draftId);
  const selectedItem = items.find((item) => item.sku === selectedGateRecord?.sku);
  const selectedCheck = checks.find((check) => check.draftId === selectedGateRecord?.draftId);
  const [form, setForm] = useState<ListingPrePublishInput>(() => emptyForm(selectedCheck));
  const [message, setMessage] = useState('');

  const evaluation = selectedGateRecord
    ? evaluateListingPrePublishCheck(selectedGateRecord, selectedDraft, selectedItem, form)
    : undefined;
  const storedValidity = selectedCheck && selectedGateRecord
    ? isStoredPrePublishCheckStillValid(selectedCheck, selectedGateRecord, selectedDraft, selectedItem)
    : undefined;

  const draftsById = useMemo(() => new Map(drafts.map((draft) => [draft.draftId, draft])), [drafts]);

  const reload = () => {
    const nextDrafts = loadListingPreparationDrafts();
    const nextGateRecords = loadListingPublishGateRecords();
    const nextChecks = loadListingPrePublishChecks();
    setDrafts(nextDrafts);
    setGateRecords(nextGateRecords);
    setChecks(nextChecks);
    setSelectedGateRecordId((current) =>
      nextGateRecords.some((record) => record.recordId === current)
        ? current
        : (nextGateRecords[0]?.recordId ?? '')
    );
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
    window.addEventListener(PRE_PUBLISH_CHECK_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
      window.removeEventListener(PRE_PUBLISH_CHECK_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    const check = checks.find((candidate) => candidate.draftId === selectedGateRecord?.draftId);
    setForm(emptyForm(check));
    setMessage('');
  }, [selectedGateRecord?.recordId, selectedCheck?.checkedAt]);

  const updateField = <K extends keyof ListingPrePublishInput>(key: K, value: ListingPrePublishInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleRecord = () => {
    if (!selectedGateRecord) return;
    const result = recordListingPrePublishCheck(
      selectedGateRecord,
      selectedDraft,
      selectedItem,
      form,
      checks
    );
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>公開直前チェック</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          最終承認後に、在庫・重複出品・表示内容・販売アカウント・Marketplace最新ルールをもう一度確認します。
          この画面でも実際の出品は行いません。
        </p>
      </div>

      {gateRecords.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>公開可能な最終承認記録がありません。先に「出品 最終ゲート」を通過してください。</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) minmax(180px, 260px)', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>確認する最終承認</label>
              <select style={inputStyle} value={selectedGateRecord?.recordId ?? ''} onChange={(event) => setSelectedGateRecordId(event.target.value)}>
                {gateRecords.map((record) => {
                  const draft = draftsById.get(record.draftId);
                  return (
                    <option key={record.recordId} value={record.recordId}>
                      {record.targetChannel} | {record.targetMarketplace} | {record.sku} | {draft?.itemTitle ?? '下書き不明'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <span style={labelStyle}>公開直前状態</span>
              <div style={{
                padding: '9px 10px',
                borderRadius: 8,
                background: storedValidity?.valid ? 'rgba(21, 128, 61, 0.38)' : 'rgba(120, 53, 15, 0.35)',
                color: storedValidity?.valid ? '#bbf7d0' : '#fde68a',
                fontWeight: 800
              }}>
                {storedValidity?.valid ? '公開実行可能（未公開）' : selectedCheck ? '再チェック必要' : '未実施'}
              </div>
            </div>
          </div>

          {selectedGateRecord && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.72)', marginBottom: 14, color: '#cbd5e1', fontSize: 12, lineHeight: 1.7 }}>
              <strong style={{ color: '#f8fafc' }}>{selectedGateRecord.targetChannel}</strong> / {selectedGateRecord.targetMarketplace} / SKU {selectedGateRecord.sku}<br />
              販売アカウント: {selectedGateRecord.sellerAccountIdAtApproval}<br />
              タイトル: {selectedDraft?.listingTitle ?? '不明'}<br />
              価格: {selectedDraft?.priceAmount ?? '不明'} {selectedDraft?.priceCurrency ?? ''} / 現在の販売可能在庫: {selectedItem?.availableToSell ?? '不明'} 件
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.35fr) minmax(260px, 1fr)', gap: 12 }}>
            <div>
              <label style={labelStyle}>公開予定数量</label>
              <input
                style={inputStyle}
                type="number"
                min="1"
                step="1"
                value={Number.isFinite(form.publishQuantity) ? form.publishQuantity : ''}
                onChange={(event) => updateField('publishQuantity', event.target.value === '' ? Number.NaN : Number(event.target.value))}
              />
            </div>
            <div>
              <label style={labelStyle}>Marketplace公式情報 再確認URL</label>
              <input
                style={inputStyle}
                value={form.marketplaceRulesRecheckSourceUrl}
                onChange={(event) => updateField('marketplaceRulesRecheckSourceUrl', event.target.value)}
                placeholder="公開直前に確認した公式HTTPS URL"
              />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>Marketplaceルール 再確認日時</label>
            <input
              style={{ ...inputStyle, maxWidth: 320 }}
              type="datetime-local"
              value={form.marketplaceRulesRecheckedAt}
              onChange={(event) => updateField('marketplaceRulesRecheckedAt', event.target.value)}
            />
          </div>

          <div style={{ marginTop: 12, display: 'grid', gap: 8, padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)' }}>
            {([
              ['inventoryReconfirmed', '中央在庫の販売可能数量を公開直前に確認した'],
              ['duplicateListingReconfirmed', '同一SKU・同一販売先に既存出品がないことを確認した'],
              ['listingContentReconfirmed', 'タイトル・価格・商品説明・配送条件を最終確認した'],
              ['sellerAccountReconfirmed', '公開先の販売アカウントを再確認した'],
              ['marketplaceRulesReconfirmed', '対象マーケットの最新ルールを公式情報で再確認した']
            ] as const).map(([key, label]) => (
              <label key={key} style={{ ...labelStyle, marginBottom: 0, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={form[key]} onChange={(event) => updateField(key, event.target.checked)} />
                {label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(180px, 0.35fr) minmax(260px, 1fr)', gap: 8 }}>
            <input style={inputStyle} value={form.checkedBy} onChange={(event) => updateField('checkedBy', event.target.value)} placeholder="チェック実施者の識別名・ID" />
            <input style={inputStyle} value={form.checkNote} onChange={(event) => updateField('checkNote', event.target.value)} placeholder="確認内容・特記事項" />
          </div>

          {evaluation && (
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {evaluation.missingOrInvalidFieldsJa.length > 0 && (
                <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120, 53, 15, 0.32)', color: '#fde68a' }}>
                  {evaluation.missingOrInvalidFieldsJa.map((issue) => <div key={issue}>・{issue}</div>)}
                </div>
              )}
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
            <div style={{ marginTop: 12, padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.25)', color: '#fecaca', fontSize: 12 }}>
              <strong>保存済み直前チェックは現在無効です:</strong>
              {storedValidity.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          {message && <div aria-live="polite" style={{ marginTop: 12, color: '#bfdbfe', fontSize: 13 }}>{message}</div>}

          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={handleRecord}>公開直前チェックを記録</button>
            <button type="button" style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }} onClick={reload}>再読込</button>
          </div>
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        「公開実行可能（未公開）」は、外部Marketplaceへの出品完了ではありません。実際の出品API接続は別工程で実装します。
      </p>
    </section>
  );
}
