import React from 'react';

interface CopySuccessModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onRecheck: () => void;
}

export const CopySuccessModal: React.FC<CopySuccessModalProps> = ({
  isOpen,
  onConfirm,
  onRecheck
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card copy-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">📋</span>
            <div>
              <h3 className="modal-title-ja">Zonosへコピー完了</h3>
              <p className="modal-title-en text-muted">Zonos Data Prepared</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onConfirm} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          {/* Japanese Text */}
          <div className="notice-section-ja card-sub-box">
            <h4 className="notice-sub-header">【日本語】</h4>
            <p className="notice-text">
              Zonosへコピーするデータを作成し、クリップボードにコピーしました。
            </p>
            <p className="notice-text font-semibold margin-top-xs">
              Zonos側では、申告価格、数量、材質、商品種類、原産国を変更せず、この内容と一致させてください。
            </p>
            <p className="notice-text text-muted margin-top-xs">
              ※ Zonosへの自動送信や支払いは行われていません。手動でZonos画面に貼り付けてください。
            </p>
          </div>

          {/* English Text */}
          <div className="notice-section-en card-sub-box margin-top-md">
            <h4 className="notice-sub-header">【English】</h4>
            <p className="notice-text text-secondary">
              The data for Zonos has been prepared and copied to clipboard.
            </p>
            <p className="notice-text text-secondary font-semibold margin-top-xs">
              Do not change the declared value, quantity, material, product type, or country of origin in Zonos. Keep the Zonos entry consistent with this declaration.
            </p>
            <p className="notice-text text-muted margin-top-xs">
              No automatic submission or payment has been made.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onRecheck}>
            コピー内容を再確認
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            確認しました
          </button>
        </div>
      </div>
    </div>
  );
};
