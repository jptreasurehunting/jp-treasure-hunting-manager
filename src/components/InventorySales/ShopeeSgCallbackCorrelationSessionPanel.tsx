import React, { useMemo, useState } from 'react';
import { getLatestShopeeSgApiSchemaVerification, isShopeeSgSchemaVerificationFresh } from '../../services/shopeeSgApiSchemaVerificationService';
import { getLatestShopeeSgAuthSchemaVerification, isShopeeSgAuthSchemaVerificationFresh } from '../../services/shopeeSgAuthSchemaVerificationService';
import { getLatestShopeeSgStructuredAuthMapping, isShopeeSgStructuredAuthMappingFresh } from '../../services/shopeeSgStructuredAuthMappingService';
import { getLatestShopeeSgAuthorizationSigningRuntime, isShopeeSgAuthorizationSigningRuntimeFresh } from '../../services/shopeeSgAuthorizationSigningRuntimeService';
import {
  evaluateShopeeSgCallbackCorrelationMapping,
  getLatestShopeeSgCallbackCorrelationMapping,
  isShopeeSgCallbackCorrelationMappingFresh,
  recordShopeeSgCallbackCorrelationMapping,
  ShopeeSgCorrelationMode,
  ShopeeSgCorrelationSignatureParticipation
} from '../../services/shopeeSgCallbackCorrelationMappingService';
import { loadShopeeSgInventoryMappings } from '../../services/shopeeSgInventoryMappingService';
import {
  issueShopeeSgSignedAuthorizationRequestPreview,
  prepareShopeeSgAuthorizationSession,
  ShopeeSgAuthorizationSessionResponse,
  ShopeeSgSignedAuthorizationRequestPreviewResponse
} from '../../services/shopeeSgAuthorizationSessionClient';
import { describeBackendError, getConfiguredBackendBaseUrl } from '../../services/ebaySandboxBackendClient';

const panelStyle: React.CSSProperties = { background: 'rgba(15,23,42,.94)', border: '1px solid rgba(148,163,184,.22)', borderRadius: 14, padding: 18, marginBottom: 16 };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid rgba(148,163,184,.3)', background: 'rgba(15,23,42,.82)', color: '#f8fafc', padding: '8px 9px' };

function nowLocal(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
function initialIdentity() {
  const first = loadShopeeSgInventoryMappings().filter((r) => r.marketplaceRegion === 'SG').sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  return { accountId: first?.sellerAccountId || 'shopee_sg_main', shopId: first?.shopId || '' };
}

export function ShopeeSgCallbackCorrelationSessionPanel() {
  const initial = useMemo(() => initialIdentity(), []);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [shopId, setShopId] = useState(initial.shopId);
  const [credentialRef, setCredentialRef] = useState('SHOPEE_SG_MAIN');
  const [mode, setMode] = useState<'' | ShopeeSgCorrelationMode>('');
  const [requestField, setRequestField] = useState('');
  const [callbackField, setCallbackField] = useState('');
  const [signatureParticipation, setSignatureParticipation] = useState<'' | ShopeeSgCorrelationSignatureParticipation>('');
  const [checkedBy, setCheckedBy] = useState('');
  const [checkedAt, setCheckedAt] = useState(nowLocal());
  const [note, setNote] = useState('');
  const [officialConfirmed, setOfficialConfirmed] = useState(false);
  const [sgConfirmed, setSgConfirmed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [session, setSession] = useState<ShopeeSgAuthorizationSessionResponse | null>(null);
  const [requestPreview, setRequestPreview] = useState<ShopeeSgSignedAuthorizationRequestPreviewResponse | null>(null);

  const inventorySchema = getLatestShopeeSgApiSchemaVerification();
  const authSchema = getLatestShopeeSgAuthSchemaVerification();
  const structured = authSchema ? getLatestShopeeSgStructuredAuthMapping(authSchema.verificationId) : undefined;
  const signingRuntime = structured ? getLatestShopeeSgAuthorizationSigningRuntime(structured.mappingId) : undefined;
  const latestCorrelation = useMemo(() => structured ? getLatestShopeeSgCallbackCorrelationMapping(structured.mappingId) : undefined, [structured?.mappingId, revision]);

  const schemaFresh = isShopeeSgSchemaVerificationFresh(inventorySchema);
  const authFresh = isShopeeSgAuthSchemaVerificationFresh(authSchema);
  const structuredFresh = structured && authSchema ? isShopeeSgStructuredAuthMappingFresh(structured, authSchema) : false;
  const signingFresh = signingRuntime && structured && authSchema ? isShopeeSgAuthorizationSigningRuntimeFresh(signingRuntime, structured, authSchema) : false;
  const correlationFresh = latestCorrelation && structured && authSchema ? isShopeeSgCallbackCorrelationMappingFresh(latestCorrelation, structured, authSchema) : false;

  const correlationInput = {
    authSchemaVerificationId: authSchema?.verificationId || '',
    structuredMappingId: structured?.mappingId || '',
    officialSourceUrl: structured?.officialSourceUrl || '',
    correlationMode: mode as ShopeeSgCorrelationMode,
    authorizationRequestFieldName: mode === 'NO_OFFICIAL_ROUND_TRIP_FIELD' ? '' : requestField,
    callbackFieldName: mode === 'NO_OFFICIAL_ROUND_TRIP_FIELD' ? '' : callbackField,
    signatureParticipation: signatureParticipation as ShopeeSgCorrelationSignatureParticipation,
    checkedBy,
    checkedAt,
    verificationNote: note,
    officialDocumentationConfirmed: officialConfirmed,
    currentSingaporeApplicabilityConfirmed: sgConfirmed
  };
  const evaluation = evaluateShopeeSgCallbackCorrelationMapping(correlationInput, structured, authSchema);

  const save = () => {
    const result = recordShopeeSgCallbackCorrelationMapping(correlationInput, structured, authSchema);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    setSession(null);
    setRequestPreview(null);
    if (result.success) setRevision((v) => v + 1);
  };

  const identityValid = Boolean(accountId.trim() && /^[1-9]\d*$/.test(shopId.trim()) && /^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(credentialRef.trim()));
  const canPrepare = Boolean(identityValid && schemaFresh && authFresh && structuredFresh && signingFresh && correlationFresh && latestCorrelation?.safeSessionPreparationAllowed && !busy);

  const prepareSession = async () => {
    if (!inventorySchema || !authSchema || !structured || !signingRuntime || !latestCorrelation || !canPrepare) return;
    setBusy(true); setSession(null); setRequestPreview(null); setMessage('');
    try {
      const result = await prepareShopeeSgAuthorizationSession({ accountId, shopId, credentialRef, schemaVerification: inventorySchema, authSchemaVerification: authSchema, structuredAuthorizationMapping: structured, signingRuntimeVerification: signingRuntime, callbackCorrelationMapping: latestCorrelation });
      setSession(result);
      setMessage('✅ 一度限りのShopee SG認証Sessionを準備しました。相関stateはまだ発行せず、Shopeeへの通信も行っていません。');
    } catch (error) {
      setMessage(`❌ ${describeBackendError(error)}`);
    } finally { setBusy(false); }
  };

  const canIssuePreview = Boolean(session && session.status === 'PREPARED' && session.canIssueCorrelationStateInFutureAuthStart && !busy && inventorySchema && authSchema && structured && signingRuntime && latestCorrelation);

  const issuePreview = async () => {
    if (!session || !inventorySchema || !authSchema || !structured || !signingRuntime || !latestCorrelation || !canIssuePreview) return;
    setBusy(true); setRequestPreview(null); setMessage('');
    try {
      const result = await issueShopeeSgSignedAuthorizationRequestPreview(session.sessionId, {
        accountId,
        shopId,
        credentialRef,
        schemaVerification: inventorySchema,
        authSchemaVerification: authSchema,
        structuredAuthorizationMapping: structured,
        signingRuntimeVerification: signingRuntime,
        callbackCorrelationMapping: latestCorrelation
      });
      setRequestPreview(result);
      setSession((current) => current ? { ...current, status: 'STATE_ISSUED_PREVIEW_ONLY', correlationStateIssued: true, canIssueCorrelationStateInFutureAuthStart: false } : current);
      setMessage('✅ Preview専用stateを1回だけ発行し、hashだけを保存しました。署名済みAuthorization Requestはバックエンド内だけで組み立て、実行URL・state・署名値は返していません。');
    } catch (error) {
      setMessage(`❌ ${describeBackendError(error)}`);
    } finally { setBusy(false); }
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG Callback相関・認証Session準備</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        認証後のCallbackが「このアプリが開始した認証」と安全に対応するかを確認する層です。Shopeeが返す相関fieldを推測せず、現在のSingapore公式仕様で確認した場合だけ一度限りSessionを準備します。
      </p>
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>TokenやAuthorization Codeは入力しません。</strong> Previewで発行する相関stateは平文保存せず、hashだけをバックエンドへ保存します。Preview後のSessionは実認証には再利用できません。
      </div>
      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.6)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
        <div>Backend: <code>{getConfiguredBackendBaseUrl()}</code></div>
        <div>在庫Schema: <strong style={{ color: schemaFresh ? '#86efac' : '#fde68a' }}>{schemaFresh ? '有効' : '要確認'}</strong> / 認証Schema: <strong style={{ color: authFresh ? '#86efac' : '#fde68a' }}>{authFresh ? '有効' : '要確認'}</strong></div>
        <div>Structured Mapping: <strong style={{ color: structuredFresh ? '#86efac' : '#fde68a' }}>{structuredFresh ? '有効' : '要確認'}</strong> / Signing Runtime: <strong style={{ color: signingFresh ? '#86efac' : '#fde68a' }}>{signingFresh ? '有効' : '要確認'}</strong></div>
        <div>Callback相関Mapping: <strong style={{ color: correlationFresh && latestCorrelation?.safeSessionPreparationAllowed ? '#86efac' : '#fde68a' }}>{latestCorrelation ? (latestCorrelation.safeSessionPreparationAllowed ? '安全なSession準備可' : '記録済み・Session BLOCK') : '未確認'}</strong></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>公式Callback相関方式
          <select style={{ ...inputStyle, marginTop: 5 }} value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="">公式本文から選択</option>
            <option value="OFFICIAL_ROUND_TRIP_FIELD">認証Request→Callbackへ同じ相関fieldが返る</option>
            <option value="NO_OFFICIAL_ROUND_TRIP_FIELD">公式round-trip相関fieldなし</option>
          </select>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>相関値の署名base参加
          <select style={{ ...inputStyle, marginTop: 5 }} value={signatureParticipation} onChange={(e) => setSignatureParticipation(e.target.value as typeof signatureParticipation)}>
            <option value="">公式本文から選択</option>
            <option value="NOT_INCLUDED">署名baseに含まれない</option>
            <option value="INCLUDED_REQUIRES_MAPPING_UPDATE">署名baseに含まれる</option>
          </select>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>認証Request側相関field<input disabled={mode === 'NO_OFFICIAL_ROUND_TRIP_FIELD'} style={{ ...inputStyle, marginTop: 5 }} value={requestField} onChange={(e) => setRequestField(e.target.value)} placeholder="公式wire名のみ" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Callback側相関field<input disabled={mode === 'NO_OFFICIAL_ROUND_TRIP_FIELD'} style={{ ...inputStyle, marginTop: 5 }} value={callbackField} onChange={(e) => setCallbackField(e.target.value)} placeholder="公式wire名のみ" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者<input style={{ ...inputStyle, marginTop: 5 }} value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認日時<input type="datetime-local" style={{ ...inputStyle, marginTop: 5 }} value={checkedAt} onChange={(e) => setCheckedAt(e.target.value)} /></label>
      </div>
      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>確認メモ<textarea style={{ ...inputStyle, minHeight: 70, marginTop: 5 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="公式本文で確認したCallback相関仕様。秘密値は書かない" /></label>
      <label style={{ display: 'block', marginTop: 10, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={officialConfirmed} onChange={(e) => setOfficialConfirmed(e.target.checked)} /> Shopee公式本文で相関fieldと往復動作を直接確認した</label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={sgConfirmed} onChange={(e) => setSgConfirmed(e.target.checked)} /> 現在のSingapore向け仕様として適用できることを確認した</label>
      {evaluation.blockingReasons.length > 0 && <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>{evaluation.blockingReasons.join(' / ')}</div>}
      {evaluation.canRecord && !evaluation.safeSessionPreparationAllowed && <div style={{ marginTop: 8, color: '#fde68a', fontSize: 12 }}>この確認内容は記録できますが、安全なCallback相関条件を満たさないため認証SessionはBLOCKされます。</div>}
      <button type="button" onClick={save} disabled={!evaluation.canRecord} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(45,212,191,.5)', background: evaluation.canRecord ? 'rgba(13,148,136,.65)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: evaluation.canRecord ? 'pointer' : 'not-allowed' }}>Callback相関Mappingを記録</button>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10, marginTop: 16 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee販売アカウントID<input style={{ ...inputStyle, marginTop: 5 }} value={accountId} onChange={(e) => setAccountId(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee Shop ID<input style={{ ...inputStyle, marginTop: 5 }} value={shopId} onChange={(e) => setShopId(e.target.value)} inputMode="numeric" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>バックエンド認証参照名<input style={{ ...inputStyle, marginTop: 5 }} value={credentialRef} onChange={(e) => setCredentialRef(e.target.value.toUpperCase())} /></label>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" onClick={() => void prepareSession()} disabled={!canPrepare} style={{ borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(96,165,250,.5)', background: canPrepare ? 'rgba(37,99,235,.7)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: canPrepare ? 'pointer' : 'not-allowed' }}>{busy && !session ? '準備中…' : '一度限り認証Sessionを準備（Shopee通信なし）'}</button>
        <button type="button" onClick={() => void issuePreview()} disabled={!canIssuePreview} style={{ borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(167,139,250,.55)', background: canIssuePreview ? 'rgba(109,40,217,.72)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: canIssuePreview ? 'pointer' : 'not-allowed' }}>{busy && session ? '生成中…' : 'state発行＋署名済みRequest Preview（通信なし）'}</button>
      </div>
      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}
      {session && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: 'rgba(15,23,42,.78)', border: '1px solid rgba(96,165,250,.28)', fontSize: 12, lineHeight: 1.75 }}>
          <div>Session: <code>{session.sessionId}</code></div><div>状態: <strong>{session.status}</strong> / 有効期限: {new Date(session.expiresAt).toLocaleString()}</div>
          <div>相関Request field: <code>{session.correlationRequestField}</code> / Callback field: <code>{session.correlationCallbackField}</code></div>
          <div>相関state発行: <strong>{session.correlationStateIssued ? '発行済み（Preview専用）' : '未発行'}</strong> / state値・hash返却: <strong>なし</strong></div>
          <div>Authorization Code保存: <strong>なし</strong> / Token交換: <strong>不可</strong></div>
          <div>Shopee通信: <strong>{session.networkAction}</strong> / 認証開始: <strong style={{ color: '#fecaca' }}>不可</strong></div>
        </div>
      )}
      {requestPreview && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: 'rgba(49,46,129,.2)', border: '1px solid rgba(167,139,250,.32)', fontSize: 12, lineHeight: 1.75 }}>
          <div><strong style={{ color: '#ddd6fe' }}>署名済みAuthorization Request Preview</strong></div>
          <div>Method: <code>{requestPreview.requestMethod}</code> / Endpoint: <code>{requestPreview.authorizationEndpoint}</code></div>
          <div>Query fields: {requestPreview.queryFields.map((q) => <code key={`${q.role}-${q.fieldName}`} style={{ marginRight: 6 }}>{q.fieldName}</code>)}</div>
          <div>署名: <strong>内部生成済み</strong>（長さ {requestPreview.signatureLength}） / 署名値返却: <strong>なし</strong></div>
          <div>相関state: {requestPreview.correlationStateEntropyBytes} bytes / 平文保存: <strong>なし</strong> / state・hash返却: <strong>なし</strong></div>
          <div>Request fingerprint: <code>{requestPreview.authorizationRequestFingerprint}</code></div>
          <div>実行可能URL返却: <strong>なし</strong> / Shopee通信: <strong>{requestPreview.networkAction}</strong></div>
          <div style={{ marginTop: 8, color: '#fde68a' }}>このPreviewでstate発行枠を消費したため、実際の認証開始時は新しいSessionを作成します。</div>
        </div>
      )}
    </section>
  );
}
