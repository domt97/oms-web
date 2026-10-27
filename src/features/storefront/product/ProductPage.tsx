import { useState } from 'react';
import { clampQuantity } from '../../../domain/cart';
import { sellableSkus, sortedImages } from '../../../domain/catalog';
import { stockLevel } from '../../../domain/inventory';
import { formatMoney } from '../../../domain/money';
import { isUuid } from '../../../domain/ids';
import { isOpenNow, takesOrders } from '../../../domain/store';
import { useAsync, useObservable } from '../../../shared/lib/async';
import { Link, navigate, useLocation } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { CartIcon } from '../../../shared/ui/icons';
import { Button, ButtonLink, Empty, ErrorBox, Img, Loading, Notice, Toast } from '../../../shared/ui/ui';
import { shopPath, ShopAvatar, StockText } from '../components';

interface Props {
  merchantId: string;
  storeId: string;
  productId: string;
}

export function ProductPage({ merchantId, storeId, productId }: Props) {
  const { catalog, cart, session } = useServices();
  const customer = useObservable(session);
  const { path } = useLocation();
  const product = useAsync(() => catalog.getProduct(merchantId, storeId, productId), [catalog, merchantId, storeId, productId]);
  const shop = useAsync(() => catalog.getShop(merchantId, storeId), [catalog, merchantId, storeId]);
  const stock = useAsync(() => catalog.stock(productId), [catalog, productId]);
  const [skuId, setSkuId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [image, setImage] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const missing = !isUuid(productId) || !isUuid(merchantId) || !isUuid(storeId) || product.error?.isNotFound || product.error?.status === 400;
  if (missing || (product.data && product.data.status !== 'ACTIVE'))
    // Decision 2026-10-27: shoppers only see ACTIVE products; drafts are not shown even by direct URL.
    return (
      <Empty>
        <div className="stack" style={{ alignItems: 'center' }}>
          <span>This product is not available.</span>
          <ButtonLink to="/">Back to shopping</ButtonLink>
        </div>
      </Empty>
    );
  if (product.loading && !product.data) return <Loading />;
  if (product.error) return <ErrorBox error={product.error} title="Could not open this product" />;
  const p = product.data!;
  const skus = sellableSkus(p);
  const available = (code: string) => stock.data?.[code];
  const sku = skus.find((s) => s.id === skuId) ?? skus.find((s) => stockLevel(available(s.sku)).kind !== 'sold_out') ?? skus[0];
  const left = sku ? available(sku.sku) : undefined;
  const soldOut = stockLevel(left).kind === 'sold_out';
  const images = sortedImages(p);
  const store = shop.data;
  // The shop must be loaded and taking orders (BR-STO-02); otherwise the buttons stay disabled with a reason.
  const canOrder = p.status === 'ACTIVE' && !!sku && !soldOut && !!store && takesOrders(store);

  const add = (thenGoToCart: boolean) => {
    if (!customer) {
      // BR-USR-02: an account is required to build a cart.
      navigate(`/login?next=${encodeURIComponent(path)}&reason=cart`);
      return;
    }
    if (!sku || !store) return;
    cart.add(
      {
        merchantId,
        storeId,
        storeName: store.name,
        productId: p.id,
        productName: p.name,
        skuId: sku.id,
        sku: sku.sku,
        skuName: sku.name,
        price: sku.price,
        currency: sku.currency,
        thumbnailUrl: p.thumbnailUrl ?? images[0]?.imageUrl,
        quantity: qty,
      },
      left,
    );
    if (thenGoToCart) navigate('/cart');
    else setToast('Added to your cart');
  };

  return (
    <>
      <nav className="crumbs" aria-label="breadcrumb">
        <Link to="/">Home</Link> / {store ? <Link to={shopPath({ merchantId, storeId })}>{store.name}</Link> : 'Shop'} / <span>{p.name}</span>
      </nav>
      <section className="sf-product">
        <div>
          <Img src={images[image]?.imageUrl ?? p.thumbnailUrl} alt={p.name} />
          {images.length > 1 && (
            <div className="sf-gallery">
              {images.map((img, i) => (
                <button key={img.id} type="button" onClick={() => setImage(i)} aria-label={`Image ${i + 1}`} style={{ padding: 0, border: i === image ? '2px solid var(--sale)' : '1px solid var(--border)', borderRadius: 6, background: 'none', cursor: 'pointer' }}>
                  <Img src={img.imageUrl} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <h1 style={{ fontSize: 20 }}>{p.name}</h1>
          <div className="sf-price-box">
            <span className="price">{sku ? formatMoney(sku.price, sku.currency) : '—'}</span>
          </div>

          {skus.length > 1 && (
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <span className="sf-label">Option</span>
              <div className="sf-options" role="group" aria-label="Options">
                {skus.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="sf-option"
                    aria-pressed={s.id === sku?.id}
                    disabled={stockLevel(available(s.sku)).kind === 'sold_out'}
                    onClick={() => {
                      setSkuId(s.id);
                      setQty(1);
                    }}
                  >
                    {s.name || s.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <span className="sf-label">Quantity</span>
            <div className="row">
              <div className="qty">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease" disabled={qty <= 1}>
                  −
                </button>
                <span aria-live="polite">{qty}</span>
                <button type="button" onClick={() => setQty((q) => clampQuantity(q + 1, left))} aria-label="Increase" disabled={qty >= clampQuantity(qty + 1, left)}>
                  +
                </button>
              </div>
              {stock.error ? <span className="small muted">Stock unavailable</span> : <StockText available={left} />}
            </div>
          </div>

          {shop.error && (
            <Notice tone="error">
              Could not load the shop, so this item cannot be added right now.{' '}
              <button type="button" className="btn btn-sm" onClick={shop.reload}>
                Retry
              </button>
            </Notice>
          )}
          {store && !takesOrders(store) && <Notice tone="warn">This shop is not taking orders right now.</Notice>}
          {store && takesOrders(store) && !isOpenNow(store) && (
            <span className="small muted">The shop is outside business hours{store.config?.allowPreOrder ? ' — you can pre-order.' : '.'}</span>
          )}

          <div className="row">
            <Button className="btn-lg" onClick={() => add(false)} disabled={!canOrder}>
              <CartIcon size={18} /> Add to cart
            </Button>
            <Button className="btn-lg" variant="primary" onClick={() => add(true)} disabled={!canOrder}>
              Buy now
            </Button>
          </div>
          {!customer && <span className="small muted">You will be asked to sign in first.</span>}
        </div>
      </section>

      {store && (
        <section className="sf-shop-banner" style={{ marginTop: 16 }}>
          <ShopAvatar name={store.name} />
          <div style={{ flex: 1 }}>
            <h2>{store.name}</h2>
            <span className="small muted">{[store.address?.district, store.address?.city].filter(Boolean).join(', ')}</span>
          </div>
          <Link to={shopPath({ merchantId, storeId })} className="btn">
            View shop
          </Link>
        </section>
      )}

      {p.description && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="card-head">
            <h2>Description</h2>
          </div>
          <div className="card-body" style={{ whiteSpace: 'pre-line' }}>
            {p.description}
          </div>
        </section>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
