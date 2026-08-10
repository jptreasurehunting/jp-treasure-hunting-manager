import React, { useState } from 'react';
import {
  OpportunityCandidate,
  OpportunityCategoryType,
  OpportunityLifecycleStage,
  SourceAuthorityLevel
} from '../../types/opportunityHunter';
import {
  getInitialOpportunityCandidates,
  approveOpportunityCandidate,
  updateOpportunityLifecycleStage
} from '../../services/opportunityHunterService';
import {
  ingestOpportunitySignals,
  getPhase2SeedOpportunitySignals
} from '../../services/opportunityDiscoveryService';
import {
  evaluateCandidateFreshness,
  refreshOpportunityPoolFreshness
} from '../../services/opportunityMonitoringService';
import { formatLocaleCurrency } from '../../services/i18nService';

export const OpportunityHunterCard: React.FC = () => {
  const formatCurrency = (amount: number, cur: string = 'JPY') => formatLocaleCurrency(amount, cur, 'ja-JP');
  const [candidates, setCandidates] = useState<OpportunityCandidate[]>(() => {
    const initial = getInitialOpportunityCandidates();
    return refreshOpportunityPoolFreshness(initial);
  });
  const [selectedId, setSelectedId] = useState<string>(() => candidates[0]?.id || '');
  const [operatorName, setOperatorName] = useState<string>('Staff-A (Primary)');
  const [approvalNote, setApprovalNote] = useState<string>('');
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<'WATCH' | 'PREPURCHASE' | 'REJECT' | null>(null);

  const selectedCandidate = candidates.find((c) => c.id === selectedId) || candidates[0];

  const handleIngestSignals = () => {
    const seedSignals = getPhase2SeedOpportunitySignals();
    const updatedPool = ingestOpportunitySignals(candidates, seedSignals);
    const refreshed = refreshOpportunityPoolFreshness(updatedPool);
    setCandidates(refreshed);
    if (!refreshed.some((c) => c.id === selectedId) && refreshed.length > 0) {
      setSelectedId(refreshed[0].id);
    }
  };

  const handleOpenApprovalModal = (action: 'WATCH' | 'PREPURCHASE' | 'REJECT') => {
    setPendingAction(action);
    setApprovalNote(
      action === 'PREPURCHASE'
        ? '仕入原価・納期・利益率・知財を確認の上、予約仕入を承認。'
        : action === 'WATCH'
        ? '需要・完売速度の動向を監視リストで追跡。'
        : '利益率または需要不足のため見送り。'
    );
    setShowApprovalModal(true);
  };

  const handleConfirmApproval = () => {
    if (!selectedCandidate || !pendingAction) return;
    const updated = approveOpportunityCandidate(selectedCandidate, pendingAction, operatorName, approvalNote);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setShowApprovalModal(false);
    setPendingAction(null);
  };

  const handleLifecycleChange = (stage: OpportunityLifecycleStage) => {
    if (!selectedCandidate) return;
    const updated = updateOpportunityLifecycleStage(selectedCandidate, stage);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const getCategoryBadge = (type: OpportunityCategoryType) => {
    switch (type) {
      case 'JAPAN_EXCLUSIVE':
        return { label: '🇯🇵 日本限定', color: 'bg-rose-900/60 text-rose-300 border-rose-700/60' };
      case 'LIMITED_QUANTITY':
        return { label: '⏳ 数量限定', color: 'bg-amber-900/60 text-amber-300 border-amber-700/60' };
      case 'MADE_TO_ORDER':
        return { label: '📦 完全受注生産', color: 'bg-indigo-900/60 text-indigo-300 border-indigo-700/60' };
      case 'LOTTERY_SALE':
        return { label: '🎟 抽選販売', color: 'bg-purple-900/60 text-purple-300 border-purple-700/60' };
      case 'PREORDER_EXCLUSIVE':
        return { label: '🎁 予約限定特典', color: 'bg-cyan-900/60 text-cyan-300 border-cyan-700/60' };
      case 'EVENT_STORE_EXCLUSIVE':
        return { label: '🎪 イベント/店舗限定', color: 'bg-orange-900/60 text-orange-300 border-orange-700/60' };
      case 'COLLABORATION':
        return { label: '🤝 コラボモデル', color: 'bg-emerald-900/60 text-emerald-300 border-emerald-700/60' };
      case 'ANNIVERSARY_MODEL':
        return { label: '✨ 周年記念', color: 'bg-yellow-900/60 text-yellow-300 border-yellow-700/60' };
      case 'OVERSEAS_UNRELEASED':
        return { label: '🌐 海外未発売', color: 'bg-blue-900/60 text-blue-300 border-blue-700/60' };
      case 'HIGH_SELLOUT_RISK':
        return { label: '🚨 即完売リスク高', color: 'bg-red-900/60 text-red-300 border-red-700/60' };
      default:
        return { label: type, color: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const getAuthorityBadge = (authority?: SourceAuthorityLevel) => {
    switch (authority) {
      case 'OFFICIAL_MANUFACTURER':
        return { label: 'Tier 1: 公式メーカー (100%)', color: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
      case 'OFFICIAL_RETAILER_OR_EVENT':
        return { label: 'Tier 2: 公式直営/イベント (95%)', color: 'bg-cyan-950 text-cyan-300 border-cyan-700' };
      case 'AUTHORIZED_DISTRIBUTOR':
        return { label: 'Tier 3: 公認販売店 (85%)', color: 'bg-blue-950 text-blue-300 border-blue-700' };
      case 'REPUTABLE_NEWS_MEDIA':
        return { label: 'Tier 4: 大手メディア (70%)', color: 'bg-purple-950 text-purple-300 border-purple-700' };
      case 'SECONDARY_AGGREGATOR':
        return { label: 'Tier 5: 非公式まとめ (40%)', color: 'bg-amber-950 text-amber-300 border-amber-700' };
      default:
        return { label: 'Tier 6: 未検証ソース (20%)', color: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  const getLifecycleStageLabel = (stage: OpportunityLifecycleStage) => {
    switch (stage) {
      case 'ANNOUNCEMENT':
        return '1. 告知 (Announcement)';
      case 'PREORDER_OPEN':
        return '2. 予約受付中 (Pre-order)';
      case 'STOCK_TIGHTENING':
        return '3. 在庫逼迫 (Tightening)';
      case 'SOLD_OUT':
        return '4. 公式完売 (Sold Out)';
      case 'SECONDARY_MARKET':
        return '5. 二次流通相場 (Secondary)';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-100 shadow-2xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <h2 className="text-xl font-bold tracking-tight text-white">
              先行・限定品機会ハンター (Pre-Release Opportunity Hunter)
            </h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
              Phase 1 & 2
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            日本限定・数量限定・予約・抽選・受注生産品を多要素（需要30%＋利益30%＋希少性20%＋実績20%）で分析し、5段階ライフサイクル監視と人間承認を経て仕入判断を行います。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleIngestSignals}
            className="px-3 py-1.5 text-xs font-bold rounded-lg bg-cyan-900/70 hover:bg-cyan-800 text-cyan-200 border border-cyan-700 shadow flex items-center gap-1.5 transition"
          >
            <span>📥</span> 新規シグナル取得・名寄せ
          </button>
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <label className="text-xs text-slate-400">操作者:</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-36"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Candidate Selector & Detailed Inspection */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Candidate List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
            <span>検知された機会候補一覧 ({candidates.length}件)</span>
            <span>総合スコア順</span>
          </div>

          <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
            {candidates
              .sort((a, b) => b.scoreBreakdown.finalScore - a.scoreBreakdown.finalScore)
              .map((cand) => {
                const isSelected = cand.id === selectedId;
                const score = cand.scoreBreakdown.finalScore;
                const isTrap = cand.scoreBreakdown.isRarityOnlyTrap;
                const isVero = cand.scoreBreakdown.isVeroBlocked;
                const isStale = cand.isDataStale;

                return (
                  <div
                    key={cand.id}
                    onClick={() => setSelectedId(cand.id)}
                    className={`p-3.5 rounded-xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-slate-800/90 border-cyan-500 ring-1 ring-cyan-500/50 shadow-lg'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-100 line-clamp-2 leading-snug">
                        {cand.title}
                      </h4>
                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-extrabold rounded-md ${
                            isVero
                              ? 'bg-red-950 text-red-400 border border-red-800'
                              : isTrap
                              ? 'bg-amber-950 text-amber-400 border border-amber-800'
                              : isStale
                              ? 'bg-yellow-950 text-yellow-400 border border-yellow-800'
                              : score >= 75
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}
                        >
                          {score}点
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {cand.opportunityTypes.slice(0, 2).map((t) => {
                        const badge = getCategoryBadge(t);
                        return (
                          <span
                            key={t}
                            className={`px-1.5 py-0.5 text-[10px] rounded border ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        );
                      })}
                      {cand.isDataStale && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded border bg-yellow-950 text-yellow-300 border-yellow-700">
                          ⚠️ 情報陳腐化
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-800/60">
                      <span>利益: {formatCurrency(cand.economics.netProfitJpy, 'JPY')} ({cand.economics.profitMarginPct.toFixed(0)}%)</span>
                      <span className="text-slate-400">
                        {cand.approvalStatus === 'APPROVED_FOR_PREPURCHASE'
                          ? '🟢 予約仕入承認済'
                          : cand.approvalStatus === 'APPROVED_FOR_WATCHING'
                          ? '🟡 監視リスト'
                          : cand.approvalStatus === 'REJECTED'
                          ? '❌ 見送り'
                          : '⏳ 未承認 (審査待)'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Right Column: Deep Inspection & Human Approval */}
        {selectedCandidate && (
          <div className="lg:col-span-7 bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-5">
            {/* Title & Brand */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                    {selectedCandidate.brand} • {selectedCandidate.category}
                  </span>
                  {selectedCandidate.evidence.sourceAuthority && (
                    <span className={`px-2 py-0.5 text-[10px] rounded border ${getAuthorityBadge(selectedCandidate.evidence.sourceAuthority).color}`}>
                      {getAuthorityBadge(selectedCandidate.evidence.sourceAuthority).label}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  発売予定: {selectedCandidate.releaseDate || '未定'}
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1.5 leading-snug">
                {selectedCandidate.title}
              </h3>
            </div>

            {/* Opportunity Types */}
            <div className="flex flex-wrap gap-1.5">
              {selectedCandidate.opportunityTypes.map((t) => {
                const badge = getCategoryBadge(t);
                return (
                  <span
                    key={t}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                );
              })}
            </div>

            {/* Multi-Factor Radar / Meter Breakdown */}
            <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-slate-200">
                  多要素機会スコア内訳 (Total: {selectedCandidate.scoreBreakdown.finalScore} / 100点)
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded ${
                    selectedCandidate.scoreBreakdown.isRecommended
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-amber-950 text-amber-300 border border-amber-700'
                  }`}
                >
                  {selectedCandidate.scoreBreakdown.isRecommended ? '🟢 推薦 (High Opportunity)' : '🟡 要確認 / 見送り推奨'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">海外需要</div>
                  <div className="text-sm font-bold text-cyan-300 mt-0.5">
                    {selectedCandidate.scoreBreakdown.demandScore} / 30点
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">利益率・粗利</div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    {selectedCandidate.scoreBreakdown.profitScore} / 30点
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">希少性</div>
                  <div className="text-sm font-bold text-indigo-300 mt-0.5">
                    {selectedCandidate.scoreBreakdown.rarityScore} / 20点
                  </div>
                </div>

                <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-400">シリーズ実績</div>
                  <div className="text-sm font-bold text-purple-300 mt-0.5">
                    {selectedCandidate.scoreBreakdown.seriesHistoryScore} / 20点
                  </div>
                </div>
              </div>

              {selectedCandidate.scoreBreakdown.penaltyDeductions > 0 && (
                <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-800/60 p-2.5 rounded-lg flex items-center justify-between">
                  <span>リスク・送料・規約・鮮度ペナルティ減点:</span>
                  <span className="font-bold">-{selectedCandidate.scoreBreakdown.penaltyDeductions}点</span>
                </div>
              )}

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                <span className="font-semibold text-slate-200">推薦根拠: </span>
                {selectedCandidate.scoreBreakdown.recommendationRationale}
              </p>

              {/* Warning Flags */}
              {selectedCandidate.scoreBreakdown.warningFlags.length > 0 && (
                <div className="space-y-1 pt-1">
                  {selectedCandidate.scoreBreakdown.warningFlags.map((flag, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-amber-300 bg-amber-950/30 border border-amber-800/40 px-2.5 py-1.5 rounded"
                    >
                      {flag}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Economics Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
              <div>
                <span className="text-slate-400">仕入原価:</span>
                <div className="font-bold text-slate-200 mt-0.5">
                  {formatCurrency(selectedCandidate.economics.askingPriceJpy, 'JPY')}
                </div>
              </div>
              <div>
                <span className="text-slate-400">想定売価:</span>
                <div className="font-bold text-cyan-300 mt-0.5">
                  ${selectedCandidate.economics.expectedEbayPriceUsd.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-slate-400">想定純利益:</span>
                <div className="font-bold text-emerald-400 mt-0.5">
                  {formatCurrency(selectedCandidate.economics.netProfitJpy, 'JPY')}
                </div>
              </div>
              <div>
                <span className="text-slate-400">想定利益率:</span>
                <div className="font-bold text-emerald-400 mt-0.5">
                  {selectedCandidate.economics.profitMarginPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Lifecycle Tracker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>監視ライフサイクル進行状況:</span>
                <span className="text-cyan-400">
                  {getLifecycleStageLabel(selectedCandidate.lifecycleStage)}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1 text-[11px] text-center">
                {(['ANNOUNCEMENT', 'PREORDER_OPEN', 'STOCK_TIGHTENING', 'SOLD_OUT', 'SECONDARY_MARKET'] as OpportunityLifecycleStage[]).map(
                  (st, idx) => {
                    const isCurrent = selectedCandidate.lifecycleStage === st;
                    return (
                      <button
                        key={st}
                        onClick={() => handleLifecycleChange(st)}
                        className={`p-1.5 rounded font-medium border transition ${
                          isCurrent
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-600 shadow'
                            : 'bg-slate-900 text-slate-500 border-slate-800 hover:bg-slate-800 hover:text-slate-300'
                        }`}
                      >
                        {idx + 1}. {st.substring(0, 7)}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Geographic Exclusivity & Supply Signal (Phase 2) */}
            {selectedCandidate.geographicExclusivity && (
              <div className="text-xs bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-300">🇯🇵 国内限定証明:</span>
                  <span className="text-slate-300">{selectedCandidate.geographicExclusivity.japanExclusivityProof}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>海外発売予定:</span>
                  <span>{selectedCandidate.geographicExclusivity.hasOverseasReleasePlan ? 'あり' : 'なし (日本限定)'}</span>
                </div>
              </div>
            )}

            {/* Provenance & Evidence Details */}
            <div className="text-xs bg-slate-900/60 border border-slate-800 p-3 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span>情報取得元: {selectedCandidate.evidence.sourceName}</span>
                <span>検証日時: {selectedCandidate.evidence.checkedAt.substring(0, 16).replace('T', ' ')}</span>
              </div>
              {selectedCandidate.evidence.sourceUrl && (
                <div className="text-slate-400 truncate">
                  URL: <span className="text-cyan-400 underline">{selectedCandidate.evidence.sourceUrl}</span>
                </div>
              )}
              <div className="text-slate-300 pt-1 border-t border-slate-800/80">
                <span className="font-semibold text-slate-400">根拠メモ: </span>
                {selectedCandidate.evidence.evidenceNotes}
              </div>
            </div>

            {/* Human Approval Action Bar */}
            <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                <span>承認状態: </span>
                <span className="font-bold text-slate-200">
                  {selectedCandidate.approvalStatus === 'APPROVED_FOR_PREPURCHASE'
                    ? '🟢 予約仕入承認済 (Purchase Approved)'
                    : selectedCandidate.approvalStatus === 'APPROVED_FOR_WATCHING'
                    ? '🟡 監視リスト登録済 (Watch Approved)'
                    : selectedCandidate.approvalStatus === 'REJECTED'
                    ? '❌ 見送り (Rejected)'
                    : '⏳ 未承認 (審査待ち)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenApprovalModal('REJECT')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  🚫 見送り
                </button>
                <button
                  onClick={() => handleOpenApprovalModal('WATCH')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-950 hover:bg-amber-900 text-amber-200 border border-amber-700"
                >
                  👀 監視リストに追加
                </button>
                <button
                  onClick={() => handleOpenApprovalModal('PREPURCHASE')}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950"
                >
                  🛒 予約・仕入を承認
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Human Approval Confirmation Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>✍️</span> 人間による仕入・監視承認 (Human Approval Gate)
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              対象商品: <span className="font-bold text-white">{selectedCandidate?.title}</span>
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-semibold">承認理由・監査記録メモ:</label>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="bg-amber-950/40 border border-amber-800/60 p-3 rounded-xl text-xs text-amber-300">
              ℹ 自動購入や実決済は行われません。本承認は管理者の仕入判断の確定および監査ログ記録のみを行います。
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmApproval}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg"
              >
                承認を確定する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
