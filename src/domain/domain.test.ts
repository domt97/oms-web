import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addLine, clampQuantity, groupByShop, MAX_LINE_QUANTITY, setLineQuantity, subtotal, type CartLine } from './cart';
import { matchesQuery } from './catalog';
import { isStockOut } from './inventory';
import { isValidMerchantCode, normaliseMerchantCode } from './merchant';
import { formatMoney, formatPriceRange } from './money';
import { isValidPhone, splitIntoOrders } from './order';
import { isOpenNow, normaliseHours, type Store } from './store';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  merchantId: 'm1',
  storeId: 's1',
  storeName: 'Shop 1',
  productId: 'p1',
  productName: 'Tea',
  skuId: 'k1',
  sku: 'TEA-M',
  price: 35000,
  currency: 'VND',
  quantity: 1,
  ...over,
});

describe('money (VND, Q9/Q33)', () => {
  it('formats whole đồng', () => {
    assert.equal(formatMoney(35000), '₫35,000');
    assert.equal(formatMoney(null), '—');
  });
  it('formats a range, collapsing equal bounds', () => {
    assert.equal(formatPriceRange(35000, 35000), '₫35,000');
    assert.equal(formatPriceRange(35000, 42000), '₫35,000 – ₫42,000');
  });
});

describe('merchant code (BR-MER-04)', () => {
  it('accepts 1–50 ASCII letters/digits, trimmed', () => {
    assert.ok(isValidMerchantCode(' Tea2Go '));
    assert.ok(isValidMerchantCode('A'.repeat(50)));
  });
  it('rejects symbols, spaces, accents and >50', () => {
    for (const bad of ['M-001', 'M 001', 'TRÀ', '', 'A'.repeat(51)]) assert.equal(isValidMerchantCode(bad), false, bad);
  });
  it('normalises to upper case', () => assert.equal(normaliseMerchantCode(' m001 '), 'M001'));
});

describe('cart (Q3: one order per store)', () => {
  it('groups lines by shop with subtotals', () => {
    const g = groupByShop([line(), line({ skuId: 'k2', quantity: 2 }), line({ storeId: 's2', storeName: 'Shop 2', skuId: 'k3' })]);
    assert.equal(g.length, 2);
    assert.equal(g[0].subtotal, 35000 * 3);
    assert.equal(g[0].itemCount, 3);
    assert.equal(g[1].storeName, 'Shop 2');
  });
  it('merges the same SKU and caps at available stock', () => {
    let lines = addLine([], line({ quantity: 2 }), 3);
    lines = addLine(lines, line({ quantity: 5 }), 3);
    assert.equal(lines.length, 1);
    assert.equal(lines[0].quantity, 3);
  });
  it('does not add a sold-out SKU', () => assert.deepEqual(addLine([], line(), 0), []));
  it('clamps quantity to 1..MAX', () => {
    assert.equal(clampQuantity(0), 1);
    assert.equal(clampQuantity(1000), MAX_LINE_QUANTITY);
    assert.equal(clampQuantity(5, 2), 2);
  });
  it('removes a line when quantity drops to 0', () => assert.deepEqual(setLineQuantity([line()], 'k1', 0), []));
  it('computes subtotal', () => assert.equal(subtotal([line({ quantity: 2 }), line({ skuId: 'k2', price: 10000 })]), 80000));
});

describe('checkout split (Q3)', () => {
  it('creates one order per store, sharing the checkout id', () => {
    let n = 0;
    const orders = splitIntoOrders(
      { customerId: 'c1', lines: [line(), line({ storeId: 's2', storeName: 'Shop 2', skuId: 'k9', price: 20000 })], delivery: { recipient: 'A', phone: '0900000000', address: 'X' }, payment: 'COD' },
      { checkoutId: 'co1', newId: () => `o${++n}`, now: '2026-10-27T00:00:00Z' },
    );
    assert.equal(orders.length, 2);
    assert.deepEqual(orders.map((o) => o.total), [35000, 20000]);
    assert.ok(orders.every((o) => o.checkoutId === 'co1' && o.customerId === 'c1'));
  });
  it('validates Vietnamese phone numbers', () => {
    assert.ok(isValidPhone('0900 000 000'));
    assert.ok(isValidPhone('+84900000000'));
    assert.equal(isValidPhone('12345'), false);
  });
});

describe('store open-now hint', () => {
  const store = (closed = false): Pick<Store, 'status' | 'config' | 'businessHours'> => ({
    status: 'ACTIVE',
    config: { timeZone: 'Asia/Ho_Chi_Minh', autoAcceptOrder: false, allowPreOrder: false, currency: 'VND', preparationTimeMinutes: 10 },
    businessHours: normaliseHours([]).map((h) => ({ ...h, openingTime: '08:00', closingTime: '22:00', closed })),
  });
  // 2026-10-27T03:00Z = 10:00 in Ho Chi Minh City (UTC+7)
  const at10 = new Date('2026-10-27T03:00:00Z');
  const at23 = new Date('2026-10-27T16:00:00Z');
  it('is open inside hours in the store time zone', () => assert.equal(isOpenNow(store(), at10), true));
  it('is closed outside hours', () => assert.equal(isOpenNow(store(), at23), false));
  it('is closed on a closed day or when the store is not ACTIVE', () => {
    assert.equal(isOpenNow(store(true), at10), false);
    assert.equal(isOpenNow({ ...store(), status: 'CLOSED' }, at10), false);
  });
});

describe('search', () => {
  it('matches without accents and case', () => {
    assert.ok(matchesQuery({ name: 'Trà sữa trân châu', description: null }, 'tra sua'));
    assert.ok(matchesQuery({ name: 'Đậu hũ', description: null }, 'dau'));
    assert.equal(matchesQuery({ name: 'Coffee', description: 'iced' }, 'tea'), false);
  });
});

describe('inventory', () => {
  it('classifies stock-out movements like inventory-service', () => {
    assert.ok(isStockOut('DAMAGE'));
    assert.equal(isStockOut('RECEIVE'), false);
  });
});

describe('stock level shown to shoppers (decision 2026-10-27)', async () => {
  const { stockLevel, stockLabel } = await import('./inventory');
  it('hides exact counts above the low-stock threshold', () => {
    assert.equal(stockLabel(stockLevel(40)), 'In stock');
    assert.equal(stockLabel(stockLevel(3)), 'Only 3 left');
    assert.equal(stockLabel(stockLevel(0)), 'Sold out');
    assert.equal(stockLabel(stockLevel(undefined)), null);
  });
});

describe('cart line checks (BR-CRT-03: flag, do not remove)', async () => {
  const { checkLine, isBlocking } = await import('./cart');
  it('flags not enough stock as blocking', () => {
    const issues = checkLine(line({ quantity: 3 }), { available: 2, onSale: true, storeTakesOrders: true });
    assert.equal(issues[0].kind, 'not_enough_stock');
    assert.ok(isBlocking(issues[0]));
  });
  it('treats unknown stock as fine', () => assert.deepEqual(checkLine(line(), { onSale: true, storeTakesOrders: true }), []));
  it('flags a closed store and an unavailable product', () => {
    const kinds = checkLine(line(), { onSale: false, storeTakesOrders: false }).map((i) => i.kind);
    assert.deepEqual(kinds, ['store_closed', 'unavailable']);
  });
  it('reports a price change without blocking', () => {
    const [i] = checkLine(line(), { onSale: true, storeTakesOrders: true, price: 39000 });
    assert.equal(i.kind, 'price_changed');
    assert.equal(isBlocking(i), false);
  });
});

describe('store hours boundary matches the backend', () => {
  it('is open at the closing minute (BusinessHour.isOpen is inclusive)', () => {
    const s: Pick<Store, 'status' | 'config' | 'businessHours'> = {
      status: 'ACTIVE',
      config: { timeZone: 'Asia/Ho_Chi_Minh', autoAcceptOrder: false, allowPreOrder: false, currency: 'VND', preparationTimeMinutes: 10 },
      businessHours: normaliseHours([]).map((h) => ({ ...h, openingTime: '08:00', closingTime: '22:00' })),
    };
    assert.equal(isOpenNow(s, new Date('2026-10-27T15:00:00Z')), true); // 22:00 local
    assert.equal(isOpenNow(s, new Date('2026-10-27T15:01:00Z')), false); // 22:01 local
  });
});

describe('untrusted image URLs', async () => {
  const { safeImageUrl } = await import('./catalog');
  it('allows only http(s)', () => {
    assert.equal(safeImageUrl('https://x/y.png'), 'https://x/y.png');
    assert.equal(safeImageUrl('javascript:alert(1)'), null);
    assert.equal(safeImageUrl('data:image/png;base64,AAA'), null);
  });
});

describe('no exact stock above the low-stock threshold anywhere (decision 2026-10-27)', async () => {
  const { checkLine, clampQuantity } = await import('./cart');
  it('cart message hides counts above LOW_STOCK', () => {
    const [i] = checkLine(line({ quantity: 50 }), { available: 37, onSale: true, storeTakesOrders: true });
    assert.equal(i.kind, 'not_enough_stock');
    assert.ok(!i.message.includes('37'), i.message);
  });
  it('quantity is not capped at a high stock count (that would reveal it)', () => {
    assert.equal(clampQuantity(50, 37), 50);
    assert.equal(clampQuantity(9, 3), 3);
  });
});

describe('business hours the backend can evaluate', async () => {
  const { hoursProblems, defaultBusinessHours } = await import('./store');
  it('accepts defaults, rejects missing or overnight times', () => {
    assert.deepEqual(hoursProblems(defaultBusinessHours()), []);
    const h = defaultBusinessHours();
    h[0] = { ...h[0], closingTime: '' };
    h[1] = { ...h[1], openingTime: '22:00', closingTime: '02:00' };
    assert.equal(hoursProblems(h).length, 2);
  });
});

describe('ids', async () => {
  const { isUuid, newId } = await import('./ids');
  it('generates UUID-shaped ids and validates them', () => {
    assert.ok(isUuid(newId()));
    assert.equal(isUuid('not-a-uuid'), false);
  });
});
