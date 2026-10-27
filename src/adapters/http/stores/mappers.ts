import type { Collection, Page, Product, ProductSummary } from '../../../domain/catalog';
import type { Merchant } from '../../../domain/merchant';
import type { BusinessHour, Store, StoreAvailability } from '../../../domain/store';
import type {
  BusinessHourDto,
  MerchantDto,
  PagedResult,
  StoreAvailabilityResponse,
  StoreCollectionResponse,
  StoreDetailResponse,
  StoreProductPreviewResponse,
  StoreProductResponse,
} from './dto';

/** "08:00:00" → "08:00" */
export function hhmm(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null;
}

const toHour = (h: BusinessHourDto): BusinessHour => ({
  dayOfWeek: h.dayOfWeek,
  closed: h.closed,
  openingTime: hhmm(h.openingTime),
  closingTime: hhmm(h.closingTime),
});

export const toMerchant = (d: MerchantDto): Merchant => ({ ...d });

export const toStore = (d: StoreDetailResponse): Store => ({
  id: d.id,
  merchantId: d.merchantId,
  name: d.name,
  code: d.code,
  ownerId: d.ownerId,
  email: d.email,
  phone: d.phone,
  status: d.status,
  address: d.address ?? null,
  config: d.config ? { ...d.config, openingTime: hhmm(d.config.openingTime), closingTime: hhmm(d.config.closingTime) } : null,
  businessHours: (d.businessHours ?? []).map(toHour),
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export const toAvailability = (d: StoreAvailabilityResponse): StoreAvailability => ({ ...d });

export const toProduct = (d: StoreProductResponse): Product => ({
  id: d.id,
  storeId: d.storeId,
  name: d.name,
  description: d.description,
  thumbnailUrl: d.thumbnailUrl,
  status: d.status,
  skus: (d.skus ?? []).map((s) => ({ id: s.id, productId: s.productId, sku: s.sku, name: s.name, price: Number(s.price), currency: s.currency, weight: s.weight, status: s.status })),
  images: (d.images ?? []).map((i) => ({ id: i.id, imageUrl: i.imageUrl, displayOrder: i.displayOrder })),
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

export const toSummary = (d: StoreProductPreviewResponse): ProductSummary => ({
  id: d.id,
  storeId: d.storeId,
  name: d.name,
  description: d.description,
  thumbnailUrl: d.thumbnailUrl,
  status: d.status,
  skuCount: d.skuCount ?? 0,
  minPrice: d.minPrice == null ? null : Number(d.minPrice),
  maxPrice: d.maxPrice == null ? null : Number(d.maxPrice),
  currency: d.currency ?? 'VND',
  createdAt: d.createdAt,
});

export function toPage<D, T>(d: PagedResult<D>, map: (x: D) => T): Page<T> {
  return { items: (d.content ?? []).map(map), page: d.pageNumber, size: d.pageSize, total: d.totalElements, totalPages: d.totalPages };
}

export const toCollection = (d: StoreCollectionResponse): Collection => ({
  id: d.id,
  name: d.name,
  description: d.description,
  productCount: d.productCount ?? 0,
  status: d.status,
});
