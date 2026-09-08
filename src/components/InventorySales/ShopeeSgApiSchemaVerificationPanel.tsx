import React, { useMemo, useState } from 'react';
import {
  evaluateShopeeSgApiSchemaVerification,
  getLatestShopeeSgApiSchemaVerification,
  isShopeeSgSchemaVerificationFresh,
  recordShopeeSgApiSchemaVerification
} from '../../services/shopeeSgApiSchemaVerificationService';

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
  border: '1px solid rgba(148,163,184,.3)',
  background: 'rgba(15,23,42,.82)',
  color: '#f8fafc',
  padding: '8px 9px'
};

function nowLocal(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ShopeeSgApiSchemaVerificationPanel() {
  const [input, setInput] = useState({
    officialSourceUrl: '',
    endpointName: '',
    requestFields: '',
    authenticationFields: '',
    stockFieldSemantics: '',
    checkedBy: '',
    checkedAt: nowLocal(),
    verificationNote: '',
    officialDocumentationConfirmed: false
  });
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const evaluation = useMemo(() => evaluateShopeeSgApiSchemaVerification(input), [input]);
  const latest = useMemo(() => getLatestShopeeSgApiSchemaVerification(), [revision]);
  const fresh = latest ? isShopeeSgSchemaVerificationFresh(latest) : false;

  const update = <K extends keyof typeof input>(key: K, value: (typeof input)[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const result = recordShopeeSgApiSchemaVerification(input);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    if (result.success) setRevision((value) => value + 1);
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG Open Platform Schema確認</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        Shopee Singaporeの在庫更新APIを実装する前に、公式Open Platform本文で現在のエンドポイント・認証・Request項目・在庫数の意味を確認した証拠を保存します。
      </p>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>この確認を保存しても外部書き込みはONになりません。</strong> Partner Key、Secret、Access Tokenなどの秘密値は入力しないでください。
      </div>

      {latest && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.6)', color: '#cbd5e1', fontSize: 12, marginBottom: 12 }}>
          最新確認: <strong style={{ color: fresh ? '#86efac' : '#fde68a' }}>{fresh ? '確認済み・90日以内' : '再確認必要'}</strong>
          {' '}— {latest.endpointName} / {new Date(latest.checkedAt).toLocaleString()} / 外部書込: 禁止
        </div>
      )}

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12 }}>Shopee公式ドキュメントURL
        <input style={{ ...inputStyle, marginTop: 5 }} value={input.officialSourceUrl} onChange={(e) => update('officialSourceUrl', e.target.value)} placeholder="https://open.shopee.com/..." />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 10, marginTop: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>在庫更新エンドポイント名<input style={{ ...inputStyle, marginTop: 5 }} value={input.endpointName} onChange={(e) => update('endpointName', e.target.value)} placeholder="公式本文に記載された名称" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者<input style={{ ...inputStyle, marginTop: 5 }} value={input.checkedBy} onChange={(e) => update('checkedBy', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認日時<input type="datetime-local" style={{ ...inputStyle, marginTop: 5 }} value={input.checkedAt} onChange={(e) => update('checkedAt', e.target.value)} /></label>
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>Request必須項目（フィールド名のみ）<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 64 }} value={input.requestFields} onChange={(e) => update('requestFields', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>認証・署名に必要な項目名（秘密値は禁止）<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 64 }} value={input.authenticationFields} onChange={(e) => update('authenticationFields', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>在庫フィールドの意味<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 72 }} value={input.stockFieldSemantics} onChange={(e) => update('stockFieldSemantics', e.target.value)} placeholder="絶対値/差分値、item/model/location単位などを公式本文から確認" /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>確認メモ<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 72 }} value={input.verificationNote} onChange={(e) => update('verificationNote', e.target.value)} /></label>

      <label style={{ display: 'block', marginTop: 10, color: '#e2e8f0', fontSize: 13 }}>
        <input type="checkbox" checked={input.officialDocumentationConfirmed} onChange={(e) => update('officialDocumentationConfirmed', e.target.checked)} />{' '}
        Shopee公式Open Platform本文を直接確認した
      </label>

      {evaluation.blockingReasons.length > 0 && <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12 }}>{evaluation.blockingReasons.join(' / ')}</div>}

      <button type="button" onClick={save} disabled={!evaluation.canRecord} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(96,165,250,.5)', background: evaluation.canRecord ? 'rgba(37,99,235,.7)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: evaluation.canRecord ? 'pointer' : 'not-allowed' }}>
        公式Schema確認を記録
      </button>
      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}
    </section>
  );
}
