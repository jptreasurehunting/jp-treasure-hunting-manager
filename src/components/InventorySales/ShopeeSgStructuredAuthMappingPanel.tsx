import React, { useEffect, useMemo, useState } from 'react';
import {
  getLatestShopeeSgAuthSchemaVerification,
  isShopeeSgAuthSchemaVerificationFresh,
  SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT
} from '../../services/shopeeSgAuthSchemaVerificationService';
import {
  evaluateShopeeSgStructuredAuthMapping,
  getLatestShopeeSgStructuredAuthMapping,
  isShopeeSgStructuredAuthMappingFresh,
  recordShopeeSgStructuredAuthMapping,
  SHOPEE_SG_AUTHORIZATION_QUERY_ROLES,
  SHOPEE_SG_SIGNATURE_COMPONENTS,
  ShopeeSgAuthorizationHttpMethod,
  ShopeeSgAuthorizationQueryRole,
  ShopeeSgSignatureComponent,
  ShopeeSgStructuredAuthMappingInput
} from '../../services/shopeeSgStructuredAuthMappingService';

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

type FormState = {
  authorizationHttpMethod: '' | ShopeeSgAuthorizationHttpMethod;
  partnerIdField: string;
  timestampField: string;
  signatureField: string;
  redirectUriField: string;
  authorizationQueryOrderText: string;
  signatureAlgorithm: string;
  signatureBaseComponentsText: string;
  callbackAuthorizationCodeField: string;
  callbackShopIdField: string;
  checkedBy: string;
  checkedAt: string;
  verificationNote: string;
  officialDocumentationConfirmed: boolean;
  currentSingaporeApplicabilityConfirmed: boolean;
};

function parseSignatureComponents(text: string): ShopeeSgSignatureComponent[] {
  return text
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean) as ShopeeSgSignatureComponent[];
}

function parseQueryRoles(text: string): ShopeeSgAuthorizationQueryRole[] {
  return text
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean) as ShopeeSgAuthorizationQueryRole[];
}

function makeInput(form: FormState, authSchema: ReturnType<typeof getLatestShopeeSgAuthSchemaVerification>): ShopeeSgStructuredAuthMappingInput {
  return {
    authSchemaVerificationId: authSchema?.verificationId || '',
    officialSourceUrl: authSchema?.officialSourceUrl || '',
    authorizationEndpoint: authSchema?.authorizationEndpoint || '',
    authorizationHttpMethod: form.authorizationHttpMethod as ShopeeSgAuthorizationHttpMethod,
    authorizationQueryFieldNames: {
      partnerId: form.partnerIdField,
      timestamp: form.timestampField,
      signature: form.signatureField,
      redirectUri: form.redirectUriField
    },
    authorizationQueryOrder: parseQueryRoles(form.authorizationQueryOrderText),
    signatureAlgorithm: form.signatureAlgorithm,
    signatureBaseComponents: parseSignatureComponents(form.signatureBaseComponentsText),
    callbackFieldNames: {
      authorizationCode: form.callbackAuthorizationCodeField,
      shopId: form.callbackShopIdField
    },
    checkedBy: form.checkedBy,
    checkedAt: form.checkedAt,
    verificationNote: form.verificationNote,
    officialDocumentationConfirmed: form.officialDocumentationConfirmed,
    currentSingaporeApplicabilityConfirmed: form.currentSingaporeApplicabilityConfirmed
  };
}

export function ShopeeSgStructuredAuthMappingPanel() {
  const [authSchemaRevision, setAuthSchemaRevision] = useState(0);
  const [mappingRevision, setMappingRevision] = useState(0);
  const authSchema = useMemo(() => getLatestShopeeSgAuthSchemaVerification(), [authSchemaRevision]);
  const authSchemaFresh = authSchema ? isShopeeSgAuthSchemaVerificationFresh(authSchema) : false;
  const latestMapping = useMemo(
    () => authSchema ? getLatestShopeeSgStructuredAuthMapping(authSchema.verificationId) : undefined,
    [authSchema, mappingRevision]
  );
  const mappingFresh = latestMapping && authSchema
    ? isShopeeSgStructuredAuthMappingFresh(latestMapping, authSchema)
    : false;

  const [form, setForm] = useState<FormState>(() => ({
    authorizationHttpMethod: '',
    partnerIdField: '',
    timestampField: '',
    signatureField: '',
    redirectUriField: '',
    authorizationQueryOrderText: '',
    signatureAlgorithm: '',
    signatureBaseComponentsText: '',
    callbackAuthorizationCodeField: '',
    callbackShopIdField: '',
    checkedBy: '',
    checkedAt: nowLocal(),
    verificationNote: '',
    officialDocumentationConfirmed: false,
    currentSingaporeApplicabilityConfirmed: false
  }));
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handler = () => setAuthSchemaRevision((value) => value + 1);
    window.addEventListener(SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SHOPEE_SG_AUTH_SCHEMA_VERIFICATION_CHANGED_EVENT, handler);
  }, []);

  useEffect(() => {
    if (!authSchema) return;
    setForm((current) => ({
      ...current,
      signatureAlgorithm: current.signatureAlgorithm || authSchema.signatureAlgorithm
    }));
  }, [authSchema?.verificationId]);

  const serviceInput = useMemo(() => makeInput(form, authSchema), [form, authSchema]);
  const evaluation = useMemo(
    () => evaluateShopeeSgStructuredAuthMapping(serviceInput, authSchema),
    [serviceInput, authSchema]
  );

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = () => {
    const result = recordShopeeSgStructuredAuthMapping(serviceInput, authSchema);
    setMessage(result.success ? `✅ ${result.messageJa}` : `❌ ${result.messageJa} ${result.blockingReasons.join(' / ')}`);
    if (result.success) setMappingRevision((value) => value + 1);
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Shopee SG Structured Auth Mapping</h3>
      <p style={{ margin: '6px 0 12px', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
        前段の認証Schema確認で保存した文章を、そのままプログラムが解釈することはしません。公式本文で確認したwire項目名、Query順序、HTTP Method、署名base stringのcomponent順、Callback項目名だけを構造化して固定します。
      </p>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(120,53,15,.25)', color: '#fde68a', fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <strong>秘密値は入力禁止です。</strong> Partner IDの実値、Partner Key、Access Token、Refresh Token、Authorization Codeはここへ保存しません。項目名と意味だけを記録します。
      </div>

      <div style={{ padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.6)', color: '#cbd5e1', fontSize: 12, marginBottom: 12, lineHeight: 1.7 }}>
        <div>認証Schema: <strong style={{ color: authSchema && authSchemaFresh ? '#86efac' : '#fde68a' }}>{authSchema ? (authSchemaFresh ? '確認済み・90日以内' : '再確認必要') : '確認記録なし'}</strong></div>
        {authSchema && <div>verificationId: <code>{authSchema.verificationId}</code></div>}
        {authSchema && <div>Endpoint: <code>{authSchema.authorizationEndpoint}</code></div>}
        {latestMapping && <div>最新Structured Mapping: <strong style={{ color: mappingFresh ? '#86efac' : '#fde68a' }}>{mappingFresh ? '有効' : '再確認必要'}</strong> / <code>{latestMapping.mappingId}</code></div>}
      </div>

      {!authSchemaFresh && (
        <div style={{ color: '#fecaca', fontSize: 12, marginBottom: 12 }}>
          先に現在のSingapore向け「認証・署名Schema確認」を完了してください。古い・未確認のSchemaからStructured Mappingは作成しません。
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Authorization HTTP Method
          <select style={{ ...inputStyle, marginTop: 5 }} value={form.authorizationHttpMethod} onChange={(e) => update('authorizationHttpMethod', e.target.value as FormState['authorizationHttpMethod'])}>
            <option value="">公式本文から選択</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
          </select>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Partner ID query field
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.partnerIdField} onChange={(e) => update('partnerIdField', e.target.value)} placeholder="wire項目名のみ" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Timestamp query field
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.timestampField} onChange={(e) => update('timestampField', e.target.value)} placeholder="wire項目名のみ" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Signature query field
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.signatureField} onChange={(e) => update('signatureField', e.target.value)} placeholder="wire項目名のみ" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Redirect URI query field
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.redirectUriField} onChange={(e) => update('redirectUriField', e.target.value)} placeholder="wire項目名のみ" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Callback authorization-code field
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.callbackAuthorizationCodeField} onChange={(e) => update('callbackAuthorizationCodeField', e.target.value)} placeholder="wire項目名のみ" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>Callback shop-ID field
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.callbackShopIdField} onChange={(e) => update('callbackShopIdField', e.target.value)} placeholder="wire項目名のみ" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>署名アルゴリズム
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.signatureAlgorithm} onChange={(e) => update('signatureAlgorithm', e.target.value)} placeholder="認証Schema確認済み表記を使用" />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認者
          <input style={{ ...inputStyle, marginTop: 5 }} value={form.checkedBy} onChange={(e) => update('checkedBy', e.target.value)} />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>確認日時
          <input type="datetime-local" style={{ ...inputStyle, marginTop: 5 }} value={form.checkedAt} onChange={(e) => update('checkedAt', e.target.value)} />
        </label>
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>Authorization Query順序（役割名をカンマ区切り）
        <input style={{ ...inputStyle, marginTop: 5 }} value={form.authorizationQueryOrderText} onChange={(e) => update('authorizationQueryOrderText', e.target.value)} placeholder="公式本文で確認した順序だけを入力" />
      </label>
      <div style={{ color: '#64748b', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
        4役割を各1回: {SHOPEE_SG_AUTHORIZATION_QUERY_ROLES.join(', ')}。画面側で既定順序を決めず、確認した順序を明示的に記録します。
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>署名base string component順（カンマ区切り）
        <input style={{ ...inputStyle, marginTop: 5 }} value={form.signatureBaseComponentsText} onChange={(e) => update('signatureBaseComponentsText', e.target.value)} placeholder="公式本文で確認した順序だけを入力" />
      </label>
      <div style={{ color: '#64748b', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
        対応component: {SHOPEE_SG_SIGNATURE_COMPONENTS.join(', ')}。対応外のcomponentが公式仕様に必要なら、推測してOTHER扱いにせずコード側を更新してから記録します。
      </div>

      <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, marginTop: 10 }}>確認メモ
        <textarea style={{ ...inputStyle, marginTop: 5, minHeight: 72 }} value={form.verificationNote} onChange={(e) => update('verificationNote', e.target.value)} placeholder="確認した公式箇所・差分など。秘密値は書かない" />
      </label>

      <label style={{ display: 'block', marginTop: 10, color: '#e2e8f0', fontSize: 13 }}>
        <input type="checkbox" checked={form.officialDocumentationConfirmed} onChange={(e) => update('officialDocumentationConfirmed', e.target.checked)} />{' '}
        Shopee公式Open Platform本文でwire項目名・順序を直接確認した
      </label>
      <label style={{ display: 'block', marginTop: 8, color: '#e2e8f0', fontSize: 13 }}>
        <input type="checkbox" checked={form.currentSingaporeApplicabilityConfirmed} onChange={(e) => update('currentSingaporeApplicabilityConfirmed', e.target.checked)} />{' '}
        現在のSingapore向け認証仕様として適用できることを確認した
      </label>

      {evaluation.blockingReasons.length > 0 && (
        <div style={{ marginTop: 10, color: '#fecaca', fontSize: 12, lineHeight: 1.6 }}>{evaluation.blockingReasons.join(' / ')}</div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={!evaluation.canRecord}
        style={{ marginTop: 12, borderRadius: 8, padding: '8px 11px', border: '1px solid rgba(45,212,191,.5)', background: evaluation.canRecord ? 'rgba(13,148,136,.65)' : 'rgba(51,65,85,.65)', color: '#f8fafc', fontWeight: 700, cursor: evaluation.canRecord ? 'pointer' : 'not-allowed' }}
      >
        Structured Auth Mappingを記録
      </button>
      {message && <div style={{ marginTop: 10, color: '#cbd5e1', fontSize: 12 }}>{message}</div>}
    </section>
  );
}
