import React, { useState } from 'react';
import { ZonosCustomsValidator } from './ZonosCustoms/ZonosCustomsValidator';
import { DevEnvManagerCard } from './DevEnv/DevEnvManagerCard';
import { DdpShippingDecisionCard } from './Shipping/DdpShippingDecisionCard';
import { AiShippingAdvisorCard } from './Shipping/AiShippingAdvisorCard';
import { AirShippingQuoteCard } from './Shipping/AirShippingQuoteCard';
import { SourceHealthDashboardCard } from './Shipping/SourceHealthDashboardCard';
import { ShippingMethodRegistryManager } from './Shipping/ShippingMethodRegistryManager';
import { ShippingTemplateManagerCard } from './Shipping/ShippingTemplateManagerCard';
import { AccountListingTransferView } from './ListingTransfer/AccountListingTransferView';
import { CountryComplianceManager } from './Compliance/CountryComplianceManager';
import { DestinationShippingManagerCard } from './Compliance/DestinationShippingManagerCard';
import { SafetyGateDashboard } from './SafetyGate/SafetyGateDashboard';
import { BrandAssetManagerCard } from './BrandAsset/BrandAssetManagerCard';
import { loadEbayAccounts } from '../services/ebayAccountService';
import {
  loadComplianceRecords,
  saveComplianceRecords,
  loadDestinationShippingRates,
  saveDestinationShippingRates
} from '../services/countryComplianceService';
import { CountryComplianceRecord, DestinationShippingCost, AuditLogEntry } from '../types/zonosCustoms';
import { exportUnifiedAuditReportJSON } from '../services/unifiedExportService';

interface ZonosCustomsMainContainerProps {
  initialSubTab?: 'validator' | 'ddp_shipping' | 'transfer' | 'compliance' | 'safety_gate' | 'brand_assets';
}

export const ZonosCustomsMainContainer: React.FC<ZonosCustomsMainContainerProps> = ({
  initialSubTab = 'validator'
}) => {
  const [activeTab, setActiveTab] = useState<'validator' | 'ddp_shipping' | 'transfer' | 'compliance' | 'safety_gate' | 'brand_assets'>(initialSubTab);
  const [complianceRecords, setComplianceRecords] = useState<CountryComplianceRecord[]>(loadComplianceRecords());
  const [shippingRates, setShippingRates] = useState<DestinationShippingCost[]>(loadDestinationShippingRates());

  const accounts = loadEbayAccounts();

  const handleUpdateRecord = (updated: CountryComplianceRecord) => {
    const updatedList = complianceRecords.map((r) =>
      r.countryCode === updated.countryCode ? updated : r
    );
    setComplianceRecords(updatedList);
    saveComplianceRecords(updatedList);
  };

  const handleUpdateShippingRate = (updatedRate: DestinationShippingCost) => {
    const updatedList = shippingRates.map((r) =>
      r.countryCode === updatedRate.countryCode ? updatedRate : r
    );
    setShippingRates(updatedList);
    saveDestinationShippingRates(updatedList);
  };

  const handleAddAuditLog = (action: string, beforeState?: string, afterState?: string) => {
    try {
      const newEntry: AuditLogEntry = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        action,
        beforeState,
        afterState
      };
      const raw = sessionStorage.getItem('zonos_customs_audit_logs');
      const existing: AuditLogEntry[] = raw ? JSON.parse(raw) : [];
      sessionStorage.setItem('zonos_customs_audit_logs', JSON.stringify([newEntry, ...existing]));
    } catch (e) {
      console.error('Failed to append audit log:', e);
    }
  };

  return (
    <div className="zonos-main-app-wrapper">
      {/* Top Main App Title Header */}
      <div className="main-app-header-bar flex items-center justify-between p-3 mb-3 bg-slate-900 border border-slate-700 rounded-md">
        <div className="flex items-center space-x-3">
          <span className="text-xl">🛃</span>
          <div>
            <h2 className="text-base font-bold text-white">Zonos Customs Manager &amp; AI Development Suite (Ver.3.16)</h2>
            <p className="text-xs text-slate-400">DDP専業運用・AI配送コンプライアンス・マルチPC開発環境管理統合環境</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            className="btn-secondary btn-sm text-xs font-bold flex items-center gap-1"
            onClick={() => exportUnifiedAuditReportJSON()}
          >
            📥 監査レポート出力 (.json)
          </button>
          <span className="text-xs font-mono text-emerald-400 bg-slate-800 px-2 py-1 rounded border border-slate-700 font-bold">DDP Active</span>
        </div>
      </div>

      {/* Top Application Navigation Tabs */}
      <div className="main-tab-nav-bar card margin-bottom-md">
        <div className="flex items-center space-x-3 p-2 bg-slate-900 border-b border-slate-700 overflow-x-auto">
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'validator' ? 'active' : ''}`}
            onClick={() => setActiveTab('validator')}
          >
            🛃 Zonos Prepay カスタム申告 (Ver.2.5)
          </button>
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'ddp_shipping' ? 'active' : ''}`}
            onClick={() => setActiveTab('ddp_shipping')}
          >
            ✈️ DDP配送判定 &amp; 開発環境同期 (Ver.3.16)
          </button>
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'safety_gate' ? 'active' : ''}`}
            onClick={() => setActiveTab('safety_gate')}
          >
            🛡️ 安全販売・法令・実在庫チェック (Ver.1.8)
          </button>
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'brand_assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('brand_assets')}
          >
            🎨 ブランドアセット &amp; SNSコマース準備 (Phase 4.1)
          </button>
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'transfer' ? 'active' : ''}`}
            onClick={() => setActiveTab('transfer')}
          >
            🔄 eBay リスティング転記・移行 (Ver.1.6)
          </button>
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setActiveTab('compliance')}
          >
            🌐 国別販売・法規制コンプライアンス管理 (Ver.1.7)
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'validator' ? (
        <ZonosCustomsValidator />
      ) : activeTab === 'ddp_shipping' ? (
        <div className="space-y-4">
          <DevEnvManagerCard />
          <SourceHealthDashboardCard />
          <AiShippingAdvisorCard />
          <DdpShippingDecisionCard />
          <AirShippingQuoteCard />
          <ShippingTemplateManagerCard />
          <ShippingMethodRegistryManager />
        </div>
      ) : activeTab === 'safety_gate' ? (
        <SafetyGateDashboard onAddAuditLog={handleAddAuditLog} />
      ) : activeTab === 'brand_assets' ? (
        <BrandAssetManagerCard onAddAuditLog={handleAddAuditLog} />
      ) : activeTab === 'transfer' ? (
        <AccountListingTransferView
          accounts={accounts}
          complianceRecords={complianceRecords}
          onAddAuditLog={handleAddAuditLog}
        />
      ) : (
        <div className="space-y-6">
          <CountryComplianceManager
            records={complianceRecords}
            onUpdateRecord={handleUpdateRecord}
            onAddAuditLog={handleAddAuditLog}
          />
          <DestinationShippingManagerCard
            complianceRecords={complianceRecords}
            shippingRates={shippingRates}
            onUpdateShippingRate={handleUpdateShippingRate}
            onOpenComplianceManager={() => setActiveTab('compliance')}
            onAddAuditLog={handleAddAuditLog}
          />
        </div>
      )}
    </div>
  );
};
