import React, { useState, useEffect, useMemo } from 'react';
import {
  SourceProviderAdapter,
  ShippingDocumentFreshness,
  FreshnessDashboardMetrics,
  FreshnessAuditTrailEntry,
  PreActionFreshnessReport
} from '../../types/ruleFreshness';
import {
  loadSourceProviders,
  loadShippingDocumentFreshness,
  getFreshnessDashboardMetrics,
  loadFreshnessAuditTrail,
  checkLiveSourceFreshness,
  preActionFreshnessVerification,
  refreshTargetedRuleFreshness,
  initRuleFreshnessHealthModule
} from '../../services/ruleFreshnessService';

interface RuleFreshnessCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const RuleFreshnessCard: React.FC<RuleFreshnessCardProps> = ({ onAddAuditLog }) => {
  const [providers, setProviders] = useState<SourceProviderAdapter[]>(loadSourceProviders());
  const [docs, setDocs] = useState<ShippingDocumentFreshness[]>(loadShippingDocumentFreshness());
  const [metrics, setMetrics] = useState<FreshnessDashboardMetrics>(getFreshnessDashboardMetrics());
  const [auditLogs, setAuditLogs] = useState<FreshnessAuditTrailEntry[]>(loadFreshnessAuditTrail());
  const [activeTab, setActiveTab] = useState<'overview' | 'providers' | 'gate' | 'documents' | 'audit'>('overview');
  const [testAction, setTestAction] = useState('shipping_label_purchase');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    initRuleFreshnessHealthModule();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const gateReport: PreActionFreshnessReport = useMemo(() => {
    return preActionFreshnessVerification(testAction);
  }, [testAction, providers, docs]);

  const handleRunLiveCheck = (providerId: string, name: string) => {
    const res = checkLiveSourceFreshness(providerId);
    showToast(`📡 [${name}] のライブ検証を実行: ${res.verificationBadge}`);
    if (onAddAuditLog) {
      onAddAuditLog(`RuleFreshness: Live check on ${providerId}`, undefined, res.sourceVersionHash);
    }
  };

  const handleTargetedRefresh = (target: string) => {
    const res = refreshTargetedRuleFreshness(target);
    setMetrics(getFreshnessDashboardMetrics());
    setAuditLogs(loadFreshnessAuditTrail());
    showToast(`🔄 [${target}] の鮮度再検証を完了 (${res.refreshedCount} 件更新)`);
    if (onAddAuditLog) {
      onAddAuditLog(`RuleFreshness: Targeted refresh on ${target}`, undefined, `${res.refreshedCount} rules`);
    }
  };

  return (
    <div className="rule-freshness-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>📡</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🌱</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Rule Freshness &amp; Live Source Verification (ルール鮮度 ＆ ライブ検証基盤)
            </h3>
            <p className="text-[11px] text-slate-400">
              公式API・約款PDF・法規の有効期間を個別管理し、失効した旧ルールのサイレント適用を100%遮断します。
            </p>
          </div>
        </div>

        {/* Dashboard Pills (Spec #12) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 shadow">
            🟢 最新確認済み: {metrics.currentRulesCount}件
          </span>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
            ⚡ ライブ検証: {metrics.liveVerifiedCount}系統
          </span>
          <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950 px-2.5 py-1 rounded border border-purple-800">
            📡 プロバイダ: {metrics.sourceProvidersActive}系統
          </span>
          <span className="text-xs font-mono font-bold text-rose-300 bg-rose-950 px-2.5 py-1 rounded border border-rose-800">
            🛡️ 失効遮断: {metrics.staleShipmentInterceptions}件
          </span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'overview' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          🌐 ルール鮮度の全体概要
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'gate' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('gate')}
        >
          🚦 重要アクション事前鮮度ゲート
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'providers' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('providers')}
        >
          📡 公式ソースプロバイダ一覧 ({providers.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'documents' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('documents')}
        >
          📑 必須書類テンプレート版数 ({docs.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'audit' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('audit')}
        >
          📜 鮮度監査ログ ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: ルール鮮度の全体概要 (Spec #1, #2) */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>🌱</span>
              <span>4段階のルール鮮度ステータス ＆ 揮発性に応じた個別有効期間</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-emerald-900/60 space-y-1">
                <div className="text-emerald-300 font-bold flex items-center gap-1">
                  <span>🟢</span>
                  <span>最新確認済み (Current)</span>
                </div>
                <p className="text-[11px] text-slate-300">有効期間内かつ公式ソースと完全一致。自動実行を安全に許可。</p>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-lg border border-amber-900/60 space-y-1">
                <div className="text-amber-300 font-bold flex items-center gap-1">
                  <span>🟡</span>
                  <span>再確認推奨 (Recommended)</span>
                </div>
                <p className="text-[11px] text-slate-300">非重要ルールの期限超過。注意勧告付きで継続利用可能。</p>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-lg border border-orange-900/60 space-y-1">
                <div className="text-orange-300 font-bold flex items-center gap-1">
                  <span>🟠</span>
                  <span>再確認が必要 (Required)</span>
                </div>
                <p className="text-[11px] text-slate-300">重要規約の鮮度切れ。自動処理を一時停止し人間確認を要求。</p>
              </div>

              <div className="p-2.5 bg-slate-900 rounded-lg border border-rose-900/60 space-y-1">
                <div className="text-rose-300 font-bold flex items-center gap-1">
                  <span>🔴</span>
                  <span>旧ルール使用停止 (Invalid)</span>
                </div>
                <p className="text-[11px] text-slate-300">公式ソース改定・失効。使用を完全禁止し最新版へ更新。</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 重要アクション事前鮮度ゲート (Spec #6 & #7) */}
      {activeTab === 'gate' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
                <span>🚦</span>
                <span>Pre-Action Freshness Verification Gate</span>
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold">テスト対象アクション:</span>
                <select
                  className="p-1.5 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs"
                  value={testAction}
                  onChange={(e) => setTestAction(e.target.value)}
                >
                  <option value="shipping_label_purchase">送り状ラベル発行 (Label Purchase)</option>
                  <option value="listing_publication">eBay出品公開 (Listing Publication)</option>
                  <option value="zonos_declaration">Zonos税関申告確定 (Zonos Prepay)</option>
                  <option value="shipment_readiness">出荷準備完了 (Shipment Readiness)</option>
                </select>
              </div>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-slate-100">事前判定ゲート結果:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded font-mono ${
                    gateReport.canProceed
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}
                >
                  {gateReport.canProceed ? '🟢 業務実行可能 (All Critical Rules Fresh)' : '⛔ 処理停止 (Stale Rule Blocked)'}
                </span>
              </div>

              <p className="text-slate-300 text-xs">
                重要規約 {gateReport.criticalRulesChecked} 件を事前検証。最新確認済み: {gateReport.freshRulesCount} 件 / 要再確認: {gateReport.staleRulesCount} 件
              </p>

              {gateReport.safeAlternativeJa && (
                <div className="p-2 bg-slate-950 rounded border border-rose-800/80 text-rose-200 text-xs font-bold">
                  ⚠️ 安全フォールバック: {gateReport.safeAlternativeJa}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 公式ソースプロバイダ一覧 (Spec #3, #8) */}
      {activeTab === 'providers' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>📡</span>
              <span>公式ソースプロバイダ・アダプター一覧</span>
            </h4>
            <span className="text-xs text-slate-400">公式API ＆ 構造化ドキュメントを個別周期で同期</span>
          </div>

          <div className="space-y-2.5">
            {providers.map((p) => (
              <div key={p.providerId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-xs">{p.providerName}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                      {p.carrierOrPlatform} ({p.providerType})
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    バージョンハッシュ: <span className="text-cyan-300">{p.currentVersionHash}</span> | 更新周期: {p.recheckIntervalDays}日 | 揮発性: {p.volatility}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {p.liveStatus}
                  </span>
                  <button
                    type="button"
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded font-bold text-[10px]"
                    onClick={() => handleRunLiveCheck(p.providerId, p.providerName)}
                  >
                    今すぐライブ検証
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: 必須書類テンプレート版数管理 (Spec #9) */}
      {activeTab === 'documents' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>📑</span>
              <span>必須配送書類テンプレート・バージョン管理</span>
            </h4>
            <span className="text-xs text-slate-400">公式改定に連動し旧版テンプレートを自動引退</span>
          </div>

          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.documentId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-xs">{doc.documentNameJa}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800">
                      {doc.currentTemplateVersion}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    キャリア: {doc.carrier} | 対象: {doc.targetCategory} | 最終確認: {doc.lastVerifiedDate}
                  </div>
                </div>

                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {doc.isTemplateCurrent ? '最新版テンプレート' : '旧版（引退済み）'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: 鮮度監査ログ (Spec #16) */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>📜</span>
              <span>鮮度監査ログ (Freshness Audit Trail)</span>
            </h4>
            <span className="text-xs text-slate-400">公式ソース改定・ハッシュ同期の完全記録</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3 text-[11px]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold">[{log.providerName}]</span>
                    <span className="text-slate-200">{log.actionTakenJa}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ハッシュ: {log.newVersionHash} | 影響モジュール: {log.impactedModules.join(', ')} | 時刻: {log.timestamp.split('T')[1].substring(0, 8)}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    log.changeDetected
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-slate-900 text-slate-300 border border-slate-800'
                  }`}
                >
                  {log.changeDetected ? '改定検知' : '正常検証'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
