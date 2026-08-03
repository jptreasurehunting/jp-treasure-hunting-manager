import React from 'react';
import { EbaySellerAccount } from '../../types/zonosCustoms';

interface EbayOAuthPrepModalProps {
  account: EbaySellerAccount | null;
  isOpen: boolean;
  onCancel: () => void;
}

export const EbayOAuthPrepModal: React.FC<EbayOAuthPrepModalProps> = ({
  account,
  isOpen,
  onCancel
}) => {
  if (!isOpen || !account) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card oauth-prep-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">🔗</span>
            <div>
              <h3 className="modal-title-ja">eBay OAuth 接続準備</h3>
              <p className="modal-title-en text-muted">eBay OAuth Authorization Connection Setup</p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          <div className="modal-info-banner">
            <p>
              ℹ️ <strong>接続準備通知:</strong> 接続対象のアカウント情報を確認してください。本環境は Production 環境です。
            </p>
          </div>

          <div className="order-summary-box grid-2col margin-bottom-md">
            <div>
              <span className="text-xs text-muted block">接続対象アカウント / Target Account</span>
              <strong className="text-highlight text-base">{account.displayName} ({account.ebayUsername})</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">内部 ID / Internal ID</span>
              <strong className="font-mono text-base">{account.id}</strong>
            </div>

            <div>
              <span className="text-xs text-muted block">接続環境 / Environment</span>
              <span className="status-badge-prod">🟢 Production (本番環境)</span>
            </div>

            <div>
              <span className="text-xs text-muted block">安全な参照 ID / Safe Ref ID</span>
              <span className="font-mono text-xs">{account.safeRefId}</span>
            </div>
          </div>

          <div className="oauth-notice-box card-sub-box margin-bottom-md">
            <h4 className="font-bold text-sm margin-bottom-xs">⚠️ 認証手続き前の確認事項</h4>
            <ul className="text-xs text-muted space-y-1">
              <li>・eBay ログイン画面が開いた際は、必ず接続対象アカウント (<strong>{account.displayName}</strong>) でログインされているか確認してください。</li>
              <li>・他の eBay アカウントでログイン中の場合は、事前にサインアウトするか別のブラウザプロファイルを使用してください。</li>
              <li>・認証完了後、取得対象アカウントが正しく連携されたかアカウント管理画面で確認してください。</li>
              <li>※ Client Secret やアクセス/リフレッシュトークンはブラウザ上に一切保持・保存されません。</li>
            </ul>
          </div>

          <div className="prep-notice-warning text-center padding-sm card-sub-box">
            <span className="text-xs text-muted">
              ※ Ver.1.5 では接続準備機能を提供しています。eBay Developer Support からの申請回答受領後に本番OAuth連携が有効化されます。
            </span>
          </div>
        </div>

        <div className="modal-footer space-between">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn-primary btn-disabled-prep"
            disabled
            title="eBay Developer Supportの回答待ちのため、本番OAuth連携は準備中状態です"
          >
            ⏳ OAuth設定完了後に接続を開始 (準備中)
          </button>
        </div>
      </div>
    </div>
  );
};
