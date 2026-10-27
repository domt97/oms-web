import { useEffect, useState, type ReactNode } from 'react';
import { useObservable } from '../../shared/lib/async';
import { Link, matchPath, navigate, NavLink, Redirect, Routes, useLocation, type Route } from '../../shared/lib/router';
import { useServices } from '../../shared/lib/services';
import { BoxIcon, ExternalIcon, HomeIcon, LayersIcon, PauseIcon, SettingsIcon, StoreIcon } from '../../shared/ui/icons';
import { Empty } from '../../shared/ui/ui';
import { CollectionDetailPage } from './collections/CollectionDetailPage';
import { CollectionsPage } from './collections/CollectionsPage';
import { MerchantHomePage } from './merchants/MerchantHomePage';
import { storeBase } from './paths';
import { MerchantsPage } from './merchants/MerchantsPage';
import { ProductCreatePage } from './products/ProductCreatePage';
import { ProductDetailPage } from './products/ProductDetailPage';
import { ProductsPage } from './products/ProductsPage';
import { StoreClosuresPage } from './stores/StoreClosuresPage';
import { StoreCreatePage } from './stores/StoreCreatePage';
import { StoreOverviewPage } from './stores/StoreOverviewPage';
import { StoreSettingsPage } from './stores/StoreSettingsPage';

const M = '/seller/m/:merchantId';
const S = `${M}/s/:storeId`;

const routes: Route[] = [
  { path: '/seller/merchants', render: () => <MerchantsPage /> },
  { path: M, render: (p) => <MerchantHomePage merchantId={p.merchantId} /> },
  { path: `${M}/stores/new`, render: (p) => <StoreCreatePage merchantId={p.merchantId} /> },
  { path: S, render: (p) => <StoreOverviewPage merchantId={p.merchantId} storeId={p.storeId} /> },
  { path: `${S}/products`, render: (p) => <ProductsPage merchantId={p.merchantId} storeId={p.storeId} /> },
  { path: `${S}/products/new`, render: (p) => <ProductCreatePage merchantId={p.merchantId} storeId={p.storeId} /> },
  { path: `${S}/products/:productId`, render: (p) => <ProductDetailPage merchantId={p.merchantId} storeId={p.storeId} productId={p.productId} /> },
  { path: `${S}/collections`, render: (p) => <CollectionsPage merchantId={p.merchantId} storeId={p.storeId} /> },
  { path: `${S}/collections/:collectionId`, render: (p) => <CollectionDetailPage merchantId={p.merchantId} storeId={p.storeId} collectionId={p.collectionId} /> },
  { path: `${S}/settings`, render: (p) => <StoreSettingsPage merchantId={p.merchantId} storeId={p.storeId} /> },
  { path: `${S}/closures`, render: (p) => <StoreClosuresPage merchantId={p.merchantId} storeId={p.storeId} /> },
];

export function SellerApp() {
  const { workspace } = useServices();
  const { path } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [path]);

  if (path === '/seller' || path === '/seller/') {
    const current = workspace.get().currentMerchantId;
    return <Redirect to={current ? `/seller/m/${current}` : '/seller/merchants'} />;
  }

  return (
    <div className="sc">
      <Sidebar open={menuOpen} />
      <div className="sc-main">
        <header className="sc-top">
          <button type="button" className="btn btn-sm sc-menu-btn" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-controls="sc-side">
            Menu
          </button>
          <MerchantBadge />
          <span className="spacer" />
          <a href="/" className="btn btn-sm">
            <ExternalIcon size={16} /> <span className="hide-sm">View storefront</span>
          </a>
        </header>
        <main className="sc-content" id="main">
          <Routes routes={routes} fallback={<Empty>Page not found. <Link to="/seller">Back to the Seller Centre</Link>.</Empty>} />
        </main>
      </div>
    </div>
  );
}

function useCurrentIds() {
  const { path } = useLocation();
  const store = matchPath(`${S}/*`, path) ?? matchPath(S, path);
  const merchant = store ?? matchPath(`${M}/*`, path) ?? matchPath(M, path);
  return { merchantId: merchant?.merchantId, storeId: store?.storeId };
}

function MerchantBadge() {
  const { workspace } = useServices();
  const ws = useObservable(workspace);
  const { merchantId } = useCurrentIds();
  const m = ws.merchants.find((x) => x.id === merchantId);
  if (!m) return <strong>Seller Centre</strong>;
  return (
    <div className="row">
      <span className="muted hide-sm">Merchant</span>
      <strong>{m.name}</strong>
      <Link to="/seller/merchants" className="small">
        Switch
      </Link>
    </div>
  );
}

function Sidebar({ open }: { open: boolean }) {
  const { workspace } = useServices();
  const ws = useObservable(workspace);
  const { merchantId, storeId } = useCurrentIds();
  const stores = ws.stores.filter((s) => s.merchantId === merchantId);

  const item = (to: string, icon: ReactNode, label: string, exact = false) => (
    <NavLink to={to} className="sc-nav" exact={exact}>
      {icon} {label}
    </NavLink>
  );

  return (
    <aside className="sc-side" id="sc-side" data-open={open} aria-label="Seller Centre navigation">
      <Link to="/seller" className="sc-brand">
        <span className="mark" aria-hidden>
          O
        </span>
        Seller Centre
      </Link>

      {merchantId ? (
        <>
          <nav className="sc-group" aria-label="Merchant">
            <span className="sc-group-title">Merchant</span>
            {item(`/seller/m/${merchantId}`, <HomeIcon size={18} />, 'Stores', true)}
            {item(`/seller/m/${merchantId}/stores/new`, <StoreIcon size={18} />, 'New store', true)}
          </nav>

          <div className="sc-store-pick">
            <label htmlFor="sc-store">Store</label>
            <select
              id="sc-store"
              value={storeId ?? ''}
              onChange={(e) => e.target.value && navigate(storeBase(merchantId, e.target.value))}
            >
              <option value="">{stores.length ? 'Choose a store…' : 'No stores yet'}</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {storeId && (
            <nav className="sc-group" aria-label="Store">
              <span className="sc-group-title">This store</span>
              {item(storeBase(merchantId, storeId), <StoreIcon size={18} />, 'Overview', true)}
              {item(`${storeBase(merchantId, storeId)}/products`, <BoxIcon size={18} />, 'Products & stock')}
              {item(`${storeBase(merchantId, storeId)}/collections`, <LayersIcon size={18} />, 'Collections')}
              {item(`${storeBase(merchantId, storeId)}/settings`, <SettingsIcon size={18} />, 'Settings & hours')}
              {item(`${storeBase(merchantId, storeId)}/closures`, <PauseIcon size={18} />, 'Closures')}
            </nav>
          )}
        </>
      ) : (
        <nav className="sc-group">{item('/seller/merchants', <HomeIcon size={18} />, 'Choose merchant')}</nav>
      )}
    </aside>
  );
}
