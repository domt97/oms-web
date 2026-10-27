import { useState, type FormEvent } from 'react';
import { CURRENCY } from '../../../domain/money';
import { safeImageUrl } from '../../../domain/catalog';
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
  const create = useAction((input: CreateProductInput) => products.create(merchantId, storeId, input));
  const base = storeBase(merchantId, storeId);
  const setSku = (i: number, patch: Partial<SkuRow>) => setSkus((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  // BR-CAT-02: a SKU is unique within a store (the backend only checks per product: open question 26).
  const duplicates = new Set(skus.map((s) => s.sku.trim()).filter((v, i, a) => v && a.indexOf(v) !== i));
  const badImages = images.filter((u) => u.trim() && !safeImageUrl(u.trim()));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
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
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        </Card>
        <Card
          title="Options (SKUs)"
          actions={
            <Button size="sm" onClick={() => setSkus((r) => [...r, emptySku()])}>
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
                <Field label={`Price (${CURRENCY})`}>
                  <Input type="number" min={0} step={1000} value={s.price} onChange={(e) => setSku(i, { price: e.target.value })} required />
                </Field>
                <Field label="Weight (g)">
                  <Input type="number" min={0} value={s.weight} onChange={(e) => setSku(i, { weight: e.target.value })} />
                </Field>
                <Button variant="ghost" disabled={skus.length === 1} onClick={() => setSkus((r) => r.filter((_, j) => j !== i))} aria-label="Remove option">
                  ✕
                </Button>
              </div>
            ))}
            {duplicates.size > 0 && <div className="small" style={{ color: 'var(--danger)' }}>Duplicate SKU codes: {[...duplicates].join(', ')}</div>}
          </div>
        </Card>
        <Card
          title="Images"
          actions={
            <Button size="sm" onClick={() => setImages((r) => [...r, ''])}>
              + Image
            </Button>
          }
        >
          <div className="stack">
            {images.map((url, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <Input type="url" value={url} onChange={(e) => setImages((r) => r.map((u, j) => (j === i ? e.target.value : u)))} placeholder="https://…" />
                <Button variant="ghost" onClick={() => setImages((r) => r.filter((_, j) => j !== i))} aria-label="Remove image">
                  ✕
                </Button>
              </div>
            ))}
            {badImages.length > 0 && <div className="small" style={{ color: 'var(--danger)' }}>Only http(s) image URLs are allowed.</div>}
            <p className="small muted">The first image is the thumbnail. Upload is not available yet.</p>
          </div>
        </Card>
        <ErrorBox error={create.error} title="Could not create the product" />
        <div className="row">
          <Button type="submit" variant="primary" loading={create.pending} disabled={duplicates.size > 0 || badImages.length > 0}>
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
