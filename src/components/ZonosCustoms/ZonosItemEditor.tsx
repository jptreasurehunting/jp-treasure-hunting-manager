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

        {/* 原産国 (初期値: Japan / 日本) */}
        <div className="form-group">
          <label className="form-label font-bold">原産国</label>
          <input
            type="text"
            className="form-control readonly-input"
            value={item.countryOfOrigin || 'Japan'}
            disabled
            readOnly
          />
          <p className="field-hint">※ Zonosコピー値: Japan (固定)</p>
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
