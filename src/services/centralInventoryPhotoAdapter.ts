/**
 * Central Inventory & Photo Capture Safe Test Integration Adapter
 * Provides a safe, isolated boundary between Photo Capture QA Gates and Central Inventory.
 *
 * Safety Guarantees:
 * 1. NEVER writes to production inventory DB or external services.
 * 2. Operates strictly on detached snapshots and in-memory mock datasets.
 * 3. Enforces SKU and inventoryUnitId equality with confirmed context.
 * 4. Only updates photoCaptureComplete and photoQaComplete; strictly preserves all non-photo gates.
 * 5. Provides Dry Run preview comparing before/after states with explicit reason codes.
 * 6. Guarantees idempotent safe re-execution on the same unit.
 */

import type { InventoryUnit, CentralInventoryItem, SellableInventoryGate } from '../types/centralInventory';
import type {
  PhotoAngle,
  CapturedPhoto,
  PhotoCaptureTargetContext,
  PhotoGateSyncReasonCode,
  PhotoGateDryRunPreview
} from '../types/photoCapture';
import { loadInventoryUnits, loadCentralInventory } from './centralInventoryService';
import { checkPhotoGateCompletion, updateInventoryUnitPhotoGate } from './photoCaptureService';

export interface CentralInventoryPhotoAdapterOptions {
  /**
   * Custom units to read from (for isolated tests).
   * If omitted, reads clones from centralInventoryService (loadInventoryUnits).
   */
  customUnits?: InventoryUnit[];
  /**
   * In-memory units alias for test isolation.
   */
  inMemoryUnits?: InventoryUnit[];
  /**
   * Custom central items to read from.
   * If omitted, reads clones from centralInventoryService (loadCentralInventory).
   */
  customItems?: CentralInventoryItem[];
  /**
   * Pre-registered unit IDs for duplicate conflict prevention.
   */
  existingRegisteredUnitIds?: string[];
  /**
   * Enforce dry run mode. Strictly defaults to true for safety.
   */
  dryRunOnly?: boolean;
}

export class CentralInventoryPhotoAdapter {
  private customUnits?: Map<string, InventoryUnit>;
  private customItems?: Map<string, CentralInventoryItem>;
  private existingRegisteredUnitIds: Set<string>;
  public readonly dryRunOnly: boolean;

  constructor(options: CentralInventoryPhotoAdapterOptions = {}) {
    this.dryRunOnly = options.dryRunOnly ?? true;
    this.existingRegisteredUnitIds = new Set(options.existingRegisteredUnitIds || []);

    const sourceUnits = options.customUnits || options.inMemoryUnits;
    if (sourceUnits) {
      this.customUnits = new Map();
      sourceUnits.forEach((u) => {
        this.customUnits!.set(u.inventoryUnitId, this.cloneUnit(u));
      });
    }

    if (options.customItems) {
      this.customItems = new Map();
      options.customItems.forEach((item) => {
        this.customItems!.set(item.sku, this.cloneItem(item));
      });
    }
  }

  private cloneUnit(unit: InventoryUnit): InventoryUnit {
    return {
      ...unit,
      sellableGate: { ...unit.sellableGate }
    };
  }

  private cloneItem(item: CentralInventoryItem): CentralInventoryItem {
    return {
      ...item,
      dimensionsCm: { ...item.dimensionsCm },
      channelBindings: item.channelBindings.map((b) => ({ ...b }))
    };
  }

  /**
   * Safe read of an InventoryUnit (always returns an isolated clone)
   */
  public getUnitSnapshot(inventoryUnitId: string): InventoryUnit | null {
    if (this.customUnits) {
      const u = this.customUnits.get(inventoryUnitId);
      return u ? this.cloneUnit(u) : null;
    }
    try {
      const units = loadInventoryUnits();
      const found = units.find((candidate) => candidate.inventoryUnitId === inventoryUnitId);
      return found ? this.cloneUnit(found) : null;
    } catch {
      return null;
    }
  }

  /**
   * Safe read of CentralInventoryItem (always returns an isolated clone)
   */
  public getItemSnapshot(sku: string): CentralInventoryItem | null {
    if (this.customItems) {
      const item = this.customItems.get(sku);
      return item ? this.cloneItem(item) : null;
    }
    try {
      const items = loadCentralInventory();
      const found = items.find((candidate) => candidate.sku === sku);
      return found ? this.cloneItem(found) : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate Dry Run Preview comparing before and after states.
   * Guarantees ZERO write / side-effect to persistent storage.
   */
  public generateDryRunPreview(
    targetContext: PhotoCaptureTargetContext,
    capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>
  ): PhotoGateDryRunPreview {
    // Check evidence preservation
    let evidencePreserved = true;
    let photoCount = 0;
    Object.values(capturedPhotos).forEach((p) => {
      if (p) {
        photoCount++;
        if (p.autoFixCount && p.autoFixCount > 0 && !p.originalDataUrl) {
          evidencePreserved = false;
        }
      }
    });

    // 1. Target Context confirmation & completeness check
    if (!targetContext || !targetContext.isConfirmed || !targetContext.sku?.trim() || !targetContext.inventoryUnitId?.trim()) {
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_UNCONFIRMED_CONTEXT',
        reasonMessageJa: '紐付け保留 (HOLD): 商品カタログ番号(SKU)または実物個体管理番号(Unit ID)が未確定です。架空ID保存防止のため保留しています。',
        before: null,
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    const unitId = targetContext.inventoryUnitId.trim();
    const sku = targetContext.sku.trim();

    // 2. Duplicate registration conflict check
    if (this.existingRegisteredUnitIds.has(unitId)) {
      const unit = this.getUnitSnapshot(unitId);
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_ALREADY_REGISTERED_CONFLICT',
        reasonMessageJa: `二重登録・競合防止 (HOLD): 実物個体管理番号 (${unitId}) は既に登録済みリストに存在します。上書きを防止しました。`,
        before: unit ? this.createSnapshotRecord(unit) : null,
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    // 3. Unit existence check
    const unit = this.getUnitSnapshot(unitId);
    if (!unit) {
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_UNIT_NOT_FOUND',
        reasonMessageJa: `個体未検出 (HOLD): 在庫管理サービス上に実物個体管理番号 (${unitId}) が存在しません。`,
        before: null,
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    // 4. SKU mismatch check
    if (unit.sku !== sku) {
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_SKU_MISMATCH',
        reasonMessageJa: `SKU不一致 (HOLD): 在庫個体のSKU (${unit.sku}) と撮影指定SKU (${sku}) が一致しません。誤紐付けを防止しました。`,
        before: this.createSnapshotRecord(unit),
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    // 5. Photo gate check
    const gateCheck = checkPhotoGateCompletion(capturedPhotos);
    if (gateCheck.missingRequiredAngles.length > 0) {
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_INCOMPLETE_ANGLES',
        reasonMessageJa: `撮影不足 (HOLD): 必須4アングルのうち未撮影のアングルが存在します (${gateCheck.missingRequiredAngles.join(', ')})。`,
        before: this.createSnapshotRecord(unit),
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    const hasRetake = Object.values(capturedPhotos).some((p) => p && p.qaResult.status === 'RETAKE');
    if (hasRetake) {
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_QA_RETAKE_REQUIRED',
        reasonMessageJa: '画質エラー (HOLD): 撮影写真に再撮影(RETAKE)判定が含まれています。問題を解消して再撮影してください。',
        before: this.createSnapshotRecord(unit),
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    const hasPendingAutoFix = Object.values(capturedPhotos).some((p) => p && p.qaResult.status === 'AUTO_FIX');
    if (hasPendingAutoFix) {
      return {
        isDryRun: true,
        canApply: false,
        reasonCode: 'HOLD_AUTO_FIX_PENDING',
        reasonMessageJa: '補正未完了 (HOLD): AUTO_FIX 判定の写真が未補正のまま残っています。自動補正を適用して再評価してください。',
        before: this.createSnapshotRecord(unit),
        after: null,
        gateDiff: null,
        evidencePreserved,
        capturedPhotosCount: photoCount
      };
    }

    // 6. Idempotency evaluation
    const isAlreadyCompleted = unit.sellableGate.photoCaptureComplete && unit.sellableGate.photoQaComplete;
    const reasonCode: PhotoGateSyncReasonCode = isAlreadyCompleted
      ? 'IDEMPOTENT_ALREADY_COMPLETED'
      : 'SUCCESS_EVALUATED';

    const reasonMessageJa = isAlreadyCompleted
      ? `同一個体 (${unitId}) の写真撮影ゲートは既に合格状態です（冪等プレビュー）。`
      : `✅ 実物個体 (${unitId}) の必須4アングルQA合格を確認しました。写真ゲートを安全に更新可能です。`;

    // Construct dry run snapshot
    const beforeSnap = this.createSnapshotRecord(unit);
    const afterSnap = this.createSnapshotRecord({
      ...unit,
      sellableGate: {
        ...unit.sellableGate,
        photoCaptureComplete: true,
        photoQaComplete: true
      }
    });

    const gateDiff = {
      photoCaptureComplete: {
        before: unit.sellableGate.photoCaptureComplete,
        after: true
      },
      photoQaComplete: {
        before: unit.sellableGate.photoQaComplete,
        after: true
      },
      identityVerified: {
        before: unit.sellableGate.identityVerified,
        after: unit.sellableGate.identityVerified,
        changed: false
      },
      quantityVerified: {
        before: unit.sellableGate.quantityVerified,
        after: unit.sellableGate.quantityVerified,
        changed: false
      },
      conditionVerified: {
        before: unit.sellableGate.conditionVerified,
        after: unit.sellableGate.conditionVerified,
        changed: false
      },
      storageLocationRegistered: {
        before: unit.sellableGate.storageLocationRegistered,
        after: unit.sellableGate.storageLocationRegistered,
        changed: false
      },
      statusChanged: false,
      stockQuantitiesChanged: false,
      nonPhotoGatesUntouched: true
    };

    return {
      isDryRun: true,
      canApply: true,
      reasonCode,
      reasonMessageJa,
      before: beforeSnap,
      after: afterSnap,
      gateDiff,
      evidencePreserved,
      capturedPhotosCount: photoCount
    };
  }

  /**
   * Execute safe integration on cloned / in-memory test dataset.
   * NEVER touches real database / localStorage by policy.
   */
  public executeSafeIntegration(
    targetContext: PhotoCaptureTargetContext,
    capturedPhotos: Record<PhotoAngle, CapturedPhoto | null>
  ): {
    success: boolean;
    preview: PhotoGateDryRunPreview;
    committedUnit?: InventoryUnit;
    messageJa: string;
  } {
    const preview = this.generateDryRunPreview(targetContext, capturedPhotos);
    if (!preview.canApply || !preview.after) {
      return {
        success: false,
        preview,
        messageJa: preview.reasonMessageJa
      };
    }

    const unitId = targetContext.inventoryUnitId!.trim();
    const existing = this.getUnitSnapshot(unitId);
    if (!existing) {
      return {
        success: false,
        preview,
        messageJa: `個体 (${unitId}) が見つかりません。`
      };
    }

    const updated = updateInventoryUnitPhotoGate(existing, targetContext, capturedPhotos);
    if (!updated.success || !updated.unit) {
      return {
        success: false,
        preview,
        messageJa: updated.messageJa
      };
    }

    // Save to in-memory customUnits map if custom units are used
    if (this.customUnits) {
      this.customUnits.set(unitId, this.cloneUnit(updated.unit));
    }

    return {
      success: true,
      preview,
      committedUnit: this.cloneUnit(updated.unit),
      messageJa: updated.messageJa
    };
  }

  private createSnapshotRecord(unit: InventoryUnit) {
    const item = this.getItemSnapshot(unit.sku);
    return {
      inventoryUnitId: unit.inventoryUnitId,
      sku: unit.sku,
      status: unit.status,
      sellableGate: { ...unit.sellableGate },
      physicalStock: item?.physicalStock,
      sellableStock: item?.sellableStock,
      availableToSell: item?.availableToSell
    };
  }
}
