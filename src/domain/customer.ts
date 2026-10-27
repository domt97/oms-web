/** A signed-in shopper. Business rule Q15: an account is required to place an order. */
export interface Customer {
  id: string;
  name: string;
  phone: string;
}
