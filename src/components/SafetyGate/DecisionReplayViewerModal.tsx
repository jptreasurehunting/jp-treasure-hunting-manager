import React from 'react';
import { DecisionReplaySnapshot } from '../../types/safetyGate';

interface DecisionReplayViewerModalProps {
  snapshot: DecisionReplaySnapshot | null;
  isOpen: boolean;
  onClose: () => void;
}

export const DecisionReplayViewerModal: React.FC<DecisionReplayViewerModalProps> = ({
  snapshot,
  isOpen,
  onClose
}) => {
  if (!isOpen || !snapshot) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card compliance-blocking-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🔄</span>
            <div>
              <h3 className="modal-title-ja">判定リプレイ & 過去比較ビューア (Decision Replay)</h3>
              <p className="modal-title-en text-muted">
                Snapshot ID: {snapshot.id} — Timestamp: {snapshot.timestamp}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body text-xs space-y-4">
          {/* Side by Side Comparison Grid */}
          <div className="grid-3col gap-3">
            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-1">
              <span className="text-muted block font-bold">1. 過去仕入れ時点の判定 (Original)</span>
              <strong className="text-emerald-400 font-bold block">{snapshot.originalResult}</strong>
              <div className="text-muted text-xs">Rule Version: {snapshot.ruleVersion}</div>
            </div>

            <div className="card-sub-box bg-slate-900 border-amber-500/40 space-y-1">
              <span className="text-muted block font-bold">2. 現行ルールによる再計算判定 (Current)</span>
              <strong className="text-danger font-bold block">{snapshot.currentRuleResult}</strong>
              <div className="text-muted text-xs">VeRO Status: {snapshot.veroIpStatus}</div>
            </div>

            <div className="card-sub-box bg-slate-900 border-blue-500/40 space-y-1">
              <span className="text-muted block font-bold">3. 実際の販売実績 (Actual Outcome)</span>
              <strong className="text-highlight font-bold block">{snapshot.actualOutcome || '未販売/処理中'}</strong>
              <div className="text-muted text-xs">Confidence: {snapshot.confidenceBand}</div>
            </div>
          </div>

          {/* Explanation Box */}
          <div className="card-sub-box bg-slate-950 border-slate-800 space-y-2">
            <h4 className="font-bold text-highlight">判定変化および要因の解説 (Explanation & Audit)</h4>
            <p className="text-slate-300">{snapshot.explanation}</p>

            <div className="grid-2col gap-2 pt-2 border-t border-slate-800 text-muted font-mono">
              <div>為替レート前提: ¥{snapshot.exchangeRate} / $</div>
              <div>送料前提: {snapshot.shippingRatesInfo}</div>
              <div>eBay手数料前提: {snapshot.ebayFeeAssumptions}</div>
              <div>Zonos前提: {snapshot.zonosAssumptions}</div>
            </div>
          </div>

          <div className="legal-disclaimer-banner card-sub-box border-slate-700 bg-slate-900 text-xs text-muted">
            🛡️ **不変性保証:** 過去の判定スナップショットは永久保存されており、ルール更新によって過去の記録が上書き消去されることはありません。
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
