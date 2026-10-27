# oms-web

Browser front end of the OMS marketplace (React 19 + TypeScript + Vite), in English.

| App | URL | For |
|-----|-----|-----|
| **Storefront** | `/` | Shoppers: home feed, search, shops, product, cart across shops, checkout (one order per shop), my orders |
| **Seller Centre** | `/seller` | Merchants: register, stores, products & stock, collections, settings & hours, closures |

Architecture, rules and limits: **[docs/architecture.md](docs/architecture.md)**. System docs: [`oms-workspace`](https://github.com/domt97/oms-workspace).

## Run

```bash
npm install
npm run dev            # http://localhost:5173  (Seller Centre: http://localhost:5173/seller)
```

Start the backends first (`development` infra, then stores-service and inventory-service with the `localdev` profile).
The dev server proxies `/v1/store/` → `:8048` and `/v1/inventory/` → `:8058`, so no CORS setup is needed. Other hosts:
copy `.env.example` to `.env`.

Try it: open `/seller`, register a merchant, create a store and a product, press **Refresh** until stock appears,
receive some stock, then open `/` — the shop and product are listed (demo mode), sign in with any name and a
Vietnamese phone number, add to cart and check out.

## Scripts

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server with API proxy |
| `npm run check` | typecheck + architecture rule + tests |
| `npm test` | unit tests (domain, adapters, architecture) with Node's test runner via `tsx` |
| `npm run lint:arch` | dependency rule between layers (`scripts/check-architecture.mjs`) |
| `npm run build` | `check`, then production build to `dist/` |

## Deploying `dist/`

Serve it behind a reverse proxy that routes `/v1/store/` and `/v1/inventory/` to the services and returns
`index.html` for unknown paths **except** `/v1/*`. Set `VITE_STOREFRONT_DEMO=false` and list real shops in
`storefront-shops.json` (`{"shops": [{"merchantId": "…", "storeId": "…", "name": "…"}]}`).

## What is real and what is temporary

| Real (backend) | Temporary (front end, replaceable behind a port) |
|----------------|--------------------------------------------------|
| Merchants, stores, settings, hours, closures, products, collections, stock and movements | Storefront catalog = aggregation over a bounded list of shops (no public catalog API yet) |
| | Categories: static list |
| | Shopper sign-in, cart and orders: kept in the browser; checkout does not reserve stock or notify shops |
| | Seller "lists" of stores and closures: remembered in the browser (no list APIs yet) |

Backend gaps the UI works around are listed in `docs/architecture.md` §1 and §4.
