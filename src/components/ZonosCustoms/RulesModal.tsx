import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card rules-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">📜</span>
            <div>
              <h3 className="modal-title-ja">申告ルール</h3>
              <p className="modal-title-en text-muted">Declaration Rules</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          {/* Japanese Rules */}
          <div className="rules-section-ja card-sub-box">
            <h4 className="notice-sub-header">【日本語】</h4>
            <ul className="notice-bullet-list">
              <li>eBayで販売した荷物は商業貨物（Merchandise）として扱います。</li>
              <li>同梱品を個人間のGiftとして申告しません。</li>
              <li>同梱品も商品明細として申告します。</li>
              <li>同梱品にも0より大きい申告価格を設定します。</li>
              <li>同梱品の申告価格は、eBay取引金額を超えないよう販売商品の申告価格から配分します。</li>
              <li>申告価格合計をeBayの実際の取引金額と一致させます。</li>
              <li>Zonosへコピーした後は、Zonos側で内容を変更しません。</li>
              <li>本アプリはZonosへの自動送信や自動支払いを行いません。</li>
            </ul>
          </div>

          {/* English Rules */}
          <div className="rules-section-en card-sub-box margin-top-md">
            <h4 className="notice-sub-header">【English】</h4>
            <ul className="notice-bullet-list text-secondary">
              <li>An eBay sale shipment is treated as merchandise.</li>
              <li>An included item is not declared as a personal Gift.</li>
              <li>An included item is declared as a separate merchandise line item.</li>
              <li>Each included item must have a declared value greater than zero.</li>
              <li>The included item value is allocated from the sold item value so the total does not exceed the actual eBay transaction value.</li>
              <li>The total declared value must match the actual eBay transaction value.</li>
              <li>After copying the data, do not change the values in Zonos.</li>
              <li>This application does not automatically submit data or make payments to Zonos.</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
