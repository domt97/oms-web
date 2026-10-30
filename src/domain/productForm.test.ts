import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Product } from './catalog';
import {
  classifyConflict,
  emptySkuRow,
  isAbsoluteHttpUrl,
  nextProductStatuses,
  removedSkus,
  productFormProblems,
  toEditForm,
  toUpdateInput,
  type ProductForm,
  type SkuFormRow,
} from './productForm';

const product = (over: Partial<Product> = {}): Product => ({
  id: 'p1',
  storeId: 's1',
  name: 'Milk Tea',
  description: 'Fresh',
  thumbnailUrl: 'https://img/thumb.jpg',
  categoryId: 'c1',
  status: 'ACTIVE',
  skus: [
    { id: 'k1', productId: 'p1', sku: 'MT-M', name: 'Medium', price: 30000, currency: 'VND', weight: 350.5, length: 10, width: 10, height: 15, status: 'ACTIVE' },
    { id: 'k2', productId: 'p1', sku: ' MT-L ', name: null, price: 45000, currency: 'VND', weight: null, length: null, width: null, height: null, status: 'INACTIVE' },
  ],
  images: [
    { id: 2, imageUrl: 'https://img/2.jpg', displayOrder: 5 },
    { id: 1, imageUrl: 'https://img/1.jpg', displayOrder: 1 },
  ],
  version: 4,
  createdAt: '2026-10-29T00:00:00Z',
  updatedAt: '2026-10-29T00:00:00Z',
  ...over,
});

const row = (over: Partial<SkuFormRow> = {}): SkuFormRow => ({ ...emptySkuRow(), sku: 'A', price: '1000', ...over });
const form = (over: Partial<ProductForm> = {}): ProductForm => ({ name: 'P', description: '', status: 'ACTIVE', skus: [row()], images: [], ...over });

describe('update-product form: no data loss (full replace)', () => {
  it('an untouched form sends back the stored state exactly (server sees no change)', () => {
    const p = product();

    const input = toUpdateInput(p, toEditForm(p));

    assert.deepEqual(input, {
      version: 4,
      name: 'Milk Tea',
      description: 'Fresh',
      thumbnailUrl: 'https://img/thumb.jpg',
      categoryId: 'c1',
      status: 'ACTIVE',
      skus: [
        { id: 'k1', sku: 'MT-M', name: 'Medium', price: 30000, currency: 'VND', weight: 350.5, length: 10, width: 10, height: 15, status: 'ACTIVE' },
        { id: 'k2', sku: ' MT-L ', name: null, price: 45000, currency: 'VND', weight: null, length: null, width: null, height: null, status: 'INACTIVE' },
      ],
      images: [
        { imageUrl: 'https://img/1.jpg', displayOrder: 1 },
        { imageUrl: 'https://img/2.jpg', displayOrder: 5 },
      ],
    });
  });

  it('keeps fields the form does not edit when other fields change; removed rows are left out; new rows are trimmed', () => {
    const p = product();
    const f = toEditForm(p);
    f.name = '  Bubble Tea ';
    f.skus = [{ ...f.skus[0], price: '32000' }, row({ sku: ' NEW ', name: ' Large ', weight: '' })];
    f.images = ['https://img/3.jpg'];

    const input = toUpdateInput(p, f);

    assert.equal(input.name, 'Bubble Tea');
    assert.equal(input.thumbnailUrl, 'https://img/thumb.jpg');
    assert.equal(input.categoryId, 'c1');
    assert.deepEqual(input.skus[0], { id: 'k1', sku: 'MT-M', name: 'Medium', price: 32000, currency: 'VND', weight: 350.5, length: 10, width: 10, height: 15, status: 'ACTIVE' });
    assert.deepEqual(input.skus[1], { sku: 'NEW', name: 'Large', price: 1000, currency: 'VND', weight: null, length: null, width: null, height: null, status: 'ACTIVE' });
    assert.equal(input.skus.length, 2, 'k2 removed');
    assert.deepEqual(input.images, [{ imageUrl: 'https://img/3.jpg', displayOrder: 0 }]);
  });

  it('a cleared description and option name are sent as null', () => {
    const p = product();
    const f = toEditForm(p);
    f.description = '';
    f.skus[0] = { ...f.skus[0], name: '' };

    const input = toUpdateInput(p, f);

    assert.equal(input.description, null);
    assert.equal(input.skus[0].name, null);
  });

  it('removing an option and typing its code again in a new row keeps that option (id, currency, dimensions)', () => {
    const p = product();
    const f = toEditForm(p);
    f.skus = [f.skus[1], row({ sku: ' MT-M ', name: 'Medium', price: '31000', weight: '350.5' })];

    const input = toUpdateInput(p, f);

    assert.deepEqual(input.skus[1], { id: 'k1', sku: 'MT-M', name: 'Medium', price: 31000, currency: 'VND', weight: 350.5, length: 10, width: 10, height: 15, status: 'ACTIVE' });
    assert.deepEqual(removedSkus(p, f), [], 'not announced as removed');
  });

  it('removedSkus lists the stored options the form leaves out', () => {
    const p = product();
    const f = toEditForm(p);
    f.skus = [f.skus[0]];
    assert.deepEqual(removedSkus(p, f).map((s) => s.id), ['k2']);
  });

  it('a cleared price on an existing option is refused (never sent as 0)', () => {
    const p = product();
    const f = toEditForm(p);
    f.skus[0] = { ...f.skus[0], price: '' };
    assert.throws(() => toUpdateInput(p, f), /price/);
  });

  it('refuses to build an update without a version (backend without the update API)', () => {
    assert.throws(() => toUpdateInput(product({ version: undefined }), toEditForm(product())));
  });
});

describe('update-product form: rules (BR-CAT-08..11, SKU price rule)', () => {
  it('status: never back to DRAFT', () => {
    assert.deepEqual(nextProductStatuses('DRAFT'), ['DRAFT', 'ACTIVE', 'INACTIVE']);
    assert.deepEqual(nextProductStatuses('ACTIVE'), ['ACTIVE', 'INACTIVE']);
    assert.deepEqual(nextProductStatuses('INACTIVE'), ['ACTIVE', 'INACTIVE']);
  });

  it('a valid form has no problems; codes are case-sensitive', () => {
    assert.deepEqual(productFormProblems(form({ skus: [row({ sku: 'a' }), row({ sku: 'A' })] })), []);
  });

  it('flags empty, blank and duplicate codes', () => {
    assert.ok(productFormProblems(form({ skus: [] })).some((p) => p.includes('at least one option')));
    assert.ok(productFormProblems(form({ skus: [row({ sku: ' ' })] })).some((p) => p.includes('SKU code')));
    assert.ok(productFormProblems(form({ skus: [row(), row({ sku: ' A ' })] })).some((p) => p.includes('Duplicate')));
  });

  it('existing codes are compared exactly as stored (not trimmed)', () => {
    assert.deepEqual(productFormProblems(form({ skus: [row({ id: 'k', sku: ' A ' }), row({ sku: 'A' })] })), []);
  });

  it('flags the limits: 101 options, 21 images, 5001-character description, 2049-character URL', () => {
    const manySkus = Array.from({ length: 101 }, (_, i) => row({ sku: `S${i}` }));
    assert.ok(productFormProblems(form({ skus: manySkus })).some((p) => p.includes('100 options')));
    const manyImages = Array.from({ length: 21 }, (_, i) => `https://img/${i}.jpg`);
    assert.ok(productFormProblems(form({ images: manyImages })).some((p) => p.includes('20 images')));
    assert.ok(productFormProblems(form({ description: 'x'.repeat(5001) })).some((p) => p.includes('description')));
    assert.ok(productFormProblems(form({ images: ['https://img/' + 'x'.repeat(2040)] })).some((p) => p.includes('2048')));
    assert.deepEqual(productFormProblems(form({ skus: Array.from({ length: 100 }, (_, i) => row({ sku: `S${i}` })) })), []);
  });

  it('prices: whole VND, at most 2 decimals otherwise, never negative or empty', () => {
    assert.ok(productFormProblems(form({ skus: [row({ price: '25500.5' })] })).some((p) => p.includes('whole')));
    assert.deepEqual(productFormProblems(form({ skus: [row({ price: '25500' })] })), []);
    assert.deepEqual(productFormProblems(form({ skus: [row({ price: '1.99', currency: 'USD' })] })), []);
    assert.ok(productFormProblems(form({ skus: [row({ price: '1.999', currency: 'USD' })] })).some((p) => p.includes('2 decimals')));
    assert.ok(productFormProblems(form({ skus: [row({ price: '-1' })] })).length > 0);
    assert.ok(productFormProblems(form({ skus: [row({ price: '' })] })).length > 0);
  });

  it('prices and weights are plain decimal numbers (no exponent, sign or separators)', () => {
    assert.ok(productFormProblems(form({ skus: [row({ price: '1e-3' })] })).length > 0);
    assert.ok(productFormProblems(form({ skus: [row({ price: '1e3' })] })).length > 0);
    assert.ok(productFormProblems(form({ skus: [row({ price: '1.5e1' })] })).length > 0);
    assert.ok(productFormProblems(form({ skus: [row({ price: '30,000' })] })).length > 0);
    assert.ok(productFormProblems(form({ skus: [row({ weight: '-1' })] })).length > 0);
  });

  it('the product needs a name of at most 255 characters', () => {
    assert.ok(productFormProblems({ ...form(), name: ' ' }).some((p) => p.includes('name')));
    assert.ok(productFormProblems({ ...form(), name: 'x'.repeat(256) }).some((p) => p.includes('255')));
    assert.deepEqual(productFormProblems({ ...form(), name: 'Milk Tea' }), []);
  });

  it('weight: optional, at most 2 decimals', () => {
    assert.deepEqual(productFormProblems(form({ skus: [row({ weight: '0.5' })] })), []);
    assert.ok(productFormProblems(form({ skus: [row({ weight: '0.125' })] })).some((p) => p.includes('weight')));
  });

  it('an on-sale product needs an option on sale; a product not on sale does not', () => {
    assert.ok(productFormProblems(form({ skus: [row({ status: 'INACTIVE' })] })).some((p) => p.includes('on-sale')));
    assert.deepEqual(productFormProblems(form({ status: 'INACTIVE', skus: [row({ status: 'INACTIVE' })] })), []);
  });

  it('images: only absolute http(s) URLs', () => {
    assert.equal(isAbsoluteHttpUrl('https://img/1.jpg'), true);
    assert.equal(isAbsoluteHttpUrl('/img/1.jpg'), false);
    assert.equal(isAbsoluteHttpUrl('javascript:alert(1)'), false);
    assert.ok(productFormProblems(form({ images: ['/relative.jpg'] })).some((p) => p.includes('http')));
  });
});

describe('update-product 409', () => {
  it('a newer version means someone else changed the product; the same version means a SKU code clash', () => {
    assert.equal(classifyConflict(4, 5), 'stale');
    assert.equal(classifyConflict(4, undefined), 'unknown', 'the re-read failed: show the server message only');
    assert.equal(classifyConflict(4, 4), 'code-in-use');
  });
});
