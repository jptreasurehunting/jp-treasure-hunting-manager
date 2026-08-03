import React, { useState } from 'react';
import { ZonosCustomsDeclaration, ZonosCustomsItem } from '../../types/zonosCustoms';
import { formatZonosCustomsDescription } from '../../utils/zonosCustomsValidation';
import { downloadTemporaryImage } from '../../services/zonosTransferService';

interface TransferWizardModalProps {
  declaration: ZonosCustomsDeclaration;
  isOpen: boolean;
  onCompleteItem: (itemIndex: number) => void;
  onFinishAll: (zonosConfirmationNo?: string) => void;
  onInterrupt: () => void;
}

export const TransferWizardModal: React.FC<TransferWizardModalProps> = ({
  declaration,
  isOpen,
  onCompleteItem,
  onFinishAll,
  onInterrupt
}) => {
  const [currentItemIdx, setCurrentItemIdx] = useState<number>(0);
  const [copiedToast, setCopiedToast] = useState<string | null>(null);
  const [zonosConfirmationNo, setZonosConfirmationNo] = useState<string>('');

  // Field check-off state per item
  const [checkedFields, setCheckedFields] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  const totalItems = declaration.items.length;
  const currentItem: ZonosCustomsItem = declaration.items[currentItemIdx] || declaration.items[0];
  const customsDesc = formatZonosCustomsDescription(currentItem.material, currentItem.productType);

  const handleCopyText = (label: string, text: string, fieldKey: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToast(`✓ ${label} (${text}) をコピーしました`);
    setTimeout(() => setCopiedToast(null), 2500);

    // Auto mark field check
    setCheckedFields((prev) => ({
      ...prev,
      [`${currentItemIdx}_${fieldKey}`]: true
    }));
  };

  const toggleCheckField = (fieldKey: string) => {
    const key = `${currentItemIdx}_${fieldKey}`;
    setCheckedFields((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDownloadImage = async () => {
    if (!currentItem.imageUrl) {
      alert('画像URLが設定されていません。');
      return;
    }
    const success = await downloadTemporaryImage(
      currentItem.imageUrl,
      `zonos_item_${currentItemIdx + 1}_${currentItem.itemId || 'photo'}.jpg`
    );
    if (success) {
      setCopiedToast('✓ 商品画像を一時保存しました (ドラッグ＆ドロップ可能)');
      setTimeout(() => setCopiedToast(null), 3000);
    }
  };

  // Check if current item required fields are all checked off
  const isDescChecked = !!checkedFields[`${currentItemIdx}_desc`];
  const isQtyChecked = !!checkedFields[`${currentItemIdx}_qty`];
  const isValueChecked = !!checkedFields[`${currentItemIdx}_value`];
  const isOriginChecked = !!checkedFields[`${currentItemIdx}_origin`];

  const isCurrentItemReady = isDescChecked && isQtyChecked && isValueChecked && isOriginChecked;

  const handleNextItem = () => {
    onCompleteItem(currentItemIdx);
    if (currentItemIdx + 1 < totalItems) {
      setCurrentItemIdx(currentItemIdx + 1);
    } else {
      // Last item finished
      onFinishAll(zonosConfirmationNo);
    }
  };

  const handlePrevItem = () => {
    if (currentItemIdx > 0) {
      setCurrentItemIdx(currentItemIdx - 1);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card transfer-wizard-modal-card">
        <div className="modal-header space-between">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🚀</span>
            <div>
              <h3 className="modal-title-ja">Zonos Prepay 転記ウィザード</h3>
              <p className="modal-title-en text-muted">
                品目 #{currentItemIdx + 1} / 全 {totalItems} 品目
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onInterrupt} aria-label="中断">&times;</button>
        </div>

        <div className="modal-body">
          {/* Progress Bar */}
          <div className="wizard-progress-bar margin-bottom-md">
            <div
              className="progress-fill"
              style={{ width: `${((currentItemIdx + 1) / totalItems) * 100}%` }}
            ></div>
          </div>

          {copiedToast && (
            <div className="toast-notification margin-bottom-xs">
              <span>{copiedToast}</span>
            </div>
          )}

          {/* Current Item Header Info */}
          <div className="wizard-item-header card-sub-box space-between">
            <div className="wizard-item-title-col">
              <span className="item-number-badge">品目 #{currentItemIdx + 1}</span>
              {currentItem.isSoldItem ? (
                <span className="tag-sold-item-badge">販売商品</span>
              ) : (
                <span className="tag-included-item-badge">同梱品</span>
              )}
              <strong className="text-sm block margin-top-xs">{currentItem.title || customsDesc}</strong>
            </div>

            {currentItem.imageUrl && (
              <div className="wizard-thumb-box">
                <img
                  src={currentItem.imageUrl}
                  alt={currentItem.title || 'Product'}
                  className="wizard-thumb"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src =
                      'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&auto=format&fit=crop&q=80';
                  }}
                />
              </div>
            )}
          </div>

          {/* 1-Click Copy Controls Checklist (Spec #3 & #6) */}
          <div className="wizard-checklist-container margin-top-md">
            <h4 className="sub-table-title font-semibold text-sm margin-bottom-xs">
              📋 Zonos Prepay 入力チェックリスト (順序通りに入力・チェック)
            </h4>

            <div className="checklist-rows-group">
              {/* 1. Customs Description */}
              <div className={`checklist-row ${isDescChecked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  id={`chk_desc_${currentItemIdx}`}
                  checked={isDescChecked}
                  onChange={() => toggleCheckField('desc')}
                />
                <label htmlFor={`chk_desc_${currentItemIdx}`} className="field-label-text">
                  Customs Description: <strong className="text-highlight-gold">{customsDesc}</strong>
                </label>
                <button
                  type="button"
                  className="btn-pill-sm active"
                  onClick={() => handleCopyText('Customs Description', customsDesc, 'desc')}
                >
                  説明をコピー
                </button>
              </div>

              {/* 2. 材質 (Material) */}
              <div className="checklist-row">
                <span className="field-label-text">材質: <strong>{currentItem.material}</strong></span>
                <button
                  type="button"
                  className="btn-pill-sm"
                  onClick={() => handleCopyText('材質', currentItem.material, 'desc')}
                >
                  材質をコピー
                </button>
              </div>

              {/* 3. 商品種類 (Product Type) */}
              <div className="checklist-row">
                <span className="field-label-text">商品種類: <strong>{currentItem.productType}</strong></span>
                <button
                  type="button"
                  className="btn-pill-sm"
                  onClick={() => handleCopyText('商品種類', currentItem.productType, 'desc')}
                >
                  種類をコピー
                </button>
              </div>

              {/* 4. 数量 (Quantity) */}
              <div className={`checklist-row ${isQtyChecked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  id={`chk_qty_${currentItemIdx}`}
                  checked={isQtyChecked}
                  onChange={() => toggleCheckField('qty')}
                />
                <label htmlFor={`chk_qty_${currentItemIdx}`} className="field-label-text">
                  数量: <strong>{currentItem.quantity}</strong>
                </label>
                <button
                  type="button"
                  className="btn-pill-sm active"
                  onClick={() => handleCopyText('数量', currentItem.quantity.toString(), 'qty')}
                >
                  数量をコピー
                </button>
              </div>

              {/* 5. 申告価格 (Declared Value) */}
              <div className={`checklist-row ${isValueChecked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  id={`chk_val_${currentItemIdx}`}
                  checked={isValueChecked}
                  onChange={() => toggleCheckField('value')}
                />
                <label htmlFor={`chk_val_${currentItemIdx}`} className="field-label-text">
                  申告価格 ($): <strong className="text-highlight-gold">${currentItem.declaredValue.toFixed(2)}</strong>
                </label>
                <button
                  type="button"
                  className="btn-pill-sm active"
                  onClick={() => handleCopyText('申告価格', currentItem.declaredValue.toFixed(2), 'value')}
                >
                  価格をコピー
                </button>
              </div>

              {/* 6. 原産国 (Country of Origin) */}
              <div className={`checklist-row ${isOriginChecked ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  id={`chk_org_${currentItemIdx}`}
                  checked={isOriginChecked}
                  onChange={() => toggleCheckField('origin')}
                />
                <label htmlFor={`chk_org_${currentItemIdx}`} className="field-label-text">
                  原産国: <span className="country-badge">🇯🇵 {currentItem.countryOfOrigin || 'Japan'}</span>
                </label>
                <button
                  type="button"
                  className="btn-pill-sm active"
                  onClick={() => handleCopyText('原産国', currentItem.countryOfOrigin || 'Japan', 'origin')}
                >
                  原産国をコピー
                </button>
              </div>

              {/* 7. 重量 (Weight) */}
              <div className="checklist-row">
                <span className="field-label-text">単体重量: <strong className="font-mono">{currentItem.unitWeightGrams || 0} g</strong></span>
                <button
                  type="button"
                  className="btn-pill-sm"
                  onClick={() => handleCopyText('重量', (currentItem.unitWeightGrams || 0).toString(), 'weight')}
                >
                  重量(g)をコピー
                </button>
              </div>

              {/* Spec #7: Image Download / Upload */}
              {currentItem.imageUrl && (
                <div className="checklist-row">
                  <span className="field-label-text">商品画像: サムネイル一時保存</span>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleDownloadImage}
                  >
                    💾 画像を一時保存 (ドラッグ用)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Last Item Zonos Confirmation Number Input */}
          {currentItemIdx === totalItems - 1 && (
            <div className="form-group margin-top-md card-sub-box">
              <label className="form-label font-bold text-xs">Zonos確認番号 (任意手入力)</label>
              <input
                type="text"
                className="form-control font-mono"
                placeholder="例: ZONOS-889977"
                value={zonosConfirmationNo}
                onChange={(e) => setZonosConfirmationNo(e.target.value)}
              />
              <p className="field-hint text-xs">※ Zonos Prepay完了画面に表示される確認番号を入力し記録できます。</p>
            </div>
          )}
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onInterrupt}>
            ⏸️ 転記を中断
          </button>

          <div className="action-btn-group">
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePrevItem}
              disabled={currentItemIdx === 0}
            >
              前へ
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleNextItem}
              disabled={!isCurrentItemReady}
            >
              {currentItemIdx === totalItems - 1 ? '🎉 全品目転記を完了' : 'この品目を完了し次へ ➔'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
