import React, { useState } from 'react';
import {
  RuleChangeIntelligenceRecord,
  RemediationActionItem,
  DecisionReplaySnapshot
} from '../../types/safetyGate';
import {
  loadRuleIntelligenceRecords,
  saveRuleIntelligenceRecords
} from '../../services/ruleIntelligenceService';
import { generateRemediationChecklist } from '../../services/remediationPlannerService';
import {
  loadDecisionReplaySnapshots
} from '../../services/decisionReplayService';
import { ProfitImpactSimulatorCard } from './ProfitImpactSimulatorCard';
import { DecisionReplayViewerModal } from './DecisionReplayViewerModal';

interface RuleIntelligenceDashboardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const RuleIntelligenceDashboard: React.FC<RuleIntelligenceDashboardProps> = ({ onAddAuditLog }) => {
  const [records, setRecords] = useState<RuleChangeIntelligenceRecord[]>(loadRuleIntelligenceRecords());
  const [selectedRecordId, setSelectedRecordId] = useState<string>(records[0]?.id || '');
  const [replayModalOpen, setReplayModalOpen] = useState<boolean>(false);
  const [selectedReplaySnapshot, setSelectedReplaySnapshot] = useState<DecisionReplaySnapshot | null>(null);

  const activeRecord = records.find((r) => r.id === selectedRecordId) || records[0];
  const activeChecklist: RemediationActionItem[] = activeRecord ? generateRemediationChecklist(activeRecord) : [];
  const replaySnapshots = loadDecisionReplaySnapshots();

  const handleOpenReplay = () => {
    setSelectedReplaySnapshot(replaySnapshots[0]);
    setReplayModalOpen(true);
  };

  const handleExecuteSafeLocalAutomation = (item: RemediationActionItem) => {
    if (item.safetyClass !== 'SAFE_LOCAL_AUTOMATION') {
      alert('このアクションは利用者の明示的な承認が必要です。');
      return;
    }

    if (onAddAuditLog) {
      onAddAuditLog(
        `Safe Local Automation Executed: ${item.actionName}`,
        'Action Status: Pending',
        `Result: ${item.expectedResult}`
      );
    }

    alert(`ローカル自動処理を安全に実行しました:\n${item.expectedResult}`);
  };

  return (
    <div className="card rule-intelligence-dashboard space-y-6">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">🔍 ルール変更インテリジェンス & 自動修復計画 (Phase 2.5)</h3>
          <p className="card-subtitle text-xs text-muted">
            VeRO知財、法規制、関税、運賃改定の変更理由を自動要因解析(Cause Analysis)し、安全な修復計画とリプレイ比較を提供します。
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={handleOpenReplay}>
            🔄 判定リプレイ比較 (Decision Replay)
          </button>
        </div>
      </div>

      <div className="card-body space-y-4 text-xs">
        {/* Record Selector Pills */}
        <div className="space-y-1">
          <label className="form-label font-bold">検出された変更イベント (Detected Change Events)</label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {records.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`country-select-pill ${r.id === activeRecord?.id ? 'active' : ''}`}
                onClick={() => setSelectedRecordId(r.id)}
              >
                <div className="flex items-center gap-1">
                  <span>{r.severity === 'HIGH' || r.severity === 'CRITICAL' ? '🔴' : '🟡'}</span>
                  <span className="font-bold">{r.title}</span>
                </div>
                <div className="text-xs text-muted font-mono">{r.category} | Freshness: {r.sourceFreshness}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Record Cause & Impact Analysis Panel */}
        {activeRecord && (
          <div className="grid-2col gap-4">
            {/* Left: Cause Analysis Panel */}
            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-2">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-highlight text-xs">1. 要因自動解析 (Cause Analysis)</h4>
                <span className={activeRecord.causeAnalysis.isCauseConfirmed ? 'status-badge status-connected' : 'status-badge status-unconnected'}>
                  {activeRecord.causeAnalysis.isCauseConfirmed ? '🟢 原因確定' : '🔴 CAUSE_UNCONFIRMED'}
                </span>
              </div>

              <div className="space-y-1 text-xs">
                <div>
                  <span className="text-muted font-bold">主要因 (Primary Cause): </span>
                  <strong className="text-slate-200">{activeRecord.causeAnalysis.primaryCause}</strong>
                </div>

                {activeRecord.causeAnalysis.contributingCauses.length > 0 && (
                  <div>
                    <span className="text-muted font-bold">寄与要因: </span>
                    <span className="text-slate-300">{activeRecord.causeAnalysis.contributingCauses.join(', ')}</span>
                  </div>
                )}

                <div className="p-2 bg-slate-950 rounded space-y-1 mt-2">
                  <div className="text-muted font-bold">過去と現在の変化理由:</div>
                  <div className="text-slate-300">{activeRecord.causeAnalysis.whyCurrentChanged}</div>
                </div>

                <div className="flex justify-between text-muted pt-1">
                  <span>ソース: {activeRecord.sourceName}</span>
                  <span>発効日: {activeRecord.effectiveDate}</span>
                </div>
              </div>
            </div>

            {/* Right: Impact Analysis Panel */}
            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-2">
              <h4 className="font-bold text-highlight text-xs">2. 影響分析 (Impact Analysis)</h4>
              <div className="grid-2col gap-2 font-mono">
                <div className="p-2 bg-slate-950 rounded">
                  <span className="text-muted text-xs block">影響出品数</span>
                  <strong className="text-base text-amber-400">{activeRecord.affectedActiveListingsCount} 件</strong>
                </div>
                <div className="p-2 bg-slate-950 rounded">
                  <span className="text-muted text-xs block">発送待ち注文数</span>
                  <strong className="text-base text-danger">{activeRecord.affectedOrdersAwaitingShipmentCount} 件</strong>
                </div>
                <div className="p-2 bg-slate-950 rounded">
                  <span className="text-muted text-xs block">予想売上影響</span>
                  <strong className="text-base text-danger">${activeRecord.estimatedRevenueImpactUsd}</strong>
                </div>
                <div className="p-2 bg-slate-950 rounded">
                  <span className="text-muted text-xs block">予想純利益影響</span>
                  <strong className="text-base text-danger">${activeRecord.estimatedProfitImpactUsd}</strong>
                </div>
              </div>

              <div className="text-xs text-slate-300">
                対象国: <span className="font-bold">{activeRecord.affectedDestinationCountries.join(', ')}</span>
                <span className="ml-3 text-muted">過去承認失効: {activeRecord.oldApprovalExpired ? '⚠️ 以前の承認は失効済み' : '有効'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Remediation Action Checklist */}
        {activeRecord && (
          <div className="space-y-2">
            <h4 className="font-bold text-highlight text-xs">3. 自動修復計画チェックリスト (Automated Remediation Plan)</h4>
            <div className="card-sub-box bg-slate-950 border-slate-800 space-y-2">
              {activeChecklist.map((act) => (
                <div key={act.id} className="flex justify-between items-center p-2 bg-slate-900 rounded border border-slate-800">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-200">{act.actionName}</strong>
                      {act.safetyClass === 'SAFE_LOCAL_AUTOMATION' ? (
                        <span className="status-badge status-connected">🟢 ローカル安全自動化</span>
                      ) : act.safetyClass === 'USER_APPROVAL_REQUIRED' ? (
                        <span className="status-badge status-prep">🟡 ユーザー承認要</span>
                      ) : (
                        <span className="status-badge status-unconnected">🔴 FORBIDDEN_AUTOMATION (絶対禁止)</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-xs">{act.whyRequired}</div>
                  </div>

                  <div>
                    {act.safetyClass === 'SAFE_LOCAL_AUTOMATION' && (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => handleExecuteSafeLocalAutomation(act)}
                      >
                        ⚡ ローカル自動実行
                      </button>
                    )}
                    {act.safetyClass === 'USER_APPROVAL_REQUIRED' && (
                      <span className="text-amber-400 font-semibold text-xs">要手動承認</span>
                    )}
                    {act.safetyClass === 'FORBIDDEN_AUTOMATION' && (
                      <span className="text-danger font-semibold text-xs">実行不可</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Embed Profit Impact Simulator */}
        <ProfitImpactSimulatorCard />
      </div>

      {/* Decision Replay Viewer Modal */}
      <DecisionReplayViewerModal
        snapshot={selectedReplaySnapshot}
        isOpen={replayModalOpen}
        onClose={() => setReplayModalOpen(false)}
      />
    </div>
  );
};
