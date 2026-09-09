import './safetyGate';

declare module './safetyGate' {
  interface ImportedEbayOrderRecord {
    /** Central Inventory v2 Buyer Allocation that committed stock to this Buyer Order. */
    buyerAllocationId?: string;
    /** Physical Inventory Unit IDs allocated to this order (required for tracked one-off/high-value units). */
    inventoryUnitIds?: string[];
  }
}

export {};
