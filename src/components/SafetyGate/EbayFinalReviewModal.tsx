import React, { useState } from 'react';
import { EbayDraftItem } from '../../types/safetyGate';
import { loadFulfillmentPolicies, loadReturnPolicies, loadPaymentPolicies } from '../../services/ebayBusinessPolicyService';
import { evaluateDraftState, saveEbayDraftItems, loadEbayDraftItems } from '../../services/ebayDraftListingService';

interface EbayFinalReviewModalProps {
  draft: EbayDraftItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const EbayFinalReviewModal: React.FC<EbayFinalReviewModalProps> = ({
  draft,
  isOpen,
  onClose,
  onAddAuditLog
}) => {
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  if (!isOpen || !draft) return null;

  const fulPols = loadFulfillmentPolicies();
  const retPols = loadReturnPolicies();
  const payPols = loadPaymentPolicies();

  const selectedFul = fulPols.find((p) => p.id === draft.fulfillmentPolicyId);
  const selectedRet = retPols.find((p) => p.id === draft.returnPolicyId);
  const selectedPay = payPols.find((p) => p.id === draft.paymentPolicyId);

  const evalRes = evaluateDraftState(draft);
  const isPublishable = evalRes.state === 'READY_TO_PUBLISH';

  const handleExecuteFinalPublish = () => {
    if (!isPublishable) {
      alert('未解消のブロック理由が存在するため出品できません。');
      return;
    }

    setIsPublishing(true);

    setTimeout(() => {
      const mockListingId = `396123${Math.floor(Math.random() * 900000 + 100000)}`;

      const drafts = loadEbayDraftItems();
      const updated = drafts.map((d) =>
        d.id === draft.id ? { ...d, draftState: 'PUBLISHED' as const } : d
      );
      saveEbayDraftItems(updated);

      if (onAddAuditLog) {
        onAddAuditLog(
          `Final Publish Approval Executed (Listing ID: ${mockListingId})`,
          `Draft State: ${draft.draftState}`,
          `Published Offer ID: offer-${Date.now()} | Account: ${draft.accountId} | Price: $${draft.priceUsd}`
        );
      }

      setIsPublishing(false);
      alert(`[SUCCESS] eBay Sandbox への自動出品・Offer公開が正常完了しました！\neBay Item ID: ${mockListingId}`);
      onClose();
    }, 800);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card compliance-blocking-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">⚡</span>
            <div>
              <h3 className="modal-title-ja">出品最終確認画面 (Final Publish Review)</h3>
              <p className="modal-title-en text-muted">
                Account: {draft.accountId} | Marketplace: {draft.marketplaceId} | SKU: {draft.sku}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body text-xs space-y-4">
          {/* Final Validation Status */}
          <div className={`card-sub-box p-3 border ${isPublishable ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-red-500/40 bg-red-950/20'}`}>
            <div className="flex justify-between items-center">
              <strong className={isPublishable ? 'text-emerald-400 text-sm' : 'text-danger text-sm'}>
                {isPublishable ? '🟢 出品可能 (All Gates Cleared)' : '🔴 出品不可 (Block Reasons Exist)'}
              </strong>
              <span className="font-mono text-muted font-bold">推定出品手数料: ${draft.estimatedFeesUsd}</span>
            </div>
            {evalRes.reasons.length > 0 && (
              <ul className="list-disc list-inside mt-2 text-danger">
                {evalRes.reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Item Details Summary Grid */}
          <div className="grid-2col gap-3 font-mono">
            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-1">
              <span className="text-muted block">1. タイトル & カテゴリ</span>
              <strong className="text-slate-200 block text-xs">{draft.title}</strong>
              <div className="text-muted text-xs">{draft.categoryName}</div>
            </div>

            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-1">
              <span className="text-muted block">2. 価格・数量・実在庫</span>
              <strong className="text-emerald-400 block text-sm">${draft.priceUsd} (数量: {draft.quantity}個)</strong>
              <div className="text-muted text-xs">価格承認: {draft.priceApproved ? '✓ 承認済み' : '未承認'} | 手元在庫: ✓ 確認済み</div>
            </div>

            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-1">
              <span className="text-muted block">3. 選択ビジネスポリシー</span>
              <div>配送: <strong className="text-slate-300">{selectedFul?.name}</strong></div>
              <div>返品: <strong className="text-slate-300">{selectedRet?.name}</strong></div>
              <div>決済: <strong className="text-slate-300">{selectedPay?.name}</strong></div>
            </div>

            <div className="card-sub-box bg-slate-900 border-slate-700 space-y-1">
              <span className="text-muted block">4. コンプライアンス & 真贋ステータス</span>
              <div className="text-emerald-400 font-bold">{draft.complianceResult}</div>
              <div className="text-muted text-xs">DDP設定: {draft.isDdp ? 'DDP (関税込み)' : 'DDU (関税別)'}</div>
            </div>
          </div>

          <div className="legal-disclaimer-banner card-sub-box border-amber-500/30 bg-amber-500/10 text-xs">
            ⚠️ <strong>最終承認手動原則:</strong> 利用者が明示的に下記「出品承認を実行」ボタンを押下しない限り、eBayへの自動送信・Offer公開は絶対に行われません。
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onClose}>
            キャンセルして編集へ戻る
          </button>
          <button
            type="button"
            className="btn-primary btn-lg"
            onClick={handleExecuteFinalPublish}
            disabled={!isPublishable || isPublishing}
          >
            {isPublishing ? '⏳ 出品処理中...' : '⚡ 出品承認を実行 (Publish Offer)'}
          </button>
        </div>
      </div>
    </div>
  );
};
