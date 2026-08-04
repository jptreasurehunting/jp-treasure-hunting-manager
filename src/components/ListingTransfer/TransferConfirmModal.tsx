import React from 'react';
import { EbaySellerAccount, ListingTransferSettings, EbayListingTransferItem } from '../../types/zonosCustoms';

interface TransferConfirmModalProps {
  settings: ListingTransferSettings;
  sourceAccount: EbaySellerAccount;
  destinationAccount: EbaySellerAccount;
  selectedItems: EbayListingTransferItem[];
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransferConfirmModal: React.FC<TransferConfirmModalProps> = ({
  settings,
  sourceAccount,
  destinationAccount,
  selectedItems,
  isOpen,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const totalPrice = selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="modal-overlay">
      <div className="modal-card transfer-confirm-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🚚</span>
            <div>
              <h3 className="modal-title-ja">eBay リスティング安全移動（Move）の確認</h3>
              <p className="modal-title-en text-muted">Safe Sequential Listing Move Confirmation</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-info-banner">
            <p>
              🛡️ <strong>安心移動シーケンシャル処理:</strong> 転記先アカウントでの出品作成が完全成功するまで、転記元の元出品は絶対に終了されません。
            </p>
          </div>

          {/* 3-Step Sequential Workflow Card */}
          <div className="card-sub-box margin-bottom-md bg-slate-900 border-emerald-500/30">
            <h4 className="font-bold text-sm text-emerald-400 margin-bottom-xs">📋 実行フロー (3ステップ安全シーケンス)</h4>
            <ol className="text-xs space-y-1 text-slate-300 list-decimal list-inside">
              <li><strong>ステップ 1:</strong> 転記先 [<strong>{destinationAccount.displayName}</strong>] に新規出品を作成</li>
              <li><strong>ステップ 2:</strong> 転記先での出品作成成功（Item ID発行）を検証・確定</li>
              <li><strong>ステップ 3:</strong> 成功確認後、転記元 [<strong>{sourceAccount.displayName}</strong>] の元出品を安全に終了</li>
            </ol>
          </div>

          <div className="order-summary-box grid-2col margin-bottom-md">
            <div>
              <span className="text-xs text-muted block">転記元アカウント / Source</span>
              <strong className="text-highlight font-mono">{sourceAccount.displayName} ({sourceAccount.ebayUsername})</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">転記先アカウント / Destination</span>
              <strong className="text-highlight-gold font-mono">{destinationAccount.displayName} ({destinationAccount.ebayUsername})</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">転記モード / Transfer Mode</span>
              <strong className="text-base text-emerald-400">🚚 移動 (Move) 専用</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">出品公開状態 / Visibility</span>
              <strong className="text-base">
                {settings.listingVisibility === 'draft' ? '📝 下書き (Draft)' : '🟢 出品中 (Active)'}
              </strong>
            </div>

            <div>
              <span className="text-xs text-muted block">選択リスティング数 / Selected Count</span>
              <strong className="text-highlight font-mono text-base">{selectedItems.length} 件</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">合計出品価格 / Total Price</span>
              <strong className="text-highlight-gold font-mono text-base">${totalPrice.toFixed(2)} USD</strong>
            </div>
          </div>

          <div className="card-sub-box margin-bottom-md">
            <h4 className="font-bold text-xs margin-bottom-xs text-muted">移動対象リスティング</h4>
            <div className="transfer-items-mini-list space-y-1 max-h-36 overflow-y-auto text-xs">
              {selectedItems.map((item) => (
                <div key={item.itemId} className="flex justify-between items-center border-b border-gray-700 py-1">
                  <span className="truncate pr-2">{item.title}</span>
                  <span className="font-mono text-highlight-gold shrink-0">${item.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="btn-primary btn-lg" onClick={onConfirm}>
            🚚 安全移動処理を実行 (シミュレーション)
          </button>
        </div>
      </div>
    </div>
  );
};
