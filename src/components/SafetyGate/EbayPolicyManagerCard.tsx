import React, { useState } from 'react';
import {
  EbayFulfillmentPolicy,
  EbayReturnPolicy,
  EbayPaymentPolicy
} from '../../types/safetyGate';
import {
  loadFulfillmentPolicies,
  loadReturnPolicies,
  loadPaymentPolicies
} from '../../services/ebayBusinessPolicyService';

export const EbayPolicyManagerCard: React.FC = () => {
  const [fulPolicies] = useState<EbayFulfillmentPolicy[]>(loadFulfillmentPolicies());
  const [retPolicies] = useState<EbayReturnPolicy[]>(loadReturnPolicies());
  const [payPolicies] = useState<EbayPaymentPolicy[]>(loadPaymentPolicies());

  return (
    <div className="card ebay-policy-manager-card space-y-4">
      <div className="card-header space-between">
        <div>
          <h3 className="card-title text-base font-semibold">📋 マルチアカウント・ビジネスポリシー管理 (Business Policies Manager)</h3>
          <p className="card-subtitle text-xs text-muted">
            eBay Account API 互換構造にて、配送(Fulfillment)、返品(Return)、決済(Payment)ポリシーをアカウント別・サイト別に個別管理します。
          </p>
        </div>
        <span className="baseline-badge">Phase 3 モジュール</span>
      </div>

      <div className="card-body space-y-4 text-xs">
        {/* Fulfillment Policies */}
        <div className="space-y-2">
          <h4 className="font-bold text-highlight text-xs">配送ポリシー (Fulfillment Policies)</h4>
          <div className="grid-3col gap-3">
            {fulPolicies.map((p) => (
              <div key={p.id} className="card-sub-box bg-slate-950 border-slate-800 space-y-1">
                <div className="flex justify-between items-center">
                  <strong className="text-primary font-bold">{p.name}</strong>
                  <span className={p.isDdp ? 'status-badge status-connected' : 'status-badge status-prep'}>
                    {p.isDdp ? 'DDP (関税込み)' : 'DDU (関税別)'}
                  </span>
                </div>
                <p className="text-slate-300">{p.description}</p>
                <div className="text-muted text-xs font-mono">
                  サービス: {p.shippingService} | 予想日数: {p.estimatedDeliveryDays} | 送料: ${p.rateUsd}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Return & Payment Policies */}
        <div className="grid-2col gap-4">
          {/* Return Policies */}
          <div className="space-y-2">
            <h4 className="font-bold text-highlight text-xs">返品ポリシー (Return Policies)</h4>
            <div className="space-y-2">
              {retPolicies.map((p) => (
                <div key={p.id} className="card-sub-box bg-slate-950 border-slate-800 space-y-1">
                  <strong className="text-primary font-bold">{p.name}</strong>
                  <p className="text-slate-300">{p.description}</p>
                  <div className="text-muted font-mono text-xs">
                    期間: {p.returnPeriodDays}日 | 返送料負担: {p.returnShippingCostPayer}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Policies */}
          <div className="space-y-2">
            <h4 className="font-bold text-highlight text-xs">決済ポリシー (Payment Policies)</h4>
            <div className="space-y-2">
              {payPolicies.map((p) => (
                <div key={p.id} className="card-sub-box bg-slate-950 border-slate-800 space-y-1">
                  <strong className="text-primary font-bold">{p.name}</strong>
                  <p className="text-slate-300">{p.description}</p>
                  <div className="text-muted font-mono text-xs">
                    決済方法: {p.paymentMethods.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
