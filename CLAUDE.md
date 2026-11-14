# oms-web — front end of the OMS

Part of the OMS. System-wide map, rules and the other services: **`oms-workspace`**
(https://github.com/domt97/oms-workspace — `CLAUDE.md`, `architecture/`). Full architecture of this repo:
**`docs/architecture.md`** — read the section you touch before changing code; this file is only the short version.

## Owns

Shopper storefront at `/` and Seller Centre at `/seller` (React 19 + TypeScript, Vite, dev port **5173**). It owns no
data: merchants, stores, products, collections and stock come from stores-service (`/v1/store/`) and inventory-service
(`/v1/inventory/`) through a proxy. Shopper sign-in, cart, orders and the seller's lists of stores and closures are
browser-local stand-ins behind ports until the backend has them (`docs/architecture.md` §4, §9).

## Layers (enforced by `npm run lint:arch`)

`src/domain` (pure TypeScript rules) ← `ports` ← `adapters` (`http/stores`, `http/inventory`, `catalog`, `local`,
`static`); `shared` (router, hooks, UI kit); `features/storefront` and `features/seller`; `app` (composition root).
The import table is in `docs/architecture.md` §2. The three rules that matter most:

- Features never import `adapters/` or `app/`; they get ports through `useServices()`. Only `app/services.ts` builds adapters.
- The two apps never import each other; shared pieces go to `shared/` (UI) or `domain/` (rules).
- Backend DTOs stop at the adapter: `adapters/http/stores/dto.ts` mirrors the Java DTOs, `mappers.ts` turns them into
  domain models.

## Changing things — checklist

1. **Rule** (money, cart, stock level, form limits): `src/domain`, with a test next to it. No React, fetch or storage there.
2. **New or changed backend call**: DTO and mapper in `adapters/http/<service>/`, method on a port in `ports/index.ts`,
   wiring in `app/services.ts`. Then update the *Front-end consumers* table in `oms-workspace/architecture/integration.md`
   in the same piece of work: backend changes are checked against that table.
3. **Replacing a stand-in with a real service**: write the HTTP adapter for the same port and swap it in
   `app/services.ts`; features do not change. Order of replacement: `docs/architecture.md` §9.
4. **New dependency**: avoid it (ADR 0001 in `docs/architecture.md`); if needed, add it to the allowed packages in
   `scripts/check-architecture.mjs` for the layer that may use it.
5. **Docs**: a new rule, port, limit or decision goes into `docs/architecture.md` in the same PR.

## Tests and checks

`npm run check` = typecheck + layer rule + unit tests (`tsx --test`, files `src/**/*.test.ts`). Run it before saying a
change is done; CI runs `npm run build` (the same checks, then the Vite build) on Node 22.
Not checked automatically: the real backends, the Vite proxy and the production SPA fallback — use the smoke list in
`docs/architecture.md` §8 against the dev stack when a change touches them.

## Git workflow

Branch **from `develop`** and open PRs **into `develop`** (`feature/...`, `fix/...`, `docs/...`).
`master` only receives `develop` through release PRs — never target `master` directly.

## Build & run

`npm install`, `npm run dev` → http://localhost:5173. Start the `development` infra and both services (profile
`localdev`) first; the dev server proxies to `:8048` and `:8058`. Other hosts and app config: `.env.example`.

## Pitfalls

- `package-lock.json` is committed and CI installs with `npm ci`. After changing a dependency, commit the lockfile too.
  Regenerate it from scratch (`rm -rf node_modules package-lock.json && npm install`) if it only lists the binaries of
  your own platform (`@rollup/rollup-*`, `@esbuild/*`): CI runs on Linux and the build fails without them.
- The storefront reads merchant-scoped seller endpoints until a public catalog exists (`docs/architecture.md` §4.3).
  A backend change to their path, auth or page size breaks it.
- `VITE_*` values are read at build time; `VITE_STOREFRONT_DEMO` defaults to true in dev and false in builds.
