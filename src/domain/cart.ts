import { LOW_STOCK } from './inventory';
import { CURRENCY, lineTotal } from './money';

/** A line in the shopper's cart. Price is a snapshot for display; the order service will reprice. */
export interface CartLine {
  merchantId: string;
  storeId: string;
  storeName: string;
  productId: string;
  productName: string;
  skuId: string;
  sku: string;
  skuName?: string | null;
  price: number;
  currency: string;
  thumbnailUrl?: string | null;
  quantity: number;
}

export interface ShopGroup {
  merchantId: string;
  storeId: string;
  storeName: string;
  lines: CartLine[];
  subtotal: number;
  itemCount: number;
}

/** Per-line maximum, BR-CRT-02 (decided 2026-10-27). */
export const MAX_LINE_QUANTITY = 99;

export function itemCount(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export function subtotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l.price, l.quantity), 0);
}

/** Business rule Q3: one checkout may contain several stores; it becomes one order per store. */
export function groupByShop(lines: CartLine[]): ShopGroup[] {
  const groups = new Map<string, ShopGroup>();
  for (const line of lines) {
    const g = groups.get(line.storeId) ?? {
      merchantId: line.merchantId,
      storeId: line.storeId,
      storeName: line.storeName,
      lines: [],
      subtotal: 0,
      itemCount: 0,
    };
    g.lines.push(line);
    groups.set(line.storeId, g);
  }
  return [...groups.values()].map((g) => ({ ...g, subtotal: subtotal(g.lines), itemCount: itemCount(g.lines) }));
}

/**
 * Quantity the cart may hold: at least 1 and at most MAX_LINE_QUANTITY. Stock caps it only when stock is low
 * (≤ LOW_STOCK) — capping at a higher count would reveal it (decision 2026-10-27); a larger shortfall is
 * flagged in the cart instead. Display guard only — the order service reserves stock atomically.
 */
export function clampQuantity(wanted: number, available?: number): number {
  const capByStock = available !== undefined && available <= LOW_STOCK;
  const upper = capByStock ? Math.min(MAX_LINE_QUANTITY, Math.max(0, available)) : MAX_LINE_QUANTITY;
  if (upper === 0) return 0;
  return Math.max(1, Math.min(Math.floor(wanted), upper));
}

/** Adds a line or increases an existing one (same SKU); returns a new array. */
export function addLine(lines: CartLine[], line: CartLine, available?: number): CartLine[] {
  const existing = lines.find((l) => l.skuId === line.skuId);
  if (!existing) {
    const q = clampQuantity(line.quantity, available);
    return q > 0 ? [...lines, { ...line, quantity: q }] : lines;
  }
  const q = clampQuantity(existing.quantity + line.quantity, available);
  return lines.map((l) => (l.skuId === line.skuId ? { ...l, quantity: q } : l));
}

export function setLineQuantity(lines: CartLine[], skuId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.skuId !== skuId);
  return lines.map((l) => (l.skuId === skuId ? { ...l, quantity: clampQuantity(quantity) } : l));
}

/** Fresh facts about a cart line, fetched when the cart is viewed (BR-CRT-03). */
export interface LineCheck {
  /** undefined = unknown (no inventory record, or the check failed) */
  available?: number;
  /** false when the product/SKU is no longer ACTIVE or no longer exists */
  onSale: boolean;
  /** false when the store is not ACTIVE */
  storeTakesOrders: boolean;
  /** current price, to flag a change */
  price?: number;
}

export type LineIssue =
  | { kind: 'unavailable'; message: string }
  | { kind: 'store_closed'; message: string }
  | { kind: 'not_enough_stock'; message: string; available: number }
  | { kind: 'price_changed'; message: string; price: number }
  | { kind: 'currency'; message: string };

/**
 * Decision 2026-10-27 (BR-CRT-03): flag problems on the line, never remove it silently.
 * Blocking issues stop checkout until the shopper fixes them; a price change is informational.
 */
export function checkLine(line: CartLine, check: LineCheck | undefined): LineIssue[] {
  const issues: LineIssue[] = [];
  if (line.currency !== CURRENCY) issues.push({ kind: 'currency', message: `Price is in ${line.currency}, not ${CURRENCY}` });
  if (!check) return issues;
  if (!check.storeTakesOrders) issues.push({ kind: 'store_closed', message: 'Shop is not taking orders' });
  if (!check.onSale) issues.push({ kind: 'unavailable', message: 'No longer available' });
  else if (check.available !== undefined && check.available < line.quantity)
    issues.push({
      kind: 'not_enough_stock',
      available: Math.max(0, check.available),
      // Never reveal a count above LOW_STOCK (decision 2026-10-27).
      message: check.available <= 0 ? 'Sold out' : check.available <= LOW_STOCK ? `Only ${check.available} left` : 'Not enough stock for this quantity',
    });
  if (check.price !== undefined && check.price !== line.price) issues.push({ kind: 'price_changed', price: check.price, message: 'Price changed' });
  return issues;
}

export function isBlocking(issue: LineIssue): boolean {
  return issue.kind !== 'price_changed';
}
