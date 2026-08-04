import React, { useState } from 'react';
import {
  PrePurchaseReviewInput,
  PrePurchaseReviewResult,
  PrePurchaseMarketplace
} from '../../types/safetyGate';
import {
  evaluatePrePurchaseReview,
  calculatePrePurchaseProfit,
  savePrePurchaseReview
} from '../../services/prePurchaseReviewService';
import {
  loadSalesPerformanceRecords,
  generateStoreLearningSummaries
} from '../../services/salesPerformanceService';

interface PrePurchaseReviewCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const PrePurchaseReviewCard: React.FC<PrePurchaseReviewCardProps> = ({ onAddAuditLog }) => {
  const [input, setInput] = useState<PrePurchaseReviewInput>({
    marketplace: 'Mercari',
    listingUrl: 'https://jp.mercari.com/item/m123456789',
    listingTitle: '【美品】Canon AE-1 Program Vintage Camera 50mm Lens Set',
    sellerDescription: '動作確認済み。目立った傷なし。付属品あり。国内正規取扱店で購入。',
    askingPriceJpy: 15000,
    domesticShippingJpy: 800,
    expectedEbayPriceUsd: 280,
    estimatedSellingFeeUsd: 42,
    estimatedIntlShippingUsd: 22,
    estimatedCustomsCostUsd: 0,
    exchangeRateJpyPerUsd: 150,
    brand: 'Canon',
    manufacturer: 'Canon Inc.',
    productCode: 'JAN-4960999123456',
    countryOfManufacture: 'Japan',
    officialReleaseMarket: 'Japan',
    intendedEbayMarketplace: 'eBay US',
    intendedDestinationCountries: ['US', 'CA', 'DE'],
    sellerRating: 99.4,
    sellerTransactionCount: 142,
    photoReferences: ['https://example.com/photo1.jpg', 'https://example.com/tag.jpg'],
    reviewNotes: '仕入れ前の真贋・法規制・利益予備審査'
  });

  const [reviewResult, setReviewResult] = useState<PrePurchaseReviewResult | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState<boolean>(false);
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>('');

  const liveEconomics = calculatePrePurchaseProfit(input);

  const handleRunReview = () => {
    const res = evaluatePrePurchaseReview(input);
    setReviewResult(res);
  };

  const handleSaveReview = () => {
    if (!reviewResult) return;
    const entry = {
      id: `rev-${Date.now()}`,
      timestamp: new Date().toLocaleString('ja-JP'),
      input,
      result: reviewResult
    };
    savePrePurchaseReview(entry);

    if (onAddAuditLog) {
      onAddAuditLog(
        `Pre-Purchase Review Saved (${reviewResult.decision})`,
        '-',
        `Item: ${input.listingTitle} | Margin: ${reviewResult.estimatedProfitMargin}% | Profit: ¥${reviewResult.estimatedProfitJpy.toLocaleString()}`
      );
    }
    alert('仕入れ前審査結果を保存しました。');
  };

  const handleExecuteOverride = () => {
    if (!overrideReasonInput.trim()) {
      alert('オーバーライド理由を入力してください。');
      return;
    }

    if (reviewResult && onAddAuditLog) {
      onAddAuditLog(
        'ECONOMICALLY_NOT_RECOMMENDED Override Executed',
        'Decision: ECONOMICALLY_NOT_RECOMMENDED',
        `Overridden by User. Reason: ${overrideReasonInput}`
      );
    }

    setReviewResult((prev) =>
      prev
        ? {
            ...prev,
            decision: 'PURCHASE_RECOMMENDED',
            decisionTitleJa: '仕入れ許可 (手動オーバーライド承認済み)',
            overrideReason: overrideReasonInput
          }
        : null
    );

    setOverrideModalOpen(false);
    setOverrideReasonInput('');
  };

  return (
    <div className="card pre-purchase-review-card space-y-4">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">🛒 仕入れ前コンプライアンス & 利益事前審査 (Pre-Purchase Review)</h3>
          <p className="card-subtitle text-xs text-muted">
            メルカリ・ヤフオク・ラクマ等の購入前に、法規制・真贋証拠・予想純利益を判定します。
          </p>
        </div>
        <span className="baseline-badge">Phase 1 モジュール</span>
      </div>

      <div className="card-body space-y-4 text-xs">
        {/* SECTION 1: Product & Seller Information (10 Fields) */}
        <div className="card-sub-box bg-slate-900 border-slate-700 space-y-3">
          <h4 className="font-bold text-highlight">1. 仕入れ元・商品基本情報</h4>
          <div className="grid-3col gap-3">
            <div className="form-group">
              <label className="form-label font-bold">仕入れ先マーケット</label>
              <select
                className="form-control"
                value={input.marketplace}
                onChange={(e) => setInput({ ...input, marketplace: e.target.value as PrePurchaseMarketplace })}
              >
                <option value="Mercari">メルカリ (Mercari)</option>
                <option value="Yahoo Auctions">ヤフオク (Yahoo Auctions)</option>
                <option value="Rakuma">ラクマ (Rakuma)</option>
                <option value="HardOff">ハードオフ (HardOff)</option>
                <option value="Other">その他 (Other)</option>
              </select>
            </div>

            <div className="form-group grid-span-2">
              <label className="form-label font-bold">出品タイトル / タイトル</label>
              <input
                type="text"
                className="form-control font-semibold"
                value={input.listingTitle}
                onChange={(e) => setInput({ ...input, listingTitle: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">ブランド (Brand)</label>
              <input
                type="text"
                className="form-control"
                value={input.brand}
                onChange={(e) => setInput({ ...input, brand: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">製品コード (JAN / UPC / Serial)</label>
              <input
                type="text"
                className="form-control font-mono"
                placeholder="例: JAN-4960999123456"
                value={input.productCode}
                onChange={(e) => setInput({ ...input, productCode: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">製造国 (Country of Manufacture)</label>
              <input
                type="text"
                className="form-control"
                placeholder="例: Japan, China"
                value={input.countryOfManufacture}
                onChange={(e) => setInput({ ...input, countryOfManufacture: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Pricing & Profit Calculation (10 Fields) */}
        <div className="card-sub-box bg-slate-900 border-slate-700 space-y-3">
          <h4 className="font-bold text-highlight">2. 価格・送料・コスト設定 & 予想利益計算</h4>
          <div className="grid-4col gap-3">
            <div className="form-group">
              <label className="form-label font-bold">仕入希望価格 (円)</label>
              <input
                type="number"
                className="form-control font-mono font-bold"
                value={input.askingPriceJpy}
                onChange={(e) => setInput({ ...input, askingPriceJpy: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">国内送料 (円)</label>
              <input
                type="number"
                className="form-control font-mono"
                value={input.domesticShippingJpy}
                onChange={(e) => setInput({ ...input, domesticShippingJpy: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">予想eBay販売価格 ($)</label>
              <input
                type="number"
                className="form-control font-mono font-bold text-emerald-400"
                value={input.expectedEbayPriceUsd}
                onChange={(e) => setInput({ ...input, expectedEbayPriceUsd: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label font-bold">為替レート (円/$)</label>
              <input
                type="number"
                className="form-control font-mono"
                value={input.exchangeRateJpyPerUsd}
                onChange={(e) => setInput({ ...input, exchangeRateJpyPerUsd: parseFloat(e.target.value) || 150 })}
              />
            </div>
          </div>

          {/* Live Economics Calculation Box */}
          <div className="zonos-summary-box space-between bg-slate-950 border-slate-800 p-2 rounded">
            <div>
              <span className="text-muted">仕入・国内送料合計: </span>
              <strong className="font-mono">¥{liveEconomics.totalCostJpy.toLocaleString()}</strong>
            </div>
            <div>
              <span className="text-muted">予想純利益 ($ / 円): </span>
              <strong className={liveEconomics.netProfitJpy >= 0 ? 'font-mono text-emerald-400 font-bold' : 'font-mono text-danger font-bold'}>
                ${liveEconomics.netProfitUsd} (¥{liveEconomics.netProfitJpy.toLocaleString()})
              </strong>
            </div>
            <div>
              <span className="text-muted">予想利益率: </span>
              <strong className={liveEconomics.profitMargin >= 15 ? 'font-mono text-emerald-400 font-bold' : 'font-mono text-amber-400 font-bold'}>
                {liveEconomics.profitMargin}%
              </strong>
            </div>
          </div>

          {/* Store Learning Advice Integration */}
          {(() => {
            const salesRecs = loadSalesPerformanceRecords();
            const summaries = generateStoreLearningSummaries(salesRecs);
            const brandSummary = summaries.find((s) => s.groupKey.includes(input.brand)) || summaries[0];

            return (
              <div className="card-sub-box bg-slate-950 border-blue-500/30 text-xs space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-blue-400">📊 貴社店舗の実績データからの学習アドバイス (Store Performance Insights)</span>
                  <span className="status-badge status-connected font-mono">{brandSummary.confidenceBand}</span>
                </div>
                <p className="text-slate-300">{brandSummary.recommendationMessage}</p>
                <div className="text-muted text-xs">
                  ※ 店舗の実績データは真贋未確認、VeRO知財、法規制、またはアカウント停止ブロックを上書きすることは一切できません。
                </div>
              </div>
            );
          })()}
        </div>

        {/* Execute Button */}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-primary" onClick={handleRunReview}>
            🛡️ 事前審査を実行
          </button>
        </div>

        {/* SECTION 3: Review Results & Banners */}
        {reviewResult && (
          <div className="space-y-4 pt-2">
            {/* Banner Decision Display */}
            {reviewResult.decision === 'PURCHASE_RECOMMENDED' && (
              <div className="card-sub-box border-emerald-500/40 bg-emerald-950/20 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟢</span>
                  <div>
                    <h4 className="font-bold text-emerald-400 text-sm">{reviewResult.decisionTitleJa}</h4>
                    <p className="text-slate-300">事前コンプライアンス要件および予想利益率基準をクリアしています。</p>
                  </div>
                </div>
                <p className="text-slate-400 italic text-xs">{reviewResult.disclaimerNotice}</p>
              </div>
            )}

            {reviewResult.decision === 'REVIEW_REQUIRED' && (
              <div className="card-sub-box border-yellow-500/40 bg-yellow-950/20 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🟡</span>
                  <div>
                    <h4 className="font-bold text-yellow-400 text-sm">{reviewResult.decisionTitleJa}</h4>
                    <p className="text-slate-300">必要情報または写真証拠が不足しています。解消するまで仕入れできません。</p>
                  </div>
                </div>
              </div>
            )}

            {reviewResult.decision === 'ECONOMICALLY_NOT_RECOMMENDED' && (
              <div className="card-sub-box border-amber-500/40 bg-amber-950/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🟠</span>
                    <div>
                      <h4 className="font-bold text-amber-400 text-sm">{reviewResult.decisionTitleJa}</h4>
                      <p className="text-slate-300">法的違反はありませんが、予想利益率が低水準です。</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => setOverrideModalOpen(true)}
                  >
                    ✏️ 理由を記録してオーバーライド
                  </button>
                </div>
              </div>
            )}

            {reviewResult.decision === 'PURCHASE_BLOCKED' && (
              <div className="card-sub-box border-red-500/40 bg-red-950/20 text-xs space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔴</span>
                  <div>
                    <h4 className="font-bold text-danger text-sm">{reviewResult.decisionTitleJa}</h4>
                    <p className="text-slate-300">VeRO高リスク・原産国偽装表示・大幅赤字等のため仕入れがブロックされました（オーバーライド不可）。</p>
                  </div>
                </div>
              </div>
            )}

            {/* Missing Requirements List */}
            {reviewResult.missingRequirements.length > 0 && (
              <div className="card-sub-box bg-slate-950 border-slate-800 text-xs">
                <h5 className="font-bold text-amber-400 margin-bottom-xs">検出された注意・不備項目 Checklist</h5>
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {reviewResult.missingRequirements.map((req, idx) => (
                    <li key={idx}>{req}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Save & Recheck Action Buttons */}
            <div className="flex justify-between items-center pt-2">
              <button type="button" className="btn-secondary" onClick={handleRunReview}>
                🔄 再検証 (Recheck)
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveReview}>
                💾 審査結果を保存
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Override Modal for ECONOMICALLY_NOT_RECOMMENDED */}
      {overrideModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title-ja">経済的非推奨のオーバーライド承認</h3>
              <button type="button" className="modal-close-btn" onClick={() => setOverrideModalOpen(false)}>&times;</button>
            </div>
            <div className="modal-body text-xs space-y-3">
              <p className="text-slate-300">
                ※ 法的・政策上のブロックはありませんが、予想利益率が低水準です。手動オーバーライド理由を入力して監査ログに記録してください。
              </p>
              <div className="form-group">
                <label className="form-label font-bold">オーバーライド承認理由 (必須)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="例: 出品者価格交渉の余地あり / 高回転人気商品の仕入れ確保"
                  value={overrideReasonInput}
                  onChange={(e) => setOverrideReasonInput(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer space-between">
              <button type="button" className="btn-secondary" onClick={() => setOverrideModalOpen(false)}>
                キャンセル
              </button>
              <button type="button" className="btn-primary" onClick={handleExecuteOverride}>
                監査ログに記録して承認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
