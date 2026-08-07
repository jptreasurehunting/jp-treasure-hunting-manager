import React, { useState, useMemo } from 'react';
import { AiShippingEvaluationItem } from '../../types/aiShippingAdvisor';
import { analyzeShippingWithAiAdvisor } from '../../services/aiShippingAdvisorService';

export const AiShippingAdvisorCard: React.FC = () => {
  const [sellingPriceUsd, setSellingPriceUsd] = useState<number>(2500);
  const [purchaseCostUsd, setPurchaseCostUsd] = useState<number>(800);
  const [packedWeightGrams, setPackedWeightGrams] = useState<number>(1200);
  const [lengthCm, setLengthCm] = useState<number>(25);
  const [widthCm, setWidthCm] = useState<number>(20);
  const [heightCm, setHeightCm] = useState<number>(15);
  const [destinationCountry, setDestinationCountry] = useState<string>('Germany (DE)');
  const [categoryName, setCategoryName] = useState<string>('Watches & Jewelry');
  const [brandName, setBrandName] = useState<string>('Rolex');

  const [confirmedMethodId, setConfirmedMethodId] = useState<string | null>(null);
  const [expandedRecDetails, setExpandedRecDetails] = useState<boolean>(false);
  const [expandedCheapDetails, setExpandedCheapDetails] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const analysis = useMemo(() => {
    return analyzeShippingWithAiAdvisor(
      sellingPriceUsd,
      purchaseCostUsd,
      packedWeightGrams,
      { length: lengthCm, width: widthCm, height: heightCm },
      destinationCountry,
      categoryName,
      brandName
    );
  }, [sellingPriceUsd, purchaseCostUsd, packedWeightGrams, lengthCm, widthCm, heightCm, destinationCountry, categoryName, brandName]);

  const handleConfirmMethod = (item: AiShippingEvaluationItem) => {
    setConfirmedMethodId(item.method.methodId);
    showToast(`✅ セラー承認完了: 配送方法「${item.method.serviceName}」を選択しました (予想利益: $${item.estimatedSellerProfitUsd})`);
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
          <span className="text-xl">🤖</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">AI Shipping Compliance &amp; Recommendation Engine (Ver.3.2)</h3>
            <p className="text-[11px] text-slate-400">プログレッシブ・ディスクロージャー対応提案解説 ＆ 警告即時表示エンジン</p>
          </div>
        </div>

        <span className="bg-amber-950 text-amber-300 font-mono text-[10px] px-2 py-1 rounded border border-amber-600/60 font-semibold">
          ⚠️ 自動選択なし — 必ずセラーの個別手動承認が必要です
        </span>
      </div>

      {/* Inputs Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
        <div>
          <label className="font-bold text-slate-300 block">販売価格 ($)</label>
          <input
            type="number"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-emerald-400 font-bold"
            value={sellingPriceUsd}
            onChange={(e) => setSellingPriceUsd(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">仕入原価 ($)</label>
          <input
            type="number"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-slate-200"
            value={purchaseCostUsd}
            onChange={(e) => setPurchaseCostUsd(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">梱包重量 (g)</label>
          <input
            type="number"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-amber-300 font-bold"
            value={packedWeightGrams}
            onChange={(e) => setPackedWeightGrams(parseInt(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">サイズ (L &times; W &times; H cm)</label>
          <div className="flex items-center space-x-1 font-mono">
            <input
              type="number"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              value={lengthCm}
              onChange={(e) => setLengthCm(parseInt(e.target.value) || 0)}
            />
            <span>&times;</span>
            <input
              type="number"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              value={widthCm}
              onChange={(e) => setWidthCm(parseInt(e.target.value) || 0)}
            />
            <span>&times;</span>
            <input
              type="number"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              value={heightCm}
              onChange={(e) => setHeightCm(parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-300 block">配送先国</label>
          <input
            type="text"
            className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">カテゴリー</label>
          <input
            type="text"
            className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">ブランド</label>
          <input
            type="text"
            className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
          />
        </div>
      </div>

      {/* STRICT DISPLAY ORDER: 1. ★★★★★ おすすめ (Primary Card), 2. ② 最安 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 1. ★★★★★ おすすめ (Recommended - Visually Primary Card) */}
        {analysis.recommendedOption ? (
          <div className="p-3.5 bg-slate-950 border-2 border-emerald-500 rounded-lg space-y-3 relative shadow-xl">
            {/* CRITICAL WARNINGS ALWAYS VISIBLE AT TOP (NEVER HIDDEN BEHIND BUTTON!) */}
            {analysis.recommendedOption.criticalWarnings.length > 0 && (
              <div className="p-2 bg-red-950/90 border border-red-500/80 rounded text-[11px] text-red-200 space-y-0.5 font-semibold">
                <strong className="block text-red-300 font-bold">⚠️ ブロッキング重要警告 (即時常時表示)</strong>
                {analysis.recommendedOption.criticalWarnings.map((warn, idx) => (
                  <div key={idx}>{warn}</div>
                ))}
              </div>
            )}

            {/* Compact Header Summary */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-amber-400 font-bold text-lg">{analysis.recommendedOption.starRating}</span>
                <span className="bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 rounded shadow">
                  1. ★★★★★ おすすめ (最高総合結果)
                </span>
              </div>

              <span className="font-mono text-emerald-400 font-bold text-sm">
                送料: ${analysis.recommendedOption.costBreakdown.totalSellerCost.toFixed(2)} USD
              </span>
            </div>

            <h4 className="font-bold text-slate-100 text-sm">{analysis.recommendedOption.method.serviceName} ({analysis.recommendedOption.method.carrier})</h4>

            {/* Short 1-Line Compact Summary Reason */}
            <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px] text-slate-200">
              <span className="text-emerald-400 font-bold">💡 概要: </span>
              <span>{analysis.recommendedOption.shortOneLineReason}</span>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-4 gap-1 bg-slate-900 p-2 rounded font-mono text-[10px]">
              <div>
                <span className="text-slate-400 block">予想利益:</span>
                <strong className="text-emerald-400 text-xs">${analysis.recommendedOption.estimatedSellerProfitUsd}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">利益率:</span>
                <strong className="text-amber-300 text-xs">{analysis.recommendedOption.estimatedProfitMarginPercent}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block">お届け目安:</span>
                <strong className="text-slate-200 text-xs">{analysis.recommendedOption.deliveryRange.normalEstimatedDeliveryDays.min}–{analysis.recommendedOption.deliveryRange.normalEstimatedDeliveryDays.max}日</strong>
              </div>
              <div>
                <span className="text-slate-400 block">コンプライアンス:</span>
                <strong className="text-emerald-400 text-xs">✓ DDP適合</strong>
              </div>
            </div>

            {/* Progressive Disclosure Expand Button */}
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <button
                type="button"
                className="btn-secondary text-[11px] font-bold px-3 py-1 bg-slate-800 text-blue-400 hover:text-blue-300 border-slate-700 flex items-center gap-1"
                onClick={() => setExpandedRecDetails(!expandedRecDetails)}
              >
                <span>{expandedRecDetails ? '▲ 詳しい理由をたたむ' : '▼ 詳しい理由を見る'}</span>
              </button>

              <button
                type="button"
                className={`btn-primary text-xs font-bold px-4 py-1.5 ${confirmedMethodId === analysis.recommendedOption.method.methodId ? 'bg-emerald-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                onClick={() => handleConfirmMethod(analysis.recommendedOption!)}
              >
                {confirmedMethodId === analysis.recommendedOption.method.methodId ? '✓ 選択済み (手動承認完了)' : '✓ おすすめプランを承認・選択'}
              </button>
            </div>

            {/* Expanded Detailed Reason Breakdown (Progressive Disclosure) */}
            {expandedRecDetails && (
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 font-mono text-[11px] text-slate-300 animate-fadeIn">
                <strong className="text-blue-400 font-bold block text-xs border-b border-slate-800 pb-1">
                  🔍 詳細推奨理由 ＆ 点検ブレークダウン (Detailed Reasoning)
                </strong>

                <div>
                  <strong className="text-slate-200 font-bold">1. 推奨理由:</strong>
                  <p className="text-slate-300 text-[10px]">{analysis.recommendedOption.detailedReasoning.whyRecommended}</p>
                </div>

                <div>
                  <strong className="text-slate-200 font-bold">2. 対象外と判定された他配送方法 ({analysis.recommendedOption.detailedReasoning.excludedMethods.length}件):</strong>
                  <div className="space-y-0.5 text-[10px] text-slate-400">
                    {analysis.recommendedOption.detailedReasoning.excludedMethods.map((ex, idx) => (
                      <div key={idx}>・{ex.methodName} ({ex.carrier}): {ex.exclusionReason}</div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <strong className="text-slate-200 font-bold block">3. 商品・カテゴリー制限:</strong>
                    <span>{analysis.recommendedOption.detailedReasoning.categoryRestrictions}</span>
                  </div>
                  <div>
                    <strong className="text-slate-200 font-bold block">4. eBayポリシー点検:</strong>
                    <span>{analysis.recommendedOption.detailedReasoning.ebayPolicyChecks}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <strong className="text-slate-200 font-bold block">5. DDP / Zonos判定:</strong>
                    <span>{analysis.recommendedOption.detailedReasoning.ddpZonosDecision}</span>
                  </div>
                  <div>
                    <strong className="text-slate-200 font-bold block">6. 追跡・補償詳細:</strong>
                    <span>{analysis.recommendedOption.detailedReasoning.trackingInsuranceDetails}</span>
                  </div>
                </div>

                <div className="text-[10px]">
                  <strong className="text-slate-200 font-bold block">7. 必要書類リスト:</strong>
                  <span className="text-emerald-300">{analysis.recommendedOption.complianceStatus.requiredDocuments.join(', ')}</span>
                </div>

                <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex justify-between">
                  <span>検証ルールの典拠: {analysis.recommendedOption.detailedReasoning.ruleSources.join(', ')}</span>
                  <span>最終検証日時: {analysis.recommendedOption.detailedReasoning.lastVerificationTimestamp}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
            適合するAIおすすめプランがありません
          </div>
        )}

        {/* 2. ② 最安 (Cheapest - Explaining Disadvantages) */}
        {analysis.cheapestOption ? (
          <div className="p-3.5 bg-slate-950 border border-blue-500/60 rounded-lg space-y-3 relative shadow-lg">
            {/* CRITICAL WARNINGS ALWAYS VISIBLE AT TOP */}
            {analysis.cheapestOption.criticalWarnings.length > 0 && (
              <div className="p-2 bg-red-950/90 border border-red-500/80 rounded text-[11px] text-red-200 space-y-0.5 font-semibold">
                <strong className="block text-red-300 font-bold">⚠️ ブロッキング重要警告 (即時常時表示)</strong>
                {analysis.cheapestOption.criticalWarnings.map((warn, idx) => (
                  <div key={idx}>{warn}</div>
                ))}
              </div>
            )}

            {/* Compact Header Summary */}
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="text-amber-400 font-bold text-base">{analysis.cheapestOption.starRating}</span>
                <span className="bg-blue-950 text-blue-300 border border-blue-600/60 text-xs px-2 py-0.5 rounded font-bold">
                  2. ② 最安 (送料最小プラン)
                </span>
              </div>

              <span className="font-mono text-emerald-400 font-bold text-sm">
                送料: ${analysis.cheapestOption.costBreakdown.totalSellerCost.toFixed(2)} USD
              </span>
            </div>

            <h4 className="font-bold text-slate-100 text-sm">{analysis.cheapestOption.method.serviceName} ({analysis.cheapestOption.method.carrier})</h4>

            {/* Disadvantage Explanation relative to Recommended */}
            {analysis.cheapestOption.detailedReasoning.differenceFromCheapest && (
              <div className="p-2 bg-amber-950/60 border border-amber-500/60 rounded text-[11px] text-amber-200 font-semibold">
                {analysis.cheapestOption.detailedReasoning.differenceFromCheapest}
              </div>
            )}

            {/* Short 1-Line Reason */}
            <div className="bg-slate-900 p-2 rounded border border-slate-800 text-[11px] text-slate-200">
              <span className="text-blue-400 font-bold">💡 概要: </span>
              <span>{analysis.cheapestOption.shortOneLineReason}</span>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-4 gap-1 bg-slate-900 p-2 rounded font-mono text-[10px]">
              <div>
                <span className="text-slate-400 block">予想利益:</span>
                <strong className="text-emerald-400 text-xs">${analysis.cheapestOption.estimatedSellerProfitUsd}</strong>
              </div>
              <div>
                <span className="text-slate-400 block">利益率:</span>
                <strong className="text-amber-300 text-xs">{analysis.cheapestOption.estimatedProfitMarginPercent}%</strong>
              </div>
              <div>
                <span className="text-slate-400 block">お届け目安:</span>
                <strong className="text-slate-200 text-xs">{analysis.cheapestOption.deliveryRange.normalEstimatedDeliveryDays.min}–{analysis.cheapestOption.deliveryRange.normalEstimatedDeliveryDays.max}日</strong>
              </div>
              <div>
                <span className="text-slate-400 block">コンプライアンス:</span>
                <strong className="text-emerald-400 text-xs">✓ DDP適合</strong>
              </div>
            </div>

            {/* Progressive Disclosure Expand Button */}
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <button
                type="button"
                className="btn-secondary text-[11px] font-bold px-3 py-1 bg-slate-800 text-blue-400 hover:text-blue-300 border-slate-700 flex items-center gap-1"
                onClick={() => setExpandedCheapDetails(!expandedCheapDetails)}
              >
                <span>{expandedCheapDetails ? '▲ 詳しい理由をたたむ' : '▼ 詳しい理由を見る'}</span>
              </button>

              <button
                type="button"
                className={`btn-primary text-xs font-bold px-4 py-1.5 ${confirmedMethodId === analysis.cheapestOption.method.methodId ? 'bg-emerald-600' : 'bg-blue-600 hover:bg-blue-500'}`}
                onClick={() => handleConfirmMethod(analysis.cheapestOption!)}
              >
                {confirmedMethodId === analysis.cheapestOption.method.methodId ? '✓ 選択済み (手動承認完了)' : '✓ 最安プランを承認・選択'}
              </button>
            </div>

            {/* Expanded Detailed Reason Breakdown */}
            {expandedCheapDetails && (
              <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2 font-mono text-[11px] text-slate-300 animate-fadeIn">
                <strong className="text-blue-400 font-bold block text-xs border-b border-slate-800 pb-1">
                  🔍 最安プランの詳細理由 ＆ デメリット分析
                </strong>

                <div>
                  <strong className="text-slate-200 font-bold">1. 最安理由:</strong>
                  <p className="text-slate-300 text-[10px]">{analysis.cheapestOption.detailedReasoning.whyRecommended}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div>
                    <strong className="text-slate-200 font-bold block">2. DDP / Zonos判定:</strong>
                    <span>{analysis.cheapestOption.detailedReasoning.ddpZonosDecision}</span>
                  </div>
                  <div>
                    <strong className="text-slate-200 font-bold block">3. 追跡・補償詳細:</strong>
                    <span>{analysis.cheapestOption.detailedReasoning.trackingInsuranceDetails}</span>
                  </div>
                </div>

                <div className="text-[10px]">
                  <strong className="text-slate-200 font-bold block">4. 必要書類リスト:</strong>
                  <span className="text-emerald-300">{analysis.cheapestOption.complianceStatus.requiredDocuments.join(', ')}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-400">
            適合する最安プランがありません
          </div>
        )}
      </div>
    </div>
  );
};
