import {
  GateDecision,
  ProtectedAction,
  SafetyGateResult,
  InventoryItemRecord,
  AccountHealthRecord,
  ProductComplianceProfile
} from '../types/safetyGate';
import { CountryComplianceRecord } from '../types/zonosCustoms';
import { validateGermanyCompliance, checkExpiryWarning } from './countryComplianceService';
import { checkStocktakeValidity } from './safetyInventoryService';

export const ACTION_NAME_MAP: Record<ProtectedAction, string> = {
  CREATE_LISTING: '1. 新規出品作成',
  REVISE_LISTING: '2. 出品内容更新',
  INCREASE_QUANTITY: '3. 出品数量増加',
  ENABLE_DESTINATION_COUNTRY: '4. 配送対象国の許可',
  ADD_DESTINATION_SHIPPING: '5. 国別個別送料の設定追加',
  MOVE_LISTING: '6. アカウント間リスティング移動 (Move Listing)',
  CONFIRM_IMPORTED_ORDER: '7. eBay受注データの確認確定',
  CREATE_SHIPPING_RECORD: '8. Shipping Record 作成',
  START_ZONOS_TRANSFER: '9. Zonos Prepay 転記支援開始',
  CONFIRM_SHIPMENT_PREP: '10. 出荷準備確定',
  MARK_ORDER_SHIPPED: '11. 発送完了処理 (Mark as Shipped)'
};

export interface SafetyGateEvaluationParams {
  action: ProtectedAction;
  targetCountryCode?: string;
  targetAccountId?: string;
  inventoryItem?: InventoryItemRecord | null;
  accountHealth?: AccountHealthRecord | null;
  countryRecord?: CountryComplianceRecord | null;
  productProfile?: ProductComplianceProfile | null;
  packageWeightGrams?: number;
  isPhysicalItemConfirmed?: boolean;
}

/**
 * Reusable Central Safety & Compliance Gate Evaluator (Spec #1 & Spec #2)
 */
export function evaluateSafetyGate(params: SafetyGateEvaluationParams): SafetyGateResult {
  const {
    action,
    targetCountryCode,
    inventoryItem,
    accountHealth,
    countryRecord,
    productProfile,
    packageWeightGrams,
    isPhysicalItemConfirmed
  } = params;

  const actionNameJa = ACTION_NAME_MAP[action] || action;
  const reasons: string[] = [];
  const missingRequirements: string[] = [];
  const requiredUserSteps: string[] = [];
  let isBypassBlocked = false;
  let hasWarnings = false;

  // 1. Account Health Check (Spec #17)
  if (accountHealth) {
    if (accountHealth.sellingRestrictionStatus === 'Restricted' || accountHealth.sellingRestrictionStatus === 'Suspended') {
      reasons.push(`対象アカウント [${accountHealth.displayName}] にポリシー制限(${accountHealth.sellingRestrictionStatus})が適用されています。`);
      missingRequirements.push('アカウント制限解除または別正常アカウントの利用');
      requiredUserSteps.push('eBay Seller Hubで制限解除手続きを行うか、アカウント管理画面で健全なアカウントを選択してください。');
      isBypassBlocked = true;
    }
  }

  // 2. Physical Inventory Status & Stocktake Verification Check (Spec #3, #4, #6)
  if (inventoryItem) {
    const stockValidity = checkStocktakeValidity(inventoryItem);

    if (inventoryItem.verificationStatus === 'Unknown') {
      reasons.push(`商品 [${inventoryItem.sku}] の手元実在庫ステータスが「不明 (Unknown)」です。`);
      missingRequirements.push('手元現物の実在庫カウントおよび棚卸し入力');
      requiredUserSteps.push('「実在庫管理」画面にて手元現物を目視確認し、棚卸し数量を入力してください。');
    } else if (inventoryItem.verificationStatus === 'Inventory Mismatch') {
      reasons.push(`商品 [${inventoryItem.sku}] の在庫状態が「在庫不一致 (Inventory Mismatch)」です。`);
      missingRequirements.push('実在庫数と出品割当数の不一致修正');
      requiredUserSteps.push('実在庫調整画面で正しい実数修正を行い、不一致状態を解消してください。');
    } else if (stockValidity.isExpired) {
      hasWarnings = true;
      reasons.push(`商品 [${inventoryItem.sku}] の最終棚卸しから ${stockValidity.daysSinceStocktake} 日が経過しています (有効期限30日超過)。`);
      missingRequirements.push('実在庫の再確認 (Recheck Required)');
      requiredUserSteps.push('「実在庫管理」画面で直近の現物在庫を再確認してください。');

      // Block risky actions when stocktake is expired
      if (action === 'CREATE_LISTING' || action === 'INCREASE_QUANTITY' || action === 'MOVE_LISTING') {
        missingRequirements.push('棚卸し期限切れのため危険操作ブロック');
      }
    }

    // Allocation Cap Rule (Spec #4)
    if (inventoryItem.availableQuantity <= 0 && (action === 'CREATE_LISTING' || action === 'INCREASE_QUANTITY')) {
      reasons.push(`商品 [${inventoryItem.sku}] の有効実在庫(Available Quantity)が 0 個です。`);
      missingRequirements.push('発送可能実在庫の確保');
      requiredUserSteps.push('実在庫が入荷するまで出品または数量増加はできません。');
    }
  }

  // 3. Country Compliance & Packaging Law Check (Germany, France, EU/EEA) (Spec #9, #10, #11, #12)
  if (targetCountryCode && countryRecord) {
    if (!countryRecord.isSalesEnabled) {
      reasons.push(`配送対象国 [${countryRecord.countryName}] の販売許可が無効化(Disabled)されています。`);
      missingRequirements.push('国別販売コンプライアンスの登録およびユーザー確認完了');
      requiredUserSteps.push('「国別コンプライアンス管理」画面で必要な登録・契約情報を入力し、確認完了にしてください。');
    }

    if (targetCountryCode === 'DE') {
      const germanyVal = validateGermanyCompliance(countryRecord);
      if (!germanyVal.isValid) {
        reasons.push('ドイツ向け販売・発送には包装法(LUCID)等への対応確認が必要です。必要な登録・契約情報が確認できません。');
        germanyVal.errors.forEach((err) => missingRequirements.push(err));
        requiredUserSteps.push('LUCID登録番号、包装事業者名、契約参照番号を入力し、目視確認チェックを入れてください。');
      }
    }

    if (targetCountryCode === 'FR' && !countryRecord.evidenceConfirmedByUser) {
      reasons.push('フランス向け販売・発送にはEPR(IDU番号)および環境規制の対応確認が必要です。');
      missingRequirements.push('フランスEPR登録カテゴリおよびIDU番号の確認');
      requiredUserSteps.push('フランスEPR情報を確認し、目視確認チェックを入れてください。');
    }

    const expiry = checkExpiryWarning(countryRecord.validUntilDate);
    if (expiry.isExpired) {
      reasons.push(`国 [${countryRecord.countryName}] のコンプライアンス登録有効期限が切れています。`);
      missingRequirements.push('更新後の有効期限日および登録情報の更新');
      requiredUserSteps.push('更新された契約期間を入力し直してください。');
    } else if (expiry.warningMessage) {
      hasWarnings = true;
      reasons.push(expiry.warningMessage);
    }
  }

  // 4. Shipping Eligibility & Mandatory Physical Item Check (Spec #14)
  if (action === 'CONFIRM_SHIPMENT_PREP' || action === 'MARK_ORDER_SHIPPED') {
    if (isPhysicalItemConfirmed !== true) {
      reasons.push('発送前の必須確認項目「発送する現物を手元で確認しました」のチェックが入っていません。');
      missingRequirements.push('現物手元確認の必須チェック');
      requiredUserSteps.push('出荷準備画面にて、発送する現物を目視確認のうえチェックを入れてください。');
    }

    if (packageWeightGrams !== undefined && packageWeightGrams <= 0) {
      reasons.push('梱包後の実重量 (Package Weight) が入力されていません。');
      missingRequirements.push('梱包重量の正数値入力');
      requiredUserSteps.push('梱包後の正確な重量(g)を入力してください。');
    }

    if (productProfile && productProfile.isDangerousGoods) {
      hasWarnings = true;
      reasons.push('危険物/リチウム電池該当品です。航空輸送ラベルおよびキャリアの配送制限を確認してください。');
    }
  }

  // Decision Determination
  const hasBlockers = reasons.some(
    (r) =>
      r.includes('不可') ||
      r.includes('ブロック') ||
      r.includes('必要です') ||
      r.includes('切れています') ||
      r.includes('入っていません') ||
      r.includes('0 個') ||
      r.includes('適用されています')
  ) || missingRequirements.length > 0;

  let decision: GateDecision = 'ALLOWED';
  if (hasBlockers) {
    decision = 'BLOCKED';
  } else if (hasWarnings) {
    decision = 'ALLOWED_WITH_WARNING';
  }

  return {
    decision,
    action,
    actionNameJa,
    reasons,
    missingRequirements,
    requiredUserSteps,
    resolutionLink: '/compliance-dashboard',
    isBypassBlocked
  };
}
