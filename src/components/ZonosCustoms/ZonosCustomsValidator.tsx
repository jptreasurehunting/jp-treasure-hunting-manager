import React, { useState, useMemo } from 'react';
import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  ShippingSnapshot,
  AuditLogEntry
} from '../../types/zonosCustoms';
import {
  reallocateDeclaredValues,
  validateDeclaration,
  formatZonosCustomsDescription
} from '../../utils/zonosCustomsValidation';
import { ZonosItemEditor } from './ZonosItemEditor';
import { ShippingInfoCard } from './ShippingInfoCard';
import { IncludedItemNoticeModal } from './IncludedItemNoticeModal';
import { RulesModal } from './RulesModal';
import { UnlockConfirmModal } from './UnlockConfirmModal';
import { CopySuccessModal } from './CopySuccessModal';
import { ShippingRecordView } from './ShippingRecordView';
import { AuditLogView } from './AuditLogView';

export const ZonosCustomsValidator: React.FC = () => {
  // Initial eBay Order Declaration State for Ver.1.1
  const [declaration, setDeclaration] = useState<ZonosCustomsDeclaration>({
    orderId: '14-12345-67890',
    ebayTransactionValueCents: 10000, // $100.00 USD
    ebayTransactionValue: 100.0,
    currency: 'USD',
    carrier: 'JAPAN_POST',
    originCountry: 'JP',
    destinationCountry: 'United States (US)',
    shippingMethod: '国際小包 船便',
    declarationLocked: false,
    items: [
      {
        id: 'sold-1',
        material: 'PVC',
        productType: 'Figure',
        quantity: 1,
        countryOfOrigin: 'Japan',
        declaredValueCents: 10000,
        declaredValue: 100.0,
        isIncludedItem: false,
        isSoldItem: true
      }
    ]
  });

  // Snapshot & Audit Log States
  const [shippingSnapshots, setShippingSnapshots] = useState<ShippingSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'eBay注文を読み込み',
      afterState: '注文番号 14-12345-67890 / 100.00 USD / US配送'
    }
  ]);

  // Modal States
  const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState<boolean>(false);
  const [isCopySuccessOpen, setIsCopySuccessOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time Validation Result
  const validationStatus = useMemo(() => validateDeclaration(declaration), [declaration]);

  // Helper for adding Audit Log
  const addAuditLog = (action: string, beforeState?: string, afterState?: string) => {
    const newEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action,
      beforeState,
      afterState
    };
    setAuditLogs((prev) => [newEntry, ...prev]);
  };

  // Destination Country Change Handler
  const handleDestinationCountryChange = (val: string) => {
    if (declaration.declarationLocked) return;
    const oldVal = declaration.destinationCountry;
    setDeclaration({
      ...declaration,
      destinationCountry: val
    });

    const isDom = val.toLowerCase() === 'japan' || val.toLowerCase() === 'jp' || val.includes('日本');
    if (isDom) {
      addAuditLog('国内発送のため処理を停止', oldVal, val);
    } else {
      addAuditLog('発送先国を設定', oldVal, val);
    }
  };

  // Shipping Method Change Handler
  const handleShippingMethodChange = (val: string) => {
    if (declaration.declarationLocked) return;
    const oldVal = declaration.shippingMethod;
    setDeclaration({
      ...declaration,
      shippingMethod: val
    });
    addAuditLog('配送方法を選択', oldVal, val);
  };

  // Trigger notice modal before adding included item
  const handleOpenAddNotice = () => {
    if (declaration.declarationLocked || validationStatus.isDomesticShipment) return;
    setIsNoticeOpen(true);
  };

  // Confirm adding included item from notice modal
  const handleConfirmAddIncludedItem = () => {
    setIsNoticeOpen(false);

    const newIncludedItem: ZonosCustomsItem = {
      id: `inc-${Date.now()}`,
      material: 'Paper',
      productType: 'Card',
      quantity: 1,
      countryOfOrigin: 'Japan',
      declaredValueCents: 100, // Default $1.00
      declaredValue: 1.0,
      isIncludedItem: true,
      isSoldItem: false
    };

    const updatedItems = [...declaration.items, newIncludedItem];

    // Reallocate sold item value automatically
    const updatedDecl = reallocateDeclaredValues({
      ...declaration,
      items: updatedItems
    });

    setDeclaration(updatedDecl);
    addAuditLog('同梱品を追加', undefined, '同梱品 (Paper Card / 1.00 USD)');
  };

  // Item field update handler
  const handleUpdateItem = (updatedItem: ZonosCustomsItem) => {
    if (declaration.declarationLocked) return;

    const items = declaration.items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    const updatedDecl = reallocateDeclaredValues({
      ...declaration,
      items
    });

    setDeclaration(updatedDecl);
    addAuditLog('品目情報を更新', undefined, `${updatedItem.material} ${updatedItem.productType} ($${updatedItem.declaredValue})`);
  };

  // Delete included item
  const handleDeleteItem = (id: string) => {
    if (declaration.declarationLocked) return;

    const items = declaration.items.filter((i) => i.id !== id);
    const updatedDecl = reallocateDeclaredValues({
      ...declaration,
      items
    });

    setDeclaration(updatedDecl);
    addAuditLog('同梱品を削除');
  };

  // Lock declaration (申告価格を確定)
  const handleLockDeclaration = () => {
    if (!validationStatus.canLock) {
      if (validationStatus.isDomesticShipment) {
        alert('国内発送にはZonos Prepayを使用できません。発送先国を確認してください。');
      } else {
        alert('申告内容または配送条件に不備があるため、確定できません。');
      }
      return;
    }

    const confirmedAtStr = new Date().toLocaleString('ja-JP');
    setDeclaration({
      ...declaration,
      declarationLocked: true,
      confirmedAt: confirmedAtStr
    });

    addAuditLog('申告価格を確定', '未確定', `確定完了 (${confirmedAtStr})`);
    addAuditLog('配送条件チェック完了', undefined, `${declaration.shippingMethod} / ${declaration.destinationCountry}`);
    showToast('✓ 申告価格を確定しました。編集が保護されます。');
  };

  // Unlock declaration confirmation trigger (確定を解除)
  const handleUnlockDeclaration = () => {
    setIsUnlockOpen(true);
  };

  const handleConfirmUnlock = () => {
    setIsUnlockOpen(false);
    setDeclaration({
      ...declaration,
      declarationLocked: false
    });

    addAuditLog('確定を解除', '確定済み', '未確定');
    showToast('確定を解除しました。編集が可能です。');
  };

  // Copy Zonos payload
  const handleCopyZonosData = () => {
    if (!validationStatus.canCopyZonos) {
      if (validationStatus.isDomesticShipment) {
        alert('国内発送にはZonos Prepayを使用できません。');
      } else if (!declaration.declarationLocked) {
        alert('申告価格を確定してからZonosへコピーしてください。');
      } else {
        alert('配送条件または申告内容を再確認してください。');
      }
      return;
    }

    // Build Zonos Copy Text
    const lines = declaration.items.map((item) => {
      const desc = formatZonosCustomsDescription(item.material, item.productType);
      return `${desc} | Qty: ${item.quantity} | Value: $${item.declaredValue.toFixed(2)} | Origin: Japan`;
    });

    const fullCopyPayload = lines.join('\n');
    navigator.clipboard.writeText(fullCopyPayload);

    const nowStr = new Date().toLocaleString('ja-JP');

    // Create shippingSnapshot (Spec #9)
    const newSnapshot: ShippingSnapshot = {
      id: `snap-${Date.now()}`,
      version: shippingSnapshots.length + 1,
      createdAt: nowStr,
      orderId: declaration.orderId,
      ebayTransactionValue: declaration.ebayTransactionValue,
      currency: declaration.currency,
      carrier: 'JAPAN_POST',
      shippingMethod: declaration.shippingMethod,
      originCountry: 'JP',
      destinationCountry: declaration.destinationCountry,
      items: declaration.items.map((i) => ({
        material: i.material,
        productType: i.productType,
        quantity: i.quantity,
        countryOfOrigin: 'Japan',
        declaredValue: i.declaredValue,
        isIncludedItem: i.isIncludedItem
      })),
      totalDeclaredValue: validationStatus.totalDeclaredValue,
      trackingNumber: '',
      shippingDate: '',
      confirmedAt: declaration.confirmedAt || nowStr,
      copiedAt: nowStr
    };

    setShippingSnapshots([newSnapshot, ...shippingSnapshots]);
    addAuditLog('Zonosコピー条件を満たした', undefined, 'コピー実行');
    addAuditLog('Zonosコピー用データを作成 & 発送記録作成', undefined, `発送記録 Ver.${newSnapshot.version}`);
    setIsCopySuccessOpen(true);
  };

  const handleUpdateSnapshotTracking = (snapshotId: string, trackingNumber: string, shippingDate: string) => {
    setShippingSnapshots(
      shippingSnapshots.map((snap) =>
        snap.id === snapshotId ? { ...snap, trackingNumber, shippingDate } : snap
      )
    );
    addAuditLog('発送記録の追跡情報を更新', undefined, `追跡番号: ${trackingNumber}`);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="zonos-customs-validator-container">
      {/* Spec #2: Top Announcement Banner */}
      <div className="japan-post-banner card">
        <div className="banner-content-row space-between">
          <div className="banner-text-group">
            <div className="banner-tag-badge">🇯🇵 日本郵便・海外発送専用</div>
            <h2 className="banner-title-ja">Zonos Prepay 申告準備・品目バリデーション (Ver.1.1)</h2>
            <p className="banner-desc-ja">
              この画面は、日本から日本郵便で海外へ発送する荷物の Zonos Prepay 申告準備に使用します。
            </p>
            <p className="banner-desc-en text-muted text-xs">
              For International Shipments via Japan Post — This screen prepares Zonos Prepay declaration data for international shipments sent from Japan via Japan Post.
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary btn-rule-modal"
            onClick={() => setIsRulesOpen(true)}
          >
            📜 ルール
          </button>
        </div>
      </div>

      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Spec #7: Prominent Domestic Shipping Warning Banner */}
      {validationStatus.isDomesticShipment && (
        <div className="domestic-warning-banner card">
          <div className="warning-banner-body">
            <span className="warning-icon-lg">🚫</span>
            <div>
              <h3 className="warning-title-text font-bold">国内発送にはZonos Prepayを使用できません</h3>
              <p className="warning-desc-text">
                発送先国が「日本（Japan）」に設定されています。国内発送の場合、関税申告・Zonos Prepayは不要です。発送先国を確認してください。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* eBay Transaction Value Baseline Card (Spec #7) */}
      <div className="card ebay-baseline-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">
            注文・取引基本情報
          </h3>
          <span className="baseline-badge">申告価格配分の基準額 (固定)</span>
        </div>

        <div className="card-body grid-2col">
          <div className="form-group">
            <label className="form-label font-bold">注文番号</label>
            <input
              type="text"
              className="form-control readonly-input font-mono"
              value={declaration.orderId}
              disabled
              readOnly
            />
          </div>

          <div className="form-group">
            <label className="form-label font-bold">eBay取引金額</label>
            <div className="input-currency-wrapper">
              <span className="currency-symbol">$</span>
              <input
                type="text"
                className="form-control currency-input readonly-input font-bold text-highlight-gold"
                value={`${declaration.ebayTransactionValue.toFixed(2)} ${declaration.currency}`}
                disabled
                readOnly
              />
            </div>
            <p className="field-hint">※ 割引後の実際の取引金額（申告価格合計の基準額）</p>
          </div>
        </div>
      </div>

      {/* Spec #3 & #4: Shipping Information Card (発送情報) */}
      <ShippingInfoCard
        destinationCountry={declaration.destinationCountry}
        shippingMethod={declaration.shippingMethod}
        isLocked={declaration.declarationLocked}
        onDestinationCountryChange={handleDestinationCountryChange}
        onShippingMethodChange={handleShippingMethodChange}
      />

      {/* Customs Line Items Editor Section */}
      <div className="card items-section-card">
        <div className="card-header space-between">
          <h3 className="card-title text-lg font-bold">
            申告品目一覧
          </h3>
          {!declaration.declarationLocked && !validationStatus.isDomesticShipment && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleOpenAddNotice}
            >
              + 同梱品を追加
            </button>
          )}
        </div>

        <div className="card-body">
          <div className="items-editor-list">
            {declaration.items.map((item, index) => (
              <ZonosItemEditor
                key={item.id}
                item={item}
                itemNumber={index + 1}
                isLocked={declaration.declarationLocked || validationStatus.isDomesticShipment}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Spec #5 & #6: Declaration Status Check Area (申告内容を確認) */}
      <div className="card declaration-status-card">
        <div className="card-header space-between">
          <h3 className="card-title text-lg font-bold">
            申告内容を確認
          </h3>
          {declaration.declarationLocked ? (
            <span className="status-pill status-paid">確定済み (Locked)</span>
          ) : (
            <span className="status-pill status-unlocked">未確定 (Unlocked)</span>
          )}
        </div>

        <div className="card-body">
          <div className="status-check-grid">
            <div className="status-check-cell">
              <span className="check-label">配送条件判定:</span>
              <span className={validationStatus.shippingConditionsValid ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                {validationStatus.shippingConditionsValid ? '✅ Zonos対象' : '❌ 対象外 / 不備あり'}
              </span>
            </div>

            <div className="status-check-cell">
              <span className="check-label">eBay取引金額:</span>
              <strong className="check-val">${declaration.ebayTransactionValue.toFixed(2)} USD</strong>
            </div>

            <div className="status-check-cell">
              <span className="check-label">申告価格合計:</span>
              <strong className={`check-val ${validationStatus.differenceCents === 0 ? 'text-success' : 'text-danger'}`}>
                ${validationStatus.totalDeclaredValue.toFixed(2)} USD
              </strong>
            </div>

            <div className="status-check-cell">
              <span className="check-label">差額:</span>
              <strong className={`check-val ${validationStatus.differenceCents === 0 ? 'text-success' : 'text-danger'}`}>
                ${validationStatus.difference.toFixed(2)} USD
              </strong>
            </div>

            <div className="status-check-cell">
              <span className="check-label">材質入力状況:</span>
              <span>{validationStatus.materialMissing ? '❌ 未入力あり' : '✅ 正常'}</span>
            </div>

            <div className="status-check-cell">
              <span className="check-label">商品種類入力状況:</span>
              <span>{validationStatus.productTypeMissing ? '❌ 未入力あり' : '✅ 正常'}</span>
            </div>

            <div className="status-check-cell">
              <span className="check-label">数量入力状況:</span>
              <span>{validationStatus.quantityInvalid ? '❌ 不正あり' : '✅ 正常'}</span>
            </div>

            <div className="status-check-cell">
              <span className="check-label">原産国入力状況:</span>
              <span>{validationStatus.originMissing ? '❌ 未入力あり' : '✅ 正常 (Japan)'}</span>
            </div>
          </div>

          <div className="divider"></div>

          {/* Validation Messages Feedback */}
          {validationStatus.isValid && validationStatus.shippingConditionsValid ? (
            <div className="validation-success-banner">
              ✅ 配送条件はZonos Prepayの利用対象に一致しており、申告価格合計がeBay取引金額と一致しています。
            </div>
          ) : (
            <div className="validation-error-list">
              {validationStatus.errors.map((err, i) => (
                <div key={i} className="validation-error-item">
                  <span>❌ {err}</span>
                </div>
              ))}
            </div>
          )}

          {/* Declaration Action Buttons */}
          <div className="validator-footer-actions margin-top-md">
            {declaration.declarationLocked ? (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleUnlockDeclaration}
              >
                確定を解除
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary btn-lg"
                onClick={handleLockDeclaration}
                disabled={!validationStatus.canLock}
              >
                🔒 申告価格を確定
              </button>
            )}

            <button
              type="button"
              className="btn-primary btn-lg btn-copy-zonos"
              onClick={handleCopyZonosData}
              disabled={!validationStatus.canCopyZonos}
            >
              📋 Zonosへコピー
            </button>
          </div>
        </div>
      </div>

      {/* Shipping Records Section (Spec #9) */}
      {shippingSnapshots.length > 0 && (
        <div className="shipping-snapshots-section">
          {shippingSnapshots.map((snapshot) => (
            <ShippingRecordView
              key={snapshot.id}
              snapshot={snapshot}
              onUpdateTracking={(tracking, date) =>
                handleUpdateSnapshotTracking(snapshot.id, tracking, date)
              }
            />
          ))}
        </div>
      )}

      {/* Audit Log Section (Spec #10) */}
      <AuditLogView logs={auditLogs} />

      {/* Modals */}
      <IncludedItemNoticeModal
        isOpen={isNoticeOpen}
        onConfirm={handleConfirmAddIncludedItem}
        onCancel={() => setIsNoticeOpen(false)}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      <UnlockConfirmModal
        isOpen={isUnlockOpen}
        onConfirmUnlock={handleConfirmUnlock}
        onCancel={() => setIsUnlockOpen(false)}
      />

      <CopySuccessModal
        isOpen={isCopySuccessOpen}
        onConfirm={() => setIsCopySuccessOpen(false)}
        onRecheck={() => setIsCopySuccessOpen(false)}
      />
    </div>
  );
};
