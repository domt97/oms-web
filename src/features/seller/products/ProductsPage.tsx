import { useState, type FormEvent } from 'react';
import { formatPriceRange } from '../../../domain/money';
import { useAction, useAsync } from '../../../shared/lib/async';
import { formatDateTime, PRODUCT_STATUS_LABEL } from '../../../shared/lib/format';
import { Link } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, ButtonLink, Card, Empty, ErrorBox, Field, Input, Loading, Notice, Pager } from '../../../shared/ui/ui';
import { storeBase } from '../paths';
import { StorePage } from '../stores/storeShared';

interface Props {
  merchantId: string;
  storeId: string;
}

export function ProductsPage({ merchantId, storeId }: Props) {
  const base = storeBase(merchantId, storeId);
  return (
    <StorePage
      merchantId={merchantId}
      storeId={storeId}
      title="Products & stock"
      actions={
        <ButtonLink to={`${base}/products/new`} variant="primary">
          + Product
        </ButtonLink>
      }
    >
      {() => <ProductList merchantId={merchantId} storeId={storeId} />}
    </StorePage>
  );
}

function ProductList({ merchantId, storeId }: Props) {
  const { products, flags } = useServices();
  const [page, setPage] = useState(0);
  const result = useAsync(() => products.list(merchantId, storeId, page, 10), [products, merchantId, storeId, page]);
  const [showImport, setShowImport] = useState(false);
  const base = storeBase(merchantId, storeId);

  return (
    <div className="stack">
      <Card
        title="Products"
        actions={
          // The import API takes any bucket from the request (open question 25): demo deployments only.
          flags.demo ? (
            <Button size="sm" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>
              Import from Excel
            </Button>
          ) : undefined
        }
        pad={false}
      >
        {flags.demo && showImport && <ImportForm merchantId={merchantId} storeId={storeId} onDone={result.reload} />}
        {result.loading && !result.data ? (
          <div className="card-body">
            <Loading />
          </div>
        ) : result.error ? (
          <div className="card-body">
            <ErrorBox error={result.error} />
          </div>
        ) : result.data!.items.length === 0 ? (
          <Empty>
            No products yet. <Link to={`${base}/products/new`}>Add your first product</Link>.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">SKUs</th>
                  <th className="num">Price</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {result.data!.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link to={`${base}/products/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="num">{p.skuCount}</td>
                    <td className="num">{formatPriceRange(p.minPrice, p.maxPrice, p.currency)}</td>
                    <td>
                      <Badge tone={p.status === 'ACTIVE' ? 'ok' : undefined}>{PRODUCT_STATUS_LABEL[p.status]}</Badge>
                    </td>
                    <td className="muted">{formatDateTime(p.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {result.data && <Pager page={page} totalPages={result.data.totalPages} onChange={setPage} />}
    </div>
  );
}

function ImportForm({ merchantId, storeId, onDone }: Props & { onDone: () => void }) {
  const { products } = useServices();
  const [bucket, setBucket] = useState('localdev-store-products');
  const [key, setKey] = useState('');
  const run = useAction(() => products.importFromS3(merchantId, storeId, bucket.trim(), key.trim()));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const r = await run.run();
    if (!r) return;
    if (r.ok) {
      setMessage({ ok: true, text: `Imported ${r.totalRecords ?? 0} rows.` });
      onDone();
    } else setMessage({ ok: false, text: r.errorMessage || 'Import failed.' });
  };

  return (
    <form className="card-body stack" onSubmit={onSubmit} style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="grid grid-2">
        <Field label="S3 bucket">
          <Input value={bucket} onChange={(e) => setBucket(e.target.value)} required />
        </Field>
        <Field label="File key">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="products.xlsx" required />
        </Field>
      </div>
      <p className="small muted">The file must already be on S3. Browser upload is not available yet (open question 25).</p>
      <ErrorBox error={run.error} />
      {message && <Notice tone={message.ok ? 'ok' : 'error'}>{message.text}</Notice>}
      <div>
        <Button type="submit" loading={run.pending}>
          Run import
        </Button>
      </div>
    </form>
  );
}
