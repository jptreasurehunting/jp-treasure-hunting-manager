import React from 'react';
import { EbayOrderPayload } from '../../types/zonosCustoms';

interface ImportPreviewModalProps {
  payload: EbayOrderPayload | null;
  isOpen: boolean;
  onConfirm: () => void;
  onEditAndConfirm: () => void;
  onCancel: () => void;
}

export const ImportPreviewModal: React.FC<ImportPreviewModalProps> = ({
  payload,
  isOpen,
  onConfirm,
  onEditAndConfirm,
  onCancel
}) => {
  if (!isOpen || !payload) return null;

  const totalQuantity = payload.items.reduce((acc, i) => acc + i.quantity, 0);

  return (
    <div className="modal-overlay">
      <div className="modal-card import-preview-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">📦</span>
            <div>
              <h3 className="modal-title-ja">eBay注文データの取得プレビュー</h3>
              <p className="modal-title-en text-muted">eBay Order Import Preview</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-info-banner">
            <p>
              ✨ <strong>取得成功:</strong> 下記のeBay注文情報を取得しました。Zonos Customs画面へ反映する内容を確認してください。
            </p>
          </div>

          {/* Order Header Summary */}
          <div className="order-summary-box grid-2col margin-bottom-md">
            <div>
              <span className="text-xs text-muted block">注文番号 / Order ID</span>
              <strong className="font-mono text-base">{payload.orderId}</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">実取引金額 / eBay Transaction Value</span>
              <strong className="text-highlight-gold text-base">
                ${payload.ebayTransactionValue.toFixed(2)} {payload.currency}
              </strong>
            </div>

            <div>
              <span className="text-xs text-muted block">発送先国 / Destination</span>
              <span className="font-semibold">{payload.destinationCountry}</span>
            </div>

            <div>
              <span className="text-xs text-muted block">注文日時 / Order Date</span>
              <span className="text-muted text-xs">{payload.orderDate}</span>
            </div>
          </div>

          {/* Line Items List */}
          <h4 className="sub-table-title font-semibold margin-bottom-xs">
            取得品目一覧 ({payload.items.length}件の明細)
          </h4>

          <div className="preview-items-list">
            {payload.items.map((item, idx) => (
              <div key={idx} className="preview-item-card">
                <div className="preview-thumb-box">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="preview-thumb"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&auto=format&fit=crop&q=80';
                    }}
                  />
                </div>

                <div className="preview-info-body">
                  <div className="preview-item-meta text-xs">
                    <span className="text-highlight">Item ID: {item.itemId}</span>
                    <span>数量: <strong>{item.quantity}</strong></span>
                    <span className="badge-weight font-mono">
                      単体重量: {item.unitWeightGrams || 0}g ({item.weightUnit || 'g'}) | 小計: {(item.unitWeightGrams || 0) * item.quantity}g
                    </span>
                    <span className="text-muted">(取得元: {item.weightSource || '未取得'})</span>
                  </div>

                  <h5 className="preview-item-title font-semibold text-sm" title={item.title}>
                    {item.title}
                  </h5>

                  <div className="preview-derived-box text-xs">
                    <span>生成された候補 ➔ </span>
                    <span className="tag-derived-mat">材質: <strong>{item.derivedMaterial}</strong></span>
                    <span className="tag-derived-type">商品種類: <strong>{item.derivedProductType}</strong></span>
                    <span className="text-highlight-gold">Customs Description: <strong>{item.derivedMaterial} {item.derivedProductType}</strong></span>
                  </div>
                </div>

                <div className="preview-price-box">
                  <span className="text-xs text-muted">金額</span>
                  <strong className="text-success">${item.actualPrice.toFixed(2)}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <div className="action-btn-group">
            <button type="button" className="btn-secondary" onClick={onEditAndConfirm}>
              修正して取り込む
            </button>
            <button type="button" className="btn-primary" onClick={onConfirm}>
              この内容で取り込む
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
