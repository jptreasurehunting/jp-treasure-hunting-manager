export type HealthStatus =
  | 'healthy' // ✅ 正常
  | 'latest' // 🟢 最新
  | 'needs_check' // 🟡 要確認
  | 'updating' // 🔄 更新中
  | 'needs_refetch' // ⚠ 要再取得
  | 'error' // ❌ エラー
  | 'blocked'; // ⛔ 処理停止

export type OverallHealthStatus =
  | 'ready' // 「業務開始可能」
  | 'needs_verification' // 「要確認」
  | 'blocked'; // 「処理停止」

/**
 * Safety Architecture: 4-tier Information Authority Levels (Spec #10)
 * A. Information successfully verified from an authoritative source
 * B. Administrator-approved policy interpretation
 * C. Cached information
 * D. Unverified information
 */
export type AuthorityLevel =
  | 'authoritative_source' // A. 一次情報源・公式API検証済み
  | 'admin_approved' // B. 管理者承認済みポリシー解釈
  | 'cached' // C. キャッシュ情報
  | 'unverified'; // D. 未検証情報 (AI独自解釈・未確認)

export type VerificationMethod =
  | 'official_api' // 公式API (Official API)
  | 'official_structured' // 公式構造化データ (Official Structured Source)
  | 'admin_approved_rule' // 管理者承認ルール (Administrator-approved Rule)
  | 'cached_rule' // ローカルキャッシュ (Locally Cached Rule)
  | 'unsupported_live'; // ライブ確認未対応 (Unsupported Live Sync)

export type HealthItemCategory =
  | 'dev_env' // 開発環境
  | 'app_feature' // アプリ機能
  | 'shipping_rules' // 配送・規約情報
  | 'future_module'; // 拡張モジュール

export interface HealthItemDetail {
  exactRestriction?: string;
  rejectedAlternatives?: string[];
  source?: string;
  ruleVersion?: string;
  lastVerifiedTime?: string;
  estimatedBusinessImpact?: string;
  recommendedCorrectiveAction?: string;
  rawDiagnostics?: Record<string, any>;
}

export interface ProjectHealthItem {
  id: string;
  name: string;
  category: HealthItemCategory;
  status: HealthStatus;
  statusLabel: string; // e.g. "✅ 正常", "🟢 最新", "🟡 要確認"
  isLiveVerified: boolean;
  liveVerificationNote: string; // e.g. "ライブ確認未対応" or "最終確認: 2026-08-08 09:30"
  lastVerifiedAt: string;
  authorityLevel: AuthorityLevel;
  authorityLevelLabel: string;
  verificationMethod: VerificationMethod;
  verificationMethodLabel: string;
  sourceName: string;
  freshness: string; // e.g. "即時", "10分前", "24時間以内", "期限切れ"
  isCriticalWarning: boolean;
  criticalMessage?: string;
  shortOneLineReason: string; // Compact 1-line reason directly visible (Spec #6)
  details: HealthItemDetail;
}

export interface BusinessReadinessGateResult {
  canProceed: boolean;
  overallStatus: OverallHealthStatus;
  overallStatusLabel: string; // 「業務開始可能」 | 「要確認」 | 「処理停止」
  healthScore: number; // 0-100 supplemental
  blockingReasons: string[];
  warnings: string[];
  lastVerifiedAt: string;
  itemsByCategory: Record<HealthItemCategory, ProjectHealthItem[]>;
  criticalWarnings: ProjectHealthItem[];
}

export interface HealthCheckModulePlugin {
  moduleId: string;
  moduleName: string;
  category?: HealthItemCategory;
  checkHealth: () => ProjectHealthItem | Promise<ProjectHealthItem>;
  defaultAuthorityLevel?: AuthorityLevel;
  defaultVerificationMethod?: VerificationMethod;
}

export interface DiagnosticRunResult {
  type: 'dev_env' | 'business_env';
  executedAt: string;
  allReady: boolean;
  message: string;
  evaluatedItems: ProjectHealthItem[];
}
