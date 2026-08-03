import React from 'react';
import { TransferSession } from '../../types/zonosCustoms';

interface ResumeTransferModalProps {
  session: TransferSession | null;
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export const ResumeTransferModal: React.FC<ResumeTransferModalProps> = ({
  session,
  isOpen,
  onResume,
  onRestart,
  onDismiss
}) => {
  if (!isOpen || !session) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card resume-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🔄</span>
            <div>
              <h3 className="modal-title-ja">中断された転記セッションの検出</h3>
              <p className="modal-title-en text-muted">Interrupted Transfer Session Detected</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onDismiss} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-info-banner">
            <p>
              ⏸️ <strong>前回の転記データ:</strong> 注文番号 <strong>{session.orderId}</strong> の転記作業が途中で中断されています。続きから再開しますか？
            </p>
          </div>

          <div className="order-summary-box grid-2col margin-bottom-md">
            <div>
              <span className="text-xs text-muted block">注文番号 / Order ID</span>
              <strong className="font-mono text-base">{session.orderId}</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">転記状況 / Status</span>
              <strong className="text-highlight">
                品目 #{session.currentItemIndex + 1} ({session.completedItemsCount} / {session.totalItemsCount} 完了)
              </strong>
            </div>

            <div>
              <span className="text-xs text-muted block">中断日時 / Interrupted At</span>
              <span className="text-muted text-xs">{session.interruptedAt || session.startedAt}</span>
            </div>

            <div>
              <span className="text-xs text-muted block">転記方式 / Transfer Mode</span>
              <span className="font-semibold">{session.transferMode === 'clipboard' ? '📋 クリップボード方式' : '🌐 ブラウザ支援'}</span>
            </div>
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onDismiss}>
            転記履歴だけ残して終了
          </button>
          <div className="action-btn-group">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (window.confirm('最初からやり直しますか？ 現在の進捗状況はリセットされます。')) {
                  onRestart();
                }
              }}
            >
              最初からやり直す
            </button>
            <button type="button" className="btn-primary" onClick={onResume}>
              ▶️ 続きから再開
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
