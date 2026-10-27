# oms-web — Architecture

Status: **proposed** (2026-10-27) — accepted when the owner merges the first PR. Reviewed by `plan-reviewer`
(oms-workspace agent); its findings are applied below. Related: `oms-workspace` (system map, business rules, integration).

## 1. Context

oms-web is the browser front end of a multi-merchant marketplace for one market (Vietnam, VND).
Two audiences, two entry points, one codebase:

| App | Base path | Audience | Shape |
|-----|-----------|----------|-------|
| **Storefront** | `/` | Shoppers. Browsing is open; an account is required to build a cart and order (**BR-USR-02**) | Marketplace: search, home feed, shops, product, cart grouped by shop, checkout split per store (**BR-ORD-01**), my orders |
| **Seller Centre** | `/seller` | Merchant staff | Back office with its own layout: merchant, stores, products & stock, collections, settings, closures |

Shoppers never see seller UI; the Seller Centre is linked from the storefront's top strip and footer.
Both apps ship in one bundle for now. They share only `domain`, `ports`, `adapters` and `shared`, so they can
become two deployables later (§9).

### Backend reality (2026-10)

| Need | Backend today | Front end today |
|------|---------------|-----------------|
| Seller operations | stores-service `/v1/store/merchants/{merchantId}/…`, inventory-service `/v1/inventory/…` | HTTP adapters |
| Public catalog across merchants — shop list, feed, search (**BR-USR-05**, 🟢 later phase) | **Missing**; only per-store listing under a merchant path, no keyword/status filter | `AggregatingCatalogAdapter` with hard limits (§4.1) |
| Shop list for shoppers | **Missing** | `ShopDirectory`: featured-shops file + demo mode (§4.2) |
| Categories | **Missing** (`categoryId` exists, no API) | Static list; clicking runs a text search |
| Shopper identity | **Missing** | Mock session (name + phone) |
| Cart, orders, payment, delivery quote | **Missing** (cart-service, order-service planned) | Local mock adapters, clearly labelled |
| Merchant identity / login | **Missing** (Q36) | Merchant picked by id, remembered locally |

## 2. Layers and the dependency rule

```
src/
  domain/      pure TypeScript: models + rules. No React, no fetch, no storage.
  ports/       interfaces the UI needs (CatalogPort, CartPort, OrderPort, SessionPort, seller ports, Services)
  adapters/    port implementations: http/ (stores-service, inventory-service + DTOs + mappers), catalog/, local/, static/
  shared/      lib/ (router, async hooks, services context, formatting) and ui/ (kit, icons, styles). No business rules.
  features/
    storefront/  StorefrontApp (layout + routes) and pages: home, search, shop, product, cart, checkout, orders, account
    seller/      SellerApp (layout + routes) and pages: merchants, stores, products, collections
  app/         composition root: config.ts, services.ts (adapters → ports), main.tsx (picks the app by path)
```

Allowed imports — enforced by `npm run lint:arch` (`scripts/check-architecture.mjs`, also run as a test). The checker reads
static imports, `import type`, `export … from` and dynamic `import()`.

| From \ To | domain | ports | adapters | shared | features/storefront | features/seller | app | packages |
|-----------|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|:-----:|-----|
| domain    | ✓ | – | – | – | – | – | – | none |
| ports     | ✓ | ✓ | – | – | – | – | – | none |
| adapters  | ✓ | ✓ | ✓ | – | – | – | – | none |
| shared    | ✓ | ✓ | – | ✓ | – | – | – | react, react-dom |
| features/storefront | ✓ | ✓ | – | ✓ | ✓ | – | – | react |
| features/seller | ✓ | ✓ | – | ✓ | – | ✓ | – | react |
| app       | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | react, react-dom |

- **Features never import adapters or `app/`.** They get ports through `useServices()` (`shared/lib/services.tsx`);
  only `app/services.ts` builds the adapters. Tests can provide fake `Services` the same way.
- **The two apps never import each other.** Shared pieces go to `shared/` (UI) or `domain/` (rules).
- **Backend DTOs stop at the adapter** (anti-corruption layer): `adapters/http/stores/dto.ts` mirrors the Java DTOs;
  `mappers.ts` turns them into domain models (e.g. `LocalTime "08:00:00"` → `"08:00"`, `PagedResult` → `Page`).
- Tests (`*.test.ts`) may also use `node:*` modules and import `scripts/`.

## 3. Domain rules

Only decided rules (✅ / 🟢) or rules the owner confirmed on 2026-10-27; display logic is marked as such.

| Rule | Module | Source |
|------|--------|--------|
| One currency, VND, whole đồng | `domain/money.ts` | BR-MER-01, BR-STO-03 (gap: `currency` fields are free text → non-VND cart lines are flagged) |
| Merchant code: 1–50 ASCII letters/digits, case-insensitive | `domain/merchant.ts` | BR-MER-04 |
| Account required to build a cart and order; one cart per customer | sign-in guard on add-to-cart; cart keyed by customer | BR-USR-02, BR-CRT-01 |
| Cart groups by shop; same SKU merges; per-line max 99 | `domain/cart.ts` | BR-CRT-01 (🟢); BR-CRT-02 (🟢 max 99, 2026-10-27) |
| Checkout = one order per store, one `checkoutId` | `domain/order.ts` `splitIntoOrders` | BR-ORD-01 |
| Only ACTIVE stores take orders and appear in feeds; non-ACTIVE shop pages say "not taking orders" | `domain/store.ts` `takesOrders` | BR-STO-02 order rule — **decided 2026-10-27** |
| Only ACTIVE products are shown to shoppers | `domain/catalog.ts` `isOnSale` | BR-CAT-01 — **decided 2026-10-27** |
| Shoppers see stock as a status: In stock / Only N left (N ≤ 5) / Sold out; no record = unknown, not blocking. Neither messages nor quantity caps reveal a count above 5 | `domain/inventory.ts` `stockLevel`, `domain/cart.ts` | BR-CAT-04 (🟢 2026-10-27); BR-CAT-03, BR-INV-06 |
| Cart re-checks price/stock/availability when viewed; problems are **flagged, never removed**; blocking flags stop checkout | `domain/cart.ts` `checkLine` | BR-CRT-03 — flagging **decided 2026-10-27** |
| "Open now" = inside today's hours in the store time zone, opening and closing minute inclusive (as `BusinessHour.isOpen`) | `domain/store.ts` `isOpenNow` | BR-STO-04 ✅ hours part; closures (🟡) are ignored — hint only |
| Merchant-entered image URLs: only http(s) | `domain/catalog.ts` `safeImageUrl` | security |

The front end never decides real availability, prices or totals: order-service will (BR-CRT-04, BR-ORD-14, BR-PRC-03).

## 4. Ports and temporary adapters

| Port | Adapter now | Adapter later |
|------|-------------|---------------|
| `CatalogPort` | `AggregatingCatalogAdapter` | HTTP adapter for the public catalog/search read model (BR-USR-05) |
| `ShopDirectoryPort` (inside the catalog) | config file + demo workspace | removed (catalog lists shops) |
| `CategoryPort` | static | category API |
| `CartPort` | local, per customer | cart-service (server cart, BR-CRT-05) |
| `OrderPort` | local mock, split per store | order-service (one request, idempotency key, all-or-nothing) |
| `SessionPort` | local mock sign-in | identity / gateway |
| `MerchantPort`, `StorePort`, `ProductPort`, `CollectionPort`, `InventoryPort` | HTTP | HTTP + credentials |
| `SellerWorkspacePort` | local (remembered merchants, stores, closures) | list APIs (stores of a merchant, closures) |

### 4.1 Aggregating catalog — limits (`adapters/catalog/aggregatingCatalog.ts`)

The backend "search" only filters by store (no keyword, no status), has no page-size cap and no sort whitelist
(an unknown `sortBy` returns 500), and stock is one call per product. So the adapter:

- reads at most **12 shops**, with at most **4 requests in flight** per operation (one shared pool, also for cart checks), **20 products** per page (hard cap 50),
  **1 page per shop** for feed and search, sorted by `createdAt` only;
- filters ACTIVE stores and ACTIVE products on the client — shop pages can therefore be short;
- search runs on the loaded set only; the search page says so;
- never fails a page because one shop fails: results carry `shopsSearched` / `shopsFailed` and the UI shows a
  "results may be incomplete" notice;
- never calls inventory-service on list pages; stock is read on the product page and in the cart only;
- maps only `availableQuantity` from inventory (on-hand and reserved counts never reach the UI — but the HTTP response still carries them, visible in DevTools; this ends with the public read model, open question 34);
- caches store details for 60 s;
- every HTTP call has a timeout (15 s, body included); the featured-shops file has its own 8 s timeout and a failed load is retried, not cached;
- `checkCart` reports `failedCalls`; the cart tells the shopper when some facts could not be re-checked (unknown is not blocking).

### 4.2 Shop directory (decision 2026-10-27)

Featured shops come from `public/storefront-shops.json` (served with the app, editable without a rebuild).
In **demo mode** (`VITE_STOREFRONT_DEMO`, default on in `npm run dev`, off in builds) the directory also lists
stores created in the Seller Centre in the same browser. The storefront never reads seller storage itself; only the
directory adapter does, and only in demo mode. Turn demo mode off for any shared deployment.

### 4.3 Seller endpoints used by the storefront (temporary, must be removed)

Until the public catalog exists, the storefront calls merchant-scoped stores-service endpoints and the unscoped
inventory read (open question 6). Consequences:

- **The public catalog API (BR-USR-05) must ship before stores-service enforces seller authentication**,
  otherwise the storefront breaks (recorded as oms-workspace open question 34; oms-web is listed as a consumer in `integration.md`).
- Storefront URLs contain `merchantId` (`/shop/:merchantId/:storeId`); they will change when the public API
  introduces shop slugs. Accepted.

## 5. Routing

- Path-based routes. Storefront: `/`, `/search?q=`, `/shop/:merchantId/:storeId`,
  `/product/:merchantId/:storeId/:productId`, `/cart`, `/checkout`, `/orders`, `/login?next=`.
  Seller Centre: `/seller/merchants`, `/seller/m/:merchantId`, `/seller/m/:merchantId/stores/new`,
  `/seller/m/:merchantId/s/:storeId[/products|/products/new|/products/:id|/collections|/collections/:id|/settings|/closures]`.
- `/seller` and `/seller/**` (exact segment match) → Seller Centre; everything else → storefront.
- **Reserved prefixes** never used by app routes: `/v1/`, `/internal/`, `/assets/`.
- Dev proxy (`vite.config.ts`): `/v1/store/` → :8048, `/v1/inventory/` → :8058 (trailing slashes on purpose).
  `/internal/*` is never proxied.
- Production: the reverse proxy routes `/v1/store/` and `/v1/inventory/` to the services and serves `index.html`
  for unknown paths **except** `/v1/*` (an unknown API path must return the service's 404, not HTML with 200).
  Once the apps are split, the storefront host should not route seller write endpoints.
- `/login?next=` only accepts same-app paths (no `//host`, no `/seller`, no reserved prefixes).

## 6. State, loading and errors

| Kind | Where |
|------|-------|
| Server data | per page with `useAsync` (stale responses ignored) |
| Cart, orders, session, seller workspace | adapter-owned observables, read with `useObservable` (`useSyncExternalStore`) |
| Forms | local state; writes through `useAction` (pending state, ignores double submit) |

Seller-side safety: business hours are validated before saving (open days need both times, opening < closing — the
backend does not validate and would fail later); closure times are entered in the browser's time zone and labelled so;
a timed-out stock adjustment warns to check movements before retrying (the endpoint has no idempotency key); the S3
import form is shown only in demo mode (the API takes any bucket, open question 25).

Every page renders four states: **loading** (skeleton or spinner), **empty** (with a next step), **error**
(`ErrorBox`), **partial** (catalog fan-out). Stock "unknown" shows nothing and does not block.

Errors: one `AppError` (status, message, details). 4xx messages from oms-core `ErrorResponse` are user-facing and
shown as-is (incl. 409, 422); **5xx text is never shown** — the user sees a generic message plus a request id.

Local storage (temporary adapters only): keys `oms-web:v1:*` (bump the version and migrate when the shape changes),
guarded reads/writes, cross-tab sync via the `storage` event, read-modify-write per operation.

## 7. Cross-cutting

- **Observability**: every HTTP call sends `X-Request-Id`; the services' request filter logs headers, so a browser
  error can be traced. Client error reporting (e.g. to a collector) is a later step.
- **Security**: no secrets in the bundle. When identity arrives: prefer an httpOnly session cookie via the gateway
  (no tokens in `localStorage`) with CSRF protection; the Seller Centre route guard is UX only — the server
  authorizes. Merchant text is rendered as text (no `dangerouslySetInnerHTML`); images only from http(s) URLs with
  `referrerPolicy="no-referrer"`. Add a Content-Security-Policy at the edge.
- **Accessibility**: landmarks, labelled controls, visible focus, no colour-only meaning, reduced-motion respected.
- **Responsive**: 16 px gutters, no horizontal page scroll at 360–390 px (wide tables scroll inside their card).
- **i18n**: English strings in components; extract to a message catalog when a second language is needed.
- **Config** (`app/config.ts`, `.env.example`): `VITE_API_BASE_URL`, `VITE_STOREFRONT_SHOPS_URL`,
  `VITE_STOREFRONT_DEMO`, `VITE_HTTP_TIMEOUT_MS`.

## 8. Testing

| Level | What | Command |
|-------|------|---------|
| Domain | money, merchant code, cart (group, merge, clamp, checks), split per store, open-now boundary, stock level, search, safe URLs | `npm test` |
| Adapters | DTO → domain mapping on fixtures shaped like the Java DTOs; HTTP client (4xx text, 5xx masking, request id, network errors); catalog aggregation (caps, concurrency, status filter, partial failure, dedupe, stock exposure, cart checks) | `npm test` |
| Architecture | dependency rule holds; the checker catches violations | `npm test`, `npm run lint:arch` |
| Types | strict TypeScript | `npm run typecheck` |
| End to end | manual smoke list below (automated E2E later, e.g. Playwright against the dev stack) | — |

Runner: `tsx --test` (Node's test runner); no framework dependency.

**Not verified automatically**: the real backends, the Vite proxy and the production SPA fallback. Smoke check
against the dev stack: register merchant → create store → create product → stock appears (Refresh) → receive stock
→ storefront home shows shop + product → sign in → add to cart → write off stock in the Seller Centre → cart flags
the line → fix → checkout creates one order per shop.

## 9. Evolution

1. Public catalog/search API → `HttpCatalogAdapter`; delete aggregation and the shop directory. **Before** step 3.
2. cart-service / order-service → HTTP adapters; checkout sends one request with an idempotency key
   (BR-CRT-04); totals and delivery fee from the server.
3. Identity → session via gateway, Seller Centre guard, credentials in `adapters/http/client.ts`.
4. Split deployables: two Vite entries (or packages) for storefront and Seller Centre; `domain`/`ports`/`adapters`/`shared`
   become a shared package; drop demo mode.
5. Swap the in-house router/async hooks for react-router / TanStack Query (ADR 0001 trigger).

## ADR 0001 — Minimal runtime dependencies for now

**Decision**: runtime dependencies are `react` and `react-dom`. Routing (`shared/lib/router`) and data loading
(`shared/lib/async`) are small in-house modules behind stable function names.
**Why**: small app, backend contracts still moving, every library is a long-term upgrade cost.
**Revisit when**: nested layouts with loaders, shared server-state caching/invalidation, or optimistic updates are
needed — then adopt react-router and TanStack Query; only `shared/lib` and its call sites change.

## Decisions log

| Date | Decision | By |
|------|----------|----|
| 2026-10-27 | Storefront shows only ACTIVE products (not even by direct link); non-ACTIVE shops are reachable but "not taking orders" and are not in feeds (BR-STO-02, BR-CAT-01 → 🟢) | owner |
| 2026-10-27 | Shoppers see stock as a status (In stock / Only N left ≤ 5 / Sold out), never exact counts (new BR-CAT-04) | owner |
| 2026-10-27 | Cart problems are flagged on the line (not removed); checkout blocked until fixed (BR-CRT-03 flagging → 🟢) | owner |
| 2026-10-27 | Max 99 per cart line (BR-CRT-02 → 🟢) | owner |
| 2026-10-27 | Storefront shop list = featured-shops file + demo mode (same-browser Seller Centre stores) | owner |
