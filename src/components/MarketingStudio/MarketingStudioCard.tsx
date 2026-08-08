import React, { useState, useEffect, useMemo } from 'react';
import {
  MarketingChannelId,
  MarketingChannelDefinition,
  MarketingContentGeneration,
  MarketingPerformanceRecord,
  KnowledgeBaseEntry,
  RightsGateStatus,
  GuidedHumanCheck
} from '../../types/aiMarketingStudio';
import {
  getAvailableMarketingChannels,
  registerCustomMarketingChannel,
  generateChannelMarketingContent,
  evaluateRightsAndRiskGate,
  loadMarketingKnowledgeBase,
  saveMarketingKnowledgeBase,
  loadMarketingPerformance,
  recordMarketingPerformance,
  saveHumanConfirmedFact,
  loadMarketingAuditTrail,
  initMarketingStudioHealthModule
} from '../../services/aiMarketingStudioService';

interface MarketingStudioCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const MarketingStudioCard: React.FC<MarketingStudioCardProps> = ({ onAddAuditLog }) => {
  const [channels, setChannels] = useState<MarketingChannelDefinition[]>(getAvailableMarketingChannels());
  const [selectedChannelId, setSelectedChannelId] = useState<MarketingChannelId>('instagram');
  const [creativeVariant, setCreativeVariant] = useState<'Variant A' | 'Variant B'>('Variant A');
  const [activeTab, setActiveTab] = useState<'creative' | 'rights_gate' | 'knowledge_base' | 'performance' | 'audit'>('creative');

  // Sample working product
  const [productTitle, setProductTitle] = useState('Canon AE-1 Program Vintage 35mm SLR Film Camera with 50mm Lens');
  const [brandName, setBrandName] = useState('Canon');
  const [categoryName, setCategoryName] = useState('Cameras & Photo');
  const [sellingPriceUsd, setSellingPriceUsd] = useState(300);
  const [conditionDescription, setConditionDescription] = useState('Clean optics, shutter fires accurately, original leather strap included');

  // Guided Human Check state
  const [activeChecks, setActiveChecks] = useState<GuidedHumanCheck[]>([
    {
      checkId: 'check_bgm_01',
      assetId: 'asset_bgm_01',
      targetSubject: '商品動画のBGM',
      aiFindings: '広告・商用利用の追加ライセンス証憑が未確認です。',
      simpleFactualQuestion: 'この音源の商用広告ライセンスを購入済みですか？',
      answerOptions: ['yes', 'no', 'unknown'],
      currentAnswer: undefined,
      safeFallbackAvailable: true,
      safeFallbackDescription: '安全な商用フリーBGM (Acoustic Folk Library) へ自動変更',
      safeFallbackActionName: '安全なBGMへ自動変更',
      isResolved: false
    },
    {
      checkId: 'check_photo_01',
      assetId: 'asset_photo_01',
      targetSubject: '商品写真の権利元',
      aiFindings: '画像の出所（自社撮影または外部画像）が未登録です。',
      simpleFactualQuestion: 'この写真は自社で撮影しましたか？',
      answerOptions: ['yes', 'no', 'unknown'],
      currentAnswer: 'yes',
      safeFallbackAvailable: true,
      safeFallbackDescription: '自社スタジオ撮影写真へ即時差し替え',
      safeFallbackActionName: '安全な自社撮影写真へ変更',
      isResolved: true
    }
  ]);

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseEntry[]>(loadMarketingKnowledgeBase());
  const [performanceList, setPerformanceList] = useState<MarketingPerformanceRecord[]>(loadMarketingPerformance());
  const [expandedEvidenceId, setExpandedEvidenceId] = useState<string | null>(null);
  const [showFullClause, setShowFullClause] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize Project Health integration
  useEffect(() => {
    initMarketingStudioHealthModule();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Generate marketing content for selected channel & variant
  const content: MarketingContentGeneration = useMemo(() => {
    return generateChannelMarketingContent({
      productId: 'item_101',
      productTitle,
      categoryName,
      brandName,
      sellingPriceUsd,
      conditionDescription,
      channelId: selectedChannelId,
      creativeVariant,
      isAuthenticityEligible: false,
      ddpVerified: true
    });
  }, [productTitle, brandName, categoryName, sellingPriceUsd, conditionDescription, selectedChannelId, creativeVariant]);

  // Overall rights gate evaluation
  const rightsEval = useMemo(() => {
    return evaluateRightsAndRiskGate({
      assetId: 'asset_camera_101',
      assetType: 'image',
      productTitle,
      brandName,
      channelId: selectedChannelId,
      intendedUse: 'sns_post',
      isSellerShotPhoto: activeChecks.find((c) => c.checkId === 'check_photo_01')?.currentAnswer === 'yes',
      hasLicensedBgm: activeChecks.find((c) => c.checkId === 'check_bgm_01')?.currentAnswer === 'yes',
      bgmLicenseId: 'kb_music_01',
      isAttributionIncluded: true
    });
  }, [productTitle, brandName, selectedChannelId, activeChecks]);

  // Handle human check answer
  const handleAnswerCheck = (checkId: string, answer: 'yes' | 'no' | 'unknown') => {
    setActiveChecks((prev) =>
      prev.map((c) => (c.checkId === checkId ? { ...c, currentAnswer: answer, isResolved: answer === 'yes' } : c))
    );
    const target = activeChecks.find((c) => c.checkId === checkId);
    if (target) {
      saveHumanConfirmedFact(target.assetId, answer);
    }
    showToast(`✅ 確認結果（${answer === 'yes' ? 'はい' : answer === 'no' ? 'いいえ' : '分からない'}）を保存しました。`);
    if (onAddAuditLog) {
      onAddAuditLog(`MarketingStudio: Guided Check Answered (${answer})`, undefined, checkId);
    }
  };

  // One-click safe fallback (Spec #10)
  const handleApplySafeFallback = (checkId: string) => {
    setActiveChecks((prev) =>
      prev.map((c) => (c.checkId === checkId ? { ...c, currentAnswer: 'yes', isResolved: true } : c))
    );
    showToast('⚡ 安全な代替素材（商用フリー音源・自社撮影写真）へ即時差し替えました！');
    if (onAddAuditLog) {
      onAddAuditLog('MarketingStudio: Safe Fallback Applied', undefined, checkId);
    }
  };

  // Record simulated A/B performance (Spec #3)
  const handleSimulatePerformance = () => {
    const isA = creativeVariant === 'Variant A';
    const rec = recordMarketingPerformance({
      productId: 'item_101',
      productTitle,
      channelId: selectedChannelId,
      campaignVersion: '2026.Q3.v1',
      creativeVersion: creativeVariant,
      impressions: isA ? 1450 : 1820,
      clicks: isA ? 78 : 112,
      ctr: isA ? 5.38 : 6.15,
      productPageVisits: isA ? 52 : 86,
      conversionCount: isA ? 3 : 5,
      revenueUsd: isA ? 900 : 1500,
      profitUsd: isA ? 210 : 350,
      isMeasuredData: true
    });
    setPerformanceList(loadMarketingPerformance());
    showToast(`📊 実測パフォーマンスデータ (${creativeVariant}) を記録しました！`);
  };

  const getRightsStatusBadge = (status: RightsGateStatus) => {
    switch (status) {
      case 'STANDARDS_MET':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-950 text-emerald-300 border border-emerald-500 shadow-md">
            <span>🟢</span>
            <span>基準適合</span>
          </span>
        );
      case 'NEEDS_CHECK':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-950 text-amber-300 border border-amber-500 shadow-md">
            <span>🟡</span>
            <span>要確認</span>
          </span>
        );
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-950 text-purple-300 border border-purple-500 shadow-md">
            <span>🟠</span>
            <span>承認待ち</span>
          </span>
        );
      case 'PROHIBITED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-950 text-rose-300 border border-rose-500 shadow-md animate-pulse">
            <span>🔴</span>
            <span>使用禁止</span>
          </span>
        );
    }
  };

  return (
    <div className="marketing-studio-card card p-4 bg-slate-900 border border-slate-700 rounded-xl space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-cyan-500 text-cyan-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center pb-3 border-b border-slate-800 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🎨</span>
          <div>
            <h3 className="font-black text-sm text-slate-100">
              AI Marketing Studio ＆ Rights &amp; Risk Gate (SNS・多言語EC・eBay販促統合管理)
            </h3>
            <p className="text-[11px] text-slate-400">
              著作権・商標権・ライセンス規約リスクを自動診断し、事実に基づく高成約率クリエイティブを生成します。
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {getRightsStatusBadge(rightsEval.status)}
          <span className="text-xs font-mono text-slate-300 bg-slate-800 px-2.5 py-1 rounded border border-slate-700">
            審査ティア: <strong className="text-cyan-400">{rightsEval.reviewEffortTier}</strong>
          </span>
        </div>
      </div>

      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'creative' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('creative')}
        >
          🚀 販促クリエイティブ生成
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'rights_gate' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('rights_gate')}
        >
          🛡️ Rights &amp; Risk Gate (知財リスク診断)
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'knowledge_base' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('knowledge_base')}
        >
          📚 知財ナレッジベース ({knowledgeBase.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'performance' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('performance')}
        >
          📊 A/Bパフォーマンス学習 ({performanceList.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            activeTab === 'audit' ? 'bg-cyan-600 text-slate-950 shadow' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveTab('audit')}
        >
          📜 監査ログ
        </button>
      </div>

      {/* TAB 1: 販促クリエイティブ生成 */}
      {activeTab === 'creative' && (
        <div className="space-y-4">
          {/* Channel Selector Row */}
          <div className="space-y-1.5">
            <label className="text-slate-300 font-bold text-xs flex items-center gap-1.5">
              <span>🌐</span>
              <span>対象チャネルの選択 (SNS / 自社EC / eBay / 東南アジアEC):</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {channels.map((ch) => (
                <button
                  key={ch.channelId}
                  type="button"
                  className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-all ${
                    selectedChannelId === ch.channelId
                      ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200 shadow-md font-bold'
                      : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                  onClick={() => setSelectedChannelId(ch.channelId)}
                >
                  <span className="text-base">{ch.icon}</span>
                  <span className="truncate text-xs">{ch.name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Product & Variant Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-950/80 rounded-lg border border-slate-800">
            <div className="md:col-span-2 space-y-1">
              <label className="text-slate-400 font-bold">商品タイトル (事実に基づく入力):</label>
              <input
                type="text"
                className="w-full p-2 bg-slate-900 border border-slate-700 rounded text-slate-100 text-xs font-mono"
                value={productTitle}
                onChange={(e) => setProductTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 font-bold">クリエイティブA/Bバリアント:</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 py-1.5 rounded font-bold text-xs border ${
                    creativeVariant === 'Variant A'
                      ? 'bg-cyan-600 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                  onClick={() => setCreativeVariant('Variant A')}
                >
                  Variant A (標準フック)
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 rounded font-bold text-xs border ${
                    creativeVariant === 'Variant B'
                      ? 'bg-cyan-600 text-slate-950 border-cyan-400'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                  onClick={() => setCreativeVariant('Variant B')}
                >
                  Variant B (ストーリー)
                </button>
              </div>
            </div>
          </div>

          {/* Generated Copy & Hook Display Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Column: Hooks & Copy */}
            <div className="space-y-3 p-3.5 bg-slate-950 rounded-lg border border-slate-800">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <span>✍️</span>
                  <span>チャネル最適化コピー ({selectedChannelId.toUpperCase()})</span>
                </h4>
                <span className="text-[11px] font-mono text-slate-400">文字数: {content.channelSpecificDescription.length}文字</span>
              </div>

              <div>
                <span className="text-slate-400 font-bold text-[11px]">ショートフック (1行キャッチ):</span>
                <div className="p-2 bg-slate-900 rounded border border-slate-800 text-emerald-300 font-bold mt-1">
                  {content.shortProductHook}
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold text-[11px]">コレクター訴求 (実物写真と事実に基づく):</span>
                <p className="text-slate-200 mt-1 leading-relaxed">{content.collectorAppeal}</p>
              </div>

              <div>
                <span className="text-slate-400 font-bold text-[11px]">投稿・掲載用フルテキスト:</span>
                <pre className="p-2.5 bg-slate-900 rounded border border-slate-800 text-slate-100 whitespace-pre-wrap font-sans text-xs mt-1 max-h-48 overflow-y-auto">
                  {content.channelSpecificDescription}
                </pre>
              </div>

              {content.hashtags && content.hashtags.length > 0 && (
                <div>
                  <span className="text-slate-400 font-bold text-[11px]">推奨ハッシュタグ:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {content.hashtags.map((tag, idx) => (
                      <span key={idx} className="text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-400">行動喚起 (CTA): <strong className="text-amber-300">{content.cta}</strong></span>
                <button
                  type="button"
                  className="btn-secondary text-xs px-3 py-1 bg-slate-800 text-slate-200 border-slate-700"
                  onClick={() => {
                    navigator.clipboard.writeText(content.channelSpecificDescription);
                    showToast('📋 コピーをクリップボードにコピーしました！');
                  }}
                >
                  📋 コピーをコピー
                </button>
              </div>
            </div>

            {/* Right Column: Visual & Video Concepts */}
            <div className="space-y-3 p-3.5 bg-slate-950 rounded-lg border border-slate-800">
              <h4 className="font-bold text-purple-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <span>🎬</span>
                <span>ビジュアル・ショート動画 ＆ 音源構成案</span>
              </h4>

              <div>
                <span className="text-slate-400 font-bold text-[11px]">推奨写真掲載順序:</span>
                <ul className="space-y-1 mt-1 text-slate-200">
                  {content.recommendedImageOrder.map((order, idx) => (
                    <li key={idx} className="p-1.5 bg-slate-900 rounded border border-slate-800 flex items-center gap-2">
                      <span className="text-cyan-400 font-bold">[{idx + 1}]</span>
                      <span>{order}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-slate-400 font-bold text-[11px]">ショート動画構成案 (TikTok / Reels / Shorts):</span>
                <p className="p-2 bg-slate-900 rounded border border-slate-800 text-slate-200 mt-1">
                  {content.shortVideoConcept}
                </p>
              </div>

              <div>
                <span className="text-slate-400 font-bold text-[11px]">BGM音源コンセプト (デフォルトミュートプレビュー):</span>
                <div className="p-2 bg-slate-900 rounded border border-slate-800 text-slate-200 mt-1 flex items-center justify-between">
                  <span>{content.backgroundMusicConcept}</span>
                  <span className="text-[10px] text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                    🔇 ミュート初期設定
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  className="btn-primary w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg shadow flex items-center justify-center gap-2"
                  onClick={handleSimulatePerformance}
                >
                  <span>📊</span>
                  <span>実測A/Bパフォーマンスを記録 ({creativeVariant})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Rights & Risk Gate (知財リスク診断 & 簡易事実確認) */}
      {activeTab === 'rights_gate' && (
        <div className="space-y-4">
          {/* Status Explanation Banner */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">{rightsEval.status === 'STANDARDS_MET' ? '🟢' : '🟡'}</span>
                <span className="font-bold text-sm text-slate-100">{rightsEval.statusLabel}</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">公開可否: {rightsEval.canPublish ? '🟢 公開許可' : '🔴 処理停止'}</span>
            </div>
            <p className="text-xs text-slate-300 font-medium">{rightsEval.statusExplanation}</p>
          </div>

          {/* Guided Human Check Card (Spec #7, #17) */}
          <div className="p-4 bg-slate-950/90 border-2 border-amber-500/80 rounded-xl shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg animate-bounce">🟡</span>
                <h4 className="font-black text-sm text-amber-300">
                  Guided Human Check (スタッフ向け1問事実確認)
                </h4>
              </div>
              <span className="text-[11px] text-slate-400">※ 専門知識不要・自社事実のみ回答</span>
            </div>

            <div className="space-y-3">
              {activeChecks.map((chk) => (
                <div key={chk.checkId} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[11px] font-bold text-cyan-400">確認対象: {chk.targetSubject}</span>
                      <p className="text-slate-300 text-xs mt-0.5">AI確認結果: {chk.aiFindings}</p>
                    </div>
                    {chk.isResolved ? (
                      <span className="text-xs text-emerald-400 font-bold bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                        ✓ 回答完了
                      </span>
                    ) : (
                      <span className="text-xs text-amber-300 font-bold bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                        要回答
                      </span>
                    )}
                  </div>

                  <div className="p-2.5 bg-slate-950 rounded border border-slate-800">
                    <span className="text-slate-200 font-bold text-xs">あなたが確認すること:</span>
                    <p className="text-amber-200 font-black text-sm mt-1">{chk.simpleFactualQuestion}</p>

                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      <button
                        type="button"
                        className={`px-4 py-1.5 rounded font-bold text-xs border ${
                          chk.currentAnswer === 'yes'
                            ? 'bg-emerald-600 text-slate-950 border-emerald-400 font-black'
                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                        onClick={() => handleAnswerCheck(chk.checkId, 'yes')}
                      >
                        [はい]
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 rounded font-bold text-xs border ${
                          chk.currentAnswer === 'no'
                            ? 'bg-rose-600 text-white border-rose-400 font-black'
                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                        onClick={() => handleAnswerCheck(chk.checkId, 'no')}
                      >
                        [いいえ]
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 rounded font-bold text-xs border ${
                          chk.currentAnswer === 'unknown'
                            ? 'bg-amber-600 text-slate-950 border-amber-400 font-black'
                            : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
                        }`}
                        onClick={() => handleAnswerCheck(chk.checkId, 'unknown')}
                      >
                        [分からない]
                      </button>

                      {/* One-Click Safe Fallback Button (Spec #10) */}
                      {chk.safeFallbackAvailable && (!chk.isResolved || chk.currentAnswer === 'no' || chk.currentAnswer === 'unknown') && (
                        <button
                          type="button"
                          className="ml-auto px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-slate-950 font-black rounded text-xs shadow flex items-center gap-1.5"
                          onClick={() => handleApplySafeFallback(chk.checkId)}
                        >
                          <span>⚡</span>
                          <span>{chk.safeFallbackActionName || '安全な素材へ自動変更'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Evidence Explorer (Spec #8 & #18) */}
          <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
                <span>📋</span>
                <span>法的根拠・外国語ライセンス条項エクスプローラー</span>
              </h4>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-white"
                onClick={() => setShowFullClause(!showFullClause)}
              >
                {showFullClause ? '規約全文を非表示 ▲' : '規約全文を見る ▼'}
              </button>
            </div>

            <div className="space-y-2">
              {rightsEval.evidenceList.map((ev, idx) => (
                <div key={idx} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-100">{ev.source}</span>
                    <span className="text-[11px] font-mono text-cyan-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      確信度: {(ev.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* Decisive Full Original Clause (Never truncated!) */}
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold">原文条項 (Original Clause - Full Decisive Text):</span>
                    <p className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-200 font-mono text-[11px] mt-0.5">
                      {ev.originalLanguageText}
                    </p>
                  </div>

                  {/* Full Japanese Translation */}
                  <div>
                    <span className="text-[11px] text-slate-400 font-bold">日本語完全翻訳 (Full Japanese Translation):</span>
                    <p className="p-2 bg-slate-950 rounded border border-slate-800 text-slate-200 text-xs mt-0.5">
                      {ev.japaneseTranslation}
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-3">
                    <span>AI解釈: <strong className="text-slate-200">{ev.aiInterpretation}</strong></span>
                    <span>有効期限: <strong className="text-slate-200">{ev.expirationDate}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 知財ナレッジベース (Marketing & Rights Knowledge Base) */}
      {activeTab === 'knowledge_base' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📚</span>
              <span>Marketing &amp; Rights Knowledge Base (再利用可能な知財・ライセンス台帳)</span>
            </h4>
            <span className="text-xs text-slate-400">{knowledgeBase.length} 件登録済み</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {knowledgeBase.map((kbEntry) => (
              <div key={kbEntry.knowledgeId} className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2">
                <div className="flex justify-between items-start">
                  <h5 className="font-bold text-slate-100 text-xs">{kbEntry.title}</h5>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                      kbEntry.lifecycleStatus === 'active'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}
                  >
                    {kbEntry.lifecycleStatus.toUpperCase()}
                  </span>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed">{kbEntry.evidence}</p>

                <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                  <div>情報源: <span className="text-slate-300">{kbEntry.source}</span></div>
                  <div>適用範囲: <span className="text-slate-300">{kbEntry.scope}</span></div>
                  <div>検証日: <span className="text-slate-300">{kbEntry.lastVerifiedDate}</span></div>
                  <div>再確認規則: <span className="text-slate-300">{kbEntry.expiryRecheckRule}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: A/Bパフォーマンス学習 */}
      {activeTab === 'performance' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              <span>📊</span>
              <span>実測マーケティングパフォーマンス ＆ A/Bクリエイティブ学習</span>
            </h4>
            <span className="text-xs text-slate-400">※ 実測データのみ表示（推測確率は不使用）</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-800">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="p-2 border-b border-slate-800">日時</th>
                  <th className="p-2 border-b border-slate-800">商品</th>
                  <th className="p-2 border-b border-slate-800">チャネル</th>
                  <th className="p-2 border-b border-slate-800">バリアント</th>
                  <th className="p-2 border-b border-slate-800">インプレッション</th>
                  <th className="p-2 border-b border-slate-800">クリック (CTR)</th>
                  <th className="p-2 border-b border-slate-800">成約数</th>
                  <th className="p-2 border-b border-slate-800">売上 / 利益</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {performanceList.map((perf) => (
                  <tr key={perf.id} className="hover:bg-slate-800/40">
                    <td className="p-2 text-slate-400">{perf.timestamp.split('T')[0]}</td>
                    <td className="p-2 font-bold text-slate-200 truncate max-w-[150px]">{perf.productTitle}</td>
                    <td className="p-2 uppercase text-cyan-400">{perf.channelId}</td>
                    <td className="p-2 font-bold text-amber-300">{perf.creativeVersion}</td>
                    <td className="p-2 text-slate-200">{perf.impressions.toLocaleString()}</td>
                    <td className="p-2 text-slate-200">{perf.clicks} ({perf.ctr.toFixed(1)}%)</td>
                    <td className="p-2 font-bold text-emerald-400">{perf.conversionCount} 件</td>
                    <td className="p-2 text-slate-200">${perf.revenueUsd} / <strong className="text-emerald-300">${perf.profitUsd}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: 監査ログ */}
      {activeTab === 'audit' && (
        <div className="space-y-3">
          <h4 className="font-bold text-cyan-300 flex items-center gap-1.5 border-b border-slate-800 pb-2">
            <span>📜</span>
            <span>AI Marketing Studio 監査証跡 (Audit Trail)</span>
          </h4>

          <div className="space-y-2">
            {loadMarketingAuditTrail().map((entry) => (
              <div key={entry.id} className="p-2.5 bg-slate-950 rounded border border-slate-800 text-xs flex justify-between items-center">
                <div>
                  <span className="text-slate-400 font-mono text-[11px]">{entry.timestamp.split('T')[1]?.slice(0, 8)}</span>
                  <span className="ml-2 font-bold text-slate-100">{entry.action}</span>
                  <p className="text-slate-300 text-[11px] mt-0.5">{entry.details}</p>
                </div>
                <span className="text-[11px] font-mono text-cyan-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  {entry.performedBy}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
