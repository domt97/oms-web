import { useState, type FormEvent } from 'react';
import { CURRENCY, formatMoney } from '../../../domain/money';
import { PRODUCT_LIMITS, productFormProblems } from '../../../domain/productForm';
import type { CreateProductInput } from '../../../ports';
import { useAction } from '../../../shared/lib/async';
import { navigate } from '../../../shared/lib/router';
import { useServices } from '../../../shared/lib/services';
import { Button, Card, ErrorBox, Field, Input, PageHeader, Textarea } from '../../../shared/ui/ui';
import { merchantBase, storeBase } from '../paths';

interface SkuRow {
  sku: string;
  name: string;
  price: string;
  weight: string;
}
const emptySku = (): SkuRow => ({ sku: '', name: '', price: '', weight: '' });

export function ProductCreatePage({ merchantId, storeId }: { merchantId: string; storeId: string }) {
  const { products } = useServices();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>(['']);
  const [skus, setSkus] = useState<SkuRow[]>([emptySku()]);
  const [showProblems, setShowProblems] = useState(false);
  const create = useAction((input: CreateProductInput) => products.create(merchantId, storeId, input));
  const base = storeBase(merchantId, storeId);
  const setSku = (i: number, patch: Partial<SkuRow>) => setSkus((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // BR-CAT-02: a SKU code is unique within the store, removed codes included; the backend answers 409 if it is taken.
  const duplicates = new Set(skus.map((s) => s.sku.trim()).filter((v, i, a) => v && a.indexOf(v) !== i));
  // Same checks as the edit form (limits, prices, http(s) images); the backend decides.
  const problems = productFormProblems({
    name,
    description,
    images,
    skus: skus.map((s) => ({ sku: s.sku, name: s.name, price: s.price, currency: CURRENCY, weight: s.weight, status: 'ACTIVE' })),
  });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (problems.length > 0) {
      setShowProblems(true);
      return;
    }
    const p = await create.run({
      name: name.trim(),
      description: description.trim() || undefined,
      skus: skus.map((s) => ({ sku: s.sku.trim(), name: s.name.trim() || undefined, price: Number(s.price), currency: CURRENCY, weight: s.weight ? Number(s.weight) : undefined })),
      images: images
        .map((u) => u.trim())
        .filter(Boolean)
        .map((imageUrl, displayOrder) => ({ imageUrl, displayOrder })),
    });
    if (p) navigate(`${base}/products/${p.id}`);
  };

  return (
    <>
      <PageHeader title="New product" crumbs={[{ to: merchantBase(merchantId), label: 'Stores' }, { to: `${base}/products`, label: 'Products' }, { label: 'New product' }]} />
      <form className="stack" onSubmit={onSubmit}>
        <Card title="Product">
          <div className="stack">
            <Field label="Product name" hint="shown to shoppers">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={255} required placeholder="e.g. Bubble milk tea" />
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={PRODUCT_LIMITS.description} />
            </Field>
          </div>
        </Card>
        <Card
          title="Options (SKUs)"
          actions={
            <Button size="sm" disabled={skus.length >= PRODUCT_LIMITS.skus} onClick={() => setSkus((r) => [...r, emptySku()])}>
              + Option
            </Button>
          }
        >
          <div className="stack">
            {skus.map((s, i) => (
              <div key={i} className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr)) auto', alignItems: 'end' }}>
                <Field label="SKU code" hint="unique in the store">
                  <Input value={s.sku} onChange={(e) => setSku(i, { sku: e.target.value })} maxLength={100} required aria-invalid={duplicates.has(s.sku.trim())} />
                </Field>
                <Field label="Option name">
                  <Input value={s.name} onChange={(e) => setSku(i, { name: e.target.value })} placeholder="e.g. Large" maxLength={255} />
                </Field>
                <Field label={`Price (${CURRENCY})`} hint={s.price.trim() && Number.isFinite(Number(s.price)) ? formatMoney(Number(s.price)) : undefined}>
                  <Input type="number" min={0} step={1} value={s.price} onChange={(e) => setSku(i, { price: e.target.value })} required />
                </Field>
                <Field label="Weight (g)">
                  <Input type="number" min={0} step={0.01} value={s.weight} onChange={(e) => setSku(i, { weight: e.target.value })} />
                </Field>
                <Button variant="ghost" disabled={skus.length === 1} onClick={() => setSkus((r) => r.filter((_, j) => j !== i))} aria-label={`Remove option ${i + 1}`}>
                  ✕
                </Button>
              </div>
            ))}
          </div>
        </Card>
        <Card
          title="Images"
          actions={
            <Button size="sm" disabled={images.length >= PRODUCT_LIMITS.images} onClick={() => setImages((r) => [...r, ''])}>
              + Image
            </Button>
          }
        >
          <div className="stack">
            {images.map((url, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <Input type="url" aria-label={`Image ${i + 1} URL`} value={url} maxLength={PRODUCT_LIMITS.imageUrl} onChange={(e) => setImages((r) => r.map((u, j) => (j === i ? e.target.value : u)))} placeholder="https://…" />
                <Button variant="ghost" onClick={() => setImages((r) => r.filter((_, j) => j !== i))} aria-label={`Remove image ${i + 1}`}>
                  ✕
                </Button>
              </div>
            ))}
            <p className="small muted">The first image is the thumbnail. Upload is not available yet.</p>
          </div>
        </Card>
        {showProblems && problems.length > 0 && (
          <ul className="small" role="alert" style={{ color: 'var(--danger)', margin: 0, paddingLeft: 18 }}>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <ErrorBox error={create.error} title="Could not create the product" />
        <div className="row">
          <Button type="submit" variant="primary" loading={create.pending} disabled={duplicates.size > 0}>
            Create product
          </Button>
          <Button variant="ghost" onClick={() => navigate(`${base}/products`)}>
            Cancel
          </Button>
        </div>
        <p className="small muted">After creation, inventory-service creates stock for each SKU (quantity 0) from the ProductCreated event.</p>
      </form>
    </>
  );
}
