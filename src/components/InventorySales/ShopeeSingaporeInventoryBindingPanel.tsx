import React, { useEffect, useMemo, useState } from 'react';
import {
  SHOPEE_SG_BINDINGS_CHANGED_EVENT,
  evaluateShopeeSingaporeInventoryBinding,
  loadShopeeSingaporeInventoryBindings,
  upsertShopeeSingaporeInventoryBinding
} from '../../services/shopeeSingaporeInventoryBindingService';

const DEFAULT_SELLER_CENTRE_URL = 'https://seller.shopee.sg/portal/product/list/live/all?operationSortBy=recommend_v2';

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
  border: '1px solid rgba(148,163,184,.28)',
  background: 'rgba(15,23,42,.85)',
  color: '#f8fafc',
  padding: '8px 9px'
};

export function ShopeeSingaporeInventoryBindingPanel() {
  const [records, setRecords] = useState(() => loadShopeeSingaporeInventoryBindings());
  const [form, setForm] = useState({
    centralSku: '', sellerAccountId: '', shopId: '', itemId: '', modelId: '',
    sellerCentreUrl: DEFAULT_SELLER_CENTRE_URL,
    verifiedBy: '', verificationNote: ''
  });
  const [message, setMessage] = useState('');

  const reload = () => setRecords(loadShopeeSingaporeInventoryBindings());
  useEffect(() => {
    window.addEventListener(SHOPEE_SG_BINDINGS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(SHOPEE_SG_BINDINGS_CHANGED_EVENT, reload);
  }, []);

  const evaluation = useMemo(() => evaluateShopeeSingaporeInventoryBinding(form), [form]);
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = () => {
    const result = upsertShopeeSingaporeInventoryBinding(form);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    reload();
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee Singapore 在庫Binding</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        中央在庫SKUとShopee Singaporeの shopId / itemId / modelId を対応付けます。現在は対応関係の確認・保存だけで、Open Platformへの在庫書き込みは行いません。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>中央在庫SKU<input style={inputStyle} value={form.centralSku} onChange={(e) => update('centralSku', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee販売アカウントID<input style={inputStyle} value={form.sellerAccountId} onChange={(e) => update('sellerAccountId', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>shopId<input style={inputStyle} value={form.shopId} onChange={(e) => update('shopId', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>itemId<input style={inputStyle} value={form.itemId} onChange={(e) => update('itemId', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>modelId（バリエーションがある場合）<input style={inputStyle} value={form.modelId} onChange={(e) => update('modelId', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者<input style={inputStyle} value={form.verifiedBy} onChange={(e) => update('verifiedBy', e.target.value)} /></label>
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>Seller Centre URL<input style={inputStyle} value={form.sellerCentreUrl} onChange={(e) => update('sellerCentreUrl', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>同一商品と判断した確認メモ<textarea style={{ ...inputStyle, minHeight: 70 }} value={form.verificationNote} onChange={(e) => update('verificationNote', e.target.value)} /></label>

      {evaluation.blockingReasons.length > 0 && (
        <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12 }}>{evaluation.blockingReasons.join(' / ')}</div>
      )}
      <div style={{ marginTop: 10, color: '#fde68a', fontSize: 12, lineHeight: 1.6 }}>
        API状態: <strong>OFFICIAL_SCHEMA_REVIEW_REQUIRED</strong> — Shopeeの現在の在庫更新Request Schemaを公式本文で確認できるまで外部書き込みは禁止します。
      </div>

      <button type="button" onClick={save} disabled={!evaluation.canSave} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(96,165,250,.5)', background: 'rgba(30,64,175,.35)', color: '#dbeafe', fontWeight: 700, cursor: evaluation.canSave ? 'pointer' : 'not-allowed', opacity: evaluation.canSave ? 1 : .5 }}>
        Shopee商品対応を保存
      </button>
      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}

      <div style={{ marginTop: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
          <thead><tr style={{ color: '#94a3b8', fontSize: 11, textAlign: 'left' }}><th style={{ padding: 7 }}>SKU</th><th style={{ padding: 7 }}>Account</th><th style={{ padding: 7 }}>shopId</th><th style={{ padding: 7 }}>itemId / modelId</th><th style={{ padding: 7 }}>API状態</th><th style={{ padding: 7 }}>確認</th></tr></thead>
          <tbody>{records.map((record) => <tr key={record.bindingId} style={{ borderTop: '1px solid rgba(148,163,184,.13)' }}><td style={{ padding: 8 }}>{record.centralSku}</td><td style={{ padding: 8 }}>{record.sellerAccountId}</td><td style={{ padding: 8 }}>{record.shopId}</td><td style={{ padding: 8 }}>{record.itemId}<br /><span style={{ color: '#94a3b8', fontSize: 11 }}>{record.modelId || 'modelIdなし'}</span></td><td style={{ padding: 8, color: '#fde68a', fontSize: 11 }}>{record.schemaStatus}<br />外部書込: 禁止</td><td style={{ padding: 8, color: '#94a3b8', fontSize: 11 }}>{record.verifiedBy}<br />{new Date(record.verifiedAt).toLocaleString()}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
