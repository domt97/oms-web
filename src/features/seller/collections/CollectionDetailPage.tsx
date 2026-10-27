import { useState } from 'react';
import { formatPriceRange } from '../../../domain/money';
import { useAction, useAsync } from '../../../shared/lib/async';
import { plural } from '../../../shared/lib/format';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, Card, Empty, ErrorBox, IdChip, Loading, PageHeader, Toast } from '../../../shared/ui/ui';
import { merchantBase, storeBase } from '../paths';

interface Props {
  merchantId: string;
  storeId: string;
  collectionId: string;
}

export function CollectionDetailPage({ merchantId, storeId, collectionId }: Props) {
  const { collections, products } = useServices();
  const collection = useAsync(() => collections.get(merchantId, storeId, collectionId), [collections, merchantId, storeId, collectionId]);
  const list = useAsync(() => products.list(merchantId, storeId, 0, 50), [products, merchantId, storeId]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const add = useAction(() => collections.addProducts(merchantId, storeId, collectionId, [...picked]));
  const remove = useAction(() => collections.removeProducts(merchantId, storeId, collectionId, [...picked]));
  const base = storeBase(merchantId, storeId);

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = async (action: typeof add, verb: string) => {
    const c = await action.run();
    if (c) {
      collection.setData(c);
      setToast(`${verb} ${plural(picked.size, 'product')}`);
      setPicked(new Set());
    }
  };

  if (collection.loading && !collection.data) return <Loading />;
  if (collection.error) return <ErrorBox error={collection.error} title="Could not open the collection" />;
  const c = collection.data!;

  return (
    <>
      <PageHeader
        crumbs={[{ to: merchantBase(merchantId), label: 'Stores' }, { to: `${base}/collections`, label: 'Collections' }, { label: c.name }]}
        title={c.name}
        sub={
          <span className="row">
            <Badge tone={c.status === 'ACTIVE' ? 'ok' : undefined}>{c.status === 'ACTIVE' ? 'Visible' : 'Hidden'}</Badge>
            <span>{plural(c.productCount, 'product')}</span>
            <IdChip id={c.id} />
          </span>
        }
      />
      {c.description && <p style={{ marginBottom: 16 }}>{c.description}</p>}
      <Card
        title="Pick products from the store"
        actions={
          <>
            <Button size="sm" variant="primary" disabled={picked.size === 0} loading={add.pending} onClick={() => apply(add, 'Added')}>
              Add to collection
            </Button>
            <Button size="sm" variant="danger" disabled={picked.size === 0} loading={remove.pending} onClick={() => apply(remove, 'Removed')}>
              Remove from collection
            </Button>
          </>
        }
        pad={false}
      >
        {(add.error || remove.error) && (
          <div className="card-body">
            <ErrorBox error={add.error ?? remove.error} />
          </div>
        )}
        {list.loading && !list.data ? (
          <div className="card-body">
            <Loading />
          </div>
        ) : list.error ? (
          <div className="card-body">
            <ErrorBox error={list.error} />
          </div>
        ) : !list.data?.items.length ? (
          <Empty>This store has no products yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }} />
                  <th>Product</th>
                  <th className="num">Price</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((p) => (
                  <tr key={p.id} onClick={() => toggle(p.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} onClick={(e) => e.stopPropagation()} aria-label={`Select ${p.name}`} />
                    </td>
                    <td>{p.name}</td>
                    <td className="num">{formatPriceRange(p.minPrice, p.maxPrice, p.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="card-body small muted">The collection API returns a product count but not its products, so current members cannot be marked yet.</div>
      </Card>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
