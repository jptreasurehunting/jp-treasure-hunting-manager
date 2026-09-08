import React, { useEffect, useMemo, useState } from 'react';
import type { CentralInventoryItem } from '../../types/centralInventory';
import {
  evaluateShopeeSgInventoryMapping,
  loadShopeeSgInventoryMappings,
  SHOPEE_SG_INVENTORY_MAPPING_CHANGED_EVENT,
  SHOPEE_SG_SELLER_CENTRE_URL,
  ShopeeSgInventoryMappingInput,
  ShopeeSgInventoryMappingRecord,
  upsertShopeeSgInventoryMapping
} from '../../services/shopeeSgInventoryMappingService';

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
  border: '1px solid rgba(148,163,184,.32)',
  background: 'rgba(15,23,42,.82)',
  color: '#f8fafc',
  padding: '8px 10px'
};

function localDateTimeInputValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function blankInput(items: CentralInventoryItem[]): ShopeeSgInventoryMappingInput {
  return {
    sku: items[0]?.sku || '',
    sellerAccountId: 'shopee_sg_main',
    shopId: '',
    shopeeItemId: '',
    modelResolutionStatus: 'NOT_CHECKED',
    shopeeModelId: '',
    sellerCentreChecked: false,
    mappingConfirmed: false,
    checkedBy: '',
    checkedAt: localDateTimeInputValue(),
    verificationNote: ''
  };
}

const LINK_LABEL: Record<ShopeeSgInventoryMappingRecord['centralLinkStatus'], string> = {
  MATCHED: '中央在庫Binding一致',
  NOT_LINKED: '中央在庫Binding未接続',
  CONFLICT: '不一致・要確認'
};

const LINK_COLOR: Record<ShopeeSgInventoryMappingRecord['centralLinkStatus'], string> = {
  MATCHED: '#86efac',
  NOT_LINKED: '#fde68a',
  CONFLICT: '#fecaca'
};

export function ShopeeSgInventoryMappingPanel({ items }: { items: CentralInventoryItem[] }) {
  const [input, setInput] = useState<ShopeeSgInventoryMappingInput>(() => blankInput(items));
  const [records, setRecords] = useState<ShopeeSgInventoryMappingRecord[]>(() => loadShopeeSgInventoryMappings());
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!input.sku && items[0]?.sku) setInput((current) => ({ ...current, sku: items[0].sku }));
  }, [items, input.sku]);

  useEffect(() => {
    const reload = () => setRecords(loadShopeeSgInventoryMappings());
    window.addEventListener(SHOPEE_SG_INVENTORY_MAPPING_CHANGED_EVENT, reload);
    return () => window.removeEventListener(SHOPEE_SG_INVENTORY_MAPPING_CHANGED_EVENT, reload);
  }, []);

  const evaluation = useMemo(
    () => evaluateShopeeSgInventoryMapping(input, items, records),
    [input, items, records]
  );

  const setField = <K extends keyof ShopeeSgInventoryMappingInput>(key: K, value: ShopeeSgInventoryMappingInput[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    setMessage('');
    const result = upsertShopeeSgInventoryMapping(input, items);
    setMessage(result.messageJa);
    if (result.success) setRecords(loadShopeeSgInventoryMappings());
  };

  const loadForEdit = (record: ShopeeSgInventoryMappingRecord) => {
    setInput({
      sku: record.sku,
      sellerAccountId: record.sellerAccountId,
      shopId: record.shopId,
      shopeeItemId: record.shopeeItemId,
      modelResolutionStatus: record.modelResolutionStatus,
      shopeeModelId: record.shopeeModelId || '',
      sellerCentreChecked: record.sellerCentreChecked,
      mappingConfirmed: record.mappingConfirmed,
      checkedBy: record.checkedBy,
      checkedAt: localDateTimeInputValue(new Date(record.checkedAt)),
      verificationNote: record.verificationNote
    });
    setMessage('保存済みMappingを編集欄へ読み込みました。変更後はSeller Centreで再確認して保存してください。');
  };

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG 商品・在庫紐付け</h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
            中央在庫SKUとShopee Singaporeの商品Identityを確認して保存します。誤った商品へ在庫0を送る事故を防ぐため、Shop ID・Item ID・Model ID/バリエーションをSeller Centreで確認します。
          </p>
        </div>
        <a
          href={SHOPEE_SG_SELLER_CENTRE_URL}
          target="_blank"
          rel="noreferrer"
          style={{ color: '#bfdbfe', border: '1px solid rgba(96,165,250,.4)', borderRadius: 9, padding: '8px 11px', textDecoration: 'none', fontWeight: 700 }}
        >
          Shopee SG 商品一覧を開く
        </a>
      </div>

      <div style={{ margin: '14px 0', padding: 11, borderRadius: 9, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.65 }}>
        <strong>API書き込みは無効です。</strong> 現在のShopee Singapore Open Platform在庫更新Request Schemaは公式確認待ちです。この画面は商品Identityの紐付けだけを保存し、Partner Key・Secret・Access Token等の秘密情報は入力・保存しません。
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>中央在庫SKU
          <select value={input.sku} onChange={(e) => setField('sku', e.target.value)} style={{ ...inputStyle, marginTop: 5 }}>
            <option value="">選択してください</option>
            {items.map((item) => <option key={item.sku} value={item.sku}>{item.sku} — {item.itemTitle}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>Shopee販売アカウントID（社内識別子）
          <input value={input.sellerAccountId} onChange={(e) => setField('sellerAccountId', e.target.value)} style={{ ...inputStyle, marginTop: 5 }} placeholder="shopee_sg_main" />
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>Shopee Shop ID
          <input value={input.shopId} onChange={(e) => setField('shopId', e.target.value)} style={{ ...inputStyle, marginTop: 5 }} inputMode="numeric" placeholder="数字ID" />
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>Shopee Item ID
          <input value={input.shopeeItemId} onChange={(e) => setField('shopeeItemId', e.target.value)} style={{ ...inputStyle, marginTop: 5 }} inputMode="numeric" placeholder="数字ID" />
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>Model ID / バリエーション確認
          <select value={input.modelResolutionStatus} onChange={(e) => setField('modelResolutionStatus', e.target.value as ShopeeSgInventoryMappingInput['modelResolutionStatus'])} style={{ ...inputStyle, marginTop: 5 }}>
            <option value="NOT_CHECKED">未確認</option>
            <option value="MODEL_ID_VERIFIED">Model IDあり・確認済み</option>
            <option value="NO_MODEL_ID_CONFIRMED">Model IDなし・確認済み</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>Shopee Model ID
          <input
            value={input.shopeeModelId || ''}
            onChange={(e) => setField('shopeeModelId', e.target.value)}
            disabled={input.modelResolutionStatus === 'NO_MODEL_ID_CONFIRMED'}
            style={{ ...inputStyle, marginTop: 5, opacity: input.modelResolutionStatus === 'NO_MODEL_ID_CONFIRMED' ? 0.55 : 1 }}
            inputMode="numeric"
            placeholder={input.modelResolutionStatus === 'MODEL_ID_VERIFIED' ? '数字ID（必須）' : 'Model IDがある場合'}
          />
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>確認者
          <input value={input.checkedBy} onChange={(e) => setField('checkedBy', e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
        <label style={{ fontSize: 12, color: '#cbd5e1' }}>確認日時
          <input type="datetime-local" value={input.checkedAt} onChange={(e) => setField('checkedAt', e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
      </div>

      <label style={{ display: 'block', marginTop: 12, fontSize: 12, color: '#cbd5e1' }}>確認メモ
        <textarea
          value={input.verificationNote}
          onChange={(e) => setField('verificationNote', e.target.value)}
          style={{ ...inputStyle, marginTop: 5, minHeight: 72, resize: 'vertical' }}
          placeholder="Seller Centreで何を照合したか（商品名、画像、SKU、バリエーション等）"
        />
      </label>

      <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
        <label style={{ color: '#e2e8f0', fontSize: 13 }}>
          <input type="checkbox" checked={input.sellerCentreChecked} onChange={(e) => setField('sellerCentreChecked', e.target.checked)} />{' '}
          Shopee Singapore Seller Centreで対象商品を確認した
        </label>
        <label style={{ color: '#e2e8f0', fontSize: 13 }}>
          <input type="checkbox" checked={input.mappingConfirmed} onChange={(e) => setField('mappingConfirmed', e.target.checked)} />{' '}
          このShopee商品が選択した中央在庫SKUと同一商品であることを確認した
        </label>
      </div>

      {(evaluation.missingFields.length > 0 || evaluation.blockingReasons.length > 0) && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(127,29,29,.2)', color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>
          {evaluation.missingFields.length > 0 && <div>未確認: {evaluation.missingFields.join(' / ')}</div>}
          {evaluation.blockingReasons.map((reason) => <div key={reason}>⛔ {reason}</div>)}
        </div>
      )}

      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.65)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.6 }}>
        中央在庫との状態: <strong style={{ color: evaluation.centralLinkStatus === 'MATCHED' ? '#86efac' : evaluation.centralLinkStatus === 'CONFLICT' ? '#fecaca' : '#fde68a' }}>{evaluation.centralLinkStatus}</strong>
        {evaluation.warnings.map((warning) => <div key={warning}>⚠️ {warning}</div>)}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={!evaluation.canSave}
        style={{ marginTop: 12, borderRadius: 9, border: '1px solid rgba(96,165,250,.5)', background: evaluation.canSave ? 'rgba(37,99,235,.75)' : 'rgba(51,65,85,.65)', color: '#f8fafc', padding: '9px 13px', fontWeight: 800, cursor: evaluation.canSave ? 'pointer' : 'not-allowed' }}
      >
        Shopee SG商品Mappingを保存
      </button>

      {message && <div style={{ marginTop: 10, color: '#dbeafe', fontSize: 12 }}>{message}</div>}

      <div style={{ marginTop: 18, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#94a3b8', fontSize: 11, textAlign: 'left' }}>
              <th style={{ padding: 8 }}>中央在庫</th>
              <th style={{ padding: 8 }}>Shopee Account / Shop</th>
              <th style={{ padding: 8 }}>Item / Model</th>
              <th style={{ padding: 8 }}>中央Binding</th>
              <th style={{ padding: 8 }}>API状態</th>
              <th style={{ padding: 8 }}>確認</th>
              <th style={{ padding: 8 }}></th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.mappingId} style={{ borderTop: '1px solid rgba(148,163,184,.13)', verticalAlign: 'top' }}>
                <td style={{ padding: 9, color: '#f8fafc', fontWeight: 700 }}>{record.sku}</td>
                <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>{record.sellerAccountId}<br />Shop: {record.shopId}</td>
                <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>Item: {record.shopeeItemId}<br />Model: {record.shopeeModelId || (record.modelResolutionStatus === 'NO_MODEL_ID_CONFIRMED' ? 'なし確認済み' : '未確認')}</td>
                <td style={{ padding: 9, color: LINK_COLOR[record.centralLinkStatus], fontWeight: 700, fontSize: 12 }}>{LINK_LABEL[record.centralLinkStatus]}</td>
                <td style={{ padding: 9, color: '#fde68a', fontSize: 12 }}>公式Schema確認待ち<br />外部書込: 無効</td>
                <td style={{ padding: 9, color: '#94a3b8', fontSize: 12 }}>{record.checkedBy}<br />{new Date(record.checkedAt).toLocaleString()}</td>
                <td style={{ padding: 9 }}>
                  <button type="button" onClick={() => loadForEdit(record)} style={{ borderRadius: 7, border: '1px solid rgba(148,163,184,.35)', background: 'rgba(30,41,59,.8)', color: '#e2e8f0', padding: '6px 8px', cursor: 'pointer' }}>編集</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {records.length === 0 && <div style={{ color: '#64748b', fontSize: 12 }}>まだShopee SG商品Mappingはありません。</div>}
      </div>
    </section>
  );
}
