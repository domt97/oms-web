import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The two backends use distinct path prefixes, so the dev server proxies them without rewriting
// (and the browser never needs CORS). Trailing slashes matter: Vite matches with startsWith, so
// "/v1/store" would also catch a future "/v1/storefront…". /internal/* is never proxied.
// App routes must not start with /v1/, /internal/ or /assets/ (shared/lib/router RESERVED_PREFIXES).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const storeApi = env.STORE_API_URL || 'http://localhost:8048';
  const inventoryApi = env.INVENTORY_API_URL || 'http://localhost:8058';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/v1/store/': { target: storeApi, changeOrigin: true },
        '/v1/inventory/': { target: inventoryApi, changeOrigin: true },
      },
    },
  };
});
