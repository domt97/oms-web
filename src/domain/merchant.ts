export type MerchantStatus = 'ACTIVE' | 'SUSPENDED';

export interface Merchant {
  id: string;
  code: string;
  name: string;
  status: MerchantStatus;
  createdAt: string;
  updatedAt: string;
}

/** BR-MER-04: 1–50 ASCII letters or digits; unique and case-insensitive (stored upper-case). */
export const MERCHANT_CODE_MAX = 50;
const CODE_RE = /^[A-Za-z0-9]{1,50}$/;

export function isValidMerchantCode(code: string): boolean {
  return CODE_RE.test(code.trim());
}

export function normaliseMerchantCode(code: string): string {
  return code.trim().toUpperCase();
}
