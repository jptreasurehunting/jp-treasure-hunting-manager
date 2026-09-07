import React, { useEffect, useMemo, useState } from 'react';
import {
  CROSS_CHANNEL_INVENTORY_SYNC_CHANGED_EVENT,
  CrossChannelInventorySyncRequest,
  loadCrossChannelInventorySyncRequests
} from '../../services/crossChannelInventorySyncService';

const SHOPEE_SG_SELLER_CENTRE_URL = 'https://seller.shopee.sg/portal/product/list/live/all?operationSortBy=recommend_v2';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16
};

const STATUS_LABEL: Record<CrossChannelInventorySyncRequest['status'], string> = {
  QUEUED: '同期待ち',
  SUCCEEDED: '外部反映確認済み',
  FAILED: '同期失敗',
  BLOCKED: '自動同期不可'
};

const STATUS_COLOR: Record<CrossChannelInventorySyncRequest['status'], string> = {
  QUEUED: '#fde68a',
  SUCCEEDED: '#a7f3d0',
  FAILED: '#fecaca',
  BLOCKED: '#fdba74'
};

export function CrossChannelInventorySyncQueuePanel() {
  const [requests, setRequests] = useState<CrossChannelInventorySyncRequest[]>(() =>
    loadCrossChannelInventorySyncRequests()
  );

  const reload = () => setRequests(loadCrossChannelInventorySyncRequests());

  useEffect(() => {
    window.addEventListener(CROSS_CHANNEL_INVENTORY_SYNC_CHANGED_EVENT, reload);
    return () => window.removeEventListener(CROSS_CHANNEL_INVENTORY_SYNC_CHANGED_EVENT, reload);
  }, []);

  const summary = useMemo(() => ({
    queued: requests.filter((request) => request.status === 'QUEUED').length,
    failed: requests.filter((request) => request.status === 'FAILED').length,
    blocked: requests.filter((request) => request.status === 'BLOCKED').length,
    succeeded: requests.filter((request) => request.status === 'SUCCEEDED').length
  }), [requests]);

  const recent = useMemo(
    () => [...requests]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 30),
    [requests]
  );

  return (
    <section style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>販売先 在庫同期キュー</h3>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
            商品が売れた時は中央在庫を先に引き当て、eBay・Shopee等へ「残り在庫をこの数にする」という絶対在庫数の同期要求を作ります。
            外部サイトの成功応答を確認するまでは同期済みとは表示しません。
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          style={{ borderRadius: 9, border: '1px solid rgba(148,163,184,.35)', background: 'rgba(30,41,59,.95)', color: '#f8fafc', padding: '8px 12px', fontWeight: 700, cursor: 'pointer' }}
        >
          再読込
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, margin: '14px 0' }}>
        <div style={{ padding: 11, borderRadius: 8, background: 'rgba(120,53,15,.22)' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>同期待ち</div><strong style={{ color: '#fde68a', fontSize: 22 }}>{summary.queued}</strong></div>
        <div style={{ padding: 11, borderRadius: 8, background: 'rgba(127,29,29,.22)' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>同期失敗</div><strong style={{ color: '#fecaca', fontSize: 22 }}>{summary.failed}</strong></div>
        <div style={{ padding: 11, borderRadius: 8, background: 'rgba(124,45,18,.22)' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>自動同期不可</div><strong style={{ color: '#fdba74', fontSize: 22 }}>{summary.blocked}</strong></div>
        <div style={{ padding: 11, borderRadius: 8, background: 'rgba(6,78,59,.22)' }}><div style={{ color: '#94a3b8', fontSize: 11 }}>外部反映確認済み</div><strong style={{ color: '#a7f3d0', fontSize: 22 }}>{summary.succeeded}</strong></div>
      </div>

      <div style={{ marginBottom: 12, padding: 10, borderRadius: 8, background: 'rgba(30,41,59,.55)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.6 }}>
        Shopee Singapore の手動確認先として、提供された Seller Centre を参照できます：{' '}
        <a href={SHOPEE_SG_SELLER_CENTRE_URL} target="_blank" rel="noreferrer" style={{ color: '#93c5fd' }}>
          Shopee SG 商品一覧
        </a>
        。このリンクは確認用で、この画面からSeller Centreを自動操作しません。
      </div>

      {recent.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 13 }}>まだ在庫同期要求はありません。</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 920, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ color: '#94a3b8', fontSize: 11, textAlign: 'left' }}>
                <th style={{ padding: 8 }}>状態</th>
                <th style={{ padding: 8 }}>SKU</th>
                <th style={{ padding: 8 }}>販売先</th>
                <th style={{ padding: 8 }}>アカウント / Listing</th>
                <th style={{ padding: 8, textAlign: 'right' }}>反映予定在庫</th>
                <th style={{ padding: 8 }}>理由</th>
                <th style={{ padding: 8 }}>作成日時</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((request) => (
                <tr key={request.requestId} style={{ borderTop: '1px solid rgba(148,163,184,.13)', verticalAlign: 'top' }}>
                  <td style={{ padding: 9, color: STATUS_COLOR[request.status], fontWeight: 800 }}>{STATUS_LABEL[request.status]}</td>
                  <td style={{ padding: 9, color: '#f8fafc' }}>{request.sku}</td>
                  <td style={{ padding: 9 }}>{request.targetChannel}</td>
                  <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>{request.sellerAccountId}<br />{request.channelListingId}</td>
                  <td style={{ padding: 9, textAlign: 'right', fontWeight: 800 }}>{request.targetStock}</td>
                  <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>{request.reason}{request.errorMessage ? <><br /><span style={{ color: '#fecaca' }}>{request.errorMessage}</span></> : null}</td>
                  <td style={{ padding: 9, color: '#94a3b8', fontSize: 12 }}>{new Date(request.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ margin: '12px 0 0', color: '#64748b', fontSize: 12 }}>
        現段階では同期要求の生成・状態管理までです。eBay / Shopee APIから成功応答を受け取った時だけ、外部反映確認済みへ移します。
      </p>
    </section>
  );
}
