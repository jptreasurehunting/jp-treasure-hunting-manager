import { CentralInventoryItem } from '../types/centralInventory';
import { loadCentralInventory, saveCentralInventory } from './centralInventoryService';

const INVENTORY_IMPORT_BACKUP_KEY = 'zonos_inventory_import_backup_v1';

export type InventoryImportChangeType = 'ADD' | 'UPDATE' | 'UNCHANGED' | 'ERROR';

export interface InventoryImportDraftRow {
  lineNumber: number;
  sku: string;
  itemTitle: string;
  physicalStock: number;
  reservedStock: number;
  safetyBuffer: number;
  unitCostJpy: number;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  category: string;
}

export interface InventoryImportPreviewRow {
  lineNumber: number;
  sku: string;
  itemTitle: string;
  changeType: InventoryImportChangeType;
  errors: string[];
  before?: CentralInventoryItem;
  after?: CentralInventoryItem;
}

export interface InventoryImportPreview {
  rows: InventoryImportPreviewRow[];
  added: number;
  updated: number;
  unchanged: number;
  errorRows: number;
  canApply: boolean;
}

export interface InventoryImportApplyResult {
  success: boolean;
  appliedCount: number;
  messageJa: string;
}

export interface InventoryImportBackup {
  createdAt: string;
  items: CentralInventoryItem[];
}

const REQUIRED_HEADERS = [
  'sku',
  'itemTitle',
  'physicalStock',
  'reservedStock',
  'safetyBuffer',
  'unitCostJpy',
  'weightGrams',
  'lengthCm',
  'widthCm',
  'heightCm',
  'category'
] as const;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function asFiniteNumber(value: string): number {
  if (value.trim() === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeText(value: string): string {
  return value.trim();
}

function validateDraftRow(row: InventoryImportDraftRow): string[] {
  const errors: string[] = [];

  if (!row.sku) errors.push('SKUが空です。');
  if (!row.itemTitle) errors.push('商品名が空です。');
  if (!row.category) errors.push('カテゴリが空です。');

  const integerFields: Array<[string, number]> = [
    ['実在庫', row.physicalStock],
    ['引当在庫', row.reservedStock],
    ['安全在庫', row.safetyBuffer]
  ];

  integerFields.forEach(([label, value]) => {
    if (!Number.isInteger(value) || value < 0) {
      errors.push(`${label}は0以上の整数で入力してください。`);
    }
  });

  if (Number.isFinite(row.physicalStock) && Number.isFinite(row.reservedStock) && row.reservedStock > row.physicalStock) {
    errors.push('引当在庫が実在庫を超えています。');
  }

  const nonNegativeFields: Array<[string, number]> = [
    ['仕入原価', row.unitCostJpy],
    ['重量', row.weightGrams],
    ['長さ', row.lengthCm],
    ['幅', row.widthCm],
    ['高さ', row.heightCm]
  ];

  nonNegativeFields.forEach(([label, value]) => {
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${label}は0以上の数値で入力してください。`);
    }
  });

  return errors;
}

export function parseInventoryCsv(csvText: string): { rows: InventoryImportDraftRow[]; errors: string[] } {
  const text = csvText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return { rows: [], errors: ['CSVファイルが空です。'] };

  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return { rows: [], errors: ['ヘッダー行と1件以上の在庫データが必要です。'] };

  const headers = parseCsvLine(lines[0]);
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [`必須列が不足しています: ${missingHeaders.join(', ')}`]
    };
  }

  const indexOf = (header: string) => headers.indexOf(header);
  const rows: InventoryImportDraftRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const value = (header: string) => cells[indexOf(header)] ?? '';

    const row: InventoryImportDraftRow = {
      lineNumber: i + 1,
      sku: normalizeText(value('sku')),
      itemTitle: normalizeText(value('itemTitle')),
      physicalStock: asFiniteNumber(value('physicalStock')),
      reservedStock: asFiniteNumber(value('reservedStock')),
      safetyBuffer: asFiniteNumber(value('safetyBuffer')),
      unitCostJpy: asFiniteNumber(value('unitCostJpy')),
      weightGrams: asFiniteNumber(value('weightGrams')),
      lengthCm: asFiniteNumber(value('lengthCm')),
      widthCm: asFiniteNumber(value('widthCm')),
      heightCm: asFiniteNumber(value('heightCm')),
      category: normalizeText(value('category'))
    };

    rows.push(row);
  }

  const skuCounts = new Map<string, number>();
  rows.forEach((row) => {
    if (!row.sku) return;
    skuCounts.set(row.sku, (skuCounts.get(row.sku) ?? 0) + 1);
  });

  skuCounts.forEach((count, sku) => {
    if (count > 1) errors.push(`SKU [${sku}] がCSV内で重複しています。`);
  });

  return { rows, errors };
}

function createAfterItem(
  draft: InventoryImportDraftRow,
  existing?: CentralInventoryItem
): CentralInventoryItem {
  const availableToSell = Math.max(0, draft.physicalStock - draft.reservedStock - draft.safetyBuffer);

  return {
    sku: draft.sku,
    itemTitle: draft.itemTitle,
    physicalStock: draft.physicalStock,
    reservedStock: draft.reservedStock,
    availableToSell,
    safetyBuffer: draft.safetyBuffer,
    unitCostJpy: draft.unitCostJpy,
    weightGrams: draft.weightGrams,
    dimensionsCm: {
      length: draft.lengthCm,
      width: draft.widthCm,
      height: draft.heightCm
    },
    category: draft.category,
    channelBindings: existing?.channelBindings ?? [],
    lastReconciledAt: existing?.lastReconciledAt ?? new Date().toISOString(),
    isLockedForOversellingRisk: existing?.isLockedForOversellingRisk ?? false
  };
}

function isCoreInventoryEqual(a: CentralInventoryItem, b: CentralInventoryItem): boolean {
  return (
    a.sku === b.sku &&
    a.itemTitle === b.itemTitle &&
    a.physicalStock === b.physicalStock &&
    a.reservedStock === b.reservedStock &&
    a.availableToSell === b.availableToSell &&
    a.safetyBuffer === b.safetyBuffer &&
    a.unitCostJpy === b.unitCostJpy &&
    a.weightGrams === b.weightGrams &&
    a.dimensionsCm.length === b.dimensionsCm.length &&
    a.dimensionsCm.width === b.dimensionsCm.width &&
    a.dimensionsCm.height === b.dimensionsCm.height &&
    a.category === b.category
  );
}

export function buildInventoryImportPreview(
  csvText: string,
  currentItems: CentralInventoryItem[] = loadCentralInventory()
): InventoryImportPreview {
  const parsed = parseInventoryCsv(csvText);
  const duplicateSkus = new Set<string>();
  const countBySku = new Map<string, number>();
  parsed.rows.forEach((row) => {
    if (!row.sku) return;
    countBySku.set(row.sku, (countBySku.get(row.sku) ?? 0) + 1);
  });
  countBySku.forEach((count, sku) => {
    if (count > 1) duplicateSkus.add(sku);
  });

  const currentBySku = new Map(currentItems.map((item) => [item.sku, item]));
  const rows: InventoryImportPreviewRow[] = parsed.rows.map((draft) => {
    const rowErrors = validateDraftRow(draft);
    if (duplicateSkus.has(draft.sku)) rowErrors.push('CSV内でSKUが重複しています。');

    const before = currentBySku.get(draft.sku);
    const after = rowErrors.length === 0 ? createAfterItem(draft, before) : undefined;

    if (rowErrors.length > 0 || !after) {
      return {
        lineNumber: draft.lineNumber,
        sku: draft.sku,
        itemTitle: draft.itemTitle,
        changeType: 'ERROR',
        errors: rowErrors,
        before
      };
    }

    return {
      lineNumber: draft.lineNumber,
      sku: draft.sku,
      itemTitle: draft.itemTitle,
      changeType: !before ? 'ADD' : isCoreInventoryEqual(before, after) ? 'UNCHANGED' : 'UPDATE',
      errors: [],
      before,
      after
    };
  });

  if (parsed.errors.length > 0 && rows.length === 0) {
    rows.push({
      lineNumber: 1,
      sku: '',
      itemTitle: '',
      changeType: 'ERROR',
      errors: parsed.errors
    });
  }

  const added = rows.filter((row) => row.changeType === 'ADD').length;
  const updated = rows.filter((row) => row.changeType === 'UPDATE').length;
  const unchanged = rows.filter((row) => row.changeType === 'UNCHANGED').length;
  const errorRows = rows.filter((row) => row.changeType === 'ERROR').length;

  return {
    rows,
    added,
    updated,
    unchanged,
    errorRows,
    canApply: rows.length > 0 && errorRows === 0 && (added + updated > 0)
  };
}

function saveImportBackup(items: CentralInventoryItem[]): void {
  const backup: InventoryImportBackup = {
    createdAt: new Date().toISOString(),
    items
  };
  localStorage.setItem(INVENTORY_IMPORT_BACKUP_KEY, JSON.stringify(backup));
}

export function getLastInventoryImportBackup(): InventoryImportBackup | null {
  try {
    const raw = localStorage.getItem(INVENTORY_IMPORT_BACKUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applyInventoryImportPreview(
  preview: InventoryImportPreview,
  currentItems: CentralInventoryItem[] = loadCentralInventory()
): InventoryImportApplyResult {
  if (!preview.canApply || preview.errorRows > 0) {
    return {
      success: false,
      appliedCount: 0,
      messageJa: 'エラーまたは反映可能な変更がないため、在庫は変更していません。'
    };
  }

  const nextBySku = new Map(currentItems.map((item) => [item.sku, item]));
  let appliedCount = 0;

  preview.rows.forEach((row) => {
    if ((row.changeType === 'ADD' || row.changeType === 'UPDATE') && row.after) {
      nextBySku.set(row.after.sku, row.after);
      appliedCount++;
    }
  });

  saveImportBackup(currentItems);
  saveCentralInventory(Array.from(nextBySku.values()));

  return {
    success: true,
    appliedCount,
    messageJa: `${appliedCount}件の在庫変更を反映しました。反映前データは直前バックアップとして保存されています。`
  };
}

export function restoreLastInventoryImportBackup(): InventoryImportApplyResult {
  const backup = getLastInventoryImportBackup();
  if (!backup) {
    return {
      success: false,
      appliedCount: 0,
      messageJa: '復元できる在庫取込バックアップがありません。'
    };
  }

  const currentItems = loadCentralInventory();
  saveCentralInventory(backup.items);
  localStorage.removeItem(INVENTORY_IMPORT_BACKUP_KEY);

  return {
    success: true,
    appliedCount: currentItems.length,
    messageJa: `直前の在庫取込前の状態へ復元しました。（${backup.items.length} SKU）`
  };
}

export function getInventoryCsvTemplate(): string {
  return [
    REQUIRED_HEADERS.join(','),
    'SKU-EXAMPLE-001,"商品名サンプル",1,0,0,1000,100,10,8,3,"Category"'
  ].join('\n');
}
