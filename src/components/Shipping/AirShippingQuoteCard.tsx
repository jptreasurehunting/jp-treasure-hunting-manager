import React, { useState, useMemo } from 'react';
import { AirShippingQuote, RevisionStrategy } from '../../types/airShippingQuote';
import {
  calculateCheapestAirOption,
  generateBuyerAirUpgradeNote,
  createAirShippingQuote,
  loadAirShippingQuotes
} from '../../services/airShippingQuoteService';

export const AirShippingQuoteCard: React.FC = () => {
  const [buyerIdInput, setBuyerIdInput] = useState<string>('buyer_john_usa');
  const [listingIdInput, setListingIdInput] = useState<string>('256123456789');
  const [listingTitleInput, setListingTitleInput] = useState<string>('Canon AE-1 Vintage Camera');
  const [weightGrams, setWeightGrams] = useState<number>(1200);
  const [itemValueUsd, setItemValueUsd] = useState<number>(150);
  const [revisionStrategy, setRevisionStrategy] = useState<RevisionStrategy>('revise_listing_options');

  const [quotesList, setQuotesList] = useState<AirShippingQuote[]>(loadAirShippingQuotes());
  const [currentQuote, setCurrentQuote] = useState<AirShippingQuote | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Compare Air Options
  const { surfaceCostUsd, cheapestAirOption, allAirOptions } = useMemo(() => {
    return calculateCheapestAirOption(weightGrams, itemValueUsd);
  }, [weightGrams, itemValueUsd]);

  // Buyer Upgrade Note Preview
  const upgradeNotePreview = useMemo(() => {
    return generateBuyerAirUpgradeNote(cheapestAirOption);
  }, [cheapestAirOption]);

  const handleCreateQuote = () => {
    const res = createAirShippingQuote(
      buyerIdInput,
      listingIdInput,
      listingTitleInput,
      'acc_01',
      'Main eBay Seller Account',
      weightGrams,
      itemValueUsd,
      revisionStrategy
    );

    if (res.success && res.quote) {
      setCurrentQuote(res.quote);
      setQuotesList(loadAirShippingQuotes());
      showToast(`✅ 見積もり (${res.quote.quoteId}) を正常に作成・保存しました！`);
    } else {
      showToast(`❌ 見積もり作成エラー: ${res.error}`);
    }
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">✈️</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">最安航空便自動比較 ＆ 差額見積もり自動作成</h3>
            <p className="text-[11px] text-slate-400">デフォルト船便(日本郵政)の低送料を維持しつつ、バイヤーの航空便アップグレード要望に最安差額で対応します。</p>
          </div>
        </div>

        <span className="bg-slate-800 text-slate-300 font-mono text-[11px] px-2 py-1 rounded border border-slate-700 font-semibold">
          デフォルト配送: <strong className="text-emerald-400">Japan Post Surface Mail (船便 / 最安)</strong>
        </span>
      </div>

      {/* Input Parameters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
        <div>
          <label className="font-bold text-slate-300 block">バイヤー ID (Buyer ID)</label>
          <input
            type="text"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-slate-200"
            value={buyerIdInput}
            onChange={(e) => setBuyerIdInput(e.target.value)}
            placeholder="例: buyer_john_usa"
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">元出品 ID (Original Item ID)</label>
          <input
            type="text"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-slate-200"
            value={listingIdInput}
            onChange={(e) => setListingIdInput(e.target.value)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">梱包重量 (g)</label>
          <input
            type="number"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-amber-300 font-bold"
            value={weightGrams}
            onChange={(e) => setWeightGrams(parseInt(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">優先更新方式 (Revision Strategy)</label>
          <select
            className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
            value={revisionStrategy}
            onChange={(e) => setRevisionStrategy(e.target.value as RevisionStrategy)}
          >
            <option value="revise_listing_options">A. 既存出品の配送オプション変更 (最優先)</option>
            <option value="revise_shipping_policy">B. 既存配送ポリシーの更新</option>
            <option value="create_air_listing">C. 専用航空便出品を作成 (A, B不可時のみ)</option>
          </select>
        </div>
      </div>

      {/* Comparison Result Box */}
      {cheapestAirOption ? (
        <div className="p-3 bg-slate-950 border border-blue-500/40 rounded-lg space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="bg-blue-950 text-blue-300 border border-blue-600/60 text-xs px-2 py-0.5 rounded font-bold">
                最安航空便判定結果
              </span>
              <strong className="text-sm text-slate-100 font-bold">
                {cheapestAirOption.carrier} ({cheapestAirOption.serviceName})
              </strong>
            </div>

            <div className="font-mono text-sm text-amber-300 font-bold">
              追加差額送料: +${cheapestAirOption.additionalCostUsd.toFixed(2)} USD
              <span className="text-[11px] text-slate-400 font-normal ml-2">
                (船便 ${surfaceCostUsd} → 航空便 ${cheapestAirOption.airShippingCostUsd})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {/* Upgrade Note Preview */}
            <div className="space-y-1 bg-slate-900 p-2.5 rounded border border-slate-800">
              <strong className="text-slate-300 block text-xs border-b border-slate-800 pb-1">
                📝 出品本文末尾に動的追記される案内文
              </strong>
              <textarea
                className="form-control text-xs font-mono bg-slate-950 border-slate-800 text-emerald-300 w-full p-2 rounded h-24"
                readOnly
                value={upgradeNotePreview}
              />
            </div>

            {/* Quote Action & Status */}
            <div className="space-y-2 bg-slate-900 p-2.5 rounded border border-slate-800 flex flex-col justify-between">
              <div>
                <strong className="text-slate-300 block text-xs border-b border-slate-800 pb-1">
                  ⚡ 差額見積もり発行アクション
                </strong>
                <p className="text-[11px] text-slate-400 mt-1">
                  「見積もりを作成」を押すと、固有の見積ID (例: AIR-20260807-XXXX) が発番され、有効期間7日間でバイヤー宛返信文章が生成されます。
                </p>
              </div>

              <button
                type="button"
                className="btn-primary text-xs font-bold px-4 py-2 bg-blue-600 hover:bg-blue-500 w-full"
                onClick={handleCreateQuote}
              >
                Create Air Shipping Quote (差額見積もりを作成)
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-lg text-red-200 font-semibold">
          ❌ 条件を満たす適合可能な最安航空便が見つかりませんでした。
        </div>
      )}

      {/* Generated Active Quote Box */}
      {currentQuote && (
        <div className="p-3 bg-slate-950 border border-emerald-500/60 rounded-lg space-y-2">
          <div className="flex justify-between items-center pb-1 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-600/60 text-xs px-2 py-0.5 rounded font-bold font-mono">
                {currentQuote.quoteId}
              </span>
              <span className="text-slate-300 font-bold">バイヤー宛生成メッセージ</span>
            </div>

            <span className="text-[10px] text-amber-300 font-mono">
              有効期限: {new Date(currentQuote.expirationDate).toLocaleDateString()} (7日間有効)
            </span>
          </div>

          <textarea
            className="form-control text-xs font-mono bg-slate-900 border-slate-800 text-slate-200 w-full p-2.5 rounded h-36"
            readOnly
            value={currentQuote.buyerMessage}
          />
        </div>
      )}
    </div>
  );
};
