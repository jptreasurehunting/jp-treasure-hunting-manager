import React, { useState, useEffect, useMemo } from 'react';
import {
  OperationalKnowledgeEntry,
  KnowledgeDomain,
  KnowledgeLifecycleStatus,
  KnowledgeEfficiencyMetrics,
  ContradictionReport
} from '../../types/operationalKnowledge';
import {
  loadOperationalKnowledge,
  saveOperationalKnowledge,
  loadExactAssetConfirmations,
  loadKnowledgeEfficiencyMetrics,
  queryScopeAwareKnowledge,
  detectKnowledgeContradictions,
  searchOperationalKnowledge,
  updateKnowledgeStatus,
  initOperationalKnowledgeHealthModule
} from '../../services/operationalKnowledgeService';

interface OperationalKnowledgeCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const OperationalKnowledgeCard: React.FC<OperationalKnowledgeCardProps> = ({ onAddAuditLog }) => {
  const [knowledgeList, setKnowledgeList] = useState<OperationalKnowledgeEntry[]>(loadOperationalKnowledge());
  const [metrics] = useState<KnowledgeEfficiencyMetrics>(loadKnowledgeEfficiencyMetrics());
  const [exactFacts] = useState(loadExactAssetConfirmations());
  const [searchKeyword, setSearchKeyword] = useState('腕時計 FedEx');
  const [selectedDomain, setSelectedDomain] = useState<KnowledgeDomain | ''>('');
  const [activeTab, setActiveTab] = useState<'search' | 'scope_tester' | 'contradictions' | 'facts' | 'all_entries'>('search');
  const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Scope tester interactive state
  const [testCarrier, setTestCarrier] = useState('FedEx');
  const [testCountry, setTestCountry] = useState('US');
  const [testCategory, setTestCategory] = useState('Watches');
  const [testUsage, setTestUsage] = useState('shipping_decision');

  useEffect(() => {
    initOperationalKnowledgeHealthModule();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const filteredKnowledge = useMemo(() => {
    return searchOperationalKnowledge({
      keyword: searchKeyword,
      domain: selectedDomain || undefined
    });
  }, [searchKeyword, selectedDomain, knowledgeList]);

  const conflicts: ContradictionReport[] = useMemo(() => {
    return detectKnowledgeContradictions();
  }, [knowledgeList]);

  const scopeResult = useMemo(() => {
    return queryScopeAwareKnowledge({
      domain: 'shipping',
      marketplaceOrCarrier: testCarrier,
      country: testCountry,
      category: testCategory,
      usageScope: testUsage
    });
  }, [testCarrier, testCountry, testCategory, testUsage, knowledgeList]);

  const handleStatusChange = (id: string, status: KnowledgeLifecycleStatus) => {
    const res = updateKnowledgeStatus(id, status, 'ユーザー手動操作によるステータス更新');
    if (res.success) {
      setKnowledgeList(loadOperationalKnowledge());
      showToast(`🔄 ナレッジ (${id}) のステータスを ${status} に更新しました`);
      if (onAddAuditLog) {
        onAddAuditLog(`OperationalKnowledge: Status changed to ${status}`, undefined, id);
      }
    }
  };

  return (
    <div className="operational-knowledge-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-cyan-500 text-cyan-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>📚</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🧠</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Shared Operational Knowledge Engine (共有運用ナレッジ基盤 ＆ 依存関係グラフ)
            </h3>
            <p className="text-[11px] text-slate-400">
              eBay・Zonos・FedEx・DHL・真贋鑑定・著作権等の規約・検証済み事実をアプリ全体で横断共有し、反復調査と再質問をゼロ化します。
            </p>
          </div>
        </div>

        {/* Efficiency Metrics Pills (Spec #17) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-950 px-2.5 py-1 rounded border border-emerald-800 shadow">
            ⏱️ 削減時間: ~{metrics.estimatedMinutesSaved}分
          </span>
          <span className="text-xs font-mono font-bold text-cyan-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
            🔄 質問回避: {metrics.repeatedQuestionsAvoided}回
          </span>
          <span className="text-xs font-mono font-bold text-purple-300 bg-purple-950 px-2.5 py-1 rounded border border-purple-800">
            📚 登録規約: {knowledgeList.length}件
          </span>
        </div>
      </div>

      {/* Contradiction Warning Banner (Spec #4) */}
      {conflicts.length > 0 && (
        <div className="p-3.5 bg-rose-950/60 border-2 border-rose-600 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-rose-300 font-bold text-xs">
            <span className="text-base animate-bounce">🚨</span>
            <span>ルール不一致を検知 (Knowledge Contradiction Detected)</span>
          </div>
          {conflicts.map((c, idx) => (
            <div key={idx} className="p-2.5 bg-slate-950 rounded border border-rose-800/80 text-xs text-slate-200 space-y-1">
              <div>トピック: <strong className="text-rose-200">{c.topic}</strong> (スコープ: {c.scope})</div>
              <div>不一致理由: <span className="text-slate-300">{c.conflictReasonJa}</span></div>
              <div className="text-emerald-300 font-bold">推奨対応: {c.recommendedResolutionJa}</div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'search' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('search')}
        >
          🔍 運用知識を検索 ({filteredKnowledge.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'scope_tester' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('scope_tester')}
        >
          🎯 スコープ別ルール判定 ＆ 再利用テスト
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'facts' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('facts')}
        >
          🏷️ 実物写真・個別事実の確認台帳 ({Object.keys(exactFacts).length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'all_entries' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('all_entries')}
        >
          📑 全ナレッジ ＆ 依存関係グラフ ({knowledgeList.length})
        </button>
      </div>

      {/* TAB 1: 運用知識を検索 (Spec #14) */}
      {activeTab === 'search' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="flex-1 min-w-[240px]">
              <input
                type="text"
                placeholder="キーワード検索 (例: 腕時計 FedEx 書類 / Authenticity Guarantee / リチウム電池)"
                className="w-full p-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
              />
            </div>
            <select
              className="p-2 bg-slate-950 border border-slate-700 rounded text-slate-200 text-xs"
              value={selectedDomain}
              onChange={(e) => setSelectedDomain(e.target.value)}
            >
              <option value="">全ドメイン</option>
              <option value="shipping">配送・キャリア規約</option>
              <option value="authenticity">真贋鑑定 (AG)</option>
              <option value="carrier_compliance">航空危険物・コンプライアンス</option>
              <option value="marketing_rights">知的財産・マーケティング</option>
            </select>
          </div>

          <div className="space-y-2.5">
            {filteredKnowledge.map((k) => (
              <div key={k.knowledgeId} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <div>
                    <span className="text-[10px] text-cyan-400 font-mono font-bold uppercase">
                      [{k.domain}] {k.marketplaceOrCarrierOrPlatform} | {k.countryOrRegion} | {k.productCategoryScope}
                    </span>
                    <h5 className="font-bold text-slate-100 text-xs mt-0.5">{k.topic}</h5>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                      {k.authorityLevel.replace(/^[A-Z]_/, '')}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        k.currentStatus === 'ACTIVE'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {k.currentStatus}
                    </span>
                  </div>
                </div>

                <p className="text-slate-200 text-xs font-medium leading-relaxed">{k.statement}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900 flex-wrap gap-2">
                  <div>情報源: <span className="text-slate-300">{k.source}</span> (検証日: {k.verifiedDate})</div>
                  <button
                    type="button"
                    className="text-cyan-400 hover:text-cyan-300 font-bold"
                    onClick={() => setExpandedKnowledgeId(expandedKnowledgeId === k.knowledgeId ? null : k.knowledgeId)}
                  >
                    {expandedKnowledgeId === k.knowledgeId ? '理由・原文条項を閉じる ▲' : '理由・原文条項を見る (Decisive Clause) ▼'}
                  </button>
                </div>

                {expandedKnowledgeId === k.knowledgeId && (
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 mt-2">
                    <div>
                      <span className="text-[11px] text-slate-400 font-bold">原文条項 (Decisive Original Clause - 抜粋なし):</span>
                      <p className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-200 font-mono text-[11px] mt-0.5">
                        {k.originalLanguageText || k.evidence}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 font-bold">日本語完全翻訳 ＆ AI解釈:</span>
                      <p className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-200 text-xs mt-0.5">
                        {k.japaneseTranslation}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <div>影響を受けるモジュール: <span className="text-cyan-300 font-mono">{k.affectedModuleIds.join(', ')}</span></div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
                          onClick={() => handleStatusChange(k.knowledgeId, 'RECHECK_REQUIRED')}
                        >
                          要再確認へ変更
                        </button>
                        <button
                          type="button"
                          className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-700 text-slate-100 rounded"
                          onClick={() => handleStatusChange(k.knowledgeId, 'ACTIVE')}
                        >
                          有効として承認
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: スコープ別ルール判定 & 再利用テスト (Spec #5, #13, #15) */}
      {activeTab === 'scope_tester' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <span>🎯</span>
              <span>スコープ別ナレッジ自動照合シミュレーター</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 font-bold">キャリア / モジュール:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={testCarrier}
                  onChange={(e) => setTestCarrier(e.target.value)}
                >
                  <option value="FedEx">FedEx</option>
                  <option value="DHL">DHL Express</option>
                  <option value="Japan Post">Japan Post (日本郵便)</option>
                  <option value="eBay SpeedPAK">eBay SpeedPAK</option>
                  <option value="eBay">eBay</option>
                  <option value="Instagram">Instagram</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold">配送先 / 対象国:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={testCountry}
                  onChange={(e) => setTestCountry(e.target.value)}
                >
                  <option value="US">アメリカ (US)</option>
                  <option value="DE">ドイツ (DE)</option>
                  <option value="GB">イギリス (UK)</option>
                  <option value="Global">全世界 (Global)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold">商品カテゴリ:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value)}
                >
                  <option value="Watches">腕時計 (Watches)</option>
                  <option value="Cameras">カメラ・レンズ (Cameras)</option>
                  <option value="Jewelry">貴金属・ジュエリー (Jewelry)</option>
                  <option value="All">全品目 (All)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold">利用用途:</label>
                <select
                  className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-200 text-xs mt-0.5"
                  value={testUsage}
                  onChange={(e) => setTestUsage(e.target.value)}
                >
                  <option value="shipping_decision">配送方法判定 (Shipping)</option>
                  <option value="listing">出品・真贋鑑定 (Listing)</option>
                  <option value="ad_marketing">SNS・広告販促 (Marketing)</option>
                </select>
              </div>
            </div>

            {/* Scope Match Result View */}
            <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-xs text-slate-100">照合結果サマリー:</span>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                    scopeResult.scopeMatched ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {scopeResult.verificationBadge}
                </span>
              </div>

              <p className="text-slate-200 text-xs">{scopeResult.whyExplanationJa}</p>

              {scopeResult.entry && (
                <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-300 space-y-1">
                  <div>適用ルール: <strong className="text-cyan-300">{scopeResult.entry.topic}</strong></div>
                  <div>権威レベル: <span className="text-slate-200">{scopeResult.authorityBadge}</span></div>
                  <div>根拠ソース: <span className="text-slate-200">{scopeResult.entry.source}</span> (検証日: {scopeResult.originalVerificationDate})</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 実物写真・個別事実の確認台帳 (Spec #6 & #7) */}
      {activeTab === 'facts' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>🏷️</span>
              <span>実物写真・特定商品アセット固有の事実確認台帳</span>
            </h4>
            <span className="text-xs text-slate-400">※ 他商品への不用意な一般化を完全に防止</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Object.values(exactFacts).map((fact) => (
              <div key={fact.assetOrItemSignature} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-start">
                  <code className="text-xs font-mono font-bold text-cyan-300">{fact.assetOrItemSignature}</code>
                  <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    回答: {fact.confirmedAnswer === 'yes' ? 'はい' : fact.confirmedAnswer === 'no' ? 'いいえ' : '分からない'}
                  </span>
                </div>
                <div className="text-slate-200 font-bold text-xs">{fact.itemTitle}</div>
                <div className="text-[11px] text-amber-200">{fact.factQuestionJa}</div>
                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                  確認者: {fact.confirmedBy} | 確認日時: {fact.confirmedAt.split('T')[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: 全ナレッジ & 依存関係グラフ (Spec #11) */}
      {activeTab === 'all_entries' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📑</span>
              <span>ナレッジ依存関係グラフ (Knowledge Dependency Graph)</span>
            </h4>
            <span className="text-xs text-slate-400">{knowledgeList.length} 件の統合管理ルール</span>
          </div>

          <div className="space-y-2">
            {knowledgeList.map((entry) => (
              <div key={entry.knowledgeId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-xs">{entry.topic}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {entry.marketplaceOrCarrierOrPlatform} ({entry.countryOrRegion})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 truncate max-w-[600px]">{entry.statement}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-mono">
                    <span>依存モジュール:</span>
                    {entry.affectedModuleIds.map((m, idx) => (
                      <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    entry.currentStatus === 'ACTIVE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {entry.currentStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
