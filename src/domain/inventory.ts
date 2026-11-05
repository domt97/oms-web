export type InventoryStatus = 'ACTIVE' | 'INACTIVE';
export type StockMovementType =
  | 'RECEIVE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'RESERVE'
  | 'RESERVE_RELEASE'
  | 'RESERVE_EXPIRE';

// Mirrors StockMovementType.STOCK_IN_TYPES / STOCK_OUT_TYPES in inventory-service: the types a seller may adjust with.
export const STOCK_IN_TYPES: StockMovementType[] = ['RECEIVE', 'RETURN', 'ADJUSTMENT_IN', 'TRANSFER_IN'];
export const STOCK_OUT_TYPES: StockMovementType[] = ['SALE', 'ADJUSTMENT_OUT', 'DAMAGE', 'TRANSFER_OUT'];
/** Order holds (BR-INV-05): they change the reserved quantity, not the stock on hand, and cannot be adjusted by hand. */
export const HOLD_TYPES: StockMovementType[] = ['RESERVE'];
export const HOLD_RELEASE_TYPES: StockMovementType[] = ['RESERVE_RELEASE', 'RESERVE_EXPIRE'];

export function isStockOut(type: StockMovementType): boolean {
  return STOCK_OUT_TYPES.includes(type);
}

/** How a movement changes stock; `unknown` for a type this build does not know yet (shown as its raw code). */
export type MovementEffect = 'in' | 'out' | 'hold' | 'hold_release' | 'unknown';

export function movementEffect(type: string): MovementEffect {
  const t = type as StockMovementType;
  if (STOCK_IN_TYPES.includes(t)) return 'in';
  if (STOCK_OUT_TYPES.includes(t)) return 'out';
  if (HOLD_TYPES.includes(t)) return 'hold';
  if (HOLD_RELEASE_TYPES.includes(t)) return 'hold_release';
  return 'unknown';
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
  /** A type this build does not know yet is kept as its code (shown raw, effect `unknown`). */
  type: StockMovementType | (string & {});
  quantity: number;
  referenceType?: string | null;
  reason?: string | null;
  createdAt: string;
}

/**
 * Available stock by SKU code for one product, from a successful inventory read.
 * `null` = the SKU cannot be ordered: its inventory record is INACTIVE (BR-INV-08). A SKU missing from the map has no
 * record and cannot be ordered either (BR-CAT-04, decided 2026-11-05); read it with `availableFor`.
 */
export type StockBySku = Record<string, number | null>;

export function stockBySku(inventories: Inventory[]): StockBySku {
  const out: StockBySku = {};
  for (const i of inventories) out[i.sku] = i.status === 'ACTIVE' ? i.availableQuantity : null;
  return out;
}

/**
 * Available stock of one SKU: a number; `null` = not orderable (no record, or INACTIVE);
 * `undefined` = unknown because the stock could not be read (not a reason to block).
 */
export function availableFor(stock: StockBySku | undefined, sku: string): number | null | undefined {
  if (!stock) return undefined;
  // Own keys only: a merchant's SKU code may be "constructor" or "toString".
  return Object.hasOwn(stock, sku) ? stock[sku] : null;
}

/**
 * What a shopper sees about stock (decision 2026-10-27): a status, never the exact count above LOW_STOCK.
 * Unknown (the stock could not be read) shows nothing and does not block; not available blocks (BR-CAT-04).
 */
export const LOW_STOCK = 5;

export type StockLevel =
  | { kind: 'unknown' }
  | { kind: 'not_available' }
  | { kind: 'in_stock' }
  | { kind: 'low'; left: number }
  | { kind: 'sold_out' };

export function stockLevel(available: number | null | undefined): StockLevel {
  if (available === undefined) return { kind: 'unknown' };
  if (available === null) return { kind: 'not_available' };
  if (available <= 0) return { kind: 'sold_out' };
  if (available <= LOW_STOCK) return { kind: 'low', left: available };
  return { kind: 'in_stock' };
}

export function stockLabel(level: StockLevel): string | null {
  switch (level.kind) {
    case 'sold_out':
      return 'Sold out';
    case 'not_available':
      return 'Not available';
    case 'low':
      return `Only ${level.left} left`;
    case 'in_stock':
      return 'In stock';
    default:
      return null;
  }
}

/** Sold out or not orderable: the SKU cannot be added to a cart. */
export function cannotBuy(level: StockLevel): boolean {
  return level.kind === 'sold_out' || level.kind === 'not_available';
}
