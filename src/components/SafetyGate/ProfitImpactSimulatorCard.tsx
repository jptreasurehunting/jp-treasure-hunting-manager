import React, { useState } from 'react';
import { ProfitSimulationScenario } from '../../types/safetyGate';
import { runProfitImpactSimulation } from '../../services/profitSimulatorService';

export const ProfitImpactSimulatorCard: React.FC = () => {
  const [scenarios] = useState<ProfitSimulationScenario[]>(runProfitImpactSimulation());

  return (
    <div className="card profit-impact-simulator-card space-y-4">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">⚖️ 利益影響シミュレーター (Profit Impact Simulator)</h3>
          <p className="card-subtitle text-xs text-muted">
            ルール変更・運賃値上げ・法規制強化に対し、複数の修復案(Scenario A/B/C)の収益・リスク影響を並列シミュレーション比較します。
          </p>
        </div>
        <span className="baseline-badge">Phase 2.5 モジュール</span>
      </div>

      <div className="card-body space-y-3 text-xs">
        <div className="card-sub-box border-amber-500/30 bg-amber-500/10 text-xs">
          ⚠️ <strong>安全原則:</strong> 利益シミュレーション結果がプラスであっても、知財・真贋・輸入禁止などの必須コンプライアンスブロックを解除することは一切できません。
        </div>

        <div className="grid-3col gap-3">
          {scenarios.map((s) => (
            <div key={s.id} className="card-sub-box bg-slate-950 border-slate-800 space-y-2 flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-highlight text-xs">{s.scenarioName}</h4>
                <p className="text-slate-300 mt-1">{s.proposedAction}</p>

                <div className="my-2 p-2 bg-slate-900 rounded space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted">売上変化: </span>
                    <strong className={s.revenueChangeUsd >= 0 ? 'text-emerald-400' : 'text-danger'}>
                      {s.revenueChangeUsd >= 0 ? `+$${s.revenueChangeUsd}` : `-$${Math.abs(s.revenueChangeUsd)}`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">純利益変化: </span>
                    <strong className={s.profitChangeUsd >= 0 ? 'text-emerald-400' : 'text-danger'}>
                      {s.profitChangeUsd >= 0 ? `+$${s.profitChangeUsd}` : `-$${Math.abs(s.profitChangeUsd)}`}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">利益率変化: </span>
                    <strong className={s.marginChangePct >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {s.marginChangePct >= 0 ? `+${s.marginChangePct}%` : `${s.marginChangePct}%`}
                    </strong>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div><span className="text-muted">キャッシュフロー影響: </span><span className="text-slate-300">{s.cashFlowEffectText}</span></div>
                  <div><span className="text-muted">アカウントリスク影響: </span><span className="text-slate-300">{s.accountRiskEffectText}</span></div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800">
                {s.isSafetyBlockActive ? (
                  <span className="status-badge status-unconnected w-full text-center block">🔴 安全ブロック継続 (Fail Closed)</span>
                ) : (
                  <span className="status-badge status-connected w-full text-center block">🟢 適用可能シミュレーション</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
