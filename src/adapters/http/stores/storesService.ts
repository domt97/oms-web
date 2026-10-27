import type { BusinessHour } from '../../../domain/store';
import type { CollectionPort, MerchantPort, ProductPort, StorePort } from '../../../ports';
import type { HttpClient } from '../client';
import type {
  ImportResultDto,
  MerchantDto,
  PagedResult,
  StoreAvailabilityResponse,
  StoreCollectionResponse,
  StoreDetailResponse,
  StoreProductPreviewResponse,
  StoreProductResponse,
} from './dto';
import { toAvailability, toCollection, toMerchant, toPage, toProduct, toStore, toSummary } from './mappers';

// stores-service, port 8048 (proxied at /v1/store). Every store path is merchant-scoped.
const BASE = '/v1/store';
const m = (merchantId: string) => `${BASE}/merchants/${encodeURIComponent(merchantId)}`;
const s = (merchantId: string, storeId: string) => `${m(merchantId)}/stores/${encodeURIComponent(storeId)}`;

/** Closed days send no times; LocalTime accepts "HH:mm". */
const hoursBody = (hours: BusinessHour[]) =>
  hours.map((h) => (h.closed ? { dayOfWeek: h.dayOfWeek, closed: true, openingTime: null, closingTime: null } : { ...h, closed: false }));

export function createMerchantAdapter(http: HttpClient): MerchantPort {
  return {
    register: async (code, name) => toMerchant(await http.post<MerchantDto>(`${BASE}/merchants`, { code: code.trim(), name: name.trim() })),
    get: async (merchantId) => toMerchant(await http.get<MerchantDto>(m(merchantId))),
  };
}

export function createStoreAdapter(http: HttpClient): StorePort {
  return {
    create: async (merchantId, input) =>
      toStore(await http.post<StoreDetailResponse>(`${m(merchantId)}/stores`, { ...input, businessHours: hoursBody(input.businessHours) })),
    get: async (merchantId, storeId) => toStore(await http.get<StoreDetailResponse>(s(merchantId, storeId))),
    close: async (merchantId, storeId) => toStore(await http.put<StoreDetailResponse>(`${s(merchantId, storeId)}/close`)),
    reopen: async (merchantId, storeId) => toStore(await http.put<StoreDetailResponse>(`${s(merchantId, storeId)}/reopen`)),
    updateConfig: async (merchantId, storeId, config) =>
      toStore(await http.put<StoreDetailResponse>(`${s(merchantId, storeId)}/configs`, { ...config, openingTime: config.openingTime || null, closingTime: config.closingTime || null })),
    updateBusinessHours: async (merchantId, storeId, hours) =>
      toStore(await http.put<StoreDetailResponse>(`${s(merchantId, storeId)}/business-hours`, hoursBody(hours))),
    addClosure: async (merchantId, storeId, input) =>
      toAvailability(await http.post<StoreAvailabilityResponse>(`${s(merchantId, storeId)}/availability`, input)),
    cancelClosure: async (merchantId, storeId, availabilityId) => {
      await http.post<void>(`${s(merchantId, storeId)}/availability/${encodeURIComponent(availabilityId)}/cancel`);
    },
  };
}

export function createProductAdapter(http: HttpClient): ProductPort {
  return {
    create: async (merchantId, storeId, input) => toProduct(await http.post<StoreProductResponse>(`${s(merchantId, storeId)}/products`, input)),
    get: async (merchantId, storeId, productId) =>
      toProduct(await http.get<StoreProductResponse>(`${s(merchantId, storeId)}/products/${encodeURIComponent(productId)}`)),
    list: async (merchantId, storeId, page, size) =>
      toPage(
        await http.get<PagedResult<StoreProductPreviewResponse>>(`${s(merchantId, storeId)}/products/search`, {
          pageNumber: page,
          pageSize: size,
          sortBy: 'createdAt',
          direction: 'DESC',
        }),
        toSummary,
      ),
    importFromS3: async (merchantId, storeId, bucket, key) => {
      // 200 even when the import failed (open question 24): map the status field.
      const r = await http.post<ImportResultDto>(`${s(merchantId, storeId)}/products/import`, { path: bucket, fileName: key });
      return { ok: r.status === 'SUCCESS', totalRecords: r.totalRecords, errorMessage: r.errorMessage };
    },
  };
}

export function createCollectionAdapter(http: HttpClient): CollectionPort {
  const c = (merchantId: string, storeId: string) => `${s(merchantId, storeId)}/collections`;
  return {
    list: async (merchantId, storeId) => (await http.get<StoreCollectionResponse[]>(c(merchantId, storeId))).map(toCollection),
    get: async (merchantId, storeId, id) => toCollection(await http.get<StoreCollectionResponse>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}`)),
    create: async (merchantId, storeId, input) =>
      toCollection(await http.post<StoreCollectionResponse>(c(merchantId, storeId), { ...input, productIds: [] })),
    addProducts: async (merchantId, storeId, id, productIds) =>
      toCollection(await http.post<StoreCollectionResponse>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}/add-products`, undefined, { productIds })),
    removeProducts: async (merchantId, storeId, id, productIds) =>
      toCollection(await http.post<StoreCollectionResponse>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}/remove-products`, undefined, { productIds })),
  };
}
