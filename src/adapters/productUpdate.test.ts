import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppError } from '../domain/errors';
import type { UpdateProductInput } from '../ports';
import { createHttpClient } from './http/client';
import { toProduct } from './http/stores/mappers';
import { createProductAdapter } from './http/stores/storesService';

const productJson = {
  id: 'p1',
  storeId: 's1',
  name: 'Milk Tea',
  categoryId: 'c1',
  status: 'ACTIVE',
  version: 7,
  skus: [{ id: 'k1', productId: 'p1', sku: 'MT-M', price: 30000, currency: 'VND', weight: 350.5, length: 10, width: 11, height: 12, status: 'ACTIVE' }],
  images: [],
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
};

const input: UpdateProductInput = {
  version: 7,
  name: 'Milk Tea',
  description: null,
  thumbnailUrl: null,
  categoryId: 'c1',
  status: 'ACTIVE',
  skus: [{ id: 'k1', sku: 'MT-M', name: null, price: 30000, currency: 'VND', weight: 350.5, length: 10, width: 11, height: 12, status: 'ACTIVE' }],
  images: [{ imageUrl: 'https://img/1.jpg', displayOrder: 0 }],
};

describe('stores-service update-product adapter', () => {
  it('maps version, categoryId and SKU dimensions; a missing version stays missing', () => {
    const p = toProduct(productJson as never);
    assert.equal(p.version, 7);
    assert.equal(p.categoryId, 'c1');
    assert.deepEqual([p.skus[0].length, p.skus[0].width, p.skus[0].height, p.skus[0].weight], [10, 11, 12, 350.5]);
    assert.equal(toProduct({ ...productJson, version: undefined } as never).version, undefined);
  });

  it('sends a PUT to the product path with exactly the request fields', async () => {
    const calls: Array<{ url: string; method?: string; body: unknown }> = [];
    const http = createHttpClient({
      fetchImpl: async (u, init) => {
        calls.push({ url: String(u), method: init?.method, body: JSON.parse(String(init?.body)) });
        return new Response(JSON.stringify({ ...productJson, version: 8 }), { status: 200 });
      },
    });

    const saved = await createProductAdapter(http).update('m1', 's1', 'p1', { ...input, extra: 'ignored' } as never);

    assert.equal(calls[0].method, 'PUT');
    assert.equal(calls[0].url, '/v1/store/merchants/m1/stores/s1/products/p1');
    assert.deepEqual(calls[0].body, input);
    assert.equal(saved.version, 8);
  });

  it('a new SKU is sent without an id', async () => {
    let body: { skus: Array<Record<string, unknown>> } | undefined;
    const http = createHttpClient({
      fetchImpl: async (_u, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(JSON.stringify(productJson), { status: 200 });
      },
    });
    const newSku = { sku: 'NEW', name: null, price: 1000, currency: 'VND', weight: null, length: null, width: null, height: null, status: 'ACTIVE' as const };

    await createProductAdapter(http).update('m1', 's1', 'p1', { ...input, skus: [...input.skus, newSku] });

    assert.equal('id' in body!.skus[1], false);
  });

  it('a 409 surfaces as AppError 409 with the server message', async () => {
    const http = createHttpClient({
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: 409, error: 'The product was changed by someone else (current version 8); reload it and try again' }), { status: 409 }),
    });

    await assert.rejects(createProductAdapter(http).update('m1', 's1', 'p1', input), (e: unknown) => {
      assert.ok(e instanceof AppError);
      assert.equal(e.status, 409);
      assert.match(e.message, /changed by someone else/);
      return true;
    });
  });
});
