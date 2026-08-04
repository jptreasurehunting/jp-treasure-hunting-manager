import { DecisionReplaySnapshot } from '../types/safetyGate';

const DECISION_REPLAY_SESSION_KEY = 'zonos_decision_replay_snapshots';

export function createInitialReplaySnapshots(): DecisionReplaySnapshot[] {
  return [
    {
      id: 'replay-001',
      timestamp: '2026-06-01 10:30 (JST)',
      decisionType: 'Pre-Purchase & Safety Gate Decision',
      originalResult: '🟢 ALLOWED / PURCHASE_RECOMMENDED',
      currentRuleResult: '🔴 BLOCKED (VeRO知財リスクランク変更に伴い判定変更)',
      actualOutcome: 'Completed Sale (売上高 $280 / 純利益 ¥6,200)',
      ruleVersion: 'v1.8.0',
      exchangeRate: 150,
      shippingRatesInfo: 'Japan Post EMS: ¥2,400',
      ebayFeeAssumptions: '15.0% + $0.30',
      zonosAssumptions: 'Zonos Prepay Eligible',
      customsAssumptions: 'DE LUCID Verified',
      veroIpStatus: 'Original: LOW_RISK -> Current: HIGH_RISK',
      authenticityState: 'Verified (Tag photo check)',
      inventoryState: 'Verified (Physical stock: 3)',
      accountHealthState: 'Active',
      profitInputSummary: 'Asking ¥12,000 / Expected $280',
      confidenceBand: 'MODERATE_CONFIDENCE',
      explanation: '過去仕入れ時点ではVeROリスクLOWで推奨判定でしたが、現行ルールでは知財リスクHIGHのためBLOCKEDへ変化しています。',
      actor: 'System Auto Evaluator'
    }
  ];
}

export function loadDecisionReplaySnapshots(): DecisionReplaySnapshot[] {
  try {
    const raw = sessionStorage.getItem(DECISION_REPLAY_SESSION_KEY);
    if (!raw) return createInitialReplaySnapshots();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialReplaySnapshots();
  } catch (e) {
    console.error('Failed to load decision replay snapshots:', e);
    return createInitialReplaySnapshots();
  }
}

export function saveDecisionReplaySnapshot(snapshot: DecisionReplaySnapshot): void {
  try {
    const existing = loadDecisionReplaySnapshots();
    sessionStorage.setItem(DECISION_REPLAY_SESSION_KEY, JSON.stringify([snapshot, ...existing]));
  } catch (e) {
    console.error('Failed to save decision replay snapshot:', e);
  }
}
