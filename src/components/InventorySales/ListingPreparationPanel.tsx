import React, { useMemo, useState } from 'react';
import { CentralInventoryItem } from '../../types/centralInventory';
import { SalesChannel } from '../../types/shippingRouter';
import {
  buildListingPreparationCandidates,
  createListingPreparationDraft,
  loadListingPreparationDrafts,
  ListingPreparationDraft
} from '../../services/listingPreparationService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16
};

const buttonStyle: React.CSSProperties = {
  borderRadius: 9,
  border: '1px solid rgba(96, 165, 250, 0.45)',
  background: 'rgba(30, 64, 175, 0.55)',
  color: '#eff6ff',
  padding: '7px 10px',
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

export function ListingPreparationPanel({ items }: { items: CentralInventoryItem[] }) {
  const [drafts, setDrafts] = useState<ListingPreparationDraft[]>(() => loadListingPreparationDrafts());
  const [message, setMessage] = useState('');
  const candidates = useMemo(() => buildListingPreparationCandidates(items, drafts), [items, drafts]);

  const handleCreate = (item: CentralInventoryItem, channel: SalesChannel) => {
    const result = createListingPreparationDraft(item, channel, drafts);
    setMessage(result.messageJa);
    if (result.success) {
      setDrafts(loadListingPreparationDrafts());
    }
  };

  const itemsBySku = useMemo(() => new Map(items.map((item) => [item.sku, item])), [items]);

  return (
    <section style={panelStyle}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>出品準備キュー</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.6 }}>
          販売可能在庫を出品準備へ渡します。ここで作るのはアプリ内の下書きだけで、eBay・Shopeeへ自動公開しません。
          既存出品がある販売先は重複防止のため候補から外します。
        </p>
      </div>

      <div style={{ padding: 11, borderRadius: 9, background: 'rgba(30, 41, 59, 0.75)', color: '#cbd5e1', fontSize: 12, marginBottom: 12 }}>
        販売アカウントはまだ自動選択しません。下書き作成後に、正しいアカウント・価格・商品説明・配送条件を確認してから次工程へ進みます。
      </div>

      {message && (
        <div style={{ marginBottom: 12, color: '#bfdbfe', fontSize: 13 }} aria-live="polite">
          {message}
        </div>
      )}

      {candidates.length === 0 ? (
        <p style={{ color: '#64748b', margin: 0 }}>現在、eBay / Shopee向けの追加出品準備候補はありません。</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
            <thead>
              <tr style={{ color: '#94a3b8', fontSize: 12, textAlign: 'left' }}>
                <th style={{ padding: '8px 10px' }}>SKU / 商品</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>販売可能</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>販売可能分の原価</th>
                <th style={{ padding: '8px 10px' }}>既存出品</th>
                <th style={{ padding: '8px 10px' }}>準備中</th>
                <th style={{ padding: '8px 10px' }}>次の操作</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const item = itemsBySku.get(candidate.sku);
                return (
                  <tr key={candidate.sku} style={{ borderTop: '1px solid rgba(148, 163, 184, 0.13)', verticalAlign: 'top' }}>
                    <td style={{ padding: '11px 10px' }}>
                      <div style={{ color: '#f8fafc', fontWeight: 700 }}>{candidate.itemTitle}</div>
                      <div style={{ color: '#64748b', fontSize: 12, marginTop: 3 }}>{candidate.sku}</div>
                      {candidate.warningsJa.map((warning) => (
                        <div key={warning} style={{ color: '#94a3b8', fontSize: 11, marginTop: 3 }}>{warning}</div>
                      ))}
                    </td>
                    <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800 }}>{candidate.availableToSell}</td>
                    <td style={{ padding: '11px 10px', textAlign: 'right', fontWeight: 800 }}>{formatJpy(candidate.tiedCostJpy)}</td>
                    <td style={{ padding: '11px 10px' }}>
                      {candidate.existingChannels.length > 0 ? candidate.existingChannels.join(', ') : <span style={{ color: '#fbbf24' }}>未出品</span>}
                    </td>
                    <td style={{ padding: '11px 10px' }}>
                      {candidate.pendingDraftChannels.length > 0 ? candidate.pendingDraftChannels.join(', ') : 'なし'}
                    </td>
                    <td style={{ padding: '11px 10px' }}>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {candidate.availableTargetChannels.map((channel) => (
                          <button
                            key={channel}
                            type="button"
                            style={buttonStyle}
                            disabled={!item}
                            onClick={() => item && handleCreate(item, channel)}
                          >
                            {channel} 出品準備下書き
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ color: '#64748b', fontSize: 11, margin: '12px 0 0' }}>
        下書き作成は外部販売サイトへの出品・価格変更・在庫変更を実行しません。
      </p>
    </section>
  );
}
