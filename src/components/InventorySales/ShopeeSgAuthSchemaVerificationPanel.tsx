import React, { useMemo, useState } from 'react';
import {
  evaluateShopeeSgAuthSchemaVerification,
  getLatestShopeeSgAuthSchemaVerification,
  isShopeeSgAuthSchemaVerificationFresh,
  recordShopeeSgAuthSchemaVerification
} from '../../services/shopeeSgAuthSchemaVerificationService';

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

export function ShopeeSgAuthSchemaVerificationPanel() {
  const [input, setInput] = useState({
    officialSourceUrl: '',
    authorizationEndpoint: '',
    tokenEndpoint: '',
    refreshTokenEndpoint: '',
    signatureAlgorithm: '',
    authorizationSignBaseRule: '',
    authenticatedApiSignBaseRule: '',
    callbackFields: '',
    tokenRequestFields: '',
    authenticatedRequestFields: '',
    timestampValidityRule: '',
    checkedBy: '',
    checkedAt: nowLocal(),
    verificationNote: '',
    officialDocumentationConfirmed: false,
    currentSingaporeApplicabilityConfirmed: false
  });
  const [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const evaluation = useMemo(() => evaluateShopeeSgAuthSchemaVerification(input), [input]);
  const latest = useMemo(() => getLatestShopeeSgAuthSchemaVerification(), [revision]);
  const fresh = latest ? isShopeeSgAuthSchemaVerificationFresh(latest) : false;

  const update = <K extends keyof typeof input>(key: K, value: (typeof input)[K]) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const result = recordShopeeSgAuthSchemaVerification(input);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    if (result.success) setRevision((value) => value + 1);
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG 認証・署名Schema確認</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        在庫APIのRequest Schemaとは別に、現在のSingapore向けOpen Platform認証・Token・署名方式を公式本文で確認した証拠を保存します。古い国別資料や第三者SDKだけでは確認済みにしません。
      </p>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>秘密値は入力禁止です。</strong> Partner Key、Access Token、Refresh Tokenの実値はバックエンドSecret Storeだけで管理し、この画面にはURL・項目名・署名ルールだけを記録します。
      </div>

      {latest && (
        <div style={{ padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.6)', color: '#cbd5e1', fontSize: 12, marginBottom: 12, lineHeight: 1.6 }}>
          最新確認: <strong style={{ color: fresh ? '#86efac' : '#fde68a' }}>{fresh ? '確認済み・90日以内' : '再確認必要'}</strong>
          {' '}— {new Date(latest.checkedAt).toLocaleString()} / Singapore適用確認: {latest.currentSingaporeApplicabilityConfirmed ? '済' : '未確認'} / 外部通信: 禁止
        </div>
      )}

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12 }}>現在のShopee公式Open Platform URL
        <input style={{ ...inputStyle, marginTop: 5 }} value={input.officialSourceUrl} onChange={(e) => update('officialSourceUrl', e.target.value)} placeholder="https://open.shopee.com/..." />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 10, marginTop: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>認証エンドポイント<input style={{ ...inputStyle, marginTop: 5 }} value={input.authorizationEndpoint} onChange={(e) => update('authorizationEndpoint', e.target.value)} placeholder="公式本文のHTTPS URL" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Token取得エンドポイント<input style={{ ...inputStyle, marginTop: 5 }} value={input.tokenEndpoint} onChange={(e) => update('tokenEndpoint', e.target.value)} placeholder="公式本文のHTTPS URL" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Token更新エンドポイント<input style={{ ...inputStyle, marginTop: 5 }} value={input.refreshTokenEndpoint} onChange={(e) => update('refreshTokenEndpoint', e.target.value)} placeholder="公式本文のHTTPS URL" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>署名アルゴリズム<input style={{ ...inputStyle, marginTop: 5 }} value={input.signatureAlgorithm} onChange={(e) => update('signatureAlgorithm', e.target.value)} placeholder="例ではなく公式本文の表記" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者<input style={{ ...inputStyle, marginTop: 5 }} value={input.checkedBy} onChange={(e) => update('checkedBy', e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認日時<input type="datetime-local" style={{ ...inputStyle, marginTop: 5 }} value={input.checkedAt} onChange={(e) => update('checkedAt', e.target.value)} /></label>
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>認証URL用署名のbase string構成ルール<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 64 }} value={input.authorizationSignBaseRule} onChange={(e) => update('authorizationSignBaseRule', e.target.value)} placeholder="項目名と連結順だけ。秘密値は書かない" /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>認証済みAPI用署名のbase string構成ルール<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 64 }} value={input.authenticatedApiSignBaseRule} onChange={(e) => update('authenticatedApiSignBaseRule', e.target.value)} placeholder="項目名と連結順だけ。Token実値は書かない" /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>認証完了Callbackの項目名<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 56 }} value={input.callbackFields} onChange={(e) => update('callbackFields', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>Token取得Requestの項目名<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 56 }} value={input.tokenRequestFields} onChange={(e) => update('tokenRequestFields', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>認証済みAPI Requestの認証・署名項目名<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 56 }} value={input.authenticatedRequestFields} onChange={(e) => update('authenticatedRequestFields', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>timestamp有効時間・時刻同期ルール<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 56 }} value={input.timestampValidityRule} onChange={(e) => update('timestampValidityRule', e.target.value)} /></label>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>確認メモ<textarea style={{ ...inputStyle, marginTop: 5, minHeight: 72 }} value={input.verificationNote} onChange={(e) => update('verificationNote', e.target.value)} /></label>

      <label style={{ display: 'block', marginTop: 10, color: '#e2e8f0', fontSize: 13 }}>
        <input type="checkbox" checked={input.officialDocumentationConfirmed} onChange={(e) => update('officialDocumentationConfirmed', e.target.checked)} />{' '}
        Shopee公式Open Platform本文を直接確認した
      </label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}>
        <input type="checkbox" checked={input.currentSingaporeApplicabilityConfirmed} onChange={(e) => update('currentSingaporeApplicabilityConfirmed', e.target.checked)} />{' '}
        古い資料や他国向け資料ではなく、現在のSingapore向け実装に適用できることを確認した
      </label>

      {evaluation.blockingReasons.length > 0 && (
        <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>{evaluation.blockingReasons.join(' / ')}</div>
      )}

      <button type="button" onClick={save} disabled={!evaluation.canRecord} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(96,165,250,.5)', background: evaluation.canRecord ? 'rgba(37,99,235,.7)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: evaluation.canRecord ? 'pointer' : 'not-allowed' }}>
        公式認証Schema確認を記録
      </button>
      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}
    </section>
  );
}
