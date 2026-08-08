import React, { useState, useEffect, useMemo } from 'react';
import {
  ProjectHealthItem,
  BusinessReadinessGateResult,
  DiagnosticRunResult
} from '../../types/projectHealth';
import {
  evaluateProjectHealth,
  runDevelopmentDiagnostics,
  runBusinessDiagnostics,
  refreshProjectHealth,
  formatDateTime
} from '../../services/projectHealthService';
import { HealthStatusBadge, AuthorityLevelBadge } from './HealthStatusBadge';

interface ProjectHealthDashboardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const ProjectHealthDashboard: React.FC<ProjectHealthDashboardProps> = ({
  onAddAuditLog
}) => {
  const [healthResult, setHealthResult] = useState<BusinessReadinessGateResult>(evaluateProjectHealth());
  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticRunResult | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'dev_env' | 'app_feature' | 'shipping_rules' | 'future_module'>('all');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Periodic health check & initial sync
  useEffect(() => {
    const res = evaluateProjectHealth();
    setHealthResult(res);

    const interval = setInterval(() => {
      const refreshed = evaluateProjectHealth();
      setHealthResult(refreshed);
    }, 60000); // Re-evaluate every minute

    return () => clearInterval(interval);
  }, []);

  const toggleExpand = (itemId: string) => {
    setExpandedItemIds((prev) => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  // Smart Refresh (Spec #8)
  const handleManualEmergencyRefresh = () => {
    const { syncMessage, result } = refreshProjectHealth(true);
    setHealthResult(result);
    showToast(`🔄 ${syncMessage}`);
    if (onAddAuditLog) {
      onAddAuditLog('ProjectHealth: Manual Emergency Refresh Executed', undefined, result.overallStatusLabel);
    }
  };

  // One-Click Diagnostics: Dev Env (Spec #7)
  const handleRunDevDiagnostics = () => {
    const diag = runDevelopmentDiagnostics();
    setDiagnosticResult(diag);
    showToast(`💻 開発環境診断完了: ${diag.allReady ? '「開発を開始できます」' : '要確認事項あり'}`);
    if (onAddAuditLog) {
      onAddAuditLog('ProjectHealth: Dev Env Diagnostics Run', undefined, diag.allReady ? 'All Ready' : 'Issues Found');
    }
  };

  // One-Click Diagnostics: Business Env (Spec #7)
  const handleRunBusinessDiagnostics = () => {
    const diag = runBusinessDiagnostics();
    setDiagnosticResult(diag);
    showToast(`🏢 業務環境診断完了: ${diag.allReady ? '「業務開始可能」' : diag.message}`);
    if (onAddAuditLog) {
      onAddAuditLog('ProjectHealth: Business Env Diagnostics Run', undefined, diag.allReady ? 'Ready' : 'Blocked/Warning');
    }
  };

  const getOverallStatusStyle = () => {
    switch (healthResult.overallStatus) {
      case 'ready':
        return {
          bannerClass: 'bg-gradient-to-r from-emerald-950/90 via-slate-900 to-slate-900 border-emerald-500/80',
          badgeClass: 'bg-emerald-500 text-slate-950 font-black',
          icon: '✅',
          title: '業務開始可能',
          subtext: 'すべての開発環境、アプリ機能、配送・規約データが安全基準を満たしています。出品・発送業務を開始できます。'
        };
      case 'needs_verification':
        return {
          bannerClass: 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-900 border-amber-500/80',
          badgeClass: 'bg-amber-400 text-slate-950 font-black',
          icon: '🟡',
          title: '要確認',
          subtext: '最新の配送ルール再取得、GitHub更新、または未確認の規約が存在します。内容を確認してください。'
        };
      case 'blocked':
      default:
        return {
          bannerClass: 'bg-gradient-to-r from-rose-950/95 via-slate-900 to-slate-900 border-rose-500',
          badgeClass: 'bg-rose-500 text-white font-black animate-pulse',
          icon: '⛔',
          title: '処理停止',
          subtext: '重大なブロッキング要因（環境変数不足、Git競合、eBay認証エラー、DDU、必須書類不足等）が存在するため、安全のため処理を停止しています。'
        };
    }
  };

  const overallStyle = getOverallStatusStyle();

  const devEnvItems = healthResult.itemsByCategory.dev_env || [];
  const appFeatureItems = healthResult.itemsByCategory.app_feature || [];
  const shippingRulesItems = healthResult.itemsByCategory.shipping_rules || [];
  const futureModuleItems = healthResult.itemsByCategory.future_module || [];

  const totalItemCount = devEnvItems.length + appFeatureItems.length + shippingRulesItems.length + futureModuleItems.length;

  const renderHealthItemCard = (item: ProjectHealthItem) => {
    const isExpanded = !!expandedItemIds[item.id];

    return (
      <div
        key={item.id}
        className={`p-3.5 rounded-lg border transition-all duration-200 ${
          item.isCriticalWarning
            ? 'bg-rose-950/30 border-rose-600/80 shadow-md shadow-rose-950/40'
            : item.status === 'needs_check' || item.status === 'needs_refetch'
            ? 'bg-amber-950/20 border-amber-700/60'
            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
        }`}
      >
        {/* Header Row */}
        <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-100">{item.name}</span>
              <HealthStatusBadge status={item.status} customLabel={item.statusLabel.replace(/^[^\s]+\s*/, '')} />
              <AuthorityLevelBadge level={item.authorityLevel} />
              <span className="text-[11px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                {item.liveVerificationNote}
              </span>
            </div>

            {/* Critical Warning Callout (Never hidden!) */}
            {item.isCriticalWarning && item.criticalMessage && (
              <div className="mt-2 p-2 bg-rose-900/60 border border-rose-500 rounded text-rose-200 text-xs font-bold flex items-center gap-1.5 animate-pulse">
                <span>🚨</span>
                <span>{item.criticalMessage}</span>
              </div>
            )}

            {/* Spec #6: Compact 1-line reason directly visible */}
            <p className="mt-1.5 text-xs text-slate-300 font-medium leading-relaxed">
              {item.shortOneLineReason}
            </p>

            {/* Source & Freshness Metadata */}
            <div className="mt-1 flex items-center gap-3 text-[11px] text-slate-400 flex-wrap">
              <span>
                検証情報源: <strong className="text-slate-200">{item.sourceName}</strong>
              </span>
              <span>
                検証方式: <span className="text-slate-300">{item.verificationMethodLabel}</span>
              </span>
              <span>
                鮮度: <span className="text-slate-300">{item.freshness}</span>
              </span>
            </div>
          </div>

          {/* Progressive Disclosure Button (Spec #5) */}
          <button
            type="button"
            className="btn-secondary text-xs px-2.5 py-1 flex items-center gap-1 shrink-0 font-medium text-cyan-300 hover:text-cyan-200 border-slate-700 bg-slate-800/90"
            onClick={() => toggleExpand(item.id)}
          >
            <span>{isExpanded ? '▲ 閉じる' : '▼ 詳しく見る / 詳しい理由'}</span>
          </button>
        </div>

        {/* Collapsible Detailed Diagnostic Area */}
        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-2 bg-slate-950/60 p-3 rounded-md animate-fadeIn">
            <h5 className="font-bold text-xs text-cyan-400 flex items-center gap-1">
              <span>📋</span>
              <span>詳細診断情報 &amp; 規約解釈根拠</span>
            </h5>

            {item.details.exactRestriction && (
              <div>
                <span className="text-slate-400 font-bold">適用制限・要件:</span>
                <p className="text-slate-200 mt-0.5">{item.details.exactRestriction}</p>
              </div>
            )}

            {item.details.rejectedAlternatives && item.details.rejectedAlternatives.length > 0 && (
              <div>
                <span className="text-slate-400 font-bold">除外・却下された代替案:</span>
                <ul className="list-disc list-inside mt-0.5 text-rose-300">
                  {item.details.rejectedAlternatives.map((alt, idx) => (
                    <li key={idx}>{alt}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div>
                <span className="text-slate-400">データソース / 規約名:</span>
                <div className="text-slate-200 font-mono">{item.details.source || item.sourceName}</div>
              </div>
              <div>
                <span className="text-slate-400">規約バージョン / 更新日時:</span>
                <div className="text-slate-200 font-mono">
                  {item.details.ruleVersion || 'Standard'} ({item.details.lastVerifiedTime || item.lastVerifiedAt})
                </div>
              </div>
            </div>

            {item.details.estimatedBusinessImpact && (
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-amber-300 font-bold text-[11px]">業務影響・リスク評価:</span>
                <p className="text-slate-200 text-xs mt-0.5">{item.details.estimatedBusinessImpact}</p>
              </div>
            )}

            {item.details.recommendedCorrectiveAction && (
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-800/60">
                <span className="text-emerald-300 font-bold text-[11px]">推奨是正アクション:</span>
                <p className="text-slate-200 text-xs mt-0.5">{item.details.recommendedCorrectiveAction}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="project-health-dashboard space-y-4">
      {/* Toast notification */}
      {toastMessage && (
        <div className="toast-notification fixed top-5 right-5 z-50 bg-slate-900 border-2 border-cyan-500 text-cyan-200 px-4 py-2.5 rounded-lg shadow-2xl font-bold text-xs flex items-center gap-2">
          <span>🔔</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl shadow-lg">
        <div className="flex justify-between items-center flex-wrap gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🩺</span>
            <div>
              <h2 className="text-base font-black text-white">Project Health Dashboard (統合プロジェクト健全性・稼働診断)</h2>
              <p className="text-xs text-slate-400">
                開発環境、アプリ機能、配送・法規制ルール、各種API連携の安全性をワンストップで検証します。
              </p>
            </div>
          </div>

          {/* Smart Refresh & Diagnostic Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-600 flex items-center gap-1.5 shadow"
              onClick={handleRunDevDiagnostics}
            >
              <span>💻</span>
              <span>開発環境を診断</span>
            </button>
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-600 flex items-center gap-1.5 shadow"
              onClick={handleRunBusinessDiagnostics}
            >
              <span>🏢</span>
              <span>業務環境を診断</span>
            </button>
            <button
              type="button"
              className="btn-primary text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black rounded-lg border border-emerald-400 flex items-center gap-1.5 shadow-md shadow-emerald-950/50"
              onClick={handleManualEmergencyRefresh}
            >
              <span>🔄</span>
              <span>最新ルールを今すぐ再確認</span>
            </button>
          </div>
        </div>

        {/* Top Overall Result Banner (Spec #3) */}
        <div className={`mt-3 p-4 rounded-xl border-2 shadow-inner ${overallStyle.bannerClass}`}>
          <div className="flex items-start justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-2xl">{overallStyle.icon}</span>
                <h3 className="text-xl font-black tracking-tight text-white">{overallStyle.title}</h3>
                <span className={`text-xs px-3 py-1 rounded-full uppercase ${overallStyle.badgeClass}`}>
                  総合評価: {overallStyle.title}
                </span>
                <span className="text-xs font-mono text-slate-300 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-700">
                  健全性スコア: <strong className="text-cyan-400">{healthResult.healthScore}/100</strong> (参考値)
                </span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed font-medium">
                {overallStyle.subtext}
              </p>
              <div className="text-[11px] text-slate-400 flex items-center gap-4 flex-wrap pt-1 font-mono">
                <span>最終更新: {healthResult.lastVerifiedAt}</span>
                <span>検証モジュール総数: {totalItemCount} 項目</span>
                <span>自動同期方式: 起動時 ＆ 24時間間隔スマートリフレッシュ</span>
              </div>
            </div>

            <div className="text-right shrink-0 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <div className="text-[11px] text-slate-400">出荷・出品前ゲート判定</div>
              <div className={`text-sm font-black mt-0.5 ${healthResult.canProceed ? 'text-emerald-400' : 'text-rose-400'}`}>
                {healthResult.canProceed ? '🟢 実行許可 (canProceed: true)' : '🔴 実行遮断 (canProceed: false)'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Critical Blocking Warnings Banner (Spec #4: Never hidden inside expandable areas!) */}
      {(healthResult.blockingReasons.length > 0 || healthResult.criticalWarnings.length > 0) && (
        <div className="p-4 bg-rose-950/80 border-2 border-rose-500 rounded-xl shadow-xl space-y-2">
          <div className="flex items-center gap-2 text-rose-200 font-black text-sm">
            <span className="text-xl animate-bounce">🚨</span>
            <span>未解決のブロッキング問題（処理停止の直接原因） - 即時解消が必要です</span>
          </div>
          <p className="text-xs text-rose-300 font-medium">
            ※ 以下のブロッキング問題は自動的に折りたたまれず、常時最前面に表示されます。解消するまで出品・発送処理は実行できません。
          </p>
          <ul className="space-y-1.5 pt-1">
            {healthResult.blockingReasons.map((reason, idx) => (
              <li
                key={idx}
                className="text-xs text-rose-100 bg-rose-900/60 p-2.5 rounded-lg border border-rose-600 flex items-start gap-2 font-bold"
              >
                <span className="text-rose-400 font-mono">[{idx + 1}]</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings Banner (Non-blocking) */}
      {healthResult.warnings.length > 0 && healthResult.blockingReasons.length === 0 && (
        <div className="p-3.5 bg-amber-950/60 border border-amber-600 rounded-xl shadow-md space-y-1.5">
          <div className="flex items-center gap-2 text-amber-200 font-bold text-xs">
            <span>⚠️</span>
            <span>確認推奨事項 (要確認)</span>
          </div>
          <ul className="space-y-1">
            {healthResult.warnings.map((warn, idx) => (
              <li key={idx} className="text-xs text-amber-200 bg-amber-900/40 p-2 rounded border border-amber-700">
                • {warn}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Diagnostic Run Modal / Result Box */}
      {diagnosticResult && (
        <div className="p-4 bg-slate-900 border-2 border-cyan-500 rounded-xl shadow-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <h4 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
              <span>🔍</span>
              <span>
                {diagnosticResult.type === 'dev_env' ? '開発環境診断結果 (Development Readiness)' : '業務環境診断結果 (Business Readiness)'}
              </span>
            </h4>
            <button
              type="button"
              className="text-slate-400 hover:text-white text-xs px-2 py-1 bg-slate-800 rounded"
              onClick={() => setDiagnosticResult(null)}
            >
              閉じる ✕
            </button>
          </div>
          <div className={`p-2.5 rounded text-xs font-bold ${diagnosticResult.allReady ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-amber-950 text-amber-300 border border-amber-700'}`}>
            診断サマリー: {diagnosticResult.message} ({diagnosticResult.executedAt})
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {diagnosticResult.evaluatedItems.map((item) => (
              <div key={item.id} className="p-2 bg-slate-950 rounded border border-slate-800 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-200">{item.name}</span>
                  <HealthStatusBadge status={item.status} size="sm" customLabel={item.statusLabel.replace(/^[^\s]+\s*/, '')} />
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">{item.shortOneLineReason}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter Navigation Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeCategoryFilter === 'all'
              ? 'bg-cyan-600 text-slate-950 shadow'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveCategoryFilter('all')}
        >
          すべての項目 ({totalItemCount})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeCategoryFilter === 'dev_env'
              ? 'bg-cyan-600 text-slate-950 shadow'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveCategoryFilter('dev_env')}
        >
          💻 開発環境 ({devEnvItems.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeCategoryFilter === 'app_feature'
              ? 'bg-cyan-600 text-slate-950 shadow'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveCategoryFilter('app_feature')}
        >
          🚀 アプリ機能 ({appFeatureItems.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeCategoryFilter === 'shipping_rules'
              ? 'bg-cyan-600 text-slate-950 shadow'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveCategoryFilter('shipping_rules')}
        >
          📦 配送・規約情報 ({shippingRulesItems.length})
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            activeCategoryFilter === 'future_module'
              ? 'bg-cyan-600 text-slate-950 shadow'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
          onClick={() => setActiveCategoryFilter('future_module')}
        >
          🧩 拡張モジュール ({futureModuleItems.length})
        </button>
      </div>

      {/* Section 1: 開発環境 (Development Environment: 10 items) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'dev_env') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
              <span>💻</span>
              <span>1. 開発環境 (Development Environment &amp; Synchronization)</span>
              <span className="text-xs font-normal text-slate-400">({devEnvItems.length}項目)</span>
            </h3>
            <span className="text-xs text-slate-400">Git・Node.js・環境変数・拡張機能</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {devEnvItems.map(renderHealthItemCard)}
          </div>
        </section>
      )}

      {/* Section 2: アプリ機能 (App Features: 8 items) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'app_feature') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
              <span>🚀</span>
              <span>2. アプリ機能 (Application Core Engines)</span>
              <span className="text-xs font-normal text-slate-400">({appFeatureItems.length}項目)</span>
            </h3>
            <span className="text-xs text-slate-400">類似出品・Zonos・AI配送・コンプライアンス</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {appFeatureItems.map(renderHealthItemCard)}
          </div>
        </section>
      )}

      {/* Section 3: 配送・規約情報 (Shipping & Rules Information: 8 items) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'shipping_rules') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
              <span>📦</span>
              <span>3. 配送・規約情報 (Carrier &amp; Marketplace Compliance Rules)</span>
              <span className="text-xs font-normal text-slate-400">({shippingRulesItems.length}項目)</span>
            </h3>
            <span className="text-xs text-slate-400">eBay・AG・日本郵便・FedEx・DHL・UPS・SpeedPAK・Zonos</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shippingRulesItems.map(renderHealthItemCard)}
          </div>
        </section>
      )}

      {/* Section 4: 拡張モジュール (Future Extensible Modules: dynamically registered) */}
      {(activeCategoryFilter === 'all' || activeCategoryFilter === 'future_module') && futureModuleItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
              <span>🧩</span>
              <span>4. 拡張モジュール (Pluggable Future Extension Modules)</span>
              <span className="text-xs font-normal text-slate-400">({futureModuleItems.length}モジュール)</span>
            </h3>
            <span className="text-xs text-slate-400">Marketplace Optimizer・SNS・多言語EC・国内EC等</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {futureModuleItems.map(renderHealthItemCard)}
          </div>
        </section>
      )}
    </div>
  );
};
