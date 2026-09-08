import React, { useEffect, useMemo, useState } from 'react';
import {
  getLatestShopeeSgApiSchemaVerification,
  isShopeeSgSchemaVerificationFresh,
  SHOPEE_SG_SCHEMA_VERIFICATION_CHANGED_EVENT
} from '../../services/shopeeSgApiSchemaVerificationService';
import {
  getLatestShopeeSgAuthSchemaVerification,
  isShopeeSgAuthSchemaVerificationFresh,
  SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT
} from '../../services/shopeeSgAuthSchemaVerificationService';
import {
  getLatestShopeeSgStructuredAuthMapping,
  isShopeeSgStructuredAuthMappingFresh,
  SHOPEE_SG_STRUCTURED_AUTH_MAPPING_CHANGED_EVENT
} from '../../services/shopeeSgStructuredAuthMappingService';
import { loadShopeeSgInventoryMappings } from '../../services/shopeeSgInventoryMappingService';
import {
  fetchShopeeSgAuthReadiness,
  fetchShopeeSgAuthTransportPlan,
  fetchShopeeSgAuthorizationRequestPreview,
  isValidShopeeSgCredentialRef,
  ShopeeSgAuthReadinessResponse,
  ShopeeSgAuthTransportPlanResponse,
  ShopeeSgAuthorizationRequestPreviewResponse
} from '../../services/shopeeSgBackendAuthClient';
import {
  describeBackendError,
  getConfiguredBackendBaseUrl
} from '../../services/ebaySandboxBackendClient';

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

function initialMappingIdentity() {
  const records = loadShopeeSgInventoryMappings()
    .filter((record) => record.marketplaceRegion === 'SG')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  const first = records[0];
  return {
    accountId: first?.sellerAccountId || 'shopee_sg_main',
    shopId: first?.shopId || ''
  };
}

function yesNo(value: boolean): string {
  return value ? '設定あり' : '未設定';
}

function requirementColor(status: string): string {
  if (status === 'VERIFIED' || status === 'CONFIGURED') return '#86efac';
  if (status === 'REVIEW_REQUIRED') return '#fde68a';
  return '#fecaca';
}

export function ShopeeSgBackendAuthReadinessPanel() {
  const initial = useMemo(() => initialMappingIdentity(), []);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [shopId, setShopId] = useState(initial.shopId);
  const [credentialRef, setCredentialRef] = useState('SHOPEE_SG_MAIN');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ShopeeSgAuthReadinessResponse | null>(null);
  const [transportPlan, setTransportPlan] = useState<ShopeeSgAuthTransportPlanResponse | null>(null);
  const [authorizationPreview, setAuthorizationPreview] = useState<ShopeeSgAuthorizationRequestPreviewResponse | null>(null);
  const [message, setMessage] = useState('');
  const [evidenceRevision, setEvidenceRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setEvidenceRevision((value) => value + 1);
    window.addEventListener(SHOPEE_SG_SCHEMA_VERIFICATION_CHANGED_EVENT, refresh);
    window.addEventListener(SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT, refresh);
    window.addEventListener(SHOPEE_SG_STRUCTURED_AUTH_MAPPING_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(SHOPEE_SG_SCHEMA_VERIFICATION_CHANGED_EVENT, refresh);
      window.removeEventListener(SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT, refresh);
      window.removeEventListener(SHOPEE_SG_STRUCTURED_AUTH_MAPPING_CHANGED_EVENT, refresh);
    };
  }, []);

  const latestSchema = useMemo(() => getLatestShopeeSgApiSchemaVerification(), [evidenceRevision]);
  const schemaFresh = isShopeeSgSchemaVerificationFresh(latestSchema);
  const latestAuthSchema = useMemo(() => getLatestShopeeSgAuthSchemaVerification(), [evidenceRevision]);
  const authSchemaFresh = isShopeeSgAuthSchemaVerificationFresh(latestAuthSchema);
  const latestStructuredMapping = useMemo(
    () => latestAuthSchema ? getLatestShopeeSgStructuredAuthMapping(latestAuthSchema.verificationId) : undefined,
    [latestAuthSchema, evidenceRevision]
  );
  const structuredMappingFresh = Boolean(
    latestStructuredMapping && latestAuthSchema && isShopeeSgStructuredAuthMappingFresh(latestStructuredMapping, latestAuthSchema)
  );

  const credentialRefValid = isValidShopeeSgCredentialRef(credentialRef);
  const shopIdValid = /^[1-9]\d*$/.test(shopId.trim());
  const baseReady = Boolean(accountId.trim() && shopIdValid && credentialRefValid && latestSchema && schemaFresh);
  const canCheck = baseReady && !checking;
  const canBuildTransportPlan = Boolean(baseReady && latestAuthSchema && authSchemaFresh && !checking);
  const canBuildAuthorizationPreview = canBuildTransportPlan;

  const check = async () => {
    if (!latestSchema || !canCheck) return;
    setChecking(true);
    setResult(null);
    setTransportPlan(null);
    setAuthorizationPreview(null);
    setMessage('');
    try {
      const response = await fetchShopeeSgAuthReadiness({
        accountId,
        shopId,
        credentialRef,
        schemaVerification: latestSchema,
        authSchemaVerification: latestAuthSchema && authSchemaFresh ? latestAuthSchema : undefined
      });
      setResult(response);
      setMessage('✅ バックエンドの安全な設定状態を確認しました。Shopeeへの通信は行っていません。');
    } catch (error) {
      setMessage(`❌ ${describeBackendError(error)}`);
    } finally {
      setChecking(false);
    }
  };

  const buildTransport = async () => {
    if (!latestSchema || !latestAuthSchema || !canBuildTransportPlan) return;
    setChecking(true);
    setTransportPlan(null);
    setAuthorizationPreview(null);
    setMessage('');
    try {
      const response = await fetchShopeeSgAuthTransportPlan({
        accountId,
        shopId,
        credentialRef,
        schemaVerification: latestSchema,
        authSchemaVerification: latestAuthSchema
      });
      setTransportPlan(response);
      setMessage('✅ 認証Transportの契約だけを生成しました。全段階は未実装で、Shopee通信は行っていません。');
    } catch (error) {
      setMessage(`❌ ${describeBackendError(error)}`);
    } finally {
      setChecking(false);
    }
  };

  const buildAuthorizationPreview = async () => {
    if (!latestSchema || !latestAuthSchema || !canBuildAuthorizationPreview) return;
    setChecking(true);
    setAuthorizationPreview(null);
    setMessage('');
    try {
      const response = await fetchShopeeSgAuthorizationRequestPreview({
        accountId,
        shopId,
        credentialRef,
        schemaVerification: latestSchema,
        authSchemaVerification: latestAuthSchema,
        structuredAuthorizationMapping: structuredMappingFresh ? latestStructuredMapping : undefined
      });
      setAuthorizationPreview(response);
      setMessage(
        response.previewStatus === 'STRUCTURED_MAPPING_VERIFIED'
          ? '✅ Structured Mappingを使ったAuthorization Request Previewを生成しました。実行URL・署名は生成せず、Shopee通信も行っていません。'
          : '✅ Authorization Request Previewを生成しました。Structured Mappingが未確認のため、実行URL・署名は生成していません。'
      );
    } catch (error) {
      setMessage(`❌ ${describeBackendError(error)}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG バックエンド認証準備</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        Partner ID / Partner Keyがバックエンド環境に用意されているかを秘密値なしで確認し、在庫Schema・認証Schema・Structured Auth Mappingを照合します。外部通信・Token交換・署名・在庫更新は別承認まで無効です。
      </p>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>Partner KeyやAccess Tokenをこの画面へ入力しないでください。</strong> 入力するのは <code>SHOPEE_SG_MAIN</code> のようなバックエンド側の参照名だけです。
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee販売アカウントID
          <input style={{ ...inputStyle, marginTop: 5 }} value={accountId} onChange={(e) => setAccountId(e.target.value)} placeholder="shopee_sg_main" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Shopee Shop ID
          <input style={{ ...inputStyle, marginTop: 5 }} value={shopId} onChange={(e) => setShopId(e.target.value)} inputMode="numeric" placeholder="Seller Centreで確認した数字ID" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>バックエンド認証情報参照名
          <input style={{ ...inputStyle, marginTop: 5 }} value={credentialRef} onChange={(e) => setCredentialRef(e.target.value.toUpperCase())} placeholder="SHOPEE_SG_MAIN" />
        </label>
      </div>

      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.65)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.7 }}>
        <div>Backend: <code>{getConfiguredBackendBaseUrl()}</code></div>
        <div>
          在庫API Schema: <strong style={{ color: latestSchema && schemaFresh ? '#86efac' : '#fde68a' }}>
            {latestSchema ? (schemaFresh ? '確認記録あり・90日以内' : '再確認必要') : '確認記録なし'}
          </strong>
        </div>
        <div>
          認証・署名Schema: <strong style={{ color: latestAuthSchema && authSchemaFresh ? '#86efac' : '#fde68a' }}>
            {latestAuthSchema ? (authSchemaFresh ? '確認記録あり・90日以内' : '再確認必要') : '確認記録なし'}
          </strong>
        </div>
        <div>
          Structured Auth Mapping: <strong style={{ color: structuredMappingFresh ? '#86efac' : '#fde68a' }}>
            {latestStructuredMapping ? (structuredMappingFresh ? '確認記録あり・利用可能' : '再確認必要') : '確認記録なし'}
          </strong>
        </div>
        {!credentialRefValid && <div style={{ color: '#fecaca' }}>認証情報参照名は SHOPEE_SG_ で始まる形式が必要です。</div>}
        {shopId && !shopIdValid && <div style={{ color: '#fecaca' }}>Shop IDは正の整数IDで指定してください。</div>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button
          type="button"
          onClick={() => void check()}
          disabled={!canCheck}
          style={{ borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(96,165,250,.5)', background: canCheck ? 'rgba(37,99,235,.7)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: canCheck ? 'pointer' : 'not-allowed' }}
        >
          {checking ? '確認中…' : 'バックエンド認証準備を確認（Shopee通信なし）'}
        </button>
        <button
          type="button"
          onClick={() => void buildTransport()}
          disabled={!canBuildTransportPlan}
          style={{ borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(167,139,250,.5)', background: canBuildTransportPlan ? 'rgba(109,40,217,.65)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: canBuildTransportPlan ? 'pointer' : 'not-allowed' }}
        >
          認証Transport契約を生成（通信なし）
        </button>
        <button
          type="button"
          onClick={() => void buildAuthorizationPreview()}
          disabled={!canBuildAuthorizationPreview}
          style={{ borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(45,212,191,.5)', background: canBuildAuthorizationPreview ? 'rgba(13,148,136,.65)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: canBuildAuthorizationPreview ? 'pointer' : 'not-allowed' }}
        >
          Authorization Request Preview（通信なし）
        </button>
      </div>

      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}

      {result && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: 'rgba(15,23,42,.78)', border: '1px solid rgba(148,163,184,.18)', fontSize: 12, lineHeight: 1.75 }}>
          <div>Partner ID: <strong>{yesNo(result.credentialState.partnerIdConfigured)}</strong></div>
          <div>Partner Key: <strong>{yesNo(result.credentialState.partnerKeyConfigured)}</strong>（値は非表示）</div>
          <div>在庫Schema: <strong>{result.inventorySchemaStatus}</strong></div>
          <div>認証Schema: <strong style={{ color: result.authSchemaStatus === 'OFFICIAL_AUTH_SCHEMA_VERIFIED' ? '#86efac' : '#fde68a' }}>{result.authSchemaStatus}</strong></div>
          <div>認証開始: <strong style={{ color: '#fecaca' }}>不可</strong></div>
          <div>API実行: <strong style={{ color: '#fecaca' }}>不可</strong></div>
          <div>在庫書込: <strong style={{ color: '#fecaca' }}>不可</strong></div>
          <div>外部通信: <strong>{result.networkAction}</strong></div>
          <div>秘密値返却: <strong>{result.secretValuesReturned ? 'あり' : 'なし'}</strong></div>
          <div style={{ marginTop: 8, color: '#fca5a5' }}>
            {result.blockingReasons.map((reason) => <div key={reason}>⛔ {reason}</div>)}
          </div>
        </div>
      )}

      {transportPlan && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: 'rgba(46,16,101,.18)', border: '1px solid rgba(167,139,250,.3)', fontSize: 12, lineHeight: 1.75 }}>
          <div>Transport状態: <strong>{transportPlan.transportImplementationStatus}</strong></div>
          <div>外部通信: <strong>{transportPlan.networkAction}</strong> / 在庫書込: <strong>不可</strong> / 秘密値返却: <strong>なし</strong></div>
          <div style={{ marginTop: 8, color: '#ddd6fe', fontWeight: 700 }}>段階</div>
          {transportPlan.stages.map((stage) => (
            <div key={stage.stage} style={{ marginTop: 5 }}>
              <code>{stage.stage}</code> — <strong style={{ color: '#fecaca' }}>{stage.status}</strong> / Network: 禁止
            </div>
          ))}
          <div style={{ marginTop: 8, color: '#fca5a5' }}>
            {transportPlan.blockingReasons.map((reason) => <div key={reason}>⛔ {reason}</div>)}
          </div>
        </div>
      )}

      {authorizationPreview && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 9, background: 'rgba(4,47,46,.22)', border: '1px solid rgba(45,212,191,.3)', fontSize: 12, lineHeight: 1.75 }}>
          <div>Preview状態: <strong>{authorizationPreview.previewStatus}</strong></div>
          <div>確認済みEndpoint: <code>{authorizationPreview.authorizationEndpoint}</code></div>
          <div>HTTP Method: <strong>{authorizationPreview.requestMethod}</strong>{authorizationPreview.requestMethod === 'UNVERIFIED' ? '（Structured Mapping未確認）' : '（Structured Mapping確認済み）'}</div>
          <div>Structured Mapping ID: <code>{authorizationPreview.structuredMappingId || 'なし'}</code></div>
          <div>実行URL: <strong>生成なし</strong> / 署名値: <strong>生成なし</strong></div>
          <div>外部通信: <strong>{authorizationPreview.networkAction}</strong> / 送信許可: <strong>なし</strong></div>
          <div>Partner ID値返却: <strong>なし</strong> / Partner Key値返却: <strong>なし</strong></div>

          {authorizationPreview.queryTemplate && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#99f6e4', fontWeight: 700 }}>Query wire mapping（値は未生成）</div>
              {authorizationPreview.queryTemplate.map((entry) => (
                <div key={entry.role}><code>{entry.role}</code> → <code>{entry.fieldName}</code> / {entry.valueSource}</div>
              ))}
            </div>
          )}
          {authorizationPreview.signatureTemplate && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#99f6e4', fontWeight: 700 }}>署名構造（署名値は未生成）</div>
              <div>Algorithm: <code>{authorizationPreview.signatureTemplate.algorithm}</code></div>
              <div>API Path: <code>{authorizationPreview.signatureTemplate.apiPath}</code></div>
              <div>Base components: <code>{authorizationPreview.signatureTemplate.baseComponents.join(' → ')}</code></div>
            </div>
          )}
          {authorizationPreview.callbackTemplate && (
            <div style={{ marginTop: 8 }}>
              <div style={{ color: '#99f6e4', fontWeight: 700 }}>Callback binding</div>
              <div>Authorization code field: <code>{authorizationPreview.callbackTemplate.authorizationCodeField}</code></div>
              <div>Shop ID field: <code>{authorizationPreview.callbackTemplate.shopIdField}</code></div>
            </div>
          )}

          <div style={{ marginTop: 8, color: '#99f6e4', fontWeight: 700 }}>実行可能化までの確認条件</div>
          {authorizationPreview.requirements.map((requirement) => (
            <div key={requirement.requirement} style={{ marginTop: 5 }}>
              <code>{requirement.requirement}</code> — <strong style={{ color: requirementColor(requirement.status) }}>{requirement.status}</strong>
              <div style={{ color: '#94a3b8' }}>{requirement.detail}</div>
            </div>
          ))}
          <div style={{ marginTop: 8, color: '#fca5a5' }}>
            {authorizationPreview.blockingReasons.map((reason) => <div key={reason}>⛔ {reason}</div>)}
          </div>
        </div>
      )}
    </section>
  );
}
