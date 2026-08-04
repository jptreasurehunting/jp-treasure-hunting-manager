import { EbayFulfillmentPolicy, EbayReturnPolicy } from '../types/safetyGate';

export interface DescriptionTemplateConfig {
  itemConditionText: string;
  includedContentsText: string;
  authenticityStatement: string;
  shippingWording: string;
  customsDdpWording: string;
  returnPolicyWording: string;
  buyerNoteText: string;
}

export function generateEbayDescriptionHtml(config: DescriptionTemplateConfig): string {
  return `
<div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; color: #333;">
  <h2 style="color: #0053a0; border-bottom: 2px solid #0053a0; padding-bottom: 8px;">Item Description & Condition</h2>
  <p>${config.itemConditionText || 'Item is in excellent vintage condition as shown in photographs.'}</p>

  <h3 style="color: #333;">Included Accessories</h3>
  <p>${config.includedContentsText || 'All items shown in photographs are included.'}</p>

  <h2 style="color: #0053a0; border-bottom: 2px solid #0053a0; padding-bottom: 8px; margin-top: 24px;">Authenticity & Quality Guarantee</h2>
  <p>${config.authenticityStatement || 'All items are carefully inspected and verified by our Japan-based inventory team.'}</p>

  <h2 style="color: #0053a0; border-bottom: 2px solid #0053a0; padding-bottom: 8px; margin-top: 24px;">Shipping & Tracking</h2>
  <p>${config.shippingWording || 'Shipped directly from Japan with full tracking number provided upon dispatch.'}</p>

  <h2 style="color: #0053a0; border-bottom: 2px solid #0053a0; padding-bottom: 8px; margin-top: 24px;">Customs & Import Duties</h2>
  <p>${config.customsDdpWording || 'Import duties, taxes, and charges are not included in the item price or shipping cost unless specified otherwise.'}</p>

  <h2 style="color: #0053a0; border-bottom: 2px solid #0053a0; padding-bottom: 8px; margin-top: 24px;">Return Policy</h2>
  <p>${config.returnPolicyWording || 'Returns accepted within 30 days of delivery in accordance with eBay policy.'}</p>

  <div style="margin-top: 30px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #0053a0; font-size: 13px;">
    <strong>Customer Note:</strong> ${config.buyerNoteText || "Bringing Japan's treasures to collectors worldwide since 2024. Thank you for visiting Japan Treasure Hunting!"}
  </div>
</div>
  `.trim();
}

export function validateDescriptionTextPolicyConsistency(
  htmlText: string,
  fulfillmentPol?: EbayFulfillmentPolicy,
  returnPol?: EbayReturnPolicy,
  isDdpConfigured?: boolean,
  isAuthenticityVerified?: boolean
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  const textUpper = htmlText.toUpperCase();

  // 1. External URL Check
  if (textUpper.includes('HTTP://') || textUpper.includes('HTTPS://') || textUpper.includes('WWW.')) {
    errors.push('商品説明内に外部URL (External URL) を含めることはeBayポリシーにより禁止されています。');
  }

  // 2. Fixed Restocking Fee Check
  if (textUpper.includes('RESTOCKING FEE') || textUpper.includes('CANCELLATION FEE') || textUpper.includes('キャンセル料')) {
    errors.push('商品説明内に固定キャンセル料・リストッキングフィー (Restocking Fee) を明記することは禁止されています。');
  }

  // 3. 100% Authentic Claim Check
  if (textUpper.includes('100% AUTHENTIC') || textUpper.includes('100% 本物')) {
    if (!isAuthenticityVerified) {
      errors.push('個別の真贋検証証拠 (Authenticity Verified) が完了していない状態で「100% Authentic」等の表記を行うことは禁止されています。');
    }
  }

  // 4. DDP Misleading Wording Check
  if (textUpper.includes('DUTIES PAID') || textUpper.includes('DDP') || textUpper.includes('関税込み')) {
    if (!isDdpConfigured && (!fulfillmentPol || !fulfillmentPol.isDdp)) {
      errors.push('実際の配送設定が DDU (関税未払い) にもかかわらず商品説明に「DDP / 関税込み」の表記を行うことは不当表示違反です。');
    }
  }

  // 5. Return Policy Wording Consistency Check
  if (textUpper.includes('NO RETURNS') || textUpper.includes('返品不可')) {
    if (returnPol && returnPol.returnsAccepted) {
      errors.push('ビジネスポリシーが「30日返品受付」に設定されているにもかかわらず、商品説明文に「返品不可 (No Returns)」と書かれています。');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
