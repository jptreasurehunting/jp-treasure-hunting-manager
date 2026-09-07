import React, { useEffect, useMemo, useState } from 'react';
import { CentralInventoryItem } from '../../types/centralInventory';
import {
  LISTING_DRAFTS_CHANGED_EVENT,
  ListingPreparationDraft,
  loadListingPreparationDrafts
} from '../../services/listingPreparationService';
import {
  evaluateListingPublishGate,
  evaluateStoredPublishReadiness,
  LISTING_PUBLISH_GATE_CHANGED_EVENT,
  ListingPublishGateInput,
  ListingPublishGateRecord,
  loadListingPublishGateRecords,
  recordListingPublishApproval
} from '../../services/listingPublishGateService';

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
  border: '1px solid rgba(52, 211, 153, 0.45)',
  background: 'rgba(6, 95, 70, 0.62)',
  color: '#ecfdf5',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 800
};

function isoToLocalInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function emptyForm(record?: ListingPublishGateRecord): ListingPublishGateInput {
  return {
    targetMarketplace: record?.targetMarketplace ?? '',
    sellerAccountVerified: Boolean(record),
    sellerAccountVerificationNote: record?.sellerAccountVerificationNote ?? '',
    marketplaceRulesVerified: Boolean(record),
    marketplaceRulesSourceUrl: record?.marketplaceRulesSourceUrl ?? '',
    marketplaceRulesCheckedAt: isoToLocalInput(record?.marketplaceRulesCheckedAt),
    marketplaceRulesNote: record?.marketplaceRulesNote ?? '',
    finalApproved: Boolean(record),
    approvedBy: record?.approvedBy ?? '',
    approvalNote: record?.approvalNote ?? ''
  };
}

export function ListingPublishGatePanel({ items }: { items: CentralInventoryItem[] }) {
  const [drafts, setDrafts] = useState<ListingPreparationDraft[]>(() => loadListingPreparationDrafts());
  const [records, setRecords] = useState<ListingPublishGateRecord[]>(() => loadListingPublishGateRecords());
  const [selectedDraftId, setSelectedDraftId] = useState(() => drafts[0]?.draftId ?? '');
  const selectedDraft = drafts.find((draft) => draft.draftId === selectedDraftId) ?? drafts[0];
  const selectedRecord = records.find((record) => record.draftId === selectedDraft?.draftId);
  const [form, setForm] = useState<ListingPublishGateInput>(() => emptyForm(selectedRecord));
  const [message, setMessage] = useState('');

  const itemsBySku = useMemo(() => new Map(items.map((item) => [item.sku, item])), [items]);
  const selectedItem = selectedDraft ? itemsBySku.get(selectedDraft.sku) : undefined;
  const evaluation = selectedDraft ? evaluateListingPublishGate(selectedDraft, selectedItem, form) : undefined;
  const storedReadiness = selectedRecord
    ? evaluateStoredPublishReadiness(selectedRecord, selectedDraft, selectedItem)
    : undefined;

  const reload = () => {
    const nextDrafts = loadListingPreparationDrafts();
    const nextRecords = loadListingPublishGateRecords();
    setDrafts(nextDrafts);
    setRecords(nextRecords);
    setSelectedDraftId((current) => nextDrafts.some((draft) => draft.draftId === current) ? current : (nextDrafts[0]?.draftId ?? ''));
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
    window.addEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
      window.removeEventListener(LISTING_PUBLISH_GATE_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    const record = records.find((candidate) => candidate.draftId === selectedDraft?.draftId);
    setForm(emptyForm(record));
    setMessage('');
  }, [selectedDraft?.draftId, selectedRecord?.approvedAt]);

  const updateField = <K extends keyof ListingPublishGateInput>(key: K, value: ListingPublishGateInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleApprove = () => {
    if (!selectedDraft) return;
    const result = recordListingPublishApproval(selectedDraft, selectedItem, form, records);
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>出品 最終ゲート</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          販売アカウント・対象マーケット・最新ルール・中央在庫を確認し、公開操作へ進める状態か判定します。
          この画面ではeBay・Shopeeへの公開は実行しません。
        </p>
      </div>

      {drafts.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>出品下書きがありません。</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(180px, 260px)', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>確認する下書き</label>
              <select style={inputStyle} value={selectedDraft?.draftId ?? ''} onChange={(event) => setSelectedDraftId(event.target.value)}>
                {drafts.map((draft) => (
                  <option key={draft.draftId} value={draft.draftId}>
                    {draft.targetChannel} | {draft.sku} | {draft.itemTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={labelStyle}>最終ゲート状態</span>
              <div style={{
                padding: '9px 10px',
                borderRadius: 8,
                background: storedReadiness?.readyForPublishAction ? 'rgba(6, 95, 70, 0.42)' : 'rgba(120, 53, 15, 0.35)',
                color: storedReadiness?.readyForPublishAction ? '#a7f3d0' : '#fde68a',
                fontWeight: 800
              }}>
                {storedReadiness?.readyForPublishAction ? '公開操作へ進める' : selectedRecord ? '再確認が必要' : '未承認'}
              </div>
            </div>
          </div>

          {selectedDraft && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.72)', marginBottom: 14, color: '#cbd5e1', fontSize: 12, lineHeight: 1.6 }}>
              <strong style={{ color: '#f8fafc' }}>{selectedDraft.targetChannel}</strong> / SKU {selectedDraft.sku}<br />
              販売アカウント: {selectedDraft.sellerAccountId || '未入力'} / 現在の販売可能在庫: {selectedItem?.availableToSell ?? '不明'} 件<br />
              下書き状態: {selectedDraft.status === 'READY_FOR_FINAL_REVIEW' ? '最終確認待ち' : '入力・確認が必要'}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>対象マーケット（国・地域）</label>
              <input style={inputStyle} value={form.targetMarketplace} onChange={(event) => updateField('targetMarketplace', event.target.value)} placeholder="例: Singapore / Taiwan / eBay US" />
            </div>
            <div>
              <label style={labelStyle}>Marketplaceルール確認日時</label>
              <input style={inputStyle} type="datetime-local" value={form.marketplaceRulesCheckedAt} onChange={(event) => updateField('marketplaceRulesCheckedAt', event.target.value)} />
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)' }}>
            <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={form.sellerAccountVerified} onChange={(event) => updateField('sellerAccountVerified', event.target.checked)} />
              販売アカウントへ実際にログインする等により、対象ショップを確認した
            </label>
            <textarea style={{ ...inputStyle, minHeight: 62, resize: 'vertical' }} value={form.sellerAccountVerificationNote} onChange={(event) => updateField('sellerAccountVerificationNote', event.target.value)} placeholder="確認方法を記録（例: Seller Centreでショップ名とアカウントを確認）" />
          </div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)' }}>
            <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={form.marketplaceRulesVerified} onChange={(event) => updateField('marketplaceRulesVerified', event.target.checked)} />
              対象マーケットの最新出品ルールを公式情報で確認した
            </label>
            <div style={{ display: 'grid', gap: 8 }}>
              <input style={inputStyle} value={form.marketplaceRulesSourceUrl} onChange={(event) => updateField('marketplaceRulesSourceUrl', event.target.value)} placeholder="確認した公式HTTPS URL" />
              <textarea style={{ ...inputStyle, minHeight: 62, resize: 'vertical' }} value={form.marketplaceRulesNote} onChange={(event) => updateField('marketplaceRulesNote', event.target.value)} placeholder="確認した重要事項や変更点（任意）" />
            </div>
          </div>

          <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)' }}>
            <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={form.finalApproved} onChange={(event) => updateField('finalApproved', event.target.checked)} />
              上記内容を確認し、この下書きを最終承認する
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 0.35fr) minmax(260px, 1fr)', gap: 8 }}>
              <input style={inputStyle} value={form.approvedBy} onChange={(event) => updateField('approvedBy', event.target.value)} placeholder="承認者の識別名・ID" />
              <input style={inputStyle} value={form.approvalNote} onChange={(event) => updateField('approvalNote', event.target.value)} placeholder="承認理由・最終確認内容" />
            </div>
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

          {storedReadiness && storedReadiness.blockingReasonsJa.length > 0 && (
            <div style={{ marginTop: 12, padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.25)', color: '#fecaca', fontSize: 12 }}>
              <strong>保存済み承認の再確認:</strong>
              {storedReadiness.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          {message && <div aria-live="polite" style={{ marginTop: 12, color: '#bfdbfe', fontSize: 13 }}>{message}</div>}

          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={handleApprove}>最終承認を記録</button>
            <button type="button" style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }} onClick={reload}>再読込</button>
          </div>
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        公開可能状態になっても自動出品はしません。実際の公開処理を実装する際は、この記録に加えて公開直前の在庫・重複・Marketplaceルール再確認を必須にします。
      </p>
    </section>
  );
}
