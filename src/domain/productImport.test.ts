import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { importFileProblem, MAX_IMPORT_BYTES } from './productImport';

describe('import file check (BR-CAT-13, BR-CAT-17)', () => {
  it('accepts .xlsx in any case, from 1 byte up to exactly 5 MB', () => {
    assert.equal(MAX_IMPORT_BYTES, 5_242_880);
    assert.equal(importFileProblem('products.xlsx', 1), null);
    assert.equal(importFileProblem('SẢN PHẨM.XLSX', MAX_IMPORT_BYTES), null);
  });
  it('rejects other file types', () => {
    for (const name of ['products.xls', 'products.csv', 'products', 'products.xlsx.exe', 'xlsx']) {
      assert.equal(importFileProblem(name, 100), 'Choose an Excel file (.xlsx).', name);
    }
  });
  it('rejects an empty file and one byte over 5 MB', () => {
    assert.equal(importFileProblem('p.xlsx', 0), 'The file is empty.');
    assert.equal(importFileProblem('p.xlsx', MAX_IMPORT_BYTES + 1), 'The file is larger than 5 MB.');
  });
});
