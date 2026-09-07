import React, { useEffect, useMemo, useState } from 'react';
import {
  EbaySandboxConnectionStatus,
  EbaySandboxMutationExecutionPreviewResponse,
  EbaySandboxMutationStageResponse,
  describeBackendError,
  fetchEbaySandboxConnectionStatus,
  fetchEbaySandboxMutationExecutionPreview,
  getConfiguredBackendBaseUrl,
  stageEbaySandboxMutationAuthorization
} from '../../services/ebaySandboxBackendClient';
import {
  EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT,
  EbayOfficialPayloadPreview,
  loadEbayOfficialPayloadPreviews
} from '../../services/ebayOfficialPayloadPreviewService';
import {
  EBAY_SANDBOX_MUTATION_AUTHORIZATION_CHANGED_EVENT,
  EbaySandboxMutationApprovalInput,
  EbaySandboxMutationAuthorizationRecord,
  EbaySandboxMutationOperation,
  evaluateEbaySandboxMutationApproval,
  evaluateStoredEbaySandboxMutationAuthorization,
  findEbaySandboxMutationAuthorization,
  loadEbaySandboxMutationAuthorizations,
  markEbaySandboxMutationAuthorizationBackendStaged,
  recordEbaySandboxMutationAuthorization
} from '../../services/ebaySandboxMutationGateService';
import {
  EBAY_SANDBOX_OAUTH_CHANGED_EVENT,
  EbaySandboxOAuthPlanRecord,
  loadEbaySandboxOAuthPlans
} from '../../services/ebaySandboxOAuthService';
import {
  EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT,
  EbaySandboxVerificationRecord,
  findEbaySandboxVerificationForAccount,
  loadEbaySandboxVerificationRecords
} from '../../services/ebaySandboxVerificationService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)', border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14, padding: 18, marginBottom: 16
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)', background: 'rgba(30, 41, 59, 0.95)',
  color: '#f8fafc', padding: '9px 10px'
};
const buttonStyle: React.CSSProperties = {
  borderRadius: 9, border: '1px solid rgba(248, 113, 113, 0.55)', background: 'rgba(153, 27, 27, 0.55)',
  color: '#fee2e2', padding: '9px 13px', cursor: 'pointer', fontWeight: 800
};

const initialInput: EbaySandboxMutationApprovalInput = {
  operationId: 'createOrReplaceInventoryItem', approvedBy: '', approvalReason: '',
  confirmedSandboxOnly: false, confirmedSellerAccountAndSku: false,
  confirmedPayloadPreview: false, confirmedMutationRisk: false
};

export function EbaySandboxMutationGatePanel() {
  const [previews, setPreviews] = useState<EbayOfficialPayloadPreview[]>(() => loadEbayOfficialPayloadPreviews());
  const [plans, setPlans] = useState<EbaySandboxOAuthPlanRecord[]>(() => loadEbaySandboxOAuthPlans());
  const [verifications, setVerifications] = useState<EbaySandboxVerificationRecord[]>(() => loadEbaySandboxVerificationRecords());
  const [authorizations, setAuthorizations] = useState<EbaySandboxMutationAuthorizationRecord[]>(() => loadEbaySandboxMutationAuthorizations());
  const [selectedPreviewId, setSelectedPreviewId] = useState(() => previews[0]?.previewId ?? '');
  const [connection, setConnection] = useState<EbaySandboxConnectionStatus | undefined>();
  const [stageResult, setStageResult] = useState<EbaySandboxMutationStageResponse | undefined>();
  const [executionPreview, setExecutionPreview] = useState<EbaySandboxMutationExecutionPreviewResponse | undefined>();
  const [input, setInput] = useState<EbaySandboxMutationApprovalInput>(initialInput);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const selectedPreview = previews.find((preview) => preview.previewId === selectedPreviewId) ?? previews[0];
  const selectedPlan = selectedPreview ? plans.find((plan) => plan.sellerAccountId === selectedPreview.sellerAccountIdExecutionContext) : undefined;
  const selectedVerification = selectedPreview ? findEbaySandboxVerificationForAccount(selectedPreview.sellerAccountIdExecutionContext, verifications) : undefined;
  const backendBaseUrl = getConfiguredBackendBaseUrl();
  const storedAuthorization = selectedPreview ? findEbaySandboxMutationAuthorization(selectedPreview.previewId, input.operationId, authorizations) : undefined;

  const evaluation = useMemo(
    () => evaluateEbaySandboxMutationApproval(selectedPreview, selectedPlan, selectedVerification, connection, backendBaseUrl, input),
    [selectedPreview, selectedPlan, selectedVerification, connection, backendBaseUrl, input]
  );
  const storedEvaluation = useMemo(
    () => evaluateStoredEbaySandboxMutationAuthorization(storedAuthorization, selectedPreview, selectedPlan, selectedVerification, connection, backendBaseUrl),
    [storedAuthorization, selectedPreview, selectedPlan, selectedVerification, connection, backendBaseUrl]
  );

  const reload = () => {
    const nextPreviews = loadEbayOfficialPayloadPreviews();
    setPreviews(nextPreviews);
    setPlans(loadEbaySandboxOAuthPlans());
    setVerifications(loadEbaySandboxVerificationRecords());
    setAuthorizations(loadEbaySandboxMutationAuthorizations());
    setSelectedPreviewId((current) => nextPreviews.some((preview) => preview.previewId === current) ? current : (nextPreviews[0]?.previewId ?? ''));
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT, handler);
    window.addEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, handler);
    window.addEventListener(EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT, handler);
    window.addEventListener(EBAY_SANDBOX_MUTATION_AUTHORIZATION_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT, handler);
      window.removeEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, handler);
      window.removeEventListener(EBAY_SANDBOX_VERIFICATION_CHANGED_EVENT, handler);
      window.removeEventListener(EBAY_SANDBOX_MUTATION_AUTHORIZATION_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    setConnection(undefined);
    setStageResult(undefined);
    setExecutionPreview(undefined);
    setInput(initialInput);
    setMessage('');
    if (!selectedPreview) return;
    let active = true;
    setBusy(true);
    fetchEbaySandboxConnectionStatus(selectedPreview.sellerAccountIdExecutionContext)
      .then((value) => { if (active) setConnection(value); })
      .catch((error) => { if (active) setMessage(describeBackendError(error)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [selectedPreview?.previewId]);

  const setField = <K extends keyof EbaySandboxMutationApprovalInput>(key: K, value: EbaySandboxMutationApprovalInput[K]) => {
    setExecutionPreview(undefined);
    setInput((current) => ({ ...current, [key]: value }));
  };

  const refreshConnection = async () => {
    if (!selectedPreview) return;
    setBusy(true); setMessage('');
    try {
      setConnection(await fetchEbaySandboxConnectionStatus(selectedPreview.sellerAccountIdExecutionContext));
      setMessage('現在のSandbox Token Vault接続を再確認しました。');
    } catch (error) { setMessage(describeBackendError(error)); }
    finally { setBusy(false); }
  };

  const approve = () => {
    const result = recordEbaySandboxMutationAuthorization(selectedPreview, selectedPlan, selectedVerification, connection, backendBaseUrl, input, authorizations);
    setMessage(result.messageJa);
    if (result.success) {
      setStageResult(undefined);
      setExecutionPreview(undefined);
      setAuthorizations(loadEbaySandboxMutationAuthorizations());
    }
  };

  const selectedStep = selectedPreview?.steps.find((step) => step.operationId === input.operationId);

  const stageOnBackend = async () => {
    if (!storedAuthorization || !selectedStep || !storedEvaluation.validForExecution) return;
    setBusy(true); setMessage('');
    try {
      const result = await stageEbaySandboxMutationAuthorization(storedAuthorization, selectedStep, backendBaseUrl);
      if (
        result.authorizationId !== storedAuthorization.authorizationId ||
        result.marketplaceId !== storedAuthorization.marketplaceId ||
        result.contentLanguage !== storedAuthorization.contentLanguage ||
        result.status !== 'STAGED_NOT_SENT' || result.networkAction !== 'NONE' ||
        result.externalWritePerformed !== false || result.tokenReturnedToBrowser !== false
      ) {
        setMessage('バックエンド応答が承認済みMarketplace/Localeまたは安全な実行予約状態と一致しないため、ローカル承認を消費済みにしていません。');
        return;
      }
      const localUpdate = markEbaySandboxMutationAuthorizationBackendStaged(storedAuthorization.authorizationId, result.stagedAt, loadEbaySandboxMutationAuthorizations());
      setStageResult(result);
      setExecutionPreview(undefined);
      setAuthorizations(loadEbaySandboxMutationAuthorizations());
      setMessage(localUpdate.success
        ? 'バックエンドへ1回限りの実行予約を保存し、Marketplace/Localeも固定しました。eBay APIへの送信は行っていません。'
        : `バックエンド予約は成功しましたが、ローカル表示更新に失敗しました: ${localUpdate.messageJa}`
      );
    } catch (error) { setMessage(describeBackendError(error)); }
    finally { setBusy(false); }
  };

  const loadExecutionPreview = async () => {
    if (!storedAuthorization?.backendStagingConsumed) return;
    setBusy(true); setMessage('');
    try {
      const result = await fetchEbaySandboxMutationExecutionPreview(storedAuthorization.authorizationId, backendBaseUrl);
      if (
        result.networkAction !== 'NONE' || result.externalWritePerformed !== false || result.tokenReturnedToBrowser !== false ||
        result.httpRequest.headers.Authorization !== 'Bearer <TOKENVAULT_REDACTED>' ||
        result.marketplaceId !== storedAuthorization.marketplaceId ||
        result.contentLanguage !== storedAuthorization.contentLanguage ||
        result.httpRequest.headers['Content-Language'] !== storedAuthorization.contentLanguage
      ) {
        setMessage('HTTP Request Previewが承認済みMarketplace/Localeまたは安全な非送信・Token秘匿状態と一致しないため表示していません。');
        return;
      }
      setExecutionPreview(result);
      setMessage('Marketplace/Localeを含むHTTP Request Previewを取得しました。eBay APIへの通信は行っていません。');
    } catch (error) {
      setExecutionPreview(undefined);
      setMessage(describeBackendError(error));
    } finally { setBusy(false); }
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>eBay Sandbox 変更操作 実行許可ゲート</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        Sandboxで変更系APIを実行する前の明示承認を記録します。MarketplaceIdとContent-Languageも承認時に固定します。実行予約とHTTP Request Previewまでは確認できますが、eBay API通信・商品作成・Offer作成・公開はまだ実行しません。
      </p>

      {previews.length === 0 ? <p style={{ color: '#64748b', margin: 0 }}>eBay正式Payload Previewがありません。</p> : <>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>Payload Preview</label>
          <select style={inputStyle} value={selectedPreview?.previewId ?? ''} onChange={(event) => setSelectedPreviewId(event.target.value)}>
            {previews.map((preview) => <option key={preview.previewId} value={preview.previewId}>{preview.sellerAccountIdExecutionContext} | {preview.sku} | {preview.marketplaceId}/{preview.contentLanguage}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10, marginBottom: 12 }}>
          {[
            ['Environment', 'SANDBOX'], ['販売アカウント', selectedPreview?.sellerAccountIdExecutionContext ?? ''],
            ['SKU', selectedPreview?.sku ?? ''], ['MarketplaceId', selectedPreview?.marketplaceId ?? '未確定'],
            ['Content-Language', selectedPreview?.contentLanguage ?? '未確定'],
            ['Sandbox接続', connection?.connected ? '接続済み' : busy ? '確認中' : '未確認 / 未接続'],
            ['Sandbox検証', selectedVerification ? '記録あり' : '未検証']
          ].map(([label, value]) => <div key={label} style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>{label}</div><strong style={{ color: '#f8fafc' }}>{value}</strong></div>)}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 12 }}>
          <div><label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>承認対象操作</label><select style={inputStyle} value={input.operationId} onChange={(event) => setField('operationId', event.target.value as EbaySandboxMutationOperation)}><option value="createOrReplaceInventoryItem">1. createOrReplaceInventoryItem</option><option value="createOffer">2. createOffer（現在BLOCKED）</option><option value="publishOffer">3. publishOffer（現在BLOCKED）</option></select></div>
          <div><label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>承認者</label><input style={inputStyle} value={input.approvedBy} onChange={(event) => setField('approvedBy', event.target.value)} /></div>
        </div>
        <div style={{ marginBottom: 12 }}><label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>実行許可理由</label><textarea style={{ ...inputStyle, minHeight: 72 }} value={input.approvalReason} onChange={(event) => setField('approvalReason', event.target.value)} /></div>

        {selectedStep && <div style={{ padding: 11, borderRadius: 8, background: 'rgba(2, 6, 23, 0.62)', marginBottom: 12, fontSize: 12, color: '#cbd5e1', lineHeight: 1.6 }}>
          <strong style={{ color: '#f8fafc' }}>承認対象:</strong> {selectedStep.method} {selectedStep.pathTemplate}<br />
          Payload Preview ID: {selectedPreview?.previewId}<br />
          Request Fingerprint: {selectedPreview?.requestFingerprint}<br />
          Marketplace/Locale: {selectedPreview?.marketplaceId} / {selectedPreview?.contentLanguage}
        </div>}

        <div style={{ display: 'grid', gap: 8, marginBottom: 12, color: '#cbd5e1', fontSize: 13 }}>
          <label><input type="checkbox" checked={input.confirmedSandboxOnly} onChange={(e) => setField('confirmedSandboxOnly', e.target.checked)} /> Sandbox専用で、Productionではないことを確認した</label>
          <label><input type="checkbox" checked={input.confirmedSellerAccountAndSku} onChange={(e) => setField('confirmedSellerAccountAndSku', e.target.checked)} /> 販売アカウントとSKUを確認した</label>
          <label><input type="checkbox" checked={input.confirmedPayloadPreview} onChange={(e) => setField('confirmedPayloadPreview', e.target.checked)} /> Payload Preview・MarketplaceId・Content-Languageを確認した</label>
          <label><input type="checkbox" checked={input.confirmedMutationRisk} onChange={(e) => setField('confirmedMutationRisk', e.target.checked)} /> 変更系APIでありSandboxデータを変更することを確認した</label>
        </div>

        {evaluation.blockingReasonsJa.length > 0 && <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127,29,29,.25)', color: '#fecaca', marginBottom: 10, fontSize: 12 }}>{evaluation.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}</div>}
        <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120,53,15,.22)', color: '#fde68a', marginBottom: 12, fontSize: 12 }}>{evaluation.warningsJa.map((warning) => <div key={warning}>・{warning}</div>)}</div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" style={{ ...buttonStyle, opacity: evaluation.canApprove ? 1 : .45 }} disabled={!evaluation.canApprove || busy} onClick={approve}>Sandbox変更操作を15分間・1回だけ承認（通信なし）</button>
          <button type="button" style={{ ...buttonStyle, background: 'rgba(180,83,9,.62)', opacity: storedEvaluation.validForExecution ? 1 : .45 }} disabled={!storedEvaluation.validForExecution || !storedAuthorization || !selectedStep || busy} onClick={stageOnBackend}>バックエンドへ実行予約（eBay送信なし）</button>
          <button type="button" style={{ ...buttonStyle, background: 'rgba(30,64,175,.62)', opacity: storedAuthorization?.backendStagingConsumed ? 1 : .45 }} disabled={!storedAuthorization?.backendStagingConsumed || busy} onClick={loadExecutionPreview}>HTTP Request Previewを確認（送信なし）</button>
          <button type="button" style={{ ...buttonStyle, background: 'rgba(30,41,59,.95)', color: '#f8fafc' }} disabled={busy} onClick={refreshConnection}>Sandbox接続を再確認</button>
        </div>

        {storedAuthorization && <div style={{ padding: 11, borderRadius: 8, background: storedAuthorization.backendStagingConsumed ? 'rgba(30,64,175,.25)' : storedEvaluation.validForExecution ? 'rgba(6,78,59,.25)' : 'rgba(120,53,15,.25)', color: '#dbeafe', marginBottom: 10, fontSize: 12, lineHeight: 1.65 }}>
          <strong>{storedAuthorization.backendStagingConsumed ? '実行許可記録: バックエンド予約で消費済み（eBay未送信）' : storedEvaluation.validForExecution ? '実行許可記録: 有効（ただし未実行）' : '実行許可記録: 再承認必要'}</strong><br />
          Authorization ID: {storedAuthorization.authorizationId}<br />Marketplace/Locale: {storedAuthorization.marketplaceId} / {storedAuthorization.contentLanguage}<br />
          有効期限: {new Date(storedAuthorization.expiresAt).toLocaleString()}<br />
          {storedAuthorization.backendStagedAt && <>バックエンド予約: {new Date(storedAuthorization.backendStagedAt).toLocaleString()}<br /></>}
          {storedEvaluation.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
        </div>}

        {stageResult && <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30,64,175,.2)', color: '#bfdbfe', marginBottom: 10, fontSize: 12 }}>
          Backend status: {stageResult.status} / {stageResult.marketplaceId} / {stageResult.contentLanguage} / networkAction: {stageResult.networkAction} / externalWritePerformed: {String(stageResult.externalWritePerformed)}
        </div>}

        {executionPreview && <div style={{ padding: 12, borderRadius: 8, background: 'rgba(2,6,23,.82)', border: '1px solid rgba(96,165,250,.28)', marginBottom: 10 }}>
          <div style={{ color: '#bfdbfe', fontSize: 13, fontWeight: 800, marginBottom: 8 }}>HTTP Execution Preview — {executionPreview.readyForExternalNetwork ? 'HTTP形状確認済み（未送信）' : 'まだ送信不可'}</div>
          <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginBottom: 8 }}>
            MarketplaceId: {executionPreview.marketplaceId}<br />
            Content-Language: {executionPreview.contentLanguage}<br />
            {executionPreview.httpRequest.method} {executionPreview.httpRequest.url}<br />
            Authorization: {executionPreview.httpRequest.headers.Authorization}<br />
            Content-Type: {executionPreview.httpRequest.headers['Content-Type']}<br />
            Content-Language Header: {executionPreview.httpRequest.headers['Content-Language']}<br />
            networkAction: {executionPreview.networkAction} / externalWritePerformed: {String(executionPreview.externalWritePerformed)}
          </div>
          {executionPreview.blockingReasons.map((reason) => <div key={reason} style={{ color: '#fde68a', fontSize: 12 }}>・{reason}</div>)}
          <pre style={{ margin: '10px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#cbd5e1', fontSize: 11, maxHeight: 360, overflow: 'auto' }}>{JSON.stringify(executionPreview.httpRequest.body, null, 2)}</pre>
        </div>}

        {message && <div aria-live="polite" style={{ color: '#bfdbfe', fontSize: 13 }}>{message}</div>}
      </>}
    </section>
  );
}
