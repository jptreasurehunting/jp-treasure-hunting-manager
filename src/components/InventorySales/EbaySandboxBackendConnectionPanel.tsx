import React, { useEffect, useMemo, useState } from 'react';
import {
  BackendHealthStatus,
  EbaySandboxConnectionStatus,
  EbaySandboxOAuthStartResponse,
  EbaySandboxVersionResponse,
  describeBackendError,
  fetchBackendHealth,
  fetchEbaySandboxConnectionStatus,
  getConfiguredBackendBaseUrl,
  isValidEbaySandboxCredentialRef,
  startEbaySandboxOAuth,
  verifyEbaySandboxInventoryVersion
} from '../../services/ebaySandboxBackendClient';
import {
  EBAY_SANDBOX_OAUTH_CHANGED_EVENT,
  EbaySandboxOAuthPlanRecord,
  loadEbaySandboxOAuthPlans
} from '../../services/ebaySandboxOAuthService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 9,
  border: '1px solid rgba(59, 130, 246, 0.45)',
  background: 'rgba(30, 64, 175, 0.62)',
  color: '#eff6ff',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 800
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: 'rgba(30, 41, 59, 0.95)',
  borderColor: 'rgba(148, 163, 184, 0.35)'
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

export function EbaySandboxBackendConnectionPanel() {
  const [plans, setPlans] = useState<EbaySandboxOAuthPlanRecord[]>(() => loadEbaySandboxOAuthPlans());
  const [selectedPlanId, setSelectedPlanId] = useState(() => plans[0]?.planId ?? '');
  const [health, setHealth] = useState<BackendHealthStatus | undefined>();
  const [connection, setConnection] = useState<EbaySandboxConnectionStatus | undefined>();
  const [oauthStart, setOauthStart] = useState<EbaySandboxOAuthStartResponse | undefined>();
  const [versionResult, setVersionResult] = useState<EbaySandboxVersionResponse | undefined>();
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState<'HEALTH' | 'START' | 'STATUS' | 'VERSION' | undefined>();

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.planId === selectedPlanId) ?? plans[0],
    [plans, selectedPlanId]
  );
  const backendBaseUrl = getConfiguredBackendBaseUrl();
  const credentialRefValid = selectedPlan ? isValidEbaySandboxCredentialRef(selectedPlan.backendCredentialRef) : false;

  const reloadPlans = () => {
    const nextPlans = loadEbaySandboxOAuthPlans();
    setPlans(nextPlans);
    setSelectedPlanId((current) => nextPlans.some((plan) => plan.planId === current) ? current : (nextPlans[0]?.planId ?? ''));
  };

  useEffect(() => {
    const handler = () => reloadPlans();
    window.addEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, handler);
    return () => window.removeEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    setConnection(undefined);
    setOauthStart(undefined);
    setVersionResult(undefined);
    setMessage('');
  }, [selectedPlan?.planId]);

  const run = async <T,>(action: 'HEALTH' | 'START' | 'STATUS' | 'VERSION', work: () => Promise<T>, onSuccess: (value: T) => void, successMessage: string) => {
    setBusyAction(action);
    setMessage('');
    try {
      const value = await work();
      onSuccess(value);
      setMessage(successMessage);
    } catch (error) {
      setMessage(describeBackendError(error));
    } finally {
      setBusyAction(undefined);
    }
  };

  const checkHealth = () => run(
    'HEALTH',
    () => fetchBackendHealth(),
    setHealth,
    'バックエンドへ接続できました。'
  );

  const startOAuth = () => {
    if (!selectedPlan) return;
    return run(
      'START',
      () => startEbaySandboxOAuth(selectedPlan.sellerAccountId, selectedPlan.backendCredentialRef),
      setOauthStart,
      'バックエンドが一度限りのstate付きSandbox認可URLを発行しました。まだeBayでの同意は完了していません。'
    );
  };

  const checkConnection = () => {
    if (!selectedPlan) return;
    return run(
      'STATUS',
      () => fetchEbaySandboxConnectionStatus(selectedPlan.sellerAccountId),
      setConnection,
      'Sandbox接続状態を再確認しました。'
    );
  };

  const checkVersion = () => {
    if (!selectedPlan) return;
    return run(
      'VERSION',
      () => verifyEbaySandboxInventoryVersion(selectedPlan.sellerAccountId),
      setVersionResult,
      'eBay Sandbox Inventory APIのgetVersion非破壊確認に成功しました。'
    );
  };

  const openAuthorizationWindow = () => {
    if (!oauthStart?.authorizationUrl) return;
    window.open(oauthStart.authorizationUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>eBay Sandbox バックエンド接続</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        ブラウザには秘密情報を置かず、バックエンド経由でSandbox OAuthを開始します。認可URLはバックエンドが発行した一度限りのstate付きURLだけを使用します。
      </p>

      {plans.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>先に「eBay Sandbox OAuth接続準備」で接続計画を保存してください。</p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>接続計画</label>
            <select style={inputStyle} value={selectedPlan?.planId ?? ''} onChange={(event) => setSelectedPlanId(event.target.value)}>
              {plans.map((plan) => (
                <option key={plan.planId} value={plan.planId}>{plan.sellerAccountId} | {plan.backendCredentialRef}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Backend</div>
              <strong style={{ color: '#f8fafc', wordBreak: 'break-all' }}>{backendBaseUrl}</strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Backend Health</div>
              <strong style={{ color: health?.status === 'UP' ? '#a7f3d0' : '#fde68a' }}>{health ? `${health.status} / DB ${health.database}` : '未確認'}</strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Sandbox OAuth</div>
              <strong style={{ color: connection?.connected ? '#a7f3d0' : '#fde68a' }}>{connection ? (connection.connected ? '接続済み' : '未接続') : '未確認'}</strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>getVersion</div>
              <strong style={{ color: versionResult?.success ? '#a7f3d0' : '#fde68a' }}>{versionResult?.version ?? '未実行'}</strong>
            </div>
          </div>

          {!credentialRefValid && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.28)', color: '#fecaca', marginBottom: 10 }}>
              認証情報参照名がバックエンド形式と一致しません。`EBAY_SANDBOX_MAIN` のような英大文字・数字・アンダースコア形式で接続計画を保存し直してください。
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" style={secondaryButtonStyle} onClick={checkHealth} disabled={Boolean(busyAction)}>
              {busyAction === 'HEALTH' ? '確認中…' : 'バックエンド状態確認'}
            </button>
            <button type="button" style={buttonStyle} onClick={startOAuth} disabled={Boolean(busyAction) || !credentialRefValid}>
              {busyAction === 'START' ? '準備中…' : 'Sandbox OAuth接続開始'}
            </button>
            <button type="button" style={buttonStyle} onClick={openAuthorizationWindow} disabled={!oauthStart?.authorizationUrl}>
              eBay Sandbox認可画面を開く
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={checkConnection} disabled={Boolean(busyAction)}>
              {busyAction === 'STATUS' ? '確認中…' : 'Sandbox接続状態を確認'}
            </button>
            <button type="button" style={secondaryButtonStyle} onClick={checkVersion} disabled={Boolean(busyAction) || !connection?.connected}>
              {busyAction === 'VERSION' ? '確認中…' : 'getVersionを実行（非破壊）'}
            </button>
          </div>

          {oauthStart && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(2, 6, 23, 0.62)', marginBottom: 10 }}>
              <div style={{ color: '#f8fafc', fontWeight: 800 }}>バックエンド発行の一時認可URL</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 5 }}>有効期限: {new Date(oauthStart.expiresAt).toLocaleString()}</div>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 5, wordBreak: 'break-all' }}>{oauthStart.authorizationUrl}</div>
            </div>
          )}

          {connection?.account && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(6, 78, 59, 0.22)', color: '#a7f3d0', marginBottom: 10 }}>
              Sandbox Token Vault接続を確認しました。最終認証記録: {connection.account.lastAuthDate ? new Date(connection.account.lastAuthDate).toLocaleString() : '日時不明'}
            </div>
          )}

          {versionResult && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(6, 78, 59, 0.22)', color: '#a7f3d0', marginBottom: 10 }}>
              Inventory API Version: {versionResult.version ?? '応答あり（version値なし）'} / 変更操作: なし / Tokenブラウザ返却: なし
            </div>
          )}

          {message && <div aria-live="polite" style={{ color: message.includes('DISABLED') || message.includes('ERROR') ? '#fecaca' : '#bfdbfe', fontSize: 13, marginBottom: 10 }}>{message}</div>}

          <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120, 53, 15, 0.22)', color: '#fde68a', fontSize: 12, lineHeight: 1.65 }}>
            SandboxのToken交換とgetVersion通信は、バックエンドで `EBAY_SANDBOX_NETWORK_ENABLED=true` を明示した場合だけ実行できます。通常状態は通信禁止です。ここからProduction出品は実行できません。
          </div>
        </>
      )}
    </section>
  );
}
