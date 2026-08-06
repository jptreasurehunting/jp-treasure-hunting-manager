import React from 'react';
import { ZonosCustomsDeclaration, EbayOrderPayload } from '../../types/zonosCustoms';

interface RefetchComparisonModalProps {
  isOpen: boolean;
  importedDeclaration: ZonosCustomsDeclaration;
  latestEbayOrder: EbayOrderPayload;
  onKeepImported: () => void;
  onAdoptLatestEbay: () => void;
  onClose: () => void;
}

export const RefetchComparisonModal: React.FC<RefetchComparisonModalProps> = ({
  isOpen,
  importedDeclaration,
  latestEbayOrder,
  onKeepImported,
  onAdoptLatestEbay,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-3xl bg-slate-900 border border-slate-700 text-slate-200 text-xs p-4 rounded-xl space-y-4 shadow-2xl">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">🔄</span>
            <div>
              <h3 className="font-bold text-sm text-white">eBay 最新データ比較・差検分</h3>
              <p className="text-[11px] text-slate-400">インポートされた申告内容と、eBay APIの最新注文情報を比較します。</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-white font-bold text-base" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Imported Data Box */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <strong className="text-blue-400 font-bold block text-sm pb-1 border-b border-slate-800">
              📂 インポートされた申告データ (1台目PC保存内容)
            </strong>
            <div>
              <span className="text-slate-400 block text-[11px]">注文番号 / Order ID:</span>
              <strong className="font-mono text-slate-200">{importedDeclaration.orderId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">取引総額:</span>
              <strong className="text-amber-300 font-mono">{importedDeclaration.ebayTransactionValue.toFixed(2)} {importedDeclaration.currency}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">為替レート:</span>
              <span className="font-mono text-slate-300">{importedDeclaration.exchangeRate} JPY/{importedDeclaration.currency}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">申告品目数:</span>
              <span className="font-mono text-emerald-400 font-bold">{importedDeclaration.items.length} 件</span>
            </div>
          </div>

          {/* Latest eBay Data Box */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <strong className="text-emerald-400 font-bold block text-sm pb-1 border-b border-slate-800">
              📥 取得した eBay 最新注文データ (API)
            </strong>
            <div>
              <span className="text-slate-400 block text-[11px]">注文番号 / Order ID:</span>
              <strong className="font-mono text-slate-200">{latestEbayOrder.orderId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">最新取引総額:</span>
              <strong className="text-amber-300 font-mono">{latestEbayOrder.ebayTransactionValue.toFixed(2)} {latestEbayOrder.currency}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">配送先国:</span>
              <span className="font-mono text-slate-300">{latestEbayOrder.destinationCountry}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">最新注文品目数:</span>
              <span className="font-mono text-emerald-400 font-bold">{latestEbayOrder.items.length} 件</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
          <strong className="text-amber-300 font-bold block">💡 採用オプションの選択:</strong>
          <p className="text-slate-300">
            1台目PCで承認済みの申告内容をそのまま維持するか、eBayの最新情報を反映するかを選択できます。
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5"
            onClick={onKeepImported}
          >
            インポート内容を維持 (変更なし)
          </button>
          <button
            type="button"
            className="btn-primary text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500"
            onClick={onAdoptLatestEbay}
          >
            eBay最新情報を採用 (自動更新)
          </button>
        </div>
      </div>
    </div>
  );
};
