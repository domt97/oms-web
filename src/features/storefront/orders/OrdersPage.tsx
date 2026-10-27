import { formatMoney, lineTotal } from '../../../domain/money';
import { useObservable } from '../../../shared/lib/async';
import { formatDateTime, shortId } from '../../../shared/lib/format';
import { Link, useLocation } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { StoreIcon } from '../../../shared/ui/icons';
import { Badge, ButtonLink, Empty, MockNotice, Notice } from '../../../shared/ui/ui';
import { RequireSignIn } from '../account/RequireSignIn';
import { shopPath } from '../components';

export function OrdersPage() {
  return (
    <RequireSignIn what="your orders">
      <Orders />
    </RequireSignIn>
  );
}

function Orders() {
  const { orders } = useServices();
  const list = useObservable(orders);
  const { search } = useLocation();
  const placed = Number(search.get('placed') ?? 0);

  return (
    <>
      <div className="page-header">
        <h1>My orders</h1>
      </div>
      <div className="stack">
        {placed > 0 && <Notice tone="ok">Done — {placed > 1 ? `${placed} orders were placed, one per shop.` : 'your order was placed.'} (demo)</Notice>}
        <MockNotice>Demo orders, stored in this browser. They will come from order-service once it exists.</MockNotice>
        {list.length === 0 ? (
          <Empty>
            <div className="stack" style={{ alignItems: 'center' }}>
              <span>No orders yet.</span>
              <ButtonLink to="/" variant="primary">
                Start shopping
              </ButtonLink>
            </div>
          </Empty>
        ) : (
          list.map((o) => (
            <section key={o.id} className="sf-cart-shop" aria-label={`Order ${shortId(o.id)}`}>
              <header>
                <StoreIcon size={18} />
                <Link to={shopPath(o)}>
                  <strong>{o.storeName}</strong>
                </Link>
                <span className="spacer" />
                <span className="small muted mono">#{shortId(o.id)}</span>
                <Badge tone="mock">Placed (demo)</Badge>
              </header>
              {o.lines.map((l) => (
                <div key={l.skuId} className="row between card-body" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span>
                    {l.quantity} × {l.productName}
                    {l.skuName && <span className="muted"> ({l.skuName})</span>}
                  </span>
                  <span>{formatMoney(lineTotal(l.price, l.quantity), l.currency)}</span>
                </div>
              ))}
              <div className="card-body row between">
                <span className="small muted">
                  {formatDateTime(o.createdAt)} · {o.payment === 'COD' ? 'Cash on delivery' : 'Online'} · to {o.delivery.address}
                </span>
                <span>
                  Total <span className="price">{formatMoney(o.total)}</span>
                </span>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
