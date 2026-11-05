import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { movementLabel } from './format';

describe('movement labels', () => {
  it('labels known types, including order holds (BR-INV-05)', () => {
    assert.equal(movementLabel('RECEIVE'), 'Receive');
    assert.equal(movementLabel('RESERVE'), 'Reserved for order');
    assert.equal(movementLabel('RESERVE_EXPIRE'), 'Hold expired');
  });
  it('shows a type this build does not know as its raw code', () => {
    assert.equal(movementLabel('SOMETHING_NEW'), 'SOMETHING_NEW');
    assert.equal(movementLabel('toString'), 'toString');
  });
});
