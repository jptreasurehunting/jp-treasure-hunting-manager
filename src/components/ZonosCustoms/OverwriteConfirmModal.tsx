import React, { useState } from 'react';

export type OverwriteMode = 'unedited_only' | 'reload_all';

interface OverwriteConfirmModalProps {
  isOpen: boolean;
  onConfirm: (mode: OverwriteMode) => void;
  onCancel: () => void;
}

export const OverwriteConfirmModal: React.FC<OverwriteConfirmModalProps> = ({
  isOpen,
  onConfirm,
  onCancel
}) => {
  const [selectedMode, setSelectedMode] = useState<OverwriteMode>('unedited_only');

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card overwrite-modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-alert-icon">⚠️</span>
            <div>
              <h3 className="modal-title-ja">現在の入力内容があります</h3>
              <p className="modal-title-en text-muted">
                eBayデータを再読み込みすると、一部の項目が更新される可能性があります。
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onCancel} aria-label="閉じる">&times;</button>
        </div>

        <div className="modal-body">
          <p className="notice-text margin-bottom-md">
            既に編集された材質、商品種類、または数量が存在します。再読み込み時の取込方式を選択してください:
          </p>

          <div className="overwrite-options-list">
            <label className={`overwrite-option-card ${selectedMode === 'unedited_only' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="overwriteMode"
                value="unedited_only"
                checked={selectedMode === 'unedited_only'}
                onChange={() => setSelectedMode('unedited_only')}
              />
              <div className="option-label-body">
                <strong className="option-title">未編集項目のみ更新 (初期値 / 推奨)</strong>
                <p className="option-desc text-xs text-muted">
                  お客様が手動変更した材質・商品種類・申告価格は維持し、未設定の項目のみeBayデータで補完します。
                </p>
              </div>
            </label>

            <label className={`overwrite-option-card ${selectedMode === 'reload_all' ? 'selected' : ''}`}>
              <input
                type="radio"
                name="overwriteMode"
                value="reload_all"
                checked={selectedMode === 'reload_all'}
                onChange={() => setSelectedMode('reload_all')}
              />
              <div className="option-label-body">
                <strong className="option-title">すべて再読込</strong>
                <p className="option-desc text-xs text-muted">
                  現在の編集内容を破棄し、eBayからの最新情報で画面全体を上書きリセットします。
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            キャンセル
          </button>
          <button type="button" className="btn-primary" onClick={() => onConfirm(selectedMode)}>
            選択した方式で取込
          </button>
        </div>
      </div>
    </div>
  );
};
