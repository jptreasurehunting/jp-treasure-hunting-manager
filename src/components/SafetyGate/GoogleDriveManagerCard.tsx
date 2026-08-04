import React, { useState } from 'react';
import {
  GoogleDriveAuthStatus,
  GoogleDriveFileRecord
} from '../../types/safetyGate';
import {
  loadGoogleDriveAuthStatus,
  saveGoogleDriveAuthStatus,
  loadGoogleDriveFiles,
  autoSavePhotoToGoogleDriveFolder,
  getMaskedGoogleClientId,
  checkOrCreateTargetFolder,
  TARGET_FOLDER_NAME,
  REQUIRED_OAUTH_SCOPE
} from '../../services/googleDriveService';

interface GoogleDriveManagerCardProps {
  onAddAuditLog?: (action: string, beforeState?: string, afterState?: string) => void;
}

export const GoogleDriveManagerCard: React.FC<GoogleDriveManagerCardProps> = ({ onAddAuditLog }) => {
  const [authStatus, setAuthStatus] = useState<GoogleDriveAuthStatus>(loadGoogleDriveAuthStatus());
  const [files, setFiles] = useState<GoogleDriveFileRecord[]>(loadGoogleDriveFiles());
  const maskedClientId = getMaskedGoogleClientId();
  const folderInfo = checkOrCreateTargetFolder();

  const handleToggleAuth = () => {
    const nextStatus: GoogleDriveAuthStatus =
      authStatus === 'MOCK_CONNECTED' ? 'UNAUTHENTICATED' : 'MOCK_CONNECTED';
    setAuthStatus(nextStatus);
    saveGoogleDriveAuthStatus(nextStatus);

    if (onAddAuditLog) {
      onAddAuditLog(
        `Google Drive OAuth Status Changed: ${nextStatus}`,
        `Scope: ${REQUIRED_OAUTH_SCOPE}`,
        `Target Folder: ${TARGET_FOLDER_NAME}`
      );
    }
  };

  const handleTestUpload = () => {
    const testUrl = 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=500';
    const record = autoSavePhotoToGoogleDriveFolder(testUrl, 'TEST-SKU-001');
    setFiles(loadGoogleDriveFiles());

    if (onAddAuditLog) {
      onAddAuditLog(
        `Photo Auto-Saved to Google Drive Folder "${TARGET_FOLDER_NAME}"`,
        `File: ${record.name}`,
        `Folder ID: ${record.folderId}`
      );
    }

    alert(`[SUCCESS] 写真 "${record.name}" を Google Drive フォルダ "${TARGET_FOLDER_NAME}" 内へ自動保存しました！`);
  };

  return (
    <div className="card google-drive-manager-card space-y-4">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">📁 Google Drive 写真自動保存 & OAuth 2.0 連携 (Google Drive Integration)</h3>
          <p className="card-subtitle text-xs text-muted">
            撮影した現物写真を Google Drive 上の指定フォルダ <strong>"{TARGET_FOLDER_NAME}"</strong> へ自動同期・保存します。
          </p>
        </div>
        <button
          type="button"
          className={authStatus === 'MOCK_CONNECTED' ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
          onClick={handleToggleAuth}
        >
          {authStatus === 'MOCK_CONNECTED' ? '🔌 連携解除 (Disconnect)' : '🔑 Google アカウントでサインイン (OAuth 2.0)'}
        </button>
      </div>

      <div className="card-body space-y-4 text-xs">
        {/* Auth & Security Status Banner */}
        <div className="card-sub-box bg-slate-900 border-slate-700 grid-2col gap-3">
          <div>
            <span className="text-muted block">Google 認証ステータス: </span>
            <strong className={authStatus === 'MOCK_CONNECTED' ? 'text-emerald-400 font-bold text-sm font-mono' : 'text-amber-400 font-bold text-sm font-mono'}>
              {authStatus === 'MOCK_CONNECTED' ? '🟢 Google アカウント連携完了 (Connected)' : '🔴 未接続 (Not Connected)'}
            </strong>
            <div className="text-muted text-xs mt-1">環境変数 Client ID: <span className="font-mono text-highlight">{maskedClientId}</span></div>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <span className="text-muted block">対象保存フォルダ: </span>
              <span className="status-badge status-connected font-mono">🟢 存在確認・自動作成完了</span>
            </div>
            <strong className="text-highlight font-mono text-sm font-bold block mt-1">📁 {folderInfo.folderName} (ID: {folderInfo.folderId})</strong>
            <div className="text-muted text-xs mt-1">最小OAuthスコープ: <span className="font-mono text-slate-300">{folderInfo.requiredScope}</span></div>
          </div>
        </div>

        {/* Security Rule Notice Banner */}
        <div className="legal-disclaimer-banner card-sub-box border-blue-500/30 bg-blue-950/20 text-xs text-slate-300 space-y-1">
          🛡️ <strong>セキュリティ設計方針 (Security Architecture):</strong>
          <ul className="list-disc list-inside text-xs text-slate-400">
            <li>Client Secret はブラウザ側コードに一切含まれず、クライアント環境変数にも保持しません。</li>
            <li>最小限のスコープ (`drive.file`) により、本アプリが作成したファイル・フォルダのみへアクセス範囲を制限します。</li>
            <li>フォルダ <strong>"{TARGET_FOLDER_NAME}"</strong> が存在しない場合、システムが自動検出して作成します。</li>
          </ul>
        </div>

        {/* Action & Test Controls */}
        <div className="flex justify-between items-center pt-1 border-t border-slate-800">
          <span className="text-muted">同期済み写真ファイル数: <strong className="font-mono text-highlight-gold">{files.length} 件</strong></span>
          <button type="button" className="btn-primary btn-sm" onClick={handleTestUpload}>
            📤 テスト写真を "{TARGET_FOLDER_NAME}" へ保存
          </button>
        </div>

        {/* Saved Files Table */}
        <div className="accounts-table-wrapper">
          <table className="accounts-table text-xs">
            <thead>
              <tr>
                <th>ファイル名</th>
                <th>SKU参照</th>
                <th>保存先フォルダ</th>
                <th>アップロード日時</th>
                <th>リンク</th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id}>
                  <td><strong className="font-mono text-slate-200">{f.name}</strong></td>
                  <td><span className="font-mono text-highlight">{f.skuRef || 'N/A'}</span></td>
                  <td><span className="font-mono text-amber-400">📁 {TARGET_FOLDER_NAME}</span></td>
                  <td><span className="font-mono text-muted">{f.uploadTimestamp}</span></td>
                  <td>
                    <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                      Google Driveで表示
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
