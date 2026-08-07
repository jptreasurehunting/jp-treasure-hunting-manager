import React, { useState, useMemo } from 'react';
import { DevEnvironmentInfo, OneClickUpdateStepResult, EnvUpdateHistoryLog } from '../../types/devEnvManager';
import {
  detectEnvironmentStatus,
  performReadinessCheck,
  executeSafeOneClickUpdate,
  loadEnvUpdateHistory,
  CURRENT_APPLICATION_VERSION
} from '../../services/devEnvManagerService';

export const DevEnvManagerCard: React.FC = () => {
  const [envInfo, setEnvInfo] = useState<DevEnvironmentInfo>(detectEnvironmentStatus());
  const [history, setHistory] = useState<EnvUpdateHistoryLog[]>(loadEnvUpdateHistory());
  const [updateSteps, setUpdateSteps] = useState<OneClickUpdateStepResult[]>([]);
  const [safetyGateOpen, setSafetyGateOpen] = useState<boolean>(false);
  const [safetyGateMsg, setSafetyGateMsg] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Readiness Diagnosis Check (7 Items)
  const readiness = useMemo(() => {
    return performReadinessCheck(envInfo);
  }, [envInfo]);

  const handleRunDiagnosis = () => {
    const fresh = detectEnvironmentStatus();
    setEnvInfo(fresh);
    showToast(`🔍 開発環境診断が完了しました: ${readiness.allReady ? '「開発を開始できます」' : '注意項目あり'}`);
  };

  const handleOneClickUpdate = (userAction?: 'commit' | 'stash' | 'cancel') => {
    const res = executeSafeOneClickUpdate(envInfo, userAction);

    if (res.requiresSafetyGate) {
      setSafetyGateMsg(res.safetyGateMessage || '未保存の変更があります');
      setSafetyGateOpen(true);
      return;
    }

    setSafetyGateOpen(false);
    setUpdateSteps(res.steps);

    if (res.success) {
      const updatedEnv = detectEnvironmentStatus({
        isBehind: false,
        localCommit: res.newCommit || envInfo.localCommit,
        hasUncommittedChanges: false
      });
      setEnvInfo(updatedEnv);
      setHistory(loadEnvUpdateHistory());
      showToast('🎉 最新版への更新が正常に完了しました！');
    } else if (res.steps.length > 0) {
      showToast(`⚠️ ${res.steps[0].japaneseMessage}`);
    }
  };

  const getPcStateBadge = (state: DevEnvironmentInfo['pcState']) => {
    switch (state) {
      case 'configured_up_to_date':
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2 py-0.5 rounded font-bold">セットアップ済み・最新版</span>;
      case 'configured_github_update_available':
        return <span className="bg-blue-950 text-blue-300 border border-blue-800 text-xs px-2 py-0.5 rounded font-bold">セットアップ済み・GitHub更新あり</span>;
      case 'local_changes_exist':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800 text-xs px-2 py-0.5 rounded font-bold">ローカル変更あり</span>;
      case 'git_diverged_conflict_risk':
        return <span className="bg-red-950 text-red-300 border border-red-800 text-xs px-2 py-0.5 rounded font-bold">Git競合の可能性あり</span>;
      case 'missing_environment_vars':
        return <span className="bg-amber-950 text-amber-300 border border-amber-800 text-xs px-2 py-0.5 rounded font-bold">環境設定不足</span>;
      case 'first_time_setup':
        return <span className="bg-purple-950 text-purple-300 border border-purple-800 text-xs px-2 py-0.5 rounded font-bold">初回セットアップが必要</span>;
      default:
        return <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-xs px-2 py-0.5 rounded font-bold">起動準備完了</span>;
    }
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-4 text-xs">
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex justify-between items-center pb-2 border-b border-slate-800 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xl">💻</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">AI 開発環境マネージャー (Multi-PC Synchronization)</h3>
            <p className="text-[11px] text-slate-400">複数PC間のGit同期状態・GitHub更新・依存関係・Chrome拡張・環境診断を自動管理します。</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {getPcStateBadge(envInfo.pcState)}
          <button
            type="button"
            className="btn-primary text-xs font-bold px-3 py-1.5 bg-blue-600 hover:bg-blue-500 flex items-center gap-1"
            onClick={handleRunDiagnosis}
          >
            🔍 開発環境を診断
          </button>
        </div>
      </div>

      {/* Version Comparison Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
        {/* Current PC Status */}
        <div className="space-y-1.5 font-mono text-[11px] border-r border-slate-800 pr-3">
          <strong className="text-emerald-400 font-bold block border-b border-slate-800 pb-1">
            💻 このPC (Current Local PC)
          </strong>
          <div className="flex justify-between">
            <span>ブランチ (Branch):</span>
            <span className="text-slate-200 font-bold">{envInfo.currentBranch}</span>
          </div>
          <div className="flex justify-between">
            <span>コミット (Commit):</span>
            <span className="text-slate-300 font-bold">{envInfo.localCommit}</span>
          </div>
          <div className="flex justify-between">
            <span>アプリバージョン:</span>
            <span className="text-emerald-400 font-bold">{envInfo.localAppVersion}</span>
          </div>
          <div className="flex justify-between">
            <span>最終確認日時:</span>
            <span className="text-slate-400">{new Date(envInfo.lastCheckedTime).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* GitHub Remote Status */}
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between items-center border-b border-slate-800 pb-1">
            <strong className="text-blue-400 font-bold">
              🐙 GitHub (Remote Repository)
            </strong>
            {envInfo.isBehind && (
              <span className="bg-blue-950 text-blue-300 border border-blue-800 text-[10px] px-2 py-0.5 rounded font-bold">
                最新版があります
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span>リモートブランチ:</span>
            <span className="text-slate-200 font-bold">{envInfo.currentBranch}</span>
          </div>
          <div className="flex justify-between">
            <span>最新コミット:</span>
            <span className="text-slate-300 font-bold">{envInfo.remoteCommit}</span>
          </div>
          <div className="flex justify-between">
            <span>GitHubバージョン:</span>
            <span className="text-blue-300 font-bold">{envInfo.remoteAppVersion}</span>
          </div>
          
          <div className="pt-1 flex justify-end">
            {envInfo.isBehind ? (
              <button
                type="button"
                className="btn-primary text-xs font-bold px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500"
                onClick={() => handleOneClickUpdate()}
              >
                🚀 最新版へ更新 (ワンクリック自動更新)
              </button>
            ) : (
              <span className="text-[10px] text-emerald-400 font-bold">✓ GitHub最新コードと完全に一致中</span>
            )}
          </div>
        </div>
      </div>

      {/* Safety Gate Warning & Action Modal */}
      {safetyGateOpen && (
        <div className="p-3 bg-amber-950/90 border border-amber-500/90 rounded-lg space-y-3">
          <div className="flex items-center space-x-2 text-sm font-bold text-amber-200">
            <span>⚠️</span>
            <span>{safetyGateMsg}</span>
          </div>

          <p className="text-[11px] text-amber-100">
            自動更新により作業中のコードが消失しないよう安全ガードが作動しました。下記より対応を選択してください:
          </p>

          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="btn-primary text-xs font-bold px-3 py-1 bg-amber-700 hover:bg-amber-600"
              onClick={() => handleOneClickUpdate('stash')}
            >
              📦 変更を一時退避して更新 (git stash)
            </button>
            <button
              type="button"
              className="btn-primary text-xs font-bold px-3 py-1 bg-blue-600 hover:bg-blue-500"
              onClick={() => handleOneClickUpdate('commit')}
            >
              💾 作業コミットして更新 (git commit)
            </button>
            <button
              type="button"
              className="btn-secondary text-xs font-bold px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300"
              onClick={() => handleOneClickUpdate('cancel')}
            >
              ❌ 更新をキャンセル
            </button>
          </div>
        </div>
      )}

      {/* One-Click Update Step-by-Step Progress Output */}
      {updateSteps.length > 0 && (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-1.5">
          <strong className="text-slate-200 font-bold block text-xs border-b border-slate-800 pb-1">
            ⚡ 自動更新実行ステップ
          </strong>
          <div className="space-y-1 font-mono text-[11px]">
            {updateSteps.map((step, idx) => (
              <div key={idx} className="flex justify-between items-center p-1.5 bg-slate-900 rounded">
                <span className="text-slate-300 font-bold">{idx + 1}. {step.stepName}</span>
                <span className="text-emerald-400">{step.japaneseMessage}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Development Readiness Diagnosis Box (7 Items) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <strong className="text-slate-200 font-bold text-xs">📋 開発環境健全性診断 (Readiness Check - 7項目)</strong>
          <span className={`text-xs font-bold ${readiness.allReady ? 'text-emerald-400' : 'text-amber-300'}`}>
            {readiness.summaryMessage}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 font-mono text-[11px]">
          {readiness.items.map((item) => (
            <div key={item.key} className="p-2 bg-slate-950 rounded border border-slate-800 space-y-0.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-300 font-bold">{item.label}</span>
                <span className="text-sm font-bold">
                  {item.status === 'ok' ? '✅' : item.status === 'warning' ? '⚠️' : '❌'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Update History Log View */}
      {history.length > 0 && (
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-[11px]">
          <strong className="text-slate-300 font-bold block text-xs">📜 開発環境更新履歴 (Environment Update History)</strong>
          <div className="space-y-1 font-mono">
            {history.map((log) => (
              <div key={log.historyId} className="flex justify-between items-center p-2 bg-slate-900 rounded border border-slate-800">
                <div>
                  <span className="text-emerald-400 font-bold">[{log.resultStatus}]</span>{' '}
                  <span className="text-slate-200">Commit: {log.oldCommit} &rarr; {log.newCommit} ({log.branch})</span>
                  <span className="text-slate-400 text-[10px] block">{log.details}</span>
                </div>
                <span className="text-slate-400 text-[10px]">{new Date(log.updateTime).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
