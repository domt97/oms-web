import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { itemCount } from '../../domain/cart';
import { useObservable } from '../../shared/lib/async';
import { Link, navigate, Routes, useLocation, type Route } from '../../shared/lib/router';
import { useServices } from '../../shared/lib/services';
import { CartIcon, SearchIcon, StoreIcon, UserIcon } from '../../shared/ui/icons';
import { Empty } from '../../shared/ui/ui';
import { CartPage } from './cart/CartPage';
import { CheckoutPage } from './checkout/CheckoutPage';
import { HomePage } from './home/HomePage';
import { LoginPage } from './account/LoginPage';
import { OrdersPage } from './orders/OrdersPage';
import { ProductPage } from './product/ProductPage';
import { SearchPage } from './search/SearchPage';
import { ShopPage } from './shop/ShopPage';

const routes: Route[] = [
  { path: '/', render: () => <HomePage /> },
  { path: '/search', render: () => <SearchPage /> },
  { path: '/shop/:merchantId/:storeId', render: (p) => <ShopPage merchantId={p.merchantId} storeId={p.storeId} /> },
  { path: '/product/:merchantId/:storeId/:productId', render: (p) => <ProductPage merchantId={p.merchantId} storeId={p.storeId} productId={p.productId} /> },
  { path: '/cart', render: () => <CartPage /> },
  { path: '/checkout', render: () => <CheckoutPage /> },
  { path: '/orders', render: () => <OrdersPage /> },
  { path: '/login', render: () => <LoginPage /> },
];

export function StorefrontApp() {
  return (
    <>
      <TopStrip />
      <Header />
      <main className="container page" id="main">
        <Routes routes={routes} fallback={<Empty>Page not found. <Link to="/">Back to the home page</Link>.</Empty>} />
      </main>
      <Footer />
    </>
  );
}

function TopStrip() {
  return (
    <div className="sf-strip">
      <div className="container">
        <a href="/seller" className="row" style={{ gap: 6 }}>
          <StoreIcon size={14} /> Seller Centre
        </a>
        <span className="hide-sm">Sell on OMS — open your shop in minutes</span>
        <span className="spacer" />
        <span className="hide-sm">Help</span>
      </div>
    </div>
  );
}

function Header() {
  const { cart, session } = useServices();
  const lines = useObservable(cart);
  const customer = useObservable(session);
  const { path, search } = useLocation();
  // Keep the box in sync with the URL, keyed on the string value (URLSearchParams is a new object each render).
  const urlQuery = path === '/search' ? (search.get('q') ?? '') : '';
  const [q, setQ] = useState(urlQuery);
  useEffect(() => setQ(urlQuery), [urlQuery]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/search?q=${encodeURIComponent(q.trim())}`);
  };
  const count = itemCount(lines);

  return (
    <header className="sf-header">
      <div className="container">
        <Link to="/" className="sf-logo" aria-label="OMS home">
          <span className="sf-logo-mark" aria-hidden>
            <StoreIcon size={18} />
          </span>
          OMS
        </Link>
        <form className="sf-search" role="search" onSubmit={onSearch}>
          <label htmlFor="sf-q" className="sr-only">
            Search products
          </label>
          <input id="sf-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for milk tea, coffee, rice…" autoComplete="off" />
          <button type="submit" aria-label="Search">
            <SearchIcon size={18} />
          </button>
        </form>
        <Link to="/cart" className="sf-cart" aria-label={customer ? `Cart, ${count} items` : 'Cart'}>
          <CartIcon size={26} />
          {count > 0 && <span className="sf-count">{count > 99 ? '99+' : count}</span>}
        </Link>
        <Account />
      </div>
    </header>
  );
}

function Account() {
  const { session } = useServices();
  const customer = useObservable(session);
  const { path } = useLocation();
  if (!customer)
    return (
      <Link to={`/login?next=${encodeURIComponent(path)}`} className="sf-account">
        <UserIcon size={18} /> <span>Sign in</span>
      </Link>
    );
  return (
    <div className="sf-account">
      <UserIcon size={18} />
      <Link to="/orders" style={{ color: 'inherit' }}>
        <span className="hide-sm">{customer.name}</span>
        <span className="sr-only">My orders</span>
      </Link>
      <button type="button" onClick={() => session.signOut()} className="hide-sm">
        · Sign out
      </button>
    </div>
  );
}

function Footer() {
  const col = (title: string, items: ReactNode[]) => (
    <div>
      <h3>{title}</h3>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="sf-footer">
      <div className="container">
        {col('Customer service', ['Help centre', 'How to buy', 'Delivery', 'Returns & refunds'])}
        {col('About OMS', ['One cart for many shops', 'Each shop ships its own order', 'Prices in VND'])}
        {col('Sell on OMS', [<a href="/seller" key="s">Seller Centre</a>, 'Open a shop', 'Seller guide'])}
      </div>
    </footer>
  );
}
