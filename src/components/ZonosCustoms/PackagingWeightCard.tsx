import React from 'react';
import { getJapanPostRecommendations } from '../../services/japanPostRecommendationService';
import { formatWeightDisplay } from '../../utils/zonosWeightUtils';

interface PackagingWeightCardProps {
  totalItemsWeightGrams: number;
  packagingWeightGrams: number;
  totalPackagedWeightGrams: number;
  destinationCountry: string;
  selectedShippingMethod: string;
  isLocked: boolean;
  onPackagingWeightChange: (grams: number) => void;
  onSelectShippingMethod: (method: string) => void;
}

export const PackagingWeightCard: React.FC<PackagingWeightCardProps> = ({
  totalItemsWeightGrams,
  packagingWeightGrams,
  totalPackagedWeightGrams,
  destinationCountry,
  selectedShippingMethod,
  isLocked,
  onPackagingWeightChange,
  onSelectShippingMethod
}) => {
  const recommendations = getJapanPostRecommendations(destinationCountry, totalPackagedWeightGrams);

  return (
    <div className="card packaging-weight-card">
      <div className="card-header space-between">
        <h3 className="card-title text-base font-semibold">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            <line x1="7" y1="7" x2="7.01" y2="7"></line>
          </svg>
          梱包重量 & 配送方法候補 (Ver.1.3)
        </h3>
        <span className="baseline-badge font-mono">
          梱包後総重量: {formatWeightDisplay(totalPackagedWeightGrams)}
        </span>
      </div>

      <div className="card-body">
        {/* Weight Calculator Row (Spec #3) */}
        <div className="grid-3col weight-calc-grid">
          {/* 商品重量合計 */}
          <div className="form-group">
            <label className="form-label text-xs font-semibold">① 商品重量合計</label>
            <input
              type="text"
              className="form-control readonly-input font-mono font-bold"
              value={formatWeightDisplay(totalItemsWeightGrams)}
              disabled
              readOnly
            />
            <p className="field-hint">※ 全品目の重量小計の合計額</p>
          </div>

          {/* 梱包材重量 */}
          <div className="form-group">
            <label className="form-label text-xs font-semibold">② 梱包材重量 (ダンボール・緩衝材)</label>
            <div className="input-with-unit">
              <input
                type="number"
                min="0"
                step="10"
                className="form-control font-mono"
                placeholder="例: 200"
                value={packagingWeightGrams || ''}
                onChange={(e) => onPackagingWeightChange(parseInt(e.target.value, 10) || 0)}
                disabled={isLocked}
                readOnly={isLocked}
              />
              <span className="unit-addon">g</span>
            </div>
            <p className="field-hint">※ 手入力可能 (例: 200g)</p>
          </div>

          {/* 梱包後総重量 */}
          <div className="form-group">
            <label className="form-label text-xs font-semibold">③ 梱包後総重量 (① + ②)</label>
            <input
              type="text"
              className="form-control readonly-input font-mono font-bold text-highlight-gold"
              value={formatWeightDisplay(totalPackagedWeightGrams)}
              disabled
              readOnly
            />
            <p className="field-hint">※ 自動計算 (国際郵便料金の基準重量)</p>
          </div>
        </div>

        <div className="divider"></div>

        {/* Japan Post Recommendations (Spec #6) */}
        <div className="recommendations-box margin-top-xs">
          <h4 className="sub-table-title font-semibold text-sm margin-bottom-xs">
            📮 日本郵便 配送方法候補と提案理由 (自動判定)
          </h4>

          <div className="recommendation-list">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`recommendation-item-card ${selectedShippingMethod === rec.method ? 'active-recommendation' : ''}`}
              >
                <div className="rec-info-col">
                  <span className="rec-method-name font-bold text-sm">{rec.method}</span>
                  <p className="rec-reason-text text-xs text-muted">{rec.reason}</p>
                </div>

                {!isLocked && rec.isAvailable && rec.method !== 'Zonos Prepay 対象外' && rec.method !== 'その他の日本郵便国際サービス' && (
                  <button
                    type="button"
                    className={`btn-pill-sm ${selectedShippingMethod === rec.method ? 'active' : ''}`}
                    onClick={() => onSelectShippingMethod(rec.method)}
                  >
                    {selectedShippingMethod === rec.method ? '✓ 選択中' : 'この配送方法を選択'}
                  </button>
                )}
              </div>
            ))}
          </div>

          <p className="field-hint text-xs text-muted margin-top-xs">
            ※ 配送方法候補は重量・発送先国に基づく参考表示です。最終的な配送方法は「発送情報」で利用者が選択してください。
          </p>
        </div>
      </div>
    </div>
  );
};
