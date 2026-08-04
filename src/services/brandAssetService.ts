import {
  BrandAssetRecord,
  BrandAssetRole,
  AssetSelectionCriteria,
  AssetSelectionResult,
  GoogleDriveBrandSyncPreview,
  SocialPlatformConnector,
  SocialPlatformId,
  SocialPostCategory,
  SocialPostDraft,
  WatermarkConfig,
  BrandAuditLogRecord
} from '../types/brandAsset';

const BRAND_AUDIT_LOGS_KEY = 'zonos_brand_audit_logs';

/**
 * Registry of all 13 Japan Treasure Hunting brand assets.
 * Note: Marked as DRAFT_ASSET (v0.9-draft) based on current PNG/ICO raster files.
 * Designed for seamless upgrade to approved master SVG vectors in the future.
 */
export const INITIAL_BRAND_ASSETS: BrandAssetRecord[] = [
  {
    id: 'asset-001',
    fileName: '01_Main_Logo_White_BG.png',
    path: '/brand-assets/01_Main_Logo_White_BG.png',
    role: 'MAIN_LOGO',
    format: 'PNG',
    dimensions: { width: 540, height: 520 },
    aspectRatio: '1.04:1 (Nearly Square)',
    backgroundType: 'WHITE',
    intendedUse: 'メインブランドロゴ、標準ヘッダー、公式ドキュメントトップ',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '背景白の標準メインロゴ。ドラフト版プロトタイプ画像。'
  },
  {
    id: 'asset-002',
    fileName: '02_Horizontal_Logo_White_BG.png',
    path: '/brand-assets/02_Horizontal_Logo_White_BG.png',
    role: 'HORIZONTAL_LOGO',
    format: 'PNG',
    dimensions: { width: 490, height: 280 },
    aspectRatio: '1.75:1 (Horizontal)',
    backgroundType: 'WHITE',
    intendedUse: '横長アプリケーションヘッダー、ウェブサイトバナー、標準ナビゲーション',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: 'アプリ上部ヘッダーやSNS横長バナーに適した横型ロゴ。'
  },
  {
    id: 'asset-003',
    fileName: '03_Square_Icon_White_BG.png',
    path: '/brand-assets/03_Square_Icon_White_BG.png',
    role: 'SQUARE_ICON',
    format: 'PNG',
    dimensions: { width: 245, height: 245 },
    aspectRatio: '1:1 (Square)',
    backgroundType: 'WHITE',
    intendedUse: '正方形アイコン、SNSプロフィール枠、アバター表示、ウォーターマーク候補',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '正方形アスペクト比アイコン。'
  },
  {
    id: 'asset-004',
    fileName: '04_Circle_Icon_White_BG.png',
    path: '/brand-assets/04_Circle_Icon_White_BG.png',
    role: 'CIRCLE_ICON',
    format: 'PNG',
    dimensions: { width: 250, height: 245 },
    aspectRatio: '1.02:1 (Circular)',
    backgroundType: 'WHITE',
    intendedUse: '円形マスク用プロフィール写真、Instagram/TikTokアバター、丸型スタンプ',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '丸型プロフィール枠用の丸み帯びたブランドアイコン。'
  },
  {
    id: 'asset-005',
    fileName: '05_Monochrome_Logo_White_BG.png',
    path: '/brand-assets/05_Monochrome_Logo_White_BG.png',
    role: 'MONOCHROME_LOGO',
    format: 'PNG',
    dimensions: { width: 240, height: 280 },
    aspectRatio: '0.86:1 (Vertical)',
    backgroundType: 'WHITE',
    intendedUse: '白黒印刷、請求書・納品書、単色刻印、ミニマルスタイルウォーターマーク',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '単色モノクロ表示が必要な印刷物・書類用ロゴ。'
  },
  {
    id: 'asset-006',
    fileName: '06_White_Background_Logo.png',
    path: '/brand-assets/06_White_Background_Logo.png',
    role: 'LIGHT_BACKGROUND_LOGO',
    format: 'PNG',
    dimensions: { width: 261, height: 280 },
    aspectRatio: '0.93:1 (Vertical)',
    backgroundType: 'WHITE',
    intendedUse: 'ライトモードUI、明るい背景用のコントラスト調整済みロゴ',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '明るい背景に最適なコントラスト配置用。'
  },
  {
    id: 'asset-007',
    fileName: '07_Dark_Background_Logo.png',
    path: '/brand-assets/07_Dark_Background_Logo.png',
    role: 'DARK_BACKGROUND_LOGO',
    format: 'PNG',
    dimensions: { width: 240, height: 245 },
    aspectRatio: '0.98:1 (Square-ish)',
    backgroundType: 'DARK',
    intendedUse: 'ダークモードUI、ダークテーマのヘッダー・フッター・暗い商品写真',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '暗い背景やダークモード表示に最適化された高視認性ロゴ。'
  },
  {
    id: 'asset-008',
    fileName: '08_eBay_Profile_Icon.png',
    path: '/brand-assets/08_eBay_Profile_Icon.png',
    role: 'EBAY_PROFILE_ICON',
    format: 'PNG',
    dimensions: { width: 261, height: 245 },
    aspectRatio: '1.06:1 (Square-ish)',
    backgroundType: 'WHITE',
    intendedUse: 'eBayストアプロフィール画像、eBay Seller Hubアバター、eBay出品者ヘッダー',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: 'eBayプラットフォーム仕様に最適化されたセラープロフィールアイコン。'
  },
  {
    id: 'asset-009',
    fileName: '09_Business_Card_Mockup.png',
    path: '/brand-assets/09_Business_Card_Mockup.png',
    role: 'BUSINESS_CARD_MOCKUP',
    format: 'PNG',
    dimensions: { width: 390, height: 315 },
    aspectRatio: '1.24:1 (Card ratio)',
    backgroundType: 'MOCKUP',
    intendedUse: 'ショップショップカード・名刺モックアッププレビュー、同梱状デザインテンプレート',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '購入者への感謝カード・名刺のデザインサンプル。'
  },
  {
    id: 'asset-010',
    fileName: '10_Sticker_Mockup.png',
    path: '/brand-assets/10_Sticker_Mockup.png',
    role: 'STICKER_MOCKUP',
    format: 'PNG',
    dimensions: { width: 265, height: 315 },
    aspectRatio: '0.84:1 (Vertical)',
    backgroundType: 'MOCKUP',
    intendedUse: '梱包用封印ステッカー・ノベルティステッカーの試作モックアップ表示',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '発送ダンボール・ギフト包装用のブランドステッカープレビュー。'
  },
  {
    id: 'asset-011',
    fileName: '11_App_Icon_1024.png',
    path: '/brand-assets/11_App_Icon_1024.png',
    role: 'APP_ICON',
    format: 'PNG',
    dimensions: { width: 1024, height: 1024 },
    aspectRatio: '1:1 (High-Res Square)',
    backgroundType: 'WHITE',
    intendedUse: '高解像度アプリケーションアイコン、デスクトップ/モバイルアプリ起動用マーク',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '1024x1024高画質アプリマスターアイコン。'
  },
  {
    id: 'asset-012',
    fileName: '12_Favicon_512.png',
    path: '/brand-assets/12_Favicon_512.png',
    role: 'FAVICON',
    format: 'PNG',
    dimensions: { width: 512, height: 512 },
    aspectRatio: '1:1 (Square)',
    backgroundType: 'WHITE',
    intendedUse: 'ブラウザタブファビコン (高解像度PNG版)、Web App Manifestアイコン',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: '512x512 Web/PWAファビコン用画像。'
  },
  {
    id: 'asset-013',
    fileName: '13_Favicon.ico',
    path: '/brand-assets/13_Favicon.ico',
    role: 'FAVICON',
    format: 'ICO',
    dimensions: { width: 64, height: 64 },
    aspectRatio: '1:1 (Standard ICO)',
    backgroundType: 'WHITE',
    intendedUse: '標準レガシーブラウザ Favicon.ico タブ用アイコン',
    status: 'DRAFT_ASSET',
    version: 'v0.9-draft',
    isDraft: true,
    notes: 'マルチサイズ内包標準.icoファイル。'
  }
];

export function getBrandAssets(): BrandAssetRecord[] {
  return INITIAL_BRAND_ASSETS;
}

/**
 * Automatic Asset Selector Logic based on parameters:
 * - platform, layout, background, format, useCase
 */
export function selectOptimalBrandAsset(criteria: AssetSelectionCriteria): AssetSelectionResult {
  const assets = getBrandAssets();

  // Rule 1: Favicon requested
  if (criteria.useCase === 'favicon') {
    const ico = assets.find((a) => a.role === 'FAVICON' && a.format === 'ICO');
    const png = assets.find((a) => a.role === 'FAVICON' && a.format === 'PNG');
    const selected = ico || png || assets[0];
    return {
      selectedAsset: selected,
      decisionReason: 'Favicon用途が指定されたため、ブラウザ互換性の最も高いFaviconアイコンを選択しました。',
      matchedCriteria: criteria
    };
  }

  // Rule 2: eBay Profile
  if (criteria.platform === 'eBay' && criteria.useCase === 'profile') {
    const ebayAsset = assets.find((a) => a.role === 'EBAY_PROFILE_ICON');
    if (ebayAsset) {
      return {
        selectedAsset: ebayAsset,
        decisionReason: 'eBay プラットフォームのプロフィール用途に特化した eBay Profile Icon を選択しました。',
        matchedCriteria: criteria
      };
    }
  }

  // Rule 3: Dark Background
  if (criteria.background === 'dark') {
    const darkAsset = assets.find((a) => a.role === 'DARK_BACKGROUND_LOGO');
    if (darkAsset) {
      return {
        selectedAsset: darkAsset,
        decisionReason: 'ダーク背景での高コントラスト視認性を確保するため、Dark Background Logo を選択しました。',
        matchedCriteria: criteria
      };
    }
  }

  // Rule 4: Watermark
  if (criteria.useCase === 'watermark') {
    const mono = assets.find((a) => a.role === 'MONOCHROME_LOGO');
    const horiz = assets.find((a) => a.role === 'HORIZONTAL_LOGO');
    const selected = mono || horiz || assets[0];
    return {
      selectedAsset: selected,
      decisionReason: '写真被せウォーターマーク用途として、商品の視覚的妨げになりにくいモノクロ/横長ロゴを選択しました。',
      matchedCriteria: criteria
    };
  }

  // Rule 5: Horizontal Header Layout
  if (criteria.layout === 'horizontal' || criteria.useCase === 'header') {
    const horiz = assets.find((a) => a.role === 'HORIZONTAL_LOGO');
    if (horiz) {
      return {
        selectedAsset: horiz,
        decisionReason: '横長レイアウト/ヘッダー領域に最適化された Horizontal Logo を自動選択しました。',
        matchedCriteria: criteria
      };
    }
  }

  // Rule 6: Circular Profile (Instagram, TikTok)
  if (criteria.useCase === 'profile' && (criteria.platform === 'Instagram' || criteria.platform === 'TikTok')) {
    const circle = assets.find((a) => a.role === 'CIRCLE_ICON');
    if (circle) {
      return {
        selectedAsset: circle,
        decisionReason: `${criteria.platform} の丸型プロフィール表示領域に最適な Circle Icon を選択しました。`,
        matchedCriteria: criteria
      };
    }
  }

  // Rule 7: Document / Print
  if (criteria.format === 'print' || criteria.useCase === 'document') {
    const mono = assets.find((a) => a.role === 'MONOCHROME_LOGO');
    if (mono) {
      return {
        selectedAsset: mono,
        decisionReason: '印刷物・納品書ドキュメント向けのモノクロ高解像度ロゴを選択しました。',
        matchedCriteria: criteria
      };
    }
  }

  // Default Fallback: Main Logo
  const main = assets.find((a) => a.role === 'MAIN_LOGO') || assets[0];
  return {
    selectedAsset: main,
    decisionReason: '標準的な表示条件に該当するため、最も標準的な Main Logo White BG を選択しました。',
    matchedCriteria: criteria
  };
}

/**
 * Local preview mapping for Google Drive folder "JP Treasure Hunting/07 Templates/Brand Assets"
 * Note: Performs NO network requests or write operations.
 */
export function getGoogleDriveSyncPreview(): GoogleDriveBrandSyncPreview {
  const assets = getBrandAssets();
  return {
    targetFolderPath: 'JP Treasure Hunting/07 Templates/Brand Assets',
    totalFiles: assets.length,
    requiresExplicitUserApproval: true,
    files: assets.map((a) => ({
      localFileName: a.fileName,
      role: a.role,
      targetDrivePath: `JP Treasure Hunting/07 Templates/Brand Assets/${a.fileName}`,
      version: a.version,
      status: 'PENDING_USER_APPROVAL'
    }))
  };
}

/**
 * Initial Connector States for SNS Platforms (All Local & Disconnected)
 */
export function getSocialPlatformConnectors(): SocialPlatformConnector[] {
  return [
    {
      platform: 'Instagram',
      name: 'Instagram (インスタグラム)',
      icon: '📸',
      isConnected: false,
      recommendedProfileRole: 'CIRCLE_ICON',
      recommendedPostLayout: 'square',
      recommendedPostDimensions: '1080 x 1080 px (1:1)',
      watermarkDefaultPosition: 'bottom-right',
      captionTemplate: '✨ 【{CATEGORY_NAME}】{PRODUCT_TITLE}\n🇯🇵 Authenticity Guaranteed from Japan.\nSKU: {SKU_REF}',
      hashtagTemplate: ['#JPTreasure', '#VintageJapan', '#AuthenticJapanese', '#eBaySeller', '#JapanImports'],
      requiresManualApproval: true,
      lastUsedAssetVersion: 'v0.9-draft'
    },
    {
      platform: 'Facebook',
      name: 'Facebook Page',
      icon: '📘',
      isConnected: false,
      recommendedProfileRole: 'SQUARE_ICON',
      recommendedPostLayout: 'horizontal',
      recommendedPostDimensions: '1200 x 630 px (1.91:1)',
      watermarkDefaultPosition: 'bottom-right',
      captionTemplate: '📢 【{CATEGORY_NAME}】{PRODUCT_TITLE}\nExplore premium rare items shipped directly from Japan.\nSKU: {SKU_REF}',
      hashtagTemplate: ['#JPTreasureHunting', '#JapanCollectibles', '#eBayFinds'],
      requiresManualApproval: true,
      lastUsedAssetVersion: 'v0.9-draft'
    },
    {
      platform: 'X',
      name: 'X (formerly Twitter)',
      icon: '🪶',
      isConnected: false,
      recommendedProfileRole: 'CIRCLE_ICON',
      recommendedPostLayout: 'horizontal',
      recommendedPostDimensions: '1200 x 675 px (16:9)',
      watermarkDefaultPosition: 'bottom-right',
      captionTemplate: '🇯🇵 新着アイテム【{CATEGORY_NAME}】{PRODUCT_TITLE}\nDirectly shipped from Japan. SKU: {SKU_REF}',
      hashtagTemplate: ['#JPTreasure', '#eBayJapan', '#JapaneseCollectibles'],
      requiresManualApproval: true,
      lastUsedAssetVersion: 'v0.9-draft'
    },
    {
      platform: 'Pinterest',
      name: 'Pinterest',
      icon: '📌',
      isConnected: false,
      recommendedProfileRole: 'SQUARE_ICON',
      recommendedPostLayout: 'vertical',
      recommendedPostDimensions: '1000 x 1500 px (2:3)',
      watermarkDefaultPosition: 'top-right',
      captionTemplate: '🇯🇵 Japanese Treasure Showcase: {PRODUCT_TITLE} ({SKU_REF})',
      hashtagTemplate: ['#JapaneseVintage', '#Collectibles', '#JapanSelection'],
      requiresManualApproval: true,
      lastUsedAssetVersion: 'v0.9-draft'
    },
    {
      platform: 'TikTok',
      name: 'TikTok',
      icon: '🎵',
      isConnected: false,
      recommendedProfileRole: 'CIRCLE_ICON',
      recommendedPostLayout: 'vertical',
      recommendedPostDimensions: '1080 x 1920 px (9:16)',
      watermarkDefaultPosition: 'top-left',
      captionTemplate: '🇯🇵 Treasure Hunt Spotlight! {PRODUCT_TITLE} 📦 SKU: {SKU_REF}',
      hashtagTemplate: ['#TreasureHunt', '#JapanImports', '#eBaySellerLife'],
      requiresManualApproval: true,
      lastUsedAssetVersion: 'v0.9-draft'
    },
    {
      platform: 'YouTube',
      name: 'YouTube Shorts / Channel',
      icon: '▶️',
      isConnected: false,
      recommendedProfileRole: 'CIRCLE_ICON',
      recommendedPostLayout: 'vertical',
      recommendedPostDimensions: '1080 x 1920 px (Shorts)',
      watermarkDefaultPosition: 'bottom-left',
      captionTemplate: '【JP Treasure Hunting】{PRODUCT_TITLE} - Direct from Japan (SKU: {SKU_REF})',
      hashtagTemplate: ['#Shorts', '#JapanImports', '#TreasureHunting'],
      requiresManualApproval: true,
      lastUsedAssetVersion: 'v0.9-draft'
    }
  ];
}

/**
 * Social Post Category Labels (Japanese)
 */
export const POST_CATEGORY_LABELS: Record<SocialPostCategory, { label: string; tag: string }> = {
  PREVIOUSLY_SOLD: { label: '成約・販売済み実績 (Previously Sold)', tag: 'SOLD' },
  NEW_ARRIVAL: { label: '新着入荷・即出品 (New Arrival)', tag: 'NEW' },
  AVAILABLE_NOW: { label: '現在販売中おすすめ (Available Now)', tag: 'AVAILABLE' },
  SHIPPING_UPDATE: { label: '発送・梱包報告 (Shipping Update)', tag: 'SHIPPED' },
  STORE_ANNOUNCEMENT: { label: 'ショップお知らせ (Store Announcement)', tag: 'NOTICE' }
};

/**
 * Compliance Disclaimers Enforcement
 */
export const MANDATORY_LEGAL_DISCLAIMERS = [
  '⚠️ 本画像は出品者所有の実物撮影写真です。メーカー公式・権利者の公式画像ではありません。',
  '⚠️ 当ショップはメーカー公式の代理店・提携事業者ではありません。独立したリユースセラーです。',
  '⚠️ 実際の商品の状態・シリアル番号・傷・付属品は画像および商品説明をご確認ください。'
];

/**
 * Creates a compliant draft post in local state
 */
export function createSocialPostDraft(
  category: SocialPostCategory,
  platformId: SocialPlatformId,
  productTitle: string,
  skuRef: string,
  originalPhotoUrl: string,
  watermarkConfig: WatermarkConfig
): SocialPostDraft {
  const connectors = getSocialPlatformConnectors();
  const connector = connectors.find((c) => c.platform === platformId) || connectors[0];
  const catInfo = POST_CATEGORY_LABELS[category];

  // Select asset for post watermark
  const selectionResult = selectOptimalBrandAsset({
    platform: platformId,
    layout: connector.recommendedPostLayout,
    background: 'light',
    format: 'digital',
    useCase: 'watermark'
  });

  const formattedCaption = connector.captionTemplate
    .replace('{CATEGORY_NAME}', catInfo.tag)
    .replace('{PRODUCT_TITLE}', productTitle || 'Vintage Product')
    .replace('{SKU_REF}', skuRef || 'SKU-001');

  return {
    id: `post-draft-${Date.now()}`,
    category,
    platform: platformId,
    productTitle: productTitle || 'Vintage Camera Item',
    skuRef: skuRef || 'SKU-CAM-001',
    originalPhotoUrl: originalPhotoUrl || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600',
    selectedAssetRole: selectionResult.selectedAsset.role,
    selectedAssetPath: selectionResult.selectedAsset.path,
    caption: formattedCaption,
    hashtags: connector.hashtagTemplate,
    disclaimers: MANDATORY_LEGAL_DISCLAIMERS,
    watermarkConfig,
    userApproved: false,
    createdAt: new Date().toLocaleString('ja-JP')
  };
}

/**
 * Evaluates Watermark Safety: Checks if watermark position overlaps with critical evidence
 * (Labels, damage, tags, serial numbers, barcodes).
 */
export function checkWatermarkSafety(config: WatermarkConfig): {
  isSafe: boolean;
  warningMessage?: string;
} {
  if (config.autoDisableIfObscuresEvidence && config.isObscuringEvidenceDetected) {
    return {
      isSafe: false,
      warningMessage:
        '🛡️ 【ウォーターマーク自動無効化】商品画像の傷・シリアルナンバー・タグ表示領域との重複が検知されたため、コンプライアンス保護のためウォーターマーク適用を自動停止しました。'
    };
  }
  return { isSafe: true };
}

/**
 * Audit Log Management (sessionStorage)
 */
export function loadBrandAuditLogs(): BrandAuditLogRecord[] {
  try {
    const raw = sessionStorage.getItem(BRAND_AUDIT_LOGS_KEY);
    if (!raw) return createInitialBrandAuditLogs();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialBrandAuditLogs();
  } catch (e) {
    return createInitialBrandAuditLogs();
  }
}

export function saveBrandAuditLogs(logs: BrandAuditLogRecord[]): void {
  try {
    sessionStorage.setItem(BRAND_AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save brand audit logs:', e);
  }
}

export function addBrandAuditLog(log: Omit<BrandAuditLogRecord, 'id' | 'timestamp'>): BrandAuditLogRecord {
  const existing = loadBrandAuditLogs();
  const newRecord: BrandAuditLogRecord = {
    ...log,
    id: `brand-log-${Date.now()}`,
    timestamp: new Date().toLocaleString('ja-JP')
  };
  const updated = [newRecord, ...existing];
  saveBrandAuditLogs(updated);
  return newRecord;
}

function createInitialBrandAuditLogs(): BrandAuditLogRecord[] {
  const todayStr = new Date().toLocaleString('ja-JP');
  return [
    {
      id: 'brand-log-001',
      timestamp: todayStr,
      actor: 'System Admin (Initial)',
      action: 'Brand Asset Registry Initialized (13 Draft Assets Registered)',
      selectedAssetRole: 'MAIN_LOGO',
      selectedAssetFileName: '01_Main_Logo_White_BG.png',
      assetVersion: 'v0.9-draft',
      destinationPlatform: 'Internal Platform',
      derivativeGenerated: false,
      captionSnippet: 'System initialized brand assets catalog.',
      userApproved: true,
      publicationStatus: 'SIMULATED_LOCAL_ONLY'
    }
  ];
}
