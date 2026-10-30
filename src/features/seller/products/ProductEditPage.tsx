import { useState, type FormEvent } from 'react';
import type { Product } from '../../../domain/catalog';
import { toAppError } from '../../../domain/errors';
import { CURRENCY, formatMoney } from '../../../domain/money';
import {
  classifyConflict,
  effectiveCode,
  emptySkuRow,
  removedSkus,
  nextProductStatuses,
  PRODUCT_LIMITS,
  productFormProblems,
  toEditForm,
  toUpdateInput,
  type ProductForm,
  type SkuFormRow,
} from '../../../domain/productForm';
import { useAction, useAsync } from '../../../shared/lib/async';
import { PRODUCT_STATUS_LABEL } from '../../../shared/lib/format';
import { navigate } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, Empty, ErrorBox, Field, Input, Loading, Notice, PageHeader, Select, Textarea } from '../../../shared/ui/ui';
import { merchantBase, storeBase } from '../paths';

interface Props {
  merchantId: string;
  storeId: string;
  productId: string;
}

export function ProductEditPage({ merchantId, storeId, productId }: Props) {
  const { products } = useServices();
  const product = useAsync(() => products.get(merchantId, storeId, productId), [products, merchantId, storeId, productId]);

  if (product.loading && !product.data) return <Loading />;
  if (product.error) return <ErrorBox error={product.error} title="Could not open the product" />;
  const p = product.data!;
  if (p.version == null) return <Empty>Editing needs a newer stores-service (update-product).</Empty>;
  // Keyed by version: "Reload latest" brings a new version and resets every field.
  return <EditForm key={p.version} merchantId={merchantId} storeId={storeId} product={p} onReloaded={product.setData} />;
}

function EditForm({ merchantId, storeId, product, onReloaded }: { merchantId: string; storeId: string; product: Product; onReloaded: (p: Product) => void }) {
  const { products } = useServices();
  const [form, setForm] = useState<ProductForm>(() => toEditForm(product));
  const [conflict, setConflict] = useState<'stale' | 'code-in-use' | 'unknown' | null>(null);
  // A 409 is either a stale version or a SKU code used by another product: compare versions, never parse the text.
  const save = useAction(async (f: ProductForm) => {
    try {
      return await products.update(merchantId, storeId, product.id, toUpdateInput(product, f));
    } catch (e) {
      if (toAppError(e).status === 409) {
        const latest = await products.get(merchantId, storeId, product.id).catch(() => undefined);
        setConflict(classifyConflict(product.version!, latest?.version));
      }
      throw e;
    }
  });
  const reload = useAction(() => products.get(merchantId, storeId, product.id));
  const base = storeBase(merchantId, storeId);
  const problems = productFormProblems({ ...form, name: form.name });
  const removed = removedSkus(product, form);
  const codes = form.skus.map(effectiveCode);
  const rowInvalid = (row: SkuFormRow, i: number) =>
    !effectiveCode(row) || codes.indexOf(effectiveCode(row)) !== i || productFormProblems({ description: '', images: [], skus: [row] }).length > 0;

  const set = (patch: Partial<ProductForm>) => setForm((f) => ({ ...f, ...patch }));
  const setSku = (i: number, patch: Partial<SkuFormRow>) => {
    if (patch.sku !== undefined && conflict === 'code-in-use') setConflict(null);
    setForm((f) => ({ ...f, skus: f.skus.map((r, j) => (j === i ? { ...r, ...patch } : r)) }));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setConflict(null);
    const saved = await save.run(form);
    if (saved) navigate(`${base}/products/${saved.id}`);
  };

  const reloadLatest = async () => {
    const latest = await reload.run();
    if (latest) onReloaded(latest);
  };

  return (
    <>
      <PageHeader
        title={`Edit ${product.name}`}
        crumbs={[
          { to: merchantBase(merchantId), label: 'Stores' },
          { to: `${base}/products`, label: 'Products' },
          { to: `${base}/products/${product.id}`, label: product.name },
          { label: 'Edit' },
        ]}
      />
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Card title="Product">
          <div className="stack">
            <Field label="Product name" hint="shown to shoppers">
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={255} required />
            </Field>
            <Field label="Description" hint={`${form.description.length} / ${PRODUCT_LIMITS.description}`}>
              <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
            <Field label="Status" hint="Shoppers see only products on sale. A product cannot go back to draft.">
              <Select value={form.status} onChange={(e) => set({ status: e.target.value as ProductForm['status'] })}>
                {nextProductStatuses(product.status).map((s) => (
                  <option key={s} value={s}>
                    {PRODUCT_STATUS_LABEL[s]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
        <Card
          title="Options (SKUs)"
          actions={
            <Button size="sm" disabled={form.skus.length >= PRODUCT_LIMITS.skus} onClick={() => set({ skus: [...form.skus, emptySkuRow()] })}>
              + Option
            </Button>
          }
        >
          <div className="stack">
            {form.skus.map((row, i) => {
              const isNew = !row.id;
              const invalid = (conflict === 'code-in-use' && isNew) || rowInvalid(row, i);
              return (
                <div key={row.id ?? row.key} className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto', alignItems: 'end' }}>
                  <Field label="SKU code" hint={isNew ? 'unique in the store' : 'cannot change'}>
                    <Input value={row.sku} onChange={(e) => setSku(i, { sku: e.target.value })} readOnly={!isNew} maxLength={100} aria-invalid={invalid} />
                  </Field>
                  <Field label="Option name">
                    <Input value={row.name} onChange={(e) => setSku(i, { name: e.target.value })} placeholder="e.g. Large" maxLength={255} />
                  </Field>
                  <Field label={`Price (${row.currency})`} hint={priceHint(row)}>
                    <Input type="number" min={0} step={row.currency === CURRENCY ? 1 : 0.01} value={row.price} onChange={(e) => setSku(i, { price: e.target.value })} aria-invalid={invalid} />
                  </Field>
                  <Field label="Weight (g)">
                    <Input type="number" min={0} step={0.01} value={row.weight} onChange={(e) => setSku(i, { weight: e.target.value })} />
                  </Field>
                  <Field label="Status">
                    <Select value={row.status} onChange={(e) => setSku(i, { status: e.target.value as SkuFormRow['status'] })}>
                      <option value="ACTIVE">On sale</option>
                      <option value="INACTIVE">Not on sale</option>
                    </Select>
                  </Field>
                  <Button variant="ghost" onClick={() => set({ skus: form.skus.filter((_, j) => j !== i) })} aria-label={`Remove option ${effectiveCode(row)}`}>
                    ✕
                  </Button>
                </div>
              );
            })}
            {removed.length > 0 && (
              <div className="small muted">
                Removing {removed.map((s) => s.sku).join(', ')} on save. A removed code stays reserved in the store; adding the same code later brings back the same option
                (with the values you enter then).
              </div>
            )}
          </div>
        </Card>
        <Card
          title="Images"
          actions={
            <Button size="sm" disabled={form.images.length >= PRODUCT_LIMITS.images} onClick={() => set({ images: [...form.images, ''] })}>
              + Image
            </Button>
          }
        >
          <div className="stack">
            {form.images.map((url, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <Input type="url" aria-label={`Image ${i + 1} URL`} value={url} maxLength={PRODUCT_LIMITS.imageUrl} onChange={(e) => set({ images: form.images.map((u, j) => (j === i ? e.target.value : u)) })} placeholder="https://…" />
                <Button variant="ghost" onClick={() => set({ images: form.images.filter((_, j) => j !== i) })} aria-label={`Remove image ${i + 1}`}>
                  ✕
                </Button>
              </div>
            ))}
            <p className="small muted">The first image is shown first. Upload is not available yet.</p>
          </div>
        </Card>
        {problems.length > 0 && (
          <Notice tone="warn">
            <ul className="small" role="alert" style={{ margin: 0, paddingLeft: 18 }}>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Notice>
        )}
        <ErrorBox error={save.error} title="Could not save the product" />
        {save.error?.status === 0 && <div className="small" style={{ color: 'var(--warn)' }}>The change may have been saved. Saving again is safe.</div>}
        {conflict === 'stale' && (
          <Notice tone="warn">
            <div className="row">
              <span>Someone else changed this product. Reload to see the latest version; your unsaved edits will be lost.</span>
              <Button size="sm" onClick={reloadLatest} loading={reload.pending}>
                Reload latest
              </Button>
            </div>
          </Notice>
        )}
        {conflict === 'code-in-use' && <Notice tone="warn">Check the new SKU codes: another product of this store already uses one of them (see the message above).</Notice>}
        <ErrorBox error={reload.error} title="Could not reload the product" />
        <div className="row">
          <Button type="submit" variant="primary" loading={save.pending} disabled={problems.length > 0}>
            Save changes
          </Button>
          <Button variant="ghost" disabled={save.pending} onClick={() => navigate(`${base}/products/${product.id}`)}>
            Cancel
          </Button>
        </div>
        <p className="small muted">Saving publishes ProductUpdated; inventory-service follows within seconds (removed or not-on-sale options become not orderable).</p>
      </form>
    </>
  );
}

/** Shows how the typed amount reads (e.g. "30.000" is thirty đồng, not thirty thousand). */
function priceHint(row: SkuFormRow): string | undefined {
  const value = Number(row.price);
  return row.price.trim() && Number.isFinite(value) ? formatMoney(value, row.currency) : undefined;
}
