import React, { useMemo, useState } from 'react';
import { loadCentralInventory } from '../../services/centralInventoryService';
import {
  applyInventoryImportPreview,
  buildInventoryImportPreview,
  getInventoryCsvTemplate,
  getLastInventoryImportBackup,
  InventoryImportPreview,
  restoreLastInventoryImportBackup
} from '../../services/inventoryImportService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(96, 165, 250, 0.28)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 10,
  border: '1px solid rgba(148, 163, 184, 0.35)',
  background: 'rgba(30, 41, 59, 0.95)',
  color: '#f8fafc',
  padding: '9px 13px',
  cursor: 'pointer',
  fontWeight: 700
};

const CHANGE_LABELS = {
  ADD: '新規追加',
  UPDATE: '更新',
  UNCHANGED: '変更なし',
  ERROR: 'エラー'
} as const;

const CHANGE_COLORS = {
  ADD: '#34d399',
  UPDATE: '#60a5fa',
  UNCHANGED: '#94a3b8',
  ERROR: '#f87171'
} as const;

interface Props {
  onInventoryChanged: () => void;
}

export function InventoryImportPanel({ onInventoryChanged }: Props) {
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<InventoryImportPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [hasBackup, setHasBackup] = useState(() => Boolean(getLastInventoryImportBackup()));

  const changedRows = useMemo(
    () => preview?.rows.filter((row) => row.changeType === 'ADD' || row.changeType === 'UPDATE') ?? [],
    [preview]
  );

  const readFile = async (file: File) => {
    setFileName(file.name);
    setConfirmed(false);
    setMessage('');

    try {
      const text = await file.text();
      setPreview(buildInventoryImportPreview(text, loadCentralInventory()));
    } catch {
      setPreview(null);
      setMessage('CSVファイルを読み込めませんでした。在庫は変更していません。');
    }
  };

  const handleApply = () => {
    if (!preview || !confirmed) return;

    const result = applyInventoryImportPreview(preview, loadCentralInventory());
    setMessage(result.messageJa);

    if (result.success) {
      setHasBackup(true);
      setConfirmed(false);
      setPreview(null);
      setFileName('');
      onInventoryChanged();
    }
  };

  const handleRestore = () => {
    const result = restoreLastInventoryImportBackup();
    setMessage(result.messageJa);
    if (result.success) {
      setHasBackup(false);
      setPreview(null);
      setConfirmed(false);
      setFileName('');
      onInventoryChanged();
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([getInventoryCsvTemplate()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'inventory-import-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>実在庫CSV取込</h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            CSVを選んでも即時反映しません。内容確認 → 承認 → 反映の順で処理し、反映前の在庫を自動バックアップします。
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" style={buttonStyle} onClick={downloadTemplate}>CSV雛形を保存</button>
          {hasBackup && (
            <button type="button" style={{ ...buttonStyle, borderColor: 'rgba(251, 191, 36, 0.6)', color: '#fde68a' }} onClick={handleRestore}>
              直前の取込を元に戻す
            </button>
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ ...buttonStyle, display: 'inline-block' }}>
          CSVファイルを選択
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readFile(file);
              event.currentTarget.value = '';
            }}
          />
        </label>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{fileName || '未選択'}</span>
      </div>

      {message && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'rgba(30, 41, 59, 0.75)', color: '#cbd5e1' }}>
          {message}
        </div>
      )}

      {preview && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ color: '#34d399' }}>新規 {preview.added}</span>
            <span style={{ color: '#60a5fa' }}>更新 {preview.updated}</span>
            <span style={{ color: '#94a3b8' }}>変更なし {preview.unchanged}</span>
            <span style={{ color: preview.errorRows ? '#f87171' : '#94a3b8' }}>エラー {preview.errorRows}</span>
          </div>

          {preview.errorRows > 0 && (
            <div style={{ marginTop: 10, padding: 11, borderRadius: 8, background: 'rgba(127, 29, 29, 0.32)', border: '1px solid rgba(248, 113, 113, 0.4)', color: '#fecaca' }}>
              エラーがあるため反映できません。該当行を修正してCSVを再読込してください。
            </div>
          )}

          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
              <thead>
                <tr style={{ color: '#94a3b8', fontSize: 12, textAlign: 'left' }}>
                  <th style={{ padding: '7px 9px' }}>行</th>
                  <th style={{ padding: '7px 9px' }}>判定</th>
                  <th style={{ padding: '7px 9px' }}>SKU / 商品</th>
                  <th style={{ padding: '7px 9px' }}>在庫変更</th>
                  <th style={{ padding: '7px 9px' }}>仕入原価</th>
                  <th style={{ padding: '7px 9px' }}>確認内容</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={`${row.lineNumber}-${row.sku}`} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.13)', verticalAlign: 'top' }}>
                    <td style={{ padding: '10px 9px' }}>{row.lineNumber}</td>
                    <td style={{ padding: '10px 9px', color: CHANGE_COLORS[row.changeType], fontWeight: 800 }}>{CHANGE_LABELS[row.changeType]}</td>
                    <td style={{ padding: '10px 9px' }}>
                      <div style={{ fontWeight: 700, color: '#f8fafc' }}>{row.itemTitle || '—'}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{row.sku || 'SKUなし'}</div>
                    </td>
                    <td style={{ padding: '10px 9px', color: '#cbd5e1' }}>
                      {row.after ? `${row.before?.physicalStock ?? '新規'} → ${row.after.physicalStock}` : '—'}
                    </td>
                    <td style={{ padding: '10px 9px', color: '#cbd5e1' }}>
                      {row.after ? `${row.before?.unitCostJpy ?? '新規'} → ${row.after.unitCostJpy}円` : '—'}
                    </td>
                    <td style={{ padding: '10px 9px', color: row.errors.length ? '#fecaca' : '#94a3b8', fontSize: 12 }}>
                      {row.errors.length ? row.errors.map((error) => <div key={error}>{error}</div>) : '問題なし'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.canApply && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: 'rgba(30, 41, 59, 0.75)' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', color: '#e2e8f0' }}>
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} style={{ marginTop: 3 }} />
                <span>
                  上記の新規・更新 <strong>{changedRows.length}件</strong> を確認しました。既存SKUの販売チャネル紐付けは保持し、新規SKUは未紐付けとして取り込みます。
                </span>
              </label>
              <button
                type="button"
                disabled={!confirmed}
                style={{
                  ...buttonStyle,
                  marginTop: 11,
                  opacity: confirmed ? 1 : 0.45,
                  cursor: confirmed ? 'pointer' : 'not-allowed',
                  borderColor: 'rgba(52, 211, 153, 0.6)',
                  color: '#d1fae5'
                }}
                onClick={handleApply}
              >
                確認した変更を在庫へ反映
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
