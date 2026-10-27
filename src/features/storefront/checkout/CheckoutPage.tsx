import { useRef, useState, type FormEvent } from 'react';
import { groupByShop, subtotal } from '../../../domain/cart';
import { formatMoney } from '../../../domain/money';
import { isValidPhone, type PaymentMethod } from '../../../domain/order';
import { useAction, useObservable } from '../../../shared/lib/async';
import { navigate, Redirect } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, ErrorBox, Field, Input, MockNotice, Textarea } from '../../../shared/ui/ui';
import { RequireSignIn } from '../account/RequireSignIn';
import { useCartChecks } from '../cart/useCartChecks';

export function CheckoutPage() {
  return (
    <RequireSignIn what="checkout">
      <Checkout />
    </RequireSignIn>
  );
}

function Checkout() {
  const { cart, orders, session } = useServices();
  const lines = useObservable(cart);
  const customer = useObservable(session)!;
  const groups = groupByShop(lines);
  const { blocking, checking } = useCartChecks(lines);
  const [recipient, setRecipient] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [payment, setPayment] = useState<PaymentMethod>('COD');
  const place = useAction(orders.checkout);
  const phoneInvalid = phone.trim() !== '' && !isValidPhone(phone);
  // After a successful placement the cart is empty: go to the orders page, not back to the cart.
  const placedRef = useRef(false);

  if (lines.length === 0 && !place.pending && !placedRef.current) return <Redirect to="/cart" />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const placed = await place.run({ customerId: customer.id, lines, delivery: { recipient: recipient.trim(), phone: phone.trim(), address: address.trim(), note: note.trim() || undefined }, payment });
    if (placed) {
      placedRef.current = true;
      navigate(`/orders?placed=${placed.length}`, { replace: true });
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Checkout</h1>
      </div>
      <MockNotice>
        Demo checkout: orders are simulated in this browser. No stock is reserved, the shops are not notified, nothing is charged and the
        delivery fee is not quoted yet. With order-service, a multi-shop checkout is all-or-nothing.
      </MockNotice>
      <div style={{ height: 16 }} />
      <form className="grid grid-checkout" onSubmit={onSubmit}>
        <div className="stack">
          <Card title="Delivery address">
            <div className="stack">
              <div className="grid grid-2">
                <Field label="Recipient">
                  <Input value={recipient} onChange={(e) => setRecipient(e.target.value)} autoComplete="name" required />
                </Field>
                <Field label="Phone">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" required aria-invalid={phoneInvalid} />
                </Field>
              </div>
              {phoneInvalid && <span className="sf-issue">Enter a valid Vietnamese phone number.</span>}
              <Field label="Address">
                <Input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder="House number, street, ward, district, city" required />
              </Field>
              <Field label="Note for the shops">
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </Card>
          <Card title="Payment">
            <div className="stack">
              <label className="check">
                <input type="radio" name="pay" checked={payment === 'COD'} onChange={() => setPayment('COD')} /> Cash on delivery
              </label>
              <label className="check">
                <input type="radio" name="pay" checked={payment === 'ONLINE'} onChange={() => setPayment('ONLINE')} /> Pay online (demo)
              </label>
            </div>
          </Card>
        </div>

        <div className="sf-summary">
          <Card title={`${groups.length} ${groups.length === 1 ? 'order' : 'orders'}`}>
            <div className="stack">
              {groups.map((g) => (
                <div key={g.storeId} className="row between">
                  <span>
                    {g.storeName} <span className="small muted">· {g.itemCount} items</span>
                  </span>
                  <span>{formatMoney(g.subtotal)}</span>
                </div>
              ))}
              <div className="row between">
                <span className="muted">Delivery</span>
                <span className="small muted">Quoted by the delivery partner (not yet)</span>
              </div>
              <span className="small muted">Indicative total: with order-service, each shop reprices the order.</span>
              <div className="row between" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <strong>Total</strong>
                <span className="price" style={{ fontSize: 20 }}>
                  {formatMoney(subtotal(lines))}
                </span>
              </div>
              <ErrorBox error={place.error} />
              {blocking && <span className="sf-issue">Some items need attention — go back to the cart.</span>}
              <Button type="submit" variant="primary" className="btn-lg btn-block" loading={place.pending} disabled={blocking || checking || phoneInvalid}>
                Place {groups.length > 1 ? `${groups.length} orders` : 'order'}
              </Button>
            </div>
          </Card>
        </div>
      </form>
    </>
  );
}
