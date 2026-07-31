import React, { useState, useMemo } from 'react';
import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  ShippingSnapshot,
  AuditLogEntry
} from '../../types/zonosCustoms';
import {
  dollarsToCents,
  centsToDollars,
  reallocateDeclaredValues,
  validateDeclaration,
  formatZonosCustomsDescription
} from '../../utils/zonosCustomsValidation';
import { ZonosItemEditor } from './ZonosItemEditor';
import { IncludedItemNoticeModal } from './IncludedItemNoticeModal';
import { RulesModal } from './RulesModal';
import { UnlockConfirmModal } from './UnlockConfirmModal';
import { CopySuccessModal } from './CopySuccessModal';
import { ShippingRecordView } from './ShippingRecordView';
import { AuditLogView } from './AuditLogView';

export const ZonosCustomsValidator: React.FC = () => {
  // Initial eBay Order Declaration State
  const [declaration, setDeclaration] = useState<ZonosCustomsDeclaration>({
    orderId: '14-12345-67890',
    ebayTransactionValueCents: 10000, // $100.00 USD
    ebayTransactionValue: 100.0,
    currency: 'USD',
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
      afterState: '注文番号 14-12345-67890 / 100.00 USD'
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

  // Trigger notice modal before adding included item
  const handleOpenAddNotice = () => {
    if (declaration.declarationLocked) return;
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
      alert('申告内容に不備があるため、確定できません。');
      return;
    }

    const confirmedAtStr = new Date().toLocaleString('ja-JP');
    setDeclaration({
      ...declaration,
      declarationLocked: true,
      confirmedAt: confirmedAtStr
    });

    addAuditLog('申告価格を確定', '未確定', `確定完了 (${confirmedAtStr})`);
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
    if (!declaration.declarationLocked || !validationStatus.isValid) {
      alert('申告価格を確定してからZonosへコピーしてください。');
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

    // Create shippingSnapshot (Spec #15)
    const newSnapshot: ShippingSnapshot = {
      id: `snap-${Date.now()}`,
      version: shippingSnapshots.length + 1,
      createdAt: nowStr,
      orderId: declaration.orderId,
      ebayTransactionValue: declaration.ebayTransactionValue,
      currency: declaration.currency,
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
      {/* Top Header Card */}
      <div className="card zonos-header-card">
        <div className="card-header space-between">
          <div className="title-with-badge">
            <h2 className="card-title text-xl font-bold">
              <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              Zonos Customs (税関申告・品目管理)
            </h2>
            <span className="feature-status-badge">Ver 1.0 確定仕様</span>
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

      {/* Customs Line Items Editor Section */}
      <div className="card items-section-card">
        <div className="card-header space-between">
          <h3 className="card-title text-lg font-bold">
            申告品目一覧
          </h3>
          {!declaration.declarationLocked && (
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
                isLocked={declaration.declarationLocked}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Declaration Status Check Area (Spec #12) */}
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

            <div className="status-check-cell">
              <span className="check-label">確定状態:</span>
              <span>{declaration.declarationLocked ? '✅ 確定完了' : '⚠️ 未確定'}</span>
            </div>
          </div>

          <div className="divider"></div>

          {/* Validation Messages Feedback */}
          {validationStatus.isValid ? (
            <div className="validation-success-banner">
              ✅ 申告価格合計がeBay取引金額と一致しています。
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
              disabled={!declaration.declarationLocked || !validationStatus.isValid}
            >
              📋 Zonosへコピー
            </button>
          </div>
        </div>
      </div>

      {/* Shipping Records Section (Spec #15) */}
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

      {/* Audit Log Section (Spec #18) */}
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
