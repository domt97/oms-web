import { useEffect, useState, type ReactNode } from 'react';
import type { Page, ProductSummary } from '../../../domain/catalog';
import { formatPriceRange } from '../../../domain/money';
import { useAction, useAsync, type AsyncState } from '../../../shared/lib/async';
import { plural, PRODUCT_STATUS_LABEL } from '../../../shared/lib/format';
import { Link } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, Card, Empty, ErrorBox, IdChip, Loading, PageHeader, Pager, Toast } from '../../../shared/ui/ui';
import { merchantBase, storeBase } from '../paths';

interface Props {
  merchantId: string;
  storeId: string;
  collectionId: string;
}

const PAGE_SIZE = 20;

/**
 * Two lists from the backend: the collection's products (A→Z, with Remove) and the store's products that are
 * not in it yet (picker for Add). The picker never offers a member, so the "already in the collection" 422
 * only happens with a stale page (another tab) — the lists are reloaded after every change.
 */
export function CollectionDetailPage({ merchantId, storeId, collectionId }: Props) {
  const { collections, products } = useServices();
  const base = storeBase(merchantId, storeId);
  const collection = useAsync(() => collections.get(merchantId, storeId, collectionId), [collections, merchantId, storeId, collectionId]);

  const [memberPage, setMemberPage] = useState(0);
  const members = useAsync(
    () => collections.products(merchantId, storeId, collectionId, memberPage, PAGE_SIZE),
    [collections, merchantId, storeId, collectionId, memberPage],
  );

  const [pickerPage, setPickerPage] = useState(0);
  const candidates = useAsync(
    () => products.list(merchantId, storeId, pickerPage, PAGE_SIZE, { notInCollectionId: collectionId }),
    [products, merchantId, storeId, collectionId, pickerPage],
  );

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const add = useAction((ids: string[]) => collections.addProducts(merchantId, storeId, collectionId, ids));
  const remove = useAction((id: string) => collections.removeProducts(merchantId, storeId, collectionId, [id]));
  const [removing, setRemoving] = useState<string | null>(null);

  // A list can shrink under the current page (this change, or another tab): a page past the end is moved to the
  // new last page instead of showing "empty" with no pager.
  useLastPageIfPastEnd(members.data, memberPage, setMemberPage);
  useLastPageIfPastEnd(candidates.data, pickerPage, setPickerPage);

  /** After a change: new count from the response, both lists reloaded (pages past the end are fixed above). */
  const refresh = () => {
    members.reload();
    candidates.reload();
  };

  const onAdd = async () => {
    const ids = [...picked];
    const c = await add.run(ids);
    if (!c) return;
    collection.setData(c);
    setPicked(new Set());
    setToast(`Added ${plural(ids.length, 'product')}`);
    refresh();
  };

  const onRemove = async (p: ProductSummary) => {
    setRemoving(p.id);
    const c = await remove.run(p.id);
    setRemoving(null);
    if (!c) return;
    collection.setData(c);
    setToast(`Removed ${p.name}`);
    refresh();
  };

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      <div className="stack">
        <Card title={`In this collection (${c.productCount})`} pad={false}>
          {remove.error && (
            <div className="card-body">
              <ErrorBox error={remove.error} />
            </div>
          )}
          <ProductTable
            state={members}
            empty="No products in this collection yet. Pick some below."
            productLink={(p) => `${base}/products/${p.id}`}
            action={(p) => (
              <Button size="sm" variant="danger" loading={removing === p.id} disabled={remove.pending} onClick={() => onRemove(p)}>
                Remove
              </Button>
            )}
          />
          {members.data && <Pager page={memberPage} totalPages={members.data.totalPages} onChange={setMemberPage} />}
        </Card>

        <Card
          title="Add products"
          actions={
            <Button size="sm" variant="primary" disabled={picked.size === 0} loading={add.pending} onClick={onAdd}>
              Add {picked.size > 0 ? plural(picked.size, 'product') : 'to collection'}
            </Button>
          }
          pad={false}
        >
          {add.error && (
            <div className="card-body">
              <ErrorBox error={add.error} />
            </div>
          )}
          <ProductTable
            state={candidates}
            empty={c.productCount > 0 ? 'Every product of this store is already in the collection.' : 'This store has no products yet.'}
            productLink={(p) => `${base}/products/${p.id}`}
            leading={(p) => (
              <input type="checkbox" checked={picked.has(p.id)} disabled={add.pending} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
            )}
          />
          {candidates.data && (
            <Pager
              page={pickerPage}
              totalPages={candidates.data.totalPages}
              onChange={(n) => {
                if (add.pending) return;
                setPicked(new Set());
                setPickerPage(n);
              }}
            />
          )}
          <div className="card-body small muted">Shows only products that are not in this collection yet, newest first.</div>
        </Card>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}

function useLastPageIfPastEnd(data: Page<ProductSummary> | undefined, page: number, setPage: (n: number) => void) {
  useEffect(() => {
    if (data && data.items.length === 0 && page > 0) setPage(Math.max(0, data.totalPages - 1));
  }, [data, page, setPage]);
}

function ProductTable({
  state,
  empty,
  productLink,
  leading,
  action,
}: {
  state: AsyncState<Page<ProductSummary>>;
  empty: string;
  productLink: (p: ProductSummary) => string;
  leading?: (p: ProductSummary) => ReactNode;
  action?: (p: ProductSummary) => ReactNode;
}) {
  if (state.loading && !state.data)
    return (
      <div className="card-body">
        <Loading />
      </div>
    );
  if (state.error)
    return (
      <div className="card-body">
        <ErrorBox error={state.error} />
      </div>
    );
  if (!state.data?.items.length) return <Empty>{empty}</Empty>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {leading && <th style={{ width: 40 }} />}
            <th>Product</th>
            <th>Status</th>
            <th className="num">Price</th>
            {action && <th />}
          </tr>
        </thead>
        <tbody>
          {state.data.items.map((p) => (
            <tr key={p.id}>
              {leading && <td>{leading(p)}</td>}
              <td>
                <Link to={productLink(p)}>{p.name}</Link>
              </td>
              <td>
                <Badge tone={p.status === 'ACTIVE' ? 'ok' : undefined}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
              </td>
              <td className="num">{formatPriceRange(p.minPrice, p.maxPrice, p.currency)}</td>
              {action && <td className="right">{action(p)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
