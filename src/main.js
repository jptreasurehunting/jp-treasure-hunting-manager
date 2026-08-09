/**
 * eBay 利益管理アプリ (MVP) - メインロジック
 * 日本郵政・Zonos Prepay対応 & 完全手動承認確認モーダル 搭載
 */

// アプリ全体の状態オブジェクト (状態管理)
const state = {
  isLocked: true, // 設定項目のロック状態
  userModifiedZonosDeclaredPrice: false, // ユーザーがZonos申告額を手修正したか
  // eBay API から取得される売上・注文情報 (想定10項目)
  ebayOrder: {
    orderId: "14-12345-67890",
    itemId: "256123456789",
    title: "Canon AE-1 Program Vintage Camera",
    imageUrl: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=300&auto=format&fit=crop&q=80",
    quantity: 1,
    actualSellingPrice: 300.00,
    currency: "USD ($)",
    shippingCountry: "United States (US)",
    orderDate: "2026-07-28 15:30 (JST)",
    fulfillmentStatus: "Paid / Ready for Shipment"
  },
  // おまけ (ノベルティ) リスト
  bonusItems: [
    {
      id: "bonus-1",
      name: "Vintage Camera Strap",
      quantity: 1,
      unitPrice: 3.00,
      photoUrl: ""
    }
  ]
};

// DOM 要素の参照保持
const elements = {
  // 入力フィールド
  productName: document.getElementById('productName'),
  category: document.getElementById('category'),
  sellingPrice: document.getElementById('sellingPrice'),
  purchaseCost: document.getElementById('purchaseCost'),
  shippingCost: document.getElementById('shippingCost'),
  otherExpenses: document.getElementById('otherExpenses'),
  shippingMethod: document.getElementById('shippingMethod'),
  
  // eBay API 注文連動表示
  ebayOrderId: document.getElementById('ebayOrderId'),
  ebayItemId: document.getElementById('ebayItemId'),
  ebayQuantity: document.getElementById('ebayQuantity'),
  ebayActualSellingPrice: document.getElementById('ebayActualSellingPrice'),
  ebayCurrency: document.getElementById('ebayCurrency'),
  ebayShippingCountry: document.getElementById('ebayShippingCountry'),
  ebayOrderDate: document.getElementById('ebayOrderDate'),
  ebayFulfillmentStatus: document.getElementById('ebayFulfillmentStatus'),
  ebayProductImage: document.getElementById('ebayProductImage'),

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

  // Zonos カード & 要素
  zonosCard: document.getElementById('zonosCard'),
  zonosProductDeclaredPrice: document.getElementById('zonosProductDeclaredPrice'),
  addBonusItemBtn: document.getElementById('addBonusItemBtn'),
  bonusItemsContainer: document.getElementById('bonusItemsContainer'),
  valZonosProductDeclared: document.getElementById('valZonosProductDeclared'),
  valZonosBonusTotal: document.getElementById('valZonosBonusTotal'),
  valZonosGrandTotal: document.getElementById('valZonosGrandTotal'),
  copyZonosInfoBtn: document.getElementById('copyZonosInfoBtn'),
  openZonosBtn: document.getElementById('openZonosBtn'),
  copyNotification: document.getElementById('copyNotification'),

  // 予想利益 & 内訳表示
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
  valTotalCosts: document.getElementById('valTotalCosts'),

  // モーダルダイアログ要素 (最終確認画面 7項目)
  modalOverlay: document.getElementById('confirmModalOverlay'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  cancelActionBtn: document.getElementById('cancelActionBtn'),
  executeActionBtn: document.getElementById('executeActionBtn'),
  confirmCheckbox: document.getElementById('confirmCheckbox'),
  modalProductList: document.getElementById('modalProductList'),
  modalSellingPrice: document.getElementById('modalSellingPrice'),
  modalProductDeclaredPrice: document.getElementById('modalProductDeclaredPrice'),
  modalBonusItemsList: document.getElementById('modalBonusItemsList'),
  modalGrandTotal: document.getElementById('modalGrandTotal'),
  modalShippingMethod: document.getElementById('modalShippingMethod'),
  modalDestinationCountry: document.getElementById('modalDestinationCountry')
};

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
 * 入力値の数値取得（安全な数値変換）
 */
function getNumericValue(element, fallback = 0) {
  if (!element) return fallback;
  const val = parseFloat(element.value);
  return isNaN(val) ? fallback : val;
}

/**
 * 現在のタイムスタンプ生成 (YYYY-MM-DD HH:mm:ss)
 */
function getCurrentTimestamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * 予想利益・関税・手数料のリアルタイム計算ロジック
 */
function calculateProfit() {
  const sellingPrice = Math.max(0, getNumericValue(elements.sellingPrice, 0));
  const purchaseCost = Math.max(0, getNumericValue(elements.purchaseCost, 0));
  const shippingCost = Math.max(0, getNumericValue(elements.shippingCost, 0));
  const otherExpenses = Math.max(0, getNumericValue(elements.otherExpenses, 0));

  const ebayFeeRatePercent = Math.max(0, getNumericValue(elements.ebayFeeRate, 20));
  const tariffDenominator = Math.max(0.0001, getNumericValue(elements.tariffDenominator, 3));
  const tariffRatePercent = Math.max(0, getNumericValue(elements.tariffRate, 20));

  // 1. 関税額 = (販売価格 / 関税分母) * (関税率 / 100)
  const tariffAmount = (sellingPrice / tariffDenominator) * (tariffRatePercent / 100);

  // 2. eBay手数料額 = 販売価格 * (eBay手数料率 / 100)
  const ebayFeeAmount = sellingPrice * (ebayFeeRatePercent / 100);

  // 3. コスト・経費の総額
  const totalExpenses = ebayFeeAmount + tariffAmount + purchaseCost + shippingCost + otherExpenses;

  // 4. 予想利益 = 販売価格 - 費用合計
  const estimatedProfit = sellingPrice - totalExpenses;

  // 5. 利益率 (%)
  const marginPercent = sellingPrice > 0 ? (estimatedProfit / sellingPrice) * 100 : 0;

  // 6. 日本郵政 海外便選択時の Zonos 申告候補額 (販売価格 ÷ 3) 自動計算
  if (!state.userModifiedZonosDeclaredPrice) {
    const candidatePrice = (sellingPrice / 3).toFixed(2);
    if (elements.zonosProductDeclaredPrice) {
      elements.zonosProductDeclaredPrice.value = candidatePrice;
    }
  }

  // 7. Zonos サマリー更新
  calculateZonosSummary();

  // 8. 利益 UI 表示更新
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
 * Zonos 申告額およびおまけの計算処理
 */
function calculateZonosSummary() {
  const productDeclared = getNumericValue(elements.zonosProductDeclaredPrice, 0);

  // おまけの合計額算定
  let bonusTotal = 0;
  state.bonusItems.forEach(item => {
    bonusTotal += (item.quantity || 0) * (item.unitPrice || 0);
  });

  const grandTotal = productDeclared + bonusTotal;

  if (elements.valZonosProductDeclared) {
    elements.valZonosProductDeclared.textContent = formatCurrency(productDeclared);
  }
  if (elements.valZonosBonusTotal) {
    elements.valZonosBonusTotal.textContent = formatCurrency(bonusTotal);
  }
  if (elements.valZonosGrandTotal) {
    elements.valZonosGrandTotal.textContent = formatCurrency(grandTotal);
  }
}

/**
 * 利益計算結果のUI更新
 */
function updateUIResult(data) {
  elements.profitDisplay.textContent = formatCurrency(data.estimatedProfit);
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

  elements.valSellingPrice.textContent = formatCurrency(data.sellingPrice);
  elements.valEbayFee.textContent = `-${formatCurrency(data.ebayFeeAmount)}`;
  elements.subEbayFee.textContent = `(${data.ebayFeeRatePercent.toFixed(1)}%)`;

  elements.valTariff.textContent = `-${formatCurrency(data.tariffAmount)}`;
  elements.subTariff.textContent = `(価格/${data.tariffDenominator} × ${data.tariffRatePercent.toFixed(1)}%)`;

  elements.valPurchase.textContent = `-${formatCurrency(data.purchaseCost)}`;
  elements.valShipping.textContent = `-${formatCurrency(data.shippingCost)}`;
  elements.valOther.textContent = `-${formatCurrency(data.otherExpenses)}`;
  elements.valTotalCosts.textContent = formatCurrency(data.totalExpenses);
}

/**
 * 配送方法の切り替え制御
 */
function handleShippingMethodChange() {
  const method = elements.shippingMethod ? elements.shippingMethod.value : 'japanpost';
  if (method === 'japanpost') {
    elements.zonosCard.classList.remove('hidden');
  } else {
    elements.zonosCard.classList.add('hidden');
  }
}

/**
 * おまけ（ノベルティ）リストのDOM再描画
 */
function renderBonusItems() {
  if (!elements.bonusItemsContainer) return;
  elements.bonusItemsContainer.innerHTML = '';

  if (state.bonusItems.length === 0) {
    elements.bonusItemsContainer.innerHTML = `
      <div class="empty-hint" style="font-size: 0.8rem; color: var(--text-muted); text-align: center; padding: 0.5rem;">
        同封する「おまけ」がある場合は上のボタンから追加してください。
      </div>
    `;
    calculateZonosSummary();
    return;
  }

  state.bonusItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'bonus-item-row';
    row.innerHTML = `
      <div>
        <input type="text" class="form-control bonus-name-input" data-id="${item.id}" placeholder="おまけの商品名" value="${item.name}">
      </div>
      <div>
        <input type="number" class="form-control bonus-qty-input" data-id="${item.id}" placeholder="数量" value="${item.quantity}" min="1">
      </div>
      <div>
        <div class="input-currency-wrapper">
          <span class="currency-symbol">$</span>
          <input type="number" class="form-control currency-input bonus-price-input" data-id="${item.id}" placeholder="0.00" value="${item.unitPrice}" step="0.01" min="0">
        </div>
      </div>
      <div>
        <input type="text" class="form-control bonus-photo-input" data-id="${item.id}" placeholder="写真URL (任意)" value="${item.photoUrl}">
      </div>
      <div>
        <button type="button" class="btn-delete" data-id="${item.id}" title="削除">&times;</button>
      </div>
    `;
    elements.bonusItemsContainer.appendChild(row);
  });

  // イベントバインド
  elements.bonusItemsContainer.querySelectorAll('.bonus-name-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const targetItem = state.bonusItems.find(i => i.id === id);
      if (targetItem) targetItem.name = e.target.value;
    });
  });

  elements.bonusItemsContainer.querySelectorAll('.bonus-qty-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const targetItem = state.bonusItems.find(i => i.id === id);
      if (targetItem) {
        targetItem.quantity = Math.max(1, parseInt(e.target.value) || 1);
        calculateZonosSummary();
      }
    });
  });

  elements.bonusItemsContainer.querySelectorAll('.bonus-price-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const targetItem = state.bonusItems.find(i => i.id === id);
      if (targetItem) {
        targetItem.unitPrice = Math.max(0, parseFloat(e.target.value) || 0);
        calculateZonosSummary();
      }
    });
  });

  elements.bonusItemsContainer.querySelectorAll('.bonus-photo-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const id = e.target.getAttribute('data-id');
      const targetItem = state.bonusItems.find(i => i.id === id);
      if (targetItem) targetItem.photoUrl = e.target.value;
    });
  });

  elements.bonusItemsContainer.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      state.bonusItems = state.bonusItems.filter(i => i.id !== id);
      renderBonusItems();
    });
  });

  calculateZonosSummary();
}

/**
 * 新しいおまけ行を追加
 */
function addBonusItem() {
  const newId = `bonus-${Date.now()}`;
  state.bonusItems.push({
    id: newId,
    name: "Original Novelty Sticker",
    quantity: 1,
    unitPrice: 1.00,
    photoUrl: ""
  });
  renderBonusItems();
}

/**
 * Zonos 申告情報をテキスト形式でワンクリックコピー
 */
function copyZonosSummaryToClipboard() {
  const productName = elements.productName ? elements.productName.value : state.ebayOrder.title;
  const productDeclared = getNumericValue(elements.zonosProductDeclaredPrice, 0);

  let bonusText = "";
  let bonusTotal = 0;
  if (state.bonusItems.length > 0) {
    bonusText = state.bonusItems.map((item, idx) => {
      const sub = item.quantity * item.unitPrice;
      bonusTotal += sub;
      return `  ${idx + 1}. ${item.name} (数量: ${item.quantity}, 単価: $${item.unitPrice.toFixed(2)}, 小計: $${sub.toFixed(2)})`;
    }).join("\n");
  } else {
    bonusText = "  なし";
  }

  const grandTotal = productDeclared + bonusTotal;

  const copyContent = `【Zonos Prepay 転記用申告情報】
■ 注文番号: ${state.ebayOrder.orderId}
■ 商品番号: ${state.ebayOrder.itemId}
■ 商品名: ${productName}
■ 配送先国: ${state.ebayOrder.shippingCountry}
■ 売れた商品の申告価格候補: $${productDeclared.toFixed(2)}
■ おまけ (ノベルティ):
${bonusText}
■ Zonos 申告総額: $${grandTotal.toFixed(2)}
■ 転記日時: ${getCurrentTimestamp()}`;

  navigator.clipboard.writeText(copyContent).then(() => {
    if (elements.copyNotification) {
      elements.copyNotification.classList.remove('hidden');
      setTimeout(() => {
        elements.copyNotification.classList.add('hidden');
      }, 3000);
    }
  }).catch(err => {
    alert("クリップボードへのコピーに失敗しました。画面のテキストを手動でコピーしてください。");
  });
}

/**
 * 将来の Zonos API 送信用 下書きデータ構造 (ZonosDraftPayload) 生成モジュール
 */
function createZonosDraftPayload() {
  const productDeclared = getNumericValue(elements.zonosProductDeclaredPrice, 0);
  let bonusTotal = 0;
  
  const formattedBonusItems = state.bonusItems.map(item => {
    const sub = item.quantity * item.unitPrice;
    bonusTotal += sub;
    return {
      name: item.name,
      quantity: item.quantity,
      declaredUnitPrice: item.unitPrice,
      subtotal: sub,
      photoUrl: item.photoUrl
    };
  });

  return {
    version: "1.0",
    orderId: state.ebayOrder.orderId,
    itemId: state.ebayOrder.itemId,
    destinationCountry: state.ebayOrder.shippingCountry,
    productTitle: elements.productName ? elements.productName.value : state.ebayOrder.title,
    productDeclaredValue: productDeclared,
    bonusItems: formattedBonusItems,
    bonusTotalValue: bonusTotal,
    totalDeclaredValue: productDeclared + bonusTotal,
    timestamp: getCurrentTimestamp(),
    isUserApproved: false
  };
}

/**
 * 最終確認画面 (二段階承認モーダル) の開閉・7項目描画制御
 */
function openConfirmationModal() {
  const productName = elements.productName ? elements.productName.value : state.ebayOrder.title;
  const sellingPrice = getNumericValue(elements.sellingPrice, 0);
  const productDeclared = getNumericValue(elements.zonosProductDeclaredPrice, 0);

  // 1. 売れた商品の一覧
  if (elements.modalProductList) {
    elements.modalProductList.textContent = `${productName} (数量: ${state.ebayOrder.quantity})`;
  }

  // 2. 販売価格
  if (elements.modalSellingPrice) {
    elements.modalSellingPrice.textContent = formatCurrency(sellingPrice);
  }

  // 3. 1/3申告価格候補
  if (elements.modalProductDeclaredPrice) {
    elements.modalProductDeclaredPrice.textContent = formatCurrency(productDeclared);
  }

  // 4. おまけ一覧
  let bonusTotal = 0;
  if (elements.modalBonusItemsList) {
    if (state.bonusItems.length > 0) {
      const bonusHtml = state.bonusItems.map((item, idx) => {
        const sub = item.quantity * item.unitPrice;
        bonusTotal += sub;
        return `${idx + 1}. ${item.name} (数量: ${item.quantity}, 単価: $${item.unitPrice.toFixed(2)}, 小計: $${sub.toFixed(2)})`;
      }).join('<br>');
      elements.modalBonusItemsList.innerHTML = bonusHtml;
    } else {
      elements.modalBonusItemsList.textContent = "なし";
    }
  } else {
    state.bonusItems.forEach(i => bonusTotal += (i.quantity * i.unitPrice));
  }

  // 5. Zonos申告総額
  const grandTotal = productDeclared + bonusTotal;
  if (elements.modalGrandTotal) {
    elements.modalGrandTotal.textContent = formatCurrency(grandTotal);
  }

  // 6. 発送方法
  if (elements.modalShippingMethod) {
    const selectedOption = elements.shippingMethod ? elements.shippingMethod.options[elements.shippingMethod.selectedIndex].text : '日本郵政 海外便';
    elements.modalShippingMethod.textContent = selectedOption;
  }

  // 7. 配送先国
  if (elements.modalDestinationCountry) {
    elements.modalDestinationCountry.textContent = state.ebayOrder.shippingCountry;
  }

  // 初期化 (チェックボックス解除 & ボタン非活性)
  if (elements.confirmCheckbox) {
    elements.confirmCheckbox.checked = false;
  }
  if (elements.executeActionBtn) {
    elements.executeActionBtn.disabled = true;
  }

  // モーダル表示
  if (elements.modalOverlay) {
    elements.modalOverlay.classList.remove('hidden');
  }
}

function closeConfirmationModal() {
  if (elements.modalOverlay) {
    elements.modalOverlay.classList.add('hidden');
  }
}

/**
 * ロック / アンロック 切替処理 (README.md 4項)
 */
function toggleLockState() {
  state.isLocked = !state.isLocked;

  const settingsInputs = [elements.ebayFeeRate, elements.tariffDenominator, elements.tariffRate];

  if (state.isLocked) {
    settingsInputs.forEach(input => input.setAttribute('readonly', 'true'));
    elements.lockIcon.textContent = '🔒';
    elements.lockText.textContent = '固定中 (ロック)';
    elements.toggleLockButton.className = 'btn-lock locked';
    elements.settingsCard.classList.remove('editing-mode');
    elements.lockNotice.innerHTML = '<span>💡 誤操作防止のため設定値は固定されています。変更する場合は右上ボタンを押してください。</span>';
  } else {
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
 * イベントリスナーの初期登録
 */
function initEventListeners() {
  // 自動計算イベントバインド
  const calcInputs = [
    elements.sellingPrice,
    elements.purchaseCost,
    elements.shippingCost,
    elements.otherExpenses,
    elements.ebayFeeRate,
    elements.tariffDenominator,
    elements.tariffRate
  ];

  calcInputs.forEach(input => {
    if (input) {
      input.addEventListener('input', calculateProfit);
    }
  });

  // Zonos 申告候補額の手動変更イベント
  if (elements.zonosProductDeclaredPrice) {
    elements.zonosProductDeclaredPrice.addEventListener('input', () => {
      state.userModifiedZonosDeclaredPrice = true;
      calculateZonosSummary();
    });
  }

  // 配送方法切り替え
  if (elements.shippingMethod) {
    elements.shippingMethod.addEventListener('change', handleShippingMethodChange);
  }

  // ロック切替
  if (elements.toggleLockButton) {
    elements.toggleLockButton.addEventListener('click', toggleLockState);
  }

  // おまけ追加ボタン
  if (elements.addBonusItemBtn) {
    elements.addBonusItemBtn.addEventListener('click', addBonusItem);
  }

  // コピーボタン
  if (elements.copyZonosInfoBtn) {
    elements.copyZonosInfoBtn.addEventListener('click', copyZonosSummaryToClipboard);
  }

  // Zonos 開くボタン
  if (elements.openZonosBtn) {
    elements.openZonosBtn.addEventListener('click', openConfirmationModal);
  }

  // モーダル閉じる / キャンセル
  if (elements.closeModalBtn) {
    elements.closeModalBtn.addEventListener('click', closeConfirmationModal);
  }
  if (elements.cancelActionBtn) {
    elements.cancelActionBtn.addEventListener('click', closeConfirmationModal);
  }

  // 「確認しました」チェックボックスのトリガー
  if (elements.confirmCheckbox) {
    elements.confirmCheckbox.addEventListener('change', (e) => {
      if (elements.executeActionBtn) {
        elements.executeActionBtn.disabled = !e.target.checked;
      }
    });
  }

  // モーダル「実行する」ボタン (「確認しました」にチェックがある場合のみ外部URLを開く)
  if (elements.executeActionBtn) {
    elements.executeActionBtn.addEventListener('click', () => {
      if (!elements.confirmCheckbox || !elements.confirmCheckbox.checked) {
        alert("『確認しました』にチェックを入れてから実行してください。");
        return;
      }
      closeConfirmationModal();
      // Zonos Prepay URL を別タブで開く (自動送信・自動入力・自動支払いは行わない)
      window.open('https://dashboard.zonosprepay.com/ja/ship', '_blank', 'noopener,noreferrer');
    });
  }

  // ページ切り替えタブのリスナー登録
  const tabProfitCalculator = document.getElementById('tabProfitCalculator');
  const tabSellSimilar = document.getElementById('tabSellSimilar');
  const tabZonosCustoms = document.getElementById('tabZonosCustoms');
  const tabBrandAsset = document.getElementById('tabBrandAsset');
  const tabProjectHealth = document.getElementById('tabProjectHealth');
  const tabMarketingStudio = document.getElementById('tabMarketingStudio');
  const tabSafeAutomation = document.getElementById('tabSafeAutomation');
  const tabOperationalKnowledge = document.getElementById('tabOperationalKnowledge');
  const tabKnowledgeOrchestrator = document.getElementById('tabKnowledgeOrchestrator');
  const tabRuleFreshness = document.getElementById('tabRuleFreshness');
  const tabShipmentReadiness = document.getElementById('tabShipmentReadiness');

  const pageProfitCalculator = document.getElementById('pageProfitCalculator');
  const pageSellSimilar = document.getElementById('pageSellSimilar');
  const pageZonosCustoms = document.getElementById('pageZonosCustoms');
  const pageBrandAsset = document.getElementById('pageBrandAsset');
  const pageProjectHealth = document.getElementById('pageProjectHealth');
  const pageMarketingStudio = document.getElementById('pageMarketingStudio');
  const pageSafeAutomation = document.getElementById('pageSafeAutomation');
  const pageOperationalKnowledge = document.getElementById('pageOperationalKnowledge');
  const pageKnowledgeOrchestrator = document.getElementById('pageKnowledgeOrchestrator');
  const pageRuleFreshness = document.getElementById('pageRuleFreshness');
  const pageShipmentReadiness = document.getElementById('pageShipmentReadiness');

  const switchTab = (activeTab, activePage) => {
    [tabProfitCalculator, tabSellSimilar, tabZonosCustoms, tabBrandAsset, tabProjectHealth, tabMarketingStudio, tabSafeAutomation, tabOperationalKnowledge, tabKnowledgeOrchestrator, tabRuleFreshness, tabShipmentReadiness].forEach(tab => {
      if (tab) tab.classList.remove('active');
    });
    [pageProfitCalculator, pageSellSimilar, pageZonosCustoms, pageBrandAsset, pageProjectHealth, pageMarketingStudio, pageSafeAutomation, pageOperationalKnowledge, pageKnowledgeOrchestrator, pageRuleFreshness, pageShipmentReadiness].forEach(page => {
      if (page) page.classList.add('hidden');
    });

    if (activeTab) activeTab.classList.add('active');
    if (activePage) activePage.classList.remove('hidden');
  };

  if (tabProfitCalculator) {
    tabProfitCalculator.addEventListener('click', () => switchTab(tabProfitCalculator, pageProfitCalculator));
  }
  if (tabSellSimilar) {
    tabSellSimilar.addEventListener('click', () => switchTab(tabSellSimilar, pageSellSimilar));
  }
  if (tabZonosCustoms) {
    tabZonosCustoms.addEventListener('click', () => switchTab(tabZonosCustoms, pageZonosCustoms));
  }
  if (tabBrandAsset) {
    tabBrandAsset.addEventListener('click', () => switchTab(tabBrandAsset, pageBrandAsset));
  }
  if (tabProjectHealth) {
    tabProjectHealth.addEventListener('click', () => switchTab(tabProjectHealth, pageProjectHealth));
  }
  if (tabMarketingStudio) {
    tabMarketingStudio.addEventListener('click', () => switchTab(tabMarketingStudio, pageMarketingStudio));
  }
  if (tabSafeAutomation) {
    tabSafeAutomation.addEventListener('click', () => switchTab(tabSafeAutomation, pageSafeAutomation));
  }
  if (tabOperationalKnowledge) {
    tabOperationalKnowledge.addEventListener('click', () => switchTab(tabOperationalKnowledge, pageOperationalKnowledge));
  }
  if (tabKnowledgeOrchestrator) {
    tabKnowledgeOrchestrator.addEventListener('click', () => switchTab(tabKnowledgeOrchestrator, pageKnowledgeOrchestrator));
  }
  if (tabRuleFreshness) {
    tabRuleFreshness.addEventListener('click', () => switchTab(tabRuleFreshness, pageRuleFreshness));
  }
  if (tabShipmentReadiness) {
    tabShipmentReadiness.addEventListener('click', () => switchTab(tabShipmentReadiness, pageShipmentReadiness));
  }
}

// ドキュメントロード時の初期化処理
document.addEventListener('DOMContentLoaded', () => {
  renderBonusItems();
  initEventListeners();
  handleShippingMethodChange();
  calculateProfit();
});

