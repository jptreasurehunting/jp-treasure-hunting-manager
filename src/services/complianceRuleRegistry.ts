export interface ComplianceRule {
  ruleId: string;
  ruleName: string;
  version: string;
  categoryPattern: string; // e.g. "Watch|腕時計|Camera|Lens"
  destinationPattern: string; // e.g. "*" or "EU|Germany|France"
  valueMinUsd: number;
  valueMaxUsd: number;
  prohibitedMethods: string[]; // methodIds prohibited by this rule
  requiredDocuments: string[];
  requiresApproval: boolean;
  status: 'pending_approval' | 'active' | 'archived';
  approvedBy?: string;
  approvedAt?: string;
  effectiveDate: string;
}

const RULES_STORAGE_KEY = 'zonos_compliance_rule_registry_v1';

export function getInitialComplianceRules(): ComplianceRule[] {
  return [
    {
      ruleId: 'rule_watch_luxury_01',
      ruleName: 'Luxury Watch Authenticity & FedEx Watch Worksheet Rule',
      version: '1.2.0',
      categoryPattern: 'watch|腕時計|rolex|omega|seiko|grand seiko',
      destinationPattern: '*',
      valueMinUsd: 2000,
      valueMaxUsd: 100000,
      prohibitedMethods: ['jp_sea_mail', 'jp_air_mail', 'ddu_prohibited'],
      requiredDocuments: [
        'eBay Authenticity Guarantee Shipping Label',
        'FedEx Watch Breakdown Worksheet (Movement/Case/Strap Origin)',
        'Commercial Invoice (3 copies)'
      ],
      requiresApproval: false,
      status: 'active',
      approvedBy: 'eBay Admin Officer',
      approvedAt: '2026-08-01T00:00:00Z',
      effectiveDate: '2026-08-01'
    },
    {
      ruleId: 'rule_eu_evtn_01',
      ruleName: 'European Union EVTN / IOSS Compliance Rule',
      version: '1.1.0',
      categoryPattern: '*',
      destinationPattern: 'germany|france|italy|spain|netherlands|belgium|austria|eu',
      valueMinUsd: 0,
      valueMaxUsd: 10000,
      prohibitedMethods: ['ddu_prohibited'],
      requiredDocuments: ['EU EVTN / IOSS Customs Declaration Number'],
      requiresApproval: false,
      status: 'active',
      approvedBy: 'Compliance Officer',
      approvedAt: '2026-08-01T00:00:00Z',
      effectiveDate: '2026-08-01'
    }
  ];
}

export function loadComplianceRuleRegistry(): ComplianceRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return getInitialComplianceRules();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : getInitialComplianceRules();
  } catch (e) {
    console.error('Failed to load compliance rules:', e);
    return getInitialComplianceRules();
  }
}

export function saveComplianceRuleRegistry(rules: ComplianceRule[]): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch (e) {
    console.error('Failed to save compliance rules:', e);
  }
}

export function approveComplianceRule(ruleId: string, approverName: string): boolean {
  const rules = loadComplianceRuleRegistry();
  const rule = rules.find((r) => r.ruleId === ruleId);
  if (!rule) return false;

  rule.status = 'active';
  rule.approvedBy = approverName;
  rule.approvedAt = new Date().toISOString();

  saveComplianceRuleRegistry(rules);
  return true;
}
