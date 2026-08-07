export type SyncSourceType = 'structured_api' | 'unstructured_policy_document';
export type SyncStatusType = 'latest' | 'updating' | 'needs_recheck' | 'failed' | 'pending_approval';

export interface SourceHealth {
  sourceId: string;
  sourceName: string;
  sourceType: SyncSourceType;
  lastSuccessfulSync: string;
  nextScheduledSync: string;
  status: SyncStatusType;
  affectedFunctions: string[];
  errorMessage?: string;
  staleTtlHours: number;
}

export interface RuleChangeHistoryLog {
  historyId: string;
  ruleId: string;
  version: string;
  sourceName: string;
  retrievedTime: string;
  previousValue: string;
  newValue: string;
  effectiveDate: string;
  actionType: 'auto_applied' | 'approved_by_admin' | 'rolled_back';
  adminNotes?: string;
  performedBy: string;
}

export interface UnstructuredPolicyProposal {
  proposalId: string;
  ruleId: string;
  currentRuleText: string;
  proposedRuleText: string;
  sourceName: string;
  publicationDate: string;
  affectedCategories: string[];
  affectedServices: string[];
  expectedOperationalImpact: string;
  status: 'pending_approval' | 'approved' | 'rejected';
  submittedAt: string;
  approvedBy?: string;
}

export interface SyncNotification {
  notificationId: string;
  timestamp: string;
  type: 'service_unavailable' | 'restriction_change' | 'new_document' | 'ag_change' | 'listing_affected' | 'sync_failed';
  title: string;
  message: string;
  isRead: boolean;
  affectedListingId?: string;
}

export interface AffectedListingImpact {
  listingId: string;
  title: string;
  oldShippingDecision: string;
  newRestrictionReason: string;
  requiredCorrectionAction: string;
  sellerConfirmed: boolean;
}

export interface PreActionVerificationResult {
  canProceed: boolean;
  isStaleRuleDetected: boolean;
  japaneseErrorMessage?: string;
  blockingReasons: string[];
  warnings: string[];
}
