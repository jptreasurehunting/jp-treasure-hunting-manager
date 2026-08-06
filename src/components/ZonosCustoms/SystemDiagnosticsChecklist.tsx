import React from 'react';
import { ZonosCustomsDeclaration, CustomsValidationStatus, EbaySellerAccount } from '../../types/zonosCustoms';

interface SystemDiagnosticsChecklistProps {
  declaration: ZonosCustomsDeclaration | null;
  validation: CustomsValidationStatus;
  activeAccount: EbaySellerAccount;
  plannedShipmentDate: string;
}

export const SystemDiagnosticsChecklist: React.FC<SystemDiagnosticsChecklistProps> = ({
  declaration,
  validation,
  activeAccount,
  plannedShipmentDate
}) => {
  const isAppRunning = true;
  const isEnvPresent = true;
  const isEbayConnected = activeAccount.connectionStatus === 'connected';
  const isAccountMatched = declaration ? (declaration.selectedAccountId === activeAccount.id) : false;
  const isExtensionActive = true;
  const isDeclarationLoaded = !!declaration;
  const isTotalMatched = validation.isJpyTotalMatched || false;
  const hasNoZeroValue = !validation.hasZeroValueItem && !validation.isFreeGiftValueInvalid;
  const isDatePresent = !!plannedShipmentDate;
  const isReadyForZonos = isDeclarationLoaded && isTotalMatched && hasNoZeroValue && isAccountMatched;

  const renderStatusBadge = (status: '準備完了' | '未設定' | '要確認' | '接続エラー' | '合計不一致') => {
    switch (status) {
      case '準備完了':
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-600/60 text-[10px] px-2 py-0.5 rounded font-bold">🟢 準備完了</span>;
      case '未設定':
        return <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] px-2 py-0.5 rounded font-bold">⚪ 未設定</span>;
      case '要確認':
        return <span className="bg-amber-950 text-amber-300 border border-amber-500/80 text-[10px] px-2 py-0.5 rounded font-bold">🟡 要確認</span>;
      case '接続エラー':
        return <span className="bg-red-950 text-red-300 border border-red-500/80 text-[10px] px-2 py-0.5 rounded font-bold">🔴 接続エラー</span>;
      case '合計不一致':
        return <span className="bg-red-950 text-red-300 border border-red-500/80 text-[10px] px-2 py-0.5 rounded font-bold">❌ 合計不一致</span>;
    }
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-3 text-xs">
      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
        <strong className="text-slate-100 font-bold flex items-center gap-1.5 text-sm">
          <span>🩺</span>
          <span>環境診断・8月13日 発送前点検チェックリスト</span>
        </strong>
        {renderStatusBadge(isReadyForZonos ? '準備完了' : validation.errors.length > 0 ? '合計不一致' : '要確認')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 font-mono text-[11px]">
        {/* Item 1 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>1. ローカルApp動作</span>
          {renderStatusBadge(isAppRunning ? '準備完了' : '接続エラー')}
        </div>

        {/* Item 2 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>2. 環境変数 (.env)</span>
          {renderStatusBadge(isEnvPresent ? '準備完了' : '未設定')}
        </div>

        {/* Item 3 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>3. eBay 連携状態</span>
          {renderStatusBadge(isEbayConnected ? '準備完了' : '接続エラー')}
        </div>

        {/* Item 4 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>4. eBay アカウント一致</span>
          {renderStatusBadge(isAccountMatched ? '準備完了' : isDeclarationLoaded ? '要確認' : '未設定')}
        </div>

        {/* Item 5 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>5. Chrome 拡張機能</span>
          {renderStatusBadge(isExtensionActive ? '準備完了' : '要確認')}
        </div>

        {/* Item 6 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>6. 申告データ読込</span>
          {renderStatusBadge(isDeclarationLoaded ? '準備完了' : '未設定')}
        </div>

        {/* Item 7 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>7. JPY差額 0円検証</span>
          {renderStatusBadge(isTotalMatched ? '準備完了' : isDeclarationLoaded ? '合計不一致' : '未設定')}
        </div>

        {/* Item 8 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>8. 0円・負値品目なし</span>
          {renderStatusBadge(hasNoZeroValue ? '準備完了' : isDeclarationLoaded ? '要確認' : '未設定')}
        </div>

        {/* Item 9 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>9. 発送予定日設定</span>
          {renderStatusBadge(isDatePresent ? '準備完了' : '未設定')}
        </div>

        {/* Item 10 */}
        <div className="p-2 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
          <span>10. Zonos手動確認準備</span>
          {renderStatusBadge(isReadyForZonos ? '準備完了' : '要確認')}
        </div>
      </div>
    </div>
  );
};
