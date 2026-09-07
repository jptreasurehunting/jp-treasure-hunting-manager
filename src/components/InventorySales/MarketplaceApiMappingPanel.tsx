import React, { useEffect, useMemo, useState } from 'react';
import {
  LISTING_ADAPTER_SIMULATION_CHANGED_EVENT,
  ListingPublishAdapterSimulation,
  loadListingPublishAdapterSimulations
} from '../../services/listingPublishAdapterService';
import {
  EBAY_API_MAPPING_PROFILE,
  SHOPEE_API_MAPPING_PROFILE,
  evaluateMarketplaceApiMapping,
  getMarketplaceApiMappingProfile
} from '../../services/marketplaceApiMappingService';

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

function statusLabel(status: string): string {
  return status === 'OFFICIAL_VERIFIED_WITH_REQUIRED_INPUTS'
    ? '公式仕様確認済み・追加入力待ち'
    : '公式Schema確認が必要';
}

export function MarketplaceApiMappingPanel() {
  const [simulations, setSimulations] = useState<ListingPublishAdapterSimulation[]>(() => loadListingPublishAdapterSimulations());
  const [selectedId, setSelectedId] = useState(() => simulations[0]?.simulationId ?? '');

  const selected = simulations.find((simulation) => simulation.simulationId === selectedId) ?? simulations[0];
  const evaluation = useMemo(() => selected ? evaluateMarketplaceApiMapping(selected) : undefined, [selected]);
  const selectedProfile = selected ? getMarketplaceApiMappingProfile(selected.targetChannel) : undefined;

  const reload = () => {
    const next = loadListingPublishAdapterSimulations();
    setSimulations(next);
    setSelectedId((current) => next.some((simulation) => simulation.simulationId === current) ? current : (next[0]?.simulationId ?? ''));
  };

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
    return () => window.removeEventListener(LISTING_ADAPTER_SIMULATION_CHANGED_EVENT, handler);
  }, []);

  return (
    <section style={panelStyle}>
      <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>Marketplace API 対応表</h3>
      <p style={{ margin: '6px 0 14px', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
        内部の公開予定データを、eBay / Shopeeの最新公式API仕様へどう対応させるか確認します。
        この画面は設計確認専用で、認証・通信・出品を行いません。
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginBottom: 14 }}>
        {[EBAY_API_MAPPING_PROFILE, SHOPEE_API_MAPPING_PROFILE].map((profile) => (
          <div key={profile.channel} style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.65)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
              <strong style={{ color: '#f8fafc' }}>{profile.channel}</strong>
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: profile.verificationStatus === 'OFFICIAL_VERIFIED_WITH_REQUIRED_INPUTS' ? '#a7f3d0' : '#fde68a'
              }}>
                {statusLabel(profile.verificationStatus)}
              </span>
            </div>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 6 }}>
              {profile.apiFamily} / {profile.apiVersion} / 確認日 {profile.checkedAt}
            </div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 6 }}>
              sendAllowed=false / networkAction=NONE
            </div>
          </div>
        ))}
      </div>

      {simulations.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>
          公開アダプターのシミュレーションがまだありません。先に「公開アダプター Simulation」を生成してください。
        </p>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', color: '#cbd5e1', fontSize: 12, fontWeight: 700, marginBottom: 5 }}>
              対応を確認するSimulation
            </label>
            <select style={inputStyle} value={selected?.simulationId ?? ''} onChange={(event) => setSelectedId(event.target.value)}>
              {simulations.map((simulation) => (
                <option key={simulation.simulationId} value={simulation.simulationId}>
                  {simulation.targetChannel} | {simulation.targetMarketplace} | {simulation.sku}
                </option>
              ))}
            </select>
          </div>

          {selectedProfile && evaluation && (
            <>
              <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.72)', marginBottom: 12 }}>
                <div style={{ color: '#f8fafc', fontWeight: 800 }}>
                  {selectedProfile.channel} / {statusLabel(selectedProfile.verificationStatus)}
                </div>
                <div style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6, marginTop: 5 }}>
                  {evaluation.canBuildOfficialPayloadAfterRequiredInputs
                    ? '公式仕様への対応関係は確認済みです。下記の追加データを解決してから正式Payload生成へ進みます。'
                    : '公式API Schemaを十分に確認できていないため、正式Payload生成を停止しています。'}
                </div>
              </div>

              {evaluation.blockingReasonsJa.length > 0 && (
                <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.28)', color: '#fecaca', marginBottom: 10 }}>
                  {evaluation.blockingReasonsJa.map((reason) => <div key={reason}>・{reason}</div>)}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
                <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)' }}>
                  <strong style={{ color: '#f8fafc' }}>追加で必要な情報</strong>
                  <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.7, marginTop: 7 }}>
                    {selectedProfile.requiredAdditionalDataJa.map((item) => <div key={item}>・{item}</div>)}
                  </div>
                </div>

                <div style={{ padding: 12, borderRadius: 9, background: 'rgba(30, 41, 59, 0.62)' }}>
                  <strong style={{ color: '#f8fafc' }}>公式確認元</strong>
                  <div style={{ fontSize: 12, lineHeight: 1.8, marginTop: 7 }}>
                    {selectedProfile.officialSources.map((source) => (
                      <div key={source.url}>
                        <a href={source.url} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>{source.label}</a>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedProfile.callPlan.length > 0 && (
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <strong style={{ color: '#f8fafc' }}>API実行予定順（まだ実行しません）</strong>
                  {selectedProfile.callPlan.map((step) => (
                    <div key={step.operationId} style={{ padding: 11, borderRadius: 8, background: 'rgba(30, 41, 59, 0.55)', color: '#cbd5e1', fontSize: 12 }}>
                      <strong style={{ color: '#bfdbfe' }}>{step.order}. {step.operationId}</strong> — {step.method} {step.pathTemplate}<br />
                      {step.purposeJa}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        eBayは公式Inventory API 1.18.5を基準に確認。Shopeeは取得できた公式ページだけでは最新の商品作成Schema本文を十分に検証できないため、推測実装せず停止状態を維持しています。
      </p>
    </section>
  );
}
