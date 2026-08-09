import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ZonosCustomsDeclaration,
  ZonosCustomsItem,
  EbayOrderPayload,
  CustomsValidationStatus,
  EbaySellerAccount
} from '../../types/zonosCustoms';
import {
  dollarsToCents,
  getExchangeRateInfo,
  generateZonosCustomsDescription,
  inferMaterialAndSource,
  reallocateJpyDeclaredValues,
  validateZonosPrepayDeclaration,
  runZonosPrepayDryRun
} from '../../utils/zonosCustomsValidation';
import { fetchEbayOrderData } from '../../services/ebayImportService';
import {
  loadEbayAccounts,
  saveEbayAccounts,
  addEbayAccount,
  removeEbayAccount,
  moveEbayAccount
} from '../../services/ebayAccountService';
import {
  exportPortableProjectJSON,
  parseAndValidatePortableProjectJSON,
  projectFileToDeclaration,
  saveAutosaveDeclaration,
  loadAutosaveDeclaration,
  ZonosPortableProjectFile
} from '../../services/zonosPortableProjectService';

import { EbayAccountManager } from './EbayAccountManager';
import { EbayOAuthPrepModal } from './EbayOAuthPrepModal';
import { ZonosItemEditor } from './ZonosItemEditor';
import { CopySuccessModal } from './CopySuccessModal';
import { OverwriteConfirmModal } from './OverwriteConfirmModal';
import { SecondComputerSetupGuide } from './SecondComputerSetupGuide';
import { SystemDiagnosticsChecklist } from './SystemDiagnosticsChecklist';
import { RefetchComparisonModal } from './RefetchComparisonModal';
import { ConflictResolutionModal } from './ConflictResolutionModal';

export const ZonosCustomsValidator: React.FC = () => {
  // Multi-eBay Account State (Dynamic Unlimited Accounts)
  const [ebayAccounts, setEbayAccounts] = useState<EbaySellerAccount[]>(loadEbayAccounts());
  const [selectedAccountId, setSelectedAccountId] = useState<string>('acc_01');
  const [prepModalAccount, setPrepModalAccount] = useState<EbaySellerAccount | null>(null);
  const [isOAuthPrepOpen, setIsOAuthPrepOpen] = useState<boolean>(false);

  // Search & Portable File States
  const [searchInput, setSearchInput] = useState<string>('ORDER-2026-8801');
  const [isImportLoading, setIsImportLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [plannedShipmentDate, setPlannedShipmentDate] = useState<string>('2026-08-13');
  const [declarationNotes, setDeclarationNotes] = useState<string>('2026年8月13日 発送予定 Zonos Prepay 申告プロジェクト');
  const [autosaveTime, setAutosaveTime] = useState<string | null>(null);

  // Declaration state
  const [declaration, setDeclaration] = useState<ZonosCustomsDeclaration | null>(null);

  // Modal & Conflict states
  const [isCopyModalOpen, setIsCopyModalOpen] = useState<boolean>(false);
  const [copySummary, setCopySummary] = useState<string>('');
  const [isSetupGuideOpen, setIsSetupGuideOpen] = useState<boolean>(false);
  const [isOverwriteModalOpen, setIsOverwriteModalOpen] = useState<boolean>(false);
  const [pendingImportProject, setPendingImportProject] = useState<ZonosPortableProjectFile | null>(null);
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState<boolean>(false);
  const [latestFetchedOrder, setLatestFetchedOrder] = useState<EbayOrderPayload | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);
  const [isDryRunModalOpen, setIsDryRunModalOpen] = useState<boolean>(false);
  const [dryRunReport, setDryRunReport] = useState<{
    isReadyForAugust13: boolean;
    executionLogs: string[];
    reviewedPayloadText: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeAccount = useMemo(() => {
    return ebayAccounts.find((a) => a.id === selectedAccountId) || ebayAccounts[0];
  }, [ebayAccounts, selectedAccountId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Initial Autosave Recovery & Initial Order Load
  useEffect(() => {
    const { declaration: savedDecl, timestamp } = loadAutosaveDeclaration();
    if (savedDecl) {
      setDeclaration(savedDecl);
      setAutosaveTime(timestamp);
    } else {
      handleFetchEbayOrder('ORDER-2026-8801');
    }
  }, []);

  // Autosave to localStorage on Declaration Update
  useEffect(() => {
    if (declaration) {
      saveAutosaveDeclaration(declaration);
      setAutosaveTime(new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }));
    }
  }, [declaration]);

  // Dynamic Account Actions
  const handleAddAccount = (name: string, username: string) => {
    const updated = addEbayAccount(name, username);
    setEbayAccounts(updated);
    showToast(`✅ 新規アカウント「${name}」を追加しました`);
  };

  const handleRemoveAccount = (id: string) => {
    const updated = removeEbayAccount(id);
    setEbayAccounts(updated);
    if (selectedAccountId === id) {
      setSelectedAccountId(updated[0]?.id || 'acc_01');
    }
    showToast('アカウントを削除しました');
  };

  const handleMoveAccount = (id: string, direction: 'up' | 'down') => {
    const updated = moveEbayAccount(id, direction);
    setEbayAccounts(updated);
  };

  const handleUpdateDisplayName = (accountId: string, newDisplayName: string) => {
    const updated = ebayAccounts.map((a) => (a.id === accountId ? { ...a, displayName: newDisplayName } : a));
    setEbayAccounts(updated);
    saveEbayAccounts(updated);
    showToast(`アカウント名を「${newDisplayName}」に更新しました`);
  };

  const handleDisconnectAccount = (accountId: string) => {
    const updated = ebayAccounts.map((a) =>
      a.id === accountId ? { ...a, connectionStatus: 'unconnected' as const, lastAuthDate: undefined } : a
    );
    setEbayAccounts(updated);
    saveEbayAccounts(updated);
    showToast('アカウント接続を解除しました');
  };

  // Handle Fetching eBay Order Data
  const handleFetchEbayOrder = async (queryStr?: string) => {
    const query = (queryStr || searchInput).trim();
    if (!query) {
      showToast('⚠️ eBay注文番号、Item ID、またはURLを入力してください。');
      return;
    }

    setIsImportLoading(true);
    try {
      const payload = await fetchEbayOrderData(query, selectedAccountId);
      if (payload) {
        if (declaration) {
          setLatestFetchedOrder(payload);
          setIsComparisonModalOpen(true);
        } else {
          applyOrderPayloadToDeclaration(payload);
          showToast(`✅ eBay注文データ (${payload.orderId}) を取得しました！`);
        }
      } else {
        showToast('⚠️ 該当するeBay注文データを検出できませんでした。');
      }
    } catch (e) {
      console.error('Failed to fetch eBay order:', e);
      showToast('❌ eBayデータの取得中にエラーが発生しました。');
    } finally {
      setIsImportLoading(false);
    }
  };

  // Transform Order Payload into Ver 2.0 Zonos Prepay Declaration
  const applyOrderPayloadToDeclaration = (payload: EbayOrderPayload) => {
    const currency = payload.currency || 'USD';
    const { rate, source, timestamp } = getExchangeRateInfo(currency);
    const targetJpyTotal = Math.round(payload.ebayTransactionValue * rate);

    const items: ZonosCustomsItem[] = [];

    payload.items.forEach((pItem, pIdx) => {
      const { material, productType, materialSource } = inferMaterialAndSource(pItem.title, pItem.derivedMaterial);
      const desc = generateZonosCustomsDescription(pItem.title, material, productType);

      items.push({
        id: `item-${Date.now()}-${pIdx}`,
        itemId: pItem.itemId,
        title: pItem.title,
        imageUrl: pItem.imageUrl,
        unitWeightGrams: pItem.unitWeightGrams || 250,
        subtotalWeightGrams: (pItem.unitWeightGrams || 250) * Math.max(1, pItem.quantity),
        weightKg: ((pItem.unitWeightGrams || 250) / 1000),
        weightUnit: 'g',
        weightSource: pItem.weightSource || '推定',
        isWeightEstimated: true,
        material,
        productType,
        customsDescription: desc,
        materialSource,
        quantity: Math.max(1, pItem.quantity),
        countryOfOrigin: 'Japan',
        declaredValueCents: dollarsToCents(pItem.actualPrice),
        declaredValue: pItem.actualPrice,
        unitValueJpy: Math.round((pItem.actualPrice * rate) / Math.max(1, pItem.quantity)),
        totalValueJpy: Math.round(pItem.actualPrice * rate),
        isIncludedItem: false,
        isSoldItem: true,
        isFreeGift: false,
        originWarning: false
      });

      if (pItem.knownFreeGifts && pItem.knownFreeGifts.length > 0) {
        pItem.knownFreeGifts.forEach((gift, gIdx) => {
          const giftDesc = generateZonosCustomsDescription(gift.title, gift.material, gift.productType);
          items.push({
            id: `gift-${Date.now()}-${pIdx}-${gIdx}`,
            itemId: pItem.itemId,
            title: `[おまけ] ${gift.title}`,
            imageUrl: pItem.imageUrl,
            unitWeightGrams: 50,
            subtotalWeightGrams: 50,
            weightKg: 0.05,
            weightUnit: 'g',
            weightSource: '推定',
            material: gift.material,
            productType: gift.productType,
            customsDescription: giftDesc,
            materialSource: 'inferred_listing',
            quantity: 1,
            countryOfOrigin: 'Japan',
            declaredValueCents: 100,
            declaredValue: 1.0,
            unitValueJpy: 200,
            totalValueJpy: 200,
            isIncludedItem: true,
            isSoldItem: false,
            isFreeGift: true,
            originWarning: false
          });
        });
      }
    });

    const rawDecl: ZonosCustomsDeclaration = {
      orderId: payload.orderId,
      itemId: payload.items[0]?.itemId,
      title: payload.items[0]?.title,
      imageUrl: payload.items[0]?.imageUrl,
      weightKg: 0.35,
      totalItemsWeightGrams: 300,
      packagingWeightGrams: 150,
      totalPackagedWeightGrams: 450,
      ebayTransactionValueCents: dollarsToCents(payload.ebayTransactionValue),
      ebayTransactionValue: payload.ebayTransactionValue,
      currency: payload.currency,
      exchangeRate: rate,
      exchangeRateSource: source,
      exchangeRateTimestamp: timestamp,
      ebayTransactionValueJpy: targetJpyTotal,
      carrier: 'JAPAN_POST',
      originCountry: 'JP',
      destinationCountry: payload.destinationCountry || 'United States (US)',
      shippingMethod: '国際小包 船便',
      items,
      declarationLocked: false,
      confirmedAt: new Date().toISOString(),
      orderDate: payload.orderDate,
      paymentStatus: payload.paymentStatus,
      fulfillmentStatus: payload.fulfillmentStatus,
      importedAt: new Date().toLocaleTimeString(),
      importSource: payload.importSource,
      selectedAccountId,
      selectedAccountDisplayName: activeAccount.displayName
    };

    const reallocated = reallocateJpyDeclaredValues(rawDecl);
    setDeclaration(reallocated);
  };

  const handleAutoGenerateCustoms = () => {
    if (!declaration) return;
    const updatedItems = declaration.items.map((item) => {
      const { material, productType, materialSource } = inferMaterialAndSource(item.title || '', item.material);
      const desc = generateZonosCustomsDescription(item.title || '', material, productType);
      return {
        ...item,
        material,
        productType,
        customsDescription: desc,
        materialSource: item.materialSource === 'manual' ? 'manual' : materialSource
      };
    });

    const updated = reallocateJpyDeclaredValues({
      ...declaration,
      items: updatedItems
    });
    setDeclaration(updated);
    showToast('✨ 申告内容（英文品名・材質・価格配分）を自動作成しました！');
  };

  const handleRecalculate = () => {
    if (!declaration) return;
    const updated = reallocateJpyDeclaredValues(declaration);
    setDeclaration(updated);
    showToast('🔄 申告価格の再計算を完了しました！');
  };

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
        totalDeclaredJpyValue: 0,
        jpyDifference: 0,
        isJpyTotalMatched: false,
        isFreeGiftValueInvalid: false,
        hasZeroValueItem: false,
        materialMissing: false,
        productTypeMissing: false,
        quantityInvalid: false,
        originMissing: false,
        valueInvalid: false,
        currencyMismatch: false,
        isDomesticShipment: false,
        carrierInvalid: false,
        originInvalid: false,
        destinationMissing: false,
        shippingMethodMissing: false,
        shippingConditionsValid: false,
        weightMissing: false
      };
    }
    return validateZonosPrepayDeclaration(declaration);
  }, [declaration]);

  const handleUpdateItem = (updatedItem: ZonosCustomsItem) => {
    if (!declaration) return;
    const updatedItems = declaration.items.map((i) => (i.id === updatedItem.id ? updatedItem : i));
    const reallocated = reallocateJpyDeclaredValues({
      ...declaration,
      items: updatedItems
    });
    setDeclaration(reallocated);
  };

  const handleDeleteItem = (id: string) => {
    if (!declaration) return;
    if (declaration.items.length <= 1) {
      showToast('⚠️ 最低1つの申告項目が必要です。');
      return;
    }
    const filtered = declaration.items.filter((i) => i.id !== id);
    const reallocated = reallocateJpyDeclaredValues({
      ...declaration,
      items: filtered
    });
    setDeclaration(reallocated);
    showToast('申告項目を削除しました');
  };

  const handleAddSplitProduct = () => {
    if (!declaration) return;
    const newItem: ZonosCustomsItem = {
      id: `item-${Date.now()}`,
      title: '追加品目 / 分割商品 (例: Paper Sticky Note)',
      material: 'Paper',
      productType: 'Sticky Note',
      customsDescription: 'Paper sticky note',
      materialSource: 'manual',
      quantity: 1,
      countryOfOrigin: 'Japan',
      declaredValueCents: 100,
      declaredValue: 1.0,
      unitValueJpy: 200,
      totalValueJpy: 200,
      unitWeightGrams: 50,
      subtotalWeightGrams: 50,
      weightUnit: 'g',
      weightSource: '手入力',
      isIncludedItem: true,
      isSoldItem: false,
      isFreeGift: true
    };
    const reallocated = reallocateJpyDeclaredValues({
      ...declaration,
      items: [...declaration.items, newItem]
    });
    setDeclaration(reallocated);
    showToast('➕ 新規品目を追加・分割しました');
  };

  const handleExportPortableProject = () => {
    if (!declaration) {
      showToast('⚠️ エクスポートする申告データがありません。');
      return;
    }
    exportPortableProjectJSON(declaration, validationStatus, plannedShipmentDate, declarationNotes);
    showToast('💻 別PC用ポータブル申告プロジェクト (.json) をエクスポートしました！');
  };

  const handleTriggerFileImport = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      const result = parseAndValidatePortableProjectJSON(content);

      if (!result.success || !result.project) {
        showToast(`❌ インポート失敗: ${result.error}`);
        return;
      }

      setPendingImportProject(result.project);

      // Detect duplicate or conflict
      if (declaration && declaration.orderId === result.project.ebayOrderId) {
        setIsConflictModalOpen(true);
      } else {
        setIsOverwriteModalOpen(true);
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!pendingImportProject) return;
    const importedDecl = projectFileToDeclaration(pendingImportProject);
    setDeclaration(importedDecl);
    setPlannedShipmentDate(pendingImportProject.plannedShipmentDate || '2026-08-13');
    setDeclarationNotes(pendingImportProject.notes || '');

    showToast(`✅ ポータブル申告プロジェクト (${pendingImportProject.shipmentId}) を読み込みました！`);

    setIsOverwriteModalOpen(false);
    setIsConflictModalOpen(false);
    setPendingImportProject(null);
  };

  const handleCopyZonosPayload = () => {
    if (!declaration || !validationStatus.isValid) {
      showToast('❌ 入力エラーまたは合計不一致があるためコピーできません。');
      return;
    }

    const rows = declaration.items.map((i) => {
      const desc = i.customsDescription || generateZonosCustomsDescription(i.title || '', i.material, i.productType);
      return `${desc}\t${i.quantity}\t${i.unitValueJpy || 0}\t${i.countryOfOrigin || 'Japan'}`;
    }).join('\n');

    const summaryStr = `--- Zonos Prepay Customs Copy ---\nOrder: ${declaration.orderId}\nShipment Date: ${plannedShipmentDate}\nTotal JPY: ${declaration.ebayTransactionValueJpy?.toLocaleString()} JPY\nRate: ${declaration.exchangeRate} JPY/${declaration.currency}\n\n[Customs Items]\nDescription\tQty\tUnit JPY\tOrigin\n${rows}`;

    navigator.clipboard.writeText(summaryStr);
    setCopySummary(summaryStr);
    setIsCopyModalOpen(true);
    showToast('📋 Zonos Prepay 用の申告データをクリップボードにコピーしました！');
  };

  const handleExportCSV = () => {
    if (!declaration) return;

    const headers = ['Shipment ID', 'Planned Date', 'Order ID', 'Item ID', 'Customs Description', 'Material', 'Product Type', 'Material Source', 'Qty', 'Unit Value JPY', 'Total Value JPY', 'Origin', 'Type'];
    const rows = declaration.items.map((i) => [
      `SHIP-${plannedShipmentDate.replace(/-/g, '')}`,
      plannedShipmentDate,
      declaration.orderId,
      i.itemId || '',
      `"${i.customsDescription || ''}"`,
      `"${i.material || ''}"`,
      `"${i.productType || ''}"`,
      i.materialSource || 'manual',
      i.quantity,
      i.unitValueJpy || 0,
      i.totalValueJpy || 0,
      i.countryOfOrigin || 'Japan',
      i.isFreeGift ? 'Free Gift' : 'Regular Item'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Zonos_Customs_Declaration_${declaration.orderId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('📊 申告CSVファイルをダウンロードしました！');
  };

  const handleRunDryRun = () => {
    if (!declaration) return;
    const report = runZonosPrepayDryRun(declaration);
    setDryRunReport(report);
    setIsDryRunModalOpen(true);
    showToast(report.isReadyForAugust13 ? '🟢 8月13日 本番Dry Run 判定: READY (準備完了)' : '🟡 8月13日 本番Dry Run 判定: 要修正箇所を検知');
  };

  const handleExchangeRateChange = (newRateVal: number) => {
    if (!declaration || isNaN(newRateVal) || newRateVal <= 0) return;
    const updatedDecl: ZonosCustomsDeclaration = {
      ...declaration,
      exchangeRate: newRateVal,
      exchangeRateSource: 'Operator Manual Override (2026-08-13 Readiness)'
    };
    const reallocated = reallocateJpyDeclaredValues(updatedDecl);
    setDeclaration(reallocated);
    showToast(`💱 為替レートを手動更新しました: ${newRateVal} JPY/${declaration.currency}`);
  };

  const daysRemaining = useMemo(() => {
    if (!plannedShipmentDate) return 0;
    const target = new Date(plannedShipmentDate).getTime();
    const today = new Date('2026-08-06').getTime();
    const diffTime = target - today;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [plannedShipmentDate]);

  return (
    <div className="zonos-customs-validator-container space-y-4 text-xs">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Account Switcher Header with Dynamic Unlimited Accounts */}
      <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg flex justify-between items-center flex-wrap gap-2">
        <div className="flex items-center space-x-3">
          <span className="text-xl">🛃</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">Zonos Prepay カスタム申告モジュール (マルチPC対応 Ver.2.5)</h3>
            <p className="text-[11px] text-slate-400">8月13日 本番発送対応 — アカウント数無制限・重複発送防止・競合検知付きポータブル申告プロジェクト</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-2.5 py-1 flex items-center gap-1 bg-slate-800 hover:bg-slate-700"
            onClick={() => setIsSetupGuideOpen(true)}
          >
            ⚙️ 2台目PCセットアップ手順
          </button>

          <EbayAccountManager
            accounts={ebayAccounts}
            selectedAccountId={selectedAccountId}
            onSelectAccount={(id) => {
              setSelectedAccountId(id);
              showToast(`アカウント切替: ${ebayAccounts.find(a => a.id === id)?.displayName}`);
            }}
            onUpdateDisplayName={handleUpdateDisplayName}
            onOpenConnectPrep={(acc) => {
              setPrepModalAccount(acc);
              setIsOAuthPrepOpen(true);
            }}
            onDisconnectAccount={handleDisconnectAccount}
            onAddAccount={handleAddAccount}
            onRemoveAccount={handleRemoveAccount}
            onMoveAccount={handleMoveAccount}
          />
        </div>
      </div>

      {/* Planned Shipment Date & Portable Export Bar */}
      <div className="card p-3 bg-slate-900 border border-blue-500/40 rounded-lg flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center space-x-3 flex-wrap gap-y-1">
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-blue-300">📅 発送予定日:</span>
            <input
              type="date"
              className="form-control text-xs font-mono bg-slate-950 border-slate-700 text-amber-300 font-bold px-2 py-1 rounded"
              value={plannedShipmentDate}
              onChange={(e) => setPlannedShipmentDate(e.target.value)}
            />
          </div>

          <span className="bg-slate-800 text-slate-300 font-mono text-[11px] px-2 py-1 rounded border border-slate-700 font-semibold">
            発送まで残り: <strong className="text-emerald-400">{daysRemaining} 日</strong> (目標: 2026-08-13)
          </span>

          {autosaveTime && (
            <span className="text-[10px] text-slate-400 font-mono">
              PCローカル自動保存: <strong>{autosaveTime}</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-2.5 py-1.5 flex items-center gap-1 bg-blue-950 border-blue-600/60 text-blue-300 hover:bg-blue-900"
            onClick={handleExportPortableProject}
            disabled={!declaration}
          >
            💾 申告データを保存
          </button>
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-2.5 py-1.5 flex items-center gap-1 bg-amber-950 border-amber-600/60 text-amber-300 hover:bg-amber-900"
            onClick={handleTriggerFileImport}
          >
            📂 申告データを読み込む
          </button>
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-2.5 py-1.5 flex items-center gap-1"
            onClick={handleExportPortableProject}
            disabled={!declaration}
          >
            💻 別PC用にエクスポート
          </button>
        </div>
      </div>

      {/* System Diagnostics Checklist */}
      <SystemDiagnosticsChecklist
        declaration={declaration}
        validation={validationStatus}
        activeAccount={activeAccount}
        plannedShipmentDate={plannedShipmentDate}
      />

      {/* Search & Fetch Input Bar */}
      <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg flex flex-wrap gap-2 items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-[300px]">
          <span className="font-bold text-slate-300">📥 検索入力:</span>
          <input
            type="text"
            className="form-control text-xs font-mono bg-slate-950 border-slate-700 text-amber-300 font-bold flex-1"
            placeholder="eBay Order Number (例: ORDER-2026-8801) / Item ID / URL"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFetchEbayOrder();
            }}
          />
          <button
            type="button"
            className="btn-primary text-xs font-bold px-3 py-1.5 flex items-center gap-1"
            onClick={() => handleFetchEbayOrder()}
            disabled={isImportLoading}
          >
            {isImportLoading ? <span className="spinner-sm"></span> : '📥 eBay情報を取得'}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5 flex items-center gap-1 bg-emerald-950 border-emerald-600/60 text-emerald-300 hover:bg-emerald-900"
            onClick={handleAutoGenerateCustoms}
            disabled={!declaration}
          >
            ✨ 申告内容を自動作成
          </button>
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5 flex items-center gap-1 bg-purple-950 border-purple-600/60 text-purple-300 hover:bg-purple-900"
            onClick={handleRunDryRun}
            disabled={!declaration}
          >
            🧪 8月13日 Dry Run (テスト実行)
          </button>
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5 flex items-center gap-1"
            onClick={handleRecalculate}
            disabled={!declaration}
          >
            🔄 再計算
          </button>
          <button
            type="button"
            className="btn-primary text-xs font-bold px-3 py-1.5 flex items-center gap-1 bg-blue-600 hover:bg-blue-500"
            onClick={handleCopyZonosPayload}
            disabled={!declaration || !validationStatus.isValid}
          >
            📋 Zonos用にコピー
          </button>
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5 flex items-center gap-1"
            onClick={handleExportCSV}
            disabled={!declaration}
          >
            📊 CSV出力
          </button>
        </div>
      </div>

      {/* Validation Status & Status Badges Bar */}
      {declaration && (
        <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <strong className="text-slate-200 font-bold">ステータスバッジ:</strong>
              
              <span className="bg-blue-900/80 text-blue-300 border border-blue-600/50 text-xs px-2 py-0.5 rounded font-bold">
                eBay情報
              </span>

              {declaration.items.some(i => i.materialSource === 'inferred_listing' || i.materialSource === 'inferred_photo') && (
                <span className="bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 text-xs px-2 py-0.5 rounded font-bold">
                  素材推定
                </span>
              )}

              {declaration.items.some(i => i.originWarning || !i.material || !i.productType) && (
                <span className="bg-amber-950 text-amber-300 border border-amber-500/80 text-xs px-2 py-0.5 rounded font-bold">
                  要確認
                </span>
              )}

              {validationStatus.isJpyTotalMatched ? (
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/80 text-xs px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  ✓ 合計一致 (0 JPY 差額)
                </span>
              ) : (
                <span className="bg-red-950 text-red-300 border border-red-500/80 text-xs px-2 py-0.5 rounded font-bold flex items-center gap-1">
                  ❌ 合計不一致 ({validationStatus.jpyDifference?.toLocaleString()}円 差額)
                </span>
              )}

              {validationStatus.isFreeGiftValueInvalid && (
                <span className="bg-red-950 text-red-300 border border-red-500/80 text-xs px-2 py-0.5 rounded font-bold">
                  おまけ金額エラー (0円以下)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-slate-400 font-mono">為替レート:</span>
              <input
                type="number"
                step="0.01"
                className="w-20 p-1 bg-slate-950 border border-slate-700 rounded text-amber-300 font-bold font-mono text-xs text-right"
                defaultValue={declaration.exchangeRate}
                onBlur={(e) => handleExchangeRateChange(parseFloat(e.target.value))}
              />
              <span className="font-mono text-slate-300">JPY/{declaration.currency}</span>
              <span className="text-[10px] text-slate-400 font-mono">({declaration.exchangeRateSource})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono">
            <div>
              <span className="text-slate-400 block text-[11px]">原通貨取引額 ({declaration.currency}):</span>
              <strong className="text-slate-200 text-sm">{declaration.ebayTransactionValue?.toFixed(2)} {declaration.currency}</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">目標 JPY 換算合計:</span>
              <strong className="text-amber-300 text-sm">{declaration.ebayTransactionValueJpy?.toLocaleString()} 円</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">販売商品 JPY 小計:</span>
              <strong className="text-emerald-400 text-sm">{declaration.regularItemsJpySubtotal?.toLocaleString()} 円</strong>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">おまけ JPY 小計:</span>
              <strong className={declaration.freeGiftsJpySubtotal! > 0 ? 'text-amber-400 text-sm' : 'text-red-400 text-sm'}>
                {declaration.freeGiftsJpySubtotal?.toLocaleString()} 円
              </strong>
            </div>
          </div>

          {validationStatus.errors.length > 0 && (
            <div className="p-3 bg-red-950/70 border border-red-500/80 rounded-lg space-y-1 text-red-200 font-semibold">
              {validationStatus.errors.map((err, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span>❌</span>
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Table Header & Split Controls */}
      {declaration && (
        <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <span>📋</span>
              <span>Zonos Prepay 申告明細テーブル ({declaration.items.length}件)</span>
            </h4>

            <button
              type="button"
              className="btn-secondary text-xs font-bold px-3 py-1.5 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border-slate-700"
              onClick={handleAddSplitProduct}
            >
              ➕ 別商品を分割・追加
            </button>
          </div>

          <div className="space-y-3">
            {declaration.items.map((item, idx) => (
              <ZonosItemEditor
                key={item.id}
                item={item}
                itemNumber={idx + 1}
                isLocked={declaration.declarationLocked}
                onUpdate={handleUpdateItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        </div>
      )}

      {/* Copy Success Modal */}
      {isCopyModalOpen && (
        <CopySuccessModal
          isOpen={isCopyModalOpen}
          onConfirm={() => setIsCopyModalOpen(false)}
          onRecheck={() => setIsCopyModalOpen(false)}
        />
      )}

      {/* OAuth Prep Modal */}
      {isOAuthPrepOpen && prepModalAccount && (
        <EbayOAuthPrepModal
          account={prepModalAccount}
          isOpen={isOAuthPrepOpen}
          onCancel={() => setIsOAuthPrepOpen(false)}
        />
      )}

      {/* Second Computer Setup Guide Modal */}
      {isSetupGuideOpen && (
        <SecondComputerSetupGuide
          isOpen={isSetupGuideOpen}
          onClose={() => setIsSetupGuideOpen(false)}
        />
      )}

      {/* Overwrite Confirmation Modal on File Import */}
      {isOverwriteModalOpen && pendingImportProject && (
        <OverwriteConfirmModal
          isOpen={isOverwriteModalOpen}
          onConfirm={(_mode) => handleConfirmImport()}
          onCancel={() => {
            setIsOverwriteModalOpen(false);
            setPendingImportProject(null);
          }}
        />
      )}

      {/* Conflict Resolution Warning Modal */}
      {isConflictModalOpen && pendingImportProject && declaration && (
        <ConflictResolutionModal
          isOpen={isConflictModalOpen}
          importedProject={pendingImportProject}
          currentLocalDeclaration={declaration}
          onAdoptImported={handleConfirmImport}
          onKeepLocal={() => {
            setIsConflictModalOpen(false);
            setPendingImportProject(null);
            showToast('本PCのローカルデータを保護し維持しました。');
          }}
          onMergeUnedited={handleConfirmImport}
          onCancel={() => {
            setIsConflictModalOpen(false);
            setPendingImportProject(null);
          }}
        />
      )}

      {/* Side-by-Side Refetch Comparison Modal */}
      {isComparisonModalOpen && latestFetchedOrder && declaration && (
        <RefetchComparisonModal
          isOpen={isComparisonModalOpen}
          importedDeclaration={declaration}
          latestEbayOrder={latestFetchedOrder}
          onKeepImported={() => {
            setIsComparisonModalOpen(false);
            setLatestFetchedOrder(null);
            showToast('インポートされた申告内容を維持しました。');
          }}
          onAdoptLatestEbay={() => {
            applyOrderPayloadToDeclaration(latestFetchedOrder);
            setIsComparisonModalOpen(false);
            setLatestFetchedOrder(null);
            showToast('eBay最新注文情報を採用し申告内容を自動更新しました。');
          }}
          onClose={() => {
            setIsComparisonModalOpen(false);
            setLatestFetchedOrder(null);
          }}
        />
      )}

      {/* 8月13日 本番 Dry Run (テスト実行) 結果モーダル */}
      {isDryRunModalOpen && dryRunReport && (
        <div className="modal-overlay">
          <div className="modal-card max-w-2xl bg-slate-900 border border-slate-700 text-slate-100 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🧪</span>
                <div>
                  <h3 className="font-bold text-sm text-slate-100">8月13日 本番発送 Dry Run (テスト実行) 判定レポート</h3>
                  <p className="text-[10px] text-slate-400">実API送信・決済・変更を行わず、全14項目および手動転記ペイロードの整合性を完全検証</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold ${dryRunReport.isReadyForAugust13 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'}`}>
                {dryRunReport.isReadyForAugust13 ? '🟢 判定: READY (準備完了)' : '🟡 判定: REVIEW_REQUIRED (要確認)'}
              </span>
            </div>

            {/* Logs box */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold">検証ログ (Execution Trace):</span>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 font-mono text-[11px] space-y-1 max-h-36 overflow-y-auto">
                {dryRunReport.executionLogs.map((log, idx) => (
                  <div key={idx} className={log.includes('Error') ? 'text-red-400 font-bold' : log.includes('PASS') ? 'text-emerald-400 font-bold' : 'text-slate-300'}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Formatted payload */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold">手動転記用整形データ (Manual Entry Payload):</span>
              <textarea
                readOnly
                className="w-full h-36 p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-200 resize-none"
                value={dryRunReport.reviewedPayloadText}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-bold"
                onClick={() => setIsDryRunModalOpen(false)}
              >
                閉じる
              </button>
              <button
                type="button"
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-slate-100 rounded text-xs font-bold"
                onClick={() => {
                  navigator.clipboard.writeText(dryRunReport.reviewedPayloadText);
                  showToast('📋 整形済み申告データをクリップボードにコピーしました！');
                }}
              >
                📋 転記用テキストをコピー
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
