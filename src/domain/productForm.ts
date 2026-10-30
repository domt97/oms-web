import { sortedImages, type Product, type ProductStatus, type SkuStatus } from './catalog';
import { CURRENCY } from './money';

/** BR-CAT-11: per product. */
export const PRODUCT_LIMITS = { skus: 100, images: 20, description: 5000, imageUrl: 2048 } as const;

/** product_skus.price is NUMERIC(18,2), dimensions NUMERIC(10,2). */
const PRICE_LIMIT = 1e16;
const DIMENSION_LIMIT = 1e8;

/** BR-CAT-10: DRAFT → ACTIVE / INACTIVE, ACTIVE ↔ INACTIVE, never back to DRAFT. */
export function nextProductStatuses(current: ProductStatus): ProductStatus[] {
  return current === 'DRAFT' ? ['DRAFT', 'ACTIVE', 'INACTIVE'] : ['ACTIVE', 'INACTIVE'];
}

/** Absolute http(s) URL — what update-product accepts for images. */
export function isAbsoluteHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Plain decimal amounts only ("1e3", "30,000" or "-1" are not accepted). */
const PLAIN_AMOUNT = /^\d+(\.\d+)?$/;

function decimals(value: string): number {
  const fraction = value.trim().split('.')[1] ?? '';
  return fraction.replace(/0+$/, '').length;
}

/** One option row of the create/edit form. Numbers are kept as typed (strings). */
export interface SkuFormRow {
  /** Set for SKUs that exist on the product; their code cannot change (BR-CAT-08). */
  id?: string;
  /** Stable React key for rows added in the form. */
  key?: string;
  sku: string;
  name: string;
  price: string;
  /** The SKU's own currency (existing SKUs keep theirs; new ones use the platform currency). */
  currency: string;
  weight: string;
  status: SkuStatus;
}

export interface ProductForm {
  name: string;
  description: string;
  status: ProductStatus;
  skus: SkuFormRow[];
  images: string[];
}

let rowSequence = 0;
export const emptySkuRow = (): SkuFormRow => ({ key: `new-${++rowSequence}`, sku: '', name: '', price: '', currency: CURRENCY, weight: '', status: 'ACTIVE' });

/** The code that is sent: existing codes exactly as stored (the backend does not trim), new codes trimmed. */
export const effectiveCode = (row: SkuFormRow): string => (row.id ? row.sku : row.sku.trim());

/**
 * Problems the backend would reject (400 / 422), shown next to the form. A hint only: the server decides and its
 * 4xx messages are shown as-is. `status` is the requested product status (create is always ACTIVE).
 */
export function productFormProblems(form: Pick<ProductForm, 'description' | 'skus' | 'images'> & { status?: ProductStatus; name?: string }): string[] {
  const problems: string[] = [];
  if (form.name !== undefined && !form.name.trim()) problems.push('The product needs a name.');
  if (form.name !== undefined && form.name.trim().length > 255) problems.push('The product name has at most 255 characters.');
  const codes = form.skus.map(effectiveCode);
  if (form.skus.length === 0) problems.push('Add at least one option.');
  if (form.skus.length > PRODUCT_LIMITS.skus) problems.push(`At most ${PRODUCT_LIMITS.skus} options.`);
  if (codes.some((c) => !c)) problems.push('Every option needs a SKU code.');
  const duplicates = codes.filter((c, i) => c && codes.indexOf(c) !== i);
  if (duplicates.length) problems.push(`Duplicate SKU codes: ${[...new Set(duplicates)].join(', ')}.`);
  if (codes.some((c) => c.length > 100)) problems.push('A SKU code has at most 100 characters.');

  for (const row of form.skus) {
    const label = effectiveCode(row) || 'new option';
    const price = Number(row.price);
    if (!PLAIN_AMOUNT.test(row.price.trim()) || price >= PRICE_LIMIT || decimals(row.price) > 2) {
      problems.push(`${label}: price must be zero or more, with at most 2 decimals.`);
    } else if (row.currency === CURRENCY && decimals(row.price) > 0) {
      problems.push(`${label}: a ${CURRENCY} price must be a whole number.`);
    }
    if (row.weight.trim() !== '') {
      const weight = Number(row.weight);
      if (!PLAIN_AMOUNT.test(row.weight.trim()) || weight >= DIMENSION_LIMIT || decimals(row.weight) > 2) {
        problems.push(`${label}: weight must be zero or more, with at most 2 decimals.`);
      }
    }
  }

  const images = form.images.map((u) => u.trim()).filter(Boolean);
  if (images.length > PRODUCT_LIMITS.images) problems.push(`At most ${PRODUCT_LIMITS.images} images.`);
  if (images.some((u) => !isAbsoluteHttpUrl(u))) problems.push('Image URLs must start with http:// or https://.');
  if (images.some((u) => u.length > PRODUCT_LIMITS.imageUrl)) problems.push(`An image URL has at most ${PRODUCT_LIMITS.imageUrl} characters.`);
  if (form.description.length > PRODUCT_LIMITS.description) problems.push(`The description has at most ${PRODUCT_LIMITS.description} characters.`);
  if (form.status === 'ACTIVE' && !form.skus.some((s) => s.status === 'ACTIVE')) {
    problems.push('An on-sale product needs at least one option on sale.');
  }
  return problems;
}

/** Full-replace request of update-product (stores-service PUT …/products/{productId}). */
export interface ProductUpdate {
  version: number;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  categoryId: string | null;
  status: ProductStatus;
  skus: Array<{
    id?: string;
    sku: string;
    name: string | null;
    price: number;
    currency: string;
    weight: number | null;
    length: number | null;
    width: number | null;
    height: number | null;
    status: SkuStatus;
  }>;
  images: Array<{ imageUrl: string; displayOrder: number }>;
}

const toText = (n: number | null | undefined): string => (n == null ? '' : String(n));

function requiredAmount(value: number | null, code: string): number {
  if (value == null || !Number.isFinite(value)) throw new Error(`${code}: a price is required.`);
  return value;
}

/** Stored options the form leaves out (removed on save); an option whose code is typed again in a new row is kept. */
export function removedSkus(product: Product, form: ProductForm): Product['skus'] {
  const keptIds = new Set(form.skus.map((row) => row.id).filter(Boolean));
  const retyped = new Set(form.skus.filter((row) => !row.id).map((row) => row.sku.trim()));
  return product.skus.filter((s) => !keptIds.has(s.id) && !retyped.has(s.sku));
}

/** The edit form for a loaded product. */
export function toEditForm(product: Product): ProductForm {
  return {
    name: product.name,
    description: product.description ?? '',
    status: product.status,
    skus: product.skus.map((s) => ({
      id: s.id,
      sku: s.sku,
      name: s.name ?? '',
      price: toText(s.price),
      currency: s.currency,
      weight: toText(s.weight),
      status: s.status,
    })),
    images: sortedImages(product).map((i) => i.imageUrl),
  };
}

/**
 * Update-product is a FULL replace: anything left out is cleared on the server. So every field the form does not edit
 * (thumbnail, category, each SKU's currency and dimensions) is sent back as loaded, and fields the user did not touch
 * keep their stored value exactly. An untouched form therefore produces the stored state and the server answers
 * "no change" without writing. SKUs removed in the form are left out (soft remove, BR-CAT-09).
 */
export function toUpdateInput(product: Product, form: ProductForm): ProductUpdate {
  if (product.version == null) throw new Error('This product has no version: the backend does not support updates yet.');
  const stored = new Map(product.skus.map((s) => [s.id, s]));
  const storedByCode = new Map(product.skus.map((s) => [s.sku, s]));
  const keptIds = new Set(form.skus.map((row) => row.id).filter(Boolean));
  const kept = (typed: string, original: string | null | undefined): string | null =>
    typed === (original ?? '') ? (original ?? null) : typed.trim() || null;
  const amount = (typed: string, original: number | null | undefined): number | null =>
    typed === toText(original) ? (original ?? null) : typed.trim() === '' ? null : Number(typed);

  const urls = form.images.map((u) => u.trim()).filter(Boolean);
  const original = sortedImages(product);
  const imagesUnchanged = urls.length === original.length && urls.every((u, i) => u === original[i].imageUrl);

  return {
    version: product.version,
    name: form.name === product.name ? product.name : form.name.trim(),
    description: kept(form.description, product.description),
    thumbnailUrl: product.thumbnailUrl ?? null,
    categoryId: product.categoryId ?? null,
    status: form.status,
    skus: form.skus.map((row) => {
      // The server matches SKUs by code: a "new" row with the code of an option removed in this form is that option.
      const readded = row.id ? undefined : storedByCode.get(row.sku.trim());
      const s = row.id ? stored.get(row.id) : readded && !keptIds.has(readded.id) ? readded : undefined;
      if (s && !row.id) {
        return {
          id: s.id,
          sku: s.sku,
          name: row.name.trim() || null,
          price: Number(row.price),
          currency: s.currency,
          weight: row.weight.trim() === '' ? null : Number(row.weight),
          length: s.length ?? null,
          width: s.width ?? null,
          height: s.height ?? null,
          status: row.status,
        };
      }
      if (s) {
        return {
          id: s.id,
          sku: s.sku,
          name: kept(row.name, s.name),
          price: requiredAmount(amount(row.price, s.price), s.sku),
          currency: s.currency,
          weight: amount(row.weight, s.weight),
          length: s.length ?? null,
          width: s.width ?? null,
          height: s.height ?? null,
          status: row.status,
        };
      }
      return {
        sku: row.sku.trim(),
        name: row.name.trim() || null,
        price: Number(row.price),
        currency: row.currency,
        weight: row.weight.trim() === '' ? null : Number(row.weight),
        length: null,
        width: null,
        height: null,
        status: row.status,
      };
    }),
    images: imagesUnchanged
      ? original.map((i) => ({ imageUrl: i.imageUrl, displayOrder: i.displayOrder }))
      : urls.map((imageUrl, displayOrder) => ({ imageUrl, displayOrder })),
  };
}

/**
 * Update-product answers 409 both for a stale version and for a SKU code used by another product of the store.
 * Compare the version that was sent with the latest one instead of parsing the message.
 */
export function classifyConflict(sentVersion: number, latestVersion: number | undefined): 'stale' | 'code-in-use' | 'unknown' {
  if (latestVersion === undefined) return 'unknown';
  return latestVersion !== sentVersion ? 'stale' : 'code-in-use';
}
