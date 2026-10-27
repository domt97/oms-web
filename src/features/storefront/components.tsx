import { formatPriceRange } from '../../domain/money';
import { stockLabel, stockLevel } from '../../domain/inventory';
import type { CatalogResult, ProductCard as Card, Shop } from '../../ports';
import { Link } from '../../shared/lib/router';
import { plural } from '../../shared/lib/format';
import { Img, Notice, Skeleton } from '../../shared/ui/ui';

export const productPath = (p: { merchantId: string; storeId: string; id: string }) => `/product/${p.merchantId}/${p.storeId}/${p.id}`;
export const shopPath = (s: { merchantId: string; storeId: string }) => `/shop/${s.merchantId}/${s.storeId}`;

export function ProductCard({ product, showShop = true }: { product: Card; showShop?: boolean }) {
  return (
    <Link to={productPath(product)} className="sf-card">
      <Img src={product.thumbnailUrl} alt="" />
      <div className="body">
        <div className="name">{product.name}</div>
        <div className="price">{formatPriceRange(product.minPrice, product.maxPrice, product.currency)}</div>
        {showShop && <div className="shop">{product.shopName}</div>}
      </div>
    </Link>
  );
}

export function ProductGrid({ items, showShop }: { items: Card[]; showShop?: boolean }) {
  return (
    <div className="sf-grid">
      {items.map((p) => (
        <ProductCard key={p.id} product={p} showShop={showShop} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="sf-grid" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="sf-card">
          <div className="thumb" />
          <div className="body">
            <Skeleton height={14} />
            <Skeleton height={14} width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ShopAvatar({ name }: { name: string }) {
  return (
    <span className="sf-avatar" aria-hidden>
      {name.trim().slice(0, 1).toUpperCase() || '?'}
    </span>
  );
}

export function ShopTile({ shop }: { shop: Shop }) {
  const area = [shop.store?.address?.district, shop.store?.address?.city].filter(Boolean).join(', ');
  return (
    <Link to={shopPath(shop)} className="sf-shop">
      <ShopAvatar name={shop.store?.name ?? shop.name} />
      <div style={{ minWidth: 0 }}>
        <h3>{shop.store?.name ?? shop.name}</h3>
        <div className="small muted">{shop.error ? 'Could not load this shop' : area || 'View shop'}</div>
      </div>
    </Link>
  );
}

/** Says when a fan-out result is partial (temporary catalog, docs/architecture.md §4.1). */
export function PartialNotice({ result }: { result: Pick<CatalogResult<unknown>, 'shopsFailed' | 'shopsSearched'> }) {
  if (result.shopsFailed === 0) return null;
  return (
    <Notice tone="warn">
      {plural(result.shopsFailed, 'shop')} of {result.shopsSearched} could not be loaded; results may be incomplete.
    </Notice>
  );
}

/** Stock as shoppers see it (decision 2026-10-27): a status, not a count. */
export function StockText({ available }: { available: number | undefined }) {
  const level = stockLevel(available);
  const label = stockLabel(level);
  if (!label) return null;
  const color = level.kind === 'sold_out' ? 'var(--danger)' : level.kind === 'low' ? 'var(--warn)' : 'var(--ok)';
  return (
    <span className="small" style={{ color, fontWeight: 600 }}>
      {label}
    </span>
  );
}
