import { useState, type FormEvent } from 'react';
import { formatPriceRange } from '../../../domain/money';
import { importFileProblem } from '../../../domain/productImport';
import { useAction, useAsync } from '../../../shared/lib/async';
import { formatDateTime, PRODUCT_STATUS_LABEL } from '../../../shared/lib/format';
import { Link } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Badge, Button, ButtonLink, Card, Empty, ErrorBox, Field, Loading, Notice, Pager } from '../../../shared/ui/ui';
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
  const { products } = useServices();
  const [page, setPage] = useState(0);
  const result = useAsync(() => products.list(merchantId, storeId, page, 10), [products, merchantId, storeId, page]);
  const [showImport, setShowImport] = useState(false);
  const base = storeBase(merchantId, storeId);

  return (
    <div className="stack">
      <Card
        title="Products"
        actions={
          <Button size="sm" onClick={() => setShowImport((v) => !v)} aria-expanded={showImport}>
            Import from Excel
          </Button>
        }
        pad={false}
      >
        {showImport && <ImportForm merchantId={merchantId} storeId={storeId} onDone={result.reload} />}
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
  const { productImport } = useServices();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const run = useAction((f: File) => productImport.importFile(merchantId, storeId, f));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    run.reset();
    if (!file) return;
    // Checked before anything is sent (BR-CAT-13, BR-CAT-17); the server checks again.
    const issue = importFileProblem(file.name, file.size);
    setProblem(issue);
    if (issue) return;
    const r = await run.run(file);
    if (!r) return;
    if (r.ok) {
      setMessage({ ok: true, text: `Imported ${r.totalRecords ?? 0} rows.` });
      onDone();
    } else setMessage({ ok: false, text: r.errorMessage || 'Import failed.' });
  };

  return (
    <form className="card-body stack" onSubmit={onSubmit} style={{ borderBottom: '1px solid var(--border)' }}>
      <Field label="Excel file">
        <input
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setProblem(null);
            setMessage(null);
            run.reset();
          }}
          required
        />
      </Field>
      <p className="small muted">
        Excel (.xlsx), up to 5 MB, with the sheets Product, Product SKU and Product Image. The file is uploaded to the
        store&apos;s import folder, then imported. All or nothing: a failed import changes nothing.
      </p>
      {problem && <Notice tone="error">{problem}</Notice>}
      <ErrorBox error={run.error} />
      {message && <Notice tone={message.ok ? 'ok' : 'error'}>{message.text}</Notice>}
      <div>
        <Button type="submit" loading={run.pending} disabled={!file}>
          Upload and import
        </Button>
      </div>
    </form>
  );
}
