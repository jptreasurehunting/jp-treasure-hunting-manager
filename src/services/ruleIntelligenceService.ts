import {
  RuleChangeIntelligenceRecord,
  CauseAnalysisResult,
  SourceFreshnessStatus,
  RuleSeverity,
  RuleActionStatus
} from '../types/safetyGate';

const RULE_INTELLIGENCE_SESSION_KEY = 'zonos_rule_intelligence_records';

/**
 * Creates Initial Mock Rule Change Intelligence Records (Spec #14 Test Scenarios)
 */
export function createInitialRuleIntelligenceRecords(): RuleChangeIntelligenceRecord[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return [
    {
      id: 'rule-chg-001',
      category: 'VERO_OR_IP_RISK',
      title: 'ブランド [Sony (Restricted Region)] の VeRO 知財侵害リスク区分変更',
      description: '権利者からの直近の警告・削除事例増加に伴い、知財リスクランクが LOW から HIGH へ変更されました。',
      previousValue: 'LOW_RISK',
      currentValue: 'HIGH_RISK',
      effectiveDate: '2026-08-01',
      detectionDate: todayStr,
      sourceName: 'eBay VeRO Monitor & Official Brand Registry',
      sourceFreshness: 'CURRENT',
      severity: 'HIGH',
      actionStatus: 'ACTION_REQUIRED',
      causeAnalysis: {
        primaryCause: '権利者 (Sony Inc.) からの類似出品に対する削除申立て (NOCI) の急増',
        contributingCauses: ['地域限定流通契約 (Territorial Distribution Agreement) の厳格化'],
        supportingData: ['直近30日間で関連出品の権利者削除通知が全国で14件検出'],
        conflictingData: [],
        confidenceLevel: 'High (高確度)',
        whyPreviousDifferent: '以前は一般中古カメラ機器として一括許容されていました。',
        whyCurrentChanged: '特定の地域向け並行輸入品に対する監視が強化されたため。',
        missingInformation: [],
        isCauseConfirmed: true
      },
        affectedActiveListingsCount: 3,
      affectedDraftListingsCount: 2,
      affectedOrdersAwaitingShipmentCount: 1,
      affectedDestinationCountries: ['US', 'EU'],
      affectedEbayAccounts: ['acc_01', 'acc_02'],
      estimatedRevenueImpactUsd: -1750,
      estimatedProfitImpactUsd: -320,
      oldApprovalExpired: true,
      isBlockRequired: true
    },
    {
      id: 'rule-chg-002',
      category: 'SHIPPING_RATE',
      title: '日本郵政 国際EMS 料金表の改定 (送料値上げ)',
      description: '北米・欧州向けEMS運賃が平均 12% 値上げされました。利益率再計算が必要です。',
      previousValue: 'EMS Zone 2: ¥2,400',
      currentValue: 'EMS Zone 2: ¥2,700',
      effectiveDate: '2026-08-01',
      detectionDate: todayStr,
      sourceName: '日本郵政 公式国際郵便料金改定通知',
      sourceFreshness: 'CURRENT',
      severity: 'WARNING',
      actionStatus: 'RECOMMENDATION_AVAILABLE',
      causeAnalysis: {
        primaryCause: '航空運賃サーチャージおよび燃油高による運送原価の上昇',
        contributingCauses: ['為替変動に伴うターミナルデューティーの調整'],
        supportingData: ['日本郵政公式プレスリリース (2026年7月公表)'],
        conflictingData: [],
        confidenceLevel: 'High (確定値)',
        whyPreviousDifferent: '旧料金表が適用されていました。',
        whyCurrentChanged: '新運賃改定が発効されたため。',
        missingInformation: [],
        isCauseConfirmed: true
      },
      affectedActiveListingsCount: 12,
      affectedDraftListingsCount: 5,
      affectedOrdersAwaitingShipmentCount: 0,
      affectedDestinationCountries: ['US', 'CA'],
      affectedEbayAccounts: ['acc_01'],
      estimatedRevenueImpactUsd: 0,
      estimatedProfitImpactUsd: -180,
      oldApprovalExpired: false,
      isBlockRequired: false
    },
    {
      id: 'rule-chg-003',
      category: 'COUNTRY_IMPORT_RULE',
      title: 'ドイツ向け 包装法 (LUCID) 登録有効期限の切迫・Stale警告',
      description: '登録確認ルールが90日以上更新されておらず、有効期限情報が Stale 状態になっています。',
      previousValue: 'Verified (2026-04-01)',
      currentValue: 'STALE / REVIEW_DUE',
      effectiveDate: '2026-07-01',
      detectionDate: todayStr,
      sourceName: 'LUCID Packaging Register Registry',
      sourceFreshness: 'STALE',
      severity: 'HIGH',
      actionStatus: 'USER_REVIEW_REQUIRED',
      causeAnalysis: {
        primaryCause: '定期目視確認期間 (90日) の経過によるルールフレッシュネス低下',
        contributingCauses: [],
        supportingData: ['最終確認日時: 2026-04-01'],
        conflictingData: [],
        confidenceLevel: 'Moderate (要人間確認)',
        whyPreviousDifferent: '前回確認から30日以内でした。',
        whyCurrentChanged: '設定された再確認トリガー期限を超過したため。',
        missingInformation: ['更新後の年間報告完了証明書'],
        isCauseConfirmed: true
      },
      affectedActiveListingsCount: 4,
      affectedDraftListingsCount: 1,
      affectedOrdersAwaitingShipmentCount: 0,
      affectedDestinationCountries: ['DE'],
      affectedEbayAccounts: ['acc_01'],
      estimatedRevenueImpactUsd: -450,
      estimatedProfitImpactUsd: -90,
      oldApprovalExpired: true,
      isBlockRequired: true
    },
    {
      id: 'rule-chg-004',
      category: 'OTHER',
      title: '特定出品アイテムの価格不整合・原因未確定フラグ',
      description: '一部の競合出品価格の変動理由が一次ソースから確認できません。',
      previousValue: 'Standard Market Price',
      currentValue: 'CAUSE_UNCONFIRMED',
      effectiveDate: todayStr,
      detectionDate: todayStr,
      sourceName: 'Market Price Crawler',
      sourceFreshness: 'UNKNOWN',
      severity: 'WARNING',
      actionStatus: 'USER_REVIEW_REQUIRED',
      causeAnalysis: {
        primaryCause: '原因未確定 (CAUSE_UNCONFIRMED)',
        contributingCauses: ['データソースの不整合またはクロール不備'],
        supportingData: [],
        conflictingData: ['複数の市場データ価格に $50 以上の乖離あり'],
        confidenceLevel: 'Low (未確定)',
        whyPreviousDifferent: '過去データは安定していました。',
        whyCurrentChanged: '突発的な価格下落が検出されたが要因が特定不能なため。',
        missingInformation: ['出品者の状態詳細情報', '付属品の有無'],
        isCauseConfirmed: false // Triggers CAUSE_UNCONFIRMED
      },
      affectedActiveListingsCount: 1,
      affectedDraftListingsCount: 0,
      affectedOrdersAwaitingShipmentCount: 0,
      affectedDestinationCountries: ['US'],
      affectedEbayAccounts: ['acc_01'],
      estimatedRevenueImpactUsd: -50,
      estimatedProfitImpactUsd: -10,
      oldApprovalExpired: false,
      isBlockRequired: false
    }
  ];
}

export function loadRuleIntelligenceRecords(): RuleChangeIntelligenceRecord[] {
  try {
    const raw = sessionStorage.getItem(RULE_INTELLIGENCE_SESSION_KEY);
    if (!raw) return createInitialRuleIntelligenceRecords();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createInitialRuleIntelligenceRecords();
  } catch (e) {
    console.error('Failed to load rule intelligence records:', e);
    return createInitialRuleIntelligenceRecords();
  }
}

export function saveRuleIntelligenceRecords(records: RuleChangeIntelligenceRecord[]): void {
  try {
    sessionStorage.setItem(RULE_INTELLIGENCE_SESSION_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save rule intelligence records:', e);
  }
}
