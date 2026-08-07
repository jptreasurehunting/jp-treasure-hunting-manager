export type PcEnvState =
  | 'first_time_setup'
  | 'configured_up_to_date'
  | 'configured_github_update_available'
  | 'local_changes_exist'
  | 'git_diverged_conflict_risk'
  | 'missing_environment_vars'
  | 'ready_for_dev';

export type ComponentCheckStatus = 'ok' | 'warning' | 'error';

export interface ReadinessCheckItem {
  key: string;
  label: string; // e.g. "Git repository", "GitHub synchronization", etc.
  status: ComponentCheckStatus;
  detail: string;
}

export interface DevEnvironmentInfo {
  pcState: PcEnvState;
  isGitRepo: boolean;
  repoPath: string;
  currentBranch: string;
  remoteOrigin: string;
  localCommit: string; // Short hash e.g. "a1b2c3d"
  remoteCommit: string;
  localAppVersion: string; // e.g. "Ver. 3.16"
  remoteAppVersion: string; // e.g. "Ver. 3.18"
  isBehind: boolean;
  isAhead: boolean;
  isDiverged: boolean;
  hasUncommittedChanges: boolean;
  hasUnpushedCommits: boolean;
  nodeModulesExist: boolean;
  packageLockValid: boolean;
  nodeVersion: string;
  npmAvailable: boolean;
  envVarsValid: boolean;
  missingEnvVars: string[];
  chromeExtensionFolderExist: boolean;
  chromeExtensionStatus: string;
  localhostServerOnline: boolean;
  lastCheckedTime: string;
}

export interface EnvUpdateHistoryLog {
  historyId: string;
  updateTime: string;
  branch: string;
  oldCommit: string;
  newCommit: string;
  dependencyUpdated: boolean;
  extensionUpdated: boolean;
  resultStatus: 'success' | 'failed' | 'cancelled';
  details: string;
}

export interface OneClickUpdateStepResult {
  stepName: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'skipped';
  japaneseMessage: string;
}

export interface PortableProjectVersionCheck {
  isCompatible: boolean;
  projectAppVersion: string;
  currentAppVersion: string;
  warningMessage?: string;
}
