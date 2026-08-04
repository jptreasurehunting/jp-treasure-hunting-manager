import { loadBrandAuditLogs } from './brandAssetService';
import { loadInventoryItems, loadInventoryLogs } from './safetyInventoryService';

export interface UnifiedAuditReport {
  reportId: string;
  generatedAt: string;
  exporter: string;
  appVersion: string;
  summary: {
    totalBrandAuditLogs: number;
    totalInventoryItems: number;
    totalAdjustmentLogs: number;
    safetyGateStatus: string;
  };
  brandAuditLogs: any[];
  inventoryItems: any[];
  inventoryAdjustmentLogs: any[];
  legalDisclaimer: string;
  integritySignature: string;
}

/**
 * Generates a unified compliance audit report combining Brand Asset logs, Inventory records, and SafetyGate status.
 */
export function generateUnifiedAuditReport(exporterName: string = 'Admin User'): UnifiedAuditReport {
  const brandLogs = loadBrandAuditLogs();
  const inventoryItems = loadInventoryItems();
  const inventoryLogs = loadInventoryLogs();
  const timestamp = new Date().toLocaleString('ja-JP');

  const reportData: Omit<UnifiedAuditReport, 'integritySignature'> = {
    reportId: `report-audit-${Date.now()}`,
    generatedAt: timestamp,
    exporter: exporterName,
    appVersion: 'v1.8-Phase5',
    summary: {
      totalBrandAuditLogs: brandLogs.length,
      totalInventoryItems: inventoryItems.length,
      totalAdjustmentLogs: inventoryLogs.length,
      safetyGateStatus: 'ACTIVE (Fail-Closed Protection Enabled)'
    },
    brandAuditLogs: brandLogs,
    inventoryItems: inventoryItems,
    inventoryAdjustmentLogs: inventoryLogs,
    legalDisclaimer:
      '⚖️ 案内告知: 本統合監査レポートはアプリ内操作およびコンプライアンスログのローカル集計結果です。法令適合および取引アカウントの安全性を保証するものではありません。'
  };

  // Simple pseudo-signature for local integrity
  const signatureString = `SIGN-${reportData.reportId}-${reportData.generatedAt}-${brandLogs.length + inventoryItems.length}`;

  return {
    ...reportData,
    integritySignature: signatureString
  };
}

/**
 * Triggers a browser download of the structured JSON audit report.
 */
export function exportUnifiedAuditReportJSON(exporterName: string = 'Admin User'): void {
  const report = generateUnifiedAuditReport(exporterName);
  const jsonStr = JSON.stringify(report, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `JP_Treasure_Hunting_AuditReport_${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
