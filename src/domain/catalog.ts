export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';
export type SkuStatus = 'ACTIVE' | 'INACTIVE';
export type CollectionStatus = 'ACTIVE' | 'INACTIVE';

export interface Sku {
  id: string;
  productId: string;
  sku: string;
  name?: string | null;
  price: number;
  currency: string;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  status: SkuStatus;
}

export interface ProductImage {
  id: number;
  imageUrl: string;
  displayOrder: number;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  categoryId?: string | null;
  status: ProductStatus;
  skus: Sku[];
  images: ProductImage[];
  /** Optimistic version for update-product; missing on backends without the update API. */
  version?: number;
  createdAt: string;
  updatedAt: string;
}

/** List item (search results, feeds). */
export interface ProductSummary {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  status: ProductStatus;
  skuCount: number;
  minPrice?: number | null;
  maxPrice?: number | null;
  currency: string;
  createdAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
  totalPages: number;
}

export interface Collection {
  id: string;
  name: string;
  description?: string | null;
  productCount: number;
  status: CollectionStatus;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export function sortedImages(p: Pick<Product, 'images'>): ProductImage[] {
  return [...p.images].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function sellableSkus(p: Pick<Product, 'skus'>): Sku[] {
  return p.skus.filter((s) => s.status === 'ACTIVE');
}

/** BR-CAT-01 + decision 2026-10-27: shoppers only see ACTIVE products. */
export function isOnSale(p: Pick<ProductSummary, 'status'>): boolean {
  return p.status === 'ACTIVE';
}

/** Merchant-entered URLs are untrusted: only http(s) images are rendered. */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url, 'https://invalid.local');
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

/** Case- and accent-insensitive text match, so "tra sua" finds "Trà sữa". */
export function normaliseSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function matchesQuery(p: Pick<ProductSummary, 'name' | 'description'>, query: string): boolean {
  const q = normaliseSearch(query);
  if (!q) return true;
  const hay = normaliseSearch(`${p.name} ${p.description ?? ''}`);
  return q.split(/\s+/).every((word) => hay.includes(word));
}
