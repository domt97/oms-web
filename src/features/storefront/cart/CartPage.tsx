import { groupByShop, isBlocking, itemCount, subtotal, MAX_LINE_QUANTITY } from '../../../domain/cart';
import { formatMoney, lineTotal } from '../../../domain/money';
import { useObservable } from '../../../shared/lib/async';
import { Link } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { StoreIcon } from '../../../shared/ui/icons';
import { Button, ButtonLink, Card, Empty, Img, MockNotice, Notice } from '../../../shared/ui/ui';
import { RequireSignIn } from '../account/RequireSignIn';
import { productPath, shopPath } from '../components';
import { useCartChecks } from './useCartChecks';

export function CartPage() {
  return (
    <RequireSignIn what="your cart">
      <Cart />
    </RequireSignIn>
  );
}

function Cart() {
  const { cart } = useServices();
  const lines = useObservable(cart);
  const groups = groupByShop(lines);
  const { issues, blocking, checking, incomplete, recheck } = useCartChecks(lines);

  if (lines.length === 0)
    return (
      <Empty>
        <div className="stack" style={{ alignItems: 'center' }}>
          <span>Your cart is empty.</span>
          <ButtonLink to="/" variant="primary">
            Start shopping
          </ButtonLink>
        </div>
      </Empty>
    );

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Shopping cart</h1>
          <div className="sub">
            {itemCount(lines)} items from {groups.length} {groups.length === 1 ? 'shop' : 'shops'} — each shop gets its own order
          </div>
        </div>
        <Link to="/orders">My orders</Link>
      </div>
      <div className="grid grid-checkout">
        <div className="stack">
          {incomplete && !checking && (
            <Notice tone="warn">
              Some prices or stock could not be re-checked right now; they will be checked again when you place the order.{' '}
              <button type="button" className="btn btn-sm" onClick={recheck}>
                Try again
              </button>
            </Notice>
          )}
          {groups.map((g) => (
            <section key={g.storeId} className="sf-cart-shop" aria-label={g.storeName}>
              <header>
                <StoreIcon size={18} />
                <Link to={shopPath(g)}>
                  <strong>{g.storeName}</strong>
                </Link>
              </header>
              {g.lines.map((l) => (
                <div key={l.skuId} className="sf-line">
                  <Img src={l.thumbnailUrl} alt="" />
                  <div style={{ minWidth: 0 }}>
                    <Link to={productPath({ merchantId: l.merchantId, storeId: l.storeId, id: l.productId })} style={{ color: 'var(--text)' }}>
                      {l.productName}
                    </Link>
                    {l.skuName && <div className="small muted">{l.skuName}</div>}
                    <div className="small">{formatMoney(l.price, l.currency)}</div>
                    {issues[l.skuId]?.map((i) => (
                      <div key={i.kind} className={`sf-issue${isBlocking(i) ? '' : ' info'}`}>
                        {i.kind === 'price_changed' ? `Price changed to ${formatMoney(i.price)} — the shop's price applies` : i.message}
                      </div>
                    ))}
                  </div>
                  <div className="row">
                    <div className="qty">
                      <button type="button" onClick={() => cart.setQuantity(l.skuId, l.quantity - 1)} aria-label={`Decrease ${l.productName}`}>
                        −
                      </button>
                      <span>{l.quantity}</span>
                      <button type="button" onClick={() => cart.setQuantity(l.skuId, l.quantity + 1)} aria-label={`Increase ${l.productName}`} disabled={l.quantity >= MAX_LINE_QUANTITY}>
                        +
                      </button>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => cart.remove(l.skuId)}>
                      Remove
                    </Button>
                  </div>
                  <div className="price right">{formatMoney(lineTotal(l.price, l.quantity), l.currency)}</div>
                </div>
              ))}
              <div className="card-body row between" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="muted">Shop subtotal</span>
                <strong>{formatMoney(g.subtotal)}</strong>
              </div>
            </section>
          ))}
          <MockNotice>Demo cart: kept in this browser for your account. Prices and stock are indicative and checked again at checkout.</MockNotice>
        </div>

        <div className="sf-summary">
          <Card title="Summary">
            <div className="stack">
              <div className="row between">
                <span className="muted">Items ({itemCount(lines)})</span>
                <span>{formatMoney(subtotal(lines))}</span>
              </div>
              <div className="row between">
                <span className="muted">Delivery</span>
                <span className="small muted">Calculated at checkout</span>
              </div>
              <span className="small muted">Prices are indicative; each shop's current price applies to the order.</span>
              <div className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <strong>Subtotal</strong>
                <span className="price" style={{ fontSize: 20 }}>
                  {formatMoney(subtotal(lines))}
                </span>
              </div>
              {blocking && <div className="sf-issue">Fix the flagged items to continue.</div>}
              {blocking || checking ? (
                <Button variant="primary" disabled>
                  {checking ? 'Checking prices and stock…' : 'Check out'}
                </Button>
              ) : (
                <ButtonLink to="/checkout" variant="primary">
                  Check out ({groups.length} {groups.length === 1 ? 'order' : 'orders'})
                </ButtonLink>
              )}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
