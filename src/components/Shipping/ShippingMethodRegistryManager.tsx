import React, { useState } from 'react';
import { ShippingMethod } from '../../types/shippingRegistry';
import { loadShippingRegistry, saveShippingRegistry } from '../../services/shippingRegistryService';

export const ShippingMethodRegistryManager: React.FC = () => {
  const [registry, setRegistry] = useState<ShippingMethod[]>(loadShippingRegistry());
  const [isAddOpen, setIsAddOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [newCarrier, setNewCarrier] = useState<string>('');
  const [newServiceName, setNewServiceName] = useState<string>('');
  const [newIsEbayIntegrated, setNewIsEbayIntegrated] = useState<boolean>(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleActive = (methodId: string) => {
    const updated = registry.map((m) =>
      m.methodId === methodId ? { ...m, isActive: !m.isActive } : m
    );
    setRegistry(updated);
    saveShippingRegistry(updated);
    showToast('配送方法の有効/無効状態を更新しました');
  };

  const handleAddMethod = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCarrier.trim() || !newServiceName.trim()) return;

    const newMethod: ShippingMethod = {
      methodId: `method_${Date.now()}`,
      carrier: newCarrier.trim(),
      serviceName: newServiceName.trim(),
      aliases: [newServiceName.trim()],
      isEbayIntegrated: newIsEbayIntegrated,
      dutyTermSupport: ['DDP'],
      ddpHandler: newIsEbayIntegrated ? 'ebay_integrated_ddp' : 'carrier_managed_ddp',
      zonosRequirement: 'not_required',
      supportedDestinationCountries: ['*'],
      excludedDestinationCountries: [],
      minWeightGrams: 1,
      maxWeightGrams: 30000,
      maxDimensionCm: { length: 150, width: 80, height: 80, girth: 300 },
      maxItemValueUsd: 10000,
      restrictedCategories: [],
      trackingLevel: 'full_end_to_end',
      insuranceLevel: 'full',
      signatureAvailable: true,
      rateSource: '4_configurable_rate_table',
      transitTimeSource: 'Custom Registry Entry',
      isActive: true,
      effectiveStartDate: new Date().toISOString().split('T')[0],
      lastSynchronizedTime: new Date().toISOString(),
      notes: '手動追加された配送サービス'
    };

    const updated = [...registry, newMethod];
    setRegistry(updated);
    saveShippingRegistry(updated);
    setNewCarrier('');
    setNewServiceName('');
    setIsAddOpen(false);
    showToast(`✅ 新規配送サービス「${newMethod.serviceName}」をレジストリに追加しました！`);
  };

  return (
    <div className="card p-3 bg-slate-900 border border-slate-700 rounded-lg space-y-3 text-xs">
      {toastMessage && (
        <div className="toast-notification">
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex justify-between items-center pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="text-xl">📦</span>
          <div>
            <h3 className="font-bold text-sm text-slate-100">eBay統合・DDP 配送サービスレジストリ (動的拡張対応)</h3>
            <p className="text-[11px] text-slate-400">eBay連携配送・キャリア直送・Zonos対応の配送方法を動的に定義・管理します。</p>
          </div>
        </div>

        <button
          type="button"
          className="btn-secondary text-xs font-bold px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200"
          onClick={() => setIsAddOpen(!isAddOpen)}
        >
          ➕ 新規サービス追加
        </button>
      </div>

      {/* Add New Method Form */}
      {isAddOpen && (
        <form onSubmit={handleAddMethod} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2">
          <strong className="text-emerald-400 font-bold block">➕ 新規配送サービスの動的追加</strong>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <input
              type="text"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              placeholder="キャリア名 (例: DHL, FedEx, eBay eIS)"
              value={newCarrier}
              onChange={(e) => setNewCarrier(e.target.value)}
              required
            />
            <input
              type="text"
              className="form-control text-xs bg-slate-900 border-slate-700 text-slate-200"
              placeholder="サービス名 (例: Express Worldwide DDP)"
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              required
            />
            <label className="flex items-center space-x-2 text-slate-300">
              <input
                type="checkbox"
                checked={newIsEbayIntegrated}
                onChange={(e) => setNewIsEbayIntegrated(e.target.checked)}
              />
              <span>eBay連携配送 (eBay-Integrated)</span>
            </label>
          </div>
          <div className="flex justify-end space-x-2 pt-1">
            <button type="button" className="btn-secondary text-xs px-2 py-0.5" onClick={() => setIsAddOpen(false)}>
              キャンセル
            </button>
            <button type="submit" className="btn-primary text-xs px-3 py-0.5 bg-emerald-600 hover:bg-emerald-500">
              レジストリに保存
            </button>
          </div>
        </form>
      )}

      {/* Methods Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-mono text-[11px]">
          <thead>
            <tr className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <th className="p-2">ID / キャリア</th>
              <th className="p-2">サービス名</th>
              <th className="p-2">eBay連携</th>
              <th className="p-2">関税区分 (DDP/DDU)</th>
              <th className="p-2">Zonos要否</th>
              <th className="p-2">重量制限</th>
              <th className="p-2">状態</th>
              <th className="p-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {registry.map((m) => (
              <tr key={m.methodId} className={!m.isActive ? 'opacity-50 bg-slate-950' : ''}>
                <td className="p-2 font-bold text-slate-200">{m.carrier}</td>
                <td className="p-2 text-slate-300">{m.serviceName}</td>
                <td className="p-2">
                  {m.isEbayIntegrated ? (
                    <span className="text-emerald-400 font-bold">✓ eBay連携</span>
                  ) : (
                    <span className="text-slate-400">自己手配</span>
                  )}
                </td>
                <td className="p-2">
                  {m.ddpHandler === 'ddu_prohibited' ? (
                    <span className="text-red-400 font-bold">❌ DDU (禁止)</span>
                  ) : (
                    <span className="text-blue-400 font-bold">🛡️ DDP 対応</span>
                  )}
                </td>
                <td className="p-2">
                  {m.zonosRequirement === 'required' ? (
                    <span className="text-amber-400 font-bold">Zonos必須</span>
                  ) : (
                    <span className="text-slate-400">不要</span>
                  )}
                </td>
                <td className="p-2">{m.maxWeightGrams / 1000} kg</td>
                <td className="p-2">
                  {m.isActive ? (
                    <span className="text-emerald-400">🟢 有効</span>
                  ) : (
                    <span className="text-slate-500">⚪ 無効</span>
                  )}
                </td>
                <td className="p-2 text-right">
                  <button
                    type="button"
                    className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                    onClick={() => handleToggleActive(m.methodId)}
                  >
                    {m.isActive ? '無効化' : '有効化'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
