import React, { useState, useMemo, useEffect } from 'react';
import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  ShippingSnapshot,
  AuditLogEntry,
  EbayOrderPayload,
  TransferSession,
  CustomsValidationStatus,
  EbaySellerAccount
} from '../../types/zonosCustoms';
import {
  dollarsToCents,
  reallocateDeclaredValues,
  validateDeclaration,
  formatZonosCustomsDescription
} from '../../utils/zonosCustomsValidation';
import { getJapanPostRecommendations } from '../../services/japanPostRecommendationService';
import { fetchEbayOrderData } from '../../services/ebayImportService';
import {
  runPreTransferCheck,
  loadTransferSession,
  saveTransferSession,
  clearTransferSession
} from '../../services/zonosTransferService';
import {
  loadEbayAccounts,
  saveEbayAccounts
} from '../../services/ebayAccountService';

import { EbayAccountManager } from './EbayAccountManager';
import { EbayOAuthPrepModal } from './EbayOAuthPrepModal';
import { EbayImportBar } from './EbayImportBar';
import { ImportPreviewModal } from './ImportPreviewModal';
import { OverwriteConfirmModal, OverwriteMode } from './OverwriteConfirmModal';
import { PackagingWeightCard } from './PackagingWeightCard';
import { TransferCheckModal } from './TransferCheckModal';
import { TransferWizardModal } from './TransferWizardModal';
import { ResumeTransferModal } from './ResumeTransferModal';
import { ZonosItemEditor } from './ZonosItemEditor';
import { ShippingInfoCard } from './ShippingInfoCard';
import { IncludedItemNoticeModal } from './IncludedItemNoticeModal';
import { RulesModal } from './RulesModal';
import { UnlockConfirmModal } from './UnlockConfirmModal';
import { CopySuccessModal } from './CopySuccessModal';
import { ShippingRecordView } from './ShippingRecordView';
import { AuditLogView } from './AuditLogView';

export const ZonosCustomsValidator: React.FC = () => {
  // Ver.1.5 Multi-eBay Account State (10 slots)
  const [ebayAccounts, setEbayAccounts] = useState<EbaySellerAccount[]>(loadEbayAccounts());
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc_01');
  const [prepModalAccount, setPrepModalAccount] = useState<EbaySellerAccount | null>(null);
  const [isOAuthPrepOpen, setIsOAuthPrepOpen] = useState<boolean>(false);

  // Declaration state starts empty (null) until an actual eBay order is fetched
  const [declaration, setDeclaration] = useState<ZonosCustomsDeclaration | null>(null);

  // Active target eBay Account object
  const activeAccount = useMemo(() => {
    return ebayAccounts.find((a) => a.id === selectedAccountId) || ebayAccounts[0];
  }, [ebayAccounts, selectedAccountId]);

  // Calculate Total Items Weight & Total Packaged Weight safely
  const totalItemsWeightGrams = useMemo(() => {
    if (!declaration) return 0;
    return declaration.items.reduce((acc, i) => acc + (i.subtotalWeightGrams || (i.unitWeightGrams * i.quantity) || 0), 0);
  }, [declaration]);

  const totalPackagedWeightGrams = useMemo(() => {
    if (!declaration) return 0;
    return totalItemsWeightGrams + (declaration.packagingWeightGrams || 0);
  }, [declaration, totalItemsWeightGrams]);

  // Snapshot & Audit Log States
  const [shippingSnapshots, setShippingSnapshots] = useState<ShippingSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: '画面初期表示',
      afterState: 'eBay注文データ未読み込み (待機中 / 10アカウント枠ロード完了)'
    }
  ]);

  // eBay Import States
  const [isImportLoading, setIsImportLoading] = useState<boolean>(false);
  const [pendingPayload, setPendingPayload] = useState<EbayOrderPayload | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [isOverwriteOpen, setIsOverwriteOpen] = useState<boolean>(false);

  // Ver.1.4 Transfer States
  const [activeTransferSession, setActiveTransferSession] = useState<TransferSession | null>(null);
  const [isTransferCheckOpen, setIsTransferCheckOpen] = useState<boolean>(false);
  const [isTransferWizardOpen, setIsTransferWizardOpen] = useState<boolean>(false);
  const [isResumeModalOpen, setIsResumeModalOpen] = useState<boolean>(false);

  // Modal States
  const [isNoticeOpen, setIsNoticeOpen] = useState<boolean>(false);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);
  const [isUnlockOpen, setIsUnlockOpen] = useState<boolean>(false);
  const [isCopySuccessOpen, setIsCopySuccessOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Real-time Validation Result
  const validationStatus: CustomsValidationStatus = useMemo(() => {
    if (!declaration) {
      return {
        isValid: false,
        canLock: false,
        canCopyZonos: false,
        errors: ['eBay注文データが読み込まれていません。'],
        warnings: [],
        totalDeclaredValueCents: 0,
        totalDeclaredValue: 0,
        differenceCents: 0,
        difference: 0,
        materialMissing: false,
        productTypeMissing: false,
        quantityInvalid: false,
        originMissing: false,
        valueInvalid: false,
        currencyMismatch: false,
        isDomesticShipment: false,
        carrierInvalid: false,
        originInvalid: false,
        destinationMissing: true,
        shippingMethodMissing: true,
        shippingConditionsValid: false,
        weightMissing: false
      };
    }
    return validateDeclaration(declaration);
  }, [declaration]);

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

  // Ver.1.5 Account Handlers
  const handleSelectAccount = (accountId: string) => {
    const target = ebayAccounts.find((a) => a.id === accountId);
    if (!target) return;
    const oldTarget = activeAccount;
    setSelectedAccountId(accountId);

    const updatedAccounts = ebayAccounts.map((a) => ({
      ...a,
      isSelectedForFetch: a.id === accountId
    }));
    setEbayAccounts(updatedAccounts);
    saveEbayAccounts(updatedAccounts);

    addAuditLog('注文取得対象を変更', oldTarget.displayName, target.displayName);
    showToast(`注文取得対象を [${target.displayName}] に変更しました`);
  };

  const handleUpdateDisplayName = (accountId: string, newDisplayName: string) => {
    const target = ebayAccounts.find((a) => a.id === accountId);
    const oldName = target ? target.displayName : '';

    const updated = ebayAccounts.map((a) =>
      a.id === accountId ? { ...a, displayName: newDisplayName } : a
    );
    setEbayAccounts(updated);
    saveEbayAccounts(updated);
    addAuditLog('表示名を変更', oldName, newDisplayName);
    showToast(`アカウント表示名を [${newDisplayName}] に変更しました`);
  };

  const handleOpenConnectPrep = (account: EbaySellerAccount) => {
    setPrepModalAccount(account);
    setIsOAuthPrepOpen(true);
    addAuditLog('接続準備を開始', undefined, `対象: ${account.displayName} (${account.id})`);
  };

  const handleCancelOAuthPrep = () => {
    if (prepModalAccount) {
      addAuditLog('接続をキャンセル', undefined, `対象: ${prepModalAccount.displayName}`);
    }
    setIsOAuthPrepOpen(false);
    setPrepModalAccount(null);
  };

  const handleDisconnectAccount = (accountId: string) => {
    const target = ebayAccounts.find((a) => a.id === accountId);
    const updated = ebayAccounts.map((a) =>
      a.id === accountId ? { ...a, connectionStatus: 'unconnected' as const } : a
    );
    setEbayAccounts(updated);
    saveEbayAccounts(updated);
    addAuditLog('接続解除', target?.displayName, '未接続');
    showToast(`[${target?.displayName || accountId}] の接続を解除しました`);
  };

  // Check for interrupted session on mount / order change (Spec #15)
  useEffect(() => {
    if (!declaration) return;
    const saved = loadTransferSession();
    if (saved && saved.orderId === declaration.orderId && saved.status === 'interrupted') {
      setActiveTransferSession(saved);
      setIsResumeModalOpen(true);
    }
  }, [declaration?.orderId]);

  // Packaging Weight Change Handler
  const handlePackagingWeightChange = (grams: number) => {
    if (!declaration || declaration.declarationLocked) return;
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

  // eBay Data Ingestion Trigger
  const handleFetchEbayData = async (orderIdInput: string, itemIdInput: string) => {
    // Unconnected account safeguard check (Spec #3 & Spec #10 Test 2)
    if (activeAccount.connectionStatus === 'unconnected') {
      addAuditLog('未接続アカウントで注文取得を停止', activeAccount.displayName, '未接続のため処理中断');
      alert('⚠️ このeBayアカウントはまだ接続されていません。アカウント管理画面で接続手続きを行ってください。');
      return;
    }

    if (declaration && declaration.declarationLocked) {
      alert('申告価格が確定中（ロック済み）です。解除してから再読み込みしてください。');
      return;
    }

    setIsImportLoading(true);
    if (orderIdInput.trim()) {
      addAuditLog('eBay注文番号で検索', `アカウント: ${activeAccount.displayName}`, orderIdInput.trim());
    } else if (itemIdInput.trim()) {
      addAuditLog('Item IDで検索', `アカウント: ${activeAccount.displayName}`, itemIdInput.trim());
    }

    try {
      const payload = await fetchEbayOrderData(orderIdInput, itemIdInput);
      setPendingPayload(payload);
      setIsImportLoading(false);

      // Update account last fetch date
      const nowStr = new Date().toLocaleString('ja-JP');
      const updatedAccounts = ebayAccounts.map((a) =>
        a.id === activeAccount.id ? { ...a, lastOrderFetchDate: nowStr } : a
      );
      setEbayAccounts(updatedAccounts);
      saveEbayAccounts(updatedAccounts);

      addAuditLog('eBayデータ読込成功', `取得元: ${activeAccount.displayName}`, `注文番号 ${payload.orderId} (${payload.items.length}件の品目)`);

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

      const hasUserEdits = declaration ? declaration.items.some((i) => i.isEditedByUser) : false;
      if (hasUserEdits) {
        setIsOverwriteOpen(true);
      } else {
        setIsPreviewOpen(true);
      }
    } catch (err: any) {
      setIsImportLoading(false);
      addAuditLog('eBayデータ読込失敗', `対象: ${activeAccount.displayName}`, err.message || 'データ取得エラー');
      alert(`⚠️ ${err.message || '実際のeBay注文データを読み込めません。eBay API設定を確認してください。'}`);
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
    const defaultPackGrams = declaration ? (declaration.packagingWeightGrams || 200) : 200;
    const totalPackGrams = sumItemsGrams + defaultPackGrams;

    if (pendingPayload.items.length > 1) {
      addAuditLog('複数商品を個別品目として追加', undefined, `${pendingPayload.items.length}件の品目を生成`);
    }

    const recs = getJapanPostRecommendations(pendingPayload.destinationCountry, totalPackGrams);
    if (recs.length > 0) {
      addAuditLog('配送方法候補を表示', undefined, `${recs.length}件の候補を提示`);
    }

    const firstItem = pendingPayload.items[0];

    const updatedDecl: ZonosCustomsDeclaration = {
      orderId: pendingPayload.orderId,
      itemId: firstItem?.itemId,
      title: firstItem?.title,
      imageUrl: firstItem?.imageUrl,
      weightKg: firstItem?.weightKg,
      totalItemsWeightGrams: sumItemsGrams,
      packagingWeightGrams: defaultPackGrams,
      totalPackagedWeightGrams: totalPackGrams,
      ebayTransactionValueCents: ebayCents,
      ebayTransactionValue: pendingPayload.ebayTransactionValue,
      currency: pendingPayload.currency,
      carrier: 'JAPAN_POST',
      originCountry: 'JP',
      destinationCountry: pendingPayload.destinationCountry,
      shippingMethod: declaration ? declaration.shippingMethod : '国際小包 船便',
      orderDate: pendingPayload.orderDate,
      paymentStatus: pendingPayload.paymentStatus,
      fulfillmentStatus: pendingPayload.fulfillmentStatus,
      importedAt: nowStr,
      importSource: pendingPayload.importSource,
      declarationLocked: false,
      selectedAccountId: activeAccount.id,
      selectedAccountDisplayName: activeAccount.displayName,
      items: newItems
    };

    const reallocatedDecl = reallocateDeclaredValues(updatedDecl);
    setDeclaration(reallocatedDecl);
    setPendingPayload(null);
    showToast('✓ eBay注文データを画面に読み込みました！');
  };

  // Destination Country Change Handler
  const handleDestinationCountryChange = (val: string) => {
    if (!declaration || declaration.declarationLocked) return;
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
    if (!declaration || declaration.declarationLocked) return;
    const oldVal = declaration.shippingMethod;
    setDeclaration({
      ...declaration,
      shippingMethod: val
    });
    addAuditLog('配送方法を選択', oldVal, val);
  };

  // Trigger notice modal before adding included item
  const handleOpenAddNotice = () => {
    if (!declaration || declaration.declarationLocked || validationStatus.isDomesticShipment) return;
    setIsNoticeOpen(true);
  };

  // Confirm adding included item from notice modal
  const handleConfirmAddIncludedItem = () => {
    if (!declaration) return;
    setIsNoticeOpen(false);

    const newIncludedItem: ZonosCustomsItem = {
      id: `inc-${Date.now()}`,
      material: 'Paper',
      productType: 'Card',
      quantity: 1,
      countryOfOrigin: 'Japan',
      unitWeightGrams: 20,
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

    const updatedDecl = reallocateDeclaredValues({
      ...declaration,
      items: updatedItems
    });

    setDeclaration(updatedDecl);
    addAuditLog('同梱品を追加', undefined, '同梱品 (Paper Card / 1.00 USD / 20g)');
  };

  // Item field update handler
  const handleUpdateItem = (updatedItem: ZonosCustomsItem) => {
    if (!declaration || declaration.declarationLocked) return;

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
    if (!declaration || declaration.declarationLocked) return;

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
    if (!declaration) return;
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
    if (!declaration) return;
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
    if (!declaration) return;
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

    // Create shippingSnapshot including Ver.1.5 eBay account metadata
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
      importSource: declaration.importSource,
      transferStatus: '未転記',
      transferredItemsCount: 0,
      ebayAccountId: activeAccount.id,
      ebayAccountDisplayName: activeAccount.displayName,
      ebayUsername: activeAccount.ebayUsername,
      fetchSourceAccount: activeAccount.displayName
    };

    setShippingSnapshots([newSnapshot, ...shippingSnapshots]);
    addAuditLog('Zonosコピー条件を満たした', undefined, 'コピー実行');
    addAuditLog('発送記録を作成', undefined, `発送記録 Ver.${newSnapshot.version} (取得元: ${activeAccount.displayName})`);
    setIsCopySuccessOpen(true);
  };

  // Trigger Transfer Check (Zonos転記を開始)
  const handleStartTransferTrigger = () => {
    if (!declaration) return;
    const completedSnapshot = shippingSnapshots.find(s => s.orderId === declaration.orderId && s.transferStatus === '転記完了');
    if (completedSnapshot) {
      addAuditLog('二重転記警告', undefined, `注文番号 ${declaration.orderId} は転記完了済み`);
      const proceed = window.confirm(`⚠️ 警告: 注文番号 ${declaration.orderId} は既にZonos転記が完了しています。再転記を行いますか？`);
      if (!proceed) return;
    }

    const checkResult = runPreTransferCheck(declaration, validationStatus);

    if (!checkResult.canStart) {
      addAuditLog('転記前チェック失敗', undefined, `${checkResult.errors.length}件の不備あり`);
      const missingDetails = checkResult.missingItems.map(m => `・${m.fieldName}: ${m.reason}`).join('\n');
      alert(`❌ Zonos転記前チェックエラー:\n\n転記を開始できません。以下の不足項目を修正してください:\n\n${missingDetails}`);
      return;
    }

    addAuditLog('転記前チェック成功', undefined, '全12項目チェッククリア');
    setIsTransferCheckOpen(true);
  };

  const handleConfirmStartTransfer = () => {
    if (!declaration) return;
    setIsTransferCheckOpen(false);

    const nowStr = new Date().toLocaleString('ja-JP');
    const newSession: TransferSession = {
      sessionId: `sess-${Date.now()}`,
      orderId: declaration.orderId,
      status: 'in_progress',
      startedAt: nowStr,
      completedItemsCount: 0,
      totalItemsCount: declaration.items.length,
      currentItemIndex: 0,
      transferMode: 'clipboard',
      completedFieldKeys: []
    };

    setActiveTransferSession(newSession);
    saveTransferSession(newSession);
    addAuditLog('Zonos転記を開始', undefined, `クリップボード方式 (全${declaration.items.length}品目)`);
    setIsTransferWizardOpen(true);
  };

  const handleCompleteItemInWizard = (itemIndex: number) => {
    if (!activeTransferSession || !declaration) return;
    const updatedSession: TransferSession = {
      ...activeTransferSession,
      completedItemsCount: itemIndex + 1,
      currentItemIndex: Math.min(itemIndex + 1, declaration.items.length - 1)
    };
    setActiveTransferSession(updatedSession);
    saveTransferSession(updatedSession);
    addAuditLog('品目転記完了', undefined, `品目 #${itemIndex + 1} 転記完了`);
  };

  const handleFinishAllWizard = (zonosConfirmationNo?: string) => {
    if (!declaration) return;
    setIsTransferWizardOpen(false);
    clearTransferSession();

    const nowStr = new Date().toLocaleString('ja-JP');
    setActiveTransferSession(null);

    if (shippingSnapshots.length > 0) {
      const updatedSnapshots = shippingSnapshots.map((snap, idx) => {
        if (idx === 0) {
          return {
            ...snap,
            transferStatus: '転記完了' as const,
            transferCompletedAt: nowStr,
            transferredItemsCount: declaration.items.length,
            zonosConfirmationNumber: zonosConfirmationNo || snap.zonosConfirmationNumber
          };
        }
        return snap;
      });
      setShippingSnapshots(updatedSnapshots);
    }

    addAuditLog('全品目転記完了', undefined, `全${declaration.items.length}品目の転記完了`);
    if (zonosConfirmationNo) {
      addAuditLog('Zonos確認番号を保存', undefined, zonosConfirmationNo);
    }

    showToast('🎉 全品目のZonos Prepay転記が完了しました！');
  };

  const handleInterruptWizard = () => {
    if (!activeTransferSession) {
      setIsTransferWizardOpen(false);
      return;
    }

    const nowStr = new Date().toLocaleString('ja-JP');
    const interruptedSession: TransferSession = {
      ...activeTransferSession,
      status: 'interrupted',
      interruptedAt: nowStr,
      interruptedReason: 'ユーザーによる中断ボタンクリック'
    };

    setActiveTransferSession(interruptedSession);
    saveTransferSession(interruptedSession);
    addAuditLog('転記中断', undefined, `品目 #${interruptedSession.currentItemIndex + 1} で中断`);
    setIsTransferWizardOpen(false);
    showToast('⏸️ 転記作業を中断し進捗を保存しました。');
  };

  const handleResumeSession = () => {
    setIsResumeModalOpen(false);
    if (!activeTransferSession) return;
    const resumedSession: TransferSession = {
      ...activeTransferSession,
      status: 'in_progress'
    };
    setActiveTransferSession(resumedSession);
    saveTransferSession(resumedSession);
    addAuditLog('転記再開', undefined, `品目 #${resumedSession.currentItemIndex + 1} から再開`);
    setIsTransferWizardOpen(true);
  };

  const handleRestartSession = () => {
    setIsResumeModalOpen(false);
    clearTransferSession();
    setActiveTransferSession(null);
    addAuditLog('転記やり直し', undefined, 'セッションリセット');
    handleStartTransferTrigger();
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
            <h2 className="banner-title-ja">Zonos Prepay 申告準備・品目バリデーション (Ver.1.5)</h2>
            <p className="banner-desc-ja">
              この画面は、日本から日本郵便で海外へ発送する荷物の Zonos Prepay 申告準備および複数eBayアカウント切替管理に使用します。
            </p>
            <p className="banner-desc-en text-muted text-xs">
              For International Shipments via Japan Post — Multi-eBay account connection manager, packaging calculator, and safe Zonos Prepay transfer assistance.
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

      {/* Ver.1.5 Multi-eBay Seller Account Management Screen (Spec #2) */}
      <EbayAccountManager
        accounts={ebayAccounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={handleSelectAccount}
        onUpdateDisplayName={handleUpdateDisplayName}
        onOpenConnectPrep={handleOpenConnectPrep}
        onDisconnectAccount={handleDisconnectAccount}
      />

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

      {/* Order & Transaction Basic Info Card with Account Selector */}
      <div className="card ebay-baseline-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">
            注文・取引基本情報
          </h3>
          <span className="baseline-badge">対象: {activeAccount.displayName} ({activeAccount.ebayUsername})</span>
        </div>

        <div className="card-body">
          <EbayImportBar
            initialOrderId={declaration?.orderId || ''}
            initialItemId={declaration?.itemId || ''}
            isLoading={isImportLoading}
            accounts={ebayAccounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={handleSelectAccount}
            onImport={handleFetchEbayData}
          />

          {declaration && (
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
          )}
        </div>
      </div>

      {/* Conditional Rendering: Empty State Card when no order is loaded */}
      {!declaration ? (
        <div className="card empty-declaration-card text-center padding-xl">
          <div className="empty-state-icon text-3xl margin-bottom-xs">📥</div>
          <h3 className="text-lg font-bold margin-bottom-xs">eBay注文データが読み込まれていません</h3>
          <p className="text-muted text-sm margin-bottom-md">
            対象アカウント [<strong>{activeAccount.displayName}</strong>] を確認し、上の「eBay注文データの自動読み込み」入力欄に注文番号またはItem IDを入力して「eBayから読み込む」ボタンを押してください。
          </p>
        </div>
      ) : (
        <>
          {/* Shipping Information Card (発送情報) */}
          <ShippingInfoCard
            destinationCountry={declaration.destinationCountry}
            shippingMethod={declaration.shippingMethod}
            isLocked={declaration.declarationLocked}
            onDestinationCountryChange={handleDestinationCountryChange}
            onShippingMethodChange={handleShippingMethodChange}
          />

          {/* Packaging Weight Calculator & Recommendations Card */}
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
                  <span className="check-label">取得元アカウント:</span>
                  <strong className="check-val text-highlight">{activeAccount.displayName} ({activeAccount.ebayUsername})</strong>
                </div>

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

                <button
                  type="button"
                  className="btn-primary btn-lg btn-transfer-zonos"
                  onClick={handleStartTransferTrigger}
                  disabled={!declaration.declarationLocked || !validationStatus.shippingConditionsValid}
                >
                  🚀 Zonos転記を開始 (入力支援)
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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

      {/* Ver.1.5 OAuth Connection Prep Modal */}
      <EbayOAuthPrepModal
        account={prepModalAccount}
        isOpen={isOAuthPrepOpen}
        onCancel={handleCancelOAuthPrep}
      />

      {/* Ver.1.4 Transfer Modals */}
      {declaration && (
        <>
          <TransferCheckModal
            declaration={declaration}
            status={validationStatus}
            isOpen={isTransferCheckOpen}
            onStartTransfer={handleConfirmStartTransfer}
            onEditDeclaration={() => setIsTransferCheckOpen(false)}
            onCancel={() => setIsTransferCheckOpen(false)}
          />

          <TransferWizardModal
            declaration={declaration}
            isOpen={isTransferWizardOpen}
            onCompleteItem={handleCompleteItemInWizard}
            onFinishAll={handleFinishAllWizard}
            onInterrupt={handleInterruptWizard}
          />

          <ResumeTransferModal
            session={activeTransferSession}
            isOpen={isResumeModalOpen}
            onResume={handleResumeSession}
            onRestart={handleRestartSession}
            onDismiss={() => setIsResumeModalOpen(false)}
          />
        </>
      )}

      {/* Ver.1.2 Modals */}
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
