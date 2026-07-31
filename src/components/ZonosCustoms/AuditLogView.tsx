import React from 'react';
import { AuditLogEntry } from '../../types/zonosCustoms';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs }) => {
  if (!logs || logs.length === 0) return null;

  return (
    <div className="card audit-log-card margin-top-md">
      <div className="card-header space-between">
        <h4 className="card-title text-base font-semibold">
          <svg className="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="12 8 12 12 14 14"></polyline>
            <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"></path>
          </svg>
          変更履歴 / Audit Log ({logs.length} 件)
        </h4>
        <span className="text-muted text-xs">編集不可 / Read-Only</span>
      </div>

      <div className="card-body">
        <div className="audit-log-list">
          {logs.map((log) => (
            <div key={log.id} className="audit-log-row">
              <div className="log-time-col font-mono text-muted text-xs">
                {log.timestamp}
              </div>
              <div className="log-action-col font-semibold">
                {log.action}
              </div>
              {(log.beforeState || log.afterState) && (
                <div className="log-state-col text-xs text-secondary">
                  {log.beforeState && <span>前: {log.beforeState}</span>}
                  {log.beforeState && log.afterState && <span> → </span>}
                  {log.afterState && <span>後: {log.afterState}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
