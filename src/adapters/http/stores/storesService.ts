import type { BusinessHour } from '../../../domain/store';
import type { CollectionPort, MerchantPort, ProductPort, StorePort, UpdateProductInput } from '../../../ports';
import { AppError } from '../../../domain/errors';
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
  UpdateStoreProductRequest,
} from './dto';
import { toAvailability, toCollection, toMerchant, toPage, toProduct, toStore, toSummary } from './mappers';

/** Import runs in the request (stores-service BR-CAT-13): up to ~15 s at the file limits, plus up to 40 s waiting for a slot. */
export const IMPORT_TIMEOUT_MS = 60_000;
export const IMPORT_BUSY_MESSAGE = 'The server is busy with other imports. Try again in a minute.';

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
    update: async (merchantId, storeId, productId, input) =>
      toProduct(await http.put<StoreProductResponse>(`${s(merchantId, storeId)}/products/${encodeURIComponent(productId)}`, toUpdateRequest(input))),
    list: async (merchantId, storeId, page, size, options) =>
      toPage(
        await http.get<PagedResult<StoreProductPreviewResponse>>(`${s(merchantId, storeId)}/products/search`, {
          pageNumber: page,
          pageSize: size,
          sortBy: 'createdAt',
          direction: 'DESC',
          notInCollectionId: options?.notInCollectionId,
        }),
        toSummary,
      ),
    importFromS3: async (merchantId, storeId, bucket, key) => {
      // stores-service answers 200 SUCCESS, or 200 FAILED (nothing written; the rule broken, or a generic message for an
      // internal error); 4xx for the file or a store already importing (409) — those messages are shown as sent.
      // A large import can take ~15 s, more when the server waits for a free slot (up to 40 s): longer timeout.
      try {
        const r = await http.post<ImportResultDto>(`${s(merchantId, storeId)}/products/import`, { path: bucket, fileName: key }, undefined, {
          timeoutMs: IMPORT_TIMEOUT_MS,
        });
        return { ok: r.status === 'SUCCESS', totalRecords: r.totalRecords, errorMessage: r.errorMessage };
      } catch (e) {
        // 503 = the server stayed busy with other imports (the client hides 5xx text, so say it here).
        if (e instanceof AppError && e.status === 503) throw new AppError(503, IMPORT_BUSY_MESSAGE);
        throw e;
      }
    },
  };
}

export function createCollectionAdapter(http: HttpClient): CollectionPort {
  const c = (merchantId: string, storeId: string) => `${s(merchantId, storeId)}/collections`;
  return {
    list: async (merchantId, storeId) => (await http.get<StoreCollectionResponse[]>(c(merchantId, storeId))).map(toCollection),
    get: async (merchantId, storeId, id) => toCollection(await http.get<StoreCollectionResponse>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}`)),
    products: async (merchantId, storeId, id, page, size) =>
      toPage(
        await http.get<PagedResult<StoreProductPreviewResponse>>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}/products`, {
          pageNumber: page,
          pageSize: size,
        }),
        toSummary,
      ),
    create: async (merchantId, storeId, input) =>
      toCollection(await http.post<StoreCollectionResponse>(c(merchantId, storeId), { ...input, productIds: [] })),
    addProducts: async (merchantId, storeId, id, productIds) =>
      toCollection(await http.post<StoreCollectionResponse>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}/add-products`, undefined, { productIds })),
    removeProducts: async (merchantId, storeId, id, productIds) =>
      toCollection(await http.post<StoreCollectionResponse>(`${c(merchantId, storeId)}/${encodeURIComponent(id)}/remove-products`, undefined, { productIds })),
  };
}

/** Explicit body (no spread of domain objects): exactly the fields of UpdateStoreProductRequest. */
function toUpdateRequest(input: UpdateProductInput): UpdateStoreProductRequest {
  return {
    version: input.version,
    name: input.name,
    description: input.description,
    thumbnailUrl: input.thumbnailUrl,
    categoryId: input.categoryId,
    status: input.status,
    skus: input.skus.map((s) => ({
      id: s.id,
      sku: s.sku,
      name: s.name,
      price: s.price,
      currency: s.currency,
      weight: s.weight,
      length: s.length,
      width: s.width,
      height: s.height,
      status: s.status,
    })),
    images: input.images.map((i) => ({ imageUrl: i.imageUrl, displayOrder: i.displayOrder })),
  };
}
