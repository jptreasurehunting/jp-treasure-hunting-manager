import React, { useEffect, useMemo, useState } from 'react';
import {
  EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT,
  EbayOfficialPayloadPreview,
  loadEbayOfficialPayloadPreviews
} from '../../services/ebayOfficialPayloadPreviewService';
import {
  EBAY_SANDBOX_OAUTH_CHANGED_EVENT,
  EbaySandboxOAuthPlanInput,
  EbaySandboxOAuthPlanRecord,
  evaluateEbaySandboxExecutionReadiness,
  evaluateEbaySandboxOAuthPlan,
  loadEbaySandboxOAuthPlans,
  recordEbaySandboxOAuthPlan
} from '../../services/ebaySandboxOAuthService';

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
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(30, 41, 59, 0.95)',
  color: '#f8fafc',
  padding: '9px 10px'
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  color: '#cbd5e1',
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 5
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

interface FormState {
  clientId: string;
  ruName: string;
  sandboxUserAlias: string;
  backendCredentialRef: string;
  checkedAt: string;
  checkedBy: string;
  verificationNote: string;
}

function toLocalDateTimeInput(value?: string): string {
  const date = value ? new Date(value) : new Date();
  if (!Number.isFinite(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formFromPlan(plan?: EbaySandboxOAuthPlanRecord): FormState {
  return {
    clientId: plan?.clientId ?? '',
    ruName: plan?.ruName ?? '',
    sandboxUserAlias: plan?.sandboxUserAlias ?? '',
    backendCredentialRef: plan?.backendCredentialRef ?? '',
    checkedAt: toLocalDateTimeInput(plan?.checkedAt),
    checkedBy: plan?.checkedBy ?? '',
    verificationNote: plan?.verificationNote ?? ''
  };
}

function toInput(form: FormState): EbaySandboxOAuthPlanInput {
  return {
    ...form,
    checkedAt: form.checkedAt ? new Date(form.checkedAt).toISOString() : ''
  };
}

export function EbaySandboxOAuthPanel() {
  const [previews, setPreviews] = useState<EbayOfficialPayloadPreview[]>(() => loadEbayOfficialPayloadPreviews());
  const [plans, setPlans] = useState<EbaySandboxOAuthPlanRecord[]>(() => loadEbaySandboxOAuthPlans());
  const [selectedPreviewId, setSelectedPreviewId] = useState(() => previews[0]?.previewId ?? '');
  const selectedPreview = previews.find((preview) => preview.previewId === selectedPreviewId) ?? previews[0];
  const selectedPlan = selectedPreview
    ? plans.find((plan) => plan.sellerAccountId === selectedPreview.sellerAccountIdExecutionContext)
    : undefined;
  const [form, setForm] = useState<FormState>(() => formFromPlan(selectedPlan));
  const [message, setMessage] = useState('');

  const evaluation = useMemo(
    () => evaluateEbaySandboxOAuthPlan(selectedPreview?.sellerAccountIdExecutionContext ?? '', toInput(form)),
    [selectedPreview, form]
  );
  const readiness = useMemo(
    () => evaluateEbaySandboxExecutionReadiness(selectedPreview, selectedPlan),
    [selectedPreview, selectedPlan]
  );

  const reload = () => {
    const nextPreviews = loadEbayOfficialPayloadPreviews();
    const nextPlans = loadEbaySandboxOAuthPlans();
    setPreviews(nextPreviews);
    setPlans(nextPlans);
    setSelectedPreviewId((current) => nextPreviews.some((preview) => preview.previewId === current) ? current : (nextPreviews[0]?.previewId ?? ''));
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT, handler);
    window.addEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(EBAY_OFFICIAL_PAYLOAD_PREVIEW_CHANGED_EVENT, handler);
      window.removeEventListener(EBAY_SANDBOX_OAUTH_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    setForm(formFromPlan(selectedPlan));
    setMessage('');
  }, [selectedPreview?.previewId, selectedPlan?.planId]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    if (!selectedPreview) return;
    const result = recordEbaySandboxOAuthPlan(
      selectedPreview.sellerAccountIdExecutionContext,
      toInput(form),
      plans
    );
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>eBay Sandbox OAuth接続準備</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
        本番ではなくeBay Sandboxへ接続するためのOAuth設定を準備します。Client Secret・認可コード・Access Token・Refresh Tokenはこの画面へ保存しません。
      </p>

      {previews.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>
          eBay正式Payload Previewがありません。先に「eBay 正式Payload Preview」を生成してください。
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>接続対象のPayload Preview</label>
            <select
              style={inputStyle}
              value={selectedPreview?.previewId ?? ''}
              onChange={(event) => setSelectedPreviewId(event.target.value)}
            >
              {previews.map((preview) => (
                <option key={preview.previewId} value={preview.previewId}>
                  {preview.sellerAccountIdExecutionContext} | {preview.sku} | {preview.previewId}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Sandbox Client ID（App ID）</label>
              <input style={inputStyle} value={form.clientId} onChange={(event) => setField('clientId', event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Sandbox OAuth RuName</label>
              <input style={inputStyle} value={form.ruName} onChange={(event) => setField('ruName', event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Sandboxテストユーザー識別名</label>
              <input style={inputStyle} value={form.sandboxUserAlias} onChange={(event) => setField('sandboxUserAlias', event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>バックエンド認証情報参照名</label>
              <input
                style={inputStyle}
                value={form.backendCredentialRef}
                placeholder="例: EBAY_SANDBOX_MAIN"
                onChange={(event) => setField('backendCredentialRef', event.target.value)}
              />
            </div>
            <div>
              <label style={labelStyle}>確認日時</label>
              <input type="datetime-local" style={inputStyle} value={form.checkedAt} onChange={(event) => setField('checkedAt', event.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>確認者</label>
              <input style={inputStyle} value={form.checkedBy} onChange={(event) => setField('checkedBy', event.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>確認メモ</label>
            <textarea
              style={{ ...inputStyle, minHeight: 76 }}
              value={form.verificationNote}
              onChange={(event) => setField('verificationNote', event.target.value)}
              placeholder="eBay Developer ProgramでSandbox Application Keys / RuNameを確認した記録など"
            />
          </div>

          {(evaluation.missingOrInvalidFieldsJa.length > 0 || evaluation.blockingReasonsJa.length > 0) && (
            <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.28)', color: '#fecaca', marginBottom: 10 }}>
              {[...evaluation.missingOrInvalidFieldsJa, ...evaluation.blockingReasonsJa].map((reason) => <div key={reason}>・{reason}</div>)}
            </div>
          )}

          <div style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.62)', color: '#94a3b8', fontSize: 12, lineHeight: 1.65, marginBottom: 12 }}>
            {evaluation.warningsJa.map((warning) => <div key={warning}>・{warning}</div>)}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button type="button" style={buttonStyle} onClick={handleSave} disabled={!evaluation.canSavePlan}>
              Sandbox OAuth接続計画を保存（通信なし）
            </button>
            <button
              type="button"
              style={{ ...buttonStyle, background: 'rgba(30, 41, 59, 0.95)', borderColor: 'rgba(148, 163, 184, 0.35)' }}
              onClick={reload}
            >
              再読込
            </button>
          </div>

          {message && <div aria-live="polite" style={{ color: '#bfdbfe', fontSize: 13, marginBottom: 12 }}>{message}</div>}

          {selectedPlan && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ padding: 12, borderRadius: 9, background: 'rgba(2, 6, 23, 0.62)' }}>
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>保存済みSandbox接続計画</div>
                <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.7, marginTop: 6 }}>
                  Environment: {selectedPlan.environment}<br />
                  Scope: {selectedPlan.requiredScopes.join(', ')}<br />
                  API Base: {selectedPlan.apiBaseUrl}<br />
                  Token Endpoint: {selectedPlan.tokenEndpoint}<br />
                  非破壊確認: {selectedPlan.nonMutatingVerificationEndpoint}<br />
                  Secret Storage: {selectedPlan.secretStorage}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 9, background: readiness.canStartUserConsent ? 'rgba(6, 78, 59, 0.25)' : 'rgba(120, 53, 15, 0.26)' }}>
                <div style={{ color: readiness.canStartUserConsent ? '#a7f3d0' : '#fde68a', fontWeight: 800 }}>
                  {readiness.canStartUserConsent ? 'Sandboxユーザー同意へ進める準備済み' : 'Sandboxユーザー同意はまだBLOCKED'}
                </div>
                <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginTop: 6 }}>
                  {readiness.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
                  {readiness.nextStepsJa.map((step, index) => <div key={step}>{index + 1}. {step}</div>)}
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.55)' }}>
                <div style={{ color: '#f8fafc', fontWeight: 800, marginBottom: 6 }}>Sandbox認可画面URL（自動では開きません）</div>
                <a href={selectedPlan.consentUrl} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', wordBreak: 'break-all', fontSize: 12 }}>
                  {selectedPlan.consentUrl}
                </a>
              </div>
            </div>
          )}
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        OAuth接続の実行は下の「eBay Sandbox バックエンド接続」から行います。認可コード交換とToken保存はバックエンドだけで処理し、通常はSandbox外部通信を禁止した状態です。
      </p>
    </section>
  );
}
