import React, { useMemo, useState } from 'react';
import {
  getLatestShopeeSgApiSchemaVerification,
  isShopeeSgSchemaVerificationFresh
} from '../../services/shopeeSgApiSchemaVerificationService';
import {
  getLatestShopeeSgAuthSchemaVerification,
  isShopeeSgAuthSchemaVerificationFresh
} from '../../services/shopeeSgAuthSchemaVerificationService';
import { loadShopeeSgInventoryMappings } from '../../services/shopeeSgInventoryMappingService';
import {
  fetchShopeeSgAuthReadiness,
  fetchShopeeSgAuthTransportPlan,
  isValidShopeeSgCredentialRef,
  ShopeeSgAuthReadinessResponse,
  ShopeeSgAuthTransportPlanResponse
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

export function ShopeeSgBackendAuthReadinessPanel() {
  const initial = useMemo(() => initialMappingIdentity(), []);
  const [accountId, setAccountId] = useState(initial.accountId);
  const [shopId, setShopId] = useState(initial.shopId);
  const [credentialRef, setCredentialRef] = useState('SHOPEE_SG_MAIN');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ShopeeSgAuthReadinessResponse | null>(null);
  const [transportPlan, setTransportPlan] = useState<ShopeeSgAuthTransportPlanResponse | null>(null);
  const [message, setMessage] = useState('');

  const latestSchema = getLatestShopeeSgApiSchemaVerification();
  const schemaFresh = isShopeeSgSchemaVerificationFresh(latestSchema);
  const latestAuthSchema = getLatestShopeeSgAuthSchemaVerification();
  const authSchemaFresh = isShopeeSgAuthSchemaVerificationFresh(latestAuthSchema);
  const credentialRefValid = isValidShopeeSgCredentialRef(credentialRef);
  const shopIdValid = /^[1-9]\d*$/.test(shopId.trim());
  const baseReady = Boolean(accountId.trim() && shopIdValid && credentialRefValid && latestSchema && schemaFresh);
  const canCheck = baseReady && !checking;
  const canBuildTransportPlan = Boolean(baseReady && latestAuthSchema && authSchemaFresh && !checking);

  const check = async () => {
    if (!latestSchema || !canCheck) return;
    setChecking(true);
    setResult(null);
    setTransportPlan(null);
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

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG バックエンド認証準備</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        Partner ID / Partner Keyがバックエンド環境に用意されているかを秘密値なしで確認し、在庫Schemaと認証Schemaを照合します。認証Transportは段階だけ定義し、外部通信・Token交換・署名・在庫更新は別承認まで無効です。
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
    </section>
  );
}
