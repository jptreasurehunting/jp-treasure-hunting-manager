import React, { useMemo } from 'react';
import { CentralInventoryItem } from '../../types/centralInventory';
import {
  buildInventorySalesPriorityQueue,
  InventorySalesActionKind
} from '../../services/inventorySalesPriorityService';

const ACTION_LABELS: Record<InventorySalesActionKind, string> = {
  CLEAR_BLOCK: '販売停止の原因確認',
  FIX_SYNC: '在庫同期の修正',
  LIST_UNLISTED: '未出品在庫を販売先へ登録',
  SELL_READY: '販売を優先',
  NO_SALE_ACTION: '現在は販売対象外'
};

const ACTION_COLORS: Record<InventorySalesActionKind, string> = {
  CLEAR_BLOCK: '#f87171',
  FIX_SYNC: '#fbbf24',
  LIST_UNLISTED: '#60a5fa',
  SELL_READY: '#34d399',
  NO_SALE_ACTION: '#94a3b8'
};

function formatJpy(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(value);
}

export function InventorySalesPriorityPanel({ items }: { items: CentralInventoryItem[] }) {
  const queue = useMemo(() => buildInventorySalesPriorityQueue(items), [items]);
  const activeRows = queue.rows.filter((row) => row.actionKind !== 'NO_SALE_ACTION').slice(0, 10);

  return (
    <section style={{
      marginBottom: 16,
      background: 'rgba(15, 23, 42, 0.94)',
      border: '1px solid rgba(96, 165, 250, 0.32)',
      borderRadius: 14,
      padding: 18
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>販売作業の優先キュー</h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13 }}>
            まず販売を妨げる問題を解消し、その後、未出品在庫と販売可能在庫を仕入資金の大きい順に処理します。
          </p>
        </div>
        <div style={{ color: '#bfdbfe', fontSize: 13, textAlign: 'right' }}>
          対応候補 {queue.summary.activeActionCount} SKU<br />
          対象在庫の仕入原価 {formatJpy(queue.summary.actionableTiedCostJpy)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginTop: 14 }}>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(127, 29, 29, 0.18)' }}>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>販売停止</div>
          <strong style={{ color: '#f87171', fontSize: 20 }}>{queue.summary.blockedCount}</strong>
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(120, 53, 15, 0.18)' }}>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>同期要確認</div>
          <strong style={{ color: '#fbbf24', fontSize: 20 }}>{queue.summary.syncReviewCount}</strong>
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(30, 64, 175, 0.18)' }}>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>未出品・未紐付け</div>
          <strong style={{ color: '#60a5fa', fontSize: 20 }}>{queue.summary.unlistedCount}</strong>
        </div>
        <div style={{ padding: 10, borderRadius: 10, background: 'rgba(6, 78, 59, 0.18)' }}>
          <div style={{ color: '#94a3b8', fontSize: 11 }}>すぐ販売可能</div>
          <strong style={{ color: '#34d399', fontSize: 20 }}>{queue.summary.readyToSellCount}</strong>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
          <thead>
            <tr style={{ color: '#94a3b8', fontSize: 12, textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>優先</th>
              <th style={{ padding: '8px 10px' }}>次の作業</th>
              <th style={{ padding: '8px 10px' }}>SKU / 商品</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>販売可能</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>寝ている仕入資金</th>
              <th style={{ padding: '8px 10px' }}>理由</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => (
              <tr key={row.sku} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.13)', verticalAlign: 'top' }}>
                <td style={{ padding: '10px', color: row.priority === 'P1' ? '#fbbf24' : '#bfdbfe', fontWeight: 800 }}>{row.priority}</td>
                <td style={{ padding: '10px', color: ACTION_COLORS[row.actionKind], fontWeight: 800 }}>
                  {ACTION_LABELS[row.actionKind]}
                  <div style={{ color: '#cbd5e1', fontWeight: 400, fontSize: 12, marginTop: 4 }}>{row.nextActionJa}</div>
                </td>
                <td style={{ padding: '10px' }}>
                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>{row.itemTitle}</div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>{row.sku}</div>
                </td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800 }}>{row.availableToSell}</td>
                <td style={{ padding: '10px', textAlign: 'right', fontWeight: 800 }}>{formatJpy(row.tiedCostJpy)}</td>
                <td style={{ padding: '10px', color: '#cbd5e1', fontSize: 12 }}>{row.reasonsJa.join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {activeRows.length === 0 && (
          <p style={{ color: '#94a3b8', margin: '10px 0 0' }}>現在、販売作業の対象になる在庫はありません。</p>
        )}
      </div>

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        この優先順は需要予測ではありません。在庫安全性・販売チャネル状態・販売可能数量・仕入原価だけから作業順を整理しています。価格変更や自動出品は行いません。
      </p>
    </section>
  );
}
