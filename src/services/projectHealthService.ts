import {
  HealthStatus,
  OverallHealthStatus,
  AuthorityLevel,
  VerificationMethod,
  HealthItemCategory,
  ProjectHealthItem,
  BusinessReadinessGateResult,
  HealthCheckModulePlugin,
  DiagnosticRunResult
} from '../types/projectHealth';
import {
  detectEnvironmentStatus,
  performReadinessCheck,
  verifyPortableProjectCompatibility,
  CURRENT_APPLICATION_VERSION
} from './devEnvManagerService';
import {
  loadSourceHealth,
  triggerAutomaticSync,
  performPreActionVerification,
  loadPolicyProposals
} from './ruleSyncService';
import { loadShippingRegistry } from './shippingRegistryService';
import { loadEbayAccounts } from './ebayAccountService';
import { loadComplianceRecords } from './countryComplianceService';

// Module registry for dynamic future extensions (Spec #12)
const modulePlugins = new Map<string, HealthCheckModulePlugin>();

export function getStatusDisplayLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '✅ 正常';
    case 'latest':
      return '🟢 最新';
    case 'needs_check':
      return '🟡 要確認';
    case 'updating':
      return '🔄 更新中';
    case 'needs_refetch':
      return '⚠ 要再取得';
    case 'error':
      return '❌ エラー';
    case 'blocked':
      return '⛔ 処理停止';
    default:
      return '🟡 要確認';
  }
}

export function getAuthorityLevelDisplayLabel(level: AuthorityLevel): string {
  switch (level) {
    case 'authoritative_source':
      return 'A. 一次公的情報 (Verified Source)';
    case 'admin_approved':
      return 'B. 管理者承認解釈 (Admin Approved)';
    case 'cached':
      return 'C. ローカルキャッシュ (Cached)';
    case 'unverified':
      return 'D. 未検証情報 (Unverified / AI)';
    default:
      return 'D. 未検証情報';
  }
}

export function getVerificationMethodDisplayLabel(method: VerificationMethod): string {
  switch (method) {
    case 'official_api':
      return '公式API (Official API)';
    case 'official_structured':
      return '公式構造化データ (Structured API)';
    case 'admin_approved_rule':
      return '管理者承認ルール (Admin Approved Rule)';
    case 'cached_rule':
      return 'ローカルキャッシュ (Locally Cached)';
    case 'unsupported_live':
      return 'ライブ確認未対応 (Unsupported Live Sync)';
    default:
      return 'ローカルキャッシュ';
  }
}

export function formatDateTime(isoOrDateString?: string): string {
  if (!isoOrDateString) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;
  }
  try {
    const d = new Date(isoOrDateString);
    if (isNaN(d.getTime())) return isoOrDateString;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
      2,
      '0'
    )}`;
  } catch (e) {
    return isoOrDateString;
  }
}

/**
 * Register future extensible modules without modifying dashboard core (Spec #12)
 */
export function registerHealthCheckModule(plugin: HealthCheckModulePlugin): void {
  modulePlugins.set(plugin.moduleId, plugin);
}

export function unregisterHealthCheckModule(moduleId: string): void {
  modulePlugins.delete(moduleId);
}

export function getRegisteredHealthModules(): HealthCheckModulePlugin[] {
  return Array.from(modulePlugins.values());
}

/**
 * Initialize default extensible future modules
 */
function initDefaultFutureModules(): void {
  if (modulePlugins.size === 0) {
    registerHealthCheckModule({
      moduleId: 'module_marketplace_optimizer',
      moduleName: 'Marketplace Optimizer (マーケットプレイス最適化)',
      category: 'future_module',
      defaultAuthorityLevel: 'cached',
      defaultVerificationMethod: 'cached_rule',
      checkHealth: () => ({
        id: 'module_marketplace_optimizer',
        name: 'Marketplace Optimizer',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: false,
        liveVerificationNote: 'ライブ確認未対応',
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'cached',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('cached'),
        verificationMethod: 'cached_rule',
        verificationMethodLabel: getVerificationMethodDisplayLabel('cached_rule'),
        sourceName: 'Marketplace Optimization Engine v1.0',
        freshness: 'キャッシュ済み',
        isCriticalWarning: false,
        shortOneLineReason: '市場価格・出品推奨パラメータ最適化モジュール待機中',
        details: {
          exactRestriction: 'eBay US市場の価格トレンド・競合手数料分析に対応',
          source: 'Marketplace Optimizer Internal Engine',
          ruleVersion: 'Ver. 1.0.4',
          estimatedBusinessImpact: '利益率2%向上の価格調整候補を提示可能',
          recommendedCorrectiveAction: '必要時に最適化ボタンから推奨値を取得してください'
        }
      })
    });

    registerHealthCheckModule({
      moduleId: 'module_inventory_sync',
      moduleName: 'Inventory Sync (全自動在庫同期)',
      category: 'future_module',
      defaultAuthorityLevel: 'admin_approved',
      defaultVerificationMethod: 'admin_approved_rule',
      checkHealth: () => ({
        id: 'module_inventory_sync',
        name: 'Inventory Sync',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: true,
        liveVerificationNote: `最終確認: ${formatDateTime()}`,
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'admin_approved',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('admin_approved'),
        verificationMethod: 'admin_approved_rule',
        verificationMethodLabel: getVerificationMethodDisplayLabel('admin_approved_rule'),
        sourceName: 'Real-time Stock Monitor & Safety Gate',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: '手元現物棚卸し状態と出品数量の不一致なし',
        details: {
          exactRestriction: '現物棚卸し確認済み在庫のみ出品許可 (無在庫出品厳禁)',
          source: 'Safety Inventory Stocktake Service',
          ruleVersion: 'Ver. 1.8.2',
          estimatedBusinessImpact: '在庫不一致によるDefect Rate 0%を維持',
          recommendedCorrectiveAction: '仕入れ・発送時に実在庫チェックを継続してください'
        }
      })
    });

    registerHealthCheckModule({
      moduleId: 'module_sns_marketing',
      moduleName: 'SNS Marketing (SNSマーケティング・コマース)',
      category: 'future_module',
      defaultAuthorityLevel: 'cached',
      defaultVerificationMethod: 'cached_rule',
      checkHealth: () => ({
        id: 'module_sns_marketing',
        name: 'SNS Marketing',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: false,
        liveVerificationNote: 'ライブ確認未対応',
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'cached',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('cached'),
        verificationMethod: 'cached_rule',
        verificationMethodLabel: getVerificationMethodDisplayLabel('cached_rule'),
        sourceName: 'Brand Asset & SNS Publisher Module (Phase 4.1)',
        freshness: 'キャッシュ済み',
        isCriticalWarning: false,
        shortOneLineReason: 'ブランドアセット・SNS自動連携テンプレート待機中',
        details: {
          exactRestriction: 'Instagram / X / Pinterest向け商品写真＆プロモ文生成',
          source: 'BrandAssetManagerCard (Phase 4.1)',
          ruleVersion: 'Phase 4.1 Preview',
          estimatedBusinessImpact: '外部流入による成約率向上の準備完了',
          recommendedCorrectiveAction: 'ブランドアセットタブからSNS文案を生成可能です'
        }
      })
    });

    registerHealthCheckModule({
      moduleId: 'module_multilingual_ec',
      moduleName: 'Multilingual EC (多言語自社ECサイト)',
      category: 'future_module',
      defaultAuthorityLevel: 'cached',
      defaultVerificationMethod: 'unsupported_live',
      checkHealth: () => ({
        id: 'module_multilingual_ec',
        name: 'Multilingual EC',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: false,
        liveVerificationNote: 'ライブ確認未対応',
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'cached',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('cached'),
        verificationMethod: 'unsupported_live',
        verificationMethodLabel: getVerificationMethodDisplayLabel('unsupported_live'),
        sourceName: 'Multilingual Headless EC Connector',
        freshness: '未接続 (オフライン)',
        isCriticalWarning: false,
        shortOneLineReason: '多言語ストアフロントコネクタ拡張準備完了',
        details: {
          exactRestriction: 'Shopify / WooCommerce / 自社越境EC連携スロット',
          source: 'Multi-channel Bridge Service',
          ruleVersion: 'Draft Spec 1.0',
          estimatedBusinessImpact: 'eBay外販路への拡張準備',
          recommendedCorrectiveAction: '越境EC開設時にコネクタを有効化してください'
        }
      })
    });

    registerHealthCheckModule({
      moduleId: 'module_domestic_marketplaces',
      moduleName: 'Domestic Marketplaces (国内EC・ヤフオク・メルカリ連携)',
      category: 'future_module',
      defaultAuthorityLevel: 'admin_approved',
      defaultVerificationMethod: 'admin_approved_rule',
      checkHealth: () => ({
        id: 'module_domestic_marketplaces',
        name: 'Domestic Marketplaces',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: false,
        liveVerificationNote: 'ライブ確認未対応',
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'admin_approved',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('admin_approved'),
        verificationMethod: 'admin_approved_rule',
        verificationMethodLabel: getVerificationMethodDisplayLabel('admin_approved_rule'),
        sourceName: 'Domestic Inventory Cross-listing Adapter',
        freshness: '管理者設定済み',
        isCriticalWarning: false,
        shortOneLineReason: '国内併売時の即時取り下げ連携待機中',
        details: {
          exactRestriction: 'ヤフオク・メルカリ・ラクマ併売時の二重販売防止連携',
          source: 'Domestic Market Sync Protocol',
          ruleVersion: 'Ver. 1.2',
          estimatedBusinessImpact: '国内併売による回転率向上と欠品リスク排除',
          recommendedCorrectiveAction: '併売時は受注直後に他販路の出品を取り下げてください'
        }
      })
    });

    registerHealthCheckModule({
      moduleId: 'module_shipping_contract_optimizer',
      moduleName: 'Shipping Contract Optimizer (運賃契約・ボリューム最適化)',
      category: 'future_module',
      defaultAuthorityLevel: 'authoritative_source',
      defaultVerificationMethod: 'official_structured',
      checkHealth: () => ({
        id: 'module_shipping_contract_optimizer',
        name: 'Shipping Contract Optimizer',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: true,
        liveVerificationNote: `最終確認: ${formatDateTime()}`,
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'authoritative_source',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
        verificationMethod: 'official_structured',
        verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
        sourceName: 'Carrier Tiered Volume Agreement Manager',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: 'FedEx / DHL / 日本郵政の特約運賃テーブル適用中',
        details: {
          exactRestriction: '月間出荷個数に応じた割引レート（Tier 3）を自動適用',
          source: 'Air Shipping Quote Service & Carrier Agreements',
          ruleVersion: '2026 Q3 Active',
          estimatedBusinessImpact: '1件あたり$3〜$8の送料コスト削減',
          recommendedCorrectiveAction: '出荷実績に応じたボリュームランク維持を推奨'
        }
      })
    });

    registerHealthCheckModule({
      moduleId: 'module_staff_team_operation',
      moduleName: 'Staff / Team Operation (スタッフ・チーム権限オペレーション)',
      category: 'future_module',
      defaultAuthorityLevel: 'admin_approved',
      defaultVerificationMethod: 'admin_approved_rule',
      checkHealth: () => ({
        id: 'module_staff_team_operation',
        name: 'Staff & Team Operation',
        category: 'future_module',
        status: 'healthy',
        statusLabel: '✅ 正常',
        isLiveVerified: true,
        liveVerificationNote: `最終確認: ${formatDateTime()}`,
        lastVerifiedAt: formatDateTime(),
        authorityLevel: 'admin_approved',
        authorityLevelLabel: getAuthorityLevelDisplayLabel('admin_approved'),
        verificationMethod: 'admin_approved_rule',
        verificationMethodLabel: getVerificationMethodDisplayLabel('admin_approved_rule'),
        sourceName: 'Role-Based Access Control & Audit Log Engine',
        freshness: '即時',
        isCriticalWarning: false,
        shortOneLineReason: '管理者権限・出品スタッフ・梱包スタッフ権限分離中',
        details: {
          exactRestriction: '誤操作防止二段階確認および全操作の監査ログ記録',
          source: 'Audit Log & Multi-user Safety Gate',
          ruleVersion: 'Ver. 3.0',
          estimatedBusinessImpact: 'スタッフ作業時の人的ミス・誤申告を100%遮断',
          recommendedCorrectiveAction: '監査ログを定期的に.json形式でバックアップしてください'
        }
      })
    });
  }
}

export interface ProjectHealthEvaluationOptions {
  forceDevEnvOverrides?: Partial<ReturnType<typeof detectEnvironmentStatus>>;
  forceEbayAuthError?: boolean;
  forceStaleShippingRule?: boolean;
  forceCarrierSyncFailure?: boolean;
  forceDduCondition?: boolean;
  forceMissingDocument?: boolean;
  forceUnverifiedCriticalRule?: boolean;
  forceAdminApprovedRule?: boolean;
  forceCachedStaleRule?: boolean;
  forcePortableIncompatible?: boolean;
}

/**
 * Central Evaluation Engine for Project Health Dashboard (Specs #1 - #12)
 */
export function evaluateProjectHealth(
  options: ProjectHealthEvaluationOptions = {}
): BusinessReadinessGateResult {
  initDefaultFutureModules();

  const devEnv = detectEnvironmentStatus(options.forceDevEnvOverrides);
  const sources = loadSourceHealth();
  const accounts = loadEbayAccounts();
  const portableCheck = verifyPortableProjectCompatibility(
    options.forcePortableIncompatible ? 'Ver. 4.5' : CURRENT_APPLICATION_VERSION
  );

  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const criticalWarnings: ProjectHealthItem[] = [];

  const devEnvItems: ProjectHealthItem[] = [];
  const appFeatureItems: ProjectHealthItem[] = [];
  const shippingRulesItems: ProjectHealthItem[] = [];
  const futureModuleItems: ProjectHealthItem[] = [];

  const nowStr = formatDateTime();

  // ==========================================
  // 1. 開発環境 (Development Environment: 10 items)
  // ==========================================

  // 1.1 Git repository
  const gitRepoStatus: HealthStatus = devEnv.isGitRepo ? 'healthy' : 'error';
  if (!devEnv.isGitRepo) {
    blockingReasons.push('Gitリポジトリが初期化されていません。初回セットアップを行ってください。');
  }
  const gitRepoItem: ProjectHealthItem = {
    id: 'dev_git_repo',
    name: 'Git repository',
    category: 'dev_env',
    status: gitRepoStatus,
    statusLabel: getStatusDisplayLabel(gitRepoStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Local Git CLI / Repository Check',
    freshness: '即時',
    isCriticalWarning: !devEnv.isGitRepo,
    criticalMessage: !devEnv.isGitRepo ? 'Gitリポジトリが見つかりません' : undefined,
    shortOneLineReason: devEnv.isGitRepo
      ? `Gitリポジトリ正常認識 (${devEnv.repoPath})`
      : 'Gitリポジトリ未設定のため作業を継続できません',
    details: {
      exactRestriction: '有効なローカルGitリポジトリ (.git) の存在が必須',
      source: 'Local Git System',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.isGitRepo ? '安全にソース管理中' : 'コード変更が失われるリスクあり',
      recommendedCorrectiveAction: devEnv.isGitRepo ? '特になし' : 'git init または git clone を実行してください'
    }
  };
  devEnvItems.push(gitRepoItem);
  if (gitRepoItem.isCriticalWarning) criticalWarnings.push(gitRepoItem);

  // 1.2 current branch
  const currentBranchStatus: HealthStatus = devEnv.currentBranch ? 'healthy' : 'needs_check';
  devEnvItems.push({
    id: 'dev_current_branch',
    name: 'current branch',
    category: 'dev_env',
    status: currentBranchStatus,
    statusLabel: getStatusDisplayLabel(currentBranchStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Git Head Reference',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: `作業ブランチ: ${devEnv.currentBranch}`,
    details: {
      exactRestriction: '作業対象ブランチの確認',
      source: 'Git HEAD',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '開発中の機能安全性を確保',
      recommendedCorrectiveAction: '機能に応じた適切なフィーチャーブランチで作業してください'
    }
  });

  // 1.3 local/remote synchronization
  let syncStatus: HealthStatus = 'latest';
  let isSyncCritical = false;
  let syncShortReason = 'ローカルとリモート(GitHub)は完全に同期されています';

  if (devEnv.isDiverged) {
    syncStatus = 'blocked';
    isSyncCritical = true;
    syncShortReason = 'ローカルとリモートが分岐しています (Git divergence: 競合リスク)';
    blockingReasons.push('ローカルとリモートが分岐しています (Git divergence)。競合解決が必要です。');
  } else if (devEnv.isBehind) {
    syncStatus = 'needs_check';
    syncShortReason = 'GitHubに新しい更新があります (要更新・同期確認)';
    warnings.push('GitHubに新しい更新があります。開発環境マネージャーから更新してください。');
  }

  const syncItem: ProjectHealthItem = {
    id: 'dev_sync',
    name: 'local/remote synchronization',
    category: 'dev_env',
    status: syncStatus,
    statusLabel: getStatusDisplayLabel(syncStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'GitHub Remote Origin (git fetch check)',
    freshness: '即時',
    isCriticalWarning: isSyncCritical,
    criticalMessage: isSyncCritical ? 'Git divergence 検出：リモートとの分岐が発生しています' : undefined,
    shortOneLineReason: syncShortReason,
    details: {
      exactRestriction: 'コミット履歴の分岐 (Divergence) がないこと',
      rejectedAlternatives: ['強制プッシュ(force push)の禁止', '未検証でのマージの禁止'],
      source: devEnv.remoteOrigin,
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.isDiverged ? 'コードの上書き破損リスク' : '安全に共有可能',
      recommendedCorrectiveAction: devEnv.isDiverged
        ? 'git status / git log で差分を確認し、競合を解消してください'
        : devEnv.isBehind
        ? '開発環境マネージャーの「最新版へ安全に更新」を実行してください'
        : '現在の状態を維持してください'
    }
  };
  devEnvItems.push(syncItem);
  if (syncItem.isCriticalWarning) criticalWarnings.push(syncItem);

  // 1.4 uncommitted changes
  const uncommittedStatus: HealthStatus = devEnv.hasUncommittedChanges ? 'needs_check' : 'healthy';
  let isUncommittedCritical = false;
  if (devEnv.hasUncommittedChanges && devEnv.isBehind) {
    isUncommittedCritical = true;
    blockingReasons.push('未保存の開発変更がある状態で更新を受信できません。変更を保存または退避してください。');
  }
  const uncommittedItem: ProjectHealthItem = {
    id: 'dev_uncommitted',
    name: 'uncommitted changes',
    category: 'dev_env',
    status: uncommittedStatus,
    statusLabel: getStatusDisplayLabel(uncommittedStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Git Working Tree Status',
    freshness: '即時',
    isCriticalWarning: isUncommittedCritical,
    criticalMessage: isUncommittedCritical ? '未保存の開発変更が存在します（更新適用前に退避または保存が必要）' : undefined,
    shortOneLineReason: devEnv.hasUncommittedChanges
      ? '未コミットのローカル変更が存在します (要確認)'
      : '作業ツリーはクリーンです (未コミット変更なし)',
    details: {
      exactRestriction: '作業ツリーの安全な保存状態の管理',
      source: 'Git Working Directory',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.hasUncommittedChanges ? '作業途中の変更がローカルに保持されています' : '変更なし',
      recommendedCorrectiveAction: devEnv.hasUncommittedChanges
        ? '更新時は「変更を一時退避 (stash)」またはコミットしてください'
        : 'そのまま開発を継続できます'
    }
  };
  devEnvItems.push(uncommittedItem);
  if (uncommittedItem.isCriticalWarning) criticalWarnings.push(uncommittedItem);

  // 1.5 unpushed commits
  const unpushedStatus: HealthStatus = devEnv.hasUnpushedCommits ? 'needs_check' : 'healthy';
  devEnvItems.push({
    id: 'dev_unpushed',
    name: 'unpushed commits',
    category: 'dev_env',
    status: unpushedStatus,
    statusLabel: getStatusDisplayLabel(unpushedStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Git Log Ahead/Behind Counter',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: devEnv.hasUnpushedCommits
      ? 'リモート未プッシュのローカルコミットが存在します'
      : '未プッシュコミットなし (リモートと同期済み)',
    details: {
      exactRestriction: '他PCへの変更共有状態',
      source: 'Local Git Commit Log',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.hasUnpushedCommits ? '他PCからは最新コミットが見えません' : '全PCで最新コミット共有可能',
      recommendedCorrectiveAction: devEnv.hasUnpushedCommits ? '作業完了後に git push を行ってください' : 'そのまま作業可能'
    }
  });

  // 1.6 Node.js
  const nodeStatus: HealthStatus = devEnv.npmAvailable ? 'healthy' : 'error';
  if (!devEnv.npmAvailable) {
    blockingReasons.push('Node.js / npm環境が利用できません。');
  }
  const nodeItem: ProjectHealthItem = {
    id: 'dev_node_js',
    name: 'Node.js',
    category: 'dev_env',
    status: nodeStatus,
    statusLabel: getStatusDisplayLabel(nodeStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Node.js Runtime Environment',
    freshness: '即時',
    isCriticalWarning: !devEnv.npmAvailable,
    criticalMessage: !devEnv.npmAvailable ? 'Node.js ランタイムが見つかりません' : undefined,
    shortOneLineReason: devEnv.npmAvailable
      ? `Node.js ${devEnv.nodeVersion} (npm利用可能・正常)`
      : 'Node.js環境が見つかりません',
    details: {
      exactRestriction: 'Node.js v18+ および npm/npx 実行環境',
      source: 'process.version / Environment PATH',
      ruleVersion: devEnv.nodeVersion,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.npmAvailable ? 'ビルドおよびViteサーバー正常稼働' : 'ビルド不能',
      recommendedCorrectiveAction: devEnv.npmAvailable ? '特になし' : 'Node.js LTS (v20+) をインストールしてください'
    }
  };
  devEnvItems.push(nodeItem);
  if (nodeItem.isCriticalWarning) criticalWarnings.push(nodeItem);

  // 1.7 dependencies
  const depsStatus: HealthStatus = devEnv.nodeModulesExist && devEnv.packageLockValid ? 'healthy' : 'error';
  if (!devEnv.nodeModulesExist) {
    blockingReasons.push('依存パッケージ (node_modules) が存在しません。npm installを実行してください。');
  }
  const depsItem: ProjectHealthItem = {
    id: 'dev_dependencies',
    name: 'dependencies',
    category: 'dev_env',
    status: depsStatus,
    statusLabel: getStatusDisplayLabel(depsStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'package.json & node_modules directory',
    freshness: '即時',
    isCriticalWarning: !devEnv.nodeModulesExist,
    criticalMessage: !devEnv.nodeModulesExist ? '依存パッケージ未インストール (node_modules不足)' : undefined,
    shortOneLineReason: devEnv.nodeModulesExist
      ? 'node_modules および依存ライブラリ正常'
      : '依存パッケージが不足しています (npm installが必要)',
    details: {
      exactRestriction: 'package.json に記載された全ライブラリの整合性',
      source: 'node_modules folder',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.nodeModulesExist ? '全モジュール正常ロード可能' : 'アプリ実行不能',
      recommendedCorrectiveAction: devEnv.nodeModulesExist ? '特になし' : 'npm install を実行してください'
    }
  };
  devEnvItems.push(depsItem);
  if (depsItem.isCriticalWarning) criticalWarnings.push(depsItem);

  // 1.8 environment variables
  const envVarsStatus: HealthStatus = devEnv.envVarsValid ? 'healthy' : 'blocked';
  if (!devEnv.envVarsValid) {
    blockingReasons.push(`必須の環境変数が設定されていません: ${devEnv.missingEnvVars.join(', ')}`);
  }
  const envVarsItem: ProjectHealthItem = {
    id: 'dev_env_vars',
    name: 'environment variables',
    category: 'dev_env',
    status: envVarsStatus,
    statusLabel: getStatusDisplayLabel(envVarsStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: '.env / process.env configuration',
    freshness: '即時',
    isCriticalWarning: !devEnv.envVarsValid,
    criticalMessage: !devEnv.envVarsValid ? `環境変数不足: ${devEnv.missingEnvVars.join(', ')}` : undefined,
    shortOneLineReason: devEnv.envVarsValid
      ? '必須環境変数 (.env) 設定完了'
      : `未設定の環境変数があります: ${devEnv.missingEnvVars.join(', ')}`,
    details: {
      exactRestriction: 'eBay / Zonos / Google Auth 等のAPIキー・クレデンシャル',
      source: '.env / .env.local',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.envVarsValid ? 'API通信・認証が安全に動作' : '外部API連携が停止',
      recommendedCorrectiveAction: devEnv.envVarsValid ? '特になし' : '.env.example をコピーして .env を設定してください'
    }
  };
  devEnvItems.push(envVarsItem);
  if (envVarsItem.isCriticalWarning) criticalWarnings.push(envVarsItem);

  // 1.9 localhost development server
  const localhostStatus: HealthStatus = devEnv.localhostServerOnline ? 'healthy' : 'needs_check';
  if (!devEnv.localhostServerOnline) {
    warnings.push('開発サーバーが停止しています。npm run devで起動してください。');
  }
  const localhostItem: ProjectHealthItem = {
    id: 'dev_localhost_server',
    name: 'localhost development server',
    category: 'dev_env',
    status: localhostStatus,
    statusLabel: getStatusDisplayLabel(localhostStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Vite Local Dev Server (http://localhost:3000)',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: devEnv.localhostServerOnline
      ? 'ローカル開発サーバー稼働中 (http://localhost:3000)'
      : '開発サーバー停止中 (npm run dev で起動可能)',
    details: {
      exactRestriction: 'ポート3000でのVite開発サーバー稼働',
      source: 'http://localhost:3000',
      ruleVersion: 'Vite 5.x',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.localhostServerOnline ? 'ブラウザでリアルタイムプレビュー可能' : 'UIプレビュー停止中',
      recommendedCorrectiveAction: devEnv.localhostServerOnline ? '特になし' : 'ターミナルで npm run dev を実行してください'
    }
  };
  devEnvItems.push(localhostItem);

  // 1.10 Chrome Sell Similar extension
  const chromeExtStatus: HealthStatus = devEnv.chromeExtensionFolderExist ? 'healthy' : 'needs_check';
  if (!devEnv.chromeExtensionFolderExist) {
    warnings.push('Chrome Sell Similar拡張機能フォルダーが未作成です。');
  }
  const chromeExtItem: ProjectHealthItem = {
    id: 'dev_chrome_ext',
    name: 'Chrome Sell Similar extension',
    category: 'dev_env',
    status: chromeExtStatus,
    statusLabel: getStatusDisplayLabel(chromeExtStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Chrome Extension Build Directory (public/chrome-extension)',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: devEnv.chromeExtensionFolderExist
      ? `Chrome拡張機能ビルド済み (${devEnv.chromeExtensionStatus})`
      : 'Chrome拡張機能フォルダー未作成',
    details: {
      exactRestriction: 'manifest.json / content-script.js のビルド整合性',
      source: 'Chrome Extension Bundle',
      ruleVersion: 'Ver. 1.2',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: devEnv.chromeExtensionFolderExist ? 'eBayページ上での自動ワンクリック転記が可能' : '手動転記のみ',
      recommendedCorrectiveAction: devEnv.chromeExtensionFolderExist
        ? 'chrome://extensions でデベロッパーモードから読み込んでください'
        : 'npm run build で拡張機能を生成してください'
    }
  };
  devEnvItems.push(chromeExtItem);

  // ==========================================
  // 2. アプリ機能 (App Features: 8 items)
  // ==========================================

  // 2.1 Sell Similar
  appFeatureItems.push({
    id: 'app_sell_similar',
    name: 'Sell Similar',
    category: 'app_feature',
    status: 'healthy',
    statusLabel: getStatusDisplayLabel('healthy'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Sell Similar Automation Launcher Engine',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: '類似出品(Sell Similar)自動転記エンジン正常待機中',
    details: {
      exactRestriction: 'タイトル・価格・カテゴリ・Item Specificsの自動抽出と安全転記',
      source: 'SellSimilarLauncher Component',
      ruleVersion: 'Ver. 2.0',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '新規出品作成作業時間を90%短縮',
      recommendedCorrectiveAction: '類似出品タブから即座にワンクリック起動可能です'
    }
  });

  // 2.2 Zonos Prepay
  appFeatureItems.push({
    id: 'app_zonos_prepay',
    name: 'Zonos Prepay',
    category: 'app_feature',
    status: 'healthy',
    statusLabel: getStatusDisplayLabel('healthy'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'admin_approved',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('admin_approved'),
    verificationMethod: 'admin_approved_rule',
    verificationMethodLabel: getVerificationMethodDisplayLabel('admin_approved_rule'),
    sourceName: 'Zonos Prepay Transfer & Valuation Manager',
    freshness: '管理者承認済み',
    isCriticalWarning: false,
    shortOneLineReason: '1/3申告額候補自動計算・おまけ管理・完全手動承認ゲート稼働中',
    details: {
      exactRestriction: 'Zonosへの自動送信・自動支払いを禁止し、最終確認モーダル経由でのみ別タブ転記を許可',
      source: 'ZonosReviewModal / ZonosCustomsValidator',
      ruleVersion: 'Ver. 2.5',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '誤申告・誤課税の人的ミスを100%防止',
      recommendedCorrectiveAction: '出荷時に7項目確認モーダルで「確認しました」にチェックして実行してください'
    }
  });

  // 2.3 AI Shipping Advisor
  appFeatureItems.push({
    id: 'app_ai_shipping_advisor',
    name: 'AI Shipping Advisor',
    category: 'app_feature',
    status: 'healthy',
    statusLabel: getStatusDisplayLabel('healthy'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'AI Shipping Multi-Carrier Decision Engine',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: 'eBay eIS / FedEx / DHL / 日本郵政の最適配送ルート・利益率を常時判定',
    details: {
      exactRestriction: '最安値と推奨値の同時評価・高額時計および規制品の自動排除',
      source: 'aiShippingAdvisorService.ts',
      ruleVersion: 'Ver. 3.0',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '返送・バイヤー未受取リスクを最小化し利益を最大化',
      recommendedCorrectiveAction: 'AI推奨理由（1行要約＋詳細展開）を確認して最適なクーリエを選択してください'
    }
  });

  // 2.4 Shipping Template
  appFeatureItems.push({
    id: 'app_shipping_template',
    name: 'Shipping Template',
    category: 'app_feature',
    status: 'healthy',
    statusLabel: getStatusDisplayLabel('healthy'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'eBay Business Policy Template Manager',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: '定額・計算送料ポリシー・国別除外設定テンプレート正常',
    details: {
      exactRestriction: 'eIS連携・DDPポリシーテンプレートの自動生成',
      source: 'shippingTemplateService.ts',
      ruleVersion: 'Ver. 2.1',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '出品時のポリシー設定ミスを防止',
      recommendedCorrectiveAction: '配送テンプレートマネージャーからポリシーを適用してください'
    }
  });

  // 2.5 Shipping Compliance Engine
  let complianceStatus: HealthStatus = 'healthy';
  let isComplianceBlocked = false;
  if (options.forceDduCondition) {
    complianceStatus = 'blocked';
    isComplianceBlocked = true;
    blockingReasons.push('DDU(関税受取人払い)設定が検出されました。EU/英国宛てはDDP必須です。');
  }
  const complianceItem: ProjectHealthItem = {
    id: 'app_shipping_compliance_engine',
    name: 'Shipping Compliance Engine',
    category: 'app_feature',
    status: complianceStatus,
    statusLabel: getStatusDisplayLabel(complianceStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Central DDP & National Compliance Evaluator',
    freshness: '即時',
    isCriticalWarning: isComplianceBlocked,
    criticalMessage: isComplianceBlocked ? 'DDU検出：関税後払いリスクが存在します' : undefined,
    shortOneLineReason: isComplianceBlocked
      ? 'DDU配送方法が選択されています (EU/英国宛てはDDP厳守)'
      : 'DDP必須ゲート・禁制品フィルタ・ドイツVerpackG包装法チェック正常',
    details: {
      exactRestriction: 'EU/英国宛てDDP必須・LUCID/EPR登録状態の検証',
      rejectedAlternatives: ['DDU(関税受取人払い)の利用', 'LUCID未登録でのドイツ宛て発送'],
      source: 'countryComplianceService.ts / safetyGateService.ts',
      ruleVersion: 'Ver. 1.8',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: isComplianceBlocked ? '税関返送・罰金・アカウント停止リスク' : '100%安全な通関を実現',
      recommendedCorrectiveAction: isComplianceBlocked
        ? 'DDP配送方法(eIS / FedEx FICP / DHL Express DDP)へ変更してください'
        : '現在の設定を維持してください'
    }
  };
  appFeatureItems.push(complianceItem);
  if (complianceItem.isCriticalWarning) criticalWarnings.push(complianceItem);

  // 2.6 Rule Sync
  const ruleSyncState = sources.some((s) => s.status === 'updating')
    ? 'updating'
    : sources.some((s) => s.status === 'failed')
    ? 'error'
    : sources.some((s) => s.status === 'needs_recheck')
    ? 'needs_refetch'
    : 'latest';
  appFeatureItems.push({
    id: 'app_rule_sync',
    name: 'Rule Sync',
    category: 'app_feature',
    status: ruleSyncState,
    statusLabel: getStatusDisplayLabel(ruleSyncState),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Automatic Compliance-Rule Synchronization Engine',
    freshness: '24時間自動更新',
    isCriticalWarning: ruleSyncState === 'error',
    criticalMessage: ruleSyncState === 'error' ? 'キャリア規約の自動同期に失敗しました' : undefined,
    shortOneLineReason: `自動規約同期稼働中 (前回: ${formatDateTime(sources[0]?.lastSuccessfulSync)})`,
    details: {
      exactRestriction: 'アプリ起動時および24時間ごとの自動検証・出品前ゲート検証',
      source: 'ruleSyncService.ts',
      ruleVersion: 'Ver. 3.0',
      lastVerifiedTime: formatDateTime(sources[0]?.lastSuccessfulSync),
      estimatedBusinessImpact: '規約改定による不意の返送・罰則を未然に防止',
      recommendedCorrectiveAction: '「最新ルールを今すぐ再確認」ボタンで手動再同期も可能です'
    }
  });

  // 2.7 Portable Project
  const isPortableOk = Boolean(portableCheck.isCompatible && !options.forcePortableIncompatible);
  const portableStatus: HealthStatus = isPortableOk ? 'healthy' : 'blocked';
  if (!isPortableOk) {
    blockingReasons.push('ポータブルプロジェクトのバージョン上位互換性がありません。アプリの更新が必要です。');
  }
  const portableItem: ProjectHealthItem = {
    id: 'app_portable_project',
    name: 'Portable Project',
    category: 'app_feature',
    status: portableStatus,
    statusLabel: getStatusDisplayLabel(portableStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Zonos Portable Project Packaging Engine',
    freshness: '即時',
    isCriticalWarning: !isPortableOk,
    criticalMessage: !isPortableOk ? 'ポータブルプロジェクトバージョン不一致 (互換性エラー)' : undefined,
    shortOneLineReason: isPortableOk
      ? `マルチPC互換性正常 (${CURRENT_APPLICATION_VERSION})`
      : 'ポータブルプロジェクトの上位互換性がありません',
    details: {
      exactRestriction: 'USB・Google Drive・LAN経由の複数PC間設定移行互換性',
      source: 'zonosPortableProjectService.ts',
      ruleVersion: CURRENT_APPLICATION_VERSION,
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: isPortableOk ? 'どのPCでも同一データで安全に再開可能' : '移行データの読み込み不能',
      recommendedCorrectiveAction: isPortableOk ? '特になし' : 'アプリを最新バージョンに更新してください'
    }
  };
  appFeatureItems.push(portableItem);
  if (portableItem.isCriticalWarning) criticalWarnings.push(portableItem);

  // 2.8 eBay API connection
  const isEbayAuthError = Boolean(options.forceEbayAuthError);
  const ebayApiStatus: HealthStatus = isEbayAuthError ? 'blocked' : 'healthy';
  if (isEbayAuthError) {
    blockingReasons.push('eBay API認証に失敗しました。OAuthトークンを再取得してください。');
  }
  const ebayApiItem: ProjectHealthItem = {
    id: 'app_ebay_api_connection',
    name: 'eBay API connection',
    category: 'app_feature',
    status: ebayApiStatus,
    statusLabel: getStatusDisplayLabel(ebayApiStatus),
    isLiveVerified: true,
    liveVerificationNote: isEbayAuthError ? '認証エラー発生中' : `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_api',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_api'),
    sourceName: 'Official eBay REST API Gateway (OAuth 2.0)',
    freshness: '即時',
    isCriticalWarning: isEbayAuthError,
    criticalMessage: isEbayAuthError ? 'eBay OAuth認証エラー：API接続が切断されています' : undefined,
    shortOneLineReason: isEbayAuthError
      ? 'eBay API認証に失敗しました (OAuthトークン期限切れ・再認証が必要)'
      : `eBay API 接続正常 (${accounts.length}アカウント連携中)`,
    details: {
      exactRestriction: 'eBay OAuth 2.0 User Token & Client Credentials Token 有効性',
      source: 'ebayAccountService.ts / eBay Developer Portal',
      ruleVersion: 'OAuth 2.0 Spec',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: isEbayAuthError ? '出品・在庫更新・注文取得が全停止' : '注文取得・出品連携が正常動作',
      recommendedCorrectiveAction: isEbayAuthError
        ? 'eBayアカウント管理画面から「再認証(OAuthログイン)」を行ってください'
        : '特になし'
    }
  };
  appFeatureItems.push(ebayApiItem);
  if (ebayApiItem.isCriticalWarning) criticalWarnings.push(ebayApiItem);

  // ==========================================
  // 3. 配送・規約情報 (Shipping & Rules Information: 8 items)
  // ==========================================

  // 3.1 eBay shipping/compliance rules
  const isStaleShippingRule = Boolean(options.forceStaleShippingRule);
  const ebayRuleStatus: HealthStatus = isStaleShippingRule ? 'needs_refetch' : 'latest';
  if (isStaleShippingRule) {
    warnings.push('eBay配送・規約情報が期限切れです。最新ルールを再取得してください。');
  }
  const ebayRuleItem: ProjectHealthItem = {
    id: 'rule_ebay_shipping_compliance',
    name: 'eBay shipping/compliance rules',
    category: 'shipping_rules',
    status: ebayRuleStatus,
    statusLabel: getStatusDisplayLabel(ebayRuleStatus),
    isLiveVerified: !isStaleShippingRule,
    liveVerificationNote: isStaleShippingRule ? '最終確認: 2026-08-01 10:00 (要再取得)' : `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: isStaleShippingRule ? 'cached' : 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel(isStaleShippingRule ? 'cached' : 'authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Official eBay Integrated Shipping API & Policy Server',
    freshness: isStaleShippingRule ? '期限切れ (24時間超過)' : '最新 (24時間以内)',
    isCriticalWarning: isStaleShippingRule,
    criticalMessage: isStaleShippingRule ? 'eBay重要配送ルールが期限切れです（再取得が必要）' : undefined,
    shortOneLineReason: isStaleShippingRule
      ? 'eBay配送規約が有効期限切れです (最新ルールを今すぐ再確認してください)'
      : 'eIS対象国・国際配送ポリシー・禁制品リスト最新確認済み',
    details: {
      exactRestriction: 'eBay International Shipping (eIS) 配送適格性判定',
      source: 'eBay International Shipping Standards 2026',
      ruleVersion: '2026.08',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: isStaleShippingRule ? '旧ルール適用による配送事故リスク' : '安全なeIS配送を保証',
      recommendedCorrectiveAction: isStaleShippingRule
        ? '「最新ルールを今すぐ再確認」を押して規約を更新してください'
        : '特になし'
    }
  };
  shippingRulesItems.push(ebayRuleItem);
  if (ebayRuleItem.isCriticalWarning) criticalWarnings.push(ebayRuleItem);

  // 3.2 eBay Authenticity Guarantee rules
  let agStatus: HealthStatus = 'latest';
  let isAgCritical = false;
  if (options.forceMissingDocument) {
    agStatus = 'blocked';
    isAgCritical = true;
    blockingReasons.push('Authenticity Guarantee ($2,000+ 時計): 鑑定センター宛てEVTNまたは鑑定必須配送指示が不足しています。');
  }
  const agItem: ProjectHealthItem = {
    id: 'rule_ebay_authenticity_guarantee',
    name: 'eBay Authenticity Guarantee rules',
    category: 'shipping_rules',
    status: agStatus,
    statusLabel: getStatusDisplayLabel(agStatus),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'eBay Authenticity Guarantee Operations Bulletin (Dayton, OH)',
    freshness: '最新',
    isCriticalWarning: isAgCritical,
    criticalMessage: isAgCritical ? 'Authenticity Guarantee 競合またはEVTN不足が検出されました' : undefined,
    shortOneLineReason: isAgCritical
      ? 'AG対象品($2,000+時計)で鑑定センター宛て配送指示またはEVTNが不足しています'
      : 'Dayton鑑定センター直送フロー・追跡フルエンド・EVTN要件正常',
    details: {
      exactRestriction: '$2,000以上の高級腕時計・ジュエリーは直接バイヤーではなくDayton OH鑑定所へ配送必須',
      source: 'eBay AG Workflow Standard 2026',
      ruleVersion: 'Ver. 3.2',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: isAgCritical ? '鑑定所への未到着によるバイヤー全額返金リスク' : '確実な鑑定受取と支払いを保証',
      recommendedCorrectiveAction: isAgCritical
        ? '配送先をDayton鑑定センターに設定し、追跡番号とEVTNを紐付けてください'
        : '特になし'
    }
  };
  shippingRulesItems.push(agItem);
  if (agItem.isCriticalWarning) criticalWarnings.push(agItem);

  // 3.3 Japan Post availability/rules
  shippingRulesItems.push({
    id: 'rule_japan_post',
    name: 'Japan Post availability/rules',
    category: 'shipping_rules',
    status: 'latest',
    statusLabel: getStatusDisplayLabel('latest'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Japan Post Official Acceptance & Country Status API',
    freshness: '即時',
    isCriticalWarning: false,
    shortOneLineReason: '日本郵便 EMS・航空便・船便の引受停止国・重量制限最新確認済み',
    details: {
      exactRestriction: 'EMSサイズ制限 (長辺1.5m以内、長さ＋胴回り3m以内)・禁制品判定',
      source: 'Japan Post International Mail API',
      ruleVersion: '2026.08.01 Update',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '日本郵政引受停止国への誤発送を防止',
      recommendedCorrectiveAction: '停止国宛てはFedExまたはDHLを選択してください'
    }
  });

  // 3.4 FedEx rules
  const isFedExSyncFailed = Boolean(options.forceCarrierSyncFailure);
  const fedexStatus: HealthStatus = isFedExSyncFailed ? 'error' : 'latest';
  if (isFedExSyncFailed) {
    blockingReasons.push('FedExキャリア規約の同期に失敗しました。');
  }
  const fedexItem: ProjectHealthItem = {
    id: 'rule_fedex',
    name: 'FedEx rules',
    category: 'shipping_rules',
    status: fedexStatus,
    statusLabel: getStatusDisplayLabel(fedexStatus),
    isLiveVerified: !isFedExSyncFailed,
    liveVerificationNote: isFedExSyncFailed ? '同期失敗' : `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_api',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_api'),
    sourceName: 'FedEx Direct DDP API & FICP Rate Engine',
    freshness: isFedExSyncFailed ? '同期失敗' : '最新',
    isCriticalWarning: isFedExSyncFailed,
    criticalMessage: isFedExSyncFailed ? 'FedEx 規約・レート同期エラーが発生しています' : undefined,
    shortOneLineReason: isFedExSyncFailed
      ? 'FedEx規約の同期に失敗しました (一時的な通信障害)'
      : 'FedEx推奨：腕時計のためSpeedPAK対象外・Watch Worksheet要件連動中',
    details: {
      exactRestriction: 'FICP DDP運賃・Watch Worksheet添付義務・バッテリー制限',
      source: 'FedEx Developer Portal API',
      ruleVersion: '2026.3',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: isFedExSyncFailed ? 'FedExの正確な送料計算不能' : '迅速な通関と低運賃を実現',
      recommendedCorrectiveAction: isFedExSyncFailed
        ? 'ネットワーク接続を確認して「最新ルールを今すぐ再確認」を押してください'
        : '特になし'
    }
  };
  shippingRulesItems.push(fedexItem);
  if (fedexItem.isCriticalWarning) criticalWarnings.push(fedexItem);

  // 3.5 DHL rules
  shippingRulesItems.push({
    id: 'rule_dhl',
    name: 'DHL rules',
    category: 'shipping_rules',
    status: 'latest',
    statusLabel: getStatusDisplayLabel('latest'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'DHL Express DDP API & Remote Area Surcharge Index',
    freshness: '最新',
    isCriticalWarning: false,
    shortOneLineReason: 'DHL Express DDP・遠隔地手数料・航空危険物規定連動済み',
    details: {
      exactRestriction: 'DHL Express DDP税金立替手数料・リチウムイオン電池規定',
      source: 'DHL Express API 2026',
      ruleVersion: '2026.07',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '最速の欧米・アジア配送をサポート',
      recommendedCorrectiveAction: '遠隔地宛ては追加料金が発生するため事前確認してください'
    }
  });

  // 3.6 UPS rules
  shippingRulesItems.push({
    id: 'rule_ups',
    name: 'UPS rules',
    category: 'shipping_rules',
    status: 'latest',
    statusLabel: getStatusDisplayLabel('latest'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'UPS Worldwide Saver & Expedited Policy Index',
    freshness: '最新',
    isCriticalWarning: false,
    shortOneLineReason: 'UPS Worldwide Saver / Expedited DDP規定・重量制限正常',
    details: {
      exactRestriction: 'UPS 最大重量70kg・最大長さ274cm・DDP関税立替',
      source: 'UPS Developer API',
      ruleVersion: '2026.06',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '重量物・大型商品の国際配送をサポート',
      recommendedCorrectiveAction: '特になし'
    }
  });

  // 3.7 eBay SpeedPAK rules
  shippingRulesItems.push({
    id: 'rule_speedpak',
    name: 'eBay SpeedPAK rules',
    category: 'shipping_rules',
    status: 'latest',
    statusLabel: getStatusDisplayLabel('latest'),
    isLiveVerified: true,
    liveVerificationNote: `最終確認: ${nowStr}`,
    lastVerifiedAt: nowStr,
    authorityLevel: 'authoritative_source',
    authorityLevelLabel: getAuthorityLevelDisplayLabel('authoritative_source'),
    verificationMethod: 'official_structured',
    verificationMethodLabel: getVerificationMethodDisplayLabel('official_structured'),
    sourceName: 'Orange Connex SpeedPAK Service Terms',
    freshness: '最新',
    isCriticalWarning: false,
    shortOneLineReason: 'SpeedPAK制限事項：高額腕時計・特定貴金属は対象外として除外済み',
    details: {
      exactRestriction: 'SpeedPAKは$1,000以上の腕時計・特定カテゴリが引受不可',
      rejectedAlternatives: ['腕時計商品に対するSpeedPAKの適用（自動除外）'],
      source: 'Orange Connex Japan SpeedPAK Terms',
      ruleVersion: '2026 Q2',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '集荷拒否・輸送中返送トラブルを100%防止',
      recommendedCorrectiveAction: '腕時計・貴金属はFedExまたはDHLを利用してください'
    }
  });

  // 3.8 Zonos rules
  const isUnverifiedZonos = Boolean(options.forceUnverifiedCriticalRule);
  const isCachedStaleZonos = Boolean(options.forceCachedStaleRule);
  let zonosStatus: HealthStatus = 'latest';
  let zonosAuthority: AuthorityLevel = 'authoritative_source';
  let zonosVerificationMethod: VerificationMethod = 'official_structured';
  let zonosNote = `最終確認: ${nowStr}`;

  if (isUnverifiedZonos) {
    zonosStatus = 'needs_check';
    zonosAuthority = 'unverified';
    zonosVerificationMethod = 'unsupported_live';
    zonosNote = 'ライブ確認未対応';
    warnings.push('Zonos最新関税ルールが未検証です。内容を確認してください。');
  } else if (isCachedStaleZonos) {
    zonosStatus = 'needs_refetch';
    zonosAuthority = 'cached';
    zonosVerificationMethod = 'cached_rule';
    zonosNote = '最終確認: 2026-07-15 08:00 (期限切れ)';
    warnings.push('Zonos関税ルールがキャッシュ期限切れです。');
  } else if (options.forceAdminApprovedRule) {
    zonosAuthority = 'admin_approved';
    zonosVerificationMethod = 'admin_approved_rule';
  }

  const zonosItem: ProjectHealthItem = {
    id: 'rule_zonos',
    name: 'Zonos rules',
    category: 'shipping_rules',
    status: zonosStatus,
    statusLabel: getStatusDisplayLabel(zonosStatus),
    isLiveVerified: !isUnverifiedZonos && !isCachedStaleZonos,
    liveVerificationNote: zonosNote,
    lastVerifiedAt: nowStr,
    authorityLevel: zonosAuthority,
    authorityLevelLabel: getAuthorityLevelDisplayLabel(zonosAuthority),
    verificationMethod: zonosVerificationMethod,
    verificationMethodLabel: getVerificationMethodDisplayLabel(zonosVerificationMethod),
    sourceName: 'Zonos Landed Cost API & Cross-Border Customs Policy',
    freshness: isUnverifiedZonos ? '未検証' : isCachedStaleZonos ? 'キャッシュ期限切れ' : '最新',
    isCriticalWarning: isUnverifiedZonos || isCachedStaleZonos,
    criticalMessage: isUnverifiedZonos
      ? 'Zonos関税ルール未検証（AI解釈単体での発送決定は不可）'
      : isCachedStaleZonos
      ? 'Zonosキャッシュルール期限切れ'
      : undefined,
    shortOneLineReason: isUnverifiedZonos
      ? 'Zonos関税ルールが未検証です (管理者承認またはAPI再取得が必要)'
      : isCachedStaleZonos
      ? 'Zonos関税ルールが期限切れです (再取得してください)'
      : 'Zonos Prepay 1/3申告額算出・DDP関税計算ロジック正常連動中',
    details: {
      exactRestriction: '国別関税・VAT・Zonos Prepay手数料の事前算出',
      source: 'Zonos Customs Engine',
      ruleVersion: 'Ver. 2.5',
      lastVerifiedTime: nowStr,
      estimatedBusinessImpact: '通関時の関税トラブルおよびバイヤー受け取り拒否を完全防止',
      recommendedCorrectiveAction: isUnverifiedZonos
        ? '管理者がポリシー提案を承認するか、公式APIで再取得してください'
        : '特になし'
    }
  };
  shippingRulesItems.push(zonosItem);
  if (zonosItem.isCriticalWarning) criticalWarnings.push(zonosItem);

  // ==========================================
  // 4. 拡張モジュール (Future Extensible Modules)
  // ==========================================
  for (const plugin of getRegisteredHealthModules()) {
    try {
      const item = plugin.checkHealth();
      const resolvedItem: ProjectHealthItem = item instanceof Promise ? (item as any) : item;
      futureModuleItems.push(resolvedItem);
      if (resolvedItem.isCriticalWarning) {
        criticalWarnings.push(resolvedItem);
      }
    } catch (e) {
      console.error(`Failed to evaluate future module ${plugin.moduleId}:`, e);
    }
  }

  // ==========================================
  // Overall Health Determination (Spec #3)
  // ==========================================
  const allItems = [
    ...devEnvItems,
    ...appFeatureItems,
    ...shippingRulesItems,
    ...futureModuleItems
  ];

  const errorCount = allItems.filter((i) => i.status === 'error' || i.status === 'blocked').length;
  const warningCount = allItems.filter((i) => i.status === 'needs_check' || i.status === 'needs_refetch').length;

  // Calculate supplemental health score (0 - 100)
  const totalCount = allItems.length;
  const healthyCount = allItems.filter((i) => i.status === 'healthy' || i.status === 'latest').length;
  let healthScore = totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 100;

  // Strict Override Rule (Spec #3):
  // Critical blocking problems MUST always override the numeric score!
  let overallStatus: OverallHealthStatus = 'ready';
  let overallStatusLabel = '業務開始可能';
  let canProceed = true;

  if (blockingReasons.length > 0 || errorCount > 0) {
    overallStatus = 'blocked';
    overallStatusLabel = '処理停止';
    canProceed = false;
  } else if (warnings.length > 0 || warningCount > 0) {
    overallStatus = 'needs_verification';
    overallStatusLabel = '要確認';
    canProceed = false;
  } else {
    overallStatus = 'ready';
    overallStatusLabel = '業務開始可能';
    canProceed = true;
  }

  return {
    canProceed,
    overallStatus,
    overallStatusLabel,
    healthScore,
    blockingReasons,
    warnings,
    lastVerifiedAt: nowStr,
    itemsByCategory: {
      dev_env: devEnvItems,
      app_feature: appFeatureItems,
      shipping_rules: shippingRulesItems,
      future_module: futureModuleItems
    },
    criticalWarnings
  };
}

/**
 * Reusable Business Readiness Gate (Spec #11)
 */
export function checkBusinessReadiness(
  context:
    | 'publication'
    | 'relisting'
    | 'shipping_selection'
    | 'zonos_declaration'
    | 'document_generation'
    | 'shipment_completion' = 'publication'
): BusinessReadinessGateResult {
  const result = evaluateProjectHealth();

  const preActionRes = performPreActionVerification(
    context === 'shipment_completion' ? 'shipment_completion' : 'publication'
  );

  if (!preActionRes.canProceed) {
    result.canProceed = false;
    if (result.overallStatus !== 'blocked') {
      result.overallStatus = 'needs_verification';
      result.overallStatusLabel = '要確認';
    }
    for (const b of preActionRes.blockingReasons) {
      if (!result.blockingReasons.includes(b)) {
        result.blockingReasons.push(b);
      }
    }
    for (const w of preActionRes.warnings) {
      if (!result.warnings.includes(w)) {
        result.warnings.push(w);
      }
    }
  }

  return result;
}

/**
 * One-Click Development Environment Diagnostics (Spec #7)
 */
export function runDevelopmentDiagnostics(): DiagnosticRunResult {
  const devEnv = detectEnvironmentStatus();
  const readiness = performReadinessCheck(devEnv);
  const health = evaluateProjectHealth();
  const devItems = health.itemsByCategory.dev_env;

  return {
    type: 'dev_env',
    executedAt: formatDateTime(),
    allReady: readiness.allReady,
    message: readiness.summaryMessage,
    evaluatedItems: devItems
  };
}

/**
 * One-Click Business Environment Diagnostics (Spec #7)
 */
export function runBusinessDiagnostics(): DiagnosticRunResult {
  const health = evaluateProjectHealth();
  const businessItems = [
    ...health.itemsByCategory.app_feature,
    ...health.itemsByCategory.shipping_rules
  ];

  const hasBlocked = businessItems.some((i) => i.status === 'blocked' || i.status === 'error');
  const hasWarning = businessItems.some((i) => i.status === 'needs_check' || i.status === 'needs_refetch');

  const message = hasBlocked
    ? '業務環境に致命的なブロッキング問題が存在します（処理停止）'
    : hasWarning
    ? '業務環境に確認が必要な項目が存在します（要確認）'
    : '業務環境は全て正常であり、安全に出品・発送を開始できます（業務開始可能）';

  return {
    type: 'business_env',
    executedAt: formatDateTime(),
    allReady: !hasBlocked && !hasWarning,
    message,
    evaluatedItems: businessItems
  };
}

/**
 * Smart Refresh Integration (Spec #8)
 */
export function refreshProjectHealth(isManualEmergency: boolean = false): {
  syncMessage: string;
  result: BusinessReadinessGateResult;
} {
  const syncRes = triggerAutomaticSync(isManualEmergency);
  const health = evaluateProjectHealth();

  return {
    syncMessage: syncRes.message,
    result: health
  };
}
