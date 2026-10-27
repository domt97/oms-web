import type { ShopRef } from '../../domain/store';
import type { SellerWorkspacePort, ShopDirectoryPort } from '../../ports';

/**
 * TEMPORARY shop list for the storefront (decision 2026-10-27) until a public catalog lists shops:
 *  - featured shops from a config file served with the app (`public/storefront-shops.json`), editable without a rebuild;
 *  - in DEMO mode only, plus the stores created in the Seller Centre in this same browser.
 * The storefront never reads seller storage directly; only this adapter does, and only when demo mode is on.
 * Turn demo mode off for any shared deployment (VITE_STOREFRONT_DEMO=false).
 */
export function createShopDirectory(options: { configUrl: string; demoWorkspace?: SellerWorkspacePort; fetchImpl?: typeof fetch; timeoutMs?: number }): ShopDirectoryPort {
  const doFetch = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  let configured: Promise<ShopRef[] | null> | undefined;

  // Returns null on failure so a transient error is retried next time instead of being cached.
  async function loadConfig(): Promise<ShopRef[] | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 8000);
    try {
      const res = await doFetch(options.configUrl, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!res.ok) return res.status === 404 ? [] : null;
      const data: unknown = await res.json();
      const list = Array.isArray(data) ? data : typeof data === 'object' && data !== null && Array.isArray((data as { shops?: unknown }).shops) ? (data as { shops: unknown[] }).shops : [];
      return list.filter(
        (x): x is ShopRef => typeof x === 'object' && x !== null && typeof (x as ShopRef).merchantId === 'string' && typeof (x as ShopRef).storeId === 'string',
      ).map((x) => ({ merchantId: x.merchantId, storeId: x.storeId, name: typeof x.name === 'string' ? x.name : 'Shop' }));
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async list() {
      configured ??= loadConfig();
      const loaded = await configured;
      if (loaded === null) configured = undefined;
      const fromConfig = loaded ?? [];
      const fromDemo = options.demoWorkspace?.get().stores.map((s) => ({ merchantId: s.merchantId, storeId: s.id, name: s.name })) ?? [];
      return [...fromConfig, ...fromDemo];
    },
  };
}
