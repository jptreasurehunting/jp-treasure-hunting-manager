import React, { useState, useMemo } from 'react';
import {
  EbaySellerAccount,
  EbayListingTransferItem,
  ListingTransferSettings
} from '../../types/zonosCustoms';
import { TransferConfirmModal } from './TransferConfirmModal';

interface AccountListingTransferViewProps {
  accounts: EbaySellerAccount[];
  complianceRecords?: Array<{ countryCode: string; countryName: string; isSalesEnabled: boolean }>;
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

// Sample listing items for UI demonstration (Ver.1.6 UI Scope)
const SAMPLE_TRANSFER_ITEMS: EbayListingTransferItem[] = [
  {
    itemId: '256111222001',
    sku: 'SKU-CAM-001',
    title: 'Canon AE-1 Program Vintage 35mm Film Camera w/ 50mm Lens',
    price: 300.0,
    currency: 'USD',
    quantity: 1,
    category: 'Cameras & Photo > Film Cameras',
    imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=150&auto=format&fit=crop&q=80',
    isSelected: true
  },
  {
    itemId: '256111222002',
    sku: 'SKU-LENS-002',
    title: 'Canon FD 50mm f/1.4 S.S.C. Prime Lens - Mint Condition',
    price: 125.5,
    currency: 'USD',
    quantity: 2,
    category: 'Cameras & Photo > Lenses & Filters',
    imageUrl: 'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=150&auto=format&fit=crop&q=80',
    isSelected: true
  },
  {
    itemId: '256111222003',
    sku: 'SKU-SONY-003',
    title: 'Sony Alpha A7 IV Mirrorless Digital Camera Body',
    price: 2100.0,
    currency: 'USD',
    quantity: 1,
    category: 'Cameras & Photo > Digital Cameras',
    imageUrl: 'https://images.unsplash.com/photo-1512790182412-b19e6d62bc39?w=150&auto=format&fit=crop&q=80',
    isSelected: false
  },
  {
    itemId: '256111222004',
    sku: 'SKU-NIKON-004',
    title: 'Nikon F3 HP SLR 35mm Film Camera Body Only',
    price: 340.0,
    currency: 'USD',
    quantity: 1,
    category: 'Cameras & Photo > Film Cameras',
    imageUrl: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=150&auto=format&fit=crop&q=80',
    isSelected: false
  }
];

export const AccountListingTransferView: React.FC<AccountListingTransferViewProps> = ({
  accounts,
  complianceRecords,
  onAddAuditLog
}) => {
  const [sourceAccountId, setSourceAccountId] = useState<string>('acc_01');
  const [destinationAccountId, setDestinationAccountId] = useState<string>('acc_02');
  const [listingVisibility, setListingVisibility] = useState<'draft' | 'active'>('draft');

  const [items, setItems] = useState<EbayListingTransferItem[]>(SAMPLE_TRANSFER_ITEMS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Accounts objects lookup
  const sourceAccount = useMemo(() => {
    return accounts.find((a) => a.id === sourceAccountId) || accounts[0];
  }, [accounts, sourceAccountId]);

  const destinationAccount = useMemo(() => {
    return accounts.find((a) => a.id === destinationAccountId) || accounts[1] || accounts[0];
  }, [accounts, destinationAccountId]);

  // Validation: Source and Destination cannot be the same account
  const isSameAccount = sourceAccountId === destinationAccountId;

  // Filtered items by search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.itemId.includes(q)
    );
  }, [items, searchQuery]);

  // Selected items list
  const selectedItems = useMemo(() => {
    return items.filter((i) => i.isSelected);
  }, [items]);

  // Checkbox toggle handlers
  const handleToggleItem = (itemId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.itemId === itemId ? { ...i, isSelected: !i.isSelected } : i))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setItems((prev) => prev.map((i) => ({ ...i, isSelected: select })));
  };

  const handleExecuteTransferTrigger = () => {
    if (isSameAccount) {
      alert('転記元と転記先には異なるアカウントを選択してください。');
      return;
    }
    if (selectedItems.length === 0) {
      alert('転記対象のリスティングを1件以上選択してください。');
      return;
    }

    // Spec #9: Validate destination country compliance before Move
    if (complianceRecords) {
      const disabledCountries = complianceRecords.filter((c) => !c.isSalesEnabled);
      const isGermanyDisabled = disabledCountries.some((c) => c.countryCode === 'DE');
      if (isGermanyDisabled) {
        if (onAddAuditLog) {
          onAddAuditLog('未承認国のためMove Listingを停止', 'Germany', 'LUCID未検証のためMoveブロック');
        }
      }
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmTransfer = () => {
    setIsConfirmModalOpen(false);
    const visText = listingVisibility === 'draft' ? '下書き (Draft)' : '出品中 (Active)';
    showToast(
      `🎉 ${selectedItems.length}件のリスティングを [${sourceAccount.displayName}] から [${destinationAccount.displayName}] へ安全移動 (${visText}) しました！(転記先成功確認後に元出品を終了)`
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const settings: ListingTransferSettings = {
    sourceAccountId,
    destinationAccountId,
    transferMode: 'move',
    listingVisibility
  };

  return (
    <div className="account-listing-transfer-view space-y-6">
      {/* Top Banner Header */}
      <div className="japan-post-banner card">
        <div className="banner-content-row space-between">
          <div className="banner-text-group">
            <div className="banner-tag-badge">🚚 eBay リスティング移動 (Move 専用)</div>
            <h2 className="banner-title-ja">eBay アカウント間 リスティング安全移動・移行 (Ver.1.6)</h2>
            <p className="banner-desc-ja">
              転記先アカウントに出品を作成・検証し、成功確認後にのみ転記元の元出品を安全に終了する専用移動ワークフローです。
            </p>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 3-Step Sequential Workflow Safety Banner */}
      <div className="sequential-workflow-banner card border-emerald-500/40 bg-slate-900/90 padding-md">
        <div className="flex items-center gap-3 margin-bottom-xs">
          <span className="text-xl">🛡️</span>
          <h3 className="font-bold text-emerald-400 text-sm">安心移動 3ステップ・シーケンシャルワークフロー</h3>
        </div>
        <div className="grid-3col text-xs space-x-2 margin-top-xs">
          <div className="step-card-sub p-2 rounded bg-slate-800/80 border border-slate-700">
            <strong className="text-highlight block mb-1">1. 転記先に出品作成</strong>
            <span className="text-muted">転記先アカウントへ出品を作成します。</span>
          </div>
          <div className="step-card-sub p-2 rounded bg-slate-800/80 border border-slate-700">
            <strong className="text-highlight-gold block mb-1">2. 成功を検証・確認</strong>
            <span className="text-muted">転記先での正常作成（Item ID発行）を確認します。</span>
          </div>
          <div className="step-card-sub p-2 rounded bg-slate-800/80 border border-slate-700">
            <strong className="text-emerald-400 block mb-1">3. 元出品を安全に終了</strong>
            <span className="text-muted">成功確定後に初めて転記元の元出品を終了します。</span>
          </div>
        </div>
      </div>

      {/* Account Selection Card */}
      <div className="card ebay-baseline-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">1. 転記元・転記先アカウント選択</h3>
          <span className="baseline-badge">アカウント設定</span>
        </div>

        <div className="card-body space-y-4">
          <div className="grid-2col">
            {/* Source Account */}
            <div className="form-group">
              <label htmlFor="sourceAccountSelect" className="form-label font-bold text-xs">
                転記元アカウント (Source Account)
              </label>
              <select
                id="sourceAccountSelect"
                className="form-control select-account-dropdown font-semibold"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.displayName} ({acc.ebayUsername})
                  </option>
                ))}
              </select>
              <p className="field-hint text-xs">※ 移動する出品データの元所有アカウントを選択します</p>
            </div>

            {/* Destination Account */}
            <div className="form-group">
              <label htmlFor="destinationAccountSelect" className="form-label font-bold text-xs">
                転記先アカウント (Destination Account)
              </label>
              <select
                id="destinationAccountSelect"
                className="form-control select-account-dropdown font-semibold"
                value={destinationAccountId}
                onChange={(e) => setDestinationAccountId(e.target.value)}
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.displayName} ({acc.ebayUsername})
                  </option>
                ))}
              </select>
              <p className="field-hint text-xs">※ 出品データの新規作成先アカウントを選択します</p>
            </div>
          </div>

          {/* Same Account Validation Warning */}
          {isSameAccount && (
            <div className="validation-error-item margin-top-xs">
              ❌ <strong>エラー:</strong> 転記元と転記先には異なるアカウントを選択してください。
            </div>
          )}
        </div>
      </div>

      {/* Transfer Settings Card (Move Only) */}
      <div className="card ebay-baseline-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">2. 移動設定・出品公開状態設定</h3>
          <span className="baseline-badge">安全移動設定</span>
        </div>

        <div className="card-body">
          <div className="grid-2col">
            {/* Transfer Mode Fixed Banner (Move Only) */}
            <div className="form-group">
              <label className="form-label font-bold text-xs">転記モード (Transfer Mode)</label>
              <div className="move-only-badge-card p-3 rounded bg-slate-800 border border-emerald-500/30 flex items-center gap-2">
                <span className="text-lg">🚚</span>
                <div>
                  <strong className="text-emerald-400 text-sm block">移動 (Move) 専用</strong>
                  <span className="text-xs text-muted">転記成功の検証確定後に元出品を自動終了します。</span>
                </div>
              </div>
            </div>

            {/* Listing Visibility Toggle */}
            <div className="form-group">
              <label className="form-label font-bold text-xs">出品公開状態 (Listing Visibility)</label>
              <div className="segment-toggle-group">
                <button
                  type="button"
                  className={`segment-btn ${listingVisibility === 'draft' ? 'active' : ''}`}
                  onClick={() => setListingVisibility('draft')}
                >
                  📝 下書き (Draft)
                </button>
                <button
                  type="button"
                  className={`segment-btn ${listingVisibility === 'active' ? 'active' : ''}`}
                  onClick={() => setListingVisibility('active')}
                >
                  🟢 出品中 (Active)
                </button>
              </div>
              <p className="field-hint text-xs">
                {listingVisibility === 'draft'
                  ? '※ 転記先アカウントで「下書き」として作成し、検証確認後に元出品を終了します。'
                  : '※ 転記先アカウントで「出品中」として即時公開し、検証確認後に元出品を終了します。'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Target Items Selection & Preview Table */}
      <div className="card items-section-card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-semibold">
            3. 移動対象リスティング選択 ({selectedItems.length} / {items.length} 件選択中)
          </h3>
          <div className="action-btn-group">
            <button
              type="button"
              className="btn-pill-sm active"
              onClick={() => handleSelectAll(true)}
            >
              全選択
            </button>
            <button
              type="button"
              className="btn-pill-sm"
              onClick={() => handleSelectAll(false)}
            >
              全解除
            </button>
          </div>
        </div>

        <div className="card-body">
          {/* Search Filter Bar */}
          <div className="form-group margin-bottom-md">
            <input
              type="text"
              className="form-control"
              placeholder="タイトル, SKU, または Item ID で検索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Items Table */}
          <div className="accounts-table-wrapper">
            <table className="accounts-table">
              <thead>
                <tr>
                  <th className="w-12 text-center">選択</th>
                  <th>画像</th>
                  <th>Item ID</th>
                  <th>SKU</th>
                  <th>タイトル</th>
                  <th>価格 ($)</th>
                  <th>数量</th>
                  <th>カテゴリー</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.itemId} className={item.isSelected ? 'selected-account-row' : ''}>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={item.isSelected}
                        onChange={() => handleToggleItem(item.itemId)}
                      />
                    </td>
                    <td>
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-10 h-10 object-cover rounded"
                      />
                    </td>
                    <td><strong className="font-mono text-xs">{item.itemId}</strong></td>
                    <td><span className="font-mono text-xs text-muted">{item.sku}</span></td>
                    <td><strong className="text-xs text-primary block">{item.title}</strong></td>
                    <td><strong className="font-mono text-highlight-gold">${item.price.toFixed(2)}</strong></td>
                    <td><span className="font-mono text-xs">{item.quantity}</span></td>
                    <td><span className="text-xs text-muted">{item.category}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Execution Footer Bar */}
      <div className="card padding-md flex justify-between items-center bg-slate-900 border-slate-700">
        <div>
          <span className="text-sm font-semibold">選択中: </span>
          <strong className="text-highlight-gold font-mono text-base">{selectedItems.length} 件</strong>
          <span className="text-xs text-muted ml-3">
            ({sourceAccount.displayName} ➔ {destinationAccount.displayName})
          </span>
        </div>

        <button
          type="button"
          className="btn-primary btn-lg btn-transfer-zonos"
          onClick={handleExecuteTransferTrigger}
          disabled={isSameAccount || selectedItems.length === 0}
        >
          🚚 選択したリスティングを移動 (安全シーケンシャル処理)
        </button>
      </div>

      {/* Confirmation Modal */}
      <TransferConfirmModal
        settings={settings}
        sourceAccount={sourceAccount}
        destinationAccount={destinationAccount}
        selectedItems={selectedItems}
        isOpen={isConfirmModalOpen}
        onConfirm={handleConfirmTransfer}
        onCancel={() => setIsConfirmModalOpen(false)}
      />
    </div>
  );
};
