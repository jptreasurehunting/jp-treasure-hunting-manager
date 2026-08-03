import React from 'react';

interface DuplicateListingWarningModalProps {
  sku: string;
  itemTitle: string;
  existingAccountName: string;
  isOpen: boolean;
  onOpenExisting: () => void;
  onAddDestinationToExisting: () => void;
  onUseMoveListing: () => void;
  onCancel: () => void;
}

export const DuplicateListingWarningModal: React.FC<DuplicateListingWarningModalProps> = ({
  sku,
  itemTitle,
  existingAccountName,
  isOpen,
  onOpenExisting,
  onAddDestinationToExisting,
  onUseMoveListing,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card duplicate-warning-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">⚠️</span>
            <div>
              <h3 className="modal-title-ja text-amber-400">eBay重複出品(Duplicate Listing) ポリシー注意</h3>
              <p className="modal-title-en text-muted">Identical Inventory Duplicate Listing Warning</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body space-y-3">
          <div className="validation-error-item text-xs border-amber-500/40 bg-amber-500/10">
            <strong>警告:</strong> 「同一商品の重複出品になる可能性があります。既存出品の配送地域追加、またはMove Listingを使用してください。」
          </div>

          <div className="card-sub-box bg-slate-900 border-slate-700 text-xs space-y-1">
            <div>
              <span className="text-muted">対象SKU: </span>
              <strong className="font-mono text-highlight-gold">{sku}</strong>
            </div>
            <div>
              <span className="text-muted">商品名: </span>
              <strong className="text-primary">{itemTitle}</strong>
            </div>
            <div>
              <span className="text-muted">検出された既存出品アカウント: </span>
              <strong className="text-highlight font-mono">{existingAccountName}</strong>
            </div>
          </div>

          <p className="text-xs text-muted">
            ※ 同一商品の別出品を作成するのではなく、既存出品に配送先国を追加するか、アカウント間移転(Move Listing)を実行してください。通常の「複製 (Copy)」は推奨されません。
          </p>
        </div>

        <div className="modal-footer flex-col space-y-2">
          <div className="grid-2col gap-2 w-full">
            <button
              type="button"
              className="btn-pill-sm active py-2 text-xs"
              onClick={onAddDestinationToExisting}
            >
              ➕ 既存出品に配送地域を追加
            </button>
            <button
              type="button"
              className="btn-primary py-2 text-xs"
              onClick={onUseMoveListing}
            >
              🚚 Move Listing を使用する
            </button>
          </div>

          <div className="flex justify-between w-full pt-1">
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={onOpenExisting}
            >
              🔍 既存出品を開く
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={onCancel}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
