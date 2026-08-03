import React, { useState } from 'react';
import { ZonosCustomsValidator } from './ZonosCustoms/ZonosCustomsValidator';
import { AccountListingTransferView } from './ListingTransfer/AccountListingTransferView';
import { CountryComplianceManager } from './Compliance/CountryComplianceManager';
import { DestinationShippingManagerCard } from './Compliance/DestinationShippingManagerCard';
import { loadEbayAccounts } from '../services/ebayAccountService';
import {
  loadComplianceRecords,
  saveComplianceRecords,
  loadDestinationShippingRates,
  saveDestinationShippingRates
} from '../services/countryComplianceService';
import { CountryComplianceRecord, DestinationShippingCost, AuditLogEntry } from '../types/zonosCustoms';

export const ZonosCustomsMainContainer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'validator' | 'transfer' | 'compliance'>('validator');
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
      {/* Top Application Navigation Tabs */}
      <div className="main-tab-nav-bar card margin-bottom-md">
        <div className="flex items-center space-x-3 p-2 bg-slate-900 border-b border-slate-700">
          <button
            type="button"
            className={`tab-nav-btn ${activeTab === 'validator' ? 'active' : ''}`}
            onClick={() => setActiveTab('validator')}
          >
            🛃 Zonos Prepay カスタム申告 (Ver.1.5)
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
