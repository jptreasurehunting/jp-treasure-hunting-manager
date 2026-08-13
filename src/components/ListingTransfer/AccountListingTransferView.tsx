import React, { useState, useMemo } from 'react';
import { EbaySellerAccount, CountryComplianceRecord, EbayListingTransferItem } from '../../types/zonosCustoms';
import { MOCK_ACTIVE_LISTINGS } from '../../data/mockActiveListings';
import { DuplicateListingWarningModal } from '../Compliance/DuplicateListingWarningModal';

interface AccountListingTransferViewProps {
  accounts: EbaySellerAccount[];
  complianceRecords: CountryComplianceRecord[];
  onAddAuditLog: (action: string, beforeState?: string, afterState?: string) => void;
}

export const AccountListingTransferView: React.FC<AccountListingTransferViewProps> = ({
  accounts,
  complianceRecords,
  onAddAuditLog
}) => {
  // 1. 接続済み（connected）セラーアカウントのみを抽出
  const connectedAccounts = useMemo(() => accounts.filter(a => a.connectionStatus === 'connected'), [accounts]);

  // デフォルト値: 接続されているアカウントのうち最初の2つを割り当てる
  const initialSourceId = connectedAccounts[0]?.id || '';
  const initialDestId = connectedAccounts[1]?.id || connectedAccounts[0]?.id || '';

  const [sourceAccountId, setSourceAccountId] = useState<string>(initialSourceId);
  const [destinationAccountId, setDestinationAccountId] = useState<string>(initialDestId);
  const [listingVisibility, setListingVisibility] = useState<'draft' | 'active'>('draft');

  // 2. リスティングデータ状態
  const [items, setItems] = useState<EbayListingTransferItem[]>(() =>
    MOCK_ACTIVE_LISTINGS.map(item => ({
      itemId: item.itemId,
      sku: item.sku || '',
      title: item.title,
      price: item.price,
      currency: item.currency,
      quantity: item.quantity,
      category: item.category,
      imageUrl: item.imageUrl,
      isSelected: false
    }))
  );

  // 3. ローディングやトースト表示
  const [isTransferring, setIsTransferring] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 4. 重複出品警告モーダルの状態
  const [duplicateModalOpen, setDuplicateModalOpen] = useState<boolean>(false);
  const [duplicateItem, setDuplicateItem] = useState<{ sku: string; title: string } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const sourceAccount = accounts.find(a => a.id === sourceAccountId);
  const destAccount = accounts.find(a => a.id === destinationAccountId);

  // ドイツ包装法(LUCID)の適合チェック
  const destGermanyCompliant = useMemo(() => {
    const deRec = complianceRecords.find(r => r.countryCode === 'DE');
    return deRec ? deRec.isSalesEnabled : false;
  }, [complianceRecords]);

  // ドイツ以外も含めた全規制適合チェック（移行先アカウント基準）
  const blockedCountries = useMemo(() => {
    return complianceRecords.filter(r => !r.isSalesEnabled && r.countryCode !== 'US' && r.countryCode !== 'CA' && r.countryCode !== 'AU');
  }, [complianceRecords]);

  const selectedCount = useMemo(() => items.filter(i => i.isSelected).length, [items]);

  // 必須条件に基づく現在発生している全ての実行不可理由の配列
  const validationErrors = useMemo((): string[] => {
    const errors: string[] = [];

    if (items.length > 0 && selectedCount === 0) {
      errors.push('移転するリスティングを1件以上選択してください。');
    }
    if (!sourceAccountId) {
      errors.push('コピー元の接続済みセラーアカウントを選択してください。');
    }
    if (!destinationAccountId) {
      errors.push('コピー先の接続済みセラーアカウントを選択してください。');
    }

    const srcAcc = accounts.find(a => a.id === sourceAccountId);
    const dstAcc = accounts.find(a => a.id === destinationAccountId);

    if (srcAcc && srcAcc.connectionStatus !== 'connected') {
      errors.push(`コピー元アカウント [${srcAcc.displayName}] が接続状態ではありません。`);
    }
    if (dstAcc && dstAcc.connectionStatus !== 'connected') {
      errors.push(`コピー先アカウント [${dstAcc.displayName}] が接続状態ではありません。`);
    }
    if (sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId) {
      errors.push('コピー元とコピー先には異なるアカウントを指定してください。');
    }
    if (!destGermanyCompliant) {
      errors.push('コピー先アカウントはドイツ包装法(LUCID)への適合が未完了です。ドイツ向け発送設定が含まれる商品は適合完了まで移行できません。');
    }
    if (blockedCountries.length > 0) {
      const countryNames = blockedCountries.map(c => c.countryName).join(', ');
      errors.push(`コピー先アカウントで以下の配送先国のコンプライアンス適合が未完了です: ${countryNames}`);
    }

    return errors;
  }, [items, selectedCount, sourceAccountId, destinationAccountId, accounts, destGermanyCompliant, blockedCountries]);

  // チェックボックス切り替え
  const handleSelectItem = (itemId: string) => {
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, isSelected: !i.isSelected } : i));
  };

  // 全選択・全解除
  const handleSelectAll = (checked: boolean) => {
    setItems(prev => prev.map(i => ({ ...i, isSelected: checked })));
  };

  // 転記実行トリガー
  const handleStartTransfer = () => {
    const selectedItems = items.filter(i => i.isSelected);

    // ガード条件 1: リスティング未選択（通常の未選択状態は監査ログを出さない）
    if (selectedItems.length === 0) {
      alert('⚠️ 移行対象のリスティングを選択してください。');
      return;
    }

    const srcAcc = accounts.find(a => a.id === sourceAccountId);
    const dstAcc = accounts.find(a => a.id === destinationAccountId);

    // ガード条件 2〜5: 実行不可判定の再確認 (関数先頭での防御)
    const criticalErrors: string[] = [];
    if (!srcAcc || srcAcc.connectionStatus !== 'connected') {
      criticalErrors.push('コピー元アカウント未接続');
    }
    if (!dstAcc || dstAcc.connectionStatus !== 'connected') {
      criticalErrors.push('コピー先アカウント未接続');
    }
    if (sourceAccountId === destinationAccountId) {
      criticalErrors.push('コピー元とコピー先が同一アカウント');
    }
    if (!destGermanyCompliant) {
      criticalErrors.push('移行先ドイツ包装法(LUCID)未適合');
    }
    if (blockedCountries.length > 0) {
      const countryCodes = blockedCountries.map(c => c.countryCode).join(', ');
      criticalErrors.push(`移行先配送先不適合 (${countryCodes})`);
    }

    if (criticalErrors.length > 0) {
      const errorMsg = criticalErrors.join(', ');
      // 監査ログに移行拒否エラーを詳細に記録
      onAddAuditLog(
        'eBayリスティング移行拒否',
        `移行元: ${srcAcc?.displayName || sourceAccountId} -> 移行先: ${dstAcc?.displayName || destinationAccountId}`,
        `安全ガード作動: [${errorMsg}] により移行処理を強制中断しました。`
      );
      alert(`❌ 安全ガードにより移行を中止しました。\n理由:\n${criticalErrors.map(err => `・${err}`).join('\n')}`);
      return;
    }

    // 重複ポリシーチェックのシミュレーション
    const hasDuplicate = selectedItems.find(i => i.sku === 'CANON-AE1-001');
    if (hasDuplicate) {
      setDuplicateItem({ sku: hasDuplicate.sku, title: hasDuplicate.title });
      setDuplicateModalOpen(true);
      onAddAuditLog(
        '重複出品ポリシー警告検出',
        `移行元: ${srcAcc?.displayName || sourceAccountId}`,
        `重複SKU: ${hasDuplicate.sku}`
      );
      return;
    }

    // 通常の移行実行
    executeTransfer(selectedItems);
  };

  // 実際の移行処理（シミュレーション）
  const executeTransfer = (itemsToTransfer: EbayListingTransferItem[]) => {
    setIsTransferring(true);
    setDuplicateModalOpen(false);

    setTimeout(() => {
      setIsTransferring(false);

      const skuList = itemsToTransfer.map(i => i.sku).join(', ');
      onAddAuditLog(
        'eBayリスティング移行完了',
        `移行元: ${sourceAccount?.displayName || sourceAccountId} (件数: ${itemsToTransfer.length})`,
        `移行先: ${destAccount?.displayName || destinationAccountId} | 状態: ${listingVisibility === 'draft' ? '下書き(Draft)' : 'アクティブ(Active)'} | SKU: ${skuList}`
      );

      showToast(`✓ ${itemsToTransfer.length}件の出品データを ${destAccount?.displayName || '移行先アカウント'} へ正常に移行しました！`);

      // 移行完了したものを未選択に戻す
      setItems(prev => prev.map(i => ({ ...i, isSelected: false })));
    }, 1500);
  };

  return (
    <div className="account-listing-transfer-container space-y-6">
      {/* ページ案内 */}
      <div className="japan-post-banner card">
        <div className="banner-content-row space-between">
          <div className="banner-text-group">
            <div className="banner-tag-badge">🔄 eBay アカウント間連携 (Ver.1.6)</div>
            <h2 className="banner-title-ja">eBay Listing Transfer Manager (リスティング転記・移行)</h2>
            <p className="banner-desc-ja">
              接続済みのeBayセラーアカウント間での出品データの複製・移転シミュレーションを行います。
              重複出品（Duplicate Listing）によるアカウント規制ポリシーの適用を未然に防ぎます。
            </p>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* アカウント設定 & 適合性確認 */}
      <div className="grid-2col gap-4">
        {/* アカウント設定カード */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title text-base font-bold">1. アカウント設定 & 転記モード</h3>
          </div>
          <div className="card-body space-y-4">
            <div className="grid-2col gap-3">
              {/* コピー元セレクトボックス (接続済みアカウントのみ表示) */}
              <div className="form-group">
                <label className="form-label text-xs font-bold">コピー元セラーアカウント (Source)</label>
                <select
                  className="form-control"
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  disabled={connectedAccounts.length === 0}
                >
                  {connectedAccounts.length === 0 ? (
                    <option value="">接続済みアカウントがありません</option>
                  ) : (
                    connectedAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.displayName} ({acc.ebayUsername})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* コピー先セレクトボックス (接続済みアカウントのみ表示) */}
              <div className="form-group">
                <label className="form-label text-xs font-bold">コピー先セラーアカウント (Destination)</label>
                <select
                  className="form-control"
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                  disabled={connectedAccounts.length === 0}
                >
                  {connectedAccounts.length === 0 ? (
                    <option value="">接続済みアカウントがありません</option>
                  ) : (
                    connectedAccounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.displayName} ({acc.ebayUsername})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {sourceAccountId && destinationAccountId && sourceAccountId === destinationAccountId && (
              <div className="validation-error-item text-xs mt-2 border-red-500/30 bg-red-500/10 text-danger">
                ❌ コピー元とコピー先には異なるアカウントを設定してください。
              </div>
            )}

            <div className="grid-2col gap-3">
              <div className="form-group">
                <label className="form-label text-xs font-bold">転記モード (Transfer Mode)</label>
                <input
                  type="text"
                  className="form-control readonly-input"
                  value="Move Listing (アカウント間移転)"
                  readOnly
                />
              </div>

              <div className="form-group">
                <label className="form-label text-xs font-bold">公開ステータス (Listing Visibility)</label>
                <select
                  className="form-control"
                  value={listingVisibility}
                  onChange={(e) => setListingVisibility(e.target.value as 'draft' | 'active')}
                >
                  <option value="draft">Draft (下書きとして転記 - 推奨)</option>
                  <option value="active">Active (即時出品として公開)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 移行適合性チェック結果カード */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title text-base font-bold">2. 移行先アカウントの配送先適合チェック</h3>
          </div>
          <div className="card-body text-xs space-y-3">
            <div className="flex items-center justify-between p-2 bg-slate-900 border border-slate-700 rounded">
              <span className="font-bold">🇩🇪 ドイツ向け配送適合状況 (LUCID包装法)</span>
              {destGermanyCompliant ? (
                <span className="status-badge status-connected">🟢 適合完了 (Available)</span>
              ) : (
                <span className="status-badge status-unconnected text-danger">⚠️ 未適合 (Locked)</span>
              )}
            </div>

            {blockedCountries.length > 0 && (
              <div className="card-sub-box bg-amber-500/10 border-amber-500/30">
                <h4 className="font-bold text-amber-400 mb-1">⚠️ 警告: 以下の配送先国がロックされています</h4>
                <p className="text-slate-300">
                  移行先アカウントにおいて、以下の国々がコンプライアンス管理画面で有効化されていません。
                  該当国への発送設定を含む商品は、適合登録が完了するまで販売できません。
                </p>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-muted">
                  {blockedCountries.map(c => (
                    <li key={c.countryCode}>{c.countryName} ({c.countryCode})</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-muted">
              💡 移行先アカウントの適合状況に応じて、出品商品の配送除外設定（Excluding Shipping Locations）が移行時に自動調整されます。
            </p>
          </div>
        </div>
      </div>

      {/* 対象Listing一覧 */}
      <div className="card">
        <div className="card-header space-between">
          <h3 className="card-title text-base font-bold">3. 移転対象リスティングの選択</h3>
          <span className="api-sync-badge">
            選択中: <strong>{selectedCount}</strong> 件
          </span>
        </div>

        <div className="card-body">
          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th style={{ width: '40px' }} className="text-center">
                    <input
                      type="checkbox"
                      checked={items.length > 0 && items.every(i => i.isSelected)}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th style={{ width: '80px' }}>画像</th>
                  <th style={{ width: '120px' }}>Item ID</th>
                  <th style={{ width: '140px' }}>SKU</th>
                  <th>商品名 / カテゴリー</th>
                  <th style={{ width: '100px' }} className="text-right">価格</th>
                  <th style={{ width: '80px' }} className="text-center">数量</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.itemId} className={item.isSelected ? 'selected-account-row' : ''}>
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={item.isSelected}
                        onChange={() => handleSelectItem(item.itemId)}
                      />
                    </td>
                    <td>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="product-thumb" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <div className="no-image-box" style={{ width: '50px', height: '50px' }}>No Image</div>
                      )}
                    </td>
                    <td className="font-mono text-highlight-gold font-bold">{item.itemId}</td>
                    <td className="font-mono text-muted">{item.sku}</td>
                    <td>
                      <div><strong>{item.title}</strong></div>
                      <div className="text-muted text-xxs mt-0.5">{item.category}</div>
                    </td>
                    <td className="text-right font-mono font-bold text-highlight">${item.price.toFixed(2)}</td>
                    <td className="text-center font-mono">{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 移行不可の理由メッセージ領域 */}
          {validationErrors.length > 0 && (
            <div className={`p-3 rounded border text-xs margin-top-lg margin-bottom-md ${
              validationErrors.length === 1 && validationErrors[0] === '移転するリスティングを1件以上選択してください。'
                ? 'bg-slate-900 border-slate-700 text-muted'
                : 'bg-red-500/10 border-red-500/30 text-danger'
            }`}>
              <div className="font-bold mb-1">⚠️ 移行を実行するための必須条件:</div>
              {validationErrors.length === 1 ? (
                <div>{validationErrors[0]}</div>
              ) : (
                <ul className="list-disc pl-4 space-y-1">
                  {validationErrors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* 実行ボタン領域 */}
          <div className="margin-top-lg flex justify-end">
            <button
              type="button"
              className={validationErrors.length > 0 ? "btn-zonos btn-disabled-prep" : "btn-zonos"}
              style={{ minWidth: '220px', padding: '0.8rem 1.5rem', fontSize: '0.9rem' }}
              disabled={validationErrors.length > 0 || isTransferring}
              onClick={handleStartTransfer}
            >
              {isTransferring ? (
                <span>⏳ 移転データを生成中...</span>
              ) : (
                <span>⚡ 選択したリスティングの移行を実行</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 重複ポリシー警告モーダルのレンダリング */}
      {duplicateItem && (
        <DuplicateListingWarningModal
          sku={duplicateItem.sku}
          itemTitle={duplicateItem.title}
          existingAccountName={destAccount?.displayName || destinationAccountId}
          isOpen={duplicateModalOpen}
          onOpenExisting={() => {
            alert('既存の出品ページ (eBay Listing) を開きます。');
            setDuplicateModalOpen(false);
          }}
          onAddDestinationToExisting={() => {
            alert('既存出品の配送地域に適合国を追加しました。');
            setDuplicateModalOpen(false);
            onAddAuditLog('既存出品へ配送地域追加', duplicateItem.sku, `移行先アカウントに宛先国を追加`);
            showToast('✓ 既存の出品に配送地域を正常に追加しました！');
          }}
          onUseMoveListing={() => {
            // Move Listing を明示的に使って複製ではなく移行する
            const matchedItem = items.find(i => i.sku === duplicateItem.sku);
            if (matchedItem) {
              executeTransfer([matchedItem]);
            }
          }}
          onCancel={() => setDuplicateModalOpen(false)}
        />
      )}
    </div>
  );
};
