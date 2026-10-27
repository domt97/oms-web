import { addLine, setLineQuantity, type CartLine } from '../../domain/cart';
import type { Customer } from '../../domain/customer';
import { AppError } from '../../domain/errors';
import { isValidPhone, splitIntoOrders, type Order } from '../../domain/order';
import type { CartPort, OrderPort, SellerWorkspacePort, SessionPort, WorkspaceState } from '../../ports';
import { createPersistentStore, isArray, isObject, newId, type PersistentStore } from './storage';

// TEMPORARY adapters until identity, cart-service and order-service exist (docs/architecture.md §1).

/** MOCK sign-in: name + phone, no password, no server. */
export function createLocalSession(): SessionPort {
  const store = createPersistentStore<Customer | null>('session', null, (v): v is Customer | null => v === null || isObject<Customer>(v));
  return {
    get: store.get,
    subscribe: store.subscribe,
    async signIn(name, phone) {
      if (!name.trim()) throw new AppError(400, 'Enter your name.');
      if (!isValidPhone(phone)) throw new AppError(400, 'Enter a valid Vietnamese phone number.');
      const normalised = phone.replace(/[\s.-]/g, '');
      // The same phone signs into the same mock account (stable id), so its cart and orders come back.
      const id = `mock-${normalised}`;
      const customer: Customer = { id, name: name.trim(), phone: normalised };
      store.set(customer);
      return customer;
    },
    signOut: () => store.set(null),
  };
}

/**
 * Per-customer store that follows the session: BR-CRT-01 (one cart per logged-in customer), so switching
 * the mock user never shows another user's cart. Signed out = empty and read-only.
 */
function perCustomer<T>(session: SessionPort, name: string, initial: T, isValid: (v: unknown) => v is T) {
  const stores = new Map<string, PersistentStore<T>>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const current = (): PersistentStore<T> | undefined => {
    const c = session.get();
    if (!c) return undefined;
    let s = stores.get(c.id);
    if (!s) {
      s = createPersistentStore<T>(`${name}:${c.id}`, initial, isValid);
      s.subscribe(notify);
      stores.set(c.id, s);
    }
    return s;
  };
  session.subscribe(notify);
  return {
    get: (): T => current()?.get() ?? initial,
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    update(fn: (t: T) => T) {
      const s = current();
      if (!s) throw new AppError(401, 'Sign in to use the cart.');
      s.update(fn);
    },
  };
}

export function createLocalCart(session: SessionPort): CartPort {
  const empty: CartLine[] = [];
  const store = perCustomer<CartLine[]>(session, 'cart', empty, isArray);
  return {
    get: store.get,
    subscribe: store.subscribe,
    add: (line, available) => store.update((lines) => addLine(lines, line, available)),
    setQuantity: (skuId, quantity) => store.update((lines) => setLineQuantity(lines, skuId, quantity)),
    remove: (skuId) => store.update((lines) => lines.filter((l) => l.skuId !== skuId)),
    clear: () => store.update(() => []),
  };
}

/**
 * MOCK order placement: splits per store (BR-ORD-01) and keeps orders in the browser.
 * It does NOT validate or reserve stock, is not all-or-nothing (BR-ORD-14) and has no delivery fee (BR-PRC-03).
 */
export function createLocalOrders(session: SessionPort, cart: CartPort): OrderPort {
  const empty: Order[] = [];
  const store = perCustomer<Order[]>(session, 'orders', empty, isArray);
  let inFlight = false;
  return {
    get: store.get,
    subscribe: store.subscribe,
    async checkout(req) {
      const customer = session.get();
      if (!customer || customer.id !== req.customerId) throw new AppError(401, 'Sign in to place an order.');
      if (req.lines.length === 0) throw new AppError(400, 'Your cart is empty.');
      if (!isValidPhone(req.delivery.phone)) throw new AppError(400, 'Enter a valid Vietnamese phone number.');
      if (inFlight) throw new AppError(409, 'Your order is already being placed.');
      inFlight = true;
      try {
        const orders = splitIntoOrders(req, { checkoutId: newId(), newId, now: new Date().toISOString() });
        store.update((all) => [...orders, ...all]);
        cart.clear();
        return orders;
      } finally {
        inFlight = false;
      }
    },
  };
}

const emptyWorkspace: WorkspaceState = { merchants: [], stores: [], closures: {} };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  return [item, ...list.filter((x) => x.id !== item.id)];
}

/** Remembers what the backend cannot list yet (stores of a merchant, closures) and the chosen merchant. */
export function createLocalWorkspace(): SellerWorkspacePort {
  const store = createPersistentStore<WorkspaceState>(
    'seller-workspace',
    emptyWorkspace,
    (v): v is WorkspaceState => isObject<WorkspaceState>(v) && Array.isArray((v as WorkspaceState).stores) && Array.isArray((v as WorkspaceState).merchants),
  );
  return {
    get: store.get,
    subscribe: store.subscribe,
    rememberMerchant: (m, makeCurrent = true) =>
      store.update((s) => ({ ...s, merchants: upsert(s.merchants, m), currentMerchantId: makeCurrent ? m.id : s.currentMerchantId })),
    forgetMerchant: (id) =>
      store.update((s) => ({
        ...s,
        merchants: s.merchants.filter((m) => m.id !== id),
        stores: s.stores.filter((x) => x.merchantId !== id),
        currentMerchantId: s.currentMerchantId === id ? undefined : s.currentMerchantId,
      })),
    rememberStore: (st) => store.update((s) => ({ ...s, stores: upsert(s.stores, st) })),
    forgetStore: (id) => store.update((s) => ({ ...s, stores: s.stores.filter((x) => x.id !== id) })),
    rememberClosure: (a) => store.update((s) => ({ ...s, closures: { ...(s.closures ?? {}), [a.storeId]: upsert(s.closures?.[a.storeId] ?? [], a) } })),
  };
}
