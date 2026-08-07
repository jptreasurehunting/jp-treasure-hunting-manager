import React, { useState, useMemo } from 'react';
import { DutyTerm, DdpClassification, ShippingEvaluationResult } from '../../types/shippingRegistry';
import {
  findCheapestEligibleDdpMethod,
  validateListingPublicationGate,
  generateDdpListingNoticeWording,
  recordShippingAuditLog
} from '../../services/shippingRegistryService';

export const DdpShippingDecisionCard: React.FC = () => {
  const [isDomestic, setIsDomestic] = useState<boolean>(false);
  const [dutyTerm, setDutyTerm] = useState<DutyTerm>('DDP');
  const [destinationCountry, setDestinationCountry] = useState<string>('United States (US)');
  const [weightGrams, setWeightGrams] = useState<number>(1200);
  const [lengthCm, setLengthCm] = useState<number>(30);
  const [widthCm, setWidthCm] = useState<number>(20);
  const [heightCm, setHeightCm] = useState<number>(15);
  const [itemValueUsd, setItemValueUsd] = useState<number>(150);
  const [categoryName, setCategoryName] = useState<string>('Cameras & Photo');
  const [zonosValidated, setZonosValidated] = useState<boolean>(true);

  // DDP Notice Wording states
  const [noticeVariant, setNoticeVariant] = useState<'preferred' | 'short' | 'shortest'>('preferred');
  const [customNoticeText, setCustomNoticeText] = useState<string>(generateDdpListingNoticeWording('preferred'));
  const [isNoticeInserted, setIsNoticeInserted] = useState<boolean>(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Find Cheapest Eligible DDP Method
  const evaluationResult = useMemo(() => {
    return findCheapestEligibleDdpMethod(
      weightGrams,
      { length: lengthCm, width: widthCm, height: heightCm },
      destinationCountry,
      itemValueUsd,
      categoryName
    );
  }, [weightGrams, lengthCm, widthCm, heightCm, destinationCountry, itemValueUsd, categoryName]);

  const recommendedMethod = evaluationResult.recommended?.method;

  // Validation Gate
  const validationGate = useMemo(() => {
    return validateListingPublicationGate(
      isDomestic,
      dutyTerm,
      recommendedMethod,
      weightGrams,
      { length: lengthCm, width: widthCm, height: heightCm },
      zonosValidated
    );
  }, [isDomestic, dutyTerm, recommendedMethod, weightGrams, lengthCm, widthCm, heightCm, zonosValidated]);

  const handleApplyRecommendedMethod = () => {
    if (!recommendedMethod) return;

    recordShippingAuditLog({
      destinationCountry,
      weightGrams,
      consideredMethodsCount: evaluationResult.allEvaluations.length,
      excludedMethods: evaluationResult.allEvaluations
        .filter((e) => !e.isEligible)
        .map((e) => ({ methodId: e.method.methodId, reason: e.ineligibleReasons.join('; ') })),
      selectedMethodId: recommendedMethod.methodId,
      totalSellerCost: evaluationResult.recommended?.costBreakdown.totalSellerCost || 0,
      dutyTermDecision: dutyTerm,
      zonosDecision: recommendedMethod.zonosRequirement,
      ddpNoticeWordingSelected: isNoticeInserted ? customNoticeText : undefined,
      ddpNoticeEdited: customNoticeText !== generateDdpListingNoticeWording(noticeVariant),
      userConfirmed: true,
      approvedBy: 'eBay Seller (Current Session)'
    });

    showToast(`✅ 最安DDP配送サービス「${recommendedMethod.serviceName}」を本出品に反映・承認しました！`);
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">✈️</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">DDP厳格運用 ＆ 最安配送自動比較判定システム</h3>
            <p className="text-[11px] text-slate-400">DDU完全禁止ポリシーに基づき、最安のDDP適合配送サービスと関税条件を自動検証します。</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={isDomestic}
              onChange={(e) => setIsDomestic(e.target.checked)}
            />
            <span className="font-bold text-slate-300">🇯🇵 日本国内発送 (DDP除外)</span>
          </label>
        </div>
      </div>

      {/* Inputs Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
        <div>
          <label className="font-bold text-slate-300 block">梱包後重量 (g)</label>
          <input
            type="number"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-amber-300 font-bold"
            value={weightGrams}
            onChange={(e) => setWeightGrams(Math.max(1, parseInt(e.target.value) || 0))}
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
          <label className="font-bold text-slate-300 block">配送先国 (Destination)</label>
          <input
            type="text"
            className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
            value={destinationCountry}
            onChange={(e) => setDestinationCountry(e.target.value)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">商品価格 ($ USD)</label>
          <input
            type="number"
            className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-emerald-400 font-bold"
            value={itemValueUsd}
            onChange={(e) => setItemValueUsd(parseFloat(e.target.value) || 0)}
          />
        </div>

        <div>
          <label className="font-bold text-slate-300 block">関税区分 (Duty Term)</label>
          <select
            className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
            value={dutyTerm}
            onChange={(e) => setDutyTerm(e.target.value as DutyTerm)}
            disabled={isDomestic}
          >
            <option value="DDP">🛡️ DDP (関税元払い / 出品可)</option>
            <option value="DDU">❌ DDU (着払い関税 / 禁止)</option>
            <option value="UNKNOWN">❓ 未確認 (要確認 / 停止)</option>
          </select>
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
      </div>

      {/* No Eligible eBay Integrated Warning Banner */}
      {evaluationResult.noEligibleEbayIntegrated && (
        <div className="p-3 bg-amber-950/80 border border-amber-500/80 rounded-lg text-amber-200 font-semibold space-y-1">
          <div className="flex items-center space-x-2">
            <span>⚠️</span>
            <span>{evaluationResult.japaneseErrorMessage}</span>
          </div>
        </div>
      )}

      {/* Recommended Lowest Total Seller Cost Method Banner */}
      {evaluationResult.recommended ? (
        <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-lg space-y-3">
          <div className="flex justify-between items-center flex-wrap gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <span className="bg-emerald-950 text-emerald-400 border border-emerald-600/60 text-xs px-2 py-0.5 rounded font-bold">
                ★ 最安推薦 DDP サービス
              </span>
              <strong className="text-sm text-slate-100 font-bold">
                {evaluationResult.recommended.method.serviceName} ({evaluationResult.recommended.method.carrier})
              </strong>
            </div>

            <div className="font-mono text-sm text-emerald-400 font-bold">
              総手配費用合計: ${evaluationResult.recommended.costBreakdown.totalSellerCost.toFixed(2)} USD
            </div>
          </div>

          {/* Breakdown & Delivery Range Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] font-mono">
            {/* Cost Breakdown */}
            <div className="space-y-1 bg-slate-900 p-2.5 rounded border border-slate-800">
              <strong className="text-slate-300 block text-xs border-b border-slate-800 pb-1">
                総コスト詳細内訳 (Total Seller Cost Breakdown)
              </strong>
              <div className="flex justify-between">
                <span>基本運賃:</span>
                <span>${evaluationResult.recommended.costBreakdown.baseShippingCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>燃油サーチャージ:</span>
                <span>${evaluationResult.recommended.costBreakdown.fuelSurcharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>DDP/税関取扱手数料:</span>
                <span>${evaluationResult.recommended.costBreakdown.ddpCustomsHandlingCharge.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>補償・署名手配料:</span>
                <span>
                  ${(evaluationResult.recommended.costBreakdown.insuranceFee + evaluationResult.recommended.costBreakdown.signatureFee).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Delivery Range 3-Tier Model */}
            <div className="space-y-1 bg-slate-900 p-2.5 rounded border border-slate-800">
              <strong className="text-slate-300 block text-xs border-b border-slate-800 pb-1">
                お届け日数予測 3段階モデル
              </strong>
              <div className="flex justify-between text-slate-400">
                <span>キャリア標準日数:</span>
                <span>
                  {evaluationResult.recommended.deliveryRange.carrierStandardTransitDays.min} – {evaluationResult.recommended.deliveryRange.carrierStandardTransitDays.max} 営業日
                </span>
              </div>
              <div className="flex justify-between text-slate-300 font-bold">
                <span>通常推定お届け日数:</span>
                <span>
                  {evaluationResult.recommended.deliveryRange.normalEstimatedDeliveryDays.min} – {evaluationResult.recommended.deliveryRange.normalEstimatedDeliveryDays.max} 営業日
                </span>
              </div>
              <div className="flex justify-between text-amber-300 font-bold">
                <span>保守的遅延考慮日数 (推薦):</span>
                <span>
                  {evaluationResult.recommended.deliveryRange.conservativeDelayAwareDays.min} – {evaluationResult.recommended.deliveryRange.conservativeDelayAwareDays.max} 営業日
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              className="btn-primary text-xs font-bold px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500"
              onClick={handleApplyRecommendedMethod}
            >
              ✓ この最安DDP配送を本出品に反映・確認
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-red-950/80 border border-red-500/80 rounded-lg text-red-200 font-semibold">
          ❌ 該当条件を満たす適合可能な DDP 配送サービスが見つかりませんでした。
        </div>
      )}

      {/* Buyer-Facing DDP Listing Description Wording Section */}
      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <strong className="text-slate-200 font-bold flex items-center gap-1.5">
            <span>📝</span>
            <span>eBay商品説明用 DDP 英文表記文言 (バイヤー向け)</span>
          </strong>

          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-1 cursor-pointer">
              <input
                type="checkbox"
                checked={isNoticeInserted}
                onChange={(e) => setIsNoticeInserted(e.target.checked)}
              />
              <span className="text-slate-300">DDP説明を挿入</span>
            </label>

            <select
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              value={noticeVariant}
              onChange={(e) => {
                const variant = e.target.value as any;
                setNoticeVariant(variant);
                setCustomNoticeText(generateDdpListingNoticeWording(variant));
              }}
              disabled={!isNoticeInserted}
            >
              <option value="preferred">推奨文言 (Preferred)</option>
              <option value="short">短縮文言 (Short)</option>
              <option value="shortest">最短文言 (Shortest)</option>
            </select>
          </div>
        </div>

        {isNoticeInserted && (
          <div className="space-y-1">
            <textarea
              className="form-control text-xs font-mono bg-slate-900 border-slate-700 text-emerald-300 w-full p-2 rounded"
              rows={2}
              value={customNoticeText}
              onChange={(e) => setCustomNoticeText(e.target.value)}
            />
            <span className="text-[10px] text-slate-400 block">
              ※ DDP（関税元払い）の事前検証完了時のみ商品説明へ安全に挿入されます。過度な保証表現は除外されています。
            </span>
          </div>
        )}
      </div>

      {/* Final Listing Publication Validation Gate Banner */}
      <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <strong className="text-slate-100 font-bold flex items-center gap-1.5">
            <span>🛡️</span>
            <span>出品最終バリデーションゲート (Listing Publication Gate)</span>
          </strong>

          {validationGate.canPublish ? (
            <span className="bg-emerald-950 text-emerald-400 border border-emerald-500/80 text-xs px-3 py-1 rounded font-bold">
              🟢 出品許可 (Publish Ready)
            </span>
          ) : (
            <span className="bg-red-950 text-red-300 border border-red-500/80 text-xs px-3 py-1 rounded font-bold">
              🛑 出品停止 (Publication Blocked)
            </span>
          )}
        </div>

        {validationGate.errors.length > 0 && (
          <div className="p-2.5 bg-red-950/70 border border-red-500/80 rounded space-y-1 text-red-200 font-semibold">
            {validationGate.errors.map((err, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <span>❌</span>
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="btn-primary font-bold px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs"
            disabled={!validationGate.canPublish}
            onClick={() => showToast('🚀 出品申請 (Publish / Sell Similar) のバリデーションチェックを通過しました！')}
          >
            🚀 出品を実行 (Publish Item / Sell Similar)
          </button>
        </div>
      </div>
    </div>
  );
};
