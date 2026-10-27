import type { CartLine, LineCheck } from '../../domain/cart';
import { isOnSale, matchesQuery, sellableSkus, type Page, type Product, type ProductSummary } from '../../domain/catalog';
import { toAppError } from '../../domain/errors';
import { stockBySku, type Inventory } from '../../domain/inventory';
import { takesOrders, type ShopRef, type Store } from '../../domain/store';
import type { CatalogPort, CatalogResult, InventoryPort, ProductCard, ProductPort, Shop, ShopDirectoryPort, StorePort } from '../../ports';

/**
 * TEMPORARY storefront catalog (docs/architecture.md §4.1) until a public catalog/search API exists (BR-USR-05).
 *
 * It fans out merchant-scoped stores-service calls over the shops from a ShopDirectory, with hard limits:
 *  - at most `maxShops` shops, `concurrency` requests in flight, `pageSize` (≤ 50) products per shop page;
 *  - all calls of one operation share the same concurrency pool;
 *  - feed/search read the first `pagesPerShop` pages of each shop and filter on the client
 *    (the backend search has no keyword or status filter) — so search only covers what was loaded;
 *  - one failing shop never fails the page: results carry `shopsFailed`;
 *  - list pages never call inventory-service; stock is read on the product page and in the cart only;
 *  - only ACTIVE stores and ACTIVE products are shown (decision 2026-10-27).
 */
export interface AggregationLimits {
  maxShops: number;
  concurrency: number;
  pageSize: number;
  pagesPerShop: number;
  /** ms a shop's store detail is reused before refetching */
  storeTtlMs: number;
}

export const DEFAULT_LIMITS: AggregationLimits = { maxShops: 12, concurrency: 4, pageSize: 20, pagesPerShop: 1, storeTtlMs: 60_000 };
const MAX_PAGE_SIZE = 50;

/** Runs tasks with at most `limit` in flight; never rejects. */
export async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}

export function createAggregatingCatalog(
  deps: { directory: ShopDirectoryPort; stores: StorePort; products: ProductPort; inventory: InventoryPort },
  limits: Partial<AggregationLimits> = {},
  clock: () => number = Date.now,
): CatalogPort {
  const L = { ...DEFAULT_LIMITS, ...limits, pageSize: Math.min(MAX_PAGE_SIZE, limits.pageSize ?? DEFAULT_LIMITS.pageSize) };
  const storeCache = new Map<string, { at: number; store: Promise<Store> }>();

  // Keyed by merchant AND store: the backend checks the pair (findByMerchantIdAndStoreId), so must the cache.
  function getStore(merchantId: string, storeId: string): Promise<Store> {
    const key = `${merchantId}/${storeId}`;
    const hit = storeCache.get(key);
    if (hit && clock() - hit.at < L.storeTtlMs) return hit.store;
    const store = deps.stores.get(merchantId, storeId);
    storeCache.set(key, { at: clock(), store });
    store.catch(() => storeCache.delete(key));
    return store;
  }

  async function shopRefs(): Promise<ShopRef[]> {
    const seen = new Set<string>();
    return (await deps.directory.list()).filter((s) => !seen.has(s.storeId) && seen.add(s.storeId)).slice(0, L.maxShops);
  }

  async function loadShops(): Promise<CatalogResult<Shop>> {
    const refs = await shopRefs();
    const settled = await mapLimited(refs, L.concurrency, (r) => getStore(r.merchantId, r.storeId));
    const shops: Shop[] = refs.map((r, i) => {
      const s = settled[i];
      return s.status === 'fulfilled' ? { ...r, name: s.value.name, store: s.value } : { ...r, error: toAppError(s.reason).message };
    });
    return { items: shops, shopsSearched: refs.length, shopsFailed: shops.filter((s) => s.error).length };
  }

  const toCard = (shop: Shop) => (p: ProductSummary): ProductCard => ({ ...p, merchantId: shop.merchantId, shopName: shop.store?.name ?? shop.name });

  async function loadProducts(): Promise<CatalogResult<ProductCard>> {
    const shops = await loadShops();
    const open = shops.items.filter((s) => s.store && takesOrders(s.store));
    const pages = open.flatMap((shop) => Array.from({ length: L.pagesPerShop }, (_, page) => ({ shop, page })));
    const settled = await mapLimited(pages, L.concurrency, ({ shop, page }) => deps.products.list(shop.merchantId, shop.storeId, page, L.pageSize));
    const failedShops = new Set<string>(shops.items.filter((s) => s.error).map((s) => s.storeId));
    const byId = new Map<string, ProductCard>();
    settled.forEach((r, i) => {
      if (r.status === 'rejected') {
        failedShops.add(pages[i].shop.storeId);
        return;
      }
      for (const p of r.value.items) if (isOnSale(p) && !byId.has(p.id)) byId.set(p.id, toCard(pages[i].shop)(p));
    });
    const items = [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, shopsSearched: shops.shopsSearched, shopsFailed: failedShops.size };
  }

  return {
    async listShops() {
      const r = await loadShops();
      return { ...r, items: r.items.filter((s) => !s.store || takesOrders(s.store)) };
    },
    getShop: (merchantId, storeId) => getStore(merchantId, storeId),
    async shopProducts(merchantId, storeId, page): Promise<Page<ProductCard>> {
      const [store, result] = await Promise.all([getStore(merchantId, storeId), deps.products.list(merchantId, storeId, page, L.pageSize)]);
      const shop: Shop = { merchantId, storeId, name: store.name, store };
      return { ...result, items: result.items.filter(isOnSale).map(toCard(shop)) };
    },
    feed: loadProducts,
    async search(query) {
      const r = await loadProducts();
      return { ...r, items: r.items.filter((p) => matchesQuery(p, query)) };
    },
    getProduct: (merchantId, storeId, productId) => deps.products.get(merchantId, storeId, productId),
    // Maps only availableQuantity: on-hand and reserved counts never leave the adapter.
    stock: async (productId) => stockBySku(await deps.inventory.byProduct(productId)),
    async checkCart(lines: CartLine[]) {
      const productKeys = [...new Map(lines.map((l) => [l.productId, l])).values()];
      const storeKeys = [...new Map(lines.map((l) => [l.storeId, l])).values()];
      // One pool for all calls so at most `concurrency` requests are in flight.
      type Task = { kind: 'product' | 'stock' | 'store'; line: CartLine };
      const tasks: Task[] = [
        ...productKeys.map((line) => ({ kind: 'product' as const, line })),
        ...productKeys.map((line) => ({ kind: 'stock' as const, line })),
        ...storeKeys.map((line) => ({ kind: 'store' as const, line })),
      ];
      const settled = await mapLimited<Task, unknown>(tasks, L.concurrency, (t) =>
        t.kind === 'product'
          ? deps.products.get(t.line.merchantId, t.line.storeId, t.line.productId)
          : t.kind === 'stock'
            ? deps.inventory.byProduct(t.line.productId)
            : getStore(t.line.merchantId, t.line.storeId),
      );
      const n = productKeys.length;
      const products = settled.slice(0, n) as PromiseSettledResult<Product>[];
      const stocks = settled.slice(n, 2 * n) as PromiseSettledResult<Inventory[]>[];
      const stores = settled.slice(2 * n) as PromiseSettledResult<Store>[];
      // A 404 product is a fact (no longer available), not a failed call.
      const failedCalls = settled.filter((r) => r.status === 'rejected' && !toAppError(r.reason).isNotFound).length;
      const checks: Record<string, LineCheck> = {};
      for (const line of lines) {
        const pi = productKeys.findIndex((k) => k.productId === line.productId);
        const si = storeKeys.findIndex((k) => k.storeId === line.storeId);
        const product = products[pi];
        const stock = stocks[pi];
        const store = stores[si];
        // Unknown (failed call) is not a reason to block: only a confirmed problem is flagged.
        const productKnown = product.status === 'fulfilled';
        const productMissing = product.status === 'rejected' && toAppError(product.reason).isNotFound;
        const sku = productKnown ? sellableSkus(product.value).find((k) => k.id === line.skuId) : undefined;
        checks[line.skuId] = {
          onSale: productMissing ? false : productKnown ? isOnSale(product.value) && !!sku : true,
          storeTakesOrders: store.status === 'fulfilled' ? takesOrders(store.value) : true,
          available: stock.status === 'fulfilled' ? stockBySku(stock.value)[line.sku] : undefined,
          price: sku?.price,
        };
      }
      return { checks, failedCalls };
    },
  };
}
