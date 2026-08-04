import { ProfitSimulationScenario } from '../types/safetyGate';

export function runProfitImpactSimulation(
  baseRevenueUsd: number = 280,
  baseProfitUsd: number = 42,
  baseMarginPct: number = 22.5,
  baseRoiPct: number = 31.2
): ProfitSimulationScenario[] {
  return [
    {
      id: 'scen-A',
      scenarioName: 'シナリオ A: ドイツ配送のみ一時無効化 (Disable Germany Only)',
      proposedAction: 'ドイツの包装法(LUCID)確認まで配送対象国からDEを除外',
      revenueChangeUsd: -25,
      profitChangeUsd: -4.5,
      marginChangePct: -1.2,
      roiChangePct: -2.1,
      shippingCostChangeUsd: 0,
      dutyTaxChangeUsd: -12,
      handlingTimeDaysDelta: 0,
      salesSpeedChangeText: 'わずかに低下 (-8% 出品対象国減)',
      cashFlowEffectText: '他国(US/CA)への販売継続によりキャッシュフロー維持',
      returnRiskEffectText: 'ドイツ関税・EPR返送リスクがゼロ化',
      accountRiskEffectText: '🟢 アカウント停止リスク完全排除',
      isSafetyBlockActive: false
    },
    {
      id: 'scen-B',
      scenarioName: 'シナリオ B: クーリエ(FedEx)へ変更 & 販売価格 +$5 値上げ',
      proposedAction: '配送方法をJapan PostからFedExへ変更し、運賃値上げ分を価格転嫁',
      revenueChangeUsd: 5,
      profitChangeUsd: -2.1,
      marginChangePct: -0.8,
      roiChangePct: -1.5,
      shippingCostChangeUsd: 8,
      dutyTaxChangeUsd: 0,
      handlingTimeDaysDelta: -2, // Faster delivery!
      salesSpeedChangeText: '⚡ 向上 (+15% 高速配達効果)',
      cashFlowEffectText: '配達スピード向上により受取・入金サイクル短縮',
      returnRiskEffectText: '追跡精度向上により未着クレーム低減',
      accountRiskEffectText: '🟢 遅延ハンドリング率改善',
      isSafetyBlockActive: false
    },
    {
      id: 'scen-C',
      scenarioName: 'シナリオ C: 高リスクブランドのため専門家鑑定まで一時取り下げ',
      proposedAction: 'VeRO・真贋確認が完了するまで全出品を一時ホールド',
      revenueChangeUsd: -baseRevenueUsd,
      profitChangeUsd: -baseProfitUsd,
      marginChangePct: -baseMarginPct,
      roiChangePct: -baseRoiPct,
      shippingCostChangeUsd: 0,
      dutyTaxChangeUsd: 0,
      handlingTimeDaysDelta: 0,
      salesSpeedChangeText: '一時停止 (0件)',
      cashFlowEffectText: '販売一時停止に伴う資金回収保留',
      returnRiskEffectText: '知財侵害・偽物クレームリスク完全ゼロ化',
      accountRiskEffectText: '🛡️ アカウント完全保護 (Fail Closed)',
      isSafetyBlockActive: true // Safety block active!
    }
  ];
}
