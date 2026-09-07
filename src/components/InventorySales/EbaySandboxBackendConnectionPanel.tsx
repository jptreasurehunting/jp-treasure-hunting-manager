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
import {
  EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT,
  EbaySandboxVerificationRecord,
  evaluateStoredEbaySandboxVerification,
  findEbaySandboxVerificationForAccount,
  loadEbaySandboxVerificationRecords,
  recordEbaySandboxVerification
} from '../../services/ebaySandboxVerificationService';

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
  const [verificationRecords, setVerificationRecords] = useState<EbaySandboxVerificationRecord[]>(() => loadEbaySandboxVerificationRecords());
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
  const storedVerification = selectedPlan
    ? findEbaySandboxVerificationForAccount(selectedPlan.sellerAccountId, verificationRecords)
    : undefined;
  const verificationEvaluation = useMemo(
    () => evaluateStoredEbaySandboxVerification(storedVerification, selectedPlan, connection, backendBaseUrl),
    [storedVerification, selectedPlan, connection, backendBaseUrl]
  );

  const reloadPlans = () => {
    const nextPlans = loadEbaySandboxOAuthPlans();
    setPlans(nextPlans);
    setSelectedPlanId((current) => nextPlans.some((plan) => plan.planId === current) ? current : (nextPlans[0]?.planId ?? ''));
  };

  const reloadVerificationRecords = () => setVerificationRecords(loadEbaySandboxVerificationRecords());

  useEffect(() => {
    const planHandler = () => reloadPlans();
    const verificationHandler = () => reloadVerificationRecords();
    window.addEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, planHandler);
    window.addEventListener(EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT, verificationHandler);
    return () => {
      window.removeEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, planHandler);
      window.removeEventListener(EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT, verificationHandler);
    };
  }, []);

  useEffect(() => {
    setConnection(undefined);
    setOauthStart(undefined);
    setVersionResult(undefined);
    setMessage('');
  }, [selectedPlan?.planId]);

  useEffect(() => {
    if (!selectedPlan) return;
    let active = true;
    fetchEbaySandboxConnectionStatus(selectedPlan.sellerAccountId)
      .then((value) => { if (active) setConnection(value); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [selectedPlan?.planId]);

  useEffect(() => {
    if (!selectedPlan) return;
    const refreshOnFocus = () => {
      fetchEbaySandboxConnectionStatus(selectedPlan.sellerAccountId)
        .then((value) => setConnection(value))
        .catch(() => undefined);
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, [selectedPlan?.planId]);

  useEffect(() => {
    if (!selectedPlan || !oauthStart || connection?.connected) return;
    const expiresAtMs = Date.parse(oauthStart.expiresAt);
    if (!Number.isFinite(expiresAtMs)) return;

    let active = true;
    const refresh = async () => {
      if (!active || Date.now() >= expiresAtMs) return;
      try {
        const next = await fetchEbaySandboxConnectionStatus(selectedPlan.sellerAccountId);
        if (!active) return;
        setConnection(next);
        if (next.connected) {
          setMessage('Sandbox OAuth完了を自動検出しました。次にgetVersionで非破壊確認してください。');
        }
      } catch {
        // OAuth consent may still be in progress. Keep the current UI state and retry until the one-time URL expires.
      }
    };

    const timer = window.setInterval(refresh, 3000);
    void refresh();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selectedPlan?.planId, oauthStart?.expiresAt, connection?.connected]);

  const run = async <T,>(action: 'HEALTH' | 'START' | 'STATUS', work: () => Promise<T>, onSuccess: (value: T) => void, successMessage: string) => {
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
      'バックエンドが一度限りのstate付きSandbox認可URLを発行しました。eBayで同意すると接続状態を自動確認します。'
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

  const checkVersion = async () => {
    if (!selectedPlan || !connection?.connected) return;
    setBusyAction('VERSION');
    setMessage('');
    try {
      const value = await verifyEbaySandboxInventoryVersion(selectedPlan.sellerAccountId);
      setVersionResult(value);
      const result = recordEbaySandboxVerification(
        selectedPlan,
        connection,
        value,
        backendBaseUrl,
        verificationRecords
      );
      if (!result.success) {
        setMessage(`getVersionは成功しましたが検証記録を保存できませんでした: ${result.reasonsJa.join(' / ')}`);
      } else {
        reloadVerificationRecords();
        setMessage('eBay Sandbox Inventory APIのgetVersion非破壊確認に成功し、「Sandbox接続検証済み」として保存しました。');
      }
    } catch (error) {
      setMessage(describeBackendError(error));
    } finally {
      setBusyAction(undefined);
    }
  };

  const openAuthorizationWindow = () => {
    if (!oauthStart?.authorizationUrl) return;
    window.open(oauthStart.authorizationUrl, '_blank', 'noopener,noreferrer');
  };

  const displayedVersion = versionResult?.version ?? storedVerification?.inventoryApiVersion ?? undefined;

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>eBay Sandbox バックエンド接続</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        ブラウザには秘密情報を置かず、バックエンド経由でSandbox OAuthを開始します。認可後はToken Vault接続を自動確認し、getVersion成功だけを安全な検証記録として保存します。
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
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
              <strong style={{ color: connection?.connected ? '#a7f3d0' : '#fde68a' }}>{connection ? (connection.connected ? '接続済み' : '未接続') : '確認中 / 未確認'}</strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>getVersion</div>
              <strong style={{ color: displayedVersion !== undefined ? '#a7f3d0' : '#fde68a' }}>{displayedVersion ?? '未実行'}</strong>
            </div>
            <div style={{ padding: 11, borderRadius: 8, background: verificationEvaluation.valid ? 'rgba(6, 78, 59, 0.28)' : 'rgba(120, 53, 15, 0.26)' }}>
              <div style={{ color: '#94a3b8', fontSize: 11 }}>Sandbox検証</div>
              <strong style={{ color: verificationEvaluation.valid ? '#a7f3d0' : '#fde68a' }}>
                {storedVerification ? (verificationEvaluation.valid ? '接続検証済み' : '再検証必要') : '未検証'}
              </strong>
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
              {busyAction === 'VERSION' ? '確認中…' : verificationEvaluation.valid ? 'getVersionを再検証（非破壊）' : 'getVersionを実行（非破壊）'}
            </button>
          </div>

          {oauthStart && (
            <div style={{ padding: 12, borderRadius: 9, background: 'rgba(2, 6, 23, 0.62)', marginBottom: 10 }}>
              <div style={{ color: '#f8fafc', fontWeight: 800 }}>バックエンド発行の一時認可URL</div>
              <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 5 }}>有効期限: {new Date(oauthStart.expiresAt).toLocaleString()}</div>
              <div style={{ color: '#64748b', fontSize: 11, marginTop: 5, wordBreak: 'break-all' }}>{oauthStart.authorizationUrl}</div>
              {!connection?.connected && <div style={{ color: '#93c5fd', fontSize: 11, marginTop: 6 }}>認可完了を数秒間隔で自動確認します。eBayの画面から戻った際にも再確認します。</div>}
            </div>
          )}

          {connection?.account && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(6, 78, 59, 0.22)', color: '#a7f3d0', marginBottom: 10 }}>
              Sandbox Token Vault接続を確認しました。最終認証記録: {connection.account.lastAuthDate ? new Date(connection.account.lastAuthDate).toLocaleString() : '日時不明'}
            </div>
          )}

          {storedVerification && (
            <div style={{ padding: 11, borderRadius: 8, background: verificationEvaluation.valid ? 'rgba(6, 78, 59, 0.22)' : 'rgba(120, 53, 15, 0.24)', color: verificationEvaluation.valid ? '#a7f3d0' : '#fde68a', marginBottom: 10 }}>
              <strong>{verificationEvaluation.valid ? 'Sandbox接続検証済み' : '保存済み検証は再確認が必要です'}</strong><br />
              検証日時: {new Date(storedVerification.verifiedAt).toLocaleString()} / Inventory API Version: {storedVerification.inventoryApiVersion ?? 'version値なし'}<br />
              {verificationEvaluation.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          {versionResult && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(6, 78, 59, 0.22)', color: '#a7f3d0', marginBottom: 10 }}>
              今回のgetVersion応答: {versionResult.version ?? '応答あり（version値なし）'} / 変更操作: なし / Tokenブラウザ返却: なし
            </div>
          )}

          {message && <div aria-live="polite" style={{ color: message.includes('DISABLED') || message.includes('ERROR') || message.includes('できません') ? '#fecaca' : '#bfdbfe', fontSize: 13, marginBottom: 10 }}>{message}</div>}

          <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120, 53, 15, 0.22)', color: '#fde68a', fontSize: 12, lineHeight: 1.65 }}>
            SandboxのToken交換とgetVersion通信は、バックエンドで `EBAY_SANDBOX_NETWORK_ENABLED=true` を明示した場合だけ実行できます。通常状態は通信禁止です。検証記録にはTokenやClient Secretを保存しません。ここからProduction出品は実行できません。
          </div>
        </>
      )}
    </section>
  );
}
