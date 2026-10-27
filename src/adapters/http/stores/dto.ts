// stores-service wire format (Java DTOs). Anti-corruption layer: nothing outside adapters/http imports this.
// Instants are ISO strings; LocalTime is "HH:mm:ss" (or "HH:mm").

export interface MerchantDto {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface AddressDto {
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  ward?: string | null;
  district?: string | null;
  province?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
}

export interface ConfigDto {
  autoAcceptOrder: boolean;
  allowPreOrder: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
  timeZone: string;
  currency: string;
  preparationTimeMinutes: number;
  maxOrdersPerDay?: number | null;
}

export interface BusinessHourDto {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  openingTime?: string | null;
  closingTime?: string | null;
  closed: boolean;
}

export interface StoreDetailResponse {
  id: string;
  merchantId: string;
  name: string;
  code: string;
  ownerId: string;
  email?: string | null;
  phone?: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'CLOSED';
  address?: AddressDto | null;
  config?: ConfigDto | null;
  businessHours?: BusinessHourDto[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreAvailabilityResponse {
  id: string;
  storeId: string;
  type: 'TEMPORARY_CLOSURE' | 'HOLIDAY' | 'MAINTENANCE' | 'STAFF_SHORTAGE' | 'INVENTORY' | 'EMERGENCY';
  startTime: string;
  endTime?: string | null;
  reason?: string | null;
  cancelled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSkuDto {
  id: string;
  productId: string;
  sku: string;
  name?: string | null;
  price: number;
  currency: string;
  weight?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ProductImageDto {
  id: number;
  productId: string;
  imageUrl: string;
  displayOrder: number;
}

export interface StoreProductResponse {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  skus?: ProductSkuDto[] | null;
  images?: ProductImageDto[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoreProductPreviewResponse {
  id: string;
  storeId: string;
  name: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE';
  skuCount?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  currency?: string | null;
  createdAt: string;
}

/** oms-core PagedResult; Lombok `boolean isLast` serialises as "last". */
export interface PagedResult<T> {
  content: T[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  last?: boolean;
}

export interface StoreCollectionResponse {
  id: string;
  name: string;
  description?: string | null;
  productCount?: number | null;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface ImportResultDto {
  status: 'SUCCESS' | 'FAILED';
  totalRecords?: number | null;
  errorMessage?: string | null;
}
