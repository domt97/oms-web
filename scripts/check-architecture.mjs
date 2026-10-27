#!/usr/bin/env node
// Enforces the dependency rule in docs/architecture.md §2. No dependencies: node scripts/check-architecture.mjs
// Covers static imports, `import type`, `export … from` and dynamic `import()`.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** layer id of a file path relative to src/ */
function layerOf(rel) {
  const [top, second] = rel.split(sep);
  if (top === 'features') return `features/${second}`;
  return top;
}

const ALLOWED = {
  domain: ['domain'],
  ports: ['domain', 'ports'],
  adapters: ['domain', 'ports', 'adapters'],
  shared: ['domain', 'ports', 'shared'],
  'features/storefront': ['domain', 'ports', 'shared', 'features/storefront'],
  'features/seller': ['domain', 'ports', 'shared', 'features/seller'],
  app: ['domain', 'ports', 'adapters', 'shared', 'features/storefront', 'features/seller', 'app'],
};

/** packages each layer may import (tests may also use node:*) */
const PACKAGES = {
  domain: [],
  ports: [],
  adapters: [],
  shared: ['react', 'react-dom'],
  'features/storefront': ['react'],
  'features/seller': ['react'],
  app: ['react', 'react-dom'],
};

// Statements start a line; the clause before `from` cannot contain quotes or `;`, so a match never spans strings.
const SPEC_RE = /^[ \t]*(?:import|export)\s+(?:type\s+)?(?:[^;'"`]*?\sfrom\s+)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/gm;

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) yield p;
  }
}

export function check(root = defaultRoot) {
  const violations = [];
  for (const file of walk(root)) {
    const rel = relative(root, file);
    const from = layerOf(rel);
    const isTest = /\.test\.tsx?$/.test(file);
    if (!ALLOWED[from]) {
      violations.push(`${rel}: file is outside the known layers`);
      continue;
    }
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(SPEC_RE)) {
      const spec = m[1] ?? m[2];
      if (spec.startsWith('.')) {
        const target = relative(root, resolve(dirname(file), spec));
        if (isTest && target.startsWith(`..${sep}scripts${sep}`)) continue;
        if (target.startsWith('..')) {
          violations.push(`${rel}: imports outside src (${spec})`);
          continue;
        }
        const to = layerOf(target);
        if (!ALLOWED[from].includes(to)) violations.push(`${rel}: ${from} must not import ${to} (${spec})`);
      } else {
        const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (isTest && spec.startsWith('node:')) continue;
        if (!PACKAGES[from].includes(pkg)) violations.push(`${rel}: ${from} must not import package "${spec}"`);
      }
    }
  }
  return violations;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const v = check();
  if (v.length) {
    console.error(`Architecture check failed (${v.length}):\n  ${v.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Architecture check passed.');
}
