import React, { useState } from 'react';
import { ZonosCustomsItem } from '../../types/zonosCustoms';
import { formatZonosCustomsDescription } from '../../utils/zonosCustomsValidation';

interface ZonosReviewModalProps {
  items: ZonosCustomsItem[];
  isOpen: boolean;
  onClose: () => void;
  onConfirmCopy: () => void;
}

export const ZonosReviewModal: React.FC<ZonosReviewModalProps> = ({
  items,
  isOpen,
  onClose,
  onConfirmCopy
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const totalDeclaredValue = items.reduce((acc, curr) => acc + (curr.declaredValue * curr.quantity), 0);
  const totalQuantity = items.reduce((acc, curr) => acc + curr.quantity, 0);

  const handleCopyText = () => {
    // Generate clean customs export payload
    const exportLines = items.map((item, index) => {
      const desc = formatZonosCustomsDescription(item.material, item.productType);
      return `Item #${index + 1}: ${desc} | Qty: ${item.quantity} | Value: $${item.declaredValue.toFixed(2)} | Origin: ${item.countryOfOrigin || 'Japan'}`;
    });

    const fullExportText = [
      '=== Zonos Prepay Customs Declaration Summary (日本郵政海外便用) ===',
      ...exportLines,
      '--------------------------------------------------',
      `Total Items: ${items.length} | Total Qty: ${totalQuantity} | Total Value: $${totalDeclaredValue.toFixed(2)}`,
      'Country of Origin: Japan (All Items)',
      '※ 自動送信・自動決済は行われません。手動確認の上、Zonos画面に入力してください。'
    ].join('\n');

    navigator.clipboard.writeText(fullExportText).then(() => {
      setCopied(true);
      onConfirmCopy();
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card review-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🛡️</span>
            <h2 className="modal-title">Zonos Prepay 通関品目データ確認・出力</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-info-banner">
            <p>
              ⚠️ <strong>確認画面:</strong> 下記の品目データを確認してください。自動入力や自動支払いは一切行われません。
            </p>
          </div>

          <table className="modal-details-table">
            <thead>
              <tr>
                <th>品目 (#)</th>
                <th>Customs Description</th>
                <th>数量</th>
                <th>申告単価 ($)</th>
                <th>小計 ($)</th>
                <th>原産国</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td><strong>#{index + 1}</strong></td>
                  <td>
                    <span className="font-semibold">{formatZonosCustomsDescription(item.material, item.productType)}</span>
                    {item.isIncludedItem && (
                      <small className="text-muted block">(※同梱品 / Included Item)</small>
                    )}
                  </td>
                  <td>{item.quantity}</td>
                  <td>${item.declaredValue.toFixed(2)}</td>
                  <td>${(item.declaredValue * item.quantity).toFixed(2)}</td>
                  <td><span className="country-badge">🇯🇵 {item.countryOfOrigin || 'Japan'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="zonos-review-totals">
            <div className="review-total-row">
              <span>品目種類数: <strong>{items.length} 種類</strong></span>
              <span>総数量: <strong>{totalQuantity} 個</strong></span>
              <span>申告総額: <strong className="text-highlight-gold">${totalDeclaredValue.toFixed(2)} USD</strong></span>
            </div>
          </div>

          {copied && (
            <div className="copy-success-banner">
              ✓ 通関申告データをクリップボードにコピーしました！
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>閉じる</button>
          <button type="button" className="btn-primary" onClick={handleCopyText}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            通関データをコピーする
          </button>
        </div>
      </div>
    </div>
  );
};
