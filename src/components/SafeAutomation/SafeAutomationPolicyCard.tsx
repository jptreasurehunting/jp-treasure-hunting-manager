import React, { useState, useEffect } from 'react';
import {
  AutomationPolicy,
  ActionExecutionStats,
  AntigravityGuidanceItem,
  SafeAutomationAuditEntry
} from '../../types/safeAutomationPolicy';
import {
  loadAutomationPolicies,
  saveAutomationPolicies,
  loadActionStats,
  saveActionStats,
  getAntigravityGuidance,
  loadSafeAutomationAuditTrail,
  evaluateActionRiskAndPolicy,
  initSafeAutomationHealthModule
} from '../../services/safeAutomationPolicyService';

interface SafeAutomationPolicyCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const SafeAutomationPolicyCard: React.FC<SafeAutomationPolicyCardProps> = ({ onAddAuditLog }) => {
  const [policies, setPolicies] = useState<AutomationPolicy[]>(loadAutomationPolicies());
  const [statsMap, setStatsMap] = useState<Record<string, ActionExecutionStats>>(loadActionStats());
  const [guidanceList] = useState<AntigravityGuidanceItem[]>(getAntigravityGuidance());
  const [auditLogs, setAuditLogs] = useState<SafeAutomationAuditEntry[]>(loadSafeAutomationAuditTrail());
  const [testCommandInput, setTestCommandInput] = useState('git push');
  const [simulatedResult, setSimulatedResult] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'candidates' | 'guidance' | 'policies' | 'audit'>('candidates');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    initSafeAutomationHealthModule();
    setSimulatedResult(evaluateActionRiskAndPolicy({ commandOrAction: testCommandInput }));
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleTestCommand = (cmd: string) => {
    setTestCommandInput(cmd);
    const res = evaluateActionRiskAndPolicy({ commandOrAction: cmd });
    setSimulatedResult(res);
  };

  const handleTogglePolicy = (policyId: string) => {
    const updated = policies.map((p) => (p.policyId === policyId ? { ...p, isActive: !p.isActive } : p));
    setPolicies(updated);
    saveAutomationPolicies(updated);
    showToast(`🔄 ポリシー (${policyId}) の有効状態を切り替えました`);
    if (onAddAuditLog) {
      onAddAuditLog(`SafeAutomation: Policy Toggled (${policyId})`);
    }
  };

  const handleApproveRecommendation = (signature: string) => {
    const existing = policies.find((p) => p.actionPattern === signature);
    if (existing) {
      existing.decision = 'ALLOW';
      existing.isActive = true;
    } else {
      policies.push({
        policyId: `pol_user_${Date.now()}`,
        actionPattern: signature,
        riskLevel: 'LOW_RISK',
        decision: 'ALLOW',
        approvedBy: 'Shop Operator Lead',
        approvalDate: new Date().toISOString().split('T')[0],
        policyVersion: 'Ver. 4.2',
        recheckRule: 'Auto-promoted by operator approval',
        isActive: true,
        isStale: false
      });
    }
    saveAutomationPolicies([...policies]);
    setPolicies([...policies]);
    showToast(`🟢 ${signature} の自動実行ポリシーを承認・保存しました！`);
  };

  return (
    <div className="safe-automation-policy-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>🛡️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🛡️</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              Safe Automation Policy ＆ Risk-based Approval Engine (リスクベース自動化承認エンジン)
            </h3>
            <p className="text-[11px] text-slate-400">
              低リスクな開発検証を安全に自動化しつつ、外部送信・コミット・決済・破壊的変更は常に人間確認を維持します。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-500 shadow">
            <span>🟢</span>
            <span>優先順位: 🔴 BLOCK &gt; 🟠 REQUIRE &gt; 🟢 ALLOW</span>
          </span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'candidates' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('candidates')}
        >
          ⚡ 自動化候補・シミュレーター
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'guidance' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('guidance')}
        >
          ⚙️ Antigravity 自動実行設定
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'policies' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('policies')}
        >
          📜 登録ポリシー一覧 ({policies.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'audit' ? 'bg-emerald-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('audit')}
        >
          📋 承認・実行監査ログ ({auditLogs.length})
        </button>
      </div>

      {/* TAB 1: 自動化候補・シミュレーター */}
      {activeTab === 'candidates' && (
        <div className="space-y-4">
          {/* Candidates List Section (Spec #8) */}
          <div className="space-y-3 p-3.5 bg-slate-950 rounded-xl border border-slate-800">
            <h4 className="font-bold text-emerald-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <span>⚡</span>
              <span>自動化候補 (Safe Automation Recommendations)</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.values(statsMap).map((st) => (
                <div key={st.actionSignature} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <code className="text-xs font-bold text-cyan-300 font-mono">{st.actionSignature}</code>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-black ${
                        st.riskLevel === 'LOW_RISK'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {st.riskLevel}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 space-y-0.5">
                    <div>実行回数: <strong className="text-slate-100">{st.totalExecutions}回</strong> (失敗: {st.totalFailures})</div>
                    <div>外部変更: <span className="text-slate-200">{st.externalSystemName || 'なし (ローカル完結)'}</span></div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">{st.recommendationReasonJa}</div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {st.recommendedForAutomation ? (
                      <button
                        type="button"
                        className="btn-primary flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded text-[11px]"
                        onClick={() => handleApproveRecommendation(st.actionSignature)}
                      >
                        [自動化を承認]
                      </button>
                    ) : (
                      <span className="flex-1 py-1 text-center bg-amber-950/80 text-amber-300 border border-amber-800 rounded text-[11px] font-bold">
                        [毎回確認を維持]
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Simulator & Non-Expert Confirmation Dialog (Spec #11 & #12) */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
              <span>🔍</span>
              <span>コマンド判定シミュレーター ＆ 非専門スタッフ向け実行確認プレビュー</span>
            </h4>

            <div className="flex gap-2 flex-wrap">
              {['npm run build', 'npx tsc --noEmit', 'git status', 'git pull', 'git push', 'git reset --hard', 'ebay:publishListing'].map(
                (cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold border transition-all ${
                      testCommandInput === cmd ? 'bg-cyan-600 text-slate-950 border-cyan-400' : 'bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                    onClick={() => handleTestCommand(cmd)}
                  >
                    {cmd}
                  </button>
                )
              )}
            </div>

            {simulatedResult && (
              <div className="p-3.5 bg-slate-900 rounded-lg border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-slate-400">ビジネス意味:</span>
                    <h5 className="text-sm font-black text-slate-100">{simulatedResult.businessNameJa}</h5>
                  </div>
                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-cyan-300">
                    {simulatedResult.riskBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-400 font-bold text-[11px]">優先順位判定 (Precedence Decision):</span>
                    <div className="text-sm font-black mt-0.5 flex items-center gap-2">
                      <span>{simulatedResult.decision === 'ALLOW' ? '🟢 ALLOW (自動実行許可)' : simulatedResult.decision === 'BLOCK' ? '🔴 BLOCK (完全遮断)' : '🟠 REQUIRE_CONFIRMATION (人間確認必須)'}</span>
                    </div>
                  </div>
                  <div className="p-2 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-400 font-bold text-[11px]">自動実行可否:</span>
                    <div className="text-sm font-black mt-0.5">
                      {simulatedResult.canAutoRun ? (
                        <span className="text-emerald-400">🟢 自動実行可能 (承認済みポリシー適用)</span>
                      ) : (
                        <span className="text-amber-300">🟠 人間確認を待機 (ダイアログ表示)</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Non-Expert Prompt Dialog Preview (Spec #11) */}
                {simulatedResult.confirmationPrompt && (
                  <div className="p-3 bg-amber-950/40 border border-amber-600/60 rounded-lg space-y-2 mt-2">
                    <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                      <span>⚠️</span>
                      <span>{simulatedResult.confirmationPrompt.titleJa}</span>
                    </div>
                    <div className="text-xs text-slate-200 space-y-1">
                      <div>操作内容: <strong className="text-white">{simulatedResult.confirmationPrompt.businessMeaningJa}</strong></div>
                      <div>対象コマンド: <code className="text-cyan-300 font-mono">{simulatedResult.confirmationPrompt.technicalCommand}</code></div>
                      <div>リスク区分: <span className="text-amber-400">{simulatedResult.confirmationPrompt.riskCategoryJa}</span></div>
                      <div>確認が必要な理由: <p className="text-slate-300 mt-0.5">{simulatedResult.confirmationPrompt.reasonConfirmationRequiredJa}</p></div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded text-xs"
                        onClick={() => showToast(`⚡ ${testCommandInput} の実行を承認しました`)}
                      >
                        [ 実行 ]
                      </button>
                      <button
                        type="button"
                        className="px-4 py-1 bg-slate-800 text-slate-300 hover:bg-slate-700 rounded text-xs"
                        onClick={() => showToast(`❌ ${testCommandInput} をキャンセルしました`)}
                      >
                        [ キャンセル ]
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Antigravity 自動実行設定 (Spec #10) */}
      {activeTab === 'guidance' && (
        <div className="space-y-3">
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span>⚙️</span>
                <span>Antigravity IDE 自動実行推奨設定 (Configuration Guidance)</span>
              </h4>
              <span className="text-[11px] text-slate-400">※ IDEのセキュリティプロンプトと調和した安全設定</span>
            </div>

            <div className="space-y-2.5">
              {guidanceList.map((item, idx) => (
                <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{item.category}</span>
                    <h5 className="font-bold text-slate-100 text-xs font-mono">{item.titleJa}</h5>
                    <p className="text-[11px] text-slate-300">{item.rationaleJa}</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <span
                      className={`text-xs font-black px-2.5 py-1 rounded border ${
                        item.recommendedSetting === 'AUTO_APPROVE'
                          ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          : item.recommendedSetting === 'REQUIRE_PROMPT'
                          ? 'bg-amber-950 text-amber-300 border-amber-800'
                          : 'bg-rose-950 text-rose-300 border-rose-800'
                      }`}
                    >
                      {item.recommendedSettingLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 登録ポリシー一覧 (Spec #13) */}
      {activeTab === 'policies' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📜</span>
              <span>承認済み自動化ポリシー一覧 (Active Automation Policies)</span>
            </h4>
            <span className="text-xs text-slate-400">{policies.length} 件登録</span>
          </div>

          <div className="space-y-2">
            {policies.map((p) => (
              <div key={p.policyId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex justify-between items-center gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-bold text-cyan-300 font-mono">{p.actionPattern}</code>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded ${
                        p.decision === 'ALLOW'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : p.decision === 'BLOCK'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}
                    >
                      {p.decision}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">{p.recheckRule}</p>
                  <div className="text-[10px] text-slate-400">
                    承認者: <span className="text-slate-200">{p.approvedBy}</span> | 承認日: {p.approvalDate} | バージョン: {p.policyVersion}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                      p.isActive ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                    onClick={() => handleTogglePolicy(p.policyId)}
                  >
                    {p.isActive ? '有効' : '無効'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: 監査ログ (Spec #16) */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <h4 className="font-bold text-cyan-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <span>📋</span>
            <span>Safe Automation 承認・実行監査証跡 (Audit Trail)</span>
          </h4>

          <div className="space-y-2">
            {auditLogs.slice(0, 15).map((entry) => (
              <div key={entry.id} className="p-2.5 bg-slate-950 rounded border border-slate-800 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-400 font-mono text-[11px]">{entry.timestamp.split('T')[1]?.slice(0, 8)}</span>
                  <span className="ml-2 font-bold text-slate-100">{entry.businessNameJa}</span>
                  <code className="ml-2 text-cyan-400 font-mono text-[11px]">({entry.actionSignature})</code>
                  <p className="text-slate-300 text-[11px] mt-0.5">{entry.detailsJa}</p>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    entry.executedBy === 'AUTO_ENGINE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : entry.executedBy === 'BLOCKED'
                      ? 'bg-rose-950 text-rose-300 border border-rose-800'
                      : 'bg-amber-950 text-amber-300 border border-amber-800'
                  }`}
                >
                  {entry.executedBy}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
