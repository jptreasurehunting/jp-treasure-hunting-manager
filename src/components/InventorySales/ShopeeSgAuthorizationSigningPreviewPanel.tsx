import React, { useMemo, useState } from 'react';
import { getLatestShopeeSgApiSchemaVerification, isShopeeSgSchemaVerificationFresh } from '../../services/shopeeSgApiSchemaVerificationService';
import { getLatestShopeeSgAuthSchemaVerification, isShopeeSgAuthSchemaVerificationFresh } from '../../services/shopeeSgAuthSchemaVerificationService';
import { getLatestShopeeSgStructuredAuthMapping, isShopeeSgStructuredAuthMappingFresh } from '../../services/shopeeSgStructuredAuthMappingService';
import { loadShopeeSgInventoryMappings } from '../../services/shopeeSgInventoryMappingService';
import {
  evaluateShopeeSgAuthorizationSigningRuntime,
  getLatestShopeeSgAuthorizationSigningRuntime,
  isShopeeSgAuthorizationSigningRuntimeFresh,
  recordShopeeSgAuthorizationSigningRuntime,
  SHOPEE_SG_SIGNATURE_BASE_SERIALIZATIONS,
  SHOPEE_SG_SIGNATURE_IMPLEMENTATIONS,
  ShopeeSgSignatureBaseSerialization,
  ShopeeSgSignatureImplementation
} from '../../services/shopeeSgAuthorizationSigningRuntimeService';
import {
  fetchShopeeSgAuthorizationSigningPreview,
  ShopeeSgAuthorizationSigningPreviewResponse
} from '../../services/shopeeSgAuthorizationSigningPreviewClient';
import { describeBackendError, getConfiguredBackendBaseUrl } from '../../services/ebaySandboxBackendClient';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)', border: '1px solid rgba(148,163,184,.22)', borderRadius: 14, padding: 18, marginBottom: 16
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid rgba(148,163,184,.3)',
  background: 'rgba(15,23,42,.82)', color: '#f8fafc', padding: '8px 9px'
};

function nowLocal(): string {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function initialIdentity() {
  const first = loadShopeeSgInventoryMappings()
    .filter((record) => record.marketplaceRegion === 'SG')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  return { accountId: first?.sellerAccountId || 'shopee_sg_main', shopId: first?.shopId || '' };
}

export function ShopeeSgAuthorizationSigningPreviewPanel() {
  const initial = useMemo(() => initialIdentity(), []);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [shopId, setShopId] = useState(initial.shopId);
  const [credentialRef, setCredentialRef] = useState('SHOPEE_SG_MAIN');
  const [implementation, setImplementation] = useState<'' | ShopeeSgSignatureImplementation>('');
  const [serialization, setSerialization] = useState<'' | ShopeeSgSignatureBaseSerialization>('');
  const [checkedBy, setCheckedBy] = useState('');
  const [checkedAt, setCheckedAt] = useState(nowLocal());
  const [verificationNote, setVerificationNote] = useState('');
  const [officialConfirmed, setOfficialConfirmed] = useState(false);
  const [sgConfirmed, setSgConfirmed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ShopeeSgAuthorizationSigningPreviewResponse | null>(null);

  const inventorySchema = getLatestShopeeSgApiSchemaVerification();
  const authSchema = getLatestShopeeSgAuthSchemaVerification();
  const structuredMapping = authSchema ? getLatestShopeeSgStructuredAuthMapping(authSchema.verificationId) : undefined;
  const runtime = useMemo(
    () => structuredMapping ? getLatestShopeeSgAuthorizationSigningRuntime(structuredMapping.mappingId) : undefined,
    [structuredMapping?.mappingId, revision]
  );

  const schemaFresh = isShopeeSgSchemaVerificationFresh(inventorySchema);
  const authFresh = isShopeeSgAuthSchemaVerificationFresh(authSchema);
  const mappingFresh = structuredMapping && authSchema ? isShopeeSgStructuredAuthMappingFresh(structuredMapping, authSchema) : false;
  const runtimeFresh = runtime && structuredMapping && authSchema
    ? isShopeeSgAuthorizationSigningRuntimeFresh(runtime, structuredMapping, authSchema)
    : false;

  const runtimeInput = {
    authSchemaVerificationId: authSchema?.verificationId || '',
    structuredMappingId: structuredMapping?.mappingId || '',
    officialSourceUrl: structuredMapping?.officialSourceUrl || '',
    signatureAlgorithmLabel: structuredMapping?.signatureAlgorithm || '',
    signatureImplementation: implementation as ShopeeSgSignatureImplementation,
    signatureBaseSerialization: serialization as ShopeeSgSignatureBaseSerialization,
    redirectUriSource: 'BACKEND_ENV' as const,
    checkedBy,
    checkedAt,
    verificationNote,
    officialDocumentationConfirmed: officialConfirmed,
    currentSingaporeApplicabilityConfirmed: sgConfirmed
  };
  const evaluation = evaluateShopeeSgAuthorizationSigningRuntime(runtimeInput, structuredMapping, authSchema);

  const saveRuntime = () => {
    const result = recordShopeeSgAuthorizationSigningRuntime(runtimeInput, structuredMapping, authSchema);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    setPreview(null);
    if (result.success) setRevision((value) => value + 1);
  };

  const runPreview = async () => {
    if (!inventorySchema || !authSchema || !structuredMapping || !runtime || !runtimeFresh) return;
    setChecking(true);
    setPreview(null);
    setMessage('');
    try {
      const result = await fetchShopeeSgAuthorizationSigningPreview({
        accountId,
        shopId,
        credentialRef,
        schemaVerification: inventorySchema,
        authSchemaVerification: authSchema,
        structuredAuthorizationMapping: structuredMapping,
        signingRuntimeVerification: runtime
      });
      setPreview(result);
      setMessage('✅ バックエンド内部で署名計算Previewを確認しました。署名値・Partner Keyは表示せず、Shopee通信も行っていません。');
    } catch (error) {
      setMessage(`❌ ${describeBackendError(error)}`);
    } finally {
      setChecking(false);
    }
  };

  const identityValid = Boolean(accountId.trim() && /^[1-9]\d*$/.test(shopId.trim()) && /^SHOPEE_SG_[A-Z0-9_]{2,72}$/.test(credentialRef.trim()));
  const canPreview = Boolean(identityValid && schemaFresh && authFresh && mappingFresh && runtimeFresh && !checking);

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG 署名・Redirect URI Preview</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        Structured Auth Mappingの次段階として、公式確認した署名の出力方式・base string連結方式を機械的に固定します。Partner Keyはバックエンドだけで使い、署名値そのものはブラウザへ返しません。
      </p>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>実値を入力しないでください。</strong> Partner ID / Partner Key / Token / Authorization Codeは入力対象外です。Redirect URIも <code>{credentialRef}_REDIRECT_URI</code> としてバックエンド環境に設定します。
      </div>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.6)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginBottom: 12 }}>
        <div>Backend: <code>{getConfiguredBackendBaseUrl()}</code></div>
        <div>在庫Schema: <strong style={{ color: schemaFresh ? '#86efac' : '#fde68a' }}>{schemaFresh ? '有効' : '要確認'}</strong></div>
        <div>認証Schema: <strong style={{ color: authFresh ? '#86efac' : '#fde68a' }}>{authFresh ? '有効' : '要確認'}</strong></div>
        <div>Structured Mapping: <strong style={{ color: mappingFresh ? '#86efac' : '#fde68a' }}>{mappingFresh ? '有効' : '要確認'}</strong></div>
        {structuredMapping && <div>署名アルゴリズム表記: <code>{structuredMapping.signatureAlgorithm}</code> / Components: <code>{structuredMapping.signatureBaseComponents.join(' → ')}</code></div>}
        <div>Signing Runtime: <strong style={{ color: runtimeFresh ? '#86efac' : '#fde68a' }}>{runtimeFresh ? '有効' : '未確認/再確認必要'}</strong></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>署名実装方式
          <select style={{ ...inputStyle, marginTop: 5 }} value={implementation} onChange={(e) => setImplementation(e.target.value as typeof implementation)}>
            <option value="">公式本文から選択</option>
            {SHOPEE_SG_SIGNATURE_IMPLEMENTATIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>base string連結方式
          <select style={{ ...inputStyle, marginTop: 5 }} value={serialization} onChange={(e) => setSerialization(e.target.value as typeof serialization)}>
            <option value="">公式本文から選択</option>
            {SHOPEE_SG_SIGNATURE_BASE_SERIALIZATIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者<input style={{ ...inputStyle, marginTop: 5 }} value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認日時<input type="datetime-local" style={{ ...inputStyle, marginTop: 5 }} value={checkedAt} onChange={(e) => setCheckedAt(e.target.value)} /></label>
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>確認メモ
        <textarea style={{ ...inputStyle, minHeight: 70, marginTop: 5 }} value={verificationNote} onChange={(e) => setVerificationNote(e.target.value)} placeholder="公式本文で確認した出力形式・連結方法。秘密値は書かない" />
      </label>
      <label style={{ display: 'block', marginTop: 10, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={officialConfirmed} onChange={(e) => setOfficialConfirmed(e.target.checked)} /> Shopee公式本文で署名実装方式・出力形式・連結方式を直接確認した</label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}><input type="checkbox" checked={sgConfirmed} onChange={(e) => setSgConfirmed(e.target.checked)} /> 現在のSingapore向け仕様として適用できることを確認した</label>

      {evaluation.blockingReasons.length > 0 && <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>{evaluation.blockingReasons.join(' / ')}</div>}
      <button type="button" onClick={saveRuntime} disabled={!evaluation.canRecord} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(45,212,191,.5)', background: evaluation.canRecord ? 'rgba(13,148,136,.65)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: evaluation.canRecord ? 'pointer' : 'not-allowed' }}>
        署名Runtime確認を記録
      </button>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee販売アカウントID<input style={{ ...inputStyle, marginTop: 5 }} value={accountId} onChange={(e) => setAccountId(e.target.value)} /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee Shop ID<input style={{ ...inputStyle, marginTop: 5 }} value={shopId} onChange={(e) => setShopId(e.target.value)} inputMode="numeric" /></label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>バックエンド認証参照名<input style={{ ...inputStyle, marginTop: 5 }} value={credentialRef} onChange={(e) => setCredentialRef(e.target.value.toUpperCase())} /></label>
      </div>
      <button type="button" onClick={() => void runPreview()} disabled={!canPreview} style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(96,165,250,.5)', background: canPreview ? 'rgba(37,99,235,.7)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: canPreview ? 'pointer' : 'not-allowed' }}>
        {checking ? '確認中…' : '署名・Redirect URI Preview（Shopee通信なし）'}
      </button>

      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}
      {preview && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: 'rgba(15,23,42,.78)', border: '1px solid rgba(96,165,250,.28)', fontSize: 12, lineHeight: 1.75 }}>
          <div>Redirect URI: <code>{preview.redirectUriPreview || '未設定'}</code>（BACKEND_ENV）</div>
          <div>署名計算: <strong style={{ color: preview.signatureGenerated ? '#86efac' : '#fde68a' }}>{preview.signatureGenerated ? 'バックエンド内部で成功' : '未生成'}</strong></div>
          <div>方式: <code>{preview.signatureImplementation}</code> / base: <code>{preview.signatureBaseSerialization}</code></div>
          <div>Components: <code>{preview.signatureComponentRoles.join(' → ')}</code></div>
          <div>署名値返却: <strong>なし</strong> / base string返却: <strong>なし</strong> / Partner Key返却: <strong>なし</strong></div>
          <div>Authorization URL返却: <strong>なし</strong> / Shopee通信: <strong>{preview.networkAction}</strong></div>
          <div>次工程用の署名Request準備: <strong style={{ color: preview.canPrepareSignedAuthorizationRequest ? '#86efac' : '#fde68a' }}>{preview.canPrepareSignedAuthorizationRequest ? '準備可' : 'BLOCKED'}</strong></div>
          <div>認証開始: <strong style={{ color: '#fecaca' }}>不可</strong></div>
          {preview.unresolvedComponents.length > 0 && <div style={{ color: '#fecaca' }}>未解決component: {preview.unresolvedComponents.join(', ')}</div>}
          <div style={{ marginTop: 8, color: '#fca5a5' }}>{preview.blockingReasons.map((reason) => <div key={reason}>⛔ {reason}</div>)}</div>
        </div>
      )}
    </section>
  );
}
