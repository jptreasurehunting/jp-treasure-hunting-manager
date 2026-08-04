import React from 'react';
import { SafetyGateResult } from '../../types/safetyGate';

interface ComplianceBlockingModalProps {
  gateResult: SafetyGateResult | null;
  isOpen: boolean;
  onRecheck: () => void;
  onClose: () => void;
}

export const ComplianceBlockingModal: React.FC<ComplianceBlockingModalProps> = ({
  gateResult,
  isOpen,
  onRecheck,
  onClose
}) => {
  if (!isOpen || !gateResult) return null;

  const isBlocked = gateResult.decision === 'BLOCKED';

  return (
    <div className="modal-overlay">
      <div className="modal-card compliance-blocking-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">{isBlocked ? '🛑' : '⚠️'}</span>
            <div>
              <h3 className={`modal-title-ja ${isBlocked ? 'text-danger' : 'text-amber-400'}`}>
                {isBlocked ? '操作が一時停止(ブロック)されました' : '警告項目が検出されました'}
              </h3>
              <p className="modal-title-en text-muted">
                {gateResult.actionNameJa} — Safety & Compliance Gate Decision
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body space-y-4">
          {/* Advisory Disclaimer Banner (Spec #1) */}
          <div className="legal-disclaimer-banner card-sub-box border-amber-500/30 bg-amber-500/10 text-xs">
            🛡️ <strong>案内告知:</strong> 「この機能は法令・販売・発送条件の確認を補助するものです。法令適合やeBayアカウント停止の完全な防止を保証するものではありません。」
          </div>

          {/* Blocked Action Details */}
          <div className="card-sub-box bg-slate-900 border-slate-700 text-xs space-y-1">
            <div>
              <span className="text-muted">対象操作: </span>
              <strong className="text-highlight">{gateResult.actionNameJa}</strong>
            </div>
            <div>
              <span className="text-muted">判定結果: </span>
              <strong className={isBlocked ? 'text-danger font-mono font-bold' : 'text-amber-400 font-mono font-bold'}>
                {gateResult.decision === 'BLOCKED' ? '🔴 BLOCKED (遮断)' : '🟡 ALLOWED_WITH_WARNING (警告付き許可)'}
              </strong>
            </div>
          </div>

          {/* Reasons List */}
          <div>
            <h4 className="font-bold text-xs text-muted margin-bottom-xs">検出された理由・不備事項</h4>
            <div className="card-sub-box bg-slate-950 border-red-500/30 text-xs space-y-1">
              {gateResult.reasons.map((r, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-danger shrink-0">・</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Missing Requirements List */}
          {gateResult.missingRequirements.length > 0 && (
            <div>
              <h4 className="font-bold text-xs text-muted margin-bottom-xs">不足している必須要件</h4>
              <ul className="text-xs space-y-1 text-slate-300 list-disc list-inside">
                {gateResult.missingRequirements.map((req, idx) => (
                  <li key={idx} className="text-amber-400">{req}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Resolution Steps */}
          {gateResult.requiredUserSteps.length > 0 && (
            <div className="card-sub-box bg-slate-900 border-slate-700 text-xs">
              <h4 className="font-bold text-xs text-emerald-400 margin-bottom-xs">必要な解消手続き</h4>
              <ol className="space-y-1 text-slate-300 list-decimal list-inside">
                {gateResult.requiredUserSteps.map((step, idx) => (
                  <li key={idx}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onClose}>
            {isBlocked ? '閉じる (キャンセル)' : '確認して戻る'}
          </button>

          <button
            type="button"
            className="btn-primary"
            onClick={onRecheck}
          >
            🔄 再検証を実行 (Recheck)
          </button>
        </div>
      </div>
    </div>
  );
};
