import {
  OpportunityCandidate,
  OpportunityLifecycleStage,
  HistoricalPricePoint
} from '../types/opportunityHunter';
import { safeGetItem, safeSetItem } from './opportunityHunterService';

const OPPORTUNITY_STORAGE_KEY = 'jp_opportunity_hunter_candidates';
const FRESHNESS_TTL_DAYS = 14;

/**
 * Evaluates evidence freshness and applies conservative confidence decay (Decision C & J)
 */
export function evaluateCandidateFreshness(
  candidate: OpportunityCandidate,
  currentDate: Date = new Date()
): OpportunityCandidate {
  const checkedAtStr = candidate.evidence.checkedAt || candidate.updatedAt;
  const checkedDate = new Date(checkedAtStr);
  const diffDays = (currentDate.getTime() - checkedDate.getTime()) / (1000 * 60 * 60 * 24);

  let isDataStale = false;
  let staleReason: string | undefined = undefined;
  const warningFlags = [...candidate.scoreBreakdown.warningFlags];
  let penaltyDeductions = candidate.scoreBreakdown.penaltyDeductions;

  if (diffDays > FRESHNESS_TTL_DAYS) {
    isDataStale = true;
    staleReason = `最終情報検証から ${Math.round(diffDays)} 日が経過しています (基準: 14日以内)`;
    const staleWarning = `🟡 【情報陳腐化警告】${staleReason}。最新の在庫・価格状況を再確認してください。`;

    if (!warningFlags.some((w) => w.includes('情報陳腐化警告'))) {
      warningFlags.push(staleWarning);
      penaltyDeductions += 15; // Conservative penalty for stale data
    }
  }

  // Preorder Deadline Check
  if (candidate.preOrderDeadline) {
    const deadline = new Date(candidate.preOrderDeadline);
    if (currentDate.getTime() > deadline.getTime() && candidate.lifecycleStage === 'PREORDER_OPEN') {
      warningFlags.push('⏳ 【予約締切超過】公式予約締切日時を過ぎています。在庫状況を確認してください。');
    }
  }

  const newFinalScore = Math.max(
    0,
    candidate.scoreBreakdown.demandScore +
      candidate.scoreBreakdown.profitScore +
      candidate.scoreBreakdown.rarityScore +
      candidate.scoreBreakdown.seriesHistoryScore -
      penaltyDeductions
  );

  const isRecommended =
    newFinalScore >= 70 &&
    !candidate.scoreBreakdown.isRarityOnlyTrap &&
    !candidate.scoreBreakdown.isVeroBlocked &&
    !isDataStale;

  return {
    ...candidate,
    isDataStale,
    staleReason,
    scoreBreakdown: {
      ...candidate.scoreBreakdown,
      penaltyDeductions,
      finalScore: newFinalScore,
      isRecommended,
      warningFlags
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Transitions lifecycle stage with evidence verification (Decision E)
 * Safety Rule: Temporary network error/page unavailability NEVER triggers SOLD_OUT.
 */
export function transitionLifecycleStage(
  candidate: OpportunityCandidate,
  newStage: OpportunityLifecycleStage,
  evidenceReason: string,
  isNetworkErrorOrMissingPage = false
): { updatedCandidate: OpportunityCandidate; transitionSuccess: boolean; refusalReason?: string } {
  // Safety Guard: Do not infer SOLD_OUT on page failure/network error
  if (newStage === 'SOLD_OUT' && isNetworkErrorOrMissingPage) {
    return {
      updatedCandidate: {
        ...candidate,
        staleReason: '一時的なページ不達または通信エラーのため完売判定を保留 (状態維持)',
        updatedAt: new Date().toISOString()
      },
      transitionSuccess: false,
      refusalReason: '一時的な通信エラーまたはページ不達を理由とした完売 (SOLD_OUT) 判定は禁止されています。'
    };
  }

  const updated: OpportunityCandidate = {
    ...candidate,
    lifecycleStage: newStage,
    evidence: {
      ...candidate.evidence,
      checkedAt: new Date().toISOString(),
      evidenceNotes: `${candidate.evidence.evidenceNotes} | ステージ変更 [${candidate.lifecycleStage} -> ${newStage}]: ${evidenceReason}`
    },
    updatedAt: new Date().toISOString()
  };

  return {
    updatedCandidate: updated,
    transitionSuccess: true
  };
}

/**
 * Records historical price points for secondary market and pre-release tracking (Decision I & K)
 */
export function recordCandidatePricePoint(
  candidate: OpportunityCandidate,
  priceJpy: number,
  expectedPriceUsd: number | undefined,
  recordedBy: string,
  sourceNote: string
): OpportunityCandidate {
  const newPoint: HistoricalPricePoint = {
    timestamp: new Date().toISOString(),
    priceJpy,
    expectedPriceUsd,
    recordedBy,
    sourceNote
  };

  const historical = candidate.historicalPricePoints ? [newPoint, ...candidate.historicalPricePoints] : [newPoint];

  return {
    ...candidate,
    historicalPricePoints: historical,
    updatedAt: new Date().toISOString()
  };
}

/**
 * Evaluates entire stored pool for freshness and stale warnings
 */
export function refreshOpportunityPoolFreshness(pool: OpportunityCandidate[]): OpportunityCandidate[] {
  const refreshed = pool.map((c) => evaluateCandidateFreshness(c));
  safeSetItem(OPPORTUNITY_STORAGE_KEY, JSON.stringify(refreshed));
  return refreshed;
}
