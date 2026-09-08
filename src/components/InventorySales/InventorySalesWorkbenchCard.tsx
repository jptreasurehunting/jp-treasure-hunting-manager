import React, { useMemo, useState } from 'react';
import { loadCentralInventory } from '../../services/centralInventoryService';
import {
  buildInventorySalesWorkbench,
  InventorySalesState
} from '../../services/inventorySalesWorkbenchService';
import { InventoryImportPanel } from './InventoryImportPanel';
import { CrossChannelInventorySyncQueuePanel } from './CrossChannelInventorySyncQueuePanel';
import { ShopeeSgInventoryMappingPanel } from './ShopeeSgInventoryMappingPanel';
import { InventorySalesPriorityPanel } from './InventorySalesPriorityPanel';
import { ListingPreparationPanel } from './ListingPreparationPanel';
import { ListingDraftReviewPanel } from './ListingDraftReviewPanel';
import { ListingPublishGatePanel } from './ListingPublishGatePanel';
import { ListingPrePublishCheckPanel } from './ListingPrePublishCheckPanel';
import { ListingPublishDryRunPanel } from './ListingPublishDryRunPanel';
import { ListingPublishAdapterSimulationPanel } from './ListingPublishAdapterSimulationPanel';
import { MarketplaceApiMappingPanel } from './MarketplaceApiMappingPanel';
import { EbayPublishPrerequisitePanel } from './EbayPublishPrerequisitePanel';
import { EbayOfficialPayloadPreviewPanel } from './EbayOfficialPayloadPreviewPanel';
import { EbaySandboxOAuthPanel } from './EbaySandboxOAuthPanel';

const STATE_LABELS: Record<InventorySalesState, string> = {
  READY: '販売準備OK',
  REVIEW_REQUIRED: '要確認',
  BLOCKED: '販売停止',
  OUT_OF_STOCK: '販売可能在庫なし'
};

const STATE_COLORS: Record<InventorySalesState, string> = {
  READY: '#34d399',
  REVIEW_REQUIRED: '#fbbf24',
  BLOCKED: '#f87171',
  OUT_OF_STOCK: '#94a3b8'
};

const DEMO_SKUS = new Set([
  'SKU-WATCH-STRAP-01',
  'SKU-VINTAGE-SEIKO-01',
  'SKU-CAMERA-LENS-01'
]);

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18
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

function formatJpy(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0
  }).format(value);
}

export function InventorySalesWorkbenchCard() {
  const [items, setItems] = useState(() => loadCentralInventory());
  const [filter, setFilter] = useState<'ALL' | InventorySalesState>('ALL');

  const reloadInventory = () => setItems(loadCentralInventory());
  const snapshot = useMemo(() => buildInventorySalesWorkbench(items), [items]);
  const visibleRows = useMemo(
    () => filter === 'ALL' ? snapshot.rows : snapshot.rows.filter((row) => row.state === filter),
    [filter, snapshot.rows]
  );

  const isLikelyDemoData = items.length === 3 && items.every((item) => DEMO_SKUS.has(item.sku));

  return (
    <section style={{ color: '#e2e8f0', padding: 20, maxWidth: 1380, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 26, color: '#f8fafc' }}>在庫販売ワークベンチ</h2>
          <p style={{ margin: '6px 0 0', color: '#94a3b8' }}>
            販売可能在庫・在庫同期リスク・仕入原価ベースの在庫資金を一画面で確認します。
          </p>
        </div>
        <button type="button" style={buttonStyle} onClick={reloadInventory}>
          中央在庫を再読込
        </button>
      </div>

      {isLikelyDemoData && (
        <div style={{ marginBottom: 16, padding: 13, borderRadius: 10, background: 'rgba(120, 53, 15, 0.38)', border: '1px solid rgba(251, 191, 36, 0.45)', color: '#fde68a' }}>
          <strong>現在はサンプル在庫です。</strong> 実在庫として販売判断しないでください。下のCSV取込で実在庫を確認してから反映できます。
        </div>
      )}

      <InventoryImportPanel onInventoryChanged={reloadInventory} />
      <CrossChannelInventorySyncQueuePanel />
      <ShopeeSgInventoryMappingPanel items={items} />
      <InventorySalesPriorityPanel items={items} />
      <ListingPreparationPanel items={items} />
      <ListingDraftReviewPanel items={items} />
      <ListingPublishGatePanel items={items} />
      <ListingPrePublishCheckPanel items={items} />
      <ListingPublishDryRunPanel items={items} />
      <ListingPublishAdapterSimulationPanel items={items} />
      <MarketplaceApiMappingPanel />
      <EbayPublishPrerequisitePanel />
      <EbayOfficialPayloadPreviewPanel />
      <EbaySandboxOAuthPanel />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <div style={panelStyle}><div style={{ color: '#94a3b8', fontSize: 13 }}>販売準備OK SKU</div><strong style={{ fontSize: 26, color: '#34d399' }}>{snapshot.summary.readySkus}</strong></div>
        <div style={panelStyle}><div style={{ color: '#94a3b8', fontSize: 13 }}>要確認 SKU</div><strong style={{ fontSize: 26, color: '#fbbf24' }}>{snapshot.summary.reviewRequiredSkus}</strong></div>
        <div style={panelStyle}><div style={{ color: '#94a3b8', fontSize: 13 }}>販売停止 SKU</div><strong style={{ fontSize: 26, color: '#f87171' }}>{snapshot.summary.blockedSkus}</strong></div>
        <div style={panelStyle}><div style={{ color: '#94a3b8', fontSize: 13 }}>販売可能数量</div><strong style={{ fontSize: 26 }}>{snapshot.summary.totalSellableUnits}</strong></div>
        <div style={panelStyle}>
          <div style={{ color: '#94a3b8', fontSize: 13 }}>販売可能在庫の仕入原価合計</div>
          <strong style={{ fontSize: 22 }}>{formatJpy(snapshot.summary.totalSellableCostBasisJpy)}</strong>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 5 }}>売上予測額ではありません。</div>
        </div>
      </div>

      <div style={{ ...panelStyle, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: '#94a3b8', fontSize: 13, marginRight: 4 }}>表示:</span>
          {(['ALL', 'READY', 'REVIEW_REQUIRED', 'BLOCKED', 'OUT_OF_STOCK'] as const).map((state) => (
            <button
              key={state}
              type="button"
              style={{
                ...buttonStyle,
                padding: '7px 10px',
                background: filter === state ? 'rgba(37, 99, 235, 0.85)' : buttonStyle.background
              }}
              onClick={() => setFilter(state)}
            >
              {state === 'ALL' ? 'すべて' : STATE_LABELS[state]}
            </button>
          ))}
        </div>
      </div>

      <div style={{ ...panelStyle, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr style={{ color: '#94a3b8', fontSize: 12, textAlign: 'left' }}>
              <th style={{ padding: '8px 10px' }}>状態</th>
              <th style={{ padding: '8px 10px' }}>SKU / 商品</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>実在庫</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>引当</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>販売可能</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>仕入原価</th>
              <th style={{ padding: '8px 10px', textAlign: 'right' }}>販売可能分の原価</th>
              <th style={{ padding: '8px 10px' }}>チャネル同期</th>
              <th style={{ padding: '8px 10px' }}>確認内容</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.sku} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.13)', verticalAlign: 'top' }}>
                <td style={{ padding: '12px 10px', fontWeight: 800, color: STATE_COLORS[row.state], whiteSpace: 'nowrap' }}>{STATE_LABELS[row.state]}</td>
                <td style={{ padding: '12px 10px' }}>
                  <div style={{ color: '#f8fafc', fontWeight: 700 }}>{row.itemTitle}</div>
                  <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{row.sku}</div>
                </td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{row.physicalStock}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{row.reservedStock}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800 }}>{row.availableToSell}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right' }}>{formatJpy(row.unitCostJpy)}</td>
                <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: 800 }}>{formatJpy(row.sellableCostBasisJpy)}</td>
                <td style={{ padding: '12px 10px' }}>
                  {row.syncedChannelCount}/{row.totalChannelCount} 外部反映確認済み
                  {row.syncIssueCount > 0 && <div style={{ color: '#fbbf24', fontSize: 12 }}>{row.syncIssueCount}件 同期待ち/要確認</div>}
                </td>
                <td style={{ padding: '12px 10px', color: '#cbd5e1', fontSize: 13 }}>
                  {row.reasonsJa.map((reason) => <div key={reason}>{reason}</div>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleRows.length === 0 && <p style={{ color: '#64748b' }}>この条件に該当する在庫はありません。</p>}
      </div>

      <p style={{ color: '#64748b', fontSize: 12, marginTop: 12 }}>
        販売発生時の中央在庫引当と販売先別の同期要求は記録しますが、eBay / Shopee等の外部サイトはAPI成功応答を確認するまで同期済みとみなしません。出品系のDry Run・Sandbox準備も本番公開は行いません。
      </p>
    </section>
  );
}
