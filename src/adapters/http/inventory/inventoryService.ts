import type { Inventory, StockMovement, StockMovementType } from '../../../domain/inventory';
import type { InventoryPort } from '../../../ports';
import type { HttpClient } from '../client';
import { toAppError } from '../../../domain/errors';

// inventory-service, port 8058 (proxied at /v1/inventory).
// Reads take no merchant (open question 6); merchant/store are checked only when adjusting.
const BASE = '/v1/inventory/inventories';

interface InventoryDetailResponse {
  id: string;
  productId: string;
  sku: string;
  merchantId: string;
  storeId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  status: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}

interface StockMovementResponse {
  id: number;
  inventoryId: string;
  /** Raw from the backend: a type this build does not know yet is shown as its code. */
  type: StockMovementType | (string & {});
  quantity: number;
  referenceType?: string | null;
  reason?: string | null;
  createdAt: string;
}

const toInventory = (d: InventoryDetailResponse): Inventory => ({ ...d });
const toMovement = (d: StockMovementResponse): StockMovement => ({ ...d });

export function createInventoryAdapter(http: HttpClient): InventoryPort {
  return {
    // inventory-service answers 404 when the product has no inventory record at all (LoadInventoryService): that is a
    // fact (nothing orderable, BR-CAT-04), not a failure. Other errors stay errors (stock unknown, not blocking).
    byProduct: async (productId) => {
      try {
        return (await http.get<InventoryDetailResponse[]>(`${BASE}/products/${encodeURIComponent(productId)}`)).map(toInventory);
      } catch (e) {
        if (toAppError(e).isNotFound) return [];
        throw e;
      }
    },
    adjust: async (inventoryId, input) =>
      toInventory(
        await http.post<InventoryDetailResponse>(`${BASE}/${encodeURIComponent(inventoryId)}`, {
          merchantId: input.merchantId,
          storeId: input.storeId,
          movementType: input.type,
          quantity: input.quantity,
          reason: input.reason,
          referenceType: 'MANUAL',
        }),
      ),
    movements: async (inventoryId) => (await http.get<StockMovementResponse[]>(`${BASE}/stock-movements/${encodeURIComponent(inventoryId)}`)).map(toMovement),
  };
}
