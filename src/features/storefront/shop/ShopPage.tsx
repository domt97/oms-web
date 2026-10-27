import { useState } from 'react';
import { isUuid } from '../../../domain/ids';
import { isOpenNow, takesOrders, todaysHours } from '../../../domain/store';
import { useAsync } from '../../../shared/lib/async';
import { STORE_STATUS_LABEL } from '../../../shared/lib/format';
import { useServices } from '../../../shared/lib/services';
import { Badge, Empty, ErrorBox, Loading, Notice, Pager } from '../../../shared/ui/ui';
import { ProductGrid, ProductGridSkeleton, ShopAvatar } from '../components';

export function ShopPage({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  const { catalog } = useServices();
  const shop = useAsync(() => catalog.getShop(merchantId, storeId), [catalog, merchantId, storeId]);
  const [page, setPage] = useState(0);
  const products = useAsync(() => catalog.shopProducts(merchantId, storeId, page), [catalog, merchantId, storeId, page]);

  if (!isUuid(merchantId) || !isUuid(storeId) || shop.error?.isNotFound || shop.error?.status === 400) return <Empty>This shop does not exist.</Empty>;
  if (shop.loading && !shop.data) return <Loading />;
  if (shop.error) return <ErrorBox error={shop.error} title="Could not open the shop" />;
  const s = shop.data!;
  const open = isOpenNow(s);
  const today = todaysHours(s);
  const area = [s.address?.addressLine1, s.address?.district, s.address?.city].filter(Boolean).join(', ');

  return (
    <>
      <section className="sf-shop-banner">
        <ShopAvatar name={s.name} />
        <div className="stack" style={{ gap: 4, flex: 1, minWidth: 220 }}>
          <h1>{s.name}</h1>
          {area && <div className="muted">{area}</div>}
          <div className="row small">
            {!takesOrders(s) ? <Badge tone="danger">{STORE_STATUS_LABEL[s.status]}</Badge> : <Badge tone={open ? 'ok' : 'warn'}>{open ? 'Open now' : 'Closed now'}</Badge>}
            {today && <span>{today.closed ? 'Closed today' : `Today ${today.openingTime} – ${today.closingTime}`}</span>}
            {s.config?.preparationTimeMinutes ? <span>· ready in ~{s.config.preparationTimeMinutes} min</span> : null}
            {s.config?.allowPreOrder && <span>· takes pre-orders</span>}
          </div>
        </div>
      </section>
      {!takesOrders(s) && (
        <>
          <Notice tone="warn">This shop is not taking orders right now.</Notice>
          <div style={{ height: 12 }} />
        </>
      )}

      {products.loading && !products.data ? (
        <ProductGridSkeleton />
      ) : products.error ? (
        <ErrorBox error={products.error} />
      ) : products.data!.items.length === 0 ? (
        <Empty>{page === 0 ? 'This shop has nothing on sale yet.' : 'No more products on this page.'}</Empty>
      ) : (
        <ProductGrid items={products.data!.items} showShop={false} />
      )}
      {products.data && <Pager page={page} totalPages={products.data.totalPages} onChange={setPage} />}
    </>
  );
}
