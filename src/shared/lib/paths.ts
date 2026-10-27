// Pure path helpers (no React), shared by the router and tested directly.

// Reserved prefixes — never used by app routes (they belong to the API proxy and the build):
export const RESERVED_PREFIXES = ['/v1/', '/internal/', '/assets/'];

export type Params = Record<string, string>;

/**
 * A post-login target is accepted only if it stays on this origin and in the storefront:
 * no "//host", no "\\", no control characters, no Seller Centre, no reserved prefixes.
 */
export function safeReturnPath(next: string | null | undefined, origin = window.location.origin): string {
  if (!next || !next.startsWith('/') || /[\\\u0000-\u001f]/.test(next)) return '/';
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return '/';
  }
  if (url.origin !== origin) return '/';
  const path = url.pathname;
  if (isUnder(path, '/seller') || RESERVED_PREFIXES.some((p) => path.startsWith(p))) return '/';
  return path + url.search;
}

/** Matches "/shop/:merchantId/:storeId" against a path; returns params or null. "*" matches the rest. */
export function matchPath(pattern: string, path: string): Params | null {
  const p = pattern.split('/').filter(Boolean);
  const a = path.split('/').filter(Boolean);
  const params: Params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '*') return params;
    if (i >= a.length) return null;
    if (p[i].startsWith(':')) {
      try {
        params[p[i].slice(1)] = decodeURIComponent(a[i]);
      } catch {
        return null; // malformed escape (e.g. "%E0") → no match → 404, not a crash
      }
    }
    else if (p[i] !== a[i]) return null;
  }
  return p.length === a.length ? params : null;
}

/** True for "/seller" and "/seller/…" but not "/sellers". */
export function isUnder(path: string, base: string): boolean {
  return path === base || path.startsWith(`${base}/`);
}
