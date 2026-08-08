import React, { useState, useEffect, useMemo } from 'react';
import {
  KnowledgeQueryRequest,
  KnowledgeQueryResponse,
  RevalidationPriorityItem,
  OrchestratorEfficiencyStats,
  OrchestratorAuditLogEntry
} from '../../types/knowledgeOrchestrator';
import {
  orchestrateKnowledgeQuery,
  getRevalidationPriorityQueue,
  loadOrchestratorEfficiencyStats,
  loadOrchestratorAuditTrail,
  initKnowledgeOrchestratorHealthModule,
  getRegisteredConsumerModules,
  propagateKnowledgeInvalidation
} from '../../services/knowledgeOrchestratorService';
import { loadOperationalKnowledge } from '../../services/operationalKnowledgeService';

interface KnowledgeOrchestratorCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const KnowledgeOrchestratorCard: React.FC<KnowledgeOrchestratorCardProps> = ({ onAddAuditLog }) => {
  const [stats, setStats] = useState<OrchestratorEfficiencyStats>(loadOrchestratorEfficiencyStats());
  const [auditLogs, setAuditLogs] = useState<OrchestratorAuditLogEntry[]>(loadOrchestratorAuditTrail());
  const [priorityQueue, setPriorityQueue] = useState<RevalidationPriorityItem[]>(getRevalidationPriorityQueue());
  const [consumerModules] = useState<string[]>(getRegisteredConsumerModules());
  const [activeTab, setActiveTab] = useState<'overview' | 'simulator' | 'provenance' | 'priority_queue' | 'audit'>('overview');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Simulator Interactive Form State
  const [simModule, setSimModule] = useState('ai_shipping_advisor');
  const [simDomain, setSimDomain] = useState('shipping');
  const [simCarrier, setSimCarrier] = useState('FedEx');
  const [simCountry, setSimCountry] = useState('US');
  const [simCategory, setSimCategory] = useState('Watches');
  const [simUsage, setSimUsage] = useState('shipping_decision');
  const [simAssetId, setSimAssetId] = useState('img_camera_nikon_f3_01');
  const [showProvenanceDetails, setShowProvenanceDetails] = useState(false);

  useEffect(() => {
    initKnowledgeOrchestratorHealthModule();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const simResponse: KnowledgeQueryResponse = useMemo(() => {
    const req: KnowledgeQueryRequest = {
      requestingModuleId: simModule,
      domain: simDomain,
      carrier: simCarrier,
      country: simCountry,
      productCategory: simCategory,
      proposedUse: simUsage,
      assetId: simUsage === 'ad_marketing' ? simAssetId : undefined,
      blockingSensitivity: 'high'
    };
    return orchestrateKnowledgeQuery(req);
  }, [simModule, simDomain, simCarrier, simCountry, simCategory, simUsage, simAssetId]);

  const handleTriggerInvalidation = (knowledgeId: string, topic: string) => {
    const evt = propagateKnowledgeInvalidation(knowledgeId, 'オペレーターによる手動再検証要求', 'SUPERSEDED');
    setPriorityQueue(getRevalidationPriorityQueue());
    setAuditLogs(loadOrchestratorAuditTrail());
    showToast(`🚨 ナレッジ無効化イベントを発行: [${topic}] -> 影響モジュールへ通知`);
    if (onAddAuditLog) {
      onAddAuditLog(`KnowledgeOrchestrator: Invalidated ${knowledgeId}`, undefined, evt.eventId);
    }
  };

  return (
    <div className="knowledge-orchestrator-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-purple-500 text-purple-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>🧠</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Knowledge Orchestrator (統合ナレッジオーケストレーター ＆ 横断調停)
            </h3>
            <p className="text-[11px] text-slate-400">
              Shipping Advisor・Zonos・真贋鑑定・Rights Gate間の規約と確認事実を調停し、重複調査と反復質問をゼロ化します。
            </p>
          </div>
        </div>

        {/* Efficiency Metric Badges (Spec #16) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 shadow">
            ⏱️ 削減時間: ~{stats.estimatedMinutesSaved}分
          </span>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950 px-2.5 py-1 rounded border border-cyan-800">
            🔄 重複調査回避: {stats.duplicateResearchPrevented}回
          </span>
          <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950 px-2.5 py-1 rounded border border-purple-800">
            🏷️ 事実再利用: {stats.reusedVerifiedFacts}回
          </span>
          <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950 px-2.5 py-1 rounded border border-amber-800">
            🛡️ 質問回避: {stats.repeatedQuestionsPrevented}回
          </span>
        </div>
      </div>

      {/* COMPACT SECTION: 知識再利用状況 (Spec #12) */}
      <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
            <span>📊</span>
            <span>知識再利用状況 (Cross-Module Reuse Status)</span>
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            連携モジュール: {consumerModules.length} 系統稼働中
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="p-2 bg-slate-900 rounded border border-slate-800">
            <div className="text-emerald-300 font-black text-sm">{stats.reusedVerifiedFacts}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">確認済み知識の再利用</div>
          </div>
          <div className="p-2 bg-slate-900 rounded border border-slate-800">
            <div className="text-cyan-300 font-black text-sm">{stats.duplicateResearchPrevented}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">新規調査の完全回避</div>
          </div>
          <div className="p-2 bg-slate-900 rounded border border-slate-800">
            <div className="text-amber-300 font-black text-sm">{stats.repeatedQuestionsPrevented}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">人間確認の重複ゼロ化</div>
          </div>
          <div className="p-2 bg-slate-900 rounded border border-slate-800">
            <div className="text-rose-300 font-black text-sm">{stats.staleRuleInterceptions}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">失効ナレッジの遮断</div>
          </div>
          <div className="p-2 bg-slate-900 rounded border border-slate-800">
            <div className="text-purple-300 font-black text-sm">{stats.contradictionDetections}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">規則不一致の検知</div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'overview' ? 'bg-purple-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('overview')}
        >
          🌐 モジュール間連携の仕組み
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'simulator' ? 'bg-purple-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('simulator')}
        >
          🎯 横断ナレッジ照合シミュレーター
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'priority_queue' ? 'bg-purple-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('priority_queue')}
        >
          🚨 再検証優先度キュー ({priorityQueue.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'audit' ? 'bg-purple-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('audit')}
        >
          📜 調停監査ログ ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: モジュール間連携の仕組み (Spec #4) */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>🔗</span>
              <span>モジュール間ナレッジ横断共有の実例 (Cross-Module Concrete Examples)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-cyan-300">
                  <span>📦</span>
                  <span>Example A: Shipping Compliance ➔ AI Shipping Advisor</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  コンプライアンス判定で「$2,000超の腕時計はeBay SpeedPAK引受不可」と検証された規則を、配送アドバイザーが即時再利用。キャリア約款の重複調査を完全にゼロ化。
                </p>
                <div className="text-[10px] text-emerald-400 font-mono">✅ 「確認済み知識を再利用: SpeedPAK Watch Restriction」</div>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-purple-300">
                  <span>🎨</span>
                  <span>Example B: Rights &amp; Risk Gate ➔ AI Marketing Studio</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  スタッフが手元現物を撮影し「自社撮影写真」と確認した事実を特定アセットに記録。マーケティングスタジオで再確認質問を行わず、安全にSNS・EC画像として採用。
                </p>
                <div className="text-[10px] text-emerald-400 font-mono">✅ 「特定アセット事実を再利用: 重複質問を回避」</div>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span>🏷️</span>
                  <span>Example C: Authenticity Guarantee ➔ Shipment Readiness</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  eBay真贋鑑定（$2,000+腕時計）のハブ経由義務を検知し、出荷準備画面において購入者個人住所ではなくオハイオ鑑定施設へのラベル発行指示を自動共有。
                </p>
                <div className="text-[10px] text-emerald-400 font-mono">✅ 「公式API権威レベル A_OFFICIAL_API を継承」</div>
              </div>

              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <span>🌐</span>
                  <span>Example D: Zonos Prepay ➔ AI Shipping Advisor</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  日本郵便＋適格海外便におけるZonos Prepay JPY申告総額割り当てルールを、配送アドバイザーのDDP最適化エンジンが直接再利用。
                </p>
                <div className="text-[10px] text-emerald-400 font-mono">✅ 「同一スコープ内での完全再利用保証」</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 横断ナレッジ照合シミュレーター ＆ 根拠を見る (Specs #2, #5, #9) */}
      {activeTab === 'simulator' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-purple-300 flex items-center gap-1.5">
              <span>🎯</span>
              <span>横断ナレッジ調停シミュレーター (Cross-Module Query Simulator)</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-bold">リクエスト元モジュール:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={simModule}
                  onChange={(e) => setSimModule(e.target.value)}
                >
                  <option value="ai_shipping_advisor">AI Shipping Advisor</option>
                  <option value="shipping_compliance">Shipping Compliance</option>
                  <option value="ai_marketing_studio">AI Marketing Studio</option>
                  <option value="zonos_customs">Zonos Customs Manager</option>
                  <option value="shipping_template">Shipping Template</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold">キャリア / プラットフォーム:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={simCarrier}
                  onChange={(e) => setSimCarrier(e.target.value)}
                >
                  <option value="FedEx">FedEx</option>
                  <option value="eBay SpeedPAK">eBay SpeedPAK</option>
                  <option value="eBay">eBay</option>
                  <option value="Japan Post">Japan Post (日本郵便)</option>
                  <option value="DHL">DHL Express</option>
                  <option value="Instagram">Instagram</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold">対象国 / 配送先:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={simCountry}
                  onChange={(e) => setSimCountry(e.target.value)}
                >
                  <option value="US">アメリカ (US)</option>
                  <option value="DE">ドイツ (DE)</option>
                  <option value="Global">全世界 (Global)</option>
                  <option value="JP">日本国内 (JP)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold">商品カテゴリ:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={simCategory}
                  onChange={(e) => setSimCategory(e.target.value)}
                >
                  <option value="Watches">腕時計 (Watches)</option>
                  <option value="Cameras">カメラ (Cameras)</option>
                  <option value="Jewelry">ジュエリー (Jewelry)</option>
                  <option value="All">全品目 (All)</option>
                </select>
              </div>
            </div>

            {/* Response Card */}
            <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2.5">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-xs">調停結果:</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                      simResponse.isResolved
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-rose-950 text-rose-300 border border-rose-800'
                    }`}
                  >
                    {simResponse.isResolved ? '🟢 確認済み知識を再利用' : '🔴 知識不一致 / 要手動確認'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
                    権威: {simResponse.authorityLevel}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                    鮮度: {simResponse.freshnessStatus}
                  </span>
                </div>
              </div>

              <p className="text-slate-200 text-xs leading-relaxed font-medium">
                {simResponse.bestApplicableKnowledge?.statement || simResponse.mismatchReasonJa}
              </p>

              {/* DECISION PROVENANCE (Spec #9: 「この判断は何を根拠にしましたか？ / 根拠を見る」) */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  className="text-cyan-400 hover:text-cyan-300 font-bold flex items-center gap-1 text-[11px]"
                  onClick={() => setShowProvenanceDetails(!showProvenanceDetails)}
                >
                  <span>🧠</span>
                  <span>{showProvenanceDetails ? '根拠・判定由来 (Provenance) を閉じる ▲' : '根拠を見る (この判断は何を根拠にしましたか？) ▼'}</span>
                </button>

                {showProvenanceDetails && (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 mt-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 font-bold">判定の根拠理由 (Reason Basis):</span>
                      <p className="text-slate-200 mt-0.5">{simResponse.provenance.reasonBasisJa}</p>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold">情報源 ＆ 権威ランク:</span>
                      <div className="text-cyan-300 font-mono mt-0.5">
                        {simResponse.source} ({simResponse.provenance.authorityLevelBadge}) - 検証日: {simResponse.lastVerifiedTime}
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-400 font-bold">決定打となった原文条項 (Decisive Clause - 抜粋省略なし):</span>
                      <p className="p-2 bg-slate-900 rounded border border-slate-800 text-slate-300 font-mono text-[10px] mt-0.5">
                        {simResponse.evidence}
                      </p>
                    </div>

                    {simResponse.bestApplicableKnowledge && (
                      <div className="flex justify-between items-center pt-1 border-t border-slate-900 text-[10px]">
                        <span className="text-slate-400">
                          影響を受けるモジュール: {simResponse.bestApplicableKnowledge.affectedModuleIds.join(', ')}
                        </span>
                        <button
                          type="button"
                          className="px-2 py-0.5 bg-rose-900 hover:bg-rose-800 text-rose-200 rounded"
                          onClick={() =>
                            handleTriggerInvalidation(
                              simResponse.bestApplicableKnowledge!.knowledgeId,
                              simResponse.bestApplicableKnowledge!.topic
                            )
                          }
                        >
                          ナレッジ改定・無効化を通知
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 再検証優先度キュー (Spec #11) */}
      {activeTab === 'priority_queue' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-purple-300 flex items-center gap-1.5">
              <span>🚨</span>
              <span>再検証優先度キュー (Revalidation Priority Queue)</span>
            </h4>
            <span className="text-xs text-slate-400">業務ブロッキングリスク・影響ワークフロー数に基づき自動優先順位付け</span>
          </div>

          {priorityQueue.length === 0 ? (
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center text-slate-400">
              🟢 現在、要再確認または失効したクリティカルな規約・ナレッジは存在しません。全モジュール正常稼働中です。
            </div>
          ) : (
            <div className="space-y-2">
              {priorityQueue.map((item) => (
                <div key={item.knowledgeId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-100 text-xs">{item.topic}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        経過日数: {item.ageInDays}日
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      影響ワークフロー数: <strong className="text-cyan-300">{item.affectedWorkflowsCount}件</strong> ({item.affectedModules.join(', ')})
                    </div>
                  </div>

                  <div className="text-right space-y-1">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                      {item.priorityLabelJa} (Score: {item.priorityScore})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: 調停監査ログ (Spec #15) */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-purple-300 flex items-center gap-1.5">
              <span>📜</span>
              <span>調停監査ログ (Orchestrator Audit Trail)</span>
            </h4>
            <span className="text-xs text-slate-400">ナレッジ要求・再利用・重複調査回避の完全記録</span>
          </div>

          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3 text-[11px]">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-cyan-400 font-bold">[{log.requestingModule}]</span>
                    <span className="text-slate-200">{log.querySummary}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {log.detailsJa} | 時刻: {log.timestamp.split('T')[1].substring(0, 8)}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    log.reused
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {log.reused ? '再利用完了' : '新規確認'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
