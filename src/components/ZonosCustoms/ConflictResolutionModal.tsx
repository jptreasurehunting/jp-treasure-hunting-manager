import React from 'react';
import { ZonosPortableProjectFile } from '../../services/zonosPortableProjectService';
import { ZonosCustomsDeclaration } from '../../types/zonosCustoms';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  importedProject: ZonosPortableProjectFile;
  currentLocalDeclaration: ZonosCustomsDeclaration;
  onAdoptImported: () => void;
  onKeepLocal: () => void;
  onMergeUnedited: () => void;
  onCancel: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  importedProject,
  currentLocalDeclaration,
  onAdoptImported,
  onKeepLocal,
  onMergeUnedited,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-3xl bg-slate-900 border border-slate-700 text-slate-200 text-xs p-4 rounded-xl space-y-4 shadow-2xl">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-2xl text-amber-400">⚠️</span>
            <div>
              <h3 className="font-bold text-sm text-white">競合検知・重複発送防止警告 (PC間同期コンフリクト)</h3>
              <p className="text-[11px] text-slate-400">別PCで編集されたプロジェクトと、本PCの作業内容にバージョン・日時の相違を検出しました。</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-white font-bold text-base" onClick={onCancel}>
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          {/* Imported File Data */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <strong className="text-blue-400 font-bold block text-sm pb-1 border-b border-slate-800">
              📥 インポートプロジェクト (別PC)
            </strong>
            <div>
              <span className="text-slate-400 block text-[11px]">出荷 ID / Shipment ID:</span>
              <strong className="font-mono text-slate-200">{importedProject.shipmentId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">保存日時:</span>
              <span className="font-mono text-amber-300">{new Date(importedProject.savedAt).toLocaleString('ja-JP')}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">申告合計 JPY:</span>
              <strong className="font-mono text-emerald-400">{importedProject.totalDeclaredJpyValue?.toLocaleString()} 円</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">アカウント:</span>
              <span className="text-slate-300">{importedProject.ebayAccountDisplayName}</span>
            </div>
          </div>

          {/* Current PC Local Data */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
            <strong className="text-emerald-400 font-bold block text-sm pb-1 border-b border-slate-800">
              💻 本PCのローカルデータ
            </strong>
            <div>
              <span className="text-slate-400 block text-[11px]">注文番号 / Order ID:</span>
              <strong className="font-mono text-slate-200">{currentLocalDeclaration.orderId}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">最終更新日時:</span>
              <span className="font-mono text-amber-300">{currentLocalDeclaration.confirmedAt || '未確定'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">申告合計 JPY:</span>
              <strong className="font-mono text-emerald-400">{currentLocalDeclaration.totalDeclaredJpyValue?.toLocaleString()} 円</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">アカウント:</span>
              <span className="text-slate-300">{currentLocalDeclaration.selectedAccountDisplayName || 'Main Account'}</span>
            </div>
          </div>
        </div>

        <div className="p-3 bg-amber-950/80 border border-amber-500/80 rounded-lg text-amber-200 text-xs font-semibold space-y-1">
          <p>
            ℹ️ 重複発送・誤入力を防ぐため、いずれかの同期方式を選択してください。データが勝手に上書きされることはありません。
          </p>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end gap-2 flex-wrap">
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5"
            onClick={onKeepLocal}
          >
            本PCのデータを保護 (変更なし)
          </button>
          <button
            type="button"
            className="btn-secondary text-xs font-bold px-3 py-1.5 bg-slate-800 hover:bg-slate-700"
            onClick={onMergeUnedited}
          >
            未編集項目のみマージ
          </button>
          <button
            type="button"
            className="btn-primary text-xs font-bold px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500"
            onClick={onAdoptImported}
          >
            インポートデータで最新化
          </button>
        </div>
      </div>
    </div>
  );
};
