import { createAggregatingCatalog } from '../adapters/catalog/aggregatingCatalog';
import { createShopDirectory } from '../adapters/catalog/shopDirectory';
import { createHttpClient } from '../adapters/http/client';
import { createInventoryAdapter } from '../adapters/http/inventory/inventoryService';
import { createCollectionAdapter, createMerchantAdapter, createProductAdapter, createStoreAdapter } from '../adapters/http/stores/storesService';
import { createLocalCart, createLocalOrders, createLocalSession, createLocalWorkspace } from '../adapters/local/localAdapters';
import { createStaticCategories } from '../adapters/static/categories';
import type { Services } from '../ports';
import type { AppConfig } from './config';

/**
 * Composition root: the only place that knows which adapter implements which port.
 * Replacing a temporary adapter (catalog, cart, orders, session) is a change here and in adapters/ only.
 */
export function createServices(config: AppConfig): Services {
  const http = createHttpClient({ baseUrl: config.apiBaseUrl, timeoutMs: config.httpTimeoutMs });

  const merchants = createMerchantAdapter(http);
  const stores = createStoreAdapter(http);
  const products = createProductAdapter(http);
  const collections = createCollectionAdapter(http);
  const inventory = createInventoryAdapter(http);
  const workspace = createLocalWorkspace();

  const directory = createShopDirectory({
    configUrl: config.storefrontShopsUrl,
    demoWorkspace: config.storefrontDemo ? workspace : undefined,
  });
  const catalog = createAggregatingCatalog({ directory, stores, products, inventory });

  const session = createLocalSession();
  const cart = createLocalCart(session);
  const orders = createLocalOrders(session, cart);

  return {
    catalog,
    categories: createStaticCategories(),
    cart,
    orders,
    session,
    merchants,
    stores,
    products,
    collections,
    inventory,
    workspace,
    flags: { demo: config.storefrontDemo },
  };
}
