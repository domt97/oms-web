import { useAsync } from '../../../shared/lib/async';
import { Link } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Empty, ErrorBox } from '../../../shared/ui/ui';
import { PartialNotice, ProductGrid, ProductGridSkeleton, ShopTile } from '../components';

export function HomePage() {
  const { catalog, categories } = useServices();
  const feed = useAsync(() => catalog.feed(), [catalog]);
  const shops = useAsync(() => catalog.listShops(), [catalog]);

  return (
    <>
      <section className="sf-hero" aria-label="Highlights">
        <div className="sf-banner">
          <h1>One cart, every shop</h1>
          <p>Order from several shops at once — each shop prepares and ships its own order.</p>
        </div>
        <div className="sf-hero-side">
          <div className="sf-banner alt">
            <strong>Pre-order for tomorrow</strong>
            <span className="small">At shops that accept pre-orders</span>
          </div>
          <div className="sf-banner alt2">
            <strong>Pay on delivery</strong>
            <span className="small">Cash or online</span>
          </div>
        </div>
      </section>

      <section className="sf-section" aria-labelledby="cats">
        <div className="sf-section-head">
          <h2 id="cats">Categories</h2>
        </div>
        <nav className="sf-cats" aria-label="Categories">
          {categories.list().map((c) => (
            <Link key={c.id} to={`/search?q=${encodeURIComponent(c.name)}`} className="sf-cat">
              <span aria-hidden>{c.icon}</span>
              <span>{c.name}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="sf-section" aria-labelledby="shops">
        <div className="sf-section-head">
          <h2 id="shops">Shops</h2>
        </div>
        {shops.error ? (
          <ErrorBox error={shops.error} />
        ) : shops.data && shops.data.items.length === 0 ? (
          <Empty>No shops yet. Sellers can open one in the Seller Centre.</Empty>
        ) : (
          <div className="sf-shops">
            {(shops.data?.items ?? []).map((s) => (
              <ShopTile key={s.storeId} shop={s} />
            ))}
          </div>
        )}
      </section>

      <section className="sf-section" aria-labelledby="new">
        <div className="sf-section-head">
          <h2 id="new">New today</h2>
          {feed.data && <span className="small muted">{feed.data.items.length} products</span>}
        </div>
        {feed.loading && !feed.data ? (
          <ProductGridSkeleton />
        ) : feed.error ? (
          <ErrorBox error={feed.error} title="Could not load products" />
        ) : (
          <div className="stack">
            <PartialNotice result={feed.data!} />
            {feed.data!.items.length === 0 ? <Empty>Nothing on sale yet.</Empty> : <ProductGrid items={feed.data!.items} />}
          </div>
        )}
      </section>
    </>
  );
}
