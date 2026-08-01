import React from 'react';

interface ShippingInfoCardProps {
  destinationCountry: string;
  shippingMethod: string;
  isLocked: boolean;
  onDestinationCountryChange: (val: string) => void;
  onShippingMethodChange: (val: string) => void;
}

export const JAPAN_POST_SHIPPING_METHODS = [
  { value: 'EMS', label: 'EMS (国際スピード郵便)' },
  { value: '国際小包 航空便', label: '国際小包 航空便' },
  { value: '国際小包 船便', label: '国際小包 船便' },
  { value: '小形包装物 航空便', label: '小形包装物 航空便' },
  { value: '小形包装物 船便', label: '小形包装物 船便' },
  { value: 'その他の日本郵便国際サービス', label: 'その他の日本郵便国際サービス' }
];

export const COMMON_DESTINATION_COUNTRIES = [
  { value: 'United States (US)', label: '🇺🇸 United States (US)' },
  { value: 'United Kingdom (GB)', label: '🇬🇧 United Kingdom (GB)' },
  { value: 'Australia (AU)', label: '🇦🇺 Australia (AU)' },
  { value: 'Canada (CA)', label: '🇨🇦 Canada (CA)' },
  { value: 'Germany (DE)', label: '🇩🇪 Germany (DE)' },
  { value: 'France (FR)', label: '🇫🇷 France (FR)' },
  { value: 'Japan', label: '🇯🇵 Japan (日本 - 国内発送テスト用)' }
];

export const ShippingInfoCard: React.FC<ShippingInfoCardProps> = ({
  destinationCountry,
  shippingMethod,
  isLocked,
  onDestinationCountryChange,
  onShippingMethodChange
}) => {
  return (
    <div className="card shipping-info-card">
      <div className="card-header space-between">
        <h3 className="card-title text-base font-semibold">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
          発送情報 (日本郵便・海外発送)
        </h3>
        <span className="baseline-badge">carrier: JAPAN_POST / origin: JP</span>
      </div>

      <div className="card-body grid-2col">
        {/* 配送会社 */}
        <div className="form-group">
          <label className="form-label font-bold">配送会社</label>
          <input
            type="text"
            className="form-control readonly-input"
            value="日本郵便 (固定)"
            disabled
            readOnly
          />
          <p className="field-hint">※ Ver.1.1は日本郵便による海外発送専用です。</p>
        </div>

        {/* 発送元国 */}
        <div className="form-group">
          <label className="form-label font-bold">発送元国</label>
          <input
            type="text"
            className="form-control readonly-input"
            value="日本 (固定)"
            disabled
            readOnly
          />
          <p className="field-hint">※ 内部値: originCountry = "JP"</p>
        </div>

        {/* 発送先国 */}
        <div className="form-group">
          <label className="form-label font-bold">発送先国</label>
          <input
            type="text"
            className="form-control margin-bottom-xs"
            placeholder="例: United States (US)"
            value={destinationCountry}
            onChange={(e) => onDestinationCountryChange(e.target.value)}
            disabled={isLocked}
            readOnly={isLocked}
          />
          {!isLocked && (
            <div className="quick-select-pills">
              <span className="pill-label text-xs text-muted">クイック選択:</span>
              {COMMON_DESTINATION_COUNTRIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={`btn-pill-sm ${destinationCountry === c.value ? 'active' : ''}`}
                  onClick={() => onDestinationCountryChange(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 配送方法 */}
        <div className="form-group">
          <label className="form-label font-bold">配送方法</label>
          <select
            className="form-control select-input"
            value={shippingMethod}
            onChange={(e) => onShippingMethodChange(e.target.value)}
            disabled={isLocked}
          >
            <option value="">-- 配送方法を選択してください --</option>
            {JAPAN_POST_SHIPPING_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="field-hint">※ 日本郵便の国際配送サービスを選択してください。</p>
        </div>
      </div>
    </div>
  );
};
