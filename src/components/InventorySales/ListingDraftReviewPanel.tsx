import React, { useEffect, useMemo, useState } from 'react';
import { CentralInventoryItem } from '../../types/centralInventory';
import {
  LISTING_DRAFTS_CHANGED_EVENT,
  ListingPreparationDraft,
  loadListingPreparationDrafts
} from '../../services/listingPreparationService';
import {
  evaluateListingDraftReadiness,
  ListingDraftReviewInput,
  updateListingDraftReview
} from '../../services/listingDraftReviewService';

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
  border: '1px solid rgba(96, 165, 250, 0.45)',
  background: 'rgba(30, 64, 175, 0.65)',
  color: '#eff6ff',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 800
};

function toForm(draft?: ListingPreparationDraft): ListingDraftReviewInput {
  return {
    sellerAccountId: draft?.sellerAccountId ?? '',
    listingTitle: draft?.listingTitle ?? '',
    listingDescription: draft?.listingDescription ?? '',
    priceAmount: draft?.priceAmount ?? Number.NaN,
    priceCurrency: draft?.priceCurrency ?? '',
    shippingTerms: draft?.shippingTerms ?? ''
  };
}

export function ListingDraftReviewPanel({ items }: { items: CentralInventoryItem[] }) {
  const [drafts, setDrafts] = useState<ListingPreparationDraft[]>(() => loadListingPreparationDrafts());
  const [selectedDraftId, setSelectedDraftId] = useState(() => drafts[0]?.draftId ?? '');
  const selectedDraft = drafts.find((draft) => draft.draftId === selectedDraftId) ?? drafts[0];
  const [form, setForm] = useState<ListingDraftReviewInput>(() => toForm(selectedDraft));
  const [message, setMessage] = useState('');

  const itemsBySku = useMemo(() => new Map(items.map((item) => [item.sku, item])), [items]);
  const selectedItem = selectedDraft ? itemsBySku.get(selectedDraft.sku) : undefined;
  const readiness = selectedDraft ? evaluateListingDraftReadiness(selectedDraft, selectedItem) : undefined;

  const reloadDrafts = () => {
    const next = loadListingPreparationDrafts();
    setDrafts(next);
    setSelectedDraftId((current) => next.some((draft) => draft.draftId === current) ? current : (next[0]?.draftId ?? ''));
  };

  useEffect(() => {
    const handler = () => reloadDrafts();
    window.addEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LISTING_DRAFTS_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    setForm(toForm(selectedDraft));
    setMessage('');
  }, [selectedDraft?.draftId, selectedDraft?.updatedAt]);

  const updateField = <K extends keyof ListingDraftReviewInput>(key: K, value: ListingDraftReviewInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    if (!selectedDraft) return;
    const result = updateListingDraftReview(selectedDraft.draftId, form, selectedItem, drafts);
    setMessage(result.messageJa);
    reloadDrafts();
  };

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>出品下書き 最終確認準備</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          販売アカウント・価格・タイトル・商品説明・配送条件を入力し、最終確認へ回せる状態か検査します。
          ここで保存してもeBay・Shopeeには公開されません。
        </p>
      </div>

      {drafts.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>出品準備下書きがありません。上の出品準備キューから下書きを作成してください。</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(160px, 220px)', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>確認する下書き</label>
              <select
                style={inputStyle}
                value={selectedDraft?.draftId ?? ''}
                onChange={(event) => setSelectedDraftId(event.target.value)}
              >
                {drafts.map((draft) => (
                  <option key={draft.draftId} value={draft.draftId}>
                    {draft.targetChannel} | {draft.sku} | {draft.itemTitle}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={labelStyle}>内部状態</span>
              <div style={{ padding: '9px 10px', borderRadius: 8, background: selectedDraft?.status === 'READY_FOR_FINAL_REVIEW' ? 'rgba(6, 95, 70, 0.38)' : 'rgba(120, 53, 15, 0.35)', color: selectedDraft?.status === 'READY_FOR_FINAL_REVIEW' ? '#a7f3d0' : '#fde68a', fontWeight: 800 }}>
                {selectedDraft?.status === 'READY_FOR_FINAL_REVIEW' ? '最終確認待ち' : '入力・確認が必要'}
              </div>
            </div>
          </div>

          {selectedDraft && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.72)', marginBottom: 14, color: '#cbd5e1', fontSize: 12 }}>
              <strong style={{ color: '#f8fafc' }}>{selectedDraft.targetChannel}</strong> / SKU {selectedDraft.sku} / 現在の販売可能在庫 {selectedItem?.availableToSell ?? '不明'} 件
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label style={labelStyle}>販売アカウントID</label>
              <input style={inputStyle} value={form.sellerAccountId} onChange={(event) => updateField('sellerAccountId', event.target.value)} placeholder="正しいアカウントIDを入力" />
            </div>
            <div>
              <label style={labelStyle}>販売価格</label>
              <input style={inputStyle} type="number" min="0" step="0.01" value={Number.isFinite(form.priceAmount) ? form.priceAmount : ''} onChange={(event) => updateField('priceAmount', event.target.value === '' ? Number.NaN : Number(event.target.value))} placeholder="0.00" />
            </div>
            <div>
              <label style={labelStyle}>通貨コード</label>
              <input style={inputStyle} value={form.priceCurrency} onChange={(event) => updateField('priceCurrency', event.target.value.toUpperCase())} placeholder="USD / JPY など" maxLength={3} />
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>出品タイトル</label>
            <input style={inputStyle} value={form.listingTitle} onChange={(event) => updateField('listingTitle', event.target.value)} placeholder="実際に使用するタイトル" />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>商品説明</label>
            <textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} value={form.listingDescription} onChange={(event) => updateField('listingDescription', event.target.value)} placeholder="商品の状態・内容・注意事項など" />
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={labelStyle}>配送条件</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={form.shippingTerms} onChange={(event) => updateField('shippingTerms', event.target.value)} placeholder="使用する配送ポリシーや配送条件を確認して入力" />
          </div>

          {readiness && (
            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              {readiness.missingOrInvalidFieldsJa.length > 0 && (
                <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120, 53, 15, 0.32)', color: '#fde68a' }}>
                  {readiness.missingOrInvalidFieldsJa.map((issue) => <div key={issue}>・{issue}</div>)}
                </div>
              )}
              {readiness.blockingReasonsJa.length > 0 && (
                <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.34)', color: '#fecaca' }}>
                  {readiness.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
                </div>
              )}
              <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.7)', color: '#94a3b8', fontSize: 12 }}>
                {readiness.warningsJa.map((warning) => <div key={warning}>・{warning}</div>)}
              </div>
            </div>
          )}

          {message && <div aria-live="polite" style={{ marginTop: 12, color: '#bfdbfe', fontSize: 13 }}>{message}</div>}

          <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={buttonStyle} onClick={handleSave}>保存して安全性を再判定</button>
            <button type="button" style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }} onClick={reloadDrafts}>下書きを再読込</button>
          </div>
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        「最終確認待ち」は社内入力項目と在庫安全性を通過した状態です。Marketplaceの最新ルール確認・実在アカウント確認・外部公開は別工程です。
      </p>
    </section>
  );
}
