import React from 'react';

interface SecondComputerSetupGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SecondComputerSetupGuide: React.FC<SecondComputerSetupGuideProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-2xl bg-slate-900 border border-slate-700 text-slate-200 text-xs p-4 rounded-xl space-y-4 shadow-2xl">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-xl">💻</span>
            <div>
              <h3 className="font-bold text-sm text-white">別PC (2台目PC) セットアップガイド — 8月13日 発送対応</h3>
              <p className="text-[11px] text-slate-400">別アドレス・別PCの `http://localhost:3000/` で本アプリと申告プロジェクトを動作させる手順です。</p>
            </div>
          </div>
          <button type="button" className="text-slate-400 hover:text-white font-bold text-base" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
          {/* Step 1 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">1. ソースコードの同期 / クローン</strong>
            <p className="text-slate-300">
              2台目のPCにプロジェクトフォルダをGitクローンまたはZIP転送で配置します。
            </p>
            <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-amber-300 border border-slate-800">
              git clone https://github.com/your-org/jp-treasure-hunting-manager.git
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">2. Node.js インストール &amp; 依存パッケージ復元</strong>
            <p className="text-slate-300">
              Node.js (v18+) がインストールされていることを確認し、依存パッケージをインストールします。
            </p>
            <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-amber-300 border border-slate-800">
              npm install
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">3. 環境変数の確認 (.env)</strong>
            <p className="text-slate-300">
              必要に応じて <span className="font-mono text-amber-300">.env</span> ファイルを配置します（※APIキーやトークンなどの秘密情報はJSONプロジェクトやリポジトリに含めないでください）。
            </p>
          </div>

          {/* Step 4 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">4. 開発用ローカルサーバー起動</strong>
            <p className="text-slate-300">
              ターミナルからローカルサーバーを起動し、<span className="font-mono text-blue-400 font-bold">http://localhost:3000/</span> をブラウザで開きます。
            </p>
            <div className="p-2 bg-slate-900 rounded font-mono text-[11px] text-amber-300 border border-slate-800">
              npm run dev
            </div>
          </div>

          {/* Step 5 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">5. Chrome 拡張機能の読み込み (Sell Similar &amp; 自動化)</strong>
            <p className="text-slate-300">
              Chrome で <span className="font-mono text-emerald-300">chrome://extensions</span> を開き、「パッケージ化されていない拡張機能を読み込む」から <span className="font-mono text-amber-300">extension</span> フォルダを選択します。
            </p>
          </div>

          {/* Step 6 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">6. 対象 eBay アカウントの接続・選択</strong>
            <p className="text-slate-300">
              「eBayアカウント管理」画面にて、発送対象のセラーアカウント (例: Account 1) を選択し接続を完了します。
            </p>
          </div>

          {/* Step 7 */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
            <strong className="text-emerald-400 font-bold block">7. 申告データ (.json) のインポート &amp; 最終検証</strong>
            <p className="text-slate-300">
              1台目PCでエクスポートした <span className="font-mono text-amber-300">Zonos_Declaration_SHIP-20260813-XXXX.json</span> を「申告データを読み込む」ボタンからインポートし、申告差額 0 JPY および 8月13日 発送予定日の検証を行います。
            </p>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button type="button" className="btn-primary text-xs font-bold px-4 py-1.5" onClick={onClose}>
            理解しました
          </button>
        </div>
      </div>
    </div>
  );
};
