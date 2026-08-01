import React from 'react';
import { ZonosCustomsItem } from '../../types/zonosCustoms';
import { suggestMaterialAndProductType } from '../../utils/zonosCustomsValidation';

interface ZonosItemEditorProps {
  item: ZonosCustomsItem;
  itemNumber: number;
  isLocked: boolean;
  onUpdate: (updated: ZonosCustomsItem) => void;
  onDelete: (id: string) => void;
}

export const ZonosItemEditor: React.FC<ZonosItemEditorProps> = ({
  item,
  itemNumber,
  isLocked,
  onUpdate,
  onDelete
}) => {
  const handleMaterialChange = (material: string) => {
    if (isLocked) return;
    onUpdate({
      ...item,
      material
    });
  };

  const handleProductTypeChange = (productType: string) => {
    if (isLocked) return;
    onUpdate({
      ...item,
      productType
    });
  };

  const handleQuantityChange = (qtyVal: number) => {
    if (isLocked) return;
    const quantity = Math.max(1, qtyVal || 1);
    onUpdate({
      ...item,
      quantity
    });
  };

  const handleDeclaredValueChange = (valStr: string) => {
    if (isLocked) return;
    const dollars = parseFloat(valStr) || 0;
    const cents = Math.round(dollars * 100);
    onUpdate({
      ...item,
      declaredValue: dollars,
      declaredValueCents: cents
    });
  };

  const handleWeightChange = (valStr: string, unitStr: string) => {
    if (isLocked) return;
    const rawVal = parseFloat(valStr) || 0;
    const unit = (unitStr || item.weightUnit || 'g') as any;
    
    // Convert to grams
    let grams = rawVal;
    if (unit === 'kg') grams = Math.round(rawVal * 1000);
    else if (unit === 'oz') grams = Math.round(rawVal * 28.3495);
    else if (unit === 'lb') grams = Math.round(rawVal * 453.592);
    else grams = Math.round(rawVal);

    const subtotalG = grams * item.quantity;
    const kg = parseFloat((grams / 1000).toFixed(3));

    onUpdate({
      ...item,
      unitWeightGrams: grams,
      subtotalWeightGrams: subtotalG,
      weightKg: kg,
      weightUnit: unit,
      weightSource: '手入力',
      isEditedByUser: true
    });
  };

  // AI helper strictly for Material & Product Type (Spec #6)
  const handleAiSuggestMaterialAndType = () => {
    if (isLocked) return;
    const { material, productType } = suggestMaterialAndProductType(item.productType || item.material || '');
    onUpdate({
      ...item,
      material: material || item.material,
      productType: productType || item.productType
    });
  };

  return (
    <div className={`zonos-item-editor card ${isLocked ? 'item-locked' : ''}`}>
      <div className="card-header space-between">
        <div className="item-editor-title-group">
          <span className="item-number-badge">品目 #{itemNumber}</span>
          {item.isSoldItem ? (
            <span className="tag-sold-item-badge">販売商品 (主商品)</span>
          ) : (
            <span className="tag-included-item-badge">同梱品</span>
          )}
          {isLocked && <span className="locked-pill-badge">🔒 編集不可 (確定中)</span>}
        </div>

        {!isLocked && !item.isSoldItem && (
          <button
            type="button"
            className="btn-danger-icon"
            onClick={() => onDelete(item.id)}
            title="この同梱品を削除"
          >
            &times;
          </button>
        )}
      </div>

      <div className="card-body grid-editor-layout">
        {/* eBay Product Preview (If imported) */}
        {(item.title || item.imageUrl || item.itemId) && (
          <div className="grid-span-full ebay-item-banner card-sub-box">
            {item.imageUrl && (
              <div className="item-thumb-box">
                <img
                  src={item.imageUrl}
                  alt={item.title || 'Product Image'}
                  className="item-thumb"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&auto=format&fit=crop&q=80';
                  }}
                />
              </div>
            )}
            <div className="item-details-body">
              <div className="item-meta-row text-xs">
                {item.itemId && <span className="text-highlight">Item ID: {item.itemId}</span>}
                {item.weightKg && <span className="badge-weight font-mono">重量: {item.weightKg} kg</span>}
              </div>
              {item.title && <h5 className="item-full-title font-semibold text-sm">{item.title}</h5>}
            </div>
          </div>
        )}

        {/* 材質 */}
        <div className="form-group">
          <label className="form-label font-bold">材質</label>
          <input
            type="text"
            className="form-control"
            placeholder="例: PVC, Paper, Acrylic, Cotton"
            value={item.material}
            onChange={(e) => handleMaterialChange(e.target.value)}
            disabled={isLocked}
            readOnly={isLocked}
          />
        </div>

        {/* 商品種類 */}
        <div className="form-group">
          <div className="label-with-hint">
            <label className="form-label font-bold">商品種類</label>
            {!isLocked && (
              <button
                type="button"
                className="btn-ai-assist-sm"
                onClick={handleAiSuggestMaterialAndType}
                title="商品名から材質・種類候補をAI補完"
              >
                ✨ AI補助 (材質・種類)
              </button>
            )}
          </div>
          <input
            type="text"
            className="form-control"
            placeholder="例: Figure, Trading Card, Keychain"
            value={item.productType}
            onChange={(e) => handleProductTypeChange(e.target.value)}
            disabled={isLocked}
            readOnly={isLocked}
          />
        </div>

        {/* 数量 */}
        <div className="form-group">
          <label className="form-label font-bold">数量</label>
          <input
            type="number"
            className="form-control"
            min="1"
            value={item.quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
            disabled={isLocked}
            readOnly={isLocked}
          />
        </div>

        {/* 商品単体重量 & 重量小計 (Spec #2) */}
        <div className="form-group grid-span-full card-sub-box">
          <div className="label-with-hint">
            <label className="form-label font-bold text-xs">商品単体重量 & 重量小計</label>
            <span className="badge-weight-source font-mono text-xs">
              取得元: <strong>{item.weightSource || '未取得'}</strong>
              {item.isWeightEstimated && <span className="tag-estimated"> (※推定)</span>}
            </span>
          </div>

          <div className="weight-inputs-row grid-2col margin-top-xs">
            <div>
              <span className="text-xs text-muted block">単体重量 ({item.weightUnit || 'g'})</span>
              <div className="input-with-unit">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className="form-control font-mono"
                  placeholder="重量を入力"
                  value={
                    item.weightUnit === 'kg'
                      ? (item.unitWeightGrams / 1000) || ''
                      : item.unitWeightGrams || ''
                  }
                  onChange={(e) => handleWeightChange(e.target.value, item.weightUnit || 'g')}
                  disabled={isLocked}
                  readOnly={isLocked}
                />
                <select
                  className="unit-select"
                  value={item.weightUnit || 'g'}
                  onChange={(e) => handleWeightChange(
                    item.weightUnit === 'kg' ? (item.unitWeightGrams / 1000).toString() : item.unitWeightGrams.toString(),
                    e.target.value
                  )}
                  disabled={isLocked}
                >
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                </select>
              </div>
            </div>

            <div>
              <span className="text-xs text-muted block">重量小計 (単体重量 &times; {item.quantity})</span>
              <div className="form-control readonly-input font-mono font-bold text-highlight">
                {(item.unitWeightGrams * item.quantity)} g ({( (item.unitWeightGrams * item.quantity) / 1000 ).toFixed(2)} kg)
              </div>
            </div>
          </div>

          {(!item.unitWeightGrams || item.unitWeightGrams <= 0) && (
            <p className="weight-warning-text text-xs margin-top-xs text-danger font-semibold">
              ⚠️ 重量を自動取得できませんでした。実測値を入力してください。
            </p>
          )}
        </div>

        {/* 申告価格 */}
        <div className="form-group grid-span-full">
          <div className="label-with-hint">
            <label className="form-label font-bold">申告価格</label>
            {item.isSoldItem && (
              <span className="field-hint text-warning">
                💡 同梱品の申告価格に応じて自動再配分されます
              </span>
            )}
          </div>
          <div className="input-currency-wrapper">
            <span className="currency-symbol">$</span>
            <input
              type="number"
              className={`form-control currency-input ${item.isSoldItem ? 'readonly-input' : ''}`}
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={item.declaredValue ? item.declaredValue.toFixed(2) : ''}
              onChange={(e) => handleDeclaredValueChange(e.target.value)}
              disabled={isLocked || item.isSoldItem}
              readOnly={isLocked || item.isSoldItem}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
