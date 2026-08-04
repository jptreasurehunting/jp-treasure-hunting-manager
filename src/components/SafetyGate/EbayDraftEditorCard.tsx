import React, { useState } from 'react';
import { EbayDraftItem } from '../../types/safetyGate';
import {
  loadEbayDraftItems,
  saveEbayDraftItems,
  evaluateDraftState
} from '../../services/ebayDraftListingService';
import {
  loadFulfillmentPolicies,
  loadReturnPolicies,
  loadPaymentPolicies
} from '../../services/ebayBusinessPolicyService';
import {
  generateEbayDescriptionHtml,
  validateDescriptionTextPolicyConsistency
} from '../../services/ebayDescriptionEngineService';
import { autoSavePhotoToGoogleDriveFolder, TARGET_FOLDER_NAME } from '../../services/googleDriveService';
import { EbayFinalReviewModal } from './EbayFinalReviewModal';

interface EbayDraftEditorCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const EbayDraftEditorCard: React.FC<EbayDraftEditorCardProps> = ({ onAddAuditLog }) => {
  const [drafts, setDrafts] = useState<EbayDraftItem[]>(loadEbayDraftItems());
  const [selectedDraftId, setSelectedDraftId] = useState<string>(drafts[0]?.id || '');
  const [finalReviewModalOpen, setFinalReviewModalOpen] = useState<boolean>(false);

  const activeDraft = drafts.find((d) => d.id === selectedDraftId) || drafts[0];
  const fulPols = loadFulfillmentPolicies();
  const retPols = loadReturnPolicies();
  const payPols = loadPaymentPolicies();

  const activeDraftEval = activeDraft ? evaluateDraftState(activeDraft) : { state: 'BLOCKED', reasons: [] };

  const handleUpdateDraft = (updated: EbayDraftItem) => {
    const updatedList = drafts.map((d) => (d.id === updated.id ? updated : d));
    setDrafts(updatedList);
    saveEbayDraftItems(updatedList);
  };

  const handleTogglePriceApproval = () => {
    if (!activeDraft) return;
    const updated = {
      ...activeDraft,
      priceApproved: !activeDraft.priceApproved
    };
    handleUpdateDraft(updated);

    if (onAddAuditLog) {
      onAddAuditLog(
        `Final Price Approval Toggled: ${updated.priceApproved ? 'APPROVED' : 'UNAPPROVED'}`,
        `Price: $${updated.priceUsd}`,
        `Approved State: ${updated.priceApproved}`
      );
    }
  };

  const handleGenerateDescription = () => {
    if (!activeDraft) return;
    const html = generateEbayDescriptionHtml({
      itemConditionText: activeDraft.conditionDescription,
      includedContentsText: 'All items shown in photographs are included.',
      authenticityStatement: 'Authenticity carefully verified by Japan-based team.',
      shippingWording: 'Shipped directly from Japan with full tracking number provided upon dispatch.',
      customsDdpWording: activeDraft.isDdp ? 'Import duties and taxes are prepaid (DDP).' : 'Import duties and taxes are buyer responsibility.',
      returnPolicyWording: '30 days returns accepted in accordance with eBay policy.',
      buyerNoteText: "Bringing Japan's treasures to collectors worldwide since 2024."
    });

    const updated = {
      ...activeDraft,
      descriptionHtml: html
    };
    handleUpdateDraft(updated);
    alert('英文商品説明HTMLテンプレートを自動生成しました。');
  };

  return (
    <div className="card ebay-draft-editor-card space-y-4">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">📝 支援型自動出品ドラフト & 写真検証 (Assisted Draft Editor)</h3>
          <p className="card-subtitle text-xs text-muted">
            タイトル80文字制限、Item Specifics、説明テンプレート、写真タグ付け、価格手動承認を統合管理します。
          </p>
        </div>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => setFinalReviewModalOpen(true)}
          disabled={activeDraftEval.state !== 'READY_TO_PUBLISH'}
        >
          ⚡ 最終確認モーダルを開く
        </button>
      </div>

      {activeDraft && (
        <div className="card-body space-y-4 text-xs">
          {/* Draft Status Banner */}
          <div className="card-sub-box bg-slate-900 border-slate-700 flex justify-between items-center">
            <div>
              <span className="text-muted">ドラフトステータス: </span>
              <strong className="font-mono text-highlight">{activeDraftEval.state}</strong>
            </div>
            <div>
              {activeDraft.priceApproved ? (
                <span className="status-badge status-connected">🟢 販売価格 承認済み</span>
              ) : (
                <span className="status-badge status-prep">🟡 販売価格 未承認 (要ユーザーチェック)</span>
              )}
            </div>
          </div>

          {/* Section 1: Title, Category, Price & Quantity */}
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-3">
            <h4 className="font-bold text-highlight">1. リスティング基本情報</h4>
            <div className="grid-3col gap-3">
              <div className="form-group grid-span-2">
                <div className="flex justify-between">
                  <label className="form-label font-bold">eBay出品タイトル (80文字制限)</label>
                  <span className="text-muted font-mono">{activeDraft.title.length} / 80文字</span>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  className="form-control font-bold"
                  value={activeDraft.title}
                  onChange={(e) => handleUpdateDraft({ ...activeDraft, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label font-bold">販売価格 ($) & 価格承認</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    className="form-control font-mono font-bold text-emerald-400"
                    value={activeDraft.priceUsd}
                    onChange={(e) => handleUpdateDraft({ ...activeDraft, priceUsd: parseFloat(e.target.value) || 0 })}
                  />
                  <button
                    type="button"
                    className={activeDraft.priceApproved ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                    onClick={handleTogglePriceApproval}
                  >
                    {activeDraft.priceApproved ? '承認解除' : '価格を承認'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Photos Workflow & Tagging */}
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-highlight">2. 実物写真ワークフロー & タグ付け (Google Drive 自動保存)</h4>
              <div className="flex items-center gap-2">
                <span className="text-muted text-xs">登録写真数: {activeDraft.photoRecords.length}枚</span>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    const sampleUrl = 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500';
                    const newPhoto = {
                      id: `p-${Date.now()}`,
                      url: sampleUrl,
                      tagType: 'Packaging' as const,
                      isActualItemConfirmed: true,
                      orderIndex: activeDraft.photoRecords.length + 1
                    };
                    const updated = {
                      ...activeDraft,
                      photoRecords: [...activeDraft.photoRecords, newPhoto]
                    };
                    handleUpdateDraft(updated);

                    // Auto save to Google Drive "01 Incoming Photos"
                    autoSavePhotoToGoogleDriveFolder(sampleUrl, activeDraft.sku);
                    alert(`新規写真を追加し、Google Drive の "${TARGET_FOLDER_NAME}" フォルダへ自動保存しました！`);
                  }}
                >
                  📷 写真追加 & Google Drive へ同期
                </button>
              </div>
            </div>

            <div className="grid-3col gap-3">
              {activeDraft.photoRecords.map((p) => (
                <div key={p.id} className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1">
                  <img src={p.url} alt="実物写真" className="product-thumb h-24 w-full object-cover rounded" />
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-300">Tag: {p.tagType}</span>
                    <span className="text-emerald-400 font-mono">✓ 現物撮影確認</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Description Engine */}
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-highlight">3. モジュール型英文商品説明エンジン</h4>
              <button type="button" className="btn-secondary btn-sm" onClick={handleGenerateDescription}>
                🪄 HTMLテンプレート自動作成
              </button>
            </div>
            <textarea
              className="form-control font-mono text-xs h-32"
              value={activeDraft.descriptionHtml}
              onChange={(e) => handleUpdateDraft({ ...activeDraft, descriptionHtml: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Final Review Modal */}
      <EbayFinalReviewModal
        draft={activeDraft}
        isOpen={finalReviewModalOpen}
        onClose={() => setFinalReviewModalOpen(false)}
        onAddAuditLog={onAddAuditLog}
      />
    </div>
  );
};
