/**
 * eBay 利益管理アプリ (MVP) - メインロジック
 * README.md の計算ロジックおよびロック/アンロック仕様に完全準拠
 */

// DOM 要素の取得
const elements = {
  // 入力フィールド
  productName: document.getElementById('productName'),
  category: document.getElementById('category'),
  sellingPrice: document.getElementById('sellingPrice'),
  purchaseCost: document.getElementById('purchaseCost'),
  shippingCost: document.getElementById('shippingCost'),
  otherExpenses: document.getElementById('otherExpenses'),
  
  // 設定入力フィールド (初期値: 手数料20%, 分母3, 関税率20%)
  ebayFeeRate: document.getElementById('ebayFeeRate'),
  tariffDenominator: document.getElementById('tariffDenominator'),
  tariffRate: document.getElementById('tariffRate'),
  
  // ロック制御ボタン & カード
  toggleLockButton: document.getElementById('toggleLockButton'),
  lockIcon: document.getElementById('lockIcon'),
  lockText: document.getElementById('lockText'),
  settingsCard: document.getElementById('settingsCard'),
  lockNotice: document.getElementById('lockNotice'),
  
  // 表示エレメント (予想利益 & 内訳)
  profitDisplay: document.getElementById('profitDisplay'),
  marginBadge: document.getElementById('marginBadge'),
  valSellingPrice: document.getElementById('valSellingPrice'),
  valEbayFee: document.getElementById('valEbayFee'),
  subEbayFee: document.getElementById('subEbayFee'),
  valTariff: document.getElementById('valTariff'),
  subTariff: document.getElementById('subTariff'),
  valPurchase: document.getElementById('valPurchase'),
  valShipping: document.getElementById('valShipping'),
  valOther: document.getElementById('valOther'),
  valTotalCosts: document.getElementById('valTotalCosts')
};

// ロック状態フラグ (初期状態: true = ロック中)
let isLocked = true;

/**
 * 数値をドルフォーマット文字列に変換 ($1,234.56)
 */
function formatCurrency(amount) {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isNegative ? `-$${absVal}` : `$${absVal}`;
}

/**
 * 入力値を取得（空文字や不正な値の場合は 0 または安全な数値を返す）
 */
function getNumericValue(element, fallback = 0) {
  if (!element) return fallback;
  const val = parseFloat(element.value);
  return isNaN(val) ? fallback : val;
}

/**
 * 予想利益および各種内訳のリアルタイム計算ロジック (README.md 3項に完全準拠)
 */
function calculateProfit() {
  // 1. 各種入力値の取得
  const sellingPrice = Math.max(0, getNumericValue(elements.sellingPrice, 0));
  const purchaseCost = Math.max(0, getNumericValue(elements.purchaseCost, 0));
  const shippingCost = Math.max(0, getNumericValue(elements.shippingCost, 0));
  const otherExpenses = Math.max(0, getNumericValue(elements.otherExpenses, 0));

  // 2. 設定値の取得 (デフォルト: 手数料20%, 分母3, 関税20%)
  const ebayFeeRatePercent = Math.max(0, getNumericValue(elements.ebayFeeRate, 20));
  const tariffDenominator = Math.max(0.0001, getNumericValue(elements.tariffDenominator, 3));
  const tariffRatePercent = Math.max(0, getNumericValue(elements.tariffRate, 20));

  // 3. ロジックに基づく計算
  // 3.1 関税額 = (販売価格 / 関税分母) * (関税率 / 100)
  const tariffAmount = (sellingPrice / tariffDenominator) * (tariffRatePercent / 100);

  // 3.2 eBay手数料額 = 販売価格 * (eBay手数料率 / 100)
  const ebayFeeAmount = sellingPrice * (ebayFeeRatePercent / 100);

  // 3.3 コスト・経費の総額 (販売価格を除く費用合計)
  const totalExpenses = ebayFeeAmount + tariffAmount + purchaseCost + shippingCost + otherExpenses;

  // 3.4 予想利益 = 販売価格 - (eBay手数料 + 関税 + 仕入 + 送料 + その他経費)
  const estimatedProfit = sellingPrice - totalExpenses;

  // 3.5 利益率 (%) = (予想利益 / 販売価格) * 100
  const marginPercent = sellingPrice > 0 ? (estimatedProfit / sellingPrice) * 100 : 0;

  // 4. UI への結果反映
  updateUIResult({
    sellingPrice,
    purchaseCost,
    shippingCost,
    otherExpenses,
    ebayFeeRatePercent,
    ebayFeeAmount,
    tariffDenominator,
    tariffRatePercent,
    tariffAmount,
    totalExpenses,
    estimatedProfit,
    marginPercent
  });
}

/**
 * 計算結果をDOM要素に描画
 */
function updateUIResult(data) {
  // 予想利益メイン表示
  elements.profitDisplay.textContent = formatCurrency(data.estimatedProfit);

  // クラスの付け替え (ポジティブ / ネガティブ / ゼロ)
  elements.profitDisplay.className = 'profit-amount-display';
  elements.marginBadge.className = 'margin-badge';

  if (data.estimatedProfit > 0) {
    elements.profitDisplay.classList.add('profit-positive');
    elements.marginBadge.classList.add('margin-positive');
    elements.marginBadge.textContent = `利益率 +${data.marginPercent.toFixed(1)}%`;
  } else if (data.estimatedProfit < 0) {
    elements.profitDisplay.classList.add('profit-negative');
    elements.marginBadge.classList.add('margin-negative');
    elements.marginBadge.textContent = `赤字 ${data.marginPercent.toFixed(1)}%`;
  } else {
    elements.profitDisplay.classList.add('profit-zero');
    elements.marginBadge.classList.add('margin-zero');
    elements.marginBadge.textContent = `利益率 0.0%`;
  }

  // 内訳項目の更新
  elements.valSellingPrice.textContent = formatCurrency(data.sellingPrice);
  elements.valEbayFee.textContent = `-${formatCurrency(data.ebayFeeAmount)}`;
  elements.subEbayFee.textContent = `(${data.ebayFeeRatePercent.toFixed(1)}%)`;

  elements.valTariff.textContent = `-${formatCurrency(data.tariffAmount)}`;
  elements.subTariff.textContent = `(価格/${data.tariffDenominator} × ${data.tariffRatePercent.toFixed(1)}%)`;

  elements.valPurchase.textContent = `-${formatCurrency(data.purchaseCost)}`;
  elements.valShipping.textContent = `-${formatCurrency(data.shippingCost)}`;
  elements.valOther.textContent = `-${formatCurrency(data.otherExpenses)}`;
  
  // コスト合計
  elements.valTotalCosts.textContent = formatCurrency(data.totalExpenses);
}

/**
 * ロック / アンロック 切替処理 (README.md 4項「操作・UI仕様」準拠)
 */
function toggleLockState() {
  isLocked = !isLocked;

  const settingsInputs = [elements.ebayFeeRate, elements.tariffDenominator, elements.tariffRate];

  if (isLocked) {
    // ロック状態へ移行
    settingsInputs.forEach(input => input.setAttribute('readonly', 'true'));
    elements.lockIcon.textContent = '🔒';
    elements.lockText.textContent = '固定中 (ロック)';
    elements.toggleLockButton.className = 'btn-lock locked';
    elements.settingsCard.classList.remove('editing-mode');
    elements.lockNotice.innerHTML = '<span>💡 誤操作防止のため設定値は固定されています。変更する場合は右上ボタンを押してください。</span>';
  } else {
    // 編集可能(アンロック)状態へ移行
    settingsInputs.forEach(input => input.removeAttribute('readonly'));
    elements.lockIcon.textContent = '🔓';
    elements.lockText.textContent = '編集可能 (アンロック)';
    elements.toggleLockButton.className = 'btn-lock unlocked';
    elements.settingsCard.classList.add('editing-mode');
    elements.lockNotice.innerHTML = '<span>✏️ 現在編集モードです。手数料率・関税分母・関税率を自由に変更できます。</span>';
    elements.ebayFeeRate.focus();
  }
}

/**
 * イベントリナーの初期登録
 */
function initEventListeners() {
  // すべての数値入力フィールドに input イベントをバインド (リアルタイム自動計算)
  const inputElements = [
    elements.sellingPrice,
    elements.purchaseCost,
    elements.shippingCost,
    elements.otherExpenses,
    elements.ebayFeeRate,
    elements.tariffDenominator,
    elements.tariffRate
  ];

  inputElements.forEach(input => {
    if (input) {
      input.addEventListener('input', calculateProfit);
    }
  });

  // ロック切替ボタン
  if (elements.toggleLockButton) {
    elements.toggleLockButton.addEventListener('click', toggleLockState);
  }
}

// アプリケーションの初期化
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  calculateProfit(); // 初回計算の実行
});
