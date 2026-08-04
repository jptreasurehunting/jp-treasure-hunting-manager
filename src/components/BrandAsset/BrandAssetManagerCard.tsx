import React, { useState } from 'react';
import {
  BrandAssetRecord,
  AssetSelectionCriteria,
  AssetSelectionResult,
  SocialPlatformConnector,
  SocialPostCategory,
  SocialPostDraft,
  WatermarkConfig,
  BrandAuditLogRecord
} from '../../types/brandAsset';
import {
  getBrandAssets,
  selectOptimalBrandAsset,
  getGoogleDriveSyncPreview,
  getSocialPlatformConnectors,
  POST_CATEGORY_LABELS,
  createSocialPostDraft,
  loadBrandAuditLogs,
  addBrandAuditLog
} from '../../services/brandAssetService';
import { WatermarkSafetyModal } from './WatermarkSafetyModal';

interface BrandAssetManagerCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const BrandAssetManagerCard: React.FC<BrandAssetManagerCardProps> = ({ onAddAuditLog }) => {
  const [activeTab, setActiveTab] = useState<'REGISTRY' | 'GDRIVE_PREP' | 'SNS_COMPOSER' | 'AUDIT'>('REGISTRY');

  const assets = getBrandAssets();
  const drivePreview = getGoogleDriveSyncPreview();
  const connectors = getSocialPlatformConnectors();
  const [auditLogs, setAuditLogs] = useState<BrandAuditLogRecord[]>(loadBrandAuditLogs());

  // Automatic Selector Test State
  const [selectorCriteria, setSelectorCriteria] = useState<AssetSelectionCriteria>({
    platform: 'Instagram',
    layout: 'square',
    background: 'light',
    format: 'digital',
    useCase: 'post'
  });
  const [selectorResult, setSelectorResult] = useState<AssetSelectionResult>(
    selectOptimalBrandAsset(selectorCriteria)
  );

  // SNS Composer State
  const [selectedPlatform, setSelectedPlatform] = useState(connectors[0].platform);
  const [selectedCategory, setSelectedCategory] = useState<SocialPostCategory>('PREVIOUSLY_SOLD');
  const [productTitleInput, setProductTitleInput] = useState('Canon AE-1 Program Vintage Camera (Mint Condition)');
  const [skuInput, setSkuInput] = useState('SKU-CAM-001');
  const [samplePhotoUrl, setSamplePhotoUrl] = useState('https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600');

  // Watermark State
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
    opacity: 0.8,
    marginPx: 15,
    position: 'bottom-right',
    autoDisableIfObscuresEvidence: true,
    isObscuringEvidenceDetected: false
  });
  const [isWatermarkModalOpen, setIsWatermarkModalOpen] = useState(false);

  // Drive Approval Checkbox
  const [isDriveApproved, setIsDriveApproved] = useState(false);

  // Generated Post Draft State
  const [currentPostDraft, setCurrentPostDraft] = useState<SocialPostDraft>(
    createSocialPostDraft(selectedCategory, selectedPlatform, productTitleInput, skuInput, samplePhotoUrl, watermarkConfig)
  );

  const handleRunSelector = (newCriteria: Partial<AssetSelectionCriteria>) => {
    const updated = { ...selectorCriteria, ...newCriteria };
    setSelectorCriteria(updated);
    setSelectorResult(selectOptimalBrandAsset(updated));
  };

  const handleGeneratePostDraft = () => {
    const draft = createSocialPostDraft(
      selectedCategory,
      selectedPlatform,
      productTitleInput,
      skuInput,
      samplePhotoUrl,
      watermarkConfig
    );
    setCurrentPostDraft(draft);

    const log = addBrandAuditLog({
      actor: 'Brand Manager Admin',
      action: `Social Post Draft Created (${selectedCategory})`,
      selectedAssetRole: draft.selectedAssetRole,
      selectedAssetFileName: draft.selectedAssetPath.split('/').pop() || '',
      assetVersion: 'v0.9-draft',
      destinationPlatform: selectedPlatform,
      derivativeGenerated: true,
      captionSnippet: draft.caption.substring(0, 40) + '...',
      userApproved: false,
      publicationStatus: 'DRAFT_PREPARED'
    });

    setAuditLogs(loadBrandAuditLogs());
    if (onAddAuditLog) {
      onAddAuditLog(`Social Post Draft Prepared for ${selectedPlatform}`, `Category: ${selectedCategory}`, `Log ID: ${log.id}`);
    }
  };

  const handleApproveAndSimulatePublish = () => {
    const updatedDraft = { ...currentPostDraft, userApproved: true };
    setCurrentPostDraft(updatedDraft);

    const log = addBrandAuditLog({
      actor: 'User Admin (Manual Reviewer)',
      action: `Approved & Simulated Publication to ${selectedPlatform}`,
      selectedAssetRole: updatedDraft.selectedAssetRole,
      selectedAssetFileName: updatedDraft.selectedAssetPath.split('/').pop() || '',
      assetVersion: 'v0.9-draft',
      destinationPlatform: selectedPlatform,
      derivativeGenerated: true,
      captionSnippet: updatedDraft.caption.substring(0, 40) + '...',
      userApproved: true,
      publicationStatus: 'SIMULATED_LOCAL_ONLY'
    });

    setAuditLogs(loadBrandAuditLogs());
    alert(`[SUCCESS] 【手動承認完了】${selectedPlatform} 向け投稿ドラフトを承認しました！（※外部APIへの自動送信・投稿は行われません）`);
  };

  return (
    <div className="card brand-asset-manager-card space-y-4">
      {/* Header */}
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">
            🎨 ブランドアセット統合管理 & SNSコマース安全準備 (Brand Asset Management & Social Commerce)
          </h3>
          <p className="card-subtitle text-xs text-muted">
            Japan Treasure Hunting のブランド資産（ロゴ・アイコン・水増し防止ウォーターマーク）を自動最適選定し、SNS投稿・Google Drive同期を安全に準備します。
          </p>
        </div>
        <span className="status-badge status-connected font-mono">✓ Phase 4.1 アクティブ</span>
      </div>

      {/* Security Banner */}
      <div className="legal-disclaimer-banner card-sub-box border-blue-500/30 bg-blue-950/20 text-xs text-slate-300 space-y-1">
        🛡️ <strong>Phase 4.1 コンプライアンス & 安全設計方針 (Security Architecture):</strong>
        <ul className="list-disc list-inside text-xs text-slate-400">
          <li><strong>下書き資産扱い (`DRAFT_ASSET` v0.9-draft):</strong> 現行PNG/ICO画像はドラフト生産アセットとして扱い、将来のマスターベクター(SVG)承認版と互換性を維持します。</li>
          <li><strong>外部API完全遮断:</strong> SNS API (Instagram/FB/X/TikTok等) や Google Drive への自動送信・自動変更は一切行いません。</li>
          <li><strong>非破壊ウォーターマーク:</strong> 商品の元写真は保護され、傷・シリアル・タグの表示領域を覆わない安全自動検出機能を備えます。</li>
        </ul>
      </div>

      {/* Management Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 text-xs">
        <button
          type="button"
          className={`pb-2 px-3 border-b-2 font-medium ${activeTab === 'REGISTRY' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          onClick={() => setActiveTab('REGISTRY')}
        >
          🎨 1. アセット一覧 & 自動選定 ({assets.length} 件)
        </button>
        <button
          type="button"
          className={`pb-2 px-3 border-b-2 font-medium ${activeTab === 'GDRIVE_PREP' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          onClick={() => setActiveTab('GDRIVE_PREP')}
        >
          ☁️ 2. Google Drive 同期準備
        </button>
        <button
          type="button"
          className={`pb-2 px-3 border-b-2 font-medium ${activeTab === 'SNS_COMPOSER' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          onClick={() => setActiveTab('SNS_COMPOSER')}
        >
          📱 3. SNS連携 & 投稿コンポーザー
        </button>
        <button
          type="button"
          className={`pb-2 px-3 border-b-2 font-medium ${activeTab === 'AUDIT' ? 'border-primary text-primary font-bold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
          onClick={() => setActiveTab('AUDIT')}
        >
          📋 4. ブランド操作監査ログ ({auditLogs.length} 件)
        </button>
      </div>

      {/* TAB 1: ASSET REGISTRY & AUTOMATIC SELECTOR */}
      {activeTab === 'REGISTRY' && (
        <div className="space-y-4 text-xs">
          {/* Automatic Asset Selection Tester Card */}
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-3">
            <div className="flex justify-between items-center">
              <strong className="text-highlight font-semibold">🤖 自動ロゴ選定エンジン (Automatic Brand Asset Selector)</strong>
              <span className="text-xs text-muted">表示条件から最適なアセットを自動判定</span>
            </div>

            <div className="grid-3col gap-2">
              <div>
                <label className="form-label block text-xs text-muted">対象プラットフォーム</label>
                <select
                  value={selectorCriteria.platform}
                  onChange={(e) => handleRunSelector({ platform: e.target.value as any })}
                  className="form-control text-xs"
                >
                  <option value="eBay">eBay</option>
                  <option value="Instagram">Instagram</option>
                  <option value="Facebook">Facebook</option>
                  <option value="X">X (Twitter)</option>
                  <option value="Pinterest">Pinterest</option>
                  <option value="TikTok">TikTok</option>
                  <option value="InternalApp">Internal App</option>
                </select>
              </div>

              <div>
                <label className="form-label block text-xs text-muted">配置レイアウト</label>
                <select
                  value={selectorCriteria.layout}
                  onChange={(e) => handleRunSelector({ layout: e.target.value as any })}
                  className="form-control text-xs"
                >
                  <option value="square">正方形 (Square)</option>
                  <option value="horizontal">横長 (Horizontal)</option>
                  <option value="vertical">縦長 (Vertical)</option>
                </select>
              </div>

              <div>
                <label className="form-label block text-xs text-muted">背景カラー</label>
                <select
                  value={selectorCriteria.background}
                  onChange={(e) => handleRunSelector({ background: e.target.value as any })}
                  className="form-control text-xs"
                >
                  <option value="light">明るい背景 (Light White)</option>
                  <option value="dark">暗い背景 (Dark Mode)</option>
                  <option value="transparent">透過指定 (Transparent)</option>
                </select>
              </div>

              <div>
                <label className="form-label block text-xs text-muted">用途カテゴリ</label>
                <select
                  value={selectorCriteria.useCase}
                  onChange={(e) => handleRunSelector({ useCase: e.target.value as any })}
                  className="form-control text-xs"
                >
                  <option value="profile">プロフィール/アバター (Profile)</option>
                  <option value="header">アプリヘッダー/バナー (Header)</option>
                  <option value="post">SNS投稿用 (Post)</option>
                  <option value="watermark">ウォーターマーク (Watermark)</option>
                  <option value="favicon">ファビコン (Favicon)</option>
                  <option value="document">納品書/書類 (Document)</option>
                </select>
              </div>

              <div>
                <label className="form-label block text-xs text-muted">媒体種別</label>
                <select
                  value={selectorCriteria.format}
                  onChange={(e) => handleRunSelector({ format: e.target.value as any })}
                  className="form-control text-xs"
                >
                  <option value="digital">デジタル画面 (Digital UI)</option>
                  <option value="print">印刷物 (Print Material)</option>
                </select>
              </div>
            </div>

            {/* Selection Result Display */}
            <div className="p-3 bg-slate-950 rounded border border-primary/40 flex items-center space-x-4">
              <div className="w-16 h-16 bg-slate-900 border border-slate-700 rounded flex items-center justify-center p-1">
                <img
                  src={selectorResult.selectedAsset.path}
                  alt={selectorResult.selectedAsset.fileName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-muted">自動判定結果:</span>
                  <strong className="text-emerald-400 font-mono font-bold text-sm">
                    {selectorResult.selectedAsset.fileName}
                  </strong>
                  <span className="status-badge status-connected font-mono text-xs">
                    Role: {selectorResult.selectedAsset.role}
                  </span>
                </div>
                <p className="text-xs text-slate-300">💡 <strong>選定理由:</strong> {selectorResult.decisionReason}</p>
              </div>
            </div>
          </div>

          {/* Asset Registry Table */}
          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>プレビュー</th>
                  <th>ファイル名 / ロール</th>
                  <th>解像度 / 形式</th>
                  <th>背景タイプ</th>
                  <th>主な用途・説明</th>
                  <th>ステータス / バージョン</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id}>
                    <td>
                      <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded p-1 flex items-center justify-center">
                        <img src={asset.path} alt={asset.fileName} className="max-h-full max-w-full object-contain" />
                      </div>
                    </td>
                    <td>
                      <strong className="font-mono text-slate-200 block">{asset.fileName}</strong>
                      <span className="text-highlight font-mono text-xs">ROLE: {asset.role}</span>
                    </td>
                    <td>
                      <span className="font-mono text-slate-300 block">{asset.dimensions.width} × {asset.dimensions.height} px</span>
                      <span className="font-mono text-muted text-xs">Format: {asset.format}</span>
                    </td>
                    <td>
                      <span className={asset.backgroundType === 'DARK' ? 'text-purple-400 font-mono' : 'text-amber-400 font-mono'}>
                        {asset.backgroundType}
                      </span>
                    </td>
                    <td>
                      <p className="text-slate-300 text-xs">{asset.intendedUse}</p>
                      <p className="text-muted text-xs mt-0.5">{asset.notes}</p>
                    </td>
                    <td>
                      <span className="status-badge status-connected font-mono block text-center mb-1">
                        {asset.status}
                      </span>
                      <span className="text-muted font-mono text-xs block text-center">{asset.version}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GOOGLE DRIVE PREPARATION */}
      {activeTab === 'GDRIVE_PREP' && (
        <div className="space-y-4 text-xs">
          <div className="card-sub-box bg-slate-900 border-slate-700 space-y-2">
            <div className="flex justify-between items-center">
              <strong className="text-highlight font-bold text-sm">📁 Google Drive テンプレート同期準備 (Local Staging Preview)</strong>
              <span className="status-badge status-connected font-mono">書き込み未実行 (Preview Only)</span>
            </div>
            <p className="text-muted text-xs">
              Google Drive 上のブランドフォルダ <strong>"{drivePreview.targetFolderPath}"</strong> へアップロード予定の全13アセットのローカルマッピング一覧です。
            </p>
            <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded text-amber-300 text-xs">
              ⚠️ <strong>安全制御:</strong> 実際の Google Drive への書き込み・作成は行われません。事前に明確な手動チェック承認が必要です。
            </div>
          </div>

          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>ローカルファイル名</th>
                  <th>アセットロール</th>
                  <th>Google Drive アップロード予定パス</th>
                  <th>バージョン</th>
                  <th>同期ステータス</th>
                </tr>
              </thead>
              <tbody>
                {drivePreview.files.map((file, idx) => (
                  <tr key={idx}>
                    <td><strong className="font-mono text-slate-200">{file.localFileName}</strong></td>
                    <td><span className="font-mono text-highlight">{file.role}</span></td>
                    <td><span className="font-mono text-amber-300">📁 {file.targetDrivePath}</span></td>
                    <td><span className="font-mono text-muted">{file.version}</span></td>
                    <td><span className="status-badge status-warning font-mono">手動承認待ち ({file.status})</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-900 rounded border border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="driveApprovalCheck"
                checked={isDriveApproved}
                onChange={(e) => setIsDriveApproved(e.target.checked)}
                className="custom-checkbox"
              />
              <label htmlFor="driveApprovalCheck" className="text-xs text-slate-200 cursor-pointer">
                Google Drive フォルダ <strong>"{drivePreview.targetFolderPath}"</strong> への将来の同期配置計画を明示的に承認する
              </label>
            </div>
            <button
              type="button"
              className={isDriveApproved ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              disabled={!isDriveApproved}
              onClick={() => alert('同期準備マッピングをローカルで承認しました。(※外部ドライブへの書き込みは行われません)')}
            >
              承認保存 (Simulated Approval)
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: SNS PUBLISHING COMPOSER */}
      {activeTab === 'SNS_COMPOSER' && (
        <div className="space-y-4 text-xs">
          {/* Connector Cards Grid */}
          <div className="grid-3col gap-3">
            {connectors.map((c) => (
              <div
                key={c.platform}
                className={`p-3 rounded border cursor-pointer transition-all ${
                  selectedPlatform === c.platform ? 'bg-slate-900 border-primary shadow-md' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
                onClick={() => setSelectedPlatform(c.platform)}
              >
                <div className="flex justify-between items-center mb-1">
                  <strong className="text-slate-200 text-xs flex items-center gap-1">
                    <span>{c.icon}</span> {c.name}
                  </strong>
                  <span className="text-xs text-muted font-mono">未接続 (Mock)</span>
                </div>
                <div className="text-xs text-muted space-y-0.5 mt-2">
                  <div>推奨アイコン: <span className="text-highlight font-mono">{c.recommendedProfileRole}</span></div>
                  <div>投稿サイズ: <span className="text-slate-300 font-mono">{c.recommendedPostDimensions}</span></div>
                  <div>ウォーターマーク標準: <span className="text-amber-400 font-mono">{c.watermarkDefaultPosition}</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Social Post Composer Form & Live Preview */}
          <div className="grid-2col gap-4 p-4 bg-slate-900 rounded border border-slate-800">
            {/* Form Column */}
            <div className="space-y-3">
              <h4 className="font-bold text-highlight text-xs">✍️ SNS投稿コンテンツ作成 (Composer Input)</h4>

              <div>
                <label className="form-label block text-xs">投稿カテゴリー (Post Category)</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as SocialPostCategory)}
                  className="form-control text-xs"
                >
                  {Object.entries(POST_CATEGORY_LABELS).map(([catKey, info]) => (
                    <option key={catKey} value={catKey}>
                      {info.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label block text-xs">商品タイトル (Seller Owned Product)</label>
                <input
                  type="text"
                  value={productTitleInput}
                  onChange={(e) => setProductTitleInput(e.target.value)}
                  className="form-control text-xs"
                />
              </div>

              <div>
                <label className="form-label block text-xs">SKU 参照 (SKU Reference)</label>
                <input
                  type="text"
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value)}
                  className="form-control text-xs font-mono"
                />
              </div>

              <div>
                <label className="form-label block text-xs">商品画像 URL (実物撮影写真)</label>
                <input
                  type="text"
                  value={samplePhotoUrl}
                  onChange={(e) => setSamplePhotoUrl(e.target.value)}
                  className="form-control text-xs font-mono text-slate-300"
                />
              </div>

              <div className="flex space-x-2 pt-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setIsWatermarkModalOpen(true)}>
                  🛡️ ウォーターマーク位置・安全設定
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={handleGeneratePostDraft}>
                  ⚡ 投稿ドラフト生成
                </button>
              </div>
            </div>

            {/* Preview Column */}
            <div className="space-y-3 bg-slate-950 p-3 rounded border border-slate-800">
              <div className="flex justify-between items-center">
                <strong className="text-sky-400 font-semibold text-xs">
                  📱 {selectedPlatform} 投稿プレビュー (Draft Preview)
                </strong>
                <span className="status-badge status-connected font-mono">
                  Role: {currentPostDraft.selectedAssetRole}
                </span>
              </div>

              {/* Branded Photo Preview Box */}
              <div className="relative border border-slate-800 rounded overflow-hidden bg-slate-900 aspect-video flex items-center justify-center">
                <img src={currentPostDraft.originalPhotoUrl} alt="Post Product" className="max-h-48 object-contain" />
                <div
                  className="absolute pointer-events-none"
                  style={{
                    bottom: `${watermarkConfig.marginPx}px`,
                    right: `${watermarkConfig.marginPx}px`,
                    opacity: watermarkConfig.opacity
                  }}
                >
                  <img src={currentPostDraft.selectedAssetPath} alt="Watermark" className="h-8 w-auto drop-shadow-md" />
                </div>
              </div>

              {/* Caption Preview */}
              <div className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1">
                <span className="text-muted block text-xs">キャプション文章:</span>
                <p className="text-slate-200 whitespace-pre-line text-xs font-sans">{currentPostDraft.caption}</p>
                <div className="text-primary font-mono text-xs">{currentPostDraft.hashtags.join(' ')}</div>
              </div>

              {/* Disclaimers Box */}
              <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded text-xs text-amber-300 space-y-0.5">
                <span className="font-bold block">⚖️ コンプライアンス免責事項:</span>
                {currentPostDraft.disclaimers.map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>

              <button
                type="button"
                className="btn-danger w-full btn-sm font-bold flex items-center justify-center gap-1"
                onClick={handleApproveAndSimulatePublish}
              >
                <span>⚡</span> 手動承認し模擬投稿を記録 (Simulate Manual Approval)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <strong className="text-slate-200">ブランドアセット操作 & SNS投稿 監査ログ一覧</strong>
            <span className="text-muted text-xs">全 {auditLogs.length} 件の記録</span>
          </div>

          <div className="accounts-table-wrapper">
            <table className="accounts-table text-xs">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>操作者 (Actor)</th>
                  <th>アクション概要</th>
                  <th>選択アセットロール</th>
                  <th>対象プラットフォーム</th>
                  <th>手動承認</th>
                  <th>ステータス</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td><span className="font-mono text-muted">{log.timestamp}</span></td>
                    <td><span className="font-mono text-slate-300">{log.actor}</span></td>
                    <td><strong className="text-slate-200">{log.action}</strong></td>
                    <td><span className="font-mono text-highlight">{log.selectedAssetRole}</span></td>
                    <td><span className="font-mono text-amber-300">{log.destinationPlatform}</span></td>
                    <td>
                      <span className={log.userApproved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                        {log.userApproved ? '✓ 承認済み' : '⏳ 未承認'}
                      </span>
                    </td>
                    <td><span className="status-badge status-connected font-mono">{log.publicationStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Watermark Safety Modal */}
      <WatermarkSafetyModal
        isOpen={isWatermarkModalOpen}
        onClose={() => setIsWatermarkModalOpen(false)}
        originalPhotoUrl={samplePhotoUrl}
        watermarkAsset={assets.find((a) => a.role === 'HORIZONTAL_LOGO') || assets[0]}
        watermarkConfig={watermarkConfig}
        onUpdateConfig={setWatermarkConfig}
      />
    </div>
  );
};
