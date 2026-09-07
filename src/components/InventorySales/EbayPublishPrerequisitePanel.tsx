import React, { useEffect, useMemo, useState } from 'react';
import {
  LISTING_ADAPTER_SIMULATION_CHANGED_EVENT,
  ListingPublishAdapterSimulation,
  loadListingPublishAdapterSimulations
} from '../../services/listingPublishAdapterService';
import {
  EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT,
  EbayPublishPrerequisiteInput,
  EbayPublishPrerequisiteRecord,
  evaluateEbayPublishPrerequisites,
  evaluateStoredEbayPublishPrerequisites,
  loadEbayPublishPrerequisites,
  recordEbayPublishPrerequisites
} from '../../services/ebayPublishPrerequisiteService';
import {
  EBAY_REST_REQUEST_HEADERS_SOURCE_URL,
  evaluateEbayMarketplaceContentLanguage,
  getSuggestedEbayContentLanguage,
  getSupportedEbayContentLanguages
} from '../../services/ebayMarketplaceLocaleService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)', border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14, padding: 18, marginBottom: 16
};
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', borderRadius: 8,
  border: '1px solid rgba(148, 163, 184, 0.35)', background: 'rgba(30, 41, 59, 0.95)',
  color: '#f8fafc', padding: '9px 10px'
};
const labelStyle: React.CSSProperties = { display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 };
const buttonStyle: React.CSSProperties = {
  borderRadius: 9, border: '1px solid rgba(59, 130, 246, 0.45)', background: 'rgba(30, 64, 175, 0.62)',
  color: '#eff6ff', padding: '9px 13px', cursor: 'pointer', fontWeight: 800
};

interface FormState {
  marketplaceId: string;
  contentLanguage: string;
  contentLanguageReviewed: boolean;
  categoryId: string;
  condition: string;
  aspectsReviewed: boolean;
  aspectsText: string;
  imageUrlsText: string;
  merchantLocationKey: string;
  paymentPolicyId: string;
  fulfillmentPolicyId: string;
  returnPolicyId: string;
  format: string;
  listingDuration: string;
  officialSourcesVerified: boolean;
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

function formFromRecord(record?: EbayPublishPrerequisiteRecord): FormState {
  return {
    marketplaceId: record?.marketplaceId ?? '',
    contentLanguage: record?.contentLanguage ?? '',
    contentLanguageReviewed: record?.contentLanguageReviewed ?? false,
    categoryId: record?.categoryId ?? '',
    condition: record?.condition ?? '',
    aspectsReviewed: record?.aspectsReviewed ?? false,
    aspectsText: record ? JSON.stringify(record.aspects, null, 2) : '{}',
    imageUrlsText: record?.imageUrls.join('\n') ?? '',
    merchantLocationKey: record?.merchantLocationKey ?? '',
    paymentPolicyId: record?.paymentPolicyId ?? '',
    fulfillmentPolicyId: record?.fulfillmentPolicyId ?? '',
    returnPolicyId: record?.returnPolicyId ?? '',
    format: record?.format ?? '',
    listingDuration: record?.listingDuration ?? '',
    officialSourcesVerified: record?.officialSourcesVerified ?? false,
    checkedAt: toLocalDateTimeInput(record?.checkedAt),
    checkedBy: record?.checkedBy ?? '',
    verificationNote: record?.verificationNote ?? ''
  };
}

function parseAspects(text: string): { value: Record<string, string[]>; error?: string } {
  try {
    const parsed = JSON.parse(text || '{}');
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return { value: {}, error: 'Item SpecificsはJSONオブジェクト形式で入力してください。' };
    const value: Record<string, string[]> = {};
    for (const [key, raw] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(raw) || raw.some((entry) => typeof entry !== 'string')) return { value: {}, error: `Item Specifics「${key}」は文字列配列で入力してください。` };
      value[key] = raw as string[];
    }
    return { value };
  } catch {
    return { value: {}, error: 'Item SpecificsのJSON形式が不正です。' };
  }
}

function buildInput(form: FormState, aspects: Record<string, string[]>): EbayPublishPrerequisiteInput {
  return {
    marketplaceId: form.marketplaceId,
    contentLanguage: form.contentLanguage,
    contentLanguageReviewed: form.contentLanguageReviewed,
    categoryId: form.categoryId,
    condition: form.condition,
    aspectsReviewed: form.aspectsReviewed,
    aspects,
    imageUrls: form.imageUrlsText.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    merchantLocationKey: form.merchantLocationKey,
    paymentPolicyId: form.paymentPolicyId,
    fulfillmentPolicyId: form.fulfillmentPolicyId,
    returnPolicyId: form.returnPolicyId,
    format: form.format,
    listingDuration: form.listingDuration,
    officialSourcesVerified: form.officialSourcesVerified,
    checkedAt: form.checkedAt,
    checkedBy: form.checkedBy,
    verificationNote: form.verificationNote
  };
}

export function EbayPublishPrerequisitePanel() {
  const [simulations, setSimulations] = useState<ListingPublishAdapterSimulation[]>(() => loadListingPublishAdapterSimulations().filter((simulation) => simulation.targetChannel === 'eBay'));
  const [records, setRecords] = useState<EbayPublishPrerequisiteRecord[]>(() => loadEbayPublishPrerequisites());
  const [selectedSimulationId, setSelectedSimulationId] = useState(() => simulations[0]?.simulationId ?? '');
  const selectedSimulation = simulations.find((simulation) => simulation.simulationId === selectedSimulationId) ?? simulations[0];
  const selectedRecord = records.find((record) => record.draftId === selectedSimulation?.draftId);
  const [form, setForm] = useState<FormState>(() => formFromRecord(selectedRecord));
  const [message, setMessage] = useState('');

  const parsedAspects = useMemo(() => parseAspects(form.aspectsText), [form.aspectsText]);
  const localeEvaluation = useMemo(() => evaluateEbayMarketplaceContentLanguage(form.marketplaceId, form.contentLanguage), [form.marketplaceId, form.contentLanguage]);
  const supportedLocales = useMemo(() => getSupportedEbayContentLanguages(form.marketplaceId), [form.marketplaceId]);
  const input = useMemo(() => buildInput(form, parsedAspects.value), [form, parsedAspects.value]);
  const evaluation = selectedSimulation ? evaluateEbayPublishPrerequisites(selectedSimulation, input) : undefined;
  const storedValidity = selectedRecord ? evaluateStoredEbayPublishPrerequisites(selectedRecord, selectedSimulation) : undefined;

  const reload = () => {
    const nextSimulations = loadListingPublishAdapterSimulations().filter((simulation) => simulation.targetChannel === 'eBay');
    const nextRecords = loadEbayPublishPrerequisites();
    setSimulations(nextSimulations);
    setRecords(nextRecords);
    setSelectedSimulationId((current) => nextSimulations.some((simulation) => simulation.simulationId === current) ? current : (nextSimulations[0]?.simulationId ?? ''));
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
    window.addEventListener(EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT, handler);
    return () => {
      window.removeEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
      window.removeEventListener(EBAY_PUBLISH_PREREQUISITES_CHANGED_EVENT, handler);
    };
  }, []);

  useEffect(() => {
    const record = records.find((candidate) => candidate.draftId === selectedSimulation?.draftId);
    setForm(formFromRecord(record));
    setMessage('');
  }, [selectedSimulation?.simulationId, selectedRecord?.savedAt]);

  useEffect(() => {
    const suggested = getSuggestedEbayContentLanguage(form.marketplaceId);
    if (suggested && !form.contentLanguage) setForm((current) => ({ ...current, contentLanguage: suggested }));
  }, [form.marketplaceId, form.contentLanguage]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const handleMarketplaceChange = (value: string) => {
    const suggested = getSuggestedEbayContentLanguage(value);
    setForm((current) => ({ ...current, marketplaceId: value, contentLanguage: suggested ?? '', contentLanguageReviewed: false }));
  };

  const handleSave = () => {
    if (!selectedSimulation) return;
    if (parsedAspects.error) return setMessage(parsedAspects.error);
    const result = recordEbayPublishPrerequisites(selectedSimulation, input, records);
    setMessage(result.messageJa);
    if (result.success) reload();
  };

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>eBay 公開前提条件</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
        eBay公開に必要なカテゴリ・状態・画像・Business Policy・Inventory Location・Content-Languageを確認して保存します。値は推測せず、公式情報または対象アカウントで確認します。この画面からAPI通信は行いません。
      </p>

      {simulations.length === 0 ? <p style={{ color: '#64748b', margin: 0 }}>eBayの公開アダプターSimulationがありません。</p> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(190px, 260px)', gap: 12, marginBottom: 14 }}>
          <div><label style={labelStyle}>対象eBay Simulation</label><select style={inputStyle} value={selectedSimulation?.simulationId ?? ''} onChange={(e) => setSelectedSimulationId(e.target.value)}>{simulations.map((simulation) => <option key={simulation.simulationId} value={simulation.simulationId}>{simulation.targetMarketplace} | {simulation.sku} | {simulation.sellerAccountId}</option>)}</select></div>
          <div><span style={labelStyle}>前提条件状態</span><div style={{ padding: '9px 10px', borderRadius: 8, background: storedValidity?.valid ? 'rgba(21, 128, 61, 0.38)' : 'rgba(120, 53, 15, 0.35)', color: storedValidity?.valid ? '#bbf7d0' : '#fde68a', fontWeight: 800 }}>{storedValidity?.valid ? '確認済み' : selectedRecord ? '再確認が必要' : '未確認'}</div></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
          <div><label style={labelStyle}>eBay MarketplaceId</label><input style={inputStyle} value={form.marketplaceId} onChange={(e) => handleMarketplaceChange(e.target.value)} placeholder="例: EBAY_US" /></div>
          <div>
            <label style={labelStyle}>Content-Language</label>
            {supportedLocales.length > 0 ? <select style={inputStyle} value={form.contentLanguage} onChange={(e) => update('contentLanguage', e.target.value)}><option value="">選択してください</option>{supportedLocales.map((locale) => <option key={locale} value={locale}>{locale}</option>)}</select> : <input style={inputStyle} value={form.contentLanguage} onChange={(e) => update('contentLanguage', e.target.value)} placeholder="公式Locale確認待ち" />}
            <div style={{ color: localeEvaluation.contentLanguageSupported ? '#a7f3d0' : '#fde68a', fontSize: 11, marginTop: 4 }}>{supportedLocales.length > 0 ? `公式対応: ${supportedLocales.join(', ')}` : 'MarketplaceIdの公式Locale対応を確認してください。'}</div>
          </div>
          <div><label style={labelStyle}>カテゴリID</label><input style={inputStyle} value={form.categoryId} onChange={(e) => update('categoryId', e.target.value)} /></div>
          <div><label style={labelStyle}>Condition</label><input style={inputStyle} value={form.condition} onChange={(e) => update('condition', e.target.value)} /></div>
          <div><label style={labelStyle}>merchantLocationKey</label><input style={inputStyle} value={form.merchantLocationKey} onChange={(e) => update('merchantLocationKey', e.target.value)} /></div>
          <div><label style={labelStyle}>Payment Policy ID</label><input style={inputStyle} value={form.paymentPolicyId} onChange={(e) => update('paymentPolicyId', e.target.value)} /></div>
          <div><label style={labelStyle}>Fulfillment Policy ID</label><input style={inputStyle} value={form.fulfillmentPolicyId} onChange={(e) => update('fulfillmentPolicyId', e.target.value)} /></div>
          <div><label style={labelStyle}>Return Policy ID</label><input style={inputStyle} value={form.returnPolicyId} onChange={(e) => update('returnPolicyId', e.target.value)} /></div>
          <div><label style={labelStyle}>format</label><input style={inputStyle} value={form.format} onChange={(e) => update('format', e.target.value)} /></div>
          <div><label style={labelStyle}>listingDuration</label><input style={inputStyle} value={form.listingDuration} onChange={(e) => update('listingDuration', e.target.value)} /></div>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
          <div><label style={labelStyle}>商品画像URL（1行1URL）</label><textarea style={{ ...inputStyle, minHeight: 115 }} value={form.imageUrlsText} onChange={(e) => update('imageUrlsText', e.target.value)} /></div>
          <div><label style={labelStyle}>Item Specifics / aspects（JSON）</label><textarea style={{ ...inputStyle, minHeight: 115, fontFamily: 'monospace' }} value={form.aspectsText} onChange={(e) => update('aspectsText', e.target.value)} />{parsedAspects.error && <div style={{ color: '#fecaca', fontSize: 12, marginTop: 5 }}>{parsedAspects.error}</div>}</div>
        </div>

        <div style={{ marginTop: 12, padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)', display: 'grid', gap: 8 }}>
          <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', gap: 8 }}><input type="checkbox" checked={form.contentLanguageReviewed} onChange={(e) => update('contentLanguageReviewed', e.target.checked)} />MarketplaceIdとContent-Languageの公式対応を確認した</label>
          <div style={{ color: '#94a3b8', fontSize: 11, wordBreak: 'break-all' }}>{EBAY_REST_REQUEST_HEADERS_SOURCE_URL}</div>
          <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', gap: 8 }}><input type="checkbox" checked={form.aspectsReviewed} onChange={(e) => update('aspectsReviewed', e.target.checked)} />対象カテゴリのItem Specifics / aspects要件を確認した</label>
          <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', gap: 8 }}><input type="checkbox" checked={form.officialSourcesVerified} onChange={(e) => update('officialSourcesVerified', e.target.checked)} />MarketplaceId・カテゴリ・Condition・Policy・Location等を公式情報または対象アカウントで確認した</label>
        </div>

        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'minmax(200px, .4fr) minmax(200px, .4fr) minmax(300px, 1fr)', gap: 8 }}>
          <input style={inputStyle} type="datetime-local" value={form.checkedAt} onChange={(e) => update('checkedAt', e.target.value)} />
          <input style={inputStyle} value={form.checkedBy} onChange={(e) => update('checkedBy', e.target.value)} placeholder="確認者ID" />
          <input style={inputStyle} value={form.verificationNote} onChange={(e) => update('verificationNote', e.target.value)} placeholder="確認元・確認内容・特記事項" />
        </div>

        {evaluation && <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
          {evaluation.missingOrInvalidFieldsJa.length > 0 && <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127,29,29,.25)', color: '#fecaca', fontSize: 12 }}>{evaluation.missingOrInvalidFieldsJa.map((item) => <div key={item}>・{item}</div>)}</div>}
          {evaluation.blockingReasonsJa.length > 0 && <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127,29,29,.25)', color: '#fecaca', fontSize: 12 }}>{evaluation.blockingReasonsJa.map((item) => <div key={item}>・{item}</div>)}</div>}
          <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120,53,15,.22)', color: '#fde68a', fontSize: 12 }}>{evaluation.warningsJa.map((item) => <div key={item}>・{item}</div>)}</div>
        </div>}

        <div style={{ marginTop: 12 }}><button type="button" style={{ ...buttonStyle, opacity: evaluation?.canSaveVerifiedPrerequisites ? 1 : .45 }} disabled={!evaluation?.canSaveVerifiedPrerequisites} onClick={handleSave}>eBay公開前提条件を確認済みとして保存</button></div>
        {storedValidity && !storedValidity.valid && <div style={{ marginTop: 10, color: '#fde68a', fontSize: 12 }}>{storedValidity.reasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}</div>}
        {message && <div aria-live="polite" style={{ marginTop: 10, color: '#bfdbfe', fontSize: 13 }}>{message}</div>}
      </>}
    </section>
  );
}
