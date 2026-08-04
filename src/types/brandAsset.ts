export type BrandAssetRole =
  | 'MAIN_LOGO'
  | 'HORIZONTAL_LOGO'
  | 'SQUARE_ICON'
  | 'CIRCLE_ICON'
  | 'MONOCHROME_LOGO'
  | 'LIGHT_BACKGROUND_LOGO'
  | 'DARK_BACKGROUND_LOGO'
  | 'EBAY_PROFILE_ICON'
  | 'APP_ICON'
  | 'FAVICON'
  | 'BUSINESS_CARD_MOCKUP'
  | 'STICKER_MOCKUP'
  | 'WATERMARK';

export type BrandAssetFormat = 'PNG' | 'ICO';

export type BrandAssetStatus = 'DRAFT_ASSET' | 'APPROVED_MASTER';

export interface BrandAssetRecord {
  id: string;
  fileName: string;
  path: string;
  role: BrandAssetRole;
  format: BrandAssetFormat;
  dimensions: {
    width: number;
    height: number;
  };
  aspectRatio: string;
  backgroundType: 'WHITE' | 'DARK' | 'TRANSPARENT_SIMULATED' | 'MOCKUP';
  intendedUse: string;
  status: BrandAssetStatus;
  version: string;
  isDraft: boolean;
  notes: string;
}

export interface AssetSelectionCriteria {
  platform: 'eBay' | 'Instagram' | 'Facebook' | 'X' | 'Pinterest' | 'TikTok' | 'YouTube' | 'InternalApp';
  layout: 'square' | 'horizontal' | 'vertical';
  background: 'light' | 'dark' | 'transparent';
  format: 'digital' | 'print';
  useCase: 'profile' | 'header' | 'post' | 'watermark' | 'favicon' | 'document';
}

export interface AssetSelectionResult {
  selectedAsset: BrandAssetRecord;
  decisionReason: string;
  matchedCriteria: AssetSelectionCriteria;
}

export interface GoogleDriveBrandSyncFile {
  localFileName: string;
  role: BrandAssetRole;
  targetDrivePath: string;
  version: string;
  status: 'PENDING_USER_APPROVAL' | 'STAGED';
}

export interface GoogleDriveBrandSyncPreview {
  targetFolderPath: string;
  files: GoogleDriveBrandSyncFile[];
  totalFiles: number;
  requiresExplicitUserApproval: boolean;
}

export type SocialPlatformId = 'Instagram' | 'Facebook' | 'X' | 'Pinterest' | 'TikTok' | 'YouTube';

export interface SocialPlatformConnector {
  platform: SocialPlatformId;
  name: string;
  icon: string;
  isConnected: boolean;
  recommendedProfileRole: BrandAssetRole;
  recommendedPostLayout: 'square' | 'horizontal' | 'vertical';
  recommendedPostDimensions: string;
  watermarkDefaultPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  captionTemplate: string;
  hashtagTemplate: string[];
  requiresManualApproval: boolean;
  lastUsedAssetVersion: string;
}

export type SocialPostCategory =
  | 'PREVIOUSLY_SOLD'
  | 'NEW_ARRIVAL'
  | 'AVAILABLE_NOW'
  | 'SHIPPING_UPDATE'
  | 'STORE_ANNOUNCEMENT';

export interface WatermarkConfig {
  opacity: number; // 0.1 to 1.0
  marginPx: number;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  autoDisableIfObscuresEvidence: boolean;
  isObscuringEvidenceDetected: boolean;
  evidenceWarningMessage?: string;
}

export interface SocialPostDraft {
  id: string;
  category: SocialPostCategory;
  platform: SocialPlatformId;
  productTitle: string;
  skuRef: string;
  originalPhotoUrl: string;
  brandedDerivativeUrl?: string;
  selectedAssetRole: BrandAssetRole;
  selectedAssetPath: string;
  caption: string;
  hashtags: string[];
  disclaimers: string[];
  watermarkConfig: WatermarkConfig;
  userApproved: boolean;
  createdAt: string;
}

export interface BrandAuditLogRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  selectedAssetRole: BrandAssetRole;
  selectedAssetFileName: string;
  assetVersion: string;
  destinationPlatform: string;
  derivativeGenerated: boolean;
  captionSnippet: string;
  userApproved: boolean;
  publicationStatus: 'DRAFT_PREPARED' | 'APPROVAL_PENDING' | 'REJECTED' | 'SIMULATED_LOCAL_ONLY';
}
