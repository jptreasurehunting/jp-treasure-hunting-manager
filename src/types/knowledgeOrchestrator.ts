import {
  KnowledgeDomain,
  KnowledgeAuthorityLevel,
  OperationalKnowledgeEntry,
  ContradictionReport,
  ExactAssetHumanConfirmation
} from './operationalKnowledge';

export type FreshnessRequirement = 'strict' | 'relaxed' | 'cached_allowed';
export type BlockingSensitivity = 'critical' | 'high' | 'medium' | 'low';
export type OrchestratorFreshnessStatus = 'usable' | 'usable_with_warning' | 'revalidation_required' | 'blocked';

export interface KnowledgeQueryRequest {
  requestingModuleId: string; // e.g. 'ai_shipping_advisor', 'shipping_compliance', 'ai_marketing_studio', 'zonos_customs'
  domain: KnowledgeDomain;
  topic?: string;
  productCategory?: string; // e.g. 'Watches', 'Cameras', 'Jewelry', 'All'
  country?: string; // e.g. 'US', 'DE', 'Global', 'JP'
  destination?: string; // e.g. 'US', 'United States'
  carrier?: string; // e.g. 'FedEx', 'DHL', 'Japan Post', 'eBay SpeedPAK'
  marketplace?: string; // e.g. 'eBay', 'Shopee'
  channel?: string; // e.g. 'instagram', 'x_twitter', 'own_ec', 'ebay'
  proposedUse?: string; // e.g. 'shipping_decision', 'listing', 'ad_marketing', 'customs_declaration'
  assetId?: string; // For asset-specific facts (e.g. 'img_canon_ae1_01')
  requiredAuthorityLevel?: KnowledgeAuthorityLevel;
  freshnessRequirement?: FreshnessRequirement;
  blockingSensitivity?: BlockingSensitivity;
}

export interface KnowledgeDecisionProvenance {
  reusedKnowledgeIds: string[];
  primarySource: string;
  authorityLevel: KnowledgeAuthorityLevel;
  authorityLevelBadge: string;
  scopeMatched: boolean;
  matchedScopeDescription: string;
  verifiedDate: string;
  humanConfirmationFact?: ExactAssetHumanConfirmation;
  isSafeFallbackUsed: boolean;
  whyExplanationJa: string;
  reasonBasisJa: string; // "この判断は何を根拠にしましたか？"
}

export interface KnowledgeQueryResponse {
  isResolved: boolean;
  reusedFromSharedEngine: boolean;
  bestApplicableKnowledge?: OperationalKnowledgeEntry;
  authorityLevel: KnowledgeAuthorityLevel;
  scopeMatch: boolean;
  mismatchReasonJa?: string;
  freshnessStatus: OrchestratorFreshnessStatus;
  contradictions: ContradictionReport[];
  confidence: number;
  humanConfirmationRequired: boolean;
  humanQuestionJa?: string;
  safeFallbackSuggested: boolean;
  safeFallbackDescription?: string;
  source: string;
  evidence: string;
  lastVerifiedTime: string;
  provenance: KnowledgeDecisionProvenance;
  avoidedNewResearch: boolean;
  avoidedResearchDescription?: string;
}

export interface InvalidationPropagationEvent {
  eventId: string;
  knowledgeId: string;
  topic: string;
  reasonJa: string;
  invalidationType: 'STALE' | 'SUPERSEDED' | 'REVOKED' | 'CONTRADICTORY';
  affectedModules: string[];
  timestamp: string;
  revalidationPriority: 'URGENT_CRITICAL' | 'HIGH_PRIORITY' | 'NORMAL' | 'LOW';
  priorityScore: number;
}

export interface RevalidationPriorityItem {
  knowledgeId: string;
  topic: string;
  blockingRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  affectedWorkflowsCount: number;
  affectedModules: string[];
  ageInDays: number;
  priorityScore: number;
  priorityLabelJa: string;
}

export interface OrchestratorEfficiencyStats {
  duplicateResearchPrevented: number;
  repeatedQuestionsPrevented: number;
  reusedVerifiedFacts: number;
  staleRuleInterceptions: number;
  contradictionDetections: number;
  estimatedMinutesSaved: number;
}

export interface OrchestratorAuditLogEntry {
  id: string;
  timestamp: string;
  requestingModule: string;
  querySummary: string;
  reusedKnowledgeId?: string;
  reused: boolean;
  freshness: OrchestratorFreshnessStatus;
  humanConfirmationAvoided: boolean;
  contradictionHandled: boolean;
  detailsJa: string;
}
