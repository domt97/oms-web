// Ports: what the UI needs, independent of where data comes from (HTTP, mock, storage).
// Features depend on these interfaces only; app/services.ts picks the adapters.

import type { CartLine, LineCheck } from '../domain/cart';
import type { Category, Collection, Page, Product, ProductSummary } from '../domain/catalog';
import type { Customer } from '../domain/customer';
import type { Inventory, StockBySku, StockMovement, StockMovementType } from '../domain/inventory';
import type { Merchant } from '../domain/merchant';
import type { CheckoutRequest, Order } from '../domain/order';
import type { Address, AvailabilityType, BusinessHour, ShopRef, Store, StoreAvailability, StoreConfig } from '../domain/store';

/** Something a component can subscribe to (local state owned by an adapter). */
export interface Observable<T> {
  get(): T;
  subscribe(listener: () => void): () => void;
}

// ---------------- storefront ----------------

export interface ProductCard extends ProductSummary {
  merchantId: string;
  shopName: string;
}

export interface Shop extends ShopRef {
  /** Loaded store; missing when it could not be loaded (see `error`). */
  store?: Store;
  error?: string;
}

/** Result of a fan-out over several shops: may be partial. */
export interface CatalogResult<T> {
  items: T[];
  shopsSearched: number;
  shopsFailed: number;
}

/**
 * Storefront read model. TEMPORARY implementation aggregates merchant-scoped stores-service calls
 * over a bounded list of shops (docs/architecture.md §4.1); a public catalog API will replace it.
 */
export interface CatalogPort {
  /** Shops shown to shoppers (only ACTIVE stores are listed). */
  listShops(): Promise<CatalogResult<Shop>>;
  getShop(merchantId: string, storeId: string): Promise<Store>;
  /** On-sale products of one shop, newest first. Pages may be short (client-side status filter). */
  shopProducts(merchantId: string, storeId: string, page: number): Promise<Page<ProductCard>>;
  /** Home feed: newest on-sale products across ACTIVE shops. */
  feed(): Promise<CatalogResult<ProductCard>>;
  /** Text search over the same bounded set the feed covers. */
  search(query: string): Promise<CatalogResult<ProductCard>>;
  getProduct(merchantId: string, storeId: string, productId: string): Promise<Product>;
  /** Available quantity per SKU code; undefined = unknown. Never exposes on-hand or reserved counts. */
  stock(productId: string): Promise<StockBySku>;
  /** Fresh facts for cart lines, keyed by skuId (BR-CRT-03); `failedCalls` > 0 means some facts are unknown. */
  checkCart(lines: CartLine[]): Promise<{ checks: Record<string, LineCheck>; failedCalls: number }>;
}

/** Where the storefront's shop list comes from until a public catalog exists. */
export interface ShopDirectoryPort {
  list(): Promise<ShopRef[]>;
}

export interface CategoryPort {
  list(): Category[];
}

/** The signed-in customer's cart (BR-CRT-01: one cart per logged-in customer). Empty when signed out. */
export interface CartPort extends Observable<CartLine[]> {
  add(line: CartLine, available?: number): void;
  setQuantity(skuId: string, quantity: number): void;
  remove(skuId: string): void;
  clear(): void;
}

export interface OrderPort extends Observable<Order[]> {
  /** Places one order per store (BR-ORD-01). Orders of the signed-in customer only. */
  checkout(req: CheckoutRequest): Promise<Order[]>;
}

export interface SessionPort extends Observable<Customer | null> {
  signIn(name: string, phone: string): Promise<Customer>;
  signOut(): void;
}

// ---------------- seller centre ----------------

export interface CreateStoreInput {
  code: string;
  name: string;
  ownerId: string;
  email?: string;
  phone?: string;
  address: Address;
  config: Omit<StoreConfig, 'openingTime' | 'closingTime'>;
  businessHours: BusinessHour[];
}

export interface CreateProductInput {
  name: string;
  description?: string;
  skus: Array<{ sku: string; name?: string; price: number; currency: string; weight?: number }>;
  images: Array<{ imageUrl: string; displayOrder: number }>;
}

export interface ImportResult {
  ok: boolean;
  totalRecords?: number | null;
  errorMessage?: string | null;
}

export interface MerchantPort {
  register(code: string, name: string): Promise<Merchant>;
  get(merchantId: string): Promise<Merchant>;
}

export interface StorePort {
  create(merchantId: string, input: CreateStoreInput): Promise<Store>;
  get(merchantId: string, storeId: string): Promise<Store>;
  close(merchantId: string, storeId: string): Promise<Store>;
  reopen(merchantId: string, storeId: string): Promise<Store>;
  updateConfig(merchantId: string, storeId: string, config: StoreConfig): Promise<Store>;
  updateBusinessHours(merchantId: string, storeId: string, hours: BusinessHour[]): Promise<Store>;
  addClosure(merchantId: string, storeId: string, input: { type: AvailabilityType; startTime: string; endTime?: string; reason?: string }): Promise<StoreAvailability>;
  cancelClosure(merchantId: string, storeId: string, availabilityId: string): Promise<void>;
}

export interface ProductPort {
  create(merchantId: string, storeId: string, input: CreateProductInput): Promise<Product>;
  get(merchantId: string, storeId: string, productId: string): Promise<Product>;
  /** Newest first. `notInCollectionId` leaves out the products already in that collection of the store. */
  list(merchantId: string, storeId: string, page: number, size: number, options?: { notInCollectionId?: string }): Promise<Page<ProductSummary>>;
  importFromS3(merchantId: string, storeId: string, bucket: string, key: string): Promise<ImportResult>;
}

export interface CollectionPort {
  list(merchantId: string, storeId: string): Promise<Collection[]>;
  get(merchantId: string, storeId: string, collectionId: string): Promise<Collection>;
  /** Products in the collection, A→Z by name. */
  products(merchantId: string, storeId: string, collectionId: string, page: number, size: number): Promise<Page<ProductSummary>>;
  create(merchantId: string, storeId: string, input: { name: string; description?: string }): Promise<Collection>;
  addProducts(merchantId: string, storeId: string, collectionId: string, productIds: string[]): Promise<Collection>;
  removeProducts(merchantId: string, storeId: string, collectionId: string, productIds: string[]): Promise<Collection>;
}

export interface InventoryPort {
  byProduct(productId: string): Promise<Inventory[]>;
  adjust(inventoryId: string, input: { merchantId: string; storeId: string; type: StockMovementType; quantity: number; reason?: string }): Promise<Inventory>;
  movements(inventoryId: string): Promise<StockMovement[]>;
}

export interface RememberedMerchant {
  id: string;
  code: string;
  name: string;
}

export interface RememberedStore {
  id: string;
  merchantId: string;
  code: string;
  name: string;
}

export interface WorkspaceState {
  currentMerchantId?: string;
  merchants: RememberedMerchant[];
  stores: RememberedStore[];
  closures: Record<string, StoreAvailability[]>;
}

/**
 * What the Seller Centre remembers because the backend cannot list it yet
 * (stores of a merchant, closures of a store) and because there is no login.
 */
export interface SellerWorkspacePort extends Observable<WorkspaceState> {
  rememberMerchant(m: RememberedMerchant, makeCurrent?: boolean): void;
  forgetMerchant(id: string): void;
  rememberStore(s: RememberedStore): void;
  forgetStore(id: string): void;
  rememberClosure(a: StoreAvailability): void;
}

/** Everything the app needs, wired in app/services.ts. */
export interface Services {
  catalog: CatalogPort;
  categories: CategoryPort;
  cart: CartPort;
  orders: OrderPort;
  session: SessionPort;
  merchants: MerchantPort;
  stores: StorePort;
  products: ProductPort;
  collections: CollectionPort;
  inventory: InventoryPort;
  workspace: SellerWorkspacePort;
  flags: FeatureFlags;
}

/** Runtime switches read from config (app/config.ts). */
export interface FeatureFlags {
  /** Demo deployment: storefront also lists same-browser Seller Centre stores; risky tools (S3 import) are shown. */
  demo: boolean;
}
