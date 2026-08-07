import React, { useState, useEffect } from 'react';
import { SourceHealth, UnstructuredPolicyProposal, AffectedListingImpact } from '../../types/ruleSync';
import {
  loadSourceHealth,
  triggerAutomaticSync,
  performPreActionVerification,
  loadPolicyProposals,
  approvePolicyProposal,
  rollbackRuleVersion,
  checkExistingListingImpacts,
  loadRuleHistory
} from '../../services/ruleSyncService';

export const SourceHealthDashboardCard: React.FC = () => {
  const [sources, setSources] = useState<SourceHealth[]>(loadSourceHealth());
  const [proposals, setProposals] = useState<UnstructuredPolicyProposal[]>(loadPolicyProposals());
  const [affectedListings, setAffectedListings] = useState<AffectedListingImpact[]>(checkExistingListingImpacts());
  const [ruleHistory, setRuleHistory] = useState(loadRuleHistory());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Run pre-action verification check
  const verification = performPreActionVerification('publication');

  // App Startup & 24h Scheduled Sync Trigger
  useEffect(() => {
    // Initial app start auto sync
    triggerAutomaticSync(false);
    setSources(loadSourceHealth());

    // 24h interval timer
    const interval = setInterval(() => {
      triggerAutomaticSync(false);
      setSources(loadSourceHealth());
    }, 24 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleEmergencyManualRefresh = () => {
    const res = triggerAutomaticSync(true);
    setSources(loadSourceHealth());
    showToast(`🔄 ${res.message} (${res.updatedSourcesCount}件のソースを検証完了)`);
  };

  const handleApproveProposal = (proposalId: string) => {
    const ok = approvePolicyProposal(proposalId, 'Admin Officer');
    if (ok) {
      setProposals(loadPolicyProposals());
      setRuleHistory(loadRuleHistory());
      showToast('✅ 非構造化ポリシー提案を承認し、本番環境に反映しました。');
    }
  };

  const handleRollback = (ruleId: string) => {
    const ok = rollbackRuleVersion(ruleId, 'Admin Officer', 'Emergency rollback requested');
    if (ok) {
      setRuleHistory(loadRuleHistory());
      showToast(`⏪ ルール (${ruleId}) を前バージョンへロールバックしました。`);
    }
  };

  const handleConfirmListingImpact = (listingId: string) => {
    setAffectedListings((prev) =>
      prev.map((l) => (l.listingId === listingId ? { ...l, sellerConfirmed: true } : l))
    );
    showToast(`✅ リスティング (${listingId}) の影響内容・修正アクションを承認しました。`);
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">📡</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">配送規則・コンプライアンス自動同期ステータス</h3>
            <p className="text-[11px] text-slate-400">アプリ起動時・24時間・出品前・出荷前の自動検証 ＆ リアルタイムソースヘルス管理</p>
          </div>
        </div>

        <button
          type="button"
          className="btn-primary text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5"
          onClick={handleEmergencyManualRefresh}
        >
          🔄 最新ルールを今すぐ再確認 (緊急手動更新)
        </button>
      </div>

      {/* Fail-Safe Pre-Action Verification Gate Warning Banner */}
      {!verification.canProceed && (
        <div className="p-3 bg-red-950/90 border border-red-500/80 rounded-lg text-red-200 text-xs font-semibold space-y-1">
          <div className="flex items-center space-x-2 text-sm font-bold text-red-300">
            <span>🛑</span>
            <span>{verification.japaneseErrorMessage}</span>
          </div>
          <ul className="list-disc list-inside font-mono text-[11px] text-red-200">
            {verification.blockingReasons.map((reason, idx) => (
              <li key={idx}>・{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Source Health Dashboard Table */}
      <div className="space-y-2">
        <strong className="text-slate-200 font-bold block text-xs">📊 同期ソースヘルスダッシュボード (Source Health Dashboard)</strong>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-[11px]">
            <thead>
              <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <th className="p-2">ソース名</th>
                <th className="p-2">種別</th>
                <th className="p-2">最終成功同期</th>
                <th className="p-2">次回自動同期</th>
                <th className="p-2">ステータス</th>
                <th className="p-2">影響を受ける機能</th>
                <th className="p-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {sources.map((src) => (
                <tr key={src.sourceId} className="bg-slate-950/40">
                  <td className="p-2 font-bold text-slate-200">{src.sourceName}</td>
                  <td className="p-2">
                    <span className="text-slate-400">
                      {src.sourceType === 'structured_api' ? '⚡ 公式構造化API' : '📄 非構造化文書'}
                    </span>
                  </td>
                  <td className="p-2 text-slate-300">{new Date(src.lastSuccessfulSync).toLocaleTimeString()}</td>
                  <td className="p-2 text-slate-400">{new Date(src.nextScheduledSync).toLocaleTimeString()}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                      最新 (Latest)
                    </span>
                  </td>
                  <td className="p-2 text-slate-400">{src.affectedFunctions.join(', ')}</td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                      onClick={handleEmergencyManualRefresh}
                    >
                      再取得
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unstructured Policy Proposals (Requires Admin Approval) */}
      {proposals.length > 0 && (
        <div className="p-3 bg-amber-950/60 border border-amber-500/80 rounded-lg space-y-2">
          <strong className="text-amber-300 font-bold block text-xs">
            📄 非構造化ポリシー変更提案 (管理者要承認 - {proposals.length}件)
          </strong>

          {proposals.map((prop) => (
            <div key={prop.proposalId} className="p-2.5 bg-slate-950 rounded border border-amber-800/80 space-y-2 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-200">ソース: {prop.sourceName} (発行日: {prop.publicationDate})</span>
                <span className="text-amber-400 font-bold font-mono">Status: 承認待ち</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono">
                <div>
                  <span className="text-slate-400 block text-[10px]">現在のルール:</span>
                  <p className="bg-slate-900 p-1.5 rounded">{prop.currentRuleText}</p>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">提案される新ルール:</span>
                  <p className="bg-slate-900 p-1.5 rounded text-amber-300">{prop.proposedRuleText}</p>
                </div>
              </div>

              <div className="text-[10px] text-slate-400">
                予想される業務影響: <strong className="text-slate-300">{prop.expectedOperationalImpact}</strong>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  className="btn-primary text-xs font-bold px-3 py-1 bg-emerald-600 hover:bg-emerald-500"
                  onClick={() => handleApproveProposal(prop.proposalId)}
                >
                  ✓ 管理者として新ルールを承認・有効化
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Existing Listings Impact Check View */}
      {affectedListings.length > 0 && (
        <div className="p-3 bg-slate-950 border border-blue-500/60 rounded-lg space-y-2">
          <strong className="text-blue-300 font-bold block text-xs">
            ⚠️ 配送規則変更による既存リスティング影響チェック ({affectedListings.length}件)
          </strong>

          {affectedListings.map((item) => (
            <div key={item.listingId} className="p-2.5 bg-slate-900 rounded border border-slate-800 flex justify-between items-center flex-wrap gap-2 text-[11px]">
              <div>
                <strong className="text-slate-100">{item.title} (ID: {item.listingId})</strong>
                <div className="text-slate-400">
                  旧判定: <span className="line-through">{item.oldShippingDecision}</span> &rarr; 新制限: <span className="text-amber-300 font-bold">{item.newRestrictionReason}</span>
                </div>
                <div className="text-emerald-400">必要アクション: {item.requiredCorrectionAction}</div>
              </div>

              <button
                type="button"
                className={`btn-primary text-xs font-bold px-3 py-1 ${item.sellerConfirmed ? 'bg-slate-800 text-slate-400' : 'bg-blue-600 hover:bg-blue-500'}`}
                disabled={item.sellerConfirmed}
                onClick={() => handleConfirmListingImpact(item.listingId)}
              >
                {item.sellerConfirmed ? '✓ セラー確認済み' : '✓ 修正内容を承認・反映'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Audit Log & Rollback History */}
      {ruleHistory.length > 0 && (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-[11px]">
          <strong className="text-slate-300 font-bold block text-xs">📜 監査ログ ＆ バージョンロールバック履歴</strong>
          <div className="space-y-1 font-mono">
            {ruleHistory.map((log) => (
              <div key={log.historyId} className="flex justify-between items-center p-2 bg-slate-900 rounded border border-slate-800">
                <div>
                  <span className="text-emerald-400 font-bold">[{log.actionType}]</span>{' '}
                  <span className="text-slate-200">Rule: {log.ruleId} (Ver {log.version})</span>
                  <span className="text-slate-400 text-[10px] block">実行者: {log.performedBy} ({new Date(log.retrievedTime).toLocaleString()})</span>
                </div>

                {log.actionType !== 'rolled_back' && (
                  <button
                    type="button"
                    className="text-xs text-amber-400 hover:text-amber-300 font-bold"
                    onClick={() => handleRollback(log.ruleId)}
                  >
                    ⏪ ロールバック
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
