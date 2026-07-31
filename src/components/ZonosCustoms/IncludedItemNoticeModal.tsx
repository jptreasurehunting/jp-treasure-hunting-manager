import React from 'react';

interface IncludedItemNoticeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const IncludedItemNoticeModal: React.FC<IncludedItemNoticeModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card notice-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">⚠️</span>
            <div>
              <h3 className="modal-title-ja">同梱品についての注意</h3>
              <p className="modal-title-en text-muted">Included Item Notice</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          {/* Japanese Notice Section */}
          <div className="notice-section-ja card-sub-box">
            <h4 className="notice-sub-header">【日本語】</h4>
            <ul className="notice-bullet-list">
              <li>同梱品は、税関申告上の個人間の贈答品ではありません。</li>
              <li>商業貨物（Merchandise）の一部として申告してください。</li>
              <li>同梱品にも申告価格を設定してください。</li>
              <li>同梱品に設定した金額は、eBayの実際の取引金額を超えないよう、販売商品の申告価格から自動的に差し引かれます。</li>
            </ul>
          </div>

          {/* English Notice Section */}
          <div className="notice-section-en card-sub-box margin-top-md">
            <h4 className="notice-sub-header">【English】</h4>
            <ul className="notice-bullet-list text-secondary">
              <li>An included item is not declared as a personal gift for customs purposes.</li>
              <li>It must be declared as part of the merchandise shipment.</li>
              <li>A customs value must also be assigned to the included item.</li>
              <li>The value assigned to the included item will be automatically deducted from the declared value of the sold item so that the total does not exceed the actual eBay transaction value.</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            内容を確認して同梱品を追加
          </button>
        </div>
      </div>
    </div>
  );
};
