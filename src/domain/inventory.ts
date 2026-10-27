export type InventoryStatus = 'ACTIVE' | 'INACTIVE';
export type StockMovementType =
  | 'RECEIVE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT';

// Mirrors StockMovementType.STOCK_IN_TYPES / STOCK_OUT_TYPES in inventory-service.
export const STOCK_IN_TYPES: StockMovementType[] = ['RECEIVE', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN'];
export const STOCK_OUT_TYPES: StockMovementType[] = ['SALE', 'ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER_OUT'];

export function isStockOut(type: StockMovementType): boolean {
  return STOCK_OUT_TYPES.includes(type);
}

export interface Inventory {
  id: string;
  productId: string;
  sku: string;
  merchantId: string;
  storeId: string;
  quantity: number;
  reservedQuantity: number;
  /** quantity − reservedQuantity, computed by the backend. */
  availableQuantity: number;
  status: InventoryStatus;
  updatedAt: string;
}

export interface StockMovement {
  id: number;
  inventoryId: string;
  type: StockMovementType;
  quantity: number;
  referenceType?: string | null;
  reason?: string | null;
  createdAt: string;
}

/** Stock by SKU code for one product; undefined when unknown. */
export type StockBySku = Record<string, number | undefined>;

export function stockBySku(inventories: Inventory[]): StockBySku {
  const out: StockBySku = {};
  for (const i of inventories) out[i.sku] = i.availableQuantity;
  return out;
}

/**
 * What a shopper sees about stock (decision 2026-10-27): a status, never the exact count above LOW_STOCK.
 * No inventory record (just created, made-to-order — BR-INV-06) is "unknown" and does not block buying.
 */
export const LOW_STOCK = 5;

export type StockLevel = { kind: 'unknown' } | { kind: 'in_stock' } | { kind: 'low'; left: number } | { kind: 'sold_out' };

export function stockLevel(available: number | undefined): StockLevel {
  if (available === undefined) return { kind: 'unknown' };
  if (available <= 0) return { kind: 'sold_out' };
  if (available <= LOW_STOCK) return { kind: 'low', left: available };
  return { kind: 'in_stock' };
}

export function stockLabel(level: StockLevel): string | null {
  switch (level.kind) {
    case 'sold_out':
      return 'Sold out';
    case 'low':
      return `Only ${level.left} left`;
    case 'in_stock':
      return 'In stock';
    default:
      return null;
  }
}
