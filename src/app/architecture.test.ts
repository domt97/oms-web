import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

// @ts-expect-error plain JS module without type declarations
const { check } = await import('../../scripts/check-architecture.mjs');

describe('dependency rule (docs/architecture.md §2)', () => {
  it('holds for the code base', () => assert.deepEqual(check(), []));

  it('catches a feature importing an adapter, cross-app imports and React in the domain', () => {
    const root = mkdtempSync(join(tmpdir(), 'arch-'));
    for (const d of ['domain', 'adapters', 'features/storefront', 'features/seller']) mkdirSync(join(root, d), { recursive: true });
    writeFileSync(join(root, 'adapters/a.ts'), 'export const a = 1;');
    writeFileSync(join(root, 'features/seller/s.ts'), 'export const s = 1;');
    // Built from parts so the checker does not read these fixture strings as this file's own imports.
    const I = ['im', 'port'].join('');
    const E = ['ex', 'port'].join('');
    writeFileSync(join(root, 'features/storefront/x.tsx'), `${I} { a } from '../../adapters/a';\n${E} { s } from '../seller/s';\nconst lazy = () => ${I}('../seller/s');`);
    writeFileSync(join(root, 'domain/d.ts'), `${I} type { ReactNode } from 'react';`);
    const v: string[] = check(root);
    assert.equal(v.length, 4, v.join('\n'));
  });
});
