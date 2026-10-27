import type { CartLine } from './cart';
import { groupByShop } from './cart';

export type PaymentMethod = 'COD' | 'ONLINE';
export type OrderStatus = 'PLACED';

export interface DeliveryDetails {
  recipient: string;
  phone: string;
  address: string;
  note?: string;
}

export interface Order {
  id: string;
  checkoutId: string;
  customerId: string;
  merchantId: string;
  storeId: string;
  storeName: string;
  lines: CartLine[];
  total: number;
  delivery: DeliveryDetails;
  payment: PaymentMethod;
  status: OrderStatus;
  createdAt: string;
}

export interface CheckoutRequest {
  customerId: string;
  lines: CartLine[];
  delivery: DeliveryDetails;
  payment: PaymentMethod;
}

/** Q3: split a checkout into one order per store. Ids come from the caller so this stays pure. */
export function splitIntoOrders(req: CheckoutRequest, ids: { checkoutId: string; newId: () => string; now: string }): Order[] {
  return groupByShop(req.lines).map((g) => ({
    id: ids.newId(),
    checkoutId: ids.checkoutId,
    customerId: req.customerId,
    merchantId: g.merchantId,
    storeId: g.storeId,
    storeName: g.storeName,
    lines: g.lines,
    total: g.subtotal,
    delivery: req.delivery,
    payment: req.payment,
    status: 'PLACED',
    createdAt: ids.now,
  }));
}

const PHONE_RE = /^(\+?84|0)\d{9,10}$/;

/** Light format check for a Vietnamese phone number (display validation only). */
export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/[\s.-]/g, ''));
}
