/**
 * Zonos Customs Material & Product Type Suggestions Helper (Spec #6)
 * Price learning / price suggestions / declared value history have been removed per specification.
 */

export function getMaterialCandidates(): string[] {
  return ['PVC', 'ABS', 'Vinyl', 'Acrylic', 'Paper', 'Paper & Bamboo', 'Cotton', 'Polyester', 'Wood', 'Metal', 'Leather'];
}

export function getProductTypeCandidates(): string[] {
  return ['Figure', 'Statue', 'Toy', 'Trading Card', 'Keychain', 'Fan', 'T-Shirt', 'Towel', 'Book', 'Display Stand'];
}
