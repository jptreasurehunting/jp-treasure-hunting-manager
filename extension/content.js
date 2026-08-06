/**
 * eBay Seller Hub Active Listings - Production Automation Content Script
 * Version 3.0.0 (Production Release)
 */

(function () {
  'use strict';

  if (window.__EBAY_SELL_SIMILAR_CONTENT_SCRIPT_LOADED__) {
    return;
  }
  window.__EBAY_SELL_SIMILAR_CONTENT_SCRIPT_LOADED__ = true;

  // 1. Hostname Check
  const hostname = window.location.hostname;
  const isEbayDomain = hostname.endsWith('ebay.com') || hostname.includes('.ebay.');
  if (!isEbayDomain) {
    return;
  }

  // 2. Read Target Parameters
  function extractTargetParams() {
    const fullUrl = window.location.href;
    const urlObj = new URL(fullUrl);
    const hash = window.location.hash || '';

    let itemId = urlObj.searchParams.get('itemId') || urlObj.searchParams.get('autoSellSimilarHub') || '';
    const itemHashMatch = hash.match(/(?:autoSellSimilarHub|itemId)=(\d{10,14})/i);
    if (itemHashMatch) itemId = itemHashMatch[1];

    let fullTitle = '';
    const titleHashMatch = hash.match(/autoSellSimilarTitle=([^&]+)/i);
    if (titleHashMatch) {
      fullTitle = decodeURIComponent(titleHashMatch[1]);
    } else {
      fullTitle = urlObj.searchParams.get('autoSellSimilarTitle') || urlObj.searchParams.get('q') || '';
    }

    return {
      itemId: itemId.trim(),
      fullTitle: fullTitle.trim()
    };
  }

  const { itemId, fullTitle } = extractTargetParams();
  if (!itemId && !fullTitle) {
    return;
  }

  const primaryQuery = itemId || fullTitle;

  // Exclude Header Navigation Elements
  function isHeaderElement(el) {
    if (!el) return false;
    return !!el.closest('#gh-header, #gh-top, #gh, header, nav, .gh-menu');
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.disabled) return false;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
    } catch (e) {}
    return el.offsetWidth > 0 || el.offsetHeight > 0 || (el.getClientRects && el.getClientRects().length > 0);
  }

  // Strict Whitespace & Case Normalizer
  function normalizeText(str) {
    if (!str) return '';
    return str.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  // Native Input Setter
  function setNativeInputValue(inputEl, value) {
    try {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeSetter.call(inputEl, value);
    } catch (e) {
      inputEl.value = value;
    }
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Multi-Method Search Submission
  function submitSearchField(searchInput) {
    if (!searchInput) return;

    const searchContainer = searchInput.closest('form, #sh-search-box, .sh-search-box, .sh-filter-box, div[role="search"]') || document.body;
    const searchBtnSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[aria-label*="search" i]',
      'button[aria-label*="submit" i]',
      'button[data-testid*="search"]',
      'button.sh-search-box__button',
      'button.sh-search-btn',
      '.sh-search-icon',
      'button.btn-search',
      'svg.sh-search-box__icon'
    ];

    for (const sel of searchBtnSelectors) {
      const btn = searchContainer.querySelector(sel);
      if (btn && !isHeaderElement(btn) && isElementVisible(btn)) {
        btn.click();
        return;
      }
    }

    const form = searchInput.form || searchInput.closest('form');
    if (form) {
      if (typeof form.requestSubmit === 'function') {
        try {
          form.requestSubmit();
          return;
        } catch (e) {}
      }
      try {
        form.submit();
        return;
      } catch (e) {}
    }

    searchInput.focus();
    const enterInit = {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      charCode: 13,
      bubbles: true,
      cancelable: true,
      composed: true
    };
    searchInput.dispatchEvent(new KeyboardEvent('keydown', enterInit));
    searchInput.dispatchEvent(new KeyboardEvent('keypress', enterInit));
    searchInput.dispatchEvent(new KeyboardEvent('keyup', enterInit));
  }

  // Deep Search Field Finder
  function findDeepSearchField(root = document) {
    const selectors = [
      '#sh-search-input',
      'input[data-testid*="search"]',
      'input[data-testid*="filter"]',
      'input[data-testid*="keyword"]',
      'input.sh-search-box__input',
      'input.sh-search-input',
      '#sh-search-box input',
      '#sh-grid-search-input',
      'input[name="q"]',
      'input[name="keyword"]',
      'input[name="search"]',
      'input[name="_nkw"]',
      'ebay-textbox input',
      'sh-search-box input',
      'sh-search input',
      'input[placeholder*="search" i]',
      'input[placeholder*="title" i]',
      'input[placeholder*="sku" i]',
      'input[placeholder*="item" i]',
      'input[placeholder*="filter" i]',
      'input[aria-label*="search" i]',
      'input[aria-label*="title" i]',
      'input[role="searchbox"]',
      'input[type="search"]'
    ];

    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
        if (el && !isHeaderElement(el) && isElementVisible(el)) {
          return el;
        }
      } catch (e) {}
    }

    try {
      const allNodes = Array.from(root.querySelectorAll('*'));
      for (const node of allNodes) {
        if (node.shadowRoot) {
          const shadowFound = findDeepSearchField(node.shadowRoot);
          if (shadowFound) return shadowFound;
        }
      }
    } catch (e) {}

    try {
      const inputs = Array.from(root.querySelectorAll('input')).filter(
        (input) => !isHeaderElement(input) && isElementVisible(input)
      );

      for (const input of inputs) {
        const ph = (input.placeholder || '').toLowerCase();
        const aria = (input.getAttribute('aria-label') || '').toLowerCase();
        const id = (input.id || '').toLowerCase();
        const cls = (input.className || '').toLowerCase();
        const type = (input.type || '').toLowerCase();

        if (
          type === 'search' ||
          ph.includes('search') ||
          ph.includes('title') ||
          ph.includes('sku') ||
          ph.includes('item') ||
          ph.includes('filter') ||
          aria.includes('search') ||
          aria.includes('title') ||
          id.includes('search') ||
          cls.includes('search')
        ) {
          return input;
        }
      }
    } catch (e) {}

    return null;
  }

  // Row Checkbox Selector
  function checkListingRowCheckbox(targetRow) {
    if (!targetRow) return false;

    const cb = targetRow.querySelector('input[type="checkbox"]');
    const customCb = targetRow.querySelector('[role="checkbox"], .checkbox, .sh-grid-checkbox, span.checkbox__icon, td:first-child');
    const label = cb ? (cb.closest('label') || cb.parentElement) : null;

    if (label) {
      try { label.click(); } catch (e) {}
    }

    if (customCb && customCb !== label) {
      try { customCb.click(); } catch (e) {}
    }

    if (cb) {
      try { cb.click(); } catch (e) {}
      if (!cb.checked) {
        cb.checked = true;
        cb.dispatchEvent(new Event('click', { bubbles: true }));
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    return true;
  }

  // Automation State Machine
  let currentStep = 'FIND_SEARCH';
  let activeSearchTerm = primaryQuery;
  let hasRetriedWithTitle = false;
  let startTime = Date.now();
  const maxTimeoutMs = 35000;

  function executeStep() {
    if (Date.now() - startTime > maxTimeoutMs) {
      console.warn('[eBay Sell Similar] Automation safety timeout reached.');
      return;
    }

    // STEP 1: Find Search Field
    if (currentStep === 'FIND_SEARCH') {
      const searchInput = findDeepSearchField();
      if (!searchInput) {
        setTimeout(executeStep, 400);
        return;
      }

      currentStep = 'ENTER_ITEM_ID';
      setTimeout(executeStep, 150);
      return;
    }

    // STEP 2: Enter Search Term & Trigger Automatic Submit
    if (currentStep === 'ENTER_ITEM_ID') {
      const searchInput = findDeepSearchField();
      if (!searchInput) {
        currentStep = 'FIND_SEARCH';
        setTimeout(executeStep, 250);
        return;
      }

      setNativeInputValue(searchInput, activeSearchTerm);

      if (searchInput.value.trim() !== activeSearchTerm) {
        setTimeout(executeStep, 250);
        return;
      }

      submitSearchField(searchInput);

      currentStep = 'VERIFY_EXACT_ROW';
      setTimeout(executeStep, 1000);
      return;
    }

    // STEP 3: STRICT IDENTITY MATCHING & TITLE RETRY
    if (currentStep === 'VERIFY_EXACT_ROW') {
      const isGridLoading = !!document.querySelector('.sh-spinner, [aria-busy="true"], .sh-grid-loading');

      const allRows = Array.from(document.querySelectorAll('tr, [role="row"], div.sh-grid-row')).filter(
        (r) => !isHeaderElement(r) && !r.closest('thead')
      );

      const normExpectedTitle = normalizeText(fullTitle);
      const normItemId = itemId ? itemId.trim() : '';

      let matchedRows = [];

      // Priority 1: Match by Item ID
      if (normItemId) {
        matchedRows = allRows.filter((r) => (r.textContent || '').includes(normItemId));
      }

      // Priority 2: Match by Normalized Full Title
      if (matchedRows.length === 0 && normExpectedTitle) {
        matchedRows = allRows.filter((r) => {
          const rowText = normalizeText(r.textContent || '');
          return rowText.includes(normExpectedTitle);
        });
      }

      // Automatic Phase 2 Title Retry: If Item ID search returned 0 results, retry with Full Title once
      if (matchedRows.length === 0 && !hasRetriedWithTitle && fullTitle && activeSearchTerm !== fullTitle && !isGridLoading && allRows.length === 0) {
        hasRetriedWithTitle = true;
        activeSearchTerm = fullTitle;
        currentStep = 'ENTER_ITEM_ID';
        setTimeout(executeStep, 400);
        return;
      }

      // Strict Rule: Keep waiting if grid is loading or rows not yet rendered
      if (matchedRows.length === 0) {
        if (allRows.length > 0 && !isGridLoading) {
          console.error('[eBay Sell Similar] Safe Stop: No row matching expected item identity found.');
          return; // Safe stop
        }

        setTimeout(executeStep, 500);
        return;
      }

      // Strict Rule: Resolve multiple candidates
      if (matchedRows.length > 1) {
        if (normItemId) {
          const exactIdRows = matchedRows.filter((r) => (r.textContent || '').includes(normItemId));
          if (exactIdRows.length === 1) {
            matchedRows = exactIdRows;
          }
        }

        if (matchedRows.length > 1 && normExpectedTitle) {
          const exactTitleRows = matchedRows.filter((r) => normalizeText(r.textContent || '').includes(normExpectedTitle));
          if (exactTitleRows.length === 1) {
            matchedRows = exactTitleRows;
          }
        }

        if (matchedRows.length > 1) {
          console.error('[eBay Sell Similar] Safe Stop: Multiple rows matched without unique resolution.');
          return; // Safe stop
        }
      }

      const targetRow = matchedRows[0];
      checkListingRowCheckbox(targetRow);

      currentStep = 'CLICK_SELL_SIMILAR';
      setTimeout(executeStep, 500);
      return;
    }

    // STEP 4: Automatically Click Enabled Toolbar "Sell similar" Button
    if (currentStep === 'CLICK_SELL_SIMILAR') {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(
        (el) => !isHeaderElement(el)
      );

      const sellSimilarBtn = candidates.find((el) => {
        const text = (el.textContent || '').trim();
        const aria = (el.getAttribute('aria-label') || '').trim();
        const isExactText = text === 'Sell similar' || text === 'Sell Similar' || aria === 'Sell similar' || aria === 'Sell Similar' || text.includes('Sell similar');

        if (!isExactText) return false;

        const isDisabled = el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true' || el.classList.contains('disabled');
        return !isDisabled;
      });

      if (!sellSimilarBtn) {
        const dataRows = Array.from(document.querySelectorAll('tr, [role="row"]')).filter((r) => !isHeaderElement(r) && !r.closest('thead'));
        if (dataRows.length > 0) {
          checkListingRowCheckbox(dataRows[0]);
        }

        setTimeout(executeStep, 400);
        return;
      }

      setTimeout(() => {
        sellSimilarBtn.click();
      }, 200);
      return;
    }
  }

  // MutationObserver Loop
  const observer = new MutationObserver(() => {});
  observer.observe(document.body || document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(executeStep, 400);
  } else {
    window.addEventListener('DOMContentLoaded', () => setTimeout(executeStep, 400));
  }
})();
