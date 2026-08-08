export type AutomationRiskLevel =
  | 'LOW_RISK' // 🟢 自動実行候補 (安全な診断・ビルド・読み取り)
  | 'MEDIUM_RISK' // 🟡 文脈依存 (状態がクリーンな場合のみ自動、それ以外は確認)
  | 'HIGH_RISK' // 🟠 常に人間確認必須 (外部リポジトリ変更・出品・決済・不可逆変更)
  | 'BLOCKED'; // 🔴 自動実行禁止 (強制リセット・破壊的削除・認証情報露出)

export type PolicyPrecedenceDecision =
  | 'BLOCK' // 🔴 最優先でブロック
  | 'REQUIRE_CONFIRMATION' // 🟠 人間確認を要求
  | 'ALLOW'; // 🟢 自動実行を許可

export type ExternalSystemImpact =
  | 'none'
  | 'git_remote'
  | 'ebay_marketplace'
  | 'zonos_customs'
  | 'carrier_api'
  | 'social_media'
  | 'own_ec'
  | 'payment_billing'
  | 'local_working_tree'
  | 'credentials_security';

export interface ActionDefinition {
  actionId: string;
  signaturePattern: string; // e.g. "npm run build", "git push", "git pull"
  category: 'development' | 'git_vcs' | 'marketplace' | 'shipping' | 'sns' | 'financial' | 'system';
  baseRiskLevel: AutomationRiskLevel;
  defaultPrecedence: PolicyPrecedenceDecision;
  businessNameJa: string; // Non-expert description (e.g. "アプリが正常に完成できるか確認")
  technicalCommand: string;
  externalImpact: ExternalSystemImpact;
  isDestructive: boolean;
  isIrreversible: boolean;
  requiresCleanWorkingTree?: boolean;
  requiresNoDivergence?: boolean;
  explanationWhyConfirmationRequired?: string;
}

export interface AutomationPolicy {
  policyId: string;
  actionPattern: string; // e.g. "npm run build", "git status", "npx tsc --noEmit"
  riskLevel: AutomationRiskLevel;
  decision: PolicyPrecedenceDecision;
  allowedContext?: {
    mustBeCleanWorkingTree?: boolean;
    mustBeNoDivergence?: boolean;
    allowedBranches?: string[];
    allowedEnvironments?: string[];
  };
  deniedContext?: {
    denyIfUncommittedChanges?: boolean;
    denyIfDiverged?: boolean;
    denyIfUnpushedCommits?: boolean;
    denyIfHighValueItem?: boolean;
  };
  approvedBy: string; // e.g. "Admin Lead Engineer"
  approvalDate: string;
  policyVersion: string;
  recheckRule: string;
  isActive: boolean;
  isStale: boolean;
}

export interface ActionExecutionStats {
  actionSignature: string;
  commandType: string;
  riskLevel: AutomationRiskLevel;
  totalExecutions: number;
  totalApprovals: number;
  totalFailures: number;
  totalAutoRuns: number;
  lastExecutedAt: string;
  averageDurationMs: number;
  hasChangedFiles: boolean;
  hasChangedExternalSystem: boolean;
  externalSystemName?: string;
  recommendedForAutomation: boolean;
  recommendationReasonJa: string;
}

export interface AntigravityGuidanceItem {
  category: string;
  titleJa: string;
  recommendedSetting: 'AUTO_APPROVE' | 'REQUIRE_PROMPT' | 'ALWAYS_BLOCK';
  recommendedSettingLabel: string;
  rationaleJa: string;
  isAppliedInConfig: boolean;
}

export interface AutomationEvaluationResult {
  actionId: string;
  commandOrAction: string;
  businessNameJa: string;
  riskLevel: AutomationRiskLevel;
  riskBadge: string;
  decision: PolicyPrecedenceDecision;
  canAutoRun: boolean;
  matchedPolicy?: AutomationPolicy;
  blockingReasons: string[];
  contextWarnings: string[];
  confirmationPrompt?: {
    titleJa: string;
    businessMeaningJa: string;
    technicalCommand: string;
    riskCategoryJa: string;
    reasonConfirmationRequiredJa: string;
  };
  stats?: ActionExecutionStats;
}

export interface SafeAutomationAuditEntry {
  id: string;
  timestamp: string;
  actionSignature: string;
  businessNameJa: string;
  riskLevel: AutomationRiskLevel;
  decision: PolicyPrecedenceDecision;
  executedBy: 'AUTO_ENGINE' | 'HUMAN_CONFIRMED' | 'BLOCKED';
  outcome: 'SUCCESS' | 'FAILED' | 'REJECTED';
  ruleVersion: string;
  detailsJa: string;
}
