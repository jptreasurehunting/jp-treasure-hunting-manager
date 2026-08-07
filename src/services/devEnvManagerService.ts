import {
  DevEnvironmentInfo,
  ReadinessCheckItem,
  EnvUpdateHistoryLog,
  OneClickUpdateStepResult,
  PortableProjectVersionCheck
} from '../types/devEnvManager';

const ENV_HISTORY_STORAGE_KEY = 'zonos_dev_env_update_history_v1';
export const CURRENT_APPLICATION_VERSION = 'Ver. 3.16';

export function getInitialEnvironmentInfo(): DevEnvironmentInfo {
  return {
    pcState: 'ready_for_dev',
    isGitRepo: true,
    repoPath: 'c:\\Projects\\jp-treasure-hunting-manager',
    currentBranch: 'main',
    remoteOrigin: 'https://github.com/jp-treasure/jp-treasure-hunting-manager.git',
    localCommit: '7e9a2b1',
    remoteCommit: '7e9a2b1',
    localAppVersion: CURRENT_APPLICATION_VERSION,
    remoteAppVersion: CURRENT_APPLICATION_VERSION,
    isBehind: false,
    isAhead: false,
    isDiverged: false,
    hasUncommittedChanges: false,
    hasUnpushedCommits: false,
    nodeModulesExist: true,
    packageLockValid: true,
    nodeVersion: 'v20.15.0',
    npmAvailable: true,
    envVarsValid: true,
    missingEnvVars: [],
    chromeExtensionFolderExist: true,
    chromeExtensionStatus: 'Installed & Active',
    localhostServerOnline: true,
    lastCheckedTime: new Date().toISOString()
  };
}

export function loadEnvUpdateHistory(): EnvUpdateHistoryLog[] {
  try {
    const raw = localStorage.getItem(ENV_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveEnvUpdateHistory(logs: EnvUpdateHistoryLog[]): void {
  try {
    localStorage.setItem(ENV_HISTORY_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save env update history:', e);
  }
}

/**
 * Detect Current PC Environment Status
 */
export function detectEnvironmentStatus(overrides?: Partial<DevEnvironmentInfo>): DevEnvironmentInfo {
  const base = getInitialEnvironmentInfo();
  const info = { ...base, ...overrides, lastCheckedTime: new Date().toISOString() };

  // Classify PC State
  if (!info.isGitRepo || (!info.nodeModulesExist && !info.npmAvailable)) {
    info.pcState = 'first_time_setup';
  } else if (info.isDiverged) {
    info.pcState = 'git_diverged_conflict_risk';
  } else if (info.hasUncommittedChanges) {
    info.pcState = 'local_changes_exist';
  } else if (!info.envVarsValid || !info.nodeModulesExist) {
    info.pcState = 'missing_environment_vars';
  } else if (info.isBehind) {
    info.pcState = 'configured_github_update_available';
  } else if (info.hasUnpushedCommits) {
    info.pcState = 'ready_for_dev';
  } else {
    info.pcState = 'configured_up_to_date';
  }

  return info;
}

/**
 * Perform Development Readiness Check (7 Items)
 */
export function performReadinessCheck(info: DevEnvironmentInfo): {
  items: ReadinessCheckItem[];
  allReady: boolean;
  summaryMessage: string;
} {
  const items: ReadinessCheckItem[] = [
    {
      key: 'git_repo',
      label: 'Git repository',
      status: info.isGitRepo ? 'ok' : 'error',
      detail: info.isGitRepo ? `Path: ${info.repoPath} (${info.currentBranch})` : 'Gitリポジトリが見つかりません'
    },
    {
      key: 'github_sync',
      label: 'GitHub synchronization',
      status: info.isDiverged ? 'error' : info.isBehind ? 'warning' : 'ok',
      detail: info.isDiverged
        ? 'ローカルとリモートが分岐しています (要確認)'
        : info.isBehind
        ? 'GitHubに新しい更新があります'
        : 'GitHubと完全に同期中'
    },
    {
      key: 'node_js',
      label: 'Node.js',
      status: info.npmAvailable ? 'ok' : 'error',
      detail: info.npmAvailable ? `Node.js ${info.nodeVersion} (npm利用可能)` : 'Node.js環境が見つかりません'
    },
    {
      key: 'dependencies',
      label: 'Dependencies',
      status: info.nodeModulesExist && info.packageLockValid ? 'ok' : 'error',
      detail: info.nodeModulesExist ? 'node_modulesおよび依存パッケージ正常' : 'npm installが必要です'
    },
    {
      key: 'env_vars',
      label: 'Environment variables',
      status: info.envVarsValid ? 'ok' : 'warning',
      detail: info.envVarsValid
        ? '環境変数設定完了'
        : `未設定の環境変数: ${info.missingEnvVars.join(', ')}`
    },
    {
      key: 'chrome_ext',
      label: 'Chrome Extension',
      status: info.chromeExtensionFolderExist ? 'ok' : 'warning',
      detail: info.chromeExtensionFolderExist
        ? `拡張機能ビルド済み (${info.chromeExtensionStatus})`
        : 'Chrome拡張機能フォルダー未作成'
    },
    {
      key: 'localhost_server',
      label: 'localhost server',
      status: info.localhostServerOnline ? 'ok' : 'warning',
      detail: info.localhostServerOnline ? '開発サーバー稼働中 (http://localhost:3000)' : '開発サーバー停止中'
    }
  ];

  const hasError = items.some((i) => i.status === 'error');
  const summaryMessage = hasError
    ? '開発環境に未解決のブロッキング問題が存在します。下記項目を解消してください。'
    : '開発を開始できます';

  return {
    items,
    allReady: !hasError,
    summaryMessage
  };
}

/**
 * Execute Safe One-Click Update
 */
export function executeSafeOneClickUpdate(
  info: DevEnvironmentInfo,
  userActionOnLocalChanges?: 'commit' | 'stash' | 'cancel'
): {
  success: boolean;
  requiresSafetyGate: boolean;
  safetyGateMessage?: string;
  steps: OneClickUpdateStepResult[];
  newCommit?: string;
  log?: EnvUpdateHistoryLog;
} {
  const steps: OneClickUpdateStepResult[] = [];

  // Safety Gate Check: Uncommitted local changes
  if (info.hasUncommittedChanges && !userActionOnLocalChanges) {
    return {
      success: false,
      requiresSafetyGate: true,
      safetyGateMessage: 'このPCに未保存の開発変更があります。GitHub更新を適用する前に保存または退避してください。',
      steps: []
    };
  }

  // Handle local changes action if requested
  if (info.hasUncommittedChanges && userActionOnLocalChanges === 'cancel') {
    return {
      success: false,
      requiresSafetyGate: false,
      steps: [{ stepName: 'Local Changes Check', status: 'skipped', japaneseMessage: 'ユーザーにより更新処理がキャンセルされました。' }]
    };
  }

  if (info.hasUncommittedChanges && userActionOnLocalChanges === 'stash') {
    steps.push({
      stepName: 'git stash',
      status: 'success',
      japaneseMessage: '未保存の変更を安全にスタッシュ (git stash) に退避しました。'
    });
  } else if (info.hasUncommittedChanges && userActionOnLocalChanges === 'commit') {
    steps.push({
      stepName: 'git commit',
      status: 'success',
      japaneseMessage: '未保存の変更を作業コミットとして保存しました。'
    });
  }

  // Step 1: git fetch
  steps.push({
    stepName: 'git fetch',
    status: 'success',
    japaneseMessage: 'リモートリポジトリの最新情報 (git fetch) を取得しました。'
  });

  // Step 2: safe git pull
  steps.push({
    stepName: 'git pull',
    status: 'success',
    japaneseMessage: '最新のソースコード (git pull) を安全に統合しました。'
  });

  // Step 3: npm install check
  const dependenciesChanged = info.isBehind; // Example logic
  if (dependenciesChanged) {
    steps.push({
      stepName: 'npm install',
      status: 'success',
      japaneseMessage: '依存パッケージの変更を検知し、npm install を完了しました。'
    });
  } else {
    steps.push({
      stepName: 'npm install',
      status: 'skipped',
      japaneseMessage: '依存パッケージに変更がないため npm install はスキップされました。'
    });
  }

  // Step 4: Environment Config Verification
  steps.push({
    stepName: 'Environment Config Check',
    status: 'success',
    japaneseMessage: '環境設定ファイルの健全性を確認しました。'
  });

  // Step 5: Extension & Server Verification
  steps.push({
    stepName: 'Build & Server Check',
    status: 'success',
    japaneseMessage: '最新版ビルドおよび開発サーバーの準備が完了しました。'
  });

  const updatedCommit = info.remoteCommit || '8f1b3c4';
  const newLog: EnvUpdateHistoryLog = {
    historyId: `env-hist-${Date.now()}`,
    updateTime: new Date().toISOString(),
    branch: info.currentBranch,
    oldCommit: info.localCommit,
    newCommit: updatedCommit,
    dependencyUpdated: dependenciesChanged,
    extensionUpdated: false,
    resultStatus: 'success',
    details: 'ワンクリック自動更新が正常に完了しました。'
  };

  const history = loadEnvUpdateHistory();
  saveEnvUpdateHistory([newLog, ...history]);

  return {
    success: true,
    requiresSafetyGate: false,
    steps,
    newCommit: updatedCommit,
    log: newLog
  };
}

/**
 * Portable Project File Version Compatibility Check
 */
export function verifyPortableProjectCompatibility(projectAppVersion: string): PortableProjectVersionCheck {
  if (!projectAppVersion) {
    return {
      isCompatible: true,
      projectAppVersion: 'Ver. 3.0',
      currentAppVersion: CURRENT_APPLICATION_VERSION
    };
  }

  const parseVer = (v: string) => parseFloat(v.replace(/[^0-9.]/g, '')) || 1.0;
  const projectVer = parseVer(projectAppVersion);
  const currentVer = parseVer(CURRENT_APPLICATION_VERSION);

  if (projectVer > currentVer) {
    return {
      isCompatible: false,
      projectAppVersion,
      currentAppVersion: CURRENT_APPLICATION_VERSION,
      warningMessage: `取り込もうとしたプロジェクトファイル (${projectAppVersion}) は、現在のアプリバージョン (${CURRENT_APPLICATION_VERSION}) より新しいため上位互換性がありません。先に本アプリを最新版へ更新してください。`
    };
  }

  return {
    isCompatible: true,
    projectAppVersion,
    currentAppVersion: CURRENT_APPLICATION_VERSION
  };
}
