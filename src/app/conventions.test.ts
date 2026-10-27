import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const src = join(dirname(fileURLToPath(import.meta.url)), '..');

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) yield p;
  }
}

describe('React conventions', () => {
  // `useEffect(() => expr, deps)` returns expr to React as the cleanup. When expr is not a function
  // (Chrome's window.scrollTo returns a Promise) React throws "destroy is not a function" on unmount.
  it('effect callbacks use a block body', () => {
    const bad: string[] = [];
    for (const f of files(src)) {
      readFileSync(f, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\buse(?:Layout|Insertion)?Effect\(\s*\(\)\s*=>\s*[^{\s]/.test(line)) bad.push(`${relative(src, f)}:${i + 1}`);
        });
    }
    assert.deepEqual(bad, [], `write useEffect(() => { … }, deps):\n${bad.join('\n')}`);
  });
});
