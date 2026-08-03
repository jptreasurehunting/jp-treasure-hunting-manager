import React from 'react';
import { ZonosCustomsDeclaration, CustomsValidationStatus } from '../../types/zonosCustoms';
import { formatZonosCustomsDescription } from '../../utils/zonosCustomsValidation';
import { formatWeightDisplay } from '../../utils/zonosWeightUtils';

interface TransferCheckModalProps {
  declaration: ZonosCustomsDeclaration;
  status: CustomsValidationStatus;
  isOpen: boolean;
  onStartTransfer: () => void;
  onEditDeclaration: () => void;
  onCancel: () => void;
}

export const TransferCheckModal: React.FC<TransferCheckModalProps> = ({
  declaration,
  status,
  isOpen,
  onStartTransfer,
  onEditDeclaration,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card transfer-check-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🛡️</span>
            <div>
              <h3 className="modal-title-ja">Zonos Prepay 転記内容の確認</h3>
              <p className="modal-title-en text-muted">Zonos Prepay Declaration Transfer Confirmation</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-info-banner">
            <p>
              ⚠️ <strong>確認要請:</strong> Zonos Prepay入力支援を開始する前に、下記の転記対象データを確認してください。完全自動支払いや送信は行われません。
            </p>
          </div>

          {/* Transfer Summary Metadata */}
          <div className="order-summary-box grid-2col margin-bottom-md">
            <div>
              <span className="text-xs text-muted block">注文番号 / Order ID</span>
              <strong className="font-mono text-base">{declaration.orderId}</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">発送先国 / Destination</span>
              <strong className="text-highlight text-base">{declaration.destinationCountry}</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">配送方法 / Shipping Method</span>
              <strong className="text-base">{declaration.shippingMethod}</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">梱包後総重量 / Total Packaged Weight</span>
              <strong className="text-highlight-gold font-mono text-base">
                {formatWeightDisplay(declaration.totalPackagedWeightGrams)}
              </strong>
            </div>
          </div>

          {/* Line Items Table */}
          <h4 className="sub-table-title font-semibold margin-bottom-xs">
            転記品目一覧 ({declaration.items.length}件の品目)
          </h4>

          <table className="modal-details-table margin-bottom-md">
            <thead>
              <tr>
                <th>品目 (#)</th>
                <th>Customs Description</th>
                <th>材質</th>
                <th>種類</th>
                <th>数量</th>
                <th>申告単価 ($)</th>
                <th>小計 ($)</th>
                <th>原産国</th>
                <th>重量</th>
              </tr>
            </thead>
            <tbody>
              {declaration.items.map((item, idx) => (
                <tr key={item.id}>
                  <td><strong>#{idx + 1}</strong></td>
                  <td>
                    <strong className="text-highlight-gold">
                      {formatZonosCustomsDescription(item.material, item.productType)}
                    </strong>
                  </td>
                  <td>{item.material}</td>
                  <td>{item.productType}</td>
                  <td>{item.quantity}</td>
                  <td>${item.declaredValue.toFixed(2)}</td>
                  <td>${(item.declaredValue * item.quantity).toFixed(2)}</td>
                  <td><span className="country-badge">🇯🇵 {item.countryOfOrigin || 'Japan'}</span></td>
                  <td className="font-mono text-xs">{item.unitWeightGrams || 0}g</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals Balance Check */}
          <div className="zonos-review-totals card-sub-box">
            <div className="review-total-row">
              <span>申告価格合計: <strong className="text-highlight-gold">${status.totalDeclaredValue.toFixed(2)} USD</strong></span>
              <span>eBay取引金額: <strong>${declaration.ebayTransactionValue.toFixed(2)} USD</strong></span>
              <span>差額: <strong className={status.differenceCents === 0 ? 'text-success' : 'text-danger'}>${status.difference.toFixed(2)} USD</strong></span>
            </div>
          </div>

          {status.differenceCents !== 0 && (
            <div className="validation-error-item margin-top-xs">
              ❌ 申告価格合計とeBay取引金額が一致していないため、転記を開始できません。
            </div>
          )}
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <div className="action-btn-group">
            <button type="button" className="btn-secondary" onClick={onEditDeclaration}>
              申告内容を修正
            </button>
            <button
              type="button"
              className="btn-primary btn-lg"
              onClick={onStartTransfer}
              disabled={status.differenceCents !== 0}
            >
              🚀 転記を開始
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
