/**
 * Data Models & Types for Formal Photo Evidence Vault Persistence & Disaster Recovery (JTH-STEP 47)
 *
 * Defines:
 * 1. Architecture candidate comparisons (Candidates A, B, C, D)
 * 2. 5-Phase Durability Protocol (Validation -> Staging/fsync -> Read-back SHA-256 -> Atomic Commit -> UI ACK)
 * 3. Comprehensive Failure Matrix (disk full, conflict, checksum corruption, OS crash, power loss, network fault)
 * 4. TOCTOU & Windows filesystem defense (reparse points, exclusive locks, atomic renaming)
 * 5. Immutable backup specifications, quarantine handling, and verified restore policies
 * 6. Gatekeeper parameters transitioning transient IndexedDB drafts to permanent Evidence Vault records
 */

import type { PhotoAngle, PhotoCaptureTargetContext } from './photoCapture';
import type { PhotoDraftRecord } from './photoDraft';
import type {
  PhotoEvidenceVaultRecord,
  EvidencePersistenceStatus,
  IntegrityCheckResult
} from './photoEvidenceVault';

/**
 * Storage Architecture Candidates
 */
export type StorageArchitectureType =
  | 'CANDIDATE_A_WINDOWS_APP_LOCAL'                    // %LOCALAPPDATA% directory storage
  | 'CANDIDATE_B_LOCAL_FS_SQLITE'                      // Local raw files + SQLite manifest DB
  | 'CANDIDATE_C_BACKEND_VAULT_ONLY'                   // Pure backend centralized WORM vault
  | 'CANDIDATE_D_HYBRID_LOCAL_CACHE_REMOTE_VAULT';     // Local draft buffer + Independent Central Formal Vault [RECOMMENDED]

export interface StorageArchitectureComparison {
  candidate: StorageArchitectureType;
  labelJa: string;
  costScore: number;                // 1 (Highest cost) - 5 (Lowest cost)
  safetyScore: number;              // 1 (Lowest safety) - 5 (Highest safety)
  operationalBurdenScore: number;   // 1 (Heavy burden) - 5 (Minimal burden)
  recoverabilityScore: number;      // 1 (Poor recovery) - 5 (Seamless recovery)
  fitForCurrentWebSpa: boolean;
  recommendation: 'RECOMMENDED' | 'DEFERRED' | 'REJECTED';
  prosJa: string[];
  consJa: string[];
  rationaleJa: string;
}

/**
 * 5-Phase Durability Protocol
 */
export type FormalPersistenceDurabilityPhase =
  | 'PHASE_1_PRE_COMMIT_VALIDATION'          // SKU/Unit confirmed, essential angles complete, quota check
  | 'PHASE_2_RAW_ASSET_STAGING_FSYNC'        // Write raw files to staging, call physical fsync flush
  | 'PHASE_3_CRYPTOGRAPHIC_READBACK_VERIFY'  // Read back from storage, recompute SHA-256, match bit-for-bit
  | 'PHASE_4_ATOMIC_COMMIT_GENERATION_LINK'  // Atomic rename to vault, preserve older v1 generation
  | 'PHASE_5_AUDIT_TRAIL_UI_ACK';            // Record tamper-evident audit log, only now report SUCCESS to UI

/**
 * Failure Matrix Scenarios
 */
export type FailureMatrixCategory =
  | 'CAPACITY'
  | 'CONCURRENCY'
  | 'INTEGRITY'
  | 'HARDWARE'
  | 'NETWORK'
  | 'OS_CRASH'
  | 'SECURITY';

export interface FailureMatrixScenario {
  id: string;
  nameJa: string;
  category: FailureMatrixCategory;
  triggerCondition: string;
  detectionMechanism: string;
  systemBehavior: string;
  resultingStatus: EvidencePersistenceStatus;
  recoveryProtocolJa: string;
}

/**
 * Formal Promotion Gate Parameters (IndexedDB Draft -> Formal Evidence Vault)
 */
export interface FormalPersistencePromotionGateParams {
  sourceDraft: PhotoDraftRecord;
  targetContext: PhotoCaptureTargetContext;
  operatorApproval: boolean;
  operatorId: string;
  operatorRole?: string;
  overrideNotes?: string;
  dryRunOnly?: boolean;
}

/**
 * Gate Evaluation Result
 */
export interface FormalPersistenceGateResult {
  success: boolean;
  status: EvidencePersistenceStatus;
  completedPhase: FormalPersistenceDurabilityPhase;
  vaultRecord?: PhotoEvidenceVaultRecord;
  retainedPredecessorVersion?: number | null;
  auditTrailId?: string;
  failureScenario?: FailureMatrixScenario;
  messageJa: string;
  error?: string;
  quarantinedFiles?: string[];
}

/**
 * Independent Backup Specification
 */
export interface FormalVaultBackupSpec {
  backupId: string;
  sourceVaultRecordId: string;
  targetDomain: 'INDEPENDENT_COLD_STORAGE' | 'SECONDARY_PHYSICAL_VOLUME' | 'REMOTE_OBJECT_LOCK';
  createdAt: string;
  rawAssetCount: number;
  totalBytes: number;
  manifestSha256: string;
  isEncrypted: boolean;
  encryptionAlgorithm: 'AES-256-GCM' | 'NONE_TEST';
  isWormLocked: boolean; // Write Once Read Many
  retentionExpirationDate: string;
}

/**
 * Verified Backup Restoration Audit Report
 */
export interface BackupVerificationReport {
  backupId: string;
  verifiedAt: string;
  isReadable: boolean;
  isRestorableToIsolatedTarget: boolean;
  checksumMatchCount: number;
  checksumMismatchCount: number;
  targetSkuVerified: boolean;
  targetUnitIdVerified: boolean;
  overallIntegrityValid: boolean;
  quarantinedFiles: string[];
  messageJa: string;
}

/**
 * Unconfirmed Quantitative Sizing Assumptions
 */
export interface QuantitativeSizingAssumptions {
  dailyInspectionUnitsAssumption: number;     // e.g. 50 - 200 units/day
  photosPerUnitAssumption: number;             // 7 angles
  rawPhotoAvgByteSizeMb: number;              // ~3.5 MB uncompressed raw
  dailyStorageGrowthGb: number;                // ~1.2 - 4.9 GB/day
  hotCacheRetentionDays: number;               // 180 days on local inspection machine
  formalVaultRetentionYears: number;           // 7 years legal/tax/marketplace dispute retention
  rtoMinutesTarget: number;                    // < 15 min for local reboot, < 120 min for disaster recovery
  rpoHoursTarget: number;                      // 0 hours for committed records (zero data loss)
  userDecisionsRequired: string[];
}
