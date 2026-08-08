import React from 'react';
import { HealthStatus, AuthorityLevel } from '../../types/projectHealth';

interface HealthStatusBadgeProps {
  status: HealthStatus;
  customLabel?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const HealthStatusBadge: React.FC<HealthStatusBadgeProps> = ({
  status,
  customLabel,
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-1.5 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-bold'
  }[size];

  switch (status) {
    case 'healthy':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-emerald-950/80 text-emerald-300 border-emerald-700/60 shadow-sm ${sizeClasses}`}
        >
          <span>✅</span>
          <span>{customLabel || '正常'}</span>
        </span>
      );
    case 'latest':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-sm ${sizeClasses}`}
        >
          <span>🟢</span>
          <span>{customLabel || '最新'}</span>
        </span>
      );
    case 'needs_check':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-amber-950/80 text-amber-300 border-amber-600/60 shadow-sm ${sizeClasses}`}
        >
          <span>🟡</span>
          <span>{customLabel || '要確認'}</span>
        </span>
      );
    case 'updating':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-cyan-950/80 text-cyan-300 border-cyan-600/60 shadow-sm ${sizeClasses}`}
        >
          <span className="animate-spin">🔄</span>
          <span>{customLabel || '更新中'}</span>
        </span>
      );
    case 'needs_refetch':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-orange-950/80 text-orange-300 border-orange-600/60 shadow-sm ${sizeClasses}`}
        >
          <span>⚠</span>
          <span>{customLabel || '要再取得'}</span>
        </span>
      );
    case 'error':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-red-950/80 text-red-300 border-red-600/60 shadow-sm ${sizeClasses}`}
        >
          <span>❌</span>
          <span>{customLabel || 'エラー'}</span>
        </span>
      );
    case 'blocked':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-rose-950/90 text-rose-200 border-rose-500 shadow-sm ${sizeClasses}`}
        >
          <span>⛔</span>
          <span>{customLabel || '処理停止'}</span>
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold rounded-md border bg-slate-800 text-slate-300 border-slate-600 ${sizeClasses}`}
        >
          <span>🟡</span>
          <span>{customLabel || '要確認'}</span>
        </span>
      );
  }
};

export const AuthorityLevelBadge: React.FC<{ level: AuthorityLevel }> = ({ level }) => {
  switch (level) {
    case 'authoritative_source':
      return (
        <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
          A. 一次公的情報
        </span>
      );
    case 'admin_approved':
      return (
        <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
          B. 管理者承認
        </span>
      );
    case 'cached':
      return (
        <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
          C. キャッシュ
        </span>
      );
    case 'unverified':
      return (
        <span className="inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
          D. 未検証情報 (AI)
        </span>
      );
    default:
      return null;
  }
};
