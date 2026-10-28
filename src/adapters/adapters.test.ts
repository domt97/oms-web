import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Page, Product, ProductSummary } from '../domain/catalog';
import { AppError } from '../domain/errors';
import type { Inventory } from '../domain/inventory';
import type { Store } from '../domain/store';
import type { InventoryPort, ProductPort, ShopDirectoryPort, StorePort } from '../ports';
import { createAggregatingCatalog, mapLimited } from './catalog/aggregatingCatalog';
import { createHttpClient } from './http/client';
import { toPage, toProduct, toStore, toSummary } from './http/stores/mappers';
import { createCollectionAdapter, createProductAdapter } from './http/stores/storesService';

// ---------- fixtures shaped like the Java DTOs ----------

const storeJson = {
  id: 's1',
  merchantId: 'm1',
  name: 'Tea House',
  code: 'Q1',
  ownerId: 'o1',
  status: 'ACTIVE',
  address: { city: 'HCMC' },
  config: { autoAcceptOrder: false, allowPreOrder: true, openingTime: null, closingTime: null, timeZone: 'Asia/Ho_Chi_Minh', currency: 'VND', preparationTimeMinutes: 15, maxOrdersPerDay: null },
  businessHours: [{ dayOfWeek: 'MONDAY', openingTime: '08:00:00', closingTime: '22:00:00', closed: false }],
  createdAt: '2026-10-27T05:00:00Z',
  updatedAt: '2026-10-27T05:00:00Z',
} as const;

const pagedJson = {
  content: [
    { id: 'p1', storeId: 's1', name: 'Milk tea', status: 'ACTIVE', skuCount: 2, minPrice: 35000.0, maxPrice: 42000.0, currency: 'VND', createdAt: '2026-10-27T06:00:00Z' },
    { id: 'p2', storeId: 's1', name: 'Draft', status: 'DRAFT', skuCount: 1, minPrice: 1, maxPrice: 1, currency: 'VND', createdAt: '2026-10-27T07:00:00Z' },
  ],
  pageNumber: 0,
  pageSize: 20,
  totalElements: 2,
  totalPages: 1,
  last: true,
};

describe('stores-service mappers (anti-corruption layer)', () => {
  it('normalises LocalTime "HH:mm:ss" to "HH:mm"', () => {
    const s = toStore(storeJson as never);
    assert.equal(s.businessHours[0].openingTime, '08:00');
    assert.equal(s.businessHours[0].closingTime, '22:00');
  });
  it('maps PagedResult to Page and keeps numbers numeric', () => {
    const p = toPage(pagedJson as never, toSummary);
    assert.equal(p.items.length, 2);
    assert.equal(p.total, 2);
    assert.equal(typeof p.items[0].minPrice, 'number');
  });
  it('tolerates missing skus/images arrays', () => {
    const p = toProduct({ id: 'p', storeId: 's', name: 'x', status: 'ACTIVE', createdAt: '', updatedAt: '' } as never);
    assert.deepEqual(p.skus, []);
    assert.deepEqual(p.images, []);
  });
});

describe('http client', () => {
  const respond = (status: number, body: unknown) => async () => new Response(JSON.stringify(body), { status });
  it('surfaces 4xx messages from ErrorResponse', async () => {
    const http = createHttpClient({ fetchImpl: respond(409, { status: 409, error: 'Merchant code already exists' }) });
    await assert.rejects(http.post('/x', {}), (e: AppError) => e.status === 409 && e.message === 'Merchant code already exists');
  });
  it('hides raw 5xx text', async () => {
    const http = createHttpClient({ fetchImpl: respond(500, { error: 'java.lang.NullPointerException at ...' }) });
    await assert.rejects(http.get('/x'), (e: AppError) => e.status === 500 && !e.message.includes('NullPointer'));
  });
  it('sends an X-Request-Id', async () => {
    let seen: string | null = null;
    const http = createHttpClient({
      fetchImpl: async (_u, init) => {
        seen = new Headers(init?.headers).get('X-Request-Id');
        return new Response('{}', { status: 200 });
      },
    });
    await http.get('/x');
    assert.ok(seen && (seen as string).length >= 8);
  });
  it('turns a network failure into status 0', async () => {
    const http = createHttpClient({ fetchImpl: async () => Promise.reject(new TypeError('fetch failed')) });
    await assert.rejects(http.get('/x'), (e: AppError) => e.status === 0 && e.isUnavailable);
  });
});

describe('stores-service collection and product adapters', () => {
  function recording() {
    const urls: string[] = [];
    const http = createHttpClient({
      fetchImpl: async (u) => {
        urls.push(String(u));
        return new Response(JSON.stringify(pagedJson), { status: 200 });
      },
    });
    return { urls, http };
  }

  it('lists the products of a collection with paging only', async () => {
    const { urls, http } = recording();
    const page = await createCollectionAdapter(http).products('m1', 's1', 'c1', 2, 20);
    assert.equal(urls[0], '/v1/store/merchants/m1/stores/s1/collections/c1/products?pageNumber=2&pageSize=20');
    assert.equal(page.items[0].name, 'Milk tea');
    assert.equal(page.items[1].status, 'DRAFT');
  });

  it('sends notInCollectionId only when given', async () => {
    const { urls, http } = recording();
    const products = createProductAdapter(http);
    await products.list('m1', 's1', 0, 20, { notInCollectionId: 'c1' });
    await products.list('m1', 's1', 0, 20);
    assert.match(urls[0], /\/products\/search\?.*notInCollectionId=c1/);
    assert.doesNotMatch(urls[1], /notInCollectionId/);
  });
});

// ---------- aggregation ----------

function store(id: string, status: Store['status'] = 'ACTIVE'): Store {
  return { ...toStore({ ...storeJson, id } as never), status };
}

function summary(id: string, storeId: string, createdAt: string, status: ProductSummary['status'] = 'ACTIVE'): ProductSummary {
  return { id, storeId, name: `Product ${id}`, status, skuCount: 1, minPrice: 1000, maxPrice: 1000, currency: 'VND', createdAt };
}

function fakes(opts: { shops: string[]; failingStore?: string; failingList?: string; closed?: string[] }) {
  const calls = { list: 0, get: 0, inFlight: 0, maxInFlight: 0 };
  const directory: ShopDirectoryPort = { list: async () => opts.shops.map((id) => ({ merchantId: 'm1', storeId: id, name: id })) };
  const stores = {
    get: async (_m: string, id: string) => {
      calls.get++;
      if (id === opts.failingStore) throw new AppError(503, 'down');
      return store(id, opts.closed?.includes(id) ? 'CLOSED' : 'ACTIVE');
    },
  } as unknown as StorePort;
  const products = {
    list: async (_m: string, id: string): Promise<Page<ProductSummary>> => {
      calls.list++;
      calls.inFlight++;
      calls.maxInFlight = Math.max(calls.maxInFlight, calls.inFlight);
      await new Promise((r) => setTimeout(r, 5));
      calls.inFlight--;
      if (id === opts.failingList) throw new AppError(500, 'boom');
      return { items: [summary(`${id}-a`, id, '2026-10-27T01:00:00Z'), summary(`${id}-d`, id, '2026-10-27T09:00:00Z', 'DRAFT')], page: 0, size: 20, total: 2, totalPages: 1 };
    },
    get: async (): Promise<Product> => {
      throw new AppError(404, 'gone');
    },
  } as unknown as ProductPort;
  const inventory = {
    byProduct: async (): Promise<Inventory[]> => [{ id: 'i', productId: 'p', sku: 'K', merchantId: 'm1', storeId: 's', quantity: 9, reservedQuantity: 7, availableQuantity: 2, status: 'ACTIVE', updatedAt: '' }],
  } as unknown as InventoryPort;
  return { calls, catalog: createAggregatingCatalog({ directory, stores, products, inventory }, { maxShops: 3, concurrency: 2 }) };
}

describe('aggregating catalog (temporary storefront read model)', () => {
  it('caps the number of shops and the concurrency', async () => {
    const { calls, catalog } = fakes({ shops: ['a', 'b', 'c', 'd', 'e'] });
    const r = await catalog.feed();
    assert.equal(r.shopsSearched, 3);
    assert.equal(calls.list, 3);
    assert.ok(calls.maxInFlight <= 2);
  });
  it('shows only ACTIVE products of ACTIVE stores', async () => {
    const { catalog } = fakes({ shops: ['a', 'b'], closed: ['b'] });
    const r = await catalog.feed();
    assert.deepEqual(r.items.map((p) => p.id), ['a-a']);
  });
  it('returns partial results when a shop fails', async () => {
    const { catalog } = fakes({ shops: ['a', 'b', 'c'], failingStore: 'b', failingList: 'c' });
    const r = await catalog.feed();
    assert.deepEqual(r.items.map((p) => p.id), ['a-a']);
    assert.equal(r.shopsFailed, 2);
  });
  it('deduplicates shops listed twice', async () => {
    const { calls, catalog } = fakes({ shops: ['a', 'a'] });
    await catalog.feed();
    assert.equal(calls.list, 1);
  });
  it('exposes only available stock, never on-hand/reserved', async () => {
    const { catalog } = fakes({ shops: [] });
    assert.deepEqual(await catalog.stock('p'), { K: 2 });
  });
  it('flags a deleted product in the cart as unavailable', async () => {
    const { catalog } = fakes({ shops: [] });
    const { checks, failedCalls } = await catalog.checkCart([
      { merchantId: 'm1', storeId: 'a', storeName: 'a', productId: 'p', productName: 'x', skuId: 'k', sku: 'K', price: 1, currency: 'VND', quantity: 1 },
    ]);
    assert.equal(checks.k.onSale, false);
    assert.equal(checks.k.available, 2);
    assert.equal(failedCalls, 0, 'a 404 is a fact, not a failure');
  });
  it('counts failed calls in a cart check', async () => {
    const { catalog } = fakes({ shops: [], failingStore: 'a' });
    const { failedCalls } = await catalog.checkCart([
      { merchantId: 'm1', storeId: 'a', storeName: 'a', productId: 'p', productName: 'x', skuId: 'k', sku: 'K', price: 1, currency: 'VND', quantity: 1 },
    ]);
    assert.equal(failedCalls, 1);
  });
  it('caches stores per (merchant, store): another merchant id is not served from cache', async () => {
    const { calls, catalog } = fakes({ shops: [] });
    await catalog.getShop('m1', 'a');
    await catalog.getShop('m1', 'a');
    await catalog.getShop('m2', 'a');
    assert.equal(calls.get, 2);
  });
});

describe('mapLimited', () => {
  it('never rejects and keeps order', async () => {
    const r = await mapLimited([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('x');
      return n * 10;
    });
    assert.deepEqual(r.map((x) => x.status), ['fulfilled', 'rejected', 'fulfilled']);
  });
});
