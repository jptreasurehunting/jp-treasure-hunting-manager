/**
 * eBay Seller Hub Sell Similar Automation Helper
 * Generates official Seller Hub Active Listings URL with strict Item ID & Full Title parameters.
 */

export function getEbaySellerHubActiveListingUrl(itemId?: string, title?: string, sku?: string): string {
  const cleanId = (itemId || '').trim().replace(/\D/g, '');
  const cleanTitle = (title || '').trim();
  const cleanSku = (sku || '').trim();

  // Prefer Item ID, then SKU, then Full Title
  const searchQuery = cleanId || cleanSku || cleanTitle;
  const encodedQuery = encodeURIComponent(searchQuery);
  const encodedTitle = encodeURIComponent(cleanTitle);

  return `https://www.ebay.com/sh/lst/active?search=${cleanId ? 'item_id' : 'title'}&q=${encodedQuery}&itemId=${cleanId}#autoSellSimilarHub=${cleanId}&autoSellSimilarTitle=${encodedTitle}&itemId=${cleanId}`;
}

export function getExtensionDirectoryPath(): string {
  return 'c:\\Projects\\jp-treasure-hunting-manager\\extension';
}
