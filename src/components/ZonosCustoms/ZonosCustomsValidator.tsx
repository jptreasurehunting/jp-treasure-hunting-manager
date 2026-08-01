import React, { useState, useMemo } from 'react';
import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  ShippingSnapshot,
  AuditLogEntry,
  EbayOrderPayload
} from '../../types/zonosCustoms';
import {
  dollarsToCents,
  reallocateDeclaredValues,
  validateDeclaration,
  formatZonosCustomsDescription
} from '../../utils/zonosCustomsValidation';
import { calculatePackagedWeight } from '../../utils/zonosWeightUtils';
import { getJapanPostRecommendations } from '../../services/japanPostRecommendationService';
import { fetchEbayOrderData } from '../../services/ebayImportService';

import { EbayImportBar } from './EbayImportBar';
import { ImportPreviewModal } from './ImportPreviewModal';
import { OverwriteConfirmModal, OverwriteMode } from './OverwriteConfirmModal';
import { PackagingWeightCard } from './PackagingWeightCard';
import { ZonosItemEditor } from './ZonosItemEditor';
import { ShippingInfoCard } from './ShippingInfoCard';
import { IncludedItemNoticeModal } from './IncludedItemNoticeModal';
import { RulesModal } from './RulesModal';
import { UnlockConfirmModal } from './UnlockConfirmModal';
import { CopySuccessModal } from './CopySuccessModal';
import { ShippingRecordView } from './ShippingRecordView';
import { AuditLogView } from './AuditLogView';

export const ZonosCustomsValidator: React.FC = () => {
  // Initial eBay Order Declaration State for Ver.1.3
  const [declaration, setDeclaration] = useState<ZonosCustomsDeclaration>({
    orderId: '14-12345-67890',
    itemId: '256123456789',
    title: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=80',
    weightKg: 0.85,
    totalItemsWeightGrams: 850,
    packagingWeightGrams: 200, // Default packaging material weight 200g
    totalPackagedWeightGrams: 1050,
    ebayTransactionValueCents: 30000, // $300.00 USD
    ebayTransactionValue: 300.0,
    currency: 'USD',
    carrier: 'JAPAN_POST',
    originCountry: 'JP',
    destinationCountry: 'United States (US)',
    shippingMethod: '国際小包 船便',
    declarationLocked: false,
    importedAt: new Date().toLocaleString('ja-JP'),
    importSource: 'mock',
    items: [
      {
        id: 'sold-1',
        itemId: '256123456789',
        title: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
        imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=400&auto=format&fit=crop&q=80',
        weightKg: 0.85,
        unitWeightGrams: 850,
        subtotalWeightGrams: 850,
        weightUnit: 'kg',
        weightSource: 'eBay API',
        material: 'PVC',
        productType: 'Figure',
        quantity: 1,
        countryOfOrigin: 'Japan',
        declaredValueCents: 30000,
        declaredValue: 300.0,
        isIncludedItem: false,
        isSoldItem: true,
        isEditedByUser: false
      }
    ]
  });

  // Calculate Total Items Weight & Total Packaged Weight
  const totalItemsWeightGrams = useMemo(() => {
    return declaration.items.reduce((acc, i) => acc + (i.subtotalWeightGrams || (i.unitWeightGrams * i.quantity) || 0), 0);
  }, [declaration.items]);

  const totalPackagedWeightGrams = useMemo(() => {
    return totalItemsWeightGrams + (declaration.packagingWeightGrams || 0);
  }, [totalItemsWeightGrams, declaration.packagingWeightGrams]);

  // Snapshot & Audit Log States
  const [shippingSnapshots, setShippingSnapshots] = useState<ShippingSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'eBay注文を読み込み (初期)',
      afterState: '注文番号 14-12345-67890 / 300.00 USD / 重量 850g / 梱包後 1050g'
    }
  ]);

  // eBay Import States
  const [isImportLoading, setIsImportLoading] = useState<boolean>(false);
  const [pendingPayload, setPendingPayload] = useState<EbayOrderPayload | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isOverwriteOpen, setIsOverwriteOpen] = useState<boolean>(false);

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

  // Packaging Weight Change Handler (Spec #3)
  const handlePackagingWeightChange = (grams: number) => {
    if (declaration.declarationLocked) return;
    const oldPack = declaration.packagingWeightGrams;
    const newPack = Math.max(0, grams);
    const newTotalPackaged = totalItemsWeightGrams + newPack;

    setDeclaration({
      ...declaration,
      packagingWeightGrams: newPack,
      totalPackagedWeightGrams: newTotalPackaged
    });

    addAuditLog('梱包材重量を入力', `${oldPack}g`, `${newPack}g`);
    addAuditLog('梱包後総重量を計算', undefined, `総重量: ${newTotalPackaged}g (${(newTotalPackaged / 1000).toFixed(2)}kg)`);
  };

  // eBay Data Ingestion Trigger (Ver.1.2 & Ver.1.3)
  const handleFetchEbayData = async (orderIdInput: string, itemIdInput: string) => {
    if (declaration.declarationLocked) {
      alert('申告価格が確定中（ロック済み）です。解除してから再読み込みしてください。');
      return;
    }

    setIsImportLoading(true);
    if (orderIdInput.trim()) {
      addAuditLog('eBay注文番号で検索', undefined, orderIdInput.trim());
    } else if (itemIdInput.trim()) {
      addAuditLog('Item IDで検索', undefined, itemIdInput.trim());
    }

    try {
      const payload = await fetchEbayOrderData(orderIdInput, itemIdInput);
      setPendingPayload(payload);
      setIsImportLoading(false);

      addAuditLog('eBayデータ読込成功', undefined, `注文番号 ${payload.orderId} (${payload.items.length}件の品目)`);

      // Weight Audit Log
      const hasWeights = payload.items.some((i) => i.unitWeightGrams > 0);
      if (hasWeights) {
        addAuditLog('重量自動取得成功', undefined, `商品重量取得完了`);
      } else {
        addAuditLog('重量自動取得失敗', undefined, `実測値入力要請`);
      }

      addAuditLog('商品情報候補を生成', undefined, '材質・商品種類候補作成');

      if (payload.items.some((i) => i.imageUrl)) {
        addAuditLog('画像URL取得成功', undefined, '画像表示可能');
      }

      // Check if user has edited any items
      const hasUserEdits = declaration.items.some((i) => i.isEditedByUser);
      if (hasUserEdits) {
        setIsOverwriteOpen(true);
      } else {
        setIsPreviewOpen(true);
      }
    } catch (err: any) {
      setIsImportLoading(false);
      addAuditLog('eBayデータ読込失敗', undefined, err.message || 'データ取得エラー');
      alert(`⚠️ eBayデータの取得に失敗しました:\n${err.message || '入力内容をご確認の上、再度お試しください。'}`);
    }
  };

  // Overwrite Mode Chosen
  const handleConfirmOverwriteChoice = (mode: OverwriteMode) => {
    setIsOverwriteOpen(false);
    if (mode === 'unedited_only') {
      addAuditLog('未編集項目のみ更新', '編集保護適用', '未編集項目を更新');
    } else if (mode === 'reload_all') {
      addAuditLog('すべて再取得', '全リセット', 'eBay最新データで上書き');
    }
    setIsPreviewOpen(true);
  };

  // Apply Pending eBay Payload to Declaration
  const handleApplyImportPayload = (mode: OverwriteMode = 'reload_all') => {
    if (!pendingPayload) return;

    setIsPreviewOpen(false);

    const nowStr = new Date().toLocaleString('ja-JP');
    const ebayCents = dollarsToCents(pendingPayload.ebayTransactionValue);

    // Multi-Item line-item handling with weight calculation (Spec #2 & #7)
    const newItems: ZonosCustomsItem[] = pendingPayload.items.map((item, idx) => {
      const itemCents = dollarsToCents(item.actualPrice);
      const isFirst = idx === 0;
      const uGrams = item.unitWeightGrams || 0;
      const subGrams = uGrams * item.quantity;
      const kg = parseFloat((uGrams / 1000).toFixed(3));

      return {
        id: `sold-${item.itemId}-${idx}-${Date.now()}`,
        itemId: item.itemId,
        title: item.title,
        imageUrl: item.imageUrl,
        weightKg: item.weightKg || kg,
        unitWeightGrams: uGrams,
        subtotalWeightGrams: subGrams,
        weightUnit: item.weightUnit || 'g',
        weightSource: item.weightSource || (uGrams > 0 ? 'eBay API' : '未取得'),
        isWeightEstimated: item.isWeightEstimated,
        material: item.derivedMaterial,
        productType: item.derivedProductType,
        quantity: item.quantity,
        countryOfOrigin: 'Japan',
        declaredValueCents: itemCents,
        declaredValue: item.actualPrice,
        isIncludedItem: false,
        isSoldItem: isFirst,
        isEditedByUser: false
      };
    });

    const sumItemsGrams = newItems.reduce((acc, i) => acc + i.subtotalWeightGrams, 0);
    const totalPackGrams = sumItemsGrams + (declaration.packagingWeightGrams || 200);

    if (pendingPayload.items.length > 1) {
      addAuditLog('複数商品を個別品目として追加', undefined, `${pendingPayload.items.length}件の品目を生成`);
    }

    const recs = getJapanPostRecommendations(pendingPayload.destinationCountry, totalPackGrams);
    if (recs.length > 0) {
      addAuditLog('配送方法候補を表示', undefined, `${recs.length}件の候補を提示`);
    }

    const firstItem = pendingPayload.items[0];

    const updatedDecl: ZonosCustomsDeclaration = {
      ...declaration,
      orderId: pendingPayload.orderId,
      itemId: firstItem?.itemId,
      title: firstItem?.title,
      imageUrl: firstItem?.imageUrl,
      weightKg: firstItem?.weightKg,
      totalItemsWeightGrams: sumItemsGrams,
      totalPackagedWeightGrams: totalPackGrams,
      ebayTransactionValueCents: ebayCents,
      ebayTransactionValue: pendingPayload.ebayTransactionValue,
      currency: pendingPayload.currency,
      destinationCountry: pendingPayload.destinationCountry,
      orderDate: pendingPayload.orderDate,
      paymentStatus: pendingPayload.paymentStatus,
      fulfillmentStatus: pendingPayload.fulfillmentStatus,
      importedAt: nowStr,
      importSource: pendingPayload.importSource,
      declarationLocked: false,
      items: newItems
    };

    const reallocatedDecl = reallocateDeclaredValues(updatedDecl);
    setDeclaration(reallocatedDecl);
    setPendingPayload(null);
    showToast('✓ eBay注文データおよび重量情報を反映しました！');
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
      unitWeightGrams: 20, // Default 20g for included item
      subtotalWeightGrams: 20,
      weightUnit: 'g',
      weightSource: '手入力',
      declaredValueCents: 100, // Default $1.00
      declaredValue: 1.0,
      isIncludedItem: true,
      isSoldItem: false,
      isEditedByUser: true
    };

    const updatedItems = [...declaration.items, newIncludedItem];

    // Reallocate sold item value automatically
    const updatedDecl = reallocateDeclaredValues({
      ...declaration,
      items: updatedItems
    });

    setDeclaration(updatedDecl);
    addAuditLog('同梱品を追加', undefined, '同梱品 (Paper Card / 1.00 USD / 20g)');
  };

  // Item field update handler
  const handleUpdateItem = (updatedItem: ZonosCustomsItem) => {
    if (declaration.declarationLocked) return;

    const itemWithFlag = { ...updatedItem, isEditedByUser: true };
    const items = declaration.items.map((i) => (i.id === itemWithFlag.id ? itemWithFlag : i));
    const updatedDecl = reallocateDeclaredValues({
      ...declaration,
      items
    });

    setDeclaration(updatedDecl);
    addAuditLog('商品情報を手動修正', undefined, `${updatedItem.material} ${updatedItem.productType} (${updatedItem.unitWeightGrams}g / $${updatedItem.declaredValue})`);
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

    // Check weight warning before creating record
    const hasZeroWeight = totalPackagedWeightGrams <= 0;
    if (hasZeroWeight) {
      alert('⚠️ 梱包後総重量が0gです。正確な配送手続きのために実測値を入力してください。');
    }

    // Build Zonos Copy Text
    const lines = declaration.items.map((item) => {
      const desc = formatZonosCustomsDescription(item.material, item.productType);
      return `${desc} | Qty: ${item.quantity} | Value: $${item.declaredValue.toFixed(2)} | Origin: Japan`;
    });

    const fullCopyPayload = lines.join('\n');
    navigator.clipboard.writeText(fullCopyPayload);

    const nowStr = new Date().toLocaleString('ja-JP');
    const mainItem = declaration.items[0];
    const recs = getJapanPostRecommendations(declaration.destinationCountry, totalPackagedWeightGrams);

    // Create shippingSnapshot (Spec #9, #12)
    const newSnapshot: ShippingSnapshot = {
      id: `snap-${Date.now()}`,
      version: shippingSnapshots.length + 1,
      createdAt: nowStr,
      orderId: declaration.orderId,
      ebayOrderId: declaration.orderId,
      ebayItemId: mainItem?.itemId || declaration.itemId,
      itemTitle: mainItem?.title || declaration.title,
      weightKg: (totalPackagedWeightGrams / 1000),
      totalItemsWeightGrams: totalItemsWeightGrams,
      packagingWeightGrams: declaration.packagingWeightGrams || 0,
      totalPackagedWeightGrams: totalPackagedWeightGrams,
      weightUnit: 'g',
      weightSource: mainItem?.weightSource || '手入力',
      ebayTransactionValue: declaration.ebayTransactionValue,
      currency: declaration.currency,
      carrier: 'JAPAN_POST',
      shippingMethod: declaration.shippingMethod,
      recommendedShippingMethods: recs.map((r) => `${r.method} (${r.reason})`),
      originCountry: 'JP',
      destinationCountry: declaration.destinationCountry,
      imageUrl: mainItem?.imageUrl || declaration.imageUrl,
      customsDescription: formatZonosCustomsDescription(mainItem?.material, mainItem?.productType),
      items: declaration.items.map((i) => ({
        itemId: i.itemId,
        title: i.title,
        material: i.material,
        productType: i.productType,
        quantity: i.quantity,
        countryOfOrigin: 'Japan',
        declaredValue: i.declaredValue,
        isIncludedItem: i.isIncludedItem,
        weightKg: i.weightKg,
        unitWeightGrams: i.unitWeightGrams,
        subtotalWeightGrams: i.subtotalWeightGrams
      })),
      totalDeclaredValue: validationStatus.totalDeclaredValue,
      trackingNumber: '',
      shippingDate: '',
      confirmedAt: declaration.confirmedAt || nowStr,
      copiedAt: nowStr,
      importedAt: declaration.importedAt,
      importSource: declaration.importSource
    };

    setShippingSnapshots([newSnapshot, ...shippingSnapshots]);
    addAuditLog('Zonosコピー条件を満たした', undefined, 'コピー実行');
    addAuditLog('発送記録を作成', undefined, `発送記録 Ver.${newSnapshot.version} (梱包後重量: ${totalPackagedWeightGrams}g)`);
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
      {/* Top Announcement Banner */}
      <div className="japan-post-banner card">
        <div className="banner-content-row space-between">
          <div className="banner-text-group">
            <div className="banner-tag-badge">🇯🇵 日本郵便・海外発送専用</div>
            <h2 className="banner-title-ja">Zonos Prepay 申告準備・品目バリデーション (Ver.1.3)</h2>
            <p className="banner-desc-ja">
              この画面は、日本から日本郵便で海外へ発送する荷物の Zonos Prepay 申告準備および重量・配送連携に使用します。
            </p>
            <p className="banner-desc-en text-muted text-xs">
              For International Shipments via Japan Post — Automated weight normalization, packaging calculator, and Japan Post recommendations.
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

      {/* Domestic Shipping Warning Banner */}
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

      {/* Order & Transaction Basic Info Card */}
      <div className="card ebay-baseline-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">
            注文・取引基本情報
          </h3>
          <span className="baseline-badge">申告価格配分の基準額 (固定)</span>
        </div>

        <div className="card-body">
          <EbayImportBar
            initialOrderId={declaration.orderId}
            initialItemId={declaration.itemId}
            isLoading={isImportLoading}
            onImport={handleFetchEbayData}
          />

          <div className="grid-2col margin-top-md">
            <div className="form-group">
              <label className="form-label font-bold">注文番号 (Order ID)</label>
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
      </div>

      {/* Shipping Information Card (発送情報) */}
      <ShippingInfoCard
        destinationCountry={declaration.destinationCountry}
        shippingMethod={declaration.shippingMethod}
        isLocked={declaration.declarationLocked}
        onDestinationCountryChange={handleDestinationCountryChange}
        onShippingMethodChange={handleShippingMethodChange}
      />

      {/* Spec #3 & #6: Packaging Weight Calculator & Recommendations Card */}
      <PackagingWeightCard
        totalItemsWeightGrams={totalItemsWeightGrams}
        packagingWeightGrams={declaration.packagingWeightGrams || 0}
        totalPackagedWeightGrams={totalPackagedWeightGrams}
        destinationCountry={declaration.destinationCountry}
        selectedShippingMethod={declaration.shippingMethod}
        isLocked={declaration.declarationLocked}
        onPackagingWeightChange={handlePackagingWeightChange}
        onSelectShippingMethod={handleShippingMethodChange}
      />

      {/* Customs Line Items Editor Section */}
      <div className="card items-section-card">
        <div className="card-header space-between">
          <h3 className="card-title text-lg font-bold">
            申告品目一覧 ({declaration.items.length}件)
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

      {/* Declaration Status Check Area (申告内容を確認) */}
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
              <span className="check-label">梱包後総重量:</span>
              <strong className="check-val text-highlight font-mono">{totalPackagedWeightGrams} g</strong>
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

      {/* Shipping Records Section */}
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

      {/* Audit Log Section */}
      <AuditLogView logs={auditLogs} />

      {/* Ver.1.2/1.3 Modals */}
      <ImportPreviewModal
        payload={pendingPayload}
        isOpen={isPreviewOpen}
        onConfirm={() => handleApplyImportPayload('reload_all')}
        onEditAndConfirm={() => handleApplyImportPayload('unedited_only')}
        onCancel={() => setIsPreviewOpen(false)}
      />

      <OverwriteConfirmModal
        isOpen={isOverwriteOpen}
        onConfirm={handleConfirmOverwriteChoice}
        onCancel={() => setIsOverwriteOpen(false)}
      />

      {/* Ver.1.0/1.1 Modals */}
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
