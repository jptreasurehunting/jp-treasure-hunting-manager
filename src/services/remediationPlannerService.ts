import { RemediationActionItem, RuleChangeIntelligenceRecord } from '../types/safetyGate';

export function generateRemediationChecklist(record: RuleChangeIntelligenceRecord): RemediationActionItem[] {
  const checklist: RemediationActionItem[] = [];

  if (record.category === 'VERO_OR_IP_RISK') {
    checklist.push({
      id: 'act-001',
      actionName: '1. ローカルリスクスコアおよび判定の自動再計算',
      whyRequired: '知財リスクランク上昇に伴う影響範囲の自動特定のため',
      isMandatory: true,
      safetyClass: 'SAFE_LOCAL_AUTOMATION',
      estimatedTimeMinutes: 1,
      expectedResult: 'ローカル推奨ステータスが ACTION_REQUIRED へ更新されます',
      affectedRecords: '対象出品3件',
      isReversible: true,
      requiresApproval: false,
      isCompleted: true
    });

    checklist.push({
      id: 'act-002',
      actionName: '2. 影響を受ける対象出品の一次一時停止 (Hold Listing)',
      whyRequired: 'VeRO権利者からの警告・アカウントペナルティを防止するため',
      isMandatory: true,
      safetyClass: 'USER_APPROVAL_REQUIRED',
      estimatedTimeMinutes: 5,
      expectedResult: 'eBay出品の検索非表示または出品取り下げの提案パッケージを作成',
      affectedRecords: 'SKU-SONY-003',
      isReversible: true,
      requiresApproval: true,
      isCompleted: false
    });

    checklist.push({
      id: 'act-003',
      actionName: '3. 権利者許諾書または正規購入レシートの提出・確認',
      whyRequired: 'VeROブロックを安全に解除するための必須証拠の確保',
      isMandatory: true,
      safetyClass: 'USER_APPROVAL_REQUIRED',
      estimatedTimeMinutes: 15,
      expectedResult: '正規仕入証拠の添付によりVeROフラグが安全に解消されます',
      affectedRecords: '全影響レコード',
      isReversible: false,
      requiresApproval: true,
      isCompleted: false
    });

    // Example of forbidden action (for instruction display)
    checklist.push({
      id: 'act-004',
      actionName: '4. [禁止] 証拠なしでのVeROブロック強制解除',
      whyRequired: 'アカウント停止リスクを伴うため自動化・強制実行は禁止されています',
      isMandatory: false,
      safetyClass: 'FORBIDDEN_AUTOMATION',
      estimatedTimeMinutes: 0,
      expectedResult: 'FORBIDDEN_AUTOMATION (絶対実行不可)',
      affectedRecords: 'N/A',
      isReversible: false,
      requiresApproval: false,
      isCompleted: false
    });
  } else if (record.category === 'SHIPPING_RATE') {
    checklist.push({
      id: 'act-005',
      actionName: '1. 新送料に基づく利益率および予想利益の自動再計算',
      whyRequired: '国際運賃改定に伴う粗利率低下の把握のため',
      isMandatory: true,
      safetyClass: 'SAFE_LOCAL_AUTOMATION',
      estimatedTimeMinutes: 1,
      expectedResult: '全対象商品の予想純利益が自動改定されます',
      affectedRecords: '対象出品12件',
      isReversible: true,
      requiresApproval: false,
      isCompleted: true
    });

    checklist.push({
      id: 'act-006',
      actionName: '2. 送料改定に応じたeBay販売価格の改定提案',
      whyRequired: '利益率15%を維持するため販売価格を +$3.00 調整',
      isMandatory: false,
      safetyClass: 'USER_APPROVAL_REQUIRED',
      estimatedTimeMinutes: 3,
      expectedResult: '価格改定案を作成し利用者の承認後に反映します',
      affectedRecords: '対象出品12件',
      isReversible: true,
      requiresApproval: true,
      isCompleted: false
    });
  } else {
    checklist.push({
      id: 'act-007',
      actionName: '1. ローカル影響分析および手動確認の要請',
      whyRequired: 'ルール変更または期限切れに伴うリスク再検証のため',
      isMandatory: true,
      safetyClass: 'SAFE_LOCAL_AUTOMATION',
      estimatedTimeMinutes: 2,
      expectedResult: '確認チェックリストの作成',
      affectedRecords: '該当レコード',
      isReversible: true,
      requiresApproval: false,
      isCompleted: true
    });
  }

  return checklist;
}
