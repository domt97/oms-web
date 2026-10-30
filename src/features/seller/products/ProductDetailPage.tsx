import { useState, type FormEvent } from 'react';
import { sortedImages, type Sku } from '../../../domain/catalog';
import { isStockOut, STOCK_IN_TYPES, STOCK_OUT_TYPES, type Inventory, type StockMovementType } from '../../../domain/inventory';
import { formatMoney } from '../../../domain/money';
import { useAction, useAsync } from '../../../shared/lib/async';
import { formatDateTime, MOVEMENT_LABEL, PRODUCT_STATUS_LABEL } from '../../../shared/lib/format';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, ButtonLink, Card, Empty, ErrorBox, Field, IdChip, Img, Input, Loading, PageHeader, Select, Toast } from '../../../shared/ui/ui';
import { merchantBase, storeBase } from '../paths';

interface Props {
  merchantId: string;
  storeId: string;
  productId: string;
}

export function ProductDetailPage({ merchantId, storeId, productId }: Props) {
  const { products, inventory } = useServices();
  const product = useAsync(() => products.get(merchantId, storeId, productId), [products, merchantId, storeId, productId]);
  const stock = useAsync(() => inventory.byProduct(productId), [inventory, productId]);
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const base = storeBase(merchantId, storeId);

  if (product.loading && !product.data) return <Loading />;
  if (product.error) return <ErrorBox error={product.error} title="Could not open the product" />;
  const p = product.data!;
  const bySku = new Map((stock.data ?? []).map((i) => [i.sku, i]));
  const selectedInventory = stock.data?.find((i) => i.id === selected);
  const images = sortedImages(p);

  const onAdjusted = (inv: Inventory) => {
    stock.setData((stock.data ?? []).map((i) => (i.id === inv.id ? inv : i)));
    setToast(`Stock updated for ${inv.sku}`);
  };

  return (
    <>
      <PageHeader
        crumbs={[{ to: merchantBase(merchantId), label: 'Stores' }, { to: `${base}/products`, label: 'Products' }, { label: p.name }]}
        title={p.name}
        sub={
          <span className="row">
            <Badge tone={p.status === 'ACTIVE' ? 'ok' : undefined}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
            <IdChip id={p.id} />
            <span className="small">Created {formatDateTime(p.createdAt)}</span>
          </span>
        }
        actions={
          <span className="row">
            {p.version != null && (
              <ButtonLink to={`${base}/products/${p.id}/edit`} variant="primary">
                Edit
              </ButtonLink>
            )}
            <a className="btn" href={`/product/${merchantId}/${storeId}/${p.id}`}>
              View as shopper
            </a>
          </span>
        }
      />
      <div className="grid grid-side">
        <Card title="Images & description">
          <div className="stack">
            <Img src={images[0]?.imageUrl ?? p.thumbnailUrl} alt={p.name} className="lg" />
            <p style={{ whiteSpace: 'pre-line' }}>{p.description || <span className="muted">No description.</span>}</p>
          </div>
        </Card>
        <Card
          title="Options & stock"
          actions={
            <Button size="sm" onClick={stock.reload} loading={stock.loading}>
              Refresh
            </Button>
          }
          pad={false}
        >
          {stock.error && (
            <div className="card-body">
              <ErrorBox error={stock.error} title="Could not read stock (inventory-service)" />
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th className="num">Price</th>
                  <th className="num">On hand</th>
                  <th className="num">Reserved</th>
                  <th className="num">Available</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.skus.map((sku) => (
                  <SkuRow key={sku.id} sku={sku} inventory={bySku.get(sku.sku)} selected={selected} onSelect={setSelected} />
                ))}
              </tbody>
            </table>
          </div>
          {stock.data && p.skus.some((sku) => !bySku.has(sku.sku)) && (
            <div className="card-body small muted">
              Some options have no stock record yet. Stock is created asynchronously from the ProductCreated / ProductUpdated events (Debezium → Kafka); press Refresh after a
              few seconds. If it stays empty, check the Debezium connector and inventory-service.
            </div>
          )}
        </Card>
      </div>
      {selectedInventory && (
        <>
          <div style={{ height: 16 }} />
          <div className="grid grid-2">
            <AdjustForm key={selectedInventory.id} inventory={selectedInventory} merchantId={merchantId} storeId={storeId} onAdjusted={onAdjusted} />
            <Movements inventoryId={selectedInventory.id} version={selectedInventory.updatedAt} />
          </div>
        </>
      )}
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function SkuRow({ sku, inventory, selected, onSelect }: { sku: Sku; inventory?: Inventory; selected: string | null; onSelect: (id: string | null) => void }) {
  const isSelected = !!inventory && inventory.id === selected;
  return (
    <tr style={isSelected ? { background: 'var(--brand-soft)' } : undefined}>
      <td>
        <div className="mono">{sku.sku}</div>
        {sku.name && <div className="small muted">{sku.name}</div>}
        {sku.status === 'INACTIVE' && <Badge>Not on sale</Badge>}
        {/* BR-INV-08: inventory follows the catalog a few seconds after a change. */}
        {inventory?.status === 'INACTIVE' && <Badge tone="warn">Not orderable</Badge>}
      </td>
      <td className="num">{formatMoney(sku.price, sku.currency)}</td>
      {inventory ? (
        <>
          <td className="num">{inventory.quantity}</td>
          <td className="num">{inventory.reservedQuantity}</td>
          <td className="num">
            <strong>{inventory.availableQuantity}</strong>
          </td>
          <td className="right">
            <Button size="sm" variant={isSelected ? 'primary' : undefined} onClick={() => onSelect(isSelected ? null : inventory.id)}>
              {isSelected ? 'Selected' : 'Adjust stock'}
            </Button>
          </td>
        </>
      ) : (
        <td colSpan={4} className="muted small">
          no stock record yet
        </td>
      )}
    </tr>
  );
}

function AdjustForm({ inventory, merchantId, storeId, onAdjusted }: { inventory: Inventory; merchantId: string; storeId: string; onAdjusted: (i: Inventory) => void }) {
  const { inventory: inventoryPort } = useServices();
  const [type, setType] = useState<StockMovementType>('RECEIVE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useAction(() => inventoryPort.adjust(inventory.id, { merchantId, storeId, type, quantity: Number(quantity), reason: reason.trim() || undefined }));
  const out = isStockOut(type);
  const tooMuch = out && Number(quantity) > inventory.availableQuantity;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const inv = await adjust.run();
    if (inv) {
      onAdjusted(inv);
      setQuantity('');
      setReason('');
    }
  };

  return (
    <Card title={`Adjust stock · ${inventory.sku}`}>
      <form className="stack" onSubmit={onSubmit}>
        <div className="grid grid-2">
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as StockMovementType)}>
              <optgroup label="Stock in">
                {STOCK_IN_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MOVEMENT_LABEL[t]}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Stock out">
                {STOCK_OUT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MOVEMENT_LABEL[t]}
                  </option>
                ))}
              </optgroup>
            </Select>
          </Field>
          <Field label="Quantity" hint={out ? `max ${inventory.availableQuantity}` : undefined}>
            <Input type="number" min={1} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          </Field>
        </div>
        <Field label="Note">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. batch received 27 Oct" />
        </Field>
        {tooMuch && <div className="small" style={{ color: 'var(--warn)' }}>More than available; the backend will reject it.</div>}
        <ErrorBox error={adjust.error} />
        {adjust.error?.status === 0 && (
          // No idempotency key on this endpoint: a timed-out request may still have been applied.
          <div className="small" style={{ color: 'var(--warn)' }}>The change may still have been applied. Check the movements (Refresh) before trying again.</div>
        )}
        <div>
          <Button type="submit" variant="primary" loading={adjust.pending}>
            {out ? 'Remove stock' : 'Add stock'}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Movements({ inventoryId, version }: { inventoryId: string; version: string }) {
  const { inventory } = useServices();
  const list = useAsync(() => inventory.movements(inventoryId), [inventory, inventoryId, version]);
  const rows = [...(list.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Card title="Stock movements" pad={false}>
      {list.loading && !list.data ? (
        <div className="card-body">
          <Loading />
        </div>
      ) : list.error ? (
        <div className="card-body">
          <ErrorBox error={list.error} />
        </div>
      ) : rows.length === 0 ? (
        <Empty>No stock changes yet.</Empty>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th className="num">Qty</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="small">{formatDateTime(m.createdAt)}</td>
                  <td>{MOVEMENT_LABEL[m.type]}</td>
                  <td className="num" style={{ color: isStockOut(m.type) ? 'var(--danger)' : 'var(--ok)' }}>
                    {isStockOut(m.type) ? '−' : '+'}
                    {m.quantity}
                  </td>
                  <td className="small muted">{m.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card-body small muted">Only manual adjustments are recorded; reservations and order confirmations are not yet (open question 14).</div>
    </Card>
  );
}
