import React, { useMemo, useState } from 'react';
import { getLatestShopeeSgAuthSchemaVerification, isShopeeSgAuthSchemaVerificationFresh } from '../../services/shopeeSgAuthSchemaVerificationService';
import {
  evaluateShopeeSgStructuredTokenMapping,
  getLatestShopeeSgStructuredTokenMapping,
  isShopeeSgStructuredTokenMappingFresh,
  recordShopeeSgStructuredTokenMapping,
  type ShopeeSgTokenBodyEncoding,
  type ShopeeSgTokenExpiryUnit
} from '../../services/shopeeSgStructuredTokenMappingService';
import type { ShopeeSgSignatureComponent } from '../../services/shopeeSgStructuredAuthMappingService';

const panelStyle: React.CSSProperties = { background: 'rgba(15,23,42,.94)', border: '1px solid rgba(148,163,184,.22)', borderRadius: 14, padding: 18, marginBottom: 16 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(15,23,42,.82)', color: '#f8fafc', padding: '8px 9px' };
function nowLocal(): string { const d = new Date(); const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000); return local.toISOString().slice(0, 16); }

export function ShopeeSgStructuredTokenMappingPanel() {
  const authSchema = getLatestShopeeSgAuthSchemaVerification();
  const authFresh = isShopeeSgAuthSchemaVerificationFresh(authSchema);
  const [bodyEncoding, setBodyEncoding] = useState<ShopeeSgTokenBodyEncoding>('JSON');
  const [queryPartnerId, setQueryPartnerId] = useState('');
  const [queryTimestamp, setQueryTimestamp] = useState('');
  const [querySignature, setQuerySignature] = useState('');
  const [queryOrder, setQueryOrder] = useState('PARTNER_ID_QUERY,TIMESTAMP_QUERY,SIGNATURE_QUERY');
  const [bodyCode, setBodyCode] = useState('');
  const [bodyShopId, setBodyShopId] = useState('');
  const [bodyPartnerId, setBodyPartnerId] = useState('');
  const [bodyRoles, setBodyRoles] = useState('AUTHORIZATION_CODE_BODY,SHOP_ID_BODY,PARTNER_ID_BODY');
  const [signatureComponents, setSignatureComponents] = useState('');
  const [responseAccess, setResponseAccess] = useState('');
  const [responseRefresh, setResponseRefresh] = useState('');
  const [responseExpiry, setResponseExpiry] = useState('');
  const [expiryUnit, setExpiryUnit] = useState<ShopeeSgTokenExpiryUnit>('SECONDS');
  const [allRequestFields, setAllRequestFields] = useState(false);
  const [allResponseFields, setAllResponseFields] = useState(false);
  const [checkedBy, setCheckedBy] = useState('');
  const [checkedAt, setCheckedAt] = useState(nowLocal());
  const [note, setNote] = useState('');
  const [officialConfirmed, setOfficialConfirmed] = useState(false);
  const [sgConfirmed, setSgConfirmed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [message, setMessage] = useState('');

  const latest = useMemo(() => authSchema ? getLatestShopeeSgStructuredTokenMapping(authSchema.verificationId) : undefined, [authSchema?.verificationId, revision]);
  const latestFresh = authSchema ? isShopeeSgStructuredTokenMappingFresh(latest, authSchema) : false;
  const split = (value: string) => value.split(',').map((v) => v.trim()).filter(Boolean);
  const input: any = {
    authSchemaVerificationId: authSchema?.verificationId || '',
    officialSourceUrl: authSchema?.officialSourceUrl || '',
    tokenEndpoint: authSchema?.tokenEndpoint || '',
    tokenHttpMethod: 'POST',
    tokenBodyEncoding: bodyEncoding,
    tokenQueryFieldNames: { partnerId: queryPartnerId, timestamp: queryTimestamp, signature: querySignature },
    tokenQueryOrder: split(queryOrder),
    tokenBodyFieldNames: { authorizationCode: bodyCode, shopId: bodyShopId, partnerId: bodyPartnerId },
    tokenBodyRoles: split(bodyRoles),
    signatureAlgorithm: authSchema?.signatureAlgorithm || '',
    signatureBaseComponents: split(signatureComponents).map((v) => v.toUpperCase() as ShopeeSgSignatureComponent),
    tokenResponseFieldNames: { accessToken: responseAccess, refreshToken: responseRefresh, expiresIn: responseExpiry },
    expiresInUnit: expiryUnit,
    allRequiredRequestFieldsRepresented: allRequestFields,
    allRequiredResponseFieldsRepresented: allResponseFields,
    checkedBy, checkedAt, verificationNote: note,
    officialDocumentationConfirmed: officialConfirmed,
    currentSingaporeApplicabilityConfirmed: sgConfirmed
  };
  const evaluation = evaluateShopeeSgStructuredTokenMapping(input, authSchema);
  const save = () => {
    const result = recordShopeeSgStructuredTokenMapping(input, authSchema);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    if (result.success) setRevision((v) => v + 1);
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG Token交換 Structured Mapping</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        Callback後にAuthorization CodeをTokenへ交換するRequest/Response構造を、現在のSingapore公式仕様から明示的に固定します。wire名を推測しません。
      </p>
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>秘密値は入力しません。</strong> Partner Key、Authorization Code、Access Token、Refresh Tokenの実値はこの画面・localStorageへ保存しません。Mappingを保存してもToken交換・Shopee通信は無効です。
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.6)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
        <div>認証Schema: <strong style={{ color: authFresh ? '#86efac' : '#fde68a' }}>{authFresh ? '有効' : '要確認'}</strong></div>
        <div>Token Endpoint: <code>{authSchema?.tokenEndpoint || '未確認'}</code></div>
        <div>保存済みToken Mapping: <strong style={{ color: latestFresh ? '#86efac' : '#fde68a' }}>{latestFresh ? '有効' : latest ? '再確認必要' : '未登録'}</strong></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Token HTTP Method<input style={{ ...inputStyle, marginTop: 5 }} value="POST" disabled /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Body形式<select style={{ ...inputStyle, marginTop: 5 }} value={bodyEncoding} onChange={(e) => setBodyEncoding(e.target.value as ShopeeSgTokenBodyEncoding)}><option value="JSON">JSON</option><option value="FORM_URLENCODED">FORM_URLENCODED</option></select></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Query: Partner ID field<input style={{ ...inputStyle, marginTop: 5 }} value={queryPartnerId} onChange={(e) => setQueryPartnerId(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Query: timestamp field<input style={{ ...inputStyle, marginTop: 5 }} value={queryTimestamp} onChange={(e) => setQueryTimestamp(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Query: signature field<input style={{ ...inputStyle, marginTop: 5 }} value={querySignature} onChange={(e) => setQuerySignature(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Query role順序<input style={{ ...inputStyle, marginTop: 5 }} value={queryOrder} onChange={(e) => setQueryOrder(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Body: Authorization Code field<input style={{ ...inputStyle, marginTop: 5 }} value={bodyCode} onChange={(e) => setBodyCode(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Body: Shop ID field<input style={{ ...inputStyle, marginTop: 5 }} value={bodyShopId} onChange={(e) => setBodyShopId(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Body: Partner ID field<input style={{ ...inputStyle, marginTop: 5 }} value={bodyPartnerId} onChange={(e) => setBodyPartnerId(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Body role一覧<input style={{ ...inputStyle, marginTop: 5 }} value={bodyRoles} onChange={(e) => setBodyRoles(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Token署名base component順<input style={{ ...inputStyle, marginTop: 5 }} value={signatureComponents} onChange={(e) => setSignatureComponents(e.target.value)} placeholder="例は入れず、公式本文の順序を入力" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>応答: Access Token field<input style={{ ...inputStyle, marginTop: 5 }} value={responseAccess} onChange={(e) => setResponseAccess(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>応答: Refresh Token field<input style={{ ...inputStyle, marginTop: 5 }} value={responseRefresh} onChange={(e) => setResponseRefresh(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>応答: expires-in field<input style={{ ...inputStyle, marginTop: 5 }} value={responseExpiry} onChange={(e) => setResponseExpiry(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>expires-in単位<select style={{ ...inputStyle, marginTop: 5 }} value={expiryUnit} onChange={(e) => setExpiryUnit(e.target.value as ShopeeSgTokenExpiryUnit)}><option value="SECONDS">SECONDS</option><option value="MILLISECONDS">MILLISECONDS</option></select></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者<input style={{ ...inputStyle, marginTop: 5 }} value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認日時<input type="datetime-local" style={{ ...inputStyle, marginTop: 5 }} value={checkedAt} onChange={(e) => setCheckedAt(e.target.value)} /></label>
      </div>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>確認メモ<textarea style={{ ...inputStyle, minHeight: 70, marginTop: 5 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="公式本文で確認したToken交換構造。秘密値は書かない" /></label>
      <label style={{ display: 'block', marginTop: 10, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={allRequestFields} onChange={(e) => setAllRequestFields(e.target.checked)} /> 公式Token Requestの必須項目をすべてこのMappingへ表現した</label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={allResponseFields} onChange={(e) => setAllResponseFields(e.target.checked)} /> Token応答で必要な項目をすべてこのMappingへ表現した</label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={officialConfirmed} onChange={(e) => setOfficialConfirmed(e.target.checked)} /> Shopee公式Open Platform本文で直接確認した</label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={sgConfirmed} onChange={(e) => setSgConfirmed(e.target.checked)} /> 現在のSingapore向け仕様として適用できることを確認した</label>
      {evaluation.blockingReasons.length > 0 && <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>{evaluation.blockingReasons.join(' / ')}</div>}
      <button type="button" onClick={save} disabled={!evaluation.canRecord} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(45,212,191,.5)', background: evaluation.canRecord ? 'rgba(13,148,136,.65)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: evaluation.canRecord ? 'pointer' : 'not-allowed' }}>Token Structured Mappingを保存</button>
      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}
    </section>
  );
}
