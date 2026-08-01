import React, { useState } from 'react';
import { ShippingSnapshot } from '../../types/zonosCustoms';
import { formatZonosCustomsDescription } from '../../utils/zonosCustomsValidation';

interface ShippingRecordViewProps {
  snapshot: ShippingSnapshot;
  onUpdateTracking: (trackingNumber: string, shippingDate: string) => void;
}

export const ShippingRecordView: React.FC<ShippingRecordViewProps> = ({
  snapshot,
  onUpdateTracking
}) => {
  const [trackingNumber, setTrackingNumber] = useState<string>(snapshot.trackingNumber || '');
  const [shippingDate, setShippingDate] = useState<string>(snapshot.shippingDate || '');
  const [isSavedToast, setIsSavedToast] = useState<boolean>(false);

  const handleSaveTracking = () => {
    onUpdateTracking(trackingNumber, shippingDate);
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 3000);
  };

  return (
    <div className="card shipping-record-card">
      <div className="card-header space-between">
        <div className="title-with-badge">
          <h3 className="card-title text-lg font-bold">
            <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            発送記録 / Shipping Record (Ver.{snapshot.version})
          </h3>
          <span className="badge-locked-status">🔒 税関申告内容 固定・保護済み</span>
        </div>
        <span className="text-muted font-mono text-sm">ID: {snapshot.id}</span>
      </div>

      <div className="card-body">
        {/* Metadata Summary Grid (Spec #16 Bilingual Labels) */}
        <div className="shipping-meta-grid">
          <div className="meta-cell">
            <span className="cell-label">注文番号 / Order ID</span>
            <strong className="cell-value font-mono">{snapshot.orderId}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">eBay取引金額 / eBay Transaction Value</span>
            <strong className="cell-value">${snapshot.ebayTransactionValue.toFixed(2)} {snapshot.currency}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">申告価格合計 / Total Declared Value</span>
            <strong className="cell-value text-highlight-gold">${snapshot.totalDeclaredValue.toFixed(2)} {snapshot.currency}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">配送会社 / Carrier</span>
            <strong className="cell-value">{snapshot.carrier || '日本郵便 (JAPAN_POST)'}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">配送方法 / Shipping Method</span>
            <strong className="cell-value">{snapshot.shippingMethod || '未指定'}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">発送元国 / Origin Country</span>
            <strong className="cell-value">日本 ({snapshot.originCountry || 'JP'})</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">発送先国 / Destination Country</span>
            <strong className="cell-value text-highlight">{snapshot.destinationCountry || '未指定'}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">eBay Item ID / Item ID</span>
            <strong className="cell-value font-mono">{snapshot.ebayItemId || '-'}</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">商品タイトル / Item Title</span>
            <span className="cell-value text-xs font-semibold" title={snapshot.itemTitle}>{snapshot.itemTitle || '-'}</span>
          </div>

          <div className="meta-cell">
            <span className="cell-label">商品重量合計 / Total Items Weight</span>
            <strong className="cell-value font-mono">{snapshot.totalItemsWeightGrams || 0} g ({( (snapshot.totalItemsWeightGrams || 0) / 1000 ).toFixed(2)} kg)</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">梱包材重量 / Packaging Weight</span>
            <strong className="cell-value font-mono">{snapshot.packagingWeightGrams || 0} g</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">梱包後総重量 / Total Packaged Weight</span>
            <strong className="cell-value font-mono text-highlight-gold">{snapshot.totalPackagedWeightGrams || 0} g ({( (snapshot.totalPackagedWeightGrams || 0) / 1000 ).toFixed(2)} kg)</strong>
          </div>

          <div className="meta-cell">
            <span className="cell-label">重量取得元 / Weight Source</span>
            <span className="cell-value font-mono">{snapshot.weightSource || '未設定'}</span>
          </div>

          <div className="meta-cell">
            <span className="cell-label">作成日時 / Created At</span>
            <span className="cell-value text-muted">{snapshot.createdAt}</span>
          </div>

          <div className="meta-cell">
            <span className="cell-label">確定日時 / Confirmed At</span>
            <span className="cell-value text-muted">{snapshot.confirmedAt || '-'}</span>
          </div>

          <div className="meta-cell">
            <span className="cell-label">Zonosコピー日時 / Copied At</span>
            <span className="cell-value text-muted">{snapshot.copiedAt || '-'}</span>
          </div>

          <div className="meta-cell">
            <span className="cell-label">eBayデータ取込元 / Import Source</span>
            <span className="cell-value text-muted">{snapshot.importSource === 'live_api' ? '📡 Live API' : '⚡ モックデータ'} ({snapshot.importedAt || '-'})</span>
          </div>
        </div>

        {/* Read-Only Items Table */}
        <div className="shipping-items-table-wrapper margin-top-md">
          <h4 className="sub-table-title font-semibold">
            通関申告明細 / Customs Line Items
          </h4>
          <table className="modal-details-table">
            <thead>
              <tr>
                <th>材質 / Material</th>
                <th>商品種類 / Product Type</th>
                <th>Zonos表記 / Customs Description</th>
                <th>数量 / Qty</th>
                <th>原産国 / Origin</th>
                <th>申告価格 / Declared Value</th>
                <th>区分 / Type</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.material}</td>
                  <td>{item.productType}</td>
                  <td><strong className="font-mono text-primary">{formatZonosCustomsDescription(item.material, item.productType)}</strong></td>
                  <td>{item.quantity}</td>
                  <td><span className="country-badge">🇯🇵 {item.countryOfOrigin}</span></td>
                  <td><strong>${item.declaredValue.toFixed(2)}</strong></td>
                  <td>
                    {item.isIncludedItem ? (
                      <span className="tag-included-item">同梱品 / Included Item</span>
                    ) : (
                      <span className="tag-sold-item">販売商品 / Sold Item</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Editable Tracking & Shipping Date Section */}
        <div className="tracking-edit-box margin-top-md card-sub-box">
          <h4 className="sub-table-title font-semibold">
            追跡・発送情報編集 / Tracking & Shipping Info (追記可能)
          </h4>
          <div className="grid-2col margin-top-xs">
            <div className="form-group">
              <label className="form-label">追跡番号 / Tracking Number</label>
              <input
                type="text"
                className="form-control font-mono"
                placeholder="例: EN123456789JP"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">発送日 / Shipping Date</label>
              <input
                type="date"
                className="form-control"
                value={shippingDate}
                onChange={(e) => setShippingDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-end margin-top-sm">
            <button type="button" className="btn-secondary btn-sm" onClick={handleSaveTracking}>
              追跡・発送情報を保存
            </button>
          </div>

          {isSavedToast && (
            <div className="copy-success-banner margin-top-xs">
              ✓ 追跡番号・発送日を更新しました。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
