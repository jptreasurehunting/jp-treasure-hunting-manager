export interface ShippingRecommendation {
  method: string;
  reason: string;
  isAvailable: boolean;
}

/**
 * Generates Japan Post international shipping method recommendations
 * based on destination country and total packaged weight (Spec #6).
 */
export function getJapanPostRecommendations(
  destinationCountry: string,
  totalPackagedWeightGrams: number
): ShippingRecommendation[] {
  const destClean = (destinationCountry || '').trim().toLowerCase();
  const isDomestic = destClean === 'japan' || destClean === 'jp' || destClean.includes('日本');

  if (isDomestic) {
    return [
      {
        method: 'Zonos Prepay 対象外',
        reason: '発送先が日本国内のためZonos Prepayおよび国際郵便は対象外です。',
        isAvailable: false
      }
    ];
  }

  const recommendations: ShippingRecommendation[] = [];
  const weightKg = totalPackagedWeightGrams / 1000;

  // 1. Small Packet (小形包装物) - Max 2000g (2kg)
  if (totalPackagedWeightGrams <= 2000 && totalPackagedWeightGrams > 0) {
    recommendations.push({
      method: '小形包装物 航空便',
      reason: `梱包後総重量が ${totalPackagedWeightGrams}g (2kg以下) のため小形包装物の最軽量・コスト最適候補です。`,
      isAvailable: true
    });
    recommendations.push({
      method: '小形包装物 船便',
      reason: `重量2kg以下・低コスト重視の配送候補です。`,
      isAvailable: true
    });
  }

  // 2. EMS (Express Mail Service)
  if (totalPackagedWeightGrams <= 30000) {
    recommendations.push({
      method: 'EMS',
      reason: totalPackagedWeightGrams > 0
        ? `重量 ${weightKg.toFixed(2)}kg に対応する最速追跡保証サービスです。`
        : `発送先国に対応する標準最速追跡保証サービスです。`,
      isAvailable: true
    });
  }

  // 3. International Parcel Air (国際小包 航空便)
  if (totalPackagedWeightGrams <= 30000) {
    recommendations.push({
      method: '国際小包 航空便',
      reason: `中〜大型荷物に適した標準航空配送候補です。`,
      isAvailable: true
    });
  }

  // 4. International Parcel Surface (国際小包 船便)
  if (totalPackagedWeightGrams <= 30000) {
    recommendations.push({
      method: '国際小包 船便',
      reason: `重量物・低価格重視の船便配送候補です。`,
      isAvailable: true
    });
  }

  // General Notice Recommendation
  recommendations.push({
    method: 'その他の日本郵便国際サービス',
    reason: '※ 最終的な利用可否・引き受け条件は日本郵便の最新の地域別取扱状況をご確認ください。',
    isAvailable: true
  });

  return recommendations;
}
