/**
 * eBay Seller Hub Extension Background Service Worker
 * Listens for tab updates & web navigation to inject content.js reliably.
 */

console.log('[eBay Background Worker] Service Worker Started.');

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    if (tab.url && (tab.url.includes('/sh/lst/active') || tab.url.includes('autoSellSimilar'))) {
      console.log(`[eBay Background Worker] Tab ${tabId} matched eBay Seller Hub URL: ${tab.url}`);
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(() => {
        console.log(`[eBay Background Worker] Successfully injected content.js into Tab ${tabId}`);
      }).catch((err) => {
        console.warn(`[eBay Background Worker] Content script injection warning:`, err);
      });
    }
  }
});
