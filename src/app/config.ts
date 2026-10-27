// Runtime configuration (Vite env, read at build time). See .env.example.
export interface AppConfig {
  /** Prefix for API calls; '' = same origin (Vite proxy in dev, reverse proxy in prod). */
  apiBaseUrl: string;
  /** Shops featured on the storefront until a public catalog exists (served file, editable without rebuild). */
  storefrontShopsUrl: string;
  /** Demo only: also show stores created in the Seller Centre in this browser. Off for shared deployments. */
  storefrontDemo: boolean;
  /** HTTP timeout per request. */
  httpTimeoutMs: number;
}

export function readConfig(env: Record<string, string | boolean | undefined> = import.meta.env): AppConfig {
  // Empty string (as in .env.example) means "not set".
  const flag = (v: string | boolean | undefined, dflt: boolean) => (v === undefined || v === '' ? dflt : v === true || v === 'true');
  const positive = (v: string | boolean | undefined, dflt: number) => {
    const n = Number(v);
    return v === undefined || v === '' || !Number.isFinite(n) || n <= 0 ? dflt : n;
  };
  return {
    apiBaseUrl: String(env.VITE_API_BASE_URL ?? ''),
    storefrontShopsUrl: String(env.VITE_STOREFRONT_SHOPS_URL ?? '/storefront-shops.json'),
    storefrontDemo: flag(env.VITE_STOREFRONT_DEMO, env.DEV === true),
    httpTimeoutMs: positive(env.VITE_HTTP_TIMEOUT_MS, 15000),
  };
}
