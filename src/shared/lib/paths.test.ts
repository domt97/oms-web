import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isUnder, matchPath, safeReturnPath } from './paths';

const O = 'https://shop.example';

describe('router paths', () => {
  it('matches params and rejects malformed escapes instead of throwing', () => {
    assert.deepEqual(matchPath('/shop/:m/:s', '/shop/a/b'), { m: 'a', s: 'b' });
    assert.equal(matchPath('/shop/:m/:s', '/shop/%E0/x'), null);
    assert.equal(matchPath('/shop/:m/:s', '/shop/a'), null);
  });
  it('treats /seller as a segment, not a prefix', () => {
    assert.ok(isUnder('/seller', '/seller'));
    assert.ok(isUnder('/seller/m/1', '/seller'));
    assert.equal(isUnder('/sellers', '/seller'), false);
  });
});

describe('post-login return path (no open redirect)', () => {
  it('keeps same-origin storefront paths with their query', () => assert.equal(safeReturnPath('/product/a/b/c?x=1', O), '/product/a/b/c?x=1'));
  for (const bad of ['//evil.example', '/\\evil.example', '/\\\\evil', 'https://evil.example', '/seller/m/1', '/v1/store/merchants', '/\u0000x', 'evil', '']) {
    it(`rejects ${JSON.stringify(bad)}`, () => assert.equal(safeReturnPath(bad, O), '/'));
  }
});
