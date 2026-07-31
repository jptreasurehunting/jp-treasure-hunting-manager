import React from 'react';

interface UnlockConfirmModalProps {
  isOpen: boolean;
  onConfirmUnlock: () => void;
  onCancel: () => void;
}

export const UnlockConfirmModal: React.FC<UnlockConfirmModalProps> = ({
  isOpen,
  onConfirmUnlock,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card unlock-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🔓</span>
            <div>
              <h3 className="modal-title-ja">申告価格の確定を解除しますか？</h3>
              <p className="modal-title-en text-muted">Unlock this customs declaration?</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          {/* Japanese Text */}
          <div className="notice-section-ja card-sub-box">
            <h4 className="notice-sub-header">【日本語】</h4>
            <p className="notice-text">
              確定を解除すると、Zonosへコピーする前の申告内容（材質、商品種類、数量、申告価格）を再編集できるようになります。
            </p>
            <p className="notice-text text-warning font-semibold margin-top-xs">
              ※ すでにZonosへコピー済みの場合は、Zonos側の入力内容と一致しなくなる可能性があります。
            </p>
          </div>

          {/* English Text */}
          <div className="notice-section-en card-sub-box margin-top-md">
            <h4 className="notice-sub-header">【English】</h4>
            <p className="notice-text text-secondary">
              Unlocking allows the declaration data to be edited.
            </p>
            <p className="notice-text text-warning font-semibold margin-top-xs">
              If the data has already been copied to Zonos, the application data may no longer match the data entered in Zonos.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="btn-danger" onClick={onConfirmUnlock}>
            確定を解除
          </button>
        </div>
      </div>
    </div>
  );
};
