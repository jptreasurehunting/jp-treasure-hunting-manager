import React, { useEffect, useMemo, useState } from 'react';
import type { CentralInventoryItem } from '../../types/centralInventory';
import type { SalesChannel } from '../../types/shippingRouter';
import {
  loadMarketplaceSaleEvents,
  MARKETPLACE_SALE_EVENTS_CHANGED_EVENT,
  MarketplaceSaleEventInput,
  MarketplaceSaleEventLine,
  MarketplaceSaleEventRecord,
  preflightMarketplaceSaleEvent,
  processMarketplaceSaleEvent
} from '../../services/marketplaceSaleEventService';

const panelStyle: React.CSSProperties = {
  background: 'rgba(15, 23, 42, 0.94)',
  border: '1px solid rgba(148, 163, 184, 0.22)',
  borderRadius: 14,
  padding: 18,
  marginBottom: 16
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid rgba(148,163,184,.32)',
  background: 'rgba(15,23,42,.82)',
  color: '#f8fafc',
  padding: '8px 10px'
};

const CHANNELS: SalesChannel[] = ['eBay', 'Shopee', 'Shopify', 'Mercari', 'YahooAuction', 'Rakuma', 'ManualDomestic'];

const STATUS_LABEL: Record<MarketplaceSaleEventRecord['status'], string> = {
  PROCESSED: '処理済み',
  BLOCKED: '処理停止',
  REPLAY_SKIPPED: '重複スキップ',
  ROLLED_BACK: 'ロールバック'
};

const STATUS_COLOR: Record<MarketplaceSaleEventRecord['status'], string> = {
  PROCESSED: '#86efac',
  BLOCKED: '#fecaca',
  REPLAY_SKIPPED: '#93c5fd',
  ROLLED_BACK: '#fdba74'
};

function localDateTimeInputValue(date = new Date()): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function createSimulationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function blankLine(items: CentralInventoryItem[]): MarketplaceSaleEventLine {
  return { sku: items[0]?.sku || '', quantity: 1 };
}

export function MarketplaceSaleEventPanel({
  items,
  onInventoryChanged
}: {
  items: CentralInventoryItem[];
  onInventoryChanged?: () => void;
}) {
  const [channel, setChannel] = useState<SalesChannel>('eBay');
  const [sellerAccountId, setSellerAccountId] = useState('');
  const [eventId, setEventId] = useState(() => createSimulationId('sim-sale'));
  const [orderId, setOrderId] = useState(() => createSimulationId('sim-order'));
  const [occurredAt, setOccurredAt] = useState(() => localDateTimeInputValue());
  const [lines, setLines] = useState<MarketplaceSaleEventLine[]>(() => [blankLine(items)]);
  const [records, setRecords] = useState<MarketplaceSaleEventRecord[]>(() => loadMarketplaceSaleEvents());
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!lines[0]?.sku && items[0]?.sku) {
      setLines((current) => current.map((line, index) => index === 0 ? { ...line, sku: items[0].sku } : line));
    }
  }, [items, lines]);

  useEffect(() => {
    const reload = () => setRecords(loadMarketplaceSaleEvents());
    window.addEventListener(MARKETPLACE_SALE_EVENTS_CHANGED_EVENT, reload);
    return () => window.removeEventListener(MARKETPLACE_SALE_EVENTS_CHANGED_EVENT, reload);
  }, []);

  const availableAccounts = useMemo(() => Array.from(new Set(
    items.flatMap((item) => item.channelBindings)
      .filter((binding) => binding.channel === channel)
      .map((binding) => binding.sellerAccountId)
  )), [channel, items]);

  useEffect(() => {
    if (availableAccounts.length === 1 && sellerAccountId !== availableAccounts[0]) {
      setSellerAccountId(availableAccounts[0]);
    }
  }, [availableAccounts, sellerAccountId]);

  const simulationInput: MarketplaceSaleEventInput = useMemo(() => ({
    eventId,
    channel,
    sellerAccountId,
    orderId,
    occurredAt,
    lines,
    source: 'MANUAL_SIMULATION'
  }), [eventId, channel, sellerAccountId, orderId, occurredAt, lines]);

  const preflight = useMemo(
    () => preflightMarketplaceSaleEvent(simulationInput, items, records),
    [simulationInput, items, records]
  );

  const updateLine = (index: number, patch: Partial<MarketplaceSaleEventLine>) => {
    setLines((current) => current.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line));
  };

  const removeLine = (index: number) => {
    setLines((current) => current.length <= 1 ? current : current.filter((_, lineIndex) => lineIndex !== index));
  };

  const addLine = () => setLines((current) => [...current, blankLine(items)]);

  const resetSimulation = () => {
    setEventId(createSimulationId('sim-sale'));
    setOrderId(createSimulationId('sim-order'));
    setOccurredAt(localDateTimeInputValue());
    setLines([blankLine(items)]);
    setMessage('');
  };

  const runSimulation = () => {
    const result = processMarketplaceSaleEvent(simulationInput);
    setMessage(result.messageJa);
    setRecords(loadMarketplaceSaleEvents());
    if (result.success && !result.replaySkipped) onInventoryChanged?.();
  };

  const recent = useMemo(
    () => [...records].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)).slice(0, 20),
    [records]
  );

  return (
    <section style={panelStyle}>
      <div>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 20 }}>販売検知イベント</h3>
        <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: 13, lineHeight: 1.65 }}>
          Marketplaceで「売れた」というイベントを受け取る共通入口です。現在は模擬イベントのみで、中央在庫引当 → 他販売先への絶対在庫同期要求までをEnd-to-Endで確認します。
        </p>
      </div>

      <div style={{ margin: '14px 0', padding: 11, borderRadius: 9, background: 'rgba(30,64,175,.18)', color: '#bfdbfe', fontSize: 12, lineHeight: 1.65 }}>
        <strong>これは注文を作る機能ではありません。</strong> eBay / Shopeeから注文を取得するAPIはまだ未接続です。「実際に注文検知アダプターから同じデータが来たら在庫が安全に動くか」を試すためのSimulationです。
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>販売先
          <select value={channel} onChange={(e) => { setChannel(e.target.value as SalesChannel); setSellerAccountId(''); }} style={{ ...inputStyle, marginTop: 5 }}>
            {CHANNELS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>販売アカウントID
          <input value={sellerAccountId} onChange={(e) => setSellerAccountId(e.target.value)} list="sale-event-account-options" style={{ ...inputStyle, marginTop: 5 }} placeholder="中央在庫Bindingと同じID" />
          <datalist id="sale-event-account-options">
            {availableAccounts.map((account) => <option key={account} value={account} />)}
          </datalist>
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>販売イベントID
          <input value={eventId} onChange={(e) => setEventId(e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>注文ID
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
        <label style={{ color: '#cbd5e1', fontSize: 12 }}>販売発生日時
          <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
        </label>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <strong style={{ color: '#e2e8f0', fontSize: 13 }}>注文明細</strong>
          <button type="button" onClick={addLine} style={{ borderRadius: 8, border: '1px solid rgba(96,165,250,.4)', background: 'rgba(30,64,175,.25)', color: '#dbeafe', padding: '6px 9px', cursor: 'pointer' }}>明細を追加</button>
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          {lines.map((line, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 110px auto', gap: 8, alignItems: 'end' }}>
              <label style={{ color: '#cbd5e1', fontSize: 12 }}>SKU
                <select value={line.sku} onChange={(e) => updateLine(index, { sku: e.target.value })} style={{ ...inputStyle, marginTop: 4 }}>
                  <option value="">選択してください</option>
                  {items.map((item) => <option key={item.sku} value={item.sku}>{item.sku} — ATS {item.availableToSell}</option>)}
                </select>
              </label>
              <label style={{ color: '#cbd5e1', fontSize: 12 }}>数量
                <input type="number" min="1" step="1" value={line.quantity} onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })} style={{ ...inputStyle, marginTop: 4 }} />
              </label>
              <button type="button" disabled={lines.length <= 1} onClick={() => removeLine(index)} style={{ borderRadius: 8, border: '1px solid rgba(248,113,113,.35)', background: 'rgba(127,29,29,.22)', color: '#fecaca', padding: '8px 9px', cursor: lines.length <= 1 ? 'not-allowed' : 'pointer', opacity: lines.length <= 1 ? 0.5 : 1 }}>削除</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: preflight.blockingReasons.length ? 'rgba(127,29,29,.18)' : 'rgba(6,78,59,.18)', color: '#cbd5e1', fontSize: 12, lineHeight: 1.6 }}>
        <strong style={{ color: preflight.blockingReasons.length ? '#fecaca' : '#86efac' }}>
          事前検証: {preflight.isReplay ? '処理済みイベント（重複スキップ予定）' : preflight.canProcess ? '実行可能' : '処理停止'}
        </strong>
        {preflight.aggregatedLines.length > 0 && <div>集約後: {preflight.aggregatedLines.map((line) => `${line.sku} × ${line.quantity}`).join(' / ')}</div>}
        {preflight.blockingReasons.map((reason) => <div key={reason}>⛔ {reason}</div>)}
        {preflight.warnings.map((warning) => <div key={warning}>⚠️ {warning}</div>)}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button
          type="button"
          onClick={runSimulation}
          disabled={!preflight.canProcess}
          style={{ borderRadius: 9, border: '1px solid rgba(52,211,153,.45)', background: preflight.canProcess ? 'rgba(5,150,105,.55)' : 'rgba(51,65,85,.55)', color: '#f0fdf4', padding: '9px 12px', fontWeight: 800, cursor: preflight.canProcess ? 'pointer' : 'not-allowed' }}
        >
          模擬販売を処理
        </button>
        <button type="button" onClick={resetSimulation} style={{ borderRadius: 9, border: '1px solid rgba(148,163,184,.35)', background: 'rgba(30,41,59,.75)', color: '#e2e8f0', padding: '9px 12px', cursor: 'pointer' }}>新しい模擬注文</button>
      </div>

      {message && <div style={{ marginTop: 10, color: '#dbeafe', fontSize: 12, lineHeight: 1.6 }}>{message}</div>}

      <div style={{ marginTop: 18, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ color: '#94a3b8', fontSize: 11, textAlign: 'left' }}>
              <th style={{ padding: 8 }}>状態</th>
              <th style={{ padding: 8 }}>販売先 / アカウント</th>
              <th style={{ padding: 8 }}>注文 / Event</th>
              <th style={{ padding: 8 }}>明細</th>
              <th style={{ padding: 8 }}>予約</th>
              <th style={{ padding: 8 }}>確認内容</th>
              <th style={{ padding: 8 }}>受信日時</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((record) => (
              <tr key={record.eventId} style={{ borderTop: '1px solid rgba(148,163,184,.13)', verticalAlign: 'top' }}>
                <td style={{ padding: 9, color: STATUS_COLOR[record.status], fontWeight: 800 }}>{STATUS_LABEL[record.status]}{record.replayCount ? <><br /><span style={{ fontSize: 11 }}>Replay {record.replayCount}回</span></> : null}</td>
                <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>{record.channel}<br />{record.sellerAccountId}</td>
                <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>{record.orderId}<br />{record.eventId}</td>
                <td style={{ padding: 9, color: '#e2e8f0', fontSize: 12 }}>{record.lines.map((line) => <div key={line.sku}>{line.sku} × {line.quantity}</div>)}</td>
                <td style={{ padding: 9, color: '#94a3b8', fontSize: 12 }}>{record.reservationIds.length}件</td>
                <td style={{ padding: 9, color: '#cbd5e1', fontSize: 12 }}>
                  {record.blockingReasons.map((reason) => <div key={reason} style={{ color: '#fecaca' }}>⛔ {reason}</div>)}
                  {record.warnings.map((warning) => <div key={warning} style={{ color: '#fde68a' }}>⚠️ {warning}</div>)}
                  {!record.blockingReasons.length && !record.warnings.length ? '問題なし' : null}
                </td>
                <td style={{ padding: 9, color: '#94a3b8', fontSize: 12 }}>{new Date(record.receivedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {recent.length === 0 && <div style={{ color: '#64748b', fontSize: 12 }}>まだ販売検知イベントはありません。</div>}
      </div>
    </section>
  );
}
